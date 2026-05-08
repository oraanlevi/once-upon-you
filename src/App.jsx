import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import BookCover from './components/BookCover';
import ChooseBook from './components/ChooseBook';
import UploadPhotos from './components/UploadPhotos';
import PreviewBook from './components/PreviewBook';
import StepTracker from './components/StepTracker';
import TopProgressBar from './components/TopProgressBar';
import CheckoutPage from './components/CheckoutPage';
import OrderSuccess from './components/OrderSuccess';
import ProductShowcase from './components/ProductShowcase';
import BrandLogo from './components/BrandLogo';
import AuthModal from './components/AuthModal';
import AccountPage from './components/AccountPage';
import OrderStatusPage from './components/OrderStatusPage';
import ContactModal from './components/ContactModal';
import CorporatePortal from './components/corporate/CorporatePortal';
import CustomizeBack from './components/CustomizeBack';
import { calculateCartPricing, getDefaultPageCount, normalizeAvailablePageCounts } from './utils/pricing';
import './App.css';
import './styles/ui-system.css';

const OPEN_DURATION_MS = 1450;
const SUPPORT_EMAIL = 'twiceuponus@gmail.com';
const STORAGE_KEY = 'twice_upon_us_builder_v3';
const SESSION_ID_STORAGE_KEY = 'twice_upon_us_session_id';
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001')
  .trim()
  .replace(/\/+$/, '');
const COLORING_API_URL = `${API_BASE_URL}/api/coloring-page`;
const COMPLETE_ORDER_API_URL = `${API_BASE_URL}/api/orders/complete`;
const CREATE_PAYMENT_INTENT_API_URL = `${API_BASE_URL}/api/create-payment-intent`;
const MAX_PERSISTED_UPLOADED_IMAGE_CHARS = 1_200_000;
const MAX_PERSISTED_GENERATED_IMAGE_CHARS = 4_500_000;
const SUPPORTED_UPLOAD_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
];
const SUPPORTED_UPLOAD_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'];
const STRIPE_PUBLISHABLE_KEY = (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '').trim();
const hasValidPublishableStripeKey = /^pk_(test|live)_/.test(STRIPE_PUBLISHABLE_KEY);
const stripePromise = hasValidPublishableStripeKey ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

const DEFAULT_SHIPPING_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
};

const DEFAULT_PRODUCT = {
  id: 'storybook',
  name: 'Custom Coloring Book',
  productType: 'book',
  isDigital: false,
  isPhysical: true,
  externalLink: '',
  basePriceCents: 500,
  pricePerPageCents: 100,
  compareAtPriceCents: 800,
  availablePageCounts: [2, 4, 6, 8],
  addOns: [],
};

const TRACKER_STEPS = [
  { key: 'cover',      label: 'The Idea',      shortLabel: 'Idea',     icon: '⌂' },
  { key: 'showcase',   label: 'How It Works',  shortLabel: 'How',      icon: '✦' },
  { key: 'choose',     label: 'Choose Book',   shortLabel: 'Book',     icon: '◈' },
  { key: 'customize',  label: 'Back Cover',    shortLabel: 'Cover',    icon: '◉' },
  { key: 'upload',     label: 'Upload Photos', shortLabel: 'Photos',   icon: '⇪' },
  { key: 'finalize',   label: 'Checkout',      shortLabel: 'Checkout', icon: '◧' },
];

const DEFAULT_TAGLINE = 'We turn your memories into a legendary story';

const VALID_STEPS = new Set([
  'choose',
  'customize',
  'upload',
  'preview',
  'checkout',
  'payment',
  'success',
]);

function createSessionId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `session-${Date.now()}`;
}

function clearBuilderStorage() {
  window.localStorage.removeItem(STORAGE_KEY);
  window.localStorage.removeItem('twice_upon_us_builder_v2');
  window.localStorage.removeItem('twice_upon_us_builder_v1');
  window.localStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

function loadPersistedSessionId() {
  try {
    const direct = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem('twice_upon_us_builder_v2');
    if (!raw) {
      return '';
    }

    const parsed = JSON.parse(raw);
    if (typeof parsed?.sessionId === 'string' && parsed.sessionId.trim()) {
      return parsed.sessionId.trim();
    }

    return '';
  } catch {
    return '';
  }
}

function getDeliveryEstimate() {
  const now = new Date();
  const from = new Date(now);
  const to = new Date(now);

  from.setDate(now.getDate() + 7);
  to.setDate(now.getDate() + 12);

  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `${formatter.format(from)} - ${formatter.format(to)}`;
}

function maskStripeKeyForLog(key) {
  const normalized = typeof key === 'string' ? key.trim() : '';
  const prefix = normalized.startsWith('pk_test_')
    ? 'pk_test'
    : normalized.startsWith('pk_live_')
      ? 'pk_live'
      : normalized.startsWith('sk_test_')
        ? 'sk_test'
        : normalized.startsWith('sk_live_')
          ? 'sk_live'
          : normalized
            ? 'unknown'
            : '';

  return {
    present: Boolean(normalized),
    prefix,
    last4: normalized ? normalized.slice(-4) : '',
    validPublishable: normalized.startsWith('pk_'),
  };
}

function revokeImageUrl(image) {
  if (!image?.url || image.isDataUrl || !image.url.startsWith('blob:')) {
    return;
  }

  URL.revokeObjectURL(image.url);
}

function dataUrlToFile(dataUrl, name = 'photo.png') {
  const [header, body] = dataUrl.split(',');
  const mimeMatch = header.match(/data:(.*?);base64/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
  const binary = window.atob(body);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], name, { type: mimeType });
}

