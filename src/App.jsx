import { useEffect, useRef, useState } from 'react';
import BookCover from './components/BookCover';
import ChooseBook from './components/ChooseBook';
import UploadPhotos from './components/UploadPhotos';
import ProcessingStep from './components/ProcessingStep';
import PreviewBook from './components/PreviewBook';
import StepTracker from './components/StepTracker';
import CheckoutPage from './components/CheckoutPage';
import OrderSuccess from './components/OrderSuccess';
import BrandLogo from './components/BrandLogo';
import './App.css';

const OPEN_DURATION_MS = 1450;
const PAYMENT_DURATION_MS = 1500;
const SUPPORT_EMAIL = 'support@onceuponyou.com';
const STORAGE_KEY = 'once_upon_you_builder_v2';
const SESSION_ID_STORAGE_KEY = 'once_upon_you_session_id';
const COLORING_API_URL = 'http://localhost:5001/api/coloring-page';
const COMPLETE_ORDER_API_URL = 'http://localhost:5001/api/orders/complete';
const MAX_PERSISTED_UPLOADED_IMAGE_CHARS = 1_200_000;
const MAX_PERSISTED_GENERATED_IMAGE_CHARS = 4_500_000;

const DEFAULT_SHIPPING_DATA = {
  firstName: '',
  lastName: '',
  email: '',
  address: '',
  city: '',
  postalCode: '',
  country: '',
};

const TRACKER_STEPS = [
  { key: 'cover', label: 'Cover' },
  { key: 'choose', label: 'Choose Book' },
  { key: 'upload', label: 'Upload Photos' },
  { key: 'preview', label: 'Preview Pages' },
  { key: 'finalize', label: 'Finalize Order' },
];

const VALID_STEPS = new Set([
  'choose',
  'upload',
  'processing',
  'preview',
  'checkout',
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
  window.localStorage.removeItem('once_upon_you_builder_v1');
  window.localStorage.removeItem(SESSION_ID_STORAGE_KEY);
}

function loadPersistedSessionId() {
  try {
    const direct = window.localStorage.getItem(SESSION_ID_STORAGE_KEY);
    if (typeof direct === 'string' && direct.trim()) {
      return direct.trim();
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);
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

function loadPersistedBuilderState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

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

    const requiresPages = ['upload', 'processing', 'preview', 'checkout', 'success'].includes(
      currentStep,
    );
    const hasValidPageState =
      selectedPageCount &&
      (normalizedUploadedImages.length === selectedPageCount ||
        normalizedGeneratedImages.length === selectedPageCount);
    const hasUploadsForLaterSteps =
      !['preview', 'checkout', 'success'].includes(currentStep) ||
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
      parsed.introStage === 'done'
        ? parsed.introStage
        : 'cover';

    const normalizedIntroStage =
      currentStep !== 'choose' && introStage !== 'done' ? 'done' : introStage;

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
                  : 'OUY-000000',
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
    };
  } catch {
    return null;
  }
}

async function requestColoringPage(image, { sessionId, pageIndex }) {
  if (!image?.url || typeof image.url !== 'string') {
    throw new Error('Invalid uploaded image data.');
  }

  const file = image.isDataUrl
    ? dataUrlToFile(image.url, image.name || 'photo.png')
    : dataUrlToFile(image.url, 'photo.png');

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
    normalized.includes('unsupported')
  ) {
    return 'Please upload a JPG, PNG, or WebP image.';
  }

  return safeMessage || 'Unable to generate coloring pages right now.';
}