function getFileExtension(filename = '') {
  const match = String(filename).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isSupportedUploadFile(file) {
  if (!(file instanceof File)) {
    return false;
  }

  if (SUPPORTED_UPLOAD_MIME_TYPES.includes(file.type)) {
    return true;
  }

  return SUPPORTED_UPLOAD_EXTENSIONS.includes(getFileExtension(file.name));
}

function loadPersistedBuilderState() {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ||
      window.localStorage.getItem('twice_upon_us_builder_v2');

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);

    const normalizeImages = (images, maxChars) =>
      Array.isArray(images)
        ? images.map((image) => {
            if (!image?.url || typeof image.url !== 'string') {
              return null;
            }

            if (image.url.length > maxChars) {
              return null;
            }

            return {
              url: image.url,
              isDataUrl: Boolean(image.isDataUrl),
              name: typeof image.name === 'string' ? image.name : '',
            };
          })
        : [];

    const normalizedUploadedImages = normalizeImages(
      parsed.uploadedImages,
      MAX_PERSISTED_UPLOADED_IMAGE_CHARS,
    );
    const normalizedGeneratedImages = normalizeImages(
      parsed.generatedImages,
      MAX_PERSISTED_GENERATED_IMAGE_CHARS,
    );

    const selectedPageCount =
      typeof parsed.selectedPageCount === 'number' && parsed.selectedPageCount > 0
        ? parsed.selectedPageCount
        : null;
    const currentStep = VALID_STEPS.has(parsed.currentStep) ? parsed.currentStep : 'choose';
    const uploadedCount = normalizedUploadedImages.filter(Boolean).length;
    const generatedCount = normalizedGeneratedImages.filter(Boolean).length;

    const requiresPages = ['upload', 'preview', 'checkout', 'payment', 'success'].includes(
      currentStep,
    );
    const hasValidPageState =
      selectedPageCount &&
      (normalizedUploadedImages.length === selectedPageCount ||
        normalizedGeneratedImages.length === selectedPageCount);
    const hasUploadsForLaterSteps =
      !['preview', 'checkout', 'payment', 'success'].includes(currentStep) ||
      uploadedCount > 0 ||
      generatedCount > 0;
    const hasSuccessState =
      currentStep !== 'success' ||
      (parsed.orderInfo && typeof parsed.orderInfo.number === 'string');

    if (
      (requiresPages && !hasValidPageState) ||
      !hasUploadsForLaterSteps ||
      !hasSuccessState
    ) {
      return null;
    }

    const introStage =
      parsed.introStage === 'cover' ||
      parsed.introStage === 'opening' ||
      parsed.introStage === 'showcase' ||
      parsed.introStage === 'done'
        ? parsed.introStage
        : 'cover';

    const normalizedIntroStage = introStage !== 'done' && introStage !== 'showcase' ? 'done' : introStage;

    return {
      introStage:
        normalizedIntroStage,
      currentStep,
      selectedPageCount,
      uploadedImages: normalizedUploadedImages,
      generatedImages: normalizedGeneratedImages,
      shippingData: {
        ...DEFAULT_SHIPPING_DATA,
        ...(parsed.shippingData ?? {}),
      },
      orderInfo:
        parsed.orderInfo && typeof parsed.orderInfo === 'object'
          ? {
              number:
                typeof parsed.orderInfo.number === 'string'
                  ? parsed.orderInfo.number
                  : 'TUU-000000',
              deliveryEstimate:
                typeof parsed.orderInfo.deliveryEstimate === 'string'
                  ? parsed.orderInfo.deliveryEstimate
                  : getDeliveryEstimate(),
            }
          : null,
      deliveryEstimate:
        typeof parsed.deliveryEstimate === 'string'
          ? parsed.deliveryEstimate
          : getDeliveryEstimate(),
      sessionId:
        typeof parsed.sessionId === 'string' && parsed.sessionId.trim()
          ? parsed.sessionId.trim()
          : createSessionId(),
      selectedAddOnIds: Array.isArray(parsed.selectedAddOnIds)
        ? parsed.selectedAddOnIds.filter((value) => typeof value === 'string')
        : [],
      addOnQuantities:
        parsed.addOnQuantities && typeof parsed.addOnQuantities === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.addOnQuantities).map(([key, value]) => [
                key,
                Number.parseInt(String(value), 10) || 1,
              ]),
            )
          : {},
      selectedProductId:
        typeof parsed.selectedProductId === 'string' ? parsed.selectedProductId : null,
      dedicationPageText:
        typeof parsed.dedicationPageText === 'string' ? parsed.dedicationPageText : '',
      backCoverId:
        typeof parsed.backCoverId === 'string' ? parsed.backCoverId : 'classic',
      backCoverDedication:
        typeof parsed.backCoverDedication === 'string' ? parsed.backCoverDedication : '',
      coverNotes:
        typeof parsed.coverNotes === 'string' ? parsed.coverNotes : '',
    };
  } catch {
    return null;
  }
}

async function requestColoringPage(image, { sessionId, pageIndex, sourceFile }) {
  if (!image?.url || typeof image.url !== 'string') {
    throw new Error('Invalid uploaded image data.');
  }

  const file =
    sourceFile instanceof File
      ? sourceFile
      : image.isDataUrl
        ? dataUrlToFile(image.url, image.name || 'photo.png')
        : dataUrlToFile(image.url, image.name || 'photo.png');

  console.debug('Sending image for coloring generation', {
    endpoint: COLORING_API_URL,
    name: file.name,
    type: file.type,
    size: file.size,
  });

  const formData = new FormData();
  formData.append('image', file);
  formData.append('sessionId', sessionId);
  formData.append('pageIndex', String(pageIndex));

  const response = await fetch(COLORING_API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'Generation request failed');
  }

  const data = await response.json();
  const imageBase64 = data?.imageBase64;
  console.debug('Coloring generation API response', {
    page: pageIndex + 1,
    cached: Boolean(data?.cached),
    hasImage: Boolean(imageBase64),
  });

  if (!imageBase64) {
    throw new Error('No generated image returned');
  }

  console.debug('Received generated coloring image', {
    hasBase64: Boolean(imageBase64),
    length: imageBase64.length,
  });

  return {
    url: `data:image/png;base64,${imageBase64}`,
    isDataUrl: true,
    name: image.name || 'coloring-page.png',
  };
}

function getFriendlyGenerationError(message) {
  const safeMessage = typeof message === 'string' ? message : '';
  const normalized = safeMessage.toLowerCase();

  if (
    normalized.includes('jpg') ||
    normalized.includes('jpeg') ||
    normalized.includes('png') ||
    normalized.includes('webp') ||
    normalized.includes('heic') ||
    normalized.includes('heif') ||
    normalized.includes('unsupported')
  ) {
    return 'Please upload a JPG, PNG, WebP, HEIC, or HEIF image.';
  }

  return safeMessage || 'Unable to generate coloring pages right now.';
}

function App() {
  const persistedSessionIdRef = useRef(loadPersistedSessionId());
  const persistedStateRef = useRef(loadPersistedBuilderState());
  const persistedState = persistedStateRef.current;

  useEffect(() => {
    const maskedKey = maskStripeKeyForLog(STRIPE_PUBLISHABLE_KEY);
    console.log(
      `[STRIPE FRONTEND] key present=${maskedKey.present} prefix=${maskedKey.prefix} last4=${maskedKey.last4} validPublishable=${maskedKey.validPublishable}`,
    );
  }, []);

  const [introStage, setIntroStage] = useState('cover');
  const [currentStep, setCurrentStep] = useState(persistedState?.currentStep ?? 'choose');
  const [selectedPageCount, setSelectedPageCount] = useState(
    persistedState?.selectedPageCount ?? 15,
  );
  const [uploadedImages, setUploadedImages] = useState(
    persistedState?.uploadedImages ?? [],
  );
  const [generatedImages, setGeneratedImages] = useState(
    persistedState?.generatedImages ?? [],
  );
  const [previewGenerationState, setPreviewGenerationState] = useState(
    persistedState?.generatedImages?.some(Boolean) ? 'ready' : 'idle',
  );
  const [samplePreviewIndex, setSamplePreviewIndex] = useState(
    Array.isArray(persistedState?.generatedImages)
      ? persistedState.generatedImages.findIndex(Boolean)
      : -1,
  );
  const [isGeneratingPages, setIsGeneratingPages] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationError, setGenerationError] = useState('');
  const autoGenerationStartedRef = useRef(false);
  const samplePreGenTimerRef = useRef(null);
  const mainContentRef = useRef(null);
  const [storageNotice, setStorageNotice] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { discountCents, code, description }
  const promoResultRef = useRef(null);
  const [promoError, setPromoError] = useState('');
  const [promoLoading, setPromoLoading] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentClientSecret, setPaymentClientSecret] = useState('');
  const [isPreparingPayment, setIsPreparingPayment] = useState(false);
  const [paymentSetupError, setPaymentSetupError] = useState('');
  const [orderInfo, setOrderInfo] = useState(persistedState?.orderInfo ?? null);
  const [shippingData, setShippingData] = useState(
    persistedState?.shippingData ?? DEFAULT_SHIPPING_DATA,
  );
  const [sessionId, setSessionId] = useState(
    persistedState?.sessionId || persistedSessionIdRef.current || createSessionId(),
  );
  const [selectedAddOnIds, setSelectedAddOnIds] = useState(
    persistedState?.selectedAddOnIds ?? [],
  );
  const [addOnQuantities, setAddOnQuantities] = useState(
    persistedState?.addOnQuantities ?? {},
  );
  const [products, setProducts] = useState([]);
  const [backCoverId, setBackCoverId] = useState(
    persistedState?.backCoverId ?? 'classic',
  );
  const [backCoverDedication, setBackCoverDedication] = useState(
    persistedState?.backCoverDedication ?? '',
  );
  const [dedicationPageText, setDedicationPageText] = useState(
    persistedState?.dedicationPageText ?? '',
  );
  const [coverNotes, setCoverNotes] = useState(
    persistedState?.coverNotes ?? '',
  );
  const [selectedProductId, setSelectedProductId] = useState(
    persistedState?.selectedProductId ?? 'large-book',
  );
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [productSaveError, setProductSaveError] = useState('');
  const [productSaveNotice, setProductSaveNotice] = useState('');

  // Auth
  const [authToken, setAuthToken] = useState(() => window.localStorage.getItem('tuu_auth_token') || '');
  const [authUser, setAuthUser] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showAccountPage, setShowAccountPage] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCorporatePortal, setShowCorporatePortal] = useState(
    () => Boolean(new URLSearchParams(window.location.search).get('groups'))
  );

  // URL-based flows: ?order=ID shows order status, ?reset=TOKEN shows password reset
  const [urlOrderId] = useState(() => new URLSearchParams(window.location.search).get('order') || '');
  const [urlResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '');
  const [showOrderStatus, setShowOrderStatus] = useState(() => Boolean(new URLSearchParams(window.location.search).get('order')));
  const [showResetPassword, setShowResetPassword] = useState(() => Boolean(new URLSearchParams(window.location.search).get('reset')));
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const uploadedImagesRef = useRef(uploadedImages);
  const uploadedSourceFilesRef = useRef(
    Array.isArray(persistedState?.uploadedImages)
      ? Array.from({ length: persistedState.uploadedImages.length }, () => null)
      : [],
  );
  const deliveryEstimateRef = useRef(
    persistedState?.deliveryEstimate ?? getDeliveryEstimate(),
  );

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId) || products[0] || null,
    [products, selectedProductId],
  );

  const cartSummary = useMemo(
    () =>
      calculateCartPricing({
        product: selectedProduct,
        selectedPageCount,
        selectedAddOnIds,
        addOnQuantities,
      }),
    [selectedProduct, selectedPageCount, selectedAddOnIds, addOnQuantities],
  );

  useEffect(() => {
    console.debug('Restored generated images', {
      count: generatedImages.filter(Boolean).length,
      totalSlots: generatedImages.length,
    });
  }, [generatedImages]);

  useEffect(() => {
    if (currentStep !== 'preview') {
      autoGenerationStartedRef.current = false;
      return;
    }
    // Auto-preview generation disabled — generation happens after payment only
    return;

    (async () => {
      setIsGeneratingPages(true);
      setGenerationError('');
      setSamplePreviewIndex(sampleIndex);
      setPreviewGenerationState('generating');
      setGenerationProgress('Preparing your sample preview…');

      try {
        const result = await requestColoringPage(uploads[sampleIndex], {
          sessionId,
          pageIndex: sampleIndex,
          sourceFile: uploadedSourceFilesRef.current[sampleIndex],
        });
        setGeneratedImages((prev) => {
          const next = [...prev];
          next[sampleIndex] = result;
          return next;
        });
        setPreviewGenerationState('ready');
      } catch (err) {
        setPreviewGenerationState('idle');
        setSamplePreviewIndex(-1);
        setGenerationError(getFriendlyGenerationError(err?.message));
      } finally {
        setIsGeneratingPages(false);
        setGenerationProgress('');
      }
    })();
  }, [currentStep]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  // Scroll to top whenever the step or intro stage changes
  useEffect(() => {
    if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [currentStep, introStage]);

  useEffect(() => {
    if (introStage !== 'opening') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIntroStage('showcase');
    }, OPEN_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [introStage]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/products`)
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data?.products) && data.products.length > 0) {
          setProducts(data.products);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedPageCount) {
      if (['upload', 'preview', 'checkout', 'payment'].includes(currentStep)) {
        setCurrentStep('choose');
      }
      return;
    }

    setUploadedImages((previousImages) => {
      if (previousImages.length === selectedPageCount) {
        return previousImages;
      }

      if (previousImages.length > selectedPageCount) {
        uploadedSourceFilesRef.current = uploadedSourceFilesRef.current.slice(0, selectedPageCount);
        previousImages.slice(selectedPageCount).forEach((image) => {
          revokeImageUrl(image);
        });

        return previousImages.slice(0, selectedPageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: selectedPageCount - previousImages.length }, () => null),
      ];
    });

    setGeneratedImages((previousImages) => {
      if (previousImages.length === selectedPageCount) {
        return previousImages;
      }

      if (previousImages.length > selectedPageCount) {
        return previousImages.slice(0, selectedPageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: selectedPageCount - previousImages.length }, () => null),
      ];
    });
  }, [selectedPageCount, currentStep]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    window.localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    const validPageCounts = normalizeAvailablePageCounts(selectedProduct.availablePageCounts);
    setSelectedPageCount((previous) =>
      validPageCounts.includes(previous) ? previous : getDefaultPageCount(validPageCounts),
    );

    const allowedAddOnIds = new Set(
      (selectedProduct.addOns || []).map((addOn) => addOn.id),
    );

    setSelectedAddOnIds((previous) => previous.filter((id) => allowedAddOnIds.has(id)));
    setAddOnQuantities((previous) =>
      Object.fromEntries(
        Object.entries(previous).filter(([id]) => allowedAddOnIds.has(id)),
      ),
    );
  }, [selectedProduct]);

  useEffect(() => {
    const basePayload = {
      introStage,
      currentStep,
      selectedPageCount,
      dedicationPageText: dedicationPageText || '',
      backCoverId: backCoverId || '',
      backCoverDedication: backCoverDedication || '',
      coverNotes: coverNotes || '',
      uploadedImages: uploadedImages.map((image) =>
        image
          ? {
              url:
                typeof image.url === 'string' &&
                image.url.length <= MAX_PERSISTED_UPLOADED_IMAGE_CHARS
                  ? image.url
                  : '',
              isDataUrl: Boolean(image.isDataUrl),
              name: image.name ?? '',
            }
          : null,
      ),
      shippingData,
      orderInfo,
      deliveryEstimate: deliveryEstimateRef.current,
      generatedImages: generatedImages.map((image) =>
        image
          ? {
              url:
                typeof image.url === 'string' &&
                image.url.length <= MAX_PERSISTED_GENERATED_IMAGE_CHARS
                  ? image.url
                  : '',
              isDataUrl: Boolean(image.isDataUrl),
              name: image.name ?? '',
            }
          : null,
      ),
      sessionId,
      selectedAddOnIds,
      addOnQuantities,
      selectedProductId: selectedProductId || selectedProduct?.id || '',
      cartSnapshot: {
        selectedPageCount: cartSummary.selectedPageCount,
        finalPriceCents: cartSummary.totalCents,
      },
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(basePayload));
      if (storageNotice) {
        setStorageNotice('');
      }
    } catch {
      try {
        const fallbackPayload = {
          ...basePayload,
          uploadedImages: [],
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(fallbackPayload));
        setStorageNotice(
          'Original photos may not persist across refresh, but generated previews were saved.',
        );
      } catch {
        setStorageNotice(
          'Progress could not be fully saved. You can continue, but refresh may lose recent uploads.',
        );
      }
    }
  }, [
    introStage,
    currentStep,
    selectedPageCount,
    uploadedImages,
    generatedImages,
    shippingData,
    orderInfo,
    sessionId,
    selectedAddOnIds,
    addOnQuantities,
    selectedProductId,
    cartSummary.selectedPageCount,
    cartSummary.totalCents,
    storageNotice,
    dedicationPageText,
    backCoverId,
    backCoverDedication,
    coverNotes,
  ]);

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((image) => {
        revokeImageUrl(image);
      });
    };
  }, []);

  // Restore auth user from token on mount
  useEffect(() => {
    if (!authToken) return;
    fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.user) setAuthUser(data.user);
        else { setAuthToken(''); window.localStorage.removeItem('tuu_auth_token'); }
      })
      .catch(() => {});
  }, []);

  const handleAuthSuccess = (token, user) => {
    setAuthToken(token);
    setAuthUser(user);
    window.localStorage.setItem('tuu_auth_token', token);
    setShowAuthModal(false);
    // Pre-fill shipping from saved profile if available
    if (user?.savedShipping) {
      const s = user.savedShipping;
      if (s.address || s.email) setShippingData((prev) => ({ ...prev, ...s }));
    }
  };

  const handleLogout = () => {
    setAuthToken('');
    setAuthUser(null);
    window.localStorage.removeItem('tuu_auth_token');
    setShowAccountPage(false);
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (resetPassword !== resetConfirm) { setResetError('Passwords do not match.'); return; }
    if (resetPassword.length < 6) { setResetError('Password must be at least 6 characters.'); return; }
    setResetError('');
    setResetLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: urlResetToken, password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setResetError(data.error || 'Failed to reset password.'); return; }
      setResetDone(true);
      handleAuthSuccess(data.token, data.user);
      window.history.replaceState({}, '', window.location.pathname);
    } catch {
      setResetError('Unable to connect. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const goToNextStep = (step) => {
    if (!VALID_STEPS.has(step)) {
      return;
    }
    setCurrentStep(step);
  };

  const goToPreviousStep = () => {
    if (currentStep === 'choose') {
      setIntroStage('cover');
      return;
    }

    if (currentStep === 'customize') {
      setCurrentStep('choose');
      return;
    }

    if (currentStep === 'upload') {
      setCurrentStep('customize');
      return;
    }

    if (currentStep === 'preview') {
      setCurrentStep('upload');
      return;
    }

    if (currentStep === 'checkout') {
      setCurrentStep('preview');
      return;
    }

    if (currentStep === 'payment') {
      setCurrentStep('checkout');
    }
  };

  const handleSelectProduct = (productId) => {
    setSelectedProductId(productId);
  };

  const handleToggleAddOn = (addOnId) => {
    setSelectedAddOnIds((previous) =>
      previous.includes(addOnId)
        ? previous.filter((id) => id !== addOnId)
        : [...previous, addOnId],
    );
  };

  const handleAddOnQuantityChange = (addOnId, quantity) => {
    const addOn = selectedProduct?.addOns?.find((a) => a.id === addOnId);
    if (!addOn) {
      return;
    }
    const clamped = Math.min(addOn.maxQuantity, Math.max(addOn.minQuantity, quantity));
    setAddOnQuantities((previous) => ({ ...previous, [addOnId]: clamped }));
  };

  const handleSaveProduct = async (productId, updates) => {
    setIsSavingProduct(true);
    setProductSaveError('');
    setProductSaveNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save product.');
      }
      setProducts((previous) =>
        previous.map((p) => (p.id === productId ? data.product : p)),
      );
      setProductSaveNotice('Product saved.');
    } catch (error) {
      setProductSaveError(error?.message || 'Failed to save product.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleCreateProduct = async (newProduct) => {
    setIsSavingProduct(true);
    setProductSaveError('');
    setProductSaveNotice('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newProduct),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create product.');
      }
      setProducts((previous) => [...previous, data.product]);
      setSelectedProductId(data.product.id);
      setProductSaveNotice('Product created.');
    } catch (error) {
      setProductSaveError(error?.message || 'Failed to create product.');
      throw error;
    } finally {
      setIsSavingProduct(false);
    }
  };

  const updatePageCount = (pageCount) => {
    const safePageCount = Number.parseInt(String(pageCount), 10) || 0;
    if (safePageCount <= 0) {
      return;
    }

    setSelectedPageCount(safePageCount);
    setPreviewGenerationState('idle');
    setUploadedImages((previousImages) => {
      if (previousImages.length === safePageCount) {
        return previousImages;
      }

      if (previousImages.length > safePageCount) {
        previousImages.slice(safePageCount).forEach((image) => {
          revokeImageUrl(image);
        });

        return previousImages.slice(0, safePageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: safePageCount - previousImages.length }, () => null),
      ];
    });

    setGeneratedImages((previousImages) => {
      if (previousImages.length === safePageCount) {
        return previousImages;
      }

      if (previousImages.length > safePageCount) {
        return previousImages.slice(0, safePageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: safePageCount - previousImages.length }, () => null),
      ];
    });
  };

  const handleUpload = (index, file) => {
    if (typeof index !== 'number' || index < 0 || index >= uploadedImagesRef.current.length) {
      setGenerationError('That upload slot is no longer valid. Please try again.');
      return;
    }

    if (!isSupportedUploadFile(file)) {
      setGenerationError('Please upload a JPG, PNG, WebP, HEIC, or HEIF image.');
      return;
    }

    uploadedSourceFilesRef.current[index] = file;
    // If they replaced the sample photo, cancel any pending pre-generation and reset
    if (index === samplePreviewIndex || index === 2) {
      clearTimeout(samplePreGenTimerRef.current);
      setPreviewGenerationState('idle');
      setSamplePreviewIndex(-1);
      autoGenerationStartedRef.current = false;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      setGenerationError('Could not read that image. Please try a different photo.');
    };

    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';

      if (!dataUrl) {
        setGenerationError('Could not read that image. Please try a different photo.');
        return;
      }

      setGenerationError('');

      setUploadedImages((previousImages) => {
        const nextImages = [...previousImages];
        const existingImage = nextImages[index];

        revokeImageUrl(existingImage);

        nextImages[index] = {
          url: dataUrl,
          isDataUrl: true,
          name: file.name,
        };

        return nextImages;
      });

      setGeneratedImages((previousImages) => {
        const nextImages = [...previousImages];
        if (index >= 0 && index < nextImages.length) {
          nextImages[index] = null;
        }
        return nextImages;
      });

      // Pre-generation disabled — coloring pages are generated manually in admin after payment
    };

    reader.readAsDataURL(file);
  };

  const handleCreateBook = async () => {
    setGenerationError('');
    setCurrentStep('preview');

    // Upload all original photos to the server immediately so they're always saved in admin.
    try {
      const sourceFiles = uploadedSourceFilesRef.current;
      const currentImages = uploadedImagesRef.current;
      const hasAny = currentImages.some(Boolean);
      if (hasAny) {
        const formData = new FormData();
        formData.append('sessionId', sessionId);
        currentImages.forEach((image, i) => {
          const file = sourceFiles[i];
          if (file instanceof File) {
            // Prefer the original File object (no re-encoding needed)
            formData.append('images', file);
            formData.append(`pageIndex_${formData.getAll('images').length - 1}`, String(i));
          } else if (image?.url && image.isDataUrl) {
            // Fall back: convert data URL back to a File for images from a previous session
            try {
              const blob = dataUrlToFile(image.url, image.name || `photo-${i}.png`);
              formData.append('images', blob);
              formData.append(`pageIndex_${formData.getAll('images').length - 1}`, String(i));
            } catch { /* skip this image if conversion fails */ }
          }
        });
        if (formData.getAll('images').length > 0) {
          await fetch(`${API_BASE_URL}/api/session/save-originals`, {
            method: 'POST',
            body: formData,
          }).catch(() => {}); // non-blocking — don't block the user
        }
      }
    } catch { /* silently ignore */ }
  };

  const handleGenerateSamplePreview = async () => {
    if (isGeneratingPages) {
      return;
    }

    const previewSourceIndex = uploadedImages.findIndex(
      (image) => image && typeof image.url === 'string' && image.url.length > 0,
    );
    if (previewSourceIndex < 0) {
      setGenerationError('Please upload at least one photo before requesting a sample preview.');
      return;
    }

    const previewSourceImage = uploadedImages[previewSourceIndex];
    setGenerationError('');
    setPreviewGenerationState('generating');
    setIsGeneratingPages(true);
    setSamplePreviewIndex(previewSourceIndex);
    setGenerationProgress('Preparing your sample preview...');

    try {
      const generatedImage = await requestColoringPage(previewSourceImage, {
        sessionId,
        pageIndex: previewSourceIndex,
        sourceFile: uploadedSourceFilesRef.current[previewSourceIndex],
      });

      setGeneratedImages((previousImages) => {
        const nextImages = [...previousImages];
        nextImages[previewSourceIndex] = generatedImage;
        return nextImages;
      });
      setPreviewGenerationState('ready');
      setGenerationProgress('Sample preview ready.');
    } catch (error) {
      setPreviewGenerationState('idle');
      setSamplePreviewIndex(-1);
      setGenerationError(getFriendlyGenerationError(error?.message));
    } finally {
      setIsGeneratingPages(false);
      setGenerationProgress('');
    }
  };

  const handleShippingFieldChange = (fieldName, value) => {
    setShippingData((previous) => ({
      ...previous,
      [fieldName]: value,
    }));
  };

  const effectiveTotalCents = promoResult
    ? Math.max(0, cartSummary.totalCents - (promoResult.discountCents || 0))
    : cartSummary.totalCents;

  const buildOrderPayload = ({ paymentIntentId = '', checkoutSessionId = '' } = {}) => {
    const submittedPageCount = cartSummary.selectedPageCount || selectedPageCount || 0;
    const submittedIncludedPagesCount = Math.min(8, submittedPageCount);

    return {
      sessionId,
      pageCount: submittedPageCount,
      includedPagesCount: submittedIncludedPagesCount,
      shipping: shippingData,
      deliveryEstimate: deliveryEstimateRef.current,
      selectedProduct: selectedProduct
        ? {
            id: selectedProduct.id,
            name: selectedProduct.name,
            productType: selectedProduct.productType,
            isDigital: Boolean(selectedProduct.isDigital),
            isPhysical: Boolean(selectedProduct.isPhysical),
            externalLink: selectedProduct.externalLink || '',
            basePriceCents: selectedProduct.basePriceCents,
            pricePerPageCents: selectedProduct.pricePerPageCents,
            availablePageCounts: selectedProduct.availablePageCounts || [],
          }
        : null,
      selectedAddOns: cartSummary.addOns,
      pricingSummary: {
        currency: cartSummary.currency,
        pageCount: submittedPageCount,
        includedPagesCount: submittedIncludedPagesCount,
        extraPagesCount: cartSummary.extraPagesCount,
        basePriceCents: cartSummary.basePriceCents,
        pricePerPageCents: cartSummary.pricePerPageCents,
        pagePriceTotalCents: cartSummary.pagePriceTotalCents,
        extraPagesPriceTotalCents: cartSummary.extraPagesPriceTotalCents,
        productSubtotalCents: cartSummary.productSubtotalCents,
        compareAtPriceCents: cartSummary.compareAtPriceCents,
        addOnsTotalCents: cartSummary.addOnsTotalCents,
        savingsCents: cartSummary.savingsCents,
        totalCents: cartSummary.totalCents,
      },
      paymentIntentId,
      checkoutSessionId,
      promoCode: promoCode.trim() || promoResultRef.current?.code || '',
      discountCents: promoResultRef.current?.discountCents || 0,
      backCoverId,
      backCoverDedication,
      dedicationPageText,
      coverNotes,
    };
  };

  const finalizeOrderForFulfillment = async (paymentIntentId) => {
    const payload = buildOrderPayload({ paymentIntentId });

    const orderHeaders = { 'Content-Type': 'application/json' };
    if (authToken) orderHeaders['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(COMPLETE_ORDER_API_URL, {
      method: 'POST',
      headers: orderHeaders,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Unable to save order files.');
    }

    return response.json();
  };

  // No useEffect for PI creation — it's triggered directly from handleContinueToPayment.

  const handleValidatePromo = async (code) => {
    if (!code.trim()) return;
    setPromoError('');
    setPromoLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/promo/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), totalCents: cartSummary.totalCents }),
      });
      const data = await res.json();
      if (!res.ok) { setPromoError(data.error || 'Invalid code.'); setPromoResult(null); promoResultRef.current = null; return; }
      setPromoResult(data);
      promoResultRef.current = data;
    } catch {
      setPromoError('Unable to validate code.');
    } finally {
      setPromoLoading(false);
    }
  };

  const handleContinueToPayment = async () => {
    const { firstName, lastName, email, address, city, postalCode, country } = shippingData;
    if (!firstName || !lastName || !email || !address || !city || !postalCode || !country) {
      setPaymentError('Please fill in all shipping fields before continuing.');
      return;
    }
    if (!email.includes('@') || !email.includes('.') || email.indexOf('@') === 0 || email.endsWith('.')) {
      setPaymentError('Please enter a valid email address.');
      return;
    }

    if (!hasValidPublishableStripeKey) {
      setPaymentSetupError('Payment is not configured. Please contact support.');
      return;
    }

    setPaymentError('');
    setPaymentSetupError('');
    setPaymentClientSecret('');
    setIsPreparingPayment(true);

    try {
      const payload = buildOrderPayload();
      payload.promoCode = promoResultRef.current?.code || payload.promoCode || '';
      const response = await fetch(CREATE_PAYMENT_INTENT_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const responseBody = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(responseBody.error || 'Unable to prepare secure payment.');
      if (!responseBody.clientSecret) throw new Error('Stripe did not return a client secret.');
      setPaymentClientSecret(responseBody.clientSecret);
      setCurrentStep('payment');
    } catch (error) {
      setPaymentSetupError(error?.message || 'Unable to prepare secure payment.');
    } finally {
      setIsPreparingPayment(false);
    }
  };

  const handleCompletePaidOrder = async (paymentIntentId) => {
    if (isProcessingPayment) {
      return;
    }

    setPaymentError('');
    setGenerationError('');
    setIsProcessingPayment(true);

    try {
      // 1. Save order + send email immediately after payment — do not wait for generation.
      const orderResult = await finalizeOrderForFulfillment(paymentIntentId);

      // 2. Show success page.
      setOrderInfo({
        number: orderResult?.orderId || `TUU-${Math.floor(100000 + Math.random() * 900000)}`,
        deliveryEstimate: orderResult?.deliveryEstimate || deliveryEstimateRef.current,
        createdAt: new Date().toISOString(),
        status: 'new',
      });
      setCurrentStep('success');
      setIsProcessingPayment(false);

      // 3. Generation is handled manually — no background generation needed.
    } catch (error) {
      setPaymentError(error?.message || 'Unable to complete your order after payment.');
      throw error;
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStartOver = () => {
    uploadedImagesRef.current.forEach((image) => {
      revokeImageUrl(image);
    });
    uploadedSourceFilesRef.current = [];

    setIntroStage('cover');
    setCurrentStep('choose');
    setBackCoverId('classic');
    setBackCoverDedication('');
    setDedicationPageText('');
    setCoverNotes('');
    setSelectedPageCount(null);
    setUploadedImages([]);
    setGeneratedImages([]);
    setPreviewGenerationState('idle');
    setSamplePreviewIndex(-1);
    setIsGeneratingPages(false);
    setGenerationProgress('');
    setGenerationError('');
    setPaymentError('');
    setPaymentClientSecret('');
    setPaymentSetupError('');
    setIsPreparingPayment(false);
    setIsProcessingPayment(false);
    setOrderInfo(null);
    setShippingData(DEFAULT_SHIPPING_DATA);
    setSelectedAddOnIds([]);
    setAddOnQuantities({});
    setSelectedProductId(null);
    setSessionId(createSessionId());
    deliveryEstimateRef.current = getDeliveryEstimate();
    clearBuilderStorage();
  };

  const handleReturnHome = () => {
    setIntroStage('cover');
    setCurrentStep('choose');
  };

  const handleNavigateStep = (stepKey) => {
    if (stepKey === 'cover') { setIntroStage('cover'); return; }
    if (stepKey === 'showcase') { setIntroStage('showcase'); return; }
    setIntroStage('done');
    if (stepKey === 'choose') setCurrentStep('choose');
    else if (stepKey === 'customize') setCurrentStep('customize');
    else if (stepKey === 'upload') setCurrentStep('upload');
    else if (stepKey === 'preview') setCurrentStep('preview');
    else if (stepKey === 'finalize') setCurrentStep('checkout');
  };

  const uploadedCount = uploadedImages.filter(Boolean).length;
  const isPreviewReady =
    previewGenerationState === 'ready' &&
    samplePreviewIndex >= 0 &&
    Boolean(generatedImages[samplePreviewIndex]);
  const checkoutBackLabel = isPreviewReady ? 'Back to Preview' : 'Back to Uploads';

  const handleReviewPreview = () => {
    if (!isPreviewReady) {
      return;
    }

    setCurrentStep('preview');
  };

  const handleCheckoutBack = () => {
    if (isPreviewReady) {
      setCurrentStep('preview');
      return;
    }

    setCurrentStep('upload');
  };

  const handlePaymentBack = () => {
    setPaymentClientSecret('');
    setCurrentStep('checkout');
  };

  const trackerStep =
    introStage === 'showcase'
      ? 'showcase'
      : introStage === 'cover' || introStage === 'opening'
      ? 'cover'
      : ['checkout', 'payment', 'success'].includes(currentStep)
        ? 'finalize'
        : currentStep;

  let content;

  if (introStage === 'cover' || introStage === 'opening') {
    content = (
      <BookCover
        isOpening={introStage === 'opening'}
        onStart={() => setIntroStage('opening')}
      />
    );
  } else if (introStage === 'showcase') {
    content = (
      <ProductShowcase onContinue={() => setIntroStage('done')} />
    );
  } else if (currentStep === 'choose') {
    content = (
      <ChooseBook
        products={products}
        selectedProductId={selectedProductId || selectedProduct?.id || ''}
        selectedPageCount={selectedPageCount}
        selectedAddOnIds={selectedAddOnIds}
        addOnQuantities={addOnQuantities}
        cartSummary={cartSummary}
        dedicationPageText={dedicationPageText}
        onSelectProduct={handleSelectProduct}
        onSelectPageCount={updatePageCount}
        onContinueToUploads={() => goToNextStep('customize')}
        onToggleAddOn={handleToggleAddOn}
        onAddOnQuantityChange={handleAddOnQuantityChange}
        onDedicationPageTextChange={setDedicationPageText}
      />
    );
  } else if (currentStep === 'customize') {
    content = (
      <CustomizeBack
        backCoverId={backCoverId}
        dedication={backCoverDedication}
        coverNotes={coverNotes}
        onBackCoverChange={setBackCoverId}
        onDedicationChange={setBackCoverDedication}
        onCoverNotesChange={setCoverNotes}
        onBack={() => setCurrentStep('choose')}
        onContinue={() => goToNextStep('upload')}
      />
    );
  } else if (currentStep === 'upload' && selectedPageCount) {
    content = (
      <UploadPhotos
        pageCount={selectedPageCount}
        uploads={uploadedImages}
        selectedProduct={selectedProduct}
        cartSummary={cartSummary}
        onUpload={handleUpload}
        onBack={goToPreviousStep}
        onCreateBook={handleCreateBook}
        generationError={generationError || storageNotice}
      />
    );
  } else if (currentStep === 'preview') {
    content = (
      <PreviewBook
        pageCount={selectedPageCount}
        uploads={uploadedImages}
        onBackToUploads={() => setCurrentStep('upload')}
        onFinishOrder={() => goToNextStep('checkout')}
      />
    );
  } else if (currentStep === 'checkout' || currentStep === 'payment') {
    content = (
      <CheckoutPage
        pageCount={selectedPageCount}
        uploadedCount={uploadedCount}
        deliveryEstimate={deliveryEstimateRef.current}
        shippingData={shippingData}
        selectedProduct={selectedProduct}
        cartSummary={cartSummary}
        additionalCopyAddon={selectedProduct?.addOns?.find(a => a.id === 'additional-copy') || null}
        additionalCopyQuantity={selectedAddOnIds.includes('additional-copy') ? (addOnQuantities['additional-copy'] || 1) : 0}
        onAdditionalCopyQuantityChange={(qty) => {
          if (qty === 0) {
            setSelectedAddOnIds(prev => prev.filter(id => id !== 'additional-copy'));
          } else {
            if (!selectedAddOnIds.includes('additional-copy')) {
              setSelectedAddOnIds(prev => [...prev, 'additional-copy']);
            }
            setAddOnQuantities(prev => ({ ...prev, 'additional-copy': qty }));
          }
        }}
        onFieldChange={handleShippingFieldChange}
        onBack={currentStep === 'payment' ? handlePaymentBack : handleCheckoutBack}
        onContinueToPayment={handleContinueToPayment}
        onCompletePaidOrder={handleCompletePaidOrder}
        isPaymentStep={currentStep === 'payment'}
        isProcessingPayment={isProcessingPayment}
        paymentError={paymentError}
        paymentClientSecret={paymentClientSecret}
        isPreparingPayment={isPreparingPayment}
        paymentSetupError={paymentSetupError}
        stripePromise={stripePromise}
        backLabel={currentStep === 'payment' ? 'Back to Checkout' : checkoutBackLabel}
        promoCode={promoCode}
        promoResult={promoResult}
        promoError={promoError}
        promoLoading={promoLoading}
        onPromoCodeChange={(v) => { setPromoCode(v); setPromoResult(null); promoResultRef.current = null; setPromoError(''); }}
        onPromoApply={handleValidatePromo}
        onPromoRemove={() => { setPromoCode(''); setPromoResult(null); promoResultRef.current = null; setPromoError(''); }}
      />
    );
  } else {
    content = (
      <OrderSuccess
        orderNumber={orderInfo?.number ?? 'TUU-000000'}
        deliveryEstimate={orderInfo?.deliveryEstimate ?? deliveryEstimateRef.current}
        customerEmail={shippingData?.email || ''}
        supportEmail={SUPPORT_EMAIL}
        onStartOver={handleStartOver}
        onReturnHome={handleReturnHome}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="site-tagline-bar">Turn Your Memories Into a Legendary Story</div>
      <div className="configurator-shell">
        <aside className="configurator-sidebar">
          <div className="sidebar-auth">
            {authUser ? (
              <button
                type="button"
                className="sidebar-auth-btn sidebar-auth-btn--user"
                onClick={() => setShowAccountPage(true)}
              >
                <span className="sidebar-auth-avatar">{authUser.firstName?.charAt(0) || authUser.email?.charAt(0) || 'U'}</span>
                <span className="sidebar-auth-name">{authUser.firstName || 'Account'}</span>
              </button>
            ) : (
              <button
                type="button"
                className="sidebar-auth-btn"
                onClick={() => setShowAuthModal(true)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                Log In
              </button>
            )}
          </div>
          <StepTracker steps={TRACKER_STEPS} currentStep={trackerStep} onNavigate={handleNavigateStep} />
        </aside>

        <div className="configurator-main">
          <header className="configurator-topbar">
            <div className="configurator-topbar-brand" aria-label="Twice Upon Us">
              <BrandLogo className="builder-header-logo" />
            </div>
            <div className="configurator-topbar-nav">
              <TopProgressBar steps={TRACKER_STEPS} currentStep={trackerStep} onNavigate={handleNavigateStep} />
            </div>
            <div className="configurator-topbar-actions">
              {introStage !== 'cover' && introStage !== 'opening' ? (
                <button
                  type="button"
                  className="reset-book-button"
                  onClick={handleStartOver}
                  title="Start over"
                >
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true" className="reset-book-icon"><path d="M2 6.5a4.5 4.5 0 1 1 1.06 2.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M2 9.5V6.5h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span className="reset-book-label">Start over</span>
                </button>
              ) : null}
            </div>
          </header>
          <div className="configurator-main-content" ref={mainContentRef}>
            <div className="builder-flow">{content}</div>
            <div className="page-watermark-wrap">
              <img src="/images/logo-title.png" alt="Twice Upon Us" className="page-watermark" />
              <p className="page-watermark-desc">Personalized coloring books made from your photos</p>
            </div>
          </div>
        </div>

        <button type="button" className="support-widget" onClick={() => setShowContactModal(true)}>
          <span className="support-avatar" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </span>
          <span className="support-copy">
            <strong>Need Help?</strong>
            <span>Send us a message.</span>
          </span>
        </button>
      </div>

      {showOrderStatus && (
        <div className="auth-modal-backdrop" onClick={() => { setShowOrderStatus(false); window.history.replaceState({}, '', window.location.pathname); }}>
          <div style={{ width: '100%', maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
            <OrderStatusPage
              orderId={urlOrderId}
              apiBase={API_BASE_URL}
              onBack={() => { setShowOrderStatus(false); window.history.replaceState({}, '', window.location.pathname); }}
            />
          </div>
        </div>
      )}

      {showResetPassword && !resetDone && (
        <div className="auth-modal-backdrop">
          <div className="auth-modal">
            <div className="auth-modal-header">
              <h2 className="auth-modal-title">Set a new password</h2>
              <p className="auth-modal-sub">Choose a strong password for your account.</p>
            </div>
            <form className="auth-form" onSubmit={handleResetPasswordSubmit}>
              <div className="auth-field">
                <label className="auth-label">New password</label>
                <input className="auth-input" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="At least 6 characters" required />
              </div>
              <div className="auth-field">
                <label className="auth-label">Confirm password</label>
                <input className="auth-input" type="password" value={resetConfirm} onChange={(e) => setResetConfirm(e.target.value)} placeholder="Repeat your password" required />
              </div>
              {resetError && <p className="auth-error">{resetError}</p>}
              <button type="submit" className="auth-submit" disabled={resetLoading}>
                {resetLoading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showAuthModal && (
        <AuthModal
          apiBase={API_BASE_URL}
          onClose={() => setShowAuthModal(false)}
          onSuccess={handleAuthSuccess}
        />
      )}

      {showAccountPage && authUser && (
        <AccountPage
          user={authUser}
          token={authToken}
          apiBase={API_BASE_URL}
          onClose={() => setShowAccountPage(false)}
          onLogout={handleLogout}
          onShippingSaved={(savedShipping) => {
            setAuthUser((prev) => ({ ...prev, savedShipping }));
            if (savedShipping?.address || savedShipping?.email) {
              setShippingData((prev) => ({ ...prev, ...savedShipping }));
            }
          }}
        />
      )}

      {showContactModal && (
        <ContactModal onClose={() => setShowContactModal(false)} />
      )}

      {showCorporatePortal && (
        <CorporatePortal
          onClose={() => setShowCorporatePortal(false)}
          apiBase={API_BASE_URL}
        />
      )}

    </main>
  );
}

export default App;