function App() {
  const persistedSessionIdRef = useRef(loadPersistedSessionId());
  const persistedStateRef = useRef(loadPersistedBuilderState());
  const persistedState = persistedStateRef.current;

  const [introStage, setIntroStage] = useState(persistedState?.introStage ?? 'cover');
  const [currentStep, setCurrentStep] = useState(persistedState?.currentStep ?? 'choose');
  const [selectedPageCount, setSelectedPageCount] = useState(
    persistedState?.selectedPageCount ?? null,
  );
  const [uploadedImages, setUploadedImages] = useState(
    persistedState?.uploadedImages ?? [],
  );
  const [generatedImages, setGeneratedImages] = useState(
    persistedState?.generatedImages ?? [],
  );
  const [isGeneratingPages, setIsGeneratingPages] = useState(false);
  const [generationProgress, setGenerationProgress] = useState('');
  const [generationError, setGenerationError] = useState('');
  const [storageNotice, setStorageNotice] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [orderInfo, setOrderInfo] = useState(persistedState?.orderInfo ?? null);
  const [shippingData, setShippingData] = useState(
    persistedState?.shippingData ?? DEFAULT_SHIPPING_DATA,
  );
  const [sessionId, setSessionId] = useState(
    persistedState?.sessionId || persistedSessionIdRef.current || createSessionId(),
  );

  const uploadedImagesRef = useRef(uploadedImages);
  const paymentTimerRef = useRef(null);
  const deliveryEstimateRef = useRef(
    persistedState?.deliveryEstimate ?? getDeliveryEstimate(),
  );

  useEffect(() => {
    console.debug('Restored generated images', {
      count: generatedImages.filter(Boolean).length,
      totalSlots: generatedImages.length,
    });
  }, []);

  useEffect(() => {
    if (currentStep !== 'preview') {
      return;
    }

    console.debug('Preview image source summary', {
      generatedCount: generatedImages.filter(Boolean).length,
      uploadedCount: uploadedImages.filter(Boolean).length,
    });
  }, [currentStep, generatedImages, uploadedImages]);

  useEffect(() => {
    uploadedImagesRef.current = uploadedImages;
  }, [uploadedImages]);

  useEffect(() => {
    if (!selectedPageCount) {
      if (['upload', 'processing', 'preview', 'checkout'].includes(currentStep)) {
        setCurrentStep('choose');
      }
      return;
    }

    setUploadedImages((previousImages) => {
      if (previousImages.length === selectedPageCount) {
        return previousImages;
      }

      if (previousImages.length > selectedPageCount) {
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
    if (introStage !== 'opening') {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setIntroStage('done');
    }, OPEN_DURATION_MS);

    return () => window.clearTimeout(timer);
  }, [introStage]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    window.localStorage.setItem(SESSION_ID_STORAGE_KEY, sessionId);
  }, [sessionId]);

  useEffect(() => {
    const basePayload = {
      introStage,
      currentStep,
      selectedPageCount,
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
    storageNotice,
  ]);

  useEffect(() => {
    return () => {
      uploadedImagesRef.current.forEach((image) => {
        revokeImageUrl(image);
      });

      if (paymentTimerRef.current) {
        window.clearTimeout(paymentTimerRef.current);
      }
    };
  }, []);

  const goToNextStep = (step) => {
    setCurrentStep(step);
  };

  const goToPreviousStep = () => {
    if (currentStep === 'upload') {
      setCurrentStep('choose');
      return;
    }

    if (currentStep === 'preview') {
      setCurrentStep('upload');
      return;
    }

    if (currentStep === 'checkout') {
      setCurrentStep('preview');
    }
  };

  const updatePageCount = (pageCount) => {
    setSelectedPageCount(pageCount);
    setUploadedImages((previousImages) => {
      if (previousImages.length === pageCount) {
        return previousImages;
      }

      if (previousImages.length > pageCount) {
        previousImages.slice(pageCount).forEach((image) => {
          revokeImageUrl(image);
        });

        return previousImages.slice(0, pageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: pageCount - previousImages.length }, () => null),
      ];
    });

    setGeneratedImages((previousImages) => {
      if (previousImages.length === pageCount) {
        return previousImages;
      }

      if (previousImages.length > pageCount) {
        return previousImages.slice(0, pageCount);
      }

      return [
        ...previousImages,
        ...Array.from({ length: pageCount - previousImages.length }, () => null),
      ];
    });
  };

  const handleSelectPageCount = (pageCount) => {
    updatePageCount(pageCount);
    goToNextStep('upload');
  };

  const handleUpload = (index, file) => {
    if (typeof index !== 'number' || index < 0 || index >= uploadedImagesRef.current.length) {
      setGenerationError('That upload slot is no longer valid. Please try again.');
      return;
    }

    if (!(file instanceof File)) {
      setGenerationError('Invalid file. Please choose a photo and try again.');
      return;
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
    };

    reader.readAsDataURL(file);
  };

  const handleCreateBook = async () => {
    if (isGeneratingPages) {
      return;
    }

    const sourceImages = uploadedImages.map((image) =>
      image && typeof image.url === 'string' && image.url.length > 0 ? image : null,
    );

    if (!sourceImages.some(Boolean)) {
      return;
    }

    setGenerationError('');
    setIsGeneratingPages(true);
    setCurrentStep('processing');

    try {
      const generated = Array.from({ length: sourceImages.length }, () => null);
      const failedPages = [];

      for (let index = 0; index < sourceImages.length; index += 1) {
        const sourceImage = sourceImages[index];
        if (!sourceImage) {
          continue;
        }

        setGenerationProgress(`Creating page ${index + 1} of ${sourceImages.length}...`);

        try {
          const generatedImage = await requestColoringPage(sourceImage, {
            sessionId,
            pageIndex: index,
          });
          generated[index] = generatedImage;
          console.debug('Generated coloring page', { page: index + 1, ok: true });
        } catch (error) {
          failedPages.push(index + 1);
          generated[index] = null;
          console.warn('Coloring page generation failed', { page: index + 1, error });
        }
      }

      const successfulPages = generated.filter(Boolean).length;
      console.debug('Generated images before preview', {
        requested: sourceImages.filter(Boolean).length,
        successfulPages,
        failedPages,
      });

      if (!successfulPages) {
        throw new Error(
          'We could not generate coloring pages right now. Please try again in a moment.',
        );
      }

      setGeneratedImages(generated);
      console.debug('Generated images set in state', {
        successful: generated.filter(Boolean).length,
        total: generated.length,
      });
      setGenerationProgress('Finishing your preview...');
      if (failedPages.length) {
        setGenerationError(
          `Some pages could not be generated (${failedPages.join(', ')}). Showing uploaded photos for those pages.`,
        );
      }
      setCurrentStep('preview');
    } catch (error) {
      setGenerationError(
        getFriendlyGenerationError(error?.message),
      );
      setCurrentStep('upload');
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

  const finalizeOrderForFulfillment = async () => {
    const response = await fetch(COMPLETE_ORDER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        pageCount: selectedPageCount,
        shipping: shippingData,
        deliveryEstimate: deliveryEstimateRef.current,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || 'Unable to save order files.');
    }

    return response.json();
  };

  const handleProceedToPayment = (event) => {
    event.preventDefault();

    if (isProcessingPayment) {
      return;
    }

    setPaymentError('');
    setIsProcessingPayment(true);

    paymentTimerRef.current = window.setTimeout(async () => {
      try {
        const orderResult = await finalizeOrderForFulfillment();
        setOrderInfo({
          number: orderResult?.orderId || `OUY-${Math.floor(100000 + Math.random() * 900000)}`,
          deliveryEstimate:
            orderResult?.deliveryEstimate || deliveryEstimateRef.current,
          createdAt: orderResult?.createdAt || new Date().toISOString(),
          status: orderResult?.status || 'new',
        });
        setCurrentStep('success');
      } catch (error) {
        setPaymentError(error?.message || 'Unable to save this order right now.');
      } finally {
        setIsProcessingPayment(false);
        paymentTimerRef.current = null;
      }
    }, PAYMENT_DURATION_MS);
  };

  const handleStartOver = () => {
    uploadedImagesRef.current.forEach((image) => {
      revokeImageUrl(image);
    });

    if (paymentTimerRef.current) {
      window.clearTimeout(paymentTimerRef.current);
      paymentTimerRef.current = null;
    }

    setIntroStage('cover');
    setCurrentStep('choose');
    setSelectedPageCount(null);
    setUploadedImages([]);
    setGeneratedImages([]);
    setIsGeneratingPages(false);
    setGenerationProgress('');
    setGenerationError('');
    setPaymentError('');
    setIsProcessingPayment(false);
    setOrderInfo(null);
    setShippingData(DEFAULT_SHIPPING_DATA);
    setSessionId(createSessionId());
    deliveryEstimateRef.current = getDeliveryEstimate();
    clearBuilderStorage();
  };

  const handleReturnHome = () => {
    setIntroStage('cover');
    setCurrentStep('choose');
  };

  const uploadedCount = uploadedImages.filter(Boolean).length;

  const trackerStep =
    introStage === 'cover' || introStage === 'opening'
      ? 'cover'
      : ['checkout', 'success'].includes(currentStep)
        ? 'finalize'
        : currentStep === 'processing'
          ? 'preview'
          : currentStep;

  let content;

  if (introStage === 'cover' || introStage === 'opening') {
    content = (
      <BookCover
        isOpening={introStage === 'opening'}
        onStart={() => setIntroStage('opening')}
      />
    );
  } else if (currentStep === 'choose') {
    content = (
      <ChooseBook
        selectedPageCount={selectedPageCount}
        onSelect={handleSelectPageCount}
      />
    );
  } else if (currentStep === 'upload' && selectedPageCount) {
    content = (
      <UploadPhotos
        pageCount={selectedPageCount}
        uploads={uploadedImages}
        onUpload={handleUpload}
        onBack={goToPreviousStep}
        onCreateBook={handleCreateBook}
        generationError={generationError || storageNotice}
      />
    );
  } else if (currentStep === 'processing') {
    content = <ProcessingStep progressText={generationProgress} />;
  } else if (currentStep === 'preview') {
    content = (
      <PreviewBook
        pageCount={selectedPageCount}
        uploads={uploadedImages}
        generatedImages={generatedImages}
        onBackToUploads={() => setCurrentStep('upload')}
        onFinishOrder={() => goToNextStep('checkout')}
      />
    );
  } else if (currentStep === 'checkout') {
    content = (
      <CheckoutPage
        pageCount={selectedPageCount}
        uploadedCount={uploadedCount}
        deliveryEstimate={deliveryEstimateRef.current}
        shippingData={shippingData}
        onFieldChange={handleShippingFieldChange}
        onBack={goToPreviousStep}
        onProceed={handleProceedToPayment}
        isProcessingPayment={isProcessingPayment}
        paymentError={paymentError}
      />
    );
  } else {
    content = (
      <OrderSuccess
        orderNumber={orderInfo?.number ?? 'OUY-000000'}
        deliveryEstimate={orderInfo?.deliveryEstimate ?? deliveryEstimateRef.current}
        supportEmail={SUPPORT_EMAIL}
        onStartOver={handleStartOver}
        onReturnHome={handleReturnHome}
      />
    );
  }

  return (
    <main className="app-shell">
      <div className="builder-flow">
        <header className="app-brand-header" aria-label="Once Upon You">
          <BrandLogo className="app-brand-logo" />
          <button
            type="button"
            className="reset-book-button"
            onClick={handleStartOver}
          >
            Reset Book
          </button>
        </header>
        <StepTracker steps={TRACKER_STEPS} currentStep={trackerStep} />
        {content}
        {introStage === 'done' ? (
          <section className="about-once-upon-you" aria-labelledby="about-once-upon-you-title">
            <h3 id="about-once-upon-you-title">About Once Upon You</h3>
            <p>
              Once Upon You transforms your favorite photos into personalized coloring books. Each
              book turns your memories into clean, hand-drawn style illustrations that feel like
              pages from your own story. From fashion moments to everyday memories, your photos
              become something you can color, share, and keep forever.
            </p>
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default App;
