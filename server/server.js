import path from 'path';
import crypto from 'crypto';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import multer from 'multer';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import OpenAI, { toFile } from 'openai';
import Stripe from 'stripe';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';

dotenv.config();

const SERVER_ROOT = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const port = Number(process.env.PORT || 5001);
const DATA_ROOT = path.resolve(SERVER_ROOT, 'data');
const ORDERS_ROOT = path.resolve(DATA_ROOT, 'orders');
const GENERATED_ORDERS_ROOT = path.resolve(DATA_ROOT, 'generated-orders');
const PERSISTENT_CACHE_ROOT = path.resolve(DATA_ROOT, 'persistent-cache', 'coloring-pages');
const PRODUCTS_CATALOG_PATH = path.resolve(DATA_ROOT, 'products.json');
const USERS_PATH = path.resolve(DATA_ROOT, 'users.json');
const PROMO_CODES_PATH = path.resolve(DATA_ROOT, 'promo-codes.json');
const ADMIN_EMAIL = normalizeEnvValue(process.env.ADMIN_EMAIL || '');

const COLORING_PROMPT_VERSION = 'v2';
const COLORING_MODEL = 'gpt-image-1';
const COLORING_SIZE = '1024x1024';
const COLORING_PROMPT =
  'Create a black and white coloring book page based on the uploaded image. ' +
  'The result must stay as close as possible to the original image in composition, subject, pose, objects, and layout. Do not reinterpret or redesign — translate it into clean line art. ' +
  'STYLE: modern luxury lifestyle illustration, clean, editorial, minimal but detailed. Quiet luxury, feminine, elevated aesthetic. Similar feel to a high-end lifestyle coloring book (travel, fashion, cafe, work, city moments). Slightly stylized but still realistic and recognizable. ' +
  'LINE STYLE: bold clean outer outlines, thinner interior detail lines, smooth confident linework with no sketchiness, large open white spaces for coloring, balanced detail that is not too busy and not too empty. ' +
  'SIMPLIFICATION: remove unnecessary clutter, keep only key elements that define the scene, backgrounds should be simplified but still aesthetic such as windows, palm trees, and interiors. ' +
  'TEXT RULES - VERY IMPORTANT: never include any words, letters, numbers, logos, or readable text. If the image contains text, logos, labels, or branding, replace with blank shapes or minimal line indications. Do not attempt to recreate or spell anything. No captions, no signage, no branding, no watermarks. ' +
  'ACCURACY: preserve the original subject and scene exactly. Do not change outfits, objects, or setting. Do not add new elements that were not in the image. ' +
  'OUTPUT: crisp black line art only, pure white background, printable coloring page, polished and cohesive with a luxury lifestyle coloring book.';
const CACHE_EVENT_LIMIT = 50;

const cacheStats = {
  requests: 0,
  sessionHits: 0,
  persistentHits: 0,
  misses: 0,
  generated: 0,
};
const cacheRecentEvents = [];

if (!process.env.OPENAI_API_KEY) {
  console.warn('Missing OPENAI_API_KEY in server/.env');
}

function normalizeEnvValue(rawValue) {
  const text = typeof rawValue === 'string' ? rawValue.trim() : '';
  const quoted = text.match(/^(['"])(.*)\1$/);
  if (quoted) {
    return quoted[2].trim();
  }
  return text;
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
console.log('[STRIPE DEBUG] process.env.STRIPE_SECRET_KEY =', process.env.STRIPE_SECRET_KEY);
const STRIPE_SECRET_KEY = normalizeEnvValue(process.env.STRIPE_SECRET_KEY);
const FRONTEND_STRIPE_PUBLISHABLE_KEY = normalizeEnvValue(process.env.FRONTEND_STRIPE_PUBLISHABLE_KEY);
const STRIPE_CURRENCY = normalizeEnvValue(process.env.STRIPE_CURRENCY || 'usd').toLowerCase();
const CLIENT_ORIGIN = normalizeEnvValue(process.env.CLIENT_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const stripeKeyIsTest = STRIPE_SECRET_KEY.startsWith('sk_test_');
const stripeKeyIsLive = STRIPE_SECRET_KEY.startsWith('sk_live_');
const stripeKeyIsValid = stripeKeyIsTest || stripeKeyIsLive;
if (!stripeKeyIsValid) {
  console.warn('Stripe key is missing or invalid. Payments will be disabled.');
}

const frontendKeyIsTest = FRONTEND_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_');
const frontendKeyIsLive = FRONTEND_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_');
if (FRONTEND_STRIPE_PUBLISHABLE_KEY && stripeKeyIsValid) {
  const mixedModes =
    (stripeKeyIsTest && frontendKeyIsLive) || (stripeKeyIsLive && frontendKeyIsTest);
  if (mixedModes) {
    console.warn('Stripe mode mismatch: backend STRIPE_SECRET_KEY and frontend publishable key are not both test or both live.');
  }
}

const stripe = stripeKeyIsValid
  ? new Stripe(STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    })
  : null;

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
    validSecret: normalized.startsWith('sk_'),
  };
}

function sanitizeStripeErrorMessage(error, fallbackMessage) {
  const message = error?.message || '';

  if (/invalid api key/i.test(message) || /secret key/i.test(message) || /publishable key/i.test(message)) {
    return 'Stripe credentials are invalid or misconfigured on the server.';
  }

  return fallbackMessage;
}

const maskedStripeKey = maskStripeKeyForLog(STRIPE_SECRET_KEY);
console.log(
  `[STRIPE BACKEND] key present=${maskedStripeKey.present} prefix=${maskedStripeKey.prefix} last4=${maskedStripeKey.last4} validSecret=${maskedStripeKey.validSecret}`,
);
console.log(
  `[STRIPE BACKEND] keyLength=${STRIPE_SECRET_KEY.length} startsWithSkTest=${stripeKeyIsTest} startsWithSkLive=${stripeKeyIsLive}`,
);
if (FRONTEND_STRIPE_PUBLISHABLE_KEY) {
  console.log(
    `[STRIPE MATCH] frontendPkTest=${frontendKeyIsTest} frontendPkLive=${frontendKeyIsLive} backendSkTest=${stripeKeyIsTest} backendSkLive=${stripeKeyIsLive}`,
  );
}

const STANDARD_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const STANDARD_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif'];
const HEIC_EXTENSIONS = ['.heic', '.heif'];
const ORDER_STATUSES = ['new', 'in-production', 'completed', 'shipped'];
const SHOULD_CLEANUP_SESSION_AFTER_ORDER =
  String(process.env.CLEANUP_SESSION_AFTER_ORDER || 'true').toLowerCase() !== 'false';
const COLORING_CACHE_ROUTE_VERSION = 'v3-persistent-first';
const PRODUCT_TYPES = new Set(['digital', 'physical', 'custom', 'bundle']);
const DEFAULT_PRICE_PER_PAGE_BY_TYPE = {
  digital: 100,
  physical: 150,
  custom: 200,
  bundle: 250,
};
const INCLUDED_PAGES_IN_BASE = 8;
const DEFAULT_FORMAT_OPTIONS = [
  {
    id: 'pocket',
    name: 'Pocket Format',
    description: 'Compact keepsake format.',
    priceAdjustmentCents: 0,
  },
  {
    id: 'large',
    name: 'Large Format',
    description: 'Larger premium format.',
    priceAdjustmentCents: 800,
  },
];

function getFileExtension(filename = '') {
  return path.extname(filename).toLowerCase();
}

function getExtensionForMimeType(mimeType) {
  if (mimeType === 'image/png') {
    return 'png';
  }

  if (mimeType === 'image/webp') {
    return 'webp';
  }

  return 'jpg';
}

function getContentTypeForExtension(extension) {
  if (extension === 'png') {
    return 'image/png';
  }

  if (extension === 'webp') {
    return 'image/webp';
  }

  return 'image/jpeg';
}

function sanitizeSessionId(value) {
  const input = String(value || '').trim();
  const safe = input.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64);
  return safe || 'default';
}

function normalizePageIndex(value) {
  const parsed = Number.parseInt(String(value || '0'), 10);
  if (Number.isNaN(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function getPageBaseName(pageIndex) {
  return `page-${String(pageIndex + 1).padStart(2, '0')}`;
}

function createOrderId() {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, '')
    .slice(0, 14);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `order-${stamp}-${rand}`;
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeProductId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function sanitizeOptionalText(value, maxLength = 240) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function normalizeMoneyCents(value, fieldName, { allowNull = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (allowNull) {
      return null;
    }

    throw new Error(`${fieldName} is required.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${fieldName} must be numeric.`);
  }

  const rounded = Math.round(parsed);
  if (rounded < 0) {
    throw new Error(`${fieldName} must be 0 or higher.`);
  }

  return rounded;
}

function normalizeInteger(value, fallback = 1) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return parsed;
}

function normalizeAvailablePageCounts(rawPageCounts) {
  if (!Array.isArray(rawPageCounts) || !rawPageCounts.length) {
    throw new Error('availablePageCounts must include at least one page option.');
  }

  const unique = Array.from(
    new Set(
      rawPageCounts
        .map((value) => normalizeInteger(value, 0))
        .filter((value) => value > 0 && value <= 500),
    ),
  ).sort((a, b) => a - b);

  if (!unique.length) {
    throw new Error('availablePageCounts must contain positive numeric values.');
  }

  return unique;
}

function normalizeFormats(rawFormats) {
  const source = Array.isArray(rawFormats) && rawFormats.length
    ? rawFormats
    : DEFAULT_FORMAT_OPTIONS;

  const seen = new Set();
  const formats = source
    .map((format, index) => {
      if (!format || typeof format !== 'object') {
        throw new Error(`Format #${index + 1} is invalid.`);
      }

      const id = sanitizeProductId(format.id || format.name || `format-${index + 1}`);
      const name = sanitizeOptionalText(format.name, 80);
      if (!id || !name) {
        throw new Error(`Format #${index + 1} must include id and name.`);
      }
      if (seen.has(id)) {
        throw new Error(`Format id "${id}" must be unique.`);
      }
      seen.add(id);

      return {
        id,
        name,
        description: sanitizeOptionalText(format.description, 160),
        priceAdjustmentCents: normalizeMoneyCents(
          format.priceAdjustmentCents,
          `Format "${name}" priceAdjustmentCents`,
        ),
      };
    });

  if (!formats.length) {
    throw new Error('At least one format option is required.');
  }

  return formats;
}

function getEffectivePricePerPageCents(rawValue, productType) {
  const normalized = normalizeMoneyCents(rawValue, 'pricePerPageCents');
  if (normalized > 0) {
    return normalized;
  }

  return DEFAULT_PRICE_PER_PAGE_BY_TYPE[productType] || 100;
}

function normalizeAddOn(addOn, index) {
  if (!addOn || typeof addOn !== 'object') {
    throw new Error(`Add-on #${index + 1} is invalid.`);
  }

  const id = sanitizeProductId(addOn.id || addOn.name || `addon-${index + 1}`);
  const name = sanitizeOptionalText(addOn.name, 80);

  if (!id) {
    throw new Error(`Add-on #${index + 1} needs an id.`);
  }

  if (!name) {
    throw new Error(`Add-on #${index + 1} needs a name.`);
  }

  const supportsQuantity = Boolean(addOn.supportsQuantity);
  const minQuantity = clampNumber(normalizeInteger(addOn.minQuantity, 1), 1, 999);
  const maxQuantity = clampNumber(normalizeInteger(addOn.maxQuantity, supportsQuantity ? 99 : 1), minQuantity, 999);
  const defaultQuantityRaw = normalizeInteger(addOn.defaultQuantity, 1);
  const defaultQuantity = supportsQuantity
    ? clampNumber(defaultQuantityRaw, minQuantity, maxQuantity)
    : 1;

  return {
    id,
    name,
    description: sanitizeOptionalText(addOn.description, 180),
    priceCents: normalizeMoneyCents(addOn.priceCents, `Add-on "${name}" price`),
    supportsQuantity,
    defaultQuantity,
    minQuantity,
    maxQuantity,
  };
}

function normalizeProductPayload(rawProduct, { requireId = false } = {}) {
  if (!rawProduct || typeof rawProduct !== 'object') {
    throw new Error('Product payload is invalid.');
  }

  const id = sanitizeProductId(rawProduct.id);
  const name = sanitizeOptionalText(rawProduct.name, 80);
  const description = sanitizeOptionalText(rawProduct.description, 280);
  const productType = sanitizeOptionalText(rawProduct.productType, 40).toLowerCase();
  const addOnsRaw = Array.isArray(rawProduct.addOns) ? rawProduct.addOns : [];

  if (requireId && !id) {
    throw new Error('Product id is required.');
  }

  if (!name) {
    throw new Error('Product name is required.');
  }

  if (!PRODUCT_TYPES.has(productType)) {
    throw new Error('productType must be digital, physical, custom, or bundle.');
  }

  const basePriceCents = normalizeMoneyCents(rawProduct.basePriceCents, 'basePriceCents');
  const pricePerPageCents = getEffectivePricePerPageCents(rawProduct.pricePerPageCents, productType);
  const availablePageCounts = normalizeAvailablePageCounts(rawProduct.availablePageCounts);
  const formats = normalizeFormats(rawProduct.formats);
  const compareAtPriceCents = normalizeMoneyCents(rawProduct.compareAtPriceCents, 'compareAtPriceCents', {
    allowNull: true,
  });

  if (compareAtPriceCents !== null && compareAtPriceCents < basePriceCents) {
    throw new Error('compareAtPriceCents must be greater than or equal to basePriceCents.');
  }

  const addOns = addOnsRaw.map((addOn, index) => normalizeAddOn(addOn, index));
  const isDigital = Boolean(rawProduct.isDigital);
  const isPhysical = Boolean(rawProduct.isPhysical);

  if (!isDigital && !isPhysical) {
    throw new Error('A product must be digital, physical, or both.');
  }

  return {
    id,
    name,
    description,
    productType,
    isDigital,
    isPhysical,
    externalLink: sanitizeOptionalText(rawProduct.externalLink, 500),
    basePriceCents,
    pricePerPageCents,
    availablePageCounts,
    formats,
    compareAtPriceCents,
    isFeatured: Boolean(rawProduct.isFeatured),
    isWeeklyFavorite: Boolean(rawProduct.isWeeklyFavorite),
    addOns,
  };
}

async function loadProductCatalog() {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  const raw = await fs.readFile(PRODUCTS_CATALOG_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const productsRaw = Array.isArray(parsed?.products) ? parsed.products : [];

  const products = productsRaw.map((rawProduct) =>
    normalizeProductPayload(rawProduct, { requireId: true }),
  );

  const weeklyFavoriteProductId = sanitizeProductId(parsed?.weeklyFavoriteProductId);

  return {
    schemaVersion: Number(parsed?.schemaVersion) || 1,
    currency: sanitizeOptionalText(parsed?.currency || 'USD', 8) || 'USD',
    weeklyFavoriteProductId,
    products,
  };
}

async function saveProductCatalog(catalog) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(PRODUCTS_CATALOG_PATH, JSON.stringify(catalog, null, 2), 'utf8');
}

function normalizePricingSummary(rawPricing) {
  if (!rawPricing || typeof rawPricing !== 'object') {
    throw new Error('Missing pricing snapshot.');
  }

  return {
    currency: sanitizeOptionalText(rawPricing.currency, 8) || 'USD',
    pageCount: clampNumber(normalizeInteger(rawPricing.pageCount, 0), 0, 500),
    includedPagesCount: clampNumber(
      normalizeInteger(rawPricing.includedPagesCount, INCLUDED_PAGES_IN_BASE),
      0,
      500,
    ),
    extraPagesCount: clampNumber(normalizeInteger(rawPricing.extraPagesCount, 0), 0, 500),
    basePriceCents: normalizeMoneyCents(rawPricing.basePriceCents, 'basePriceCents'),
    pricePerPageCents: normalizeMoneyCents(rawPricing.pricePerPageCents, 'pricePerPageCents'),
    pagePriceTotalCents: normalizeMoneyCents(rawPricing.pagePriceTotalCents, 'pagePriceTotalCents'),
    extraPagesPriceTotalCents: normalizeMoneyCents(
      rawPricing.extraPagesPriceTotalCents,
      'extraPagesPriceTotalCents',
    ),
    productSubtotalCents: normalizeMoneyCents(rawPricing.productSubtotalCents, 'productSubtotalCents'),
    addOnsTotalCents: normalizeMoneyCents(rawPricing.addOnsTotalCents, 'addOnsTotalCents'),
    totalCents: normalizeMoneyCents(rawPricing.totalCents, 'totalCents'),
    compareAtPriceCents: normalizeMoneyCents(rawPricing.compareAtPriceCents, 'compareAtPriceCents', {
      allowNull: true,
    }),
    savingsCents: normalizeMoneyCents(rawPricing.savingsCents, 'savingsCents', {
      allowNull: true,
    }),
  };
}

function normalizeSelectedAddOns(rawAddOns) {
  if (!Array.isArray(rawAddOns)) {
    return [];
  }

  return rawAddOns.map((addOn, index) => {
    if (!addOn || typeof addOn !== 'object') {
      throw new Error(`Selected add-on #${index + 1} is invalid.`);
    }

    const id = sanitizeProductId(addOn.id);
    const name = sanitizeOptionalText(addOn.name, 80);
    if (!id || !name) {
      throw new Error(`Selected add-on #${index + 1} must include id and name.`);
    }

    const unitPriceCents = normalizeMoneyCents(addOn.unitPriceCents, `Add-on "${name}" unit price`);
    const quantity = clampNumber(normalizeInteger(addOn.quantity, 1), 1, 999);
    const totalPriceCents = normalizeMoneyCents(addOn.totalPriceCents, `Add-on "${name}" total`);

    if (totalPriceCents !== unitPriceCents * quantity) {
      throw new Error(`Selected add-on "${name}" has invalid total.`);
    }

    return {
      id,
      name,
      quantity,
      unitPriceCents,
      totalPriceCents,
    };
  });
}

function normalizeOrderSubmission(rawBody) {
  const sessionId = sanitizeSessionId(rawBody?.sessionId);
  const shipping = rawBody?.shipping || {};
  const pageCount = Number.parseInt(String(rawBody?.pageCount || '0'), 10) || 0;
  const paymentIntentId = sanitizeOptionalText(rawBody?.paymentIntentId, 200);
  const checkoutSessionId = sanitizeOptionalText(rawBody?.checkoutSessionId, 200);
  const selectedProductRaw =
    rawBody?.selectedProduct && typeof rawBody.selectedProduct === 'object'
      ? rawBody.selectedProduct
      : null;
  const selectedProduct = selectedProductRaw
    ? {
        id: sanitizeProductId(selectedProductRaw.id),
        name: sanitizeOptionalText(selectedProductRaw.name, 80),
        productType: sanitizeOptionalText(selectedProductRaw.productType, 40).toLowerCase(),
        isDigital: Boolean(selectedProductRaw.isDigital),
        isPhysical: Boolean(selectedProductRaw.isPhysical),
        externalLink: sanitizeOptionalText(selectedProductRaw.externalLink, 500),
        basePriceCents: normalizeMoneyCents(
          selectedProductRaw.basePriceCents,
          'selectedProduct.basePriceCents',
        ),
        pricePerPageCents: normalizeMoneyCents(
          selectedProductRaw.pricePerPageCents,
          'selectedProduct.pricePerPageCents',
        ),
        availablePageCounts: Array.isArray(selectedProductRaw.availablePageCounts)
          ? selectedProductRaw.availablePageCounts
              .map((value) => normalizeInteger(value, 0))
              .filter((value) => value > 0)
          : [],
      }
    : null;
  const selectedAddOns = normalizeSelectedAddOns(rawBody?.selectedAddOns);
  const rawPricingSummary =
    rawBody?.pricingSummary && typeof rawBody.pricingSummary === 'object'
      ? {
          ...rawBody.pricingSummary,
          includedPagesCount:
            rawBody.pricingSummary.includedPagesCount ?? rawBody?.includedPagesCount,
        }
      : {
          includedPagesCount: rawBody?.includedPagesCount,
        };
  const pricingSummary = normalizePricingSummary(rawPricingSummary);

  const backCoverTagline = sanitizeOptionalText(rawBody?.backCoverTagline, 120);
  const backCoverDedication = sanitizeOptionalText(rawBody?.backCoverDedication, 300);
  const backCoverId = sanitizeOptionalText(rawBody?.backCoverId, 40);

  return {
    sessionId,
    shipping,
    pageCount,
    paymentIntentId,
    checkoutSessionId,
    selectedProduct,
    selectedAddOns,
    pricingSummary,
    backCoverTagline,
    backCoverDedication,
    backCoverId,
  };
}

async function validateOrderSubmission({ pageCount, selectedProduct, selectedAddOns, pricingSummary }) {
  if (!selectedProduct || !selectedProduct.id || !selectedProduct.name) {
    throw new Error('selectedProduct is required.');
  }

  if (!PRODUCT_TYPES.has(selectedProduct.productType)) {
    throw new Error('selectedProduct.productType is invalid.');
  }

  if (!pricingSummary.pageCount || pricingSummary.pageCount !== pageCount) {
    throw new Error('Selected page count is invalid.');
  }

  const expectedIncludedPagesCount = Math.min(INCLUDED_PAGES_IN_BASE, pageCount);
  console.log('[ORDER COMPLETE] includedPagesCount normalized =', pricingSummary.includedPagesCount);
  console.log('[ORDER COMPLETE] includedPagesCount expected =', expectedIncludedPagesCount);
  if (pricingSummary.includedPagesCount !== expectedIncludedPagesCount) {
    throw new Error('includedPagesCount is invalid.');
  }

  const catalog = await loadProductCatalog();
  const catalogProduct = catalog.products.find((product) => product.id === selectedProduct.id);
  if (!catalogProduct) {
    throw new Error('Selected product no longer exists.');
  }

  if (!catalogProduct.availablePageCounts.includes(pageCount)) {
    throw new Error('Selected page count is not available for this product.');
  }

  const expectedExtraPagesCount = Math.max(pageCount - INCLUDED_PAGES_IN_BASE, 0);
  // Tiered pricing: pages 9-15 at full rate, pages 16+ at $2/page
  const REDUCED_PRICE_PER_PAGE_CENTS = 200;
  const tierOneCount = Math.min(expectedExtraPagesCount, 7);
  const tierTwoCount = Math.max(expectedExtraPagesCount - 7, 0);
  const expectedPagePriceTotal = tierOneCount * catalogProduct.pricePerPageCents + tierTwoCount * REDUCED_PRICE_PER_PAGE_CENTS;
  const expectedProductSubtotal = catalogProduct.basePriceCents + expectedPagePriceTotal;
  if (selectedProduct.basePriceCents !== catalogProduct.basePriceCents) {
    throw new Error('selectedProduct.basePriceCents is invalid.');
  }
  if (selectedProduct.pricePerPageCents !== catalogProduct.pricePerPageCents) {
    throw new Error('selectedProduct.pricePerPageCents is invalid.');
  }
  if (pricingSummary.pricePerPageCents !== catalogProduct.pricePerPageCents) {
    throw new Error('pricePerPageCents does not match product configuration.');
  }
  if (pricingSummary.pagePriceTotalCents !== expectedPagePriceTotal) {
    throw new Error('pagePriceTotalCents is invalid.');
  }
  if (pricingSummary.extraPagesPriceTotalCents !== expectedPagePriceTotal) {
    throw new Error('extraPagesPriceTotalCents is invalid.');
  }
  if (pricingSummary.extraPagesCount !== expectedExtraPagesCount) {
    throw new Error('extraPagesCount is invalid.');
  }
  if (pricingSummary.productSubtotalCents !== expectedProductSubtotal) {
    throw new Error('productSubtotalCents is invalid.');
  }
  if (pricingSummary.basePriceCents !== catalogProduct.basePriceCents) {
    throw new Error('basePriceCents does not match product configuration.');
  }

  const addOnTotal = selectedAddOns.reduce((sum, addOn) => sum + addOn.totalPriceCents, 0);
  if (addOnTotal !== pricingSummary.addOnsTotalCents) {
    throw new Error('Add-on totals do not match pricing summary.');
  }

  if (pricingSummary.totalCents !== pricingSummary.productSubtotalCents + pricingSummary.addOnsTotalCents) {
    throw new Error('pricingSummary.totalCents is invalid.');
  }

  return { catalogProduct };
}

function buildCustomerName(shipping = {}) {
  return [shipping.firstName, shipping.lastName].filter(Boolean).join(' ').trim();
}

async function readSortedFiles(dirPath, suffix = '') {
  const entries = await fs.readdir(dirPath, { withFileTypes: true }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => !suffix || name.endsWith(suffix))
    .sort((a, b) => a.localeCompare(b));
}

function isOriginalImageFile(filename) {
  return /^page-\d{2}-original\.(jpg|jpeg|png|webp)$/i.test(filename);
}

function hashSha256(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function buildColoringCacheKey({ sourceHash, generationOptions }) {
  const payload = JSON.stringify({
    sourceHash,
    generationOptions,
  });

  return hashSha256(payload);
}

function buildLegacyColoringCacheKey({ sourceHash, pageIndex, generationOptions }) {
  const payload = JSON.stringify({
    sourceHash,
    pageIndex,
    generationOptions,
  });

  return hashSha256(payload);
}

function areGenerationOptionsEqual(left = {}, right = {}) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

async function findPersistentCacheEntryBySourceHash({ sourceHash, generationOptions }) {
  const entries = await fs.readdir(PERSISTENT_CACHE_ROOT, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const metaPath = path.join(PERSISTENT_CACHE_ROOT, entry.name);
    const metaRaw = await fs.readFile(metaPath, 'utf8').catch(() => null);
    if (!metaRaw) {
      continue;
    }

    let meta;
    try {
      meta = JSON.parse(metaRaw);
    } catch {
      continue;
    }

    if (meta?.sourceHash !== sourceHash) {
      continue;
    }

    if (!areGenerationOptionsEqual(meta?.generationOptions, generationOptions)) {
      continue;
    }

    const cacheKey = typeof meta?.cacheKey === 'string'
      ? meta.cacheKey.trim()
      : entry.name.replace(/\.json$/i, '');
    if (!/^[a-f0-9]{64}$/i.test(cacheKey)) {
      continue;
    }

    const imagePath = path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.png`);
    const imageBuffer = await fs.readFile(imagePath).catch(() => null);
    if (!imageBuffer?.length) {
      continue;
    }

    return {
      cacheKey,
      imagePath,
      metaPath,
      imageBuffer,
      meta,
    };
  }

  return null;
}

function pushCacheEvent(event) {
  cacheRecentEvents.unshift({
    ...event,
    at: new Date().toISOString(),
  });

  if (cacheRecentEvents.length > CACHE_EVENT_LIMIT) {
    cacheRecentEvents.length = CACHE_EVENT_LIMIT;
  }
}

function logColoringCache({
  sourceHash,
  cacheKey,
  cachePath,
  exists,
  result,
}) {
  console.log(`[COLORING CACHE] sourceHash=${sourceHash}`);
  console.log(`[COLORING CACHE] cacheKey=${cacheKey}`);
  console.log(`[COLORING CACHE] cachePath=${cachePath}`);
  console.log(`[COLORING CACHE] exists=${exists}`);
  console.log(`[COLORING CACHE] result=${result}`);
}

function logColoringCacheRequest(details) {
  console.log('[COLORING CACHE REQUEST]', details);
}

async function removeStaleOriginalsForPage(originalsDirectory, pageBaseName, keepExtension) {
  const entries = await fs.readdir(originalsDirectory, { withFileTypes: true }).catch(() => []);
  const keepName = `${pageBaseName}-original.${keepExtension}`;

  const staleFiles = entries
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter(
      (filename) =>
        isOriginalImageFile(filename) &&
        filename.startsWith(`${pageBaseName}-original.`) &&
        filename !== keepName,
    );

  await Promise.all(
    staleFiles.map((filename) =>
      fs.unlink(path.join(originalsDirectory, filename)).catch(() => {}),
    ),
  );
}

function isHeicFile(file) {
  const extension = getFileExtension(file.originalname);
  return HEIC_MIME_TYPES.includes(file.mimetype) || HEIC_EXTENSIONS.includes(extension);
}

function isSupportedUpload(file) {
  const extension = getFileExtension(file.originalname);

  if (STANDARD_IMAGE_MIME_TYPES.includes(file.mimetype)) {
    return true;
  }

  if (STANDARD_IMAGE_EXTENSIONS.includes(extension)) {
    return true;
  }

  if (isHeicFile(file)) {
    return true;
  }

  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (isSupportedUpload(file)) {
      callback(null, true);
      return;
    }

    callback(
      new Error('Please upload a JPG, JPEG, PNG, WebP, HEIC, or HEIF image.'),
    );
  },
});

app.use(
  cors({
    origin: CLIENT_ORIGIN,
  }),
);
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    cacheRouteVersion: COLORING_CACHE_ROUTE_VERSION,
    serverFile: fileURLToPath(import.meta.url),
    persistentCacheRoot: PERSISTENT_CACHE_ROOT,
    productsCatalogPath: PRODUCTS_CATALOG_PATH,
  });
});

app.get('/api/products', async (_req, res) => {
  try {
    const catalog = await loadProductCatalog();
    res.json(catalog);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load product catalog.',
      details: error?.message || 'Unknown error',
    });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const catalog = await loadProductCatalog();
    const normalized = normalizeProductPayload(req.body, { requireId: false });
    const baseId = sanitizeProductId(normalized.id || normalized.name);
    const productId = baseId || `product-${Date.now()}`;

    if (catalog.products.some((product) => product.id === productId)) {
      res.status(409).json({ error: 'A product with this id already exists.' });
      return;
    }

    const product = {
      ...normalized,
      id: productId,
    };

    const nextCatalog = {
      ...catalog,
      products: [...catalog.products, product],
      weeklyFavoriteProductId: product.isWeeklyFavorite
        ? product.id
        : catalog.weeklyFavoriteProductId,
    };

    await saveProductCatalog(nextCatalog);
    res.status(201).json({ product });
  } catch (error) {
    res.status(400).json({
      error: error?.message || 'Invalid product payload.',
    });
  }
});

app.put('/api/products/:productId', async (req, res) => {
  try {
    const productId = sanitizeProductId(req.params.productId);
    if (!productId) {
      res.status(400).json({ error: 'Invalid product id.' });
      return;
    }

    const catalog = await loadProductCatalog();
    const existingIndex = catalog.products.findIndex((product) => product.id === productId);

    if (existingIndex < 0) {
      res.status(404).json({ error: 'Product not found.' });
      return;
    }

    const normalized = normalizeProductPayload(
      {
        ...req.body,
        id: productId,
      },
      { requireId: true },
    );

    const nextProducts = [...catalog.products];
    nextProducts[existingIndex] = normalized;

    const weeklyFavoriteFromProducts = nextProducts.find((product) => product.isWeeklyFavorite)?.id || '';
    const nextCatalog = {
      ...catalog,
      products: nextProducts,
      weeklyFavoriteProductId: weeklyFavoriteFromProducts || catalog.weeklyFavoriteProductId,
    };

    await saveProductCatalog(nextCatalog);
    res.json({ product: normalized });
  } catch (error) {
    res.status(400).json({
      error: error?.message || 'Invalid product payload.',
    });
  }
});

app.get('/api/cache/stats', (_req, res) => {
  res.json({
    cacheRoot: PERSISTENT_CACHE_ROOT,
    stats: cacheStats,
    recent: cacheRecentEvents,
  });
});

app.get('/api/cache/:cacheKey', async (req, res) => {
  try {
    const cacheKey = String(req.params.cacheKey || '').trim();
    if (!/^[a-f0-9]{64}$/i.test(cacheKey)) {
      res.status(400).json({ error: 'Invalid cache key format.' });
      return;
    }

    const imagePath = path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.png`);
    const metaPath = path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.json`);

    const [imageStat, metaRaw] = await Promise.all([
      fs.stat(imagePath).catch(() => null),
      fs.readFile(metaPath, 'utf8').catch(() => null),
    ]);

    if (!imageStat && !metaRaw) {
      res.status(404).json({
        cacheKey,
        found: false,
      });
      return;
    }

    res.json({
      cacheKey,
      found: true,
      image: imageStat
        ? {
            path: imagePath,
            size: imageStat.size,
            modifiedAt: imageStat.mtime.toISOString(),
          }
        : null,
      meta: metaRaw ? JSON.parse(metaRaw) : null,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to read cache entry.',
      details: error?.message || 'Unknown error',
    });
  }
});

const handleCreatePaymentIntent = async (req, res) => {
  if (!stripe) {
    res.status(503).json({
      error: 'Stripe key is missing or invalid. Payments are currently disabled.',
    });
    return;
  }

  try {
    const orderSubmission = normalizeOrderSubmission(req.body);
    await validateOrderSubmission(orderSubmission);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: orderSubmission.pricingSummary.totalCents,
      currency: STRIPE_CURRENCY,
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: orderSubmission.shipping.email || undefined,
      description: `${orderSubmission.selectedProduct?.name || 'Twice Upon Us Book'} • ${orderSubmission.pageCount} pages`,
      metadata: {
        sessionId: orderSubmission.sessionId,
        productId: orderSubmission.selectedProduct?.id || '',
        pageCount: String(orderSubmission.pageCount),
      },
    });

    if (!paymentIntent.client_secret) {
      throw new Error('Stripe did not return a client secret.');
    }

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
    });
  } catch (error) {
    console.error('[STRIPE create-payment-intent] raw error:', error);
    console.error('[STRIPE create-payment-intent] details:', {
      type: error?.type || '',
      code: error?.code || '',
      message: error?.message || '',
      requestId: error?.requestId || '',
      statusCode: error?.statusCode || 0,
    });

    const stripeType = error?.type || '';
    const safeError = sanitizeStripeErrorMessage(error, 'Unable to create payment intent.');

    if (stripeType === 'StripeAuthenticationError') {
      res.status(401).json({ error: 'Stripe API key is invalid or unauthorized.' });
      return;
    }

    if (stripeType === 'StripeInvalidRequestError') {
      res.status(400).json({ error: safeError });
      return;
    }

    if (stripeType === 'StripeConnectionError' || stripeType === 'StripeAPIError') {
      res.status(502).json({ error: 'Stripe network/API error. Please try again.' });
      return;
    }

    const statusCode = Number(error?.statusCode) || 400;
    res.status(statusCode).json({ error: safeError });
  }
};

app.post('/api/create-payment-intent', handleCreatePaymentIntent);
app.post('/api/payments/create-intent', handleCreatePaymentIntent);

app.post('/api/coloring-page', upload.single('image'), async (req, res) => {
  let cacheLogContext = null;

  try {
    cacheStats.requests += 1;

    if (!req.file) {
      res.status(400).json({ error: 'Image file is required.' });
      return;
    }

    console.log('POST /api/coloring-page', {
      name: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
    });

    const rawSourceBuffer = req.file.buffer;
    const sourceHash = hashSha256(rawSourceBuffer);
    let imageBuffer = rawSourceBuffer;
    let imageName = req.file.originalname;
    let imageMimeType = req.file.mimetype;
    const sessionId = sanitizeSessionId(req.body?.sessionId);
    const pageIndex = normalizePageIndex(req.body?.pageIndex);
    const pageBaseName = getPageBaseName(pageIndex);
    const generationOptions = {
      promptVersion: COLORING_PROMPT_VERSION,
      model: COLORING_MODEL,
      size: COLORING_SIZE,
      prompt: COLORING_PROMPT,
    };
    const cacheKey = buildColoringCacheKey({
      sourceHash,
      generationOptions,
    });
    const legacyCacheKey = buildLegacyColoringCacheKey({
      sourceHash,
      pageIndex,
      generationOptions,
    });
    cacheLogContext = {
      sourceHash,
      cacheKey,
      cachePath: path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.png`),
    };

    if (isHeicFile(req.file)) {
      try {
        const converted = await heicConvert({
          buffer: imageBuffer,
          format: 'JPEG',
          quality: 0.9,
        });

        imageBuffer = Buffer.from(converted);
        imageMimeType = 'image/jpeg';
        imageName = `${path.parse(req.file.originalname).name}.jpg`;
      } catch (conversionError) {
        console.error('HEIC conversion error:', conversionError);
        res.status(400).json({
          error:
            'We could not process that HEIC/HEIF image. Please try another photo or export it as JPG.',
        });
        return;
      }
    }

    // Convert to PNG for gpt-image-1 compatibility (handles CMYK, progressive JPEG, etc.)
    if (imageMimeType !== 'image/png') {
      try {
        imageBuffer = await sharp(imageBuffer).png().toBuffer();
        imageMimeType = 'image/png';
        imageName = `${path.parse(imageName).name}.png`;
      } catch (conversionError) {
        console.error('Image conversion to PNG failed:', conversionError);
      }
    }

    const originalsExtension = getExtensionForMimeType(imageMimeType);
    const originalsMimeType = getContentTypeForExtension(originalsExtension);

    const orderDirectory = path.join(GENERATED_ORDERS_ROOT, `session-${sessionId}`);
    const originalsDirectory = path.join(orderDirectory, 'originals');
    const generatedDirectory = path.join(orderDirectory, 'generated');
    const originalImagePath = path.join(
      originalsDirectory,
      `${pageBaseName}-original.${originalsExtension}`,
    );
    const generatedImagePath = path.join(
      generatedDirectory,
      `${pageBaseName}-generated.png`,
    );
    const pageHashPath = path.join(orderDirectory, `${pageBaseName}-original.sha256`);
    const pageCacheKeyPath = path.join(orderDirectory, `${pageBaseName}-cache-key.txt`);
    const globalCacheImagePath = path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.png`);
    const globalCacheMetaPath = path.join(PERSISTENT_CACHE_ROOT, `${cacheKey}.json`);
    const legacyPersistentCacheImagePath = path.join(PERSISTENT_CACHE_ROOT, `${legacyCacheKey}.png`);
    const legacyPersistentCacheMetaPath = path.join(PERSISTENT_CACHE_ROOT, `${legacyCacheKey}.json`);
    const legacyGlobalCacheImagePath = path.join(GENERATED_ORDERS_ROOT, 'cache', `${sourceHash}.png`);

    await fs.mkdir(PERSISTENT_CACHE_ROOT, { recursive: true });

    const [
      existingHash,
      existingCacheKey,
      existingGeneratedBuffer,
      globalCachedBuffer,
      legacyPersistentCachedBuffer,
      legacyGlobalCachedBuffer,
      globalCacheImageStat,
      legacyPersistentCacheImageStat,
    ] = await Promise.all([
      fs.readFile(pageHashPath, 'utf8').catch(() => null),
      fs.readFile(pageCacheKeyPath, 'utf8').catch(() => null),
      fs.readFile(generatedImagePath).catch(() => null),
      fs.readFile(globalCacheImagePath).catch(() => null),
      fs.readFile(legacyPersistentCacheImagePath).catch(() => null),
      fs.readFile(legacyGlobalCacheImagePath).catch(() => null),
      fs.stat(globalCacheImagePath).catch(() => null),
      fs.stat(legacyPersistentCacheImagePath).catch(() => null),
    ]);

    logColoringCacheRequest({
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      byteLength: rawSourceBuffer.length,
      sourceHash,
      pageIndex,
      cacheKey,
      legacyCacheKey,
      cacheImagePath: globalCacheImagePath,
      cacheExistsBeforeGeneration: Boolean(globalCacheImageStat),
      legacyCacheImagePath: legacyPersistentCacheImagePath,
      legacyCacheExistsBeforeGeneration: Boolean(legacyPersistentCacheImageStat),
      sessionId,
    });

    if (globalCachedBuffer?.length) {
      logColoringCache({
        sourceHash,
        cacheKey,
        cachePath: globalCacheImagePath,
        exists: true,
        result: 'HIT',
      });
      await fs.mkdir(originalsDirectory, { recursive: true });
      await fs.mkdir(generatedDirectory, { recursive: true });
      await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
      await Promise.all([
        fs.writeFile(originalImagePath, imageBuffer),
        fs.writeFile(pageHashPath, sourceHash),
        fs.writeFile(pageCacheKeyPath, cacheKey),
        fs.writeFile(generatedImagePath, globalCachedBuffer),
        fs.writeFile(
          path.join(originalsDirectory, `${pageBaseName}.meta.json`),
          JSON.stringify(
            {
              originalName: imageName,
              mimeType: originalsMimeType,
              sourceHash,
              cacheKey,
            },
            null,
            2,
          ),
        ),
      ]);
      cacheStats.persistentHits += 1;
      pushCacheEvent({ type: 'persistent-hit', cacheKey, sourceHash, sessionId, pageIndex });
      res.json({
        imageBase64: globalCachedBuffer.toString('base64'),
        cached: true,
        cacheKey,
      });
      return;
    }

    if (legacyPersistentCachedBuffer?.length) {
      logColoringCache({
        sourceHash,
        cacheKey,
        cachePath: legacyPersistentCacheImagePath,
        exists: true,
        result: 'HIT_LEGACY_PERSISTENT',
      });
      await Promise.all([
        fs.writeFile(globalCacheImagePath, legacyPersistentCachedBuffer),
        fs.copyFile(legacyPersistentCacheMetaPath, globalCacheMetaPath).catch(async () => {
          await fs.writeFile(
            globalCacheMetaPath,
            JSON.stringify(
              {
                sourceHash,
                cacheKey,
                pageIndex,
                createdAt: new Date().toISOString(),
                generationOptions,
                sourceFile: {
                  originalName: imageName,
                  mimeType: originalsMimeType,
                },
                outputFile: path.basename(globalCacheImagePath),
                migratedFrom: legacyPersistentCacheImagePath,
              },
              null,
              2,
            ),
          );
        }),
      ]);
      await fs.mkdir(originalsDirectory, { recursive: true });
      await fs.mkdir(generatedDirectory, { recursive: true });
      await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
      await Promise.all([
        fs.writeFile(originalImagePath, imageBuffer),
        fs.writeFile(pageHashPath, sourceHash),
        fs.writeFile(pageCacheKeyPath, cacheKey),
        fs.writeFile(generatedImagePath, legacyPersistentCachedBuffer),
        fs.writeFile(
          path.join(originalsDirectory, `${pageBaseName}.meta.json`),
          JSON.stringify(
            {
              originalName: imageName,
              mimeType: originalsMimeType,
              sourceHash,
              cacheKey,
            },
            null,
            2,
          ),
        ),
      ]);
      cacheStats.persistentHits += 1;
      pushCacheEvent({ type: 'persistent-hit-legacy-key', cacheKey, sourceHash, sessionId, pageIndex });
      res.json({
        imageBase64: legacyPersistentCachedBuffer.toString('base64'),
        cached: true,
        cacheKey,
      });
      return;
    }

    if (legacyGlobalCachedBuffer?.length) {
      logColoringCache({
        sourceHash,
        cacheKey,
        cachePath: legacyGlobalCacheImagePath,
        exists: true,
        result: 'HIT',
      });
      await Promise.all([
        fs.writeFile(globalCacheImagePath, legacyGlobalCachedBuffer),
        fs.writeFile(
          globalCacheMetaPath,
          JSON.stringify(
            {
              sourceHash,
              cacheKey,
              pageIndex,
              createdAt: new Date().toISOString(),
              generationOptions,
              sourceFile: {
                originalName: imageName,
                mimeType: originalsMimeType,
              },
              outputFile: path.basename(globalCacheImagePath),
              migratedFrom: legacyGlobalCacheImagePath,
            },
            null,
            2,
          ),
        ),
      ]);
      await fs.mkdir(originalsDirectory, { recursive: true });
      await fs.mkdir(generatedDirectory, { recursive: true });
      await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
      await Promise.all([
        fs.writeFile(originalImagePath, imageBuffer),
        fs.writeFile(pageHashPath, sourceHash),
        fs.writeFile(pageCacheKeyPath, cacheKey),
        fs.writeFile(generatedImagePath, legacyGlobalCachedBuffer),
      ]);
      cacheStats.persistentHits += 1;
      pushCacheEvent({ type: 'persistent-hit-legacy', cacheKey, sourceHash, sessionId, pageIndex });
      res.json({
        imageBase64: legacyGlobalCachedBuffer.toString('base64'),
        cached: true,
        cacheKey,
      });
      return;
    }

    const sourceHashMatch = await findPersistentCacheEntryBySourceHash({
      sourceHash,
      generationOptions,
    });

    if (sourceHashMatch?.imageBuffer?.length) {
      logColoringCache({
        sourceHash,
        cacheKey,
        cachePath: sourceHashMatch.imagePath,
        exists: true,
        result: 'HIT_SOURCE_HASH_MATCH',
      });
      await Promise.all([
        fs.writeFile(globalCacheImagePath, sourceHashMatch.imageBuffer),
        fs.writeFile(
          globalCacheMetaPath,
          JSON.stringify(
            {
              ...(sourceHashMatch.meta || {}),
              sourceHash,
              cacheKey,
              pageIndex,
              generationOptions,
              outputFile: path.basename(globalCacheImagePath),
              migratedFrom: sourceHashMatch.imagePath,
            },
            null,
            2,
          ),
        ),
      ]);
      await fs.mkdir(originalsDirectory, { recursive: true });
      await fs.mkdir(generatedDirectory, { recursive: true });
      await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
      await Promise.all([
        fs.writeFile(originalImagePath, imageBuffer),
        fs.writeFile(pageHashPath, sourceHash),
        fs.writeFile(pageCacheKeyPath, cacheKey),
        fs.writeFile(generatedImagePath, sourceHashMatch.imageBuffer),
        fs.writeFile(
          path.join(originalsDirectory, `${pageBaseName}.meta.json`),
          JSON.stringify(
            {
              originalName: imageName,
              mimeType: originalsMimeType,
              sourceHash,
              cacheKey,
            },
            null,
            2,
          ),
        ),
      ]);
      cacheStats.persistentHits += 1;
      pushCacheEvent({ type: 'persistent-hit-source-hash', cacheKey, sourceHash, sessionId, pageIndex });
      res.json({
        imageBase64: sourceHashMatch.imageBuffer.toString('base64'),
        cached: true,
        cacheKey,
      });
      return;
    }

    // Reuse cached generated page from this session if hash/key match and persistent cache is missing.
    const hashMatches = existingHash ? existingHash.trim() === sourceHash : true;
    const cacheKeyMatches = existingCacheKey ? existingCacheKey.trim() === cacheKey : true;
    if (existingGeneratedBuffer?.length && hashMatches && cacheKeyMatches) {
      logColoringCache({
        sourceHash,
        cacheKey,
        cachePath: generatedImagePath,
        exists: true,
        result: 'HIT',
      });
      cacheStats.sessionHits += 1;
      pushCacheEvent({ type: 'session-hit', cacheKey, sourceHash, sessionId, pageIndex });
      res.json({
        imageBase64: existingGeneratedBuffer.toString('base64'),
        cached: true,
        cacheKey,
      });
      return;
    }

    await fs.mkdir(originalsDirectory, { recursive: true });
    await fs.mkdir(generatedDirectory, { recursive: true });
    await removeStaleOriginalsForPage(originalsDirectory, pageBaseName, originalsExtension);
    await fs.writeFile(originalImagePath, imageBuffer);
    await fs.writeFile(pageHashPath, sourceHash);
    await fs.writeFile(pageCacheKeyPath, cacheKey);
    await fs.writeFile(
      path.join(originalsDirectory, `${pageBaseName}.meta.json`),
      JSON.stringify(
        {
          originalName: imageName,
          mimeType: originalsMimeType,
          sourceHash,
          cacheKey,
        },
        null,
        2,
      ),
    );

    cacheStats.misses += 1;
    pushCacheEvent({
      type: 'miss-generate',
      cacheKey,
      sourceHash,
      sessionId,
      pageIndex,
    });
    const imageFile = await toFile(imageBuffer, imageName, {
      type: imageMimeType,
    });

    const result = await client.images.edit({
      model: COLORING_MODEL,
      image: imageFile,
      prompt: COLORING_PROMPT,
      size: COLORING_SIZE,
    });

    const generatedBase64 = result?.data?.[0]?.b64_json;

    if (!generatedBase64) {
      res.status(502).json({ error: 'OpenAI did not return an image.' });
      return;
    }

    const generatedBuffer = Buffer.from(generatedBase64, 'base64');
    await Promise.all([
      fs.writeFile(generatedImagePath, generatedBuffer),
      fs.writeFile(globalCacheImagePath, generatedBuffer),
      fs.writeFile(
        globalCacheMetaPath,
        JSON.stringify(
          {
            sourceHash,
            cacheKey,
            pageIndex,
            createdAt: new Date().toISOString(),
            generationOptions,
            sourceFile: {
              originalName: imageName,
              mimeType: originalsMimeType,
            },
            outputFile: path.basename(globalCacheImagePath),
          },
          null,
          2,
        ),
      ),
    ]);
    const savedCacheStat = await fs.stat(globalCacheImagePath).catch(() => null);

    console.log('Persistent cache saved', {
      sourceHash,
      cacheKey,
      cacheImagePath: globalCacheImagePath,
      cacheMetaPath: globalCacheMetaPath,
      cacheSaved: Boolean(savedCacheStat),
      cacheSavedBytes: savedCacheStat?.size ?? 0,
    });
    cacheStats.generated += 1;
    pushCacheEvent({
      type: 'saved',
      cacheKey,
      sourceHash,
      sessionId,
      pageIndex,
    });

    console.log('Generated coloring page response', {
      outputLength: generatedBase64.length,
    });
    logColoringCache({
      sourceHash,
      cacheKey,
      cachePath: globalCacheImagePath,
      exists: false,
      result: 'GENERATED',
    });

    res.json({ imageBase64: generatedBase64, cached: false, cacheKey });
  } catch (error) {
    if (cacheLogContext) {
      logColoringCache({
        sourceHash: cacheLogContext.sourceHash,
        cacheKey: cacheLogContext.cacheKey,
        cachePath: cacheLogContext.cachePath,
        exists: false,
        result: 'MISS',
      });
    } else {
      console.log('[COLORING CACHE] sourceHash=');
      console.log('[COLORING CACHE] cacheKey=');
      console.log('[COLORING CACHE] cachePath=');
      console.log('[COLORING CACHE] exists=false');
      console.log('[COLORING CACHE] result=MISS');
    }
    console.error('coloring-page error:', error);

    if (error?.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({ error: 'File too large. Max size is 10MB.' });
      return;
    }

    res.status(500).json({
      error: 'Failed to generate coloring page.',
      details: error?.message || 'Unknown error',
    });
  }
});

app.get('/api/orders', async (_req, res) => {
  try {
    await fs.mkdir(ORDERS_ROOT, { recursive: true });
    const entries = await fs.readdir(ORDERS_ROOT, { withFileTypes: true });
    const orderDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

    const orderResults = await Promise.all(
      orderDirs.map(async (dirName) => {
        const orderPath = path.join(ORDERS_ROOT, dirName, 'order.json');
        const raw = await fs.readFile(orderPath, 'utf8').catch(() => null);
        if (!raw) {
          return null;
        }

        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }),
    );

    const orders = orderResults
      .filter(Boolean)
      .sort((left, right) => {
        const leftTime = Date.parse(left?.createdAt || '') || 0;
        const rightTime = Date.parse(right?.createdAt || '') || 0;
        return rightTime - leftTime;
      });

    res.json({
      count: orders.length,
      orders,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load orders.',
      details: error?.message || 'Unknown error',
    });
  }
});

app.post('/api/orders/complete', async (req, res) => {
  try {
    const {
      sessionId,
      shipping,
      pageCount,
      paymentIntentId,
      checkoutSessionId,
      selectedProduct,
      selectedAddOns,
      pricingSummary,
      backCoverTagline,
      backCoverDedication,
      backCoverId,
    } = normalizeOrderSubmission(req.body);
    console.log('[ORDER COMPLETE] body =', JSON.stringify(req.body, null, 2));
    console.log('[ORDER COMPLETE] includedPagesCount raw =', req.body?.includedPagesCount);
    console.log('[ORDER COMPLETE] includedPagesCount type =', typeof req.body?.includedPagesCount);
    console.log(
      '[ORDER COMPLETE] pricingSummary.includedPagesCount raw =',
      req.body?.pricingSummary?.includedPagesCount,
      typeof req.body?.pricingSummary?.includedPagesCount,
    );
    await validateOrderSubmission({
      pageCount,
      selectedProduct,
      selectedAddOns,
      pricingSummary,
    });

    if (!stripe) {
      res.status(503).json({
        error: 'Stripe key is missing or invalid. Payments are currently disabled.',
      });
      return;
    }

    if (!paymentIntentId) {
      throw new Error('paymentIntentId is required.');
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (!paymentIntent || paymentIntent.status !== 'succeeded') {
      throw new Error('Payment has not been completed successfully.');
    }

    if (paymentIntent.amount !== pricingSummary.totalCents) {
      console.warn('[ORDER COMPLETE] Amount mismatch — intent:', paymentIntent.amount, 'summary:', pricingSummary.totalCents, '— proceeding with Stripe-verified amount.');
      // Use the Stripe-confirmed amount as the source of truth
      pricingSummary.totalCents = paymentIntent.amount;
    }

    if ((paymentIntent.currency || '').toLowerCase() !== STRIPE_CURRENCY) {
      console.warn('[ORDER COMPLETE] Currency mismatch — intent:', paymentIntent.currency, 'expected:', STRIPE_CURRENCY);
    }

    const sessionRoot = path.join(GENERATED_ORDERS_ROOT, `session-${sessionId}`);
    const sessionOriginals = path.join(sessionRoot, 'originals');
    const sessionGenerated = path.join(sessionRoot, 'generated');

    const [originalFilesRaw, generatedFiles] = await Promise.all([
      readSortedFiles(sessionOriginals),
      readSortedFiles(sessionGenerated, '-generated.png'),
    ]);
    const originalFiles = originalFilesRaw.filter(isOriginalImageFile);

    if (!originalFiles.length) {
      res.status(400).json({
        error: 'No original uploads found for this session.',
      });
      return;
    }

    if (!generatedFiles.length) {
      res.status(400).json({
        error: 'No generated pages found for this session. Please generate pages first.',
      });
      return;
    }

    const orderId = createOrderId();
    const orderRoot = path.join(ORDERS_ROOT, orderId);
    const orderOriginals = path.join(orderRoot, 'originals');
    const orderGenerated = path.join(orderRoot, 'generated');

    await fs.mkdir(orderOriginals, { recursive: true });
    await fs.mkdir(orderGenerated, { recursive: true });

    await Promise.all([
      ...originalFiles.map((filename) =>
        fs.copyFile(
          path.join(sessionOriginals, filename),
          path.join(orderOriginals, filename),
        ),
      ),
      ...generatedFiles.map((filename) =>
        fs.copyFile(
          path.join(sessionGenerated, filename),
          path.join(orderGenerated, filename),
        ),
      ),
    ]);

    const createdAt = new Date().toISOString();
    // Always calculate delivery as 5 business days from now server-side
    const deliveryEstimate = (() => {
      const date = new Date();
      let businessDays = 0;
      while (businessDays < 5) {
        date.setDate(date.getDate() + 1);
        const day = date.getDay();
        if (day !== 0 && day !== 6) businessDays++;
      }
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    })();
    const uploadedPhotoCount = originalFiles.filter((name) => name.includes('-original.')).length;

    // Attach userId and account email if logged-in user
    const authHeader = req.headers['authorization'] || '';
    const authToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    let orderUserId = null;
    let accountEmail = '';
    if (authToken) {
      try {
        const payload = jwt.verify(authToken, JWT_SECRET);
        orderUserId = payload.userId;
        const allUsers = await readUsers();
        const matchedUser = allUsers.find((u) => u.id === orderUserId);
        if (matchedUser) accountEmail = matchedUser.email || '';
      } catch { /* ignore */ }
    }

    // Extract promo / discount data from request body (to save in order record)
    const promoCodeUsed = req.body?.promoCode ? String(req.body.promoCode).trim().toUpperCase() : '';
    const discountCentsUsed = promoCodeUsed && Number.isFinite(req.body?.discountCents) ? Math.max(0, Math.round(req.body.discountCents)) : 0;

    const orderRecord = {
      orderId,
      createdAt,
      status: 'new',
      availableStatuses: ORDER_STATUSES,
      sessionId,
      userId: orderUserId,
      accountEmail,
      pageCount,
      uploadedPhotoCount,
      firstName: shipping.firstName || '',
      lastName: shipping.lastName || '',
      email: shipping.email || accountEmail,
      address: shipping.address || '',
      city: shipping.city || '',
      postalCode: shipping.postalCode || '',
      country: shipping.country || '',
      customer: {
        name: buildCustomerName(shipping),
        email: shipping.email || '',
      },
      shipping: {
        firstName: shipping.firstName || '',
        lastName: shipping.lastName || '',
        email: shipping.email || '',
        address: shipping.address || '',
        city: shipping.city || '',
        postalCode: shipping.postalCode || '',
        country: shipping.country || '',
      },
      deliveryEstimate,
      payment: {
        provider: 'stripe_payment_element',
        checkoutSessionId: checkoutSessionId || '',
        paymentIntentId: paymentIntent.id,
        amount: pricingSummary.totalCents,
        currency: STRIPE_CURRENCY,
        status: paymentIntent.status,
      },
      product: selectedProduct,
      pricing: {
        ...pricingSummary,
        selectedAddOns,
      },
      promoCode: promoCodeUsed || null,
      discountCents: discountCentsUsed || null,
      loyaltyCode: null,
      backCoverId: backCoverId || null,
      backCoverTagline: backCoverTagline || null,
      backCoverDedication: backCoverDedication || null,
      files: {
        originals: originalFiles.map((name) => `originals/${name}`),
        generated: generatedFiles.map((name) => `generated/${name}`),
      },
    };

    await fs.writeFile(
      path.join(orderRoot, 'order.json'),
      JSON.stringify(orderRecord, null, 2),
      'utf8',
    );

    if (SHOULD_CLEANUP_SESSION_AFTER_ORDER) {
      try {
        await fs.rm(sessionRoot, { recursive: true, force: true });
        console.log('Cleaned temporary session folder after order completion (persistent cache untouched)', {
          sessionId,
          sessionRoot,
          persistentCacheRoot: PERSISTENT_CACHE_ROOT,
        });
      } catch (cleanupError) {
        console.warn('Order was saved, but temporary session cleanup failed', {
          sessionId,
          sessionRoot,
          error: cleanupError?.message || String(cleanupError),
        });
      }
    }

    console.log('Order saved for fulfillment', {
      orderId,
      sessionId,
      pageCount,
      generatedPages: generatedFiles.length,
    });

    // Apply promo code if provided (increment usedCount)
    if (promoCodeUsed) {
      try {
        const allCodes = await readPromoCodes();
        const promoIdx = allCodes.findIndex((c) => c.code.toUpperCase() === promoCodeUsed);
        if (promoIdx !== -1) {
          allCodes[promoIdx].usedCount = (allCodes[promoIdx].usedCount || 0) + 1;
          await writePromoCodes(allCodes);
        }
      } catch { /* non-critical */ }
    }

    // Generate 10% loyalty code for Premium orders
    let loyaltyCode = '';
    if (selectedProduct?.isPremium || selectedProduct?.id === 'premium-keepsake-book') {
      loyaltyCode = `LOYAL${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      try {
        const allCodes = await readPromoCodes();
        allCodes.push({
          id: loyaltyCode,
          code: loyaltyCode,
          type: 'percent',
          value: 10,
          active: true,
          maxUses: 1,
          usedCount: 0,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          description: `10% off — Premium loyalty reward for order #${orderId}`,
        });
        await writePromoCodes(allCodes);
      } catch { /* non-critical */ }
    }

    // Patch order record with loyalty code and re-save
    if (loyaltyCode) {
      orderRecord.loyaltyCode = loyaltyCode;
      await fs.writeFile(
        path.join(orderRoot, 'order.json'),
        JSON.stringify(orderRecord, null, 2),
        'utf8',
      ).catch(() => {});
    }

    // Send admin alert email
    if (ADMIN_EMAIL) {
      sendEmail({
        to: ADMIN_EMAIL,
        subject: `New order received: #${orderId}`,
        text: `New order!\n\nOrder: #${orderId}\nCustomer: ${shipping.firstName} ${shipping.lastName} <${shipping.email || accountEmail}>\nProduct: ${selectedProduct?.name || 'Unknown'}\nPages: ${pageCount}\nTotal: $${(pricingSummary.totalCents / 100).toFixed(2)}\n${promoCodeUsed ? `Promo code: ${promoCodeUsed} (−$${(discountCentsUsed / 100).toFixed(2)})\n` : ''}${loyaltyCode ? `Loyalty code issued: ${loyaltyCode}\n` : ''}${backCoverTagline ? `Back cover: ${backCoverTagline}\n` : ''}${backCoverDedication ? `Dedication: ${backCoverDedication}\n` : ''}\nView in admin: ${APP_BASE_URL}/admin.html`,
        html: `<div style="font-family:sans-serif;max-width:480px;color:#1e0e28">
          <h2 style="color:#7446a0">New order: #${orderId}</h2>
          <table style="width:100%;font-size:14px;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#888">Customer</td><td>${shipping.firstName} ${shipping.lastName}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Email</td><td>${shipping.email || accountEmail}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Product</td><td>${selectedProduct?.name || 'Unknown'}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Pages</td><td>${pageCount}</td></tr>
            <tr><td style="padding:6px 0;color:#888">Total</td><td><strong>$${(pricingSummary.totalCents / 100).toFixed(2)}</strong></td></tr>
            ${promoCodeUsed ? `<tr><td style="padding:6px 0;color:#888">Promo used</td><td>${promoCodeUsed} (−$${(discountCentsUsed / 100).toFixed(2)})</td></tr>` : ''}
            ${loyaltyCode ? `<tr><td style="padding:6px 0;color:#888">Loyalty code issued</td><td style="font-weight:700;color:#7446a0">${loyaltyCode}</td></tr>` : ''}
          </table>
          <a href="${APP_BASE_URL}/admin.html" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#7446a0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">View in Admin</a>
        </div>`,
      }).catch(() => {});
    }

    // Send confirmation email
    const customerEmail = shipping.email || accountEmail;
    if (customerEmail) {
      const customerName = shipping.firstName || 'there';
      const totalFormatted = pricingSummary.totalCents
        ? `$${(pricingSummary.totalCents / 100).toFixed(2)}`
        : '';
      const statusUrl = `${APP_BASE_URL}?order=${orderId}`;
      sendEmail({
        to: customerEmail,
        subject: `Your order is confirmed ♡ (#${orderId})`,
        text: `Hi ${customerName},\n\nYour custom coloring book is officially in the works ♡\nWe're carefully creating it now and it will ship within 5 business days.\n\nOrder: #${orderId}\nEstimated delivery: ${deliveryEstimate}\n${loyaltyCode ? `\n🎁 As a Premium customer, here's 10% off your next order: ${loyaltyCode}\n` : ''}\nIf you need anything, just reply here or email us anytime.\n\nWith love,\nTwice Upon Us`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:0 auto;color:#1e0e28;padding:32px 24px">
            <h2 style="color:#7446a0;margin:0 0 8px">Hi ${customerName} ♡</h2>
            <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Your custom coloring book is officially in the works ♡<br>We're carefully creating it now and it will ship within 5 business days.</p>
            <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;background:#faf8ff;border-radius:12px;padding:16px">
              <tr><td style="padding:8px 12px;color:#7c6f8e">Order</td><td style="padding:8px 12px;font-weight:700">#${orderId}</td></tr>
              <tr><td style="padding:8px 12px;color:#7c6f8e">Estimated delivery</td><td style="padding:8px 12px;font-weight:600">${deliveryEstimate}</td></tr>
              ${totalFormatted ? `<tr><td style="padding:8px 12px;color:#7c6f8e">Total</td><td style="padding:8px 12px;font-weight:600">${totalFormatted}</td></tr>` : ''}
            </table>
            ${loyaltyCode ? `
            <div style="background:#f5f0ff;border:1px solid #c4a8f0;border-radius:10px;padding:16px 20px;margin:0 0 24px">
              <p style="margin:0 0 6px;font-weight:700;color:#7446a0">🎁 Your Premium loyalty reward</p>
              <p style="margin:0 0 10px;font-size:14px;color:#4f4255">Here's 10% off your next order:</p>
              <p style="margin:0;font-size:22px;font-weight:800;letter-spacing:0.1em;color:#7446a0">${loyaltyCode}</p>
            </div>` : ''}
            <p style="font-size:14px;color:#4f4255;line-height:1.6">If you need anything, just reply here or email us anytime.</p>
            <p style="font-size:14px;color:#1e0e28;margin-top:24px">With love,<br><strong>Twice Upon Us</strong></p>
          </div>`,
      }).catch(() => {});
    }

    res.status(201).json({
      orderId,
      createdAt,
      status: 'new',
      deliveryEstimate,
      files: orderRecord.files,
    });
  } catch (error) {
    console.error('order-complete error:', error);
    const details = error?.message || 'Unknown error';
    const safeDetails = sanitizeStripeErrorMessage(error, details);
    const likelyValidationError =
      typeof safeDetails === 'string' &&
      /(required|invalid|must|do not match)/i.test(safeDetails);

    res.status(likelyValidationError ? 400 : 500).json({
      error: likelyValidationError
        ? safeDetails
        : 'Failed to save completed order.',
      details: safeDetails,
    });
  }
});

app.use((error, _req, res, _next) => {
  if (error?.code === 'LIMIT_FILE_SIZE') {
    res.status(400).json({ error: 'File too large. Max size is 10MB.' });
    return;
  }

  if (error?.message) {
    res.status(400).json({ error: error.message });
    return;
  }

  res.status(500).json({ error: 'Unexpected server error.' });
});

// ─── User Auth ───────────────────────────────────────────────────────────────

const JWT_SECRET = normalizeEnvValue(process.env.JWT_SECRET) || 'twice-upon-us-dev-secret-change-in-prod';
const JWT_EXPIRES_IN = '30d';
const APP_BASE_URL = normalizeEnvValue(process.env.APP_BASE_URL || 'http://localhost:5174');
const FROM_EMAIL = normalizeEnvValue(process.env.SMTP_FROM || 'Twice Upon Us <noreply@twiceuponus.com>');

// ─── Email ────────────────────────────────────────────────────────────────────

const smtpHost = normalizeEnvValue(process.env.SMTP_HOST);
const smtpUser = normalizeEnvValue(process.env.SMTP_USER);
const smtpPass = normalizeEnvValue(process.env.SMTP_PASS);
const smtpPort = Number(process.env.SMTP_PORT || 587);

let emailTransporter = null;

if (smtpHost && smtpUser && smtpPass) {
  emailTransporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
  });
  console.log('[EMAIL] SMTP transporter configured:', smtpHost);
} else {
  console.log('[EMAIL] No SMTP configured — emails will be logged to console only.');
}

async function sendEmail({ to, subject, html, text }) {
  if (emailTransporter) {
    try {
      await emailTransporter.sendMail({ from: FROM_EMAIL, to, subject, html, text });
      console.log('[EMAIL] Sent:', subject, '->', to);
    } catch (err) {
      console.error('[EMAIL] Failed to send:', err.message);
    }
  } else {
    console.log('\n─── [EMAIL LOG] ───────────────────────────────');
    console.log('TO:', to);
    console.log('SUBJECT:', subject);
    console.log('TEXT:', text || '(html only)');
    console.log('───────────────────────────────────────────────\n');
  }
}

async function readUsers() {
  try {
    const raw = await fs.readFile(USERS_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

async function writeUsers(users) {
  await fs.mkdir(DATA_ROOT, { recursive: true });
  await fs.writeFile(USERS_PATH, JSON.stringify({ users }, null, 2), 'utf8');
}

function sanitizeUser(user) {
  const { passwordHash: _ph, ...safe } = user;
  return safe;
}

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Register
app.post('/api/auth/register', express.json(), async (req, res) => {
  const { email, password, firstName, lastName } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }

  try {
    const users = await readUsers();
    if (users.find((u) => u.email === normalizedEmail)) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const newUser = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      firstName: String(firstName || '').trim(),
      lastName: String(lastName || '').trim(),
      passwordHash,
      savedShipping: null,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    const token = jwt.sign({ userId: newUser.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

// Login
app.post('/api/auth/login', express.json(), async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }
  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const users = await readUsers();
    const user = users.find((u) => u.email === normalizedEmail);
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const match = await bcrypt.compare(String(password), user.passwordHash);
    if (!match) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ token, user: sanitizeUser(user) });
  } catch {
    res.status(500).json({ error: 'Login failed.' });
  }
});

// Get current user
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const users = await readUsers();
    const user = users.find((u) => u.id === req.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    res.json({ user: sanitizeUser(user) });
  } catch {
    res.status(500).json({ error: 'Failed to load user.' });
  }
});

// Update saved shipping
app.put('/api/auth/me/shipping', requireAuth, express.json(), async (req, res) => {
  try {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.id === req.userId);
    if (idx === -1) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    const { firstName, lastName, email, address, city, postalCode, country } = req.body || {};
    users[idx].savedShipping = { firstName, lastName, email, address, city, postalCode, country };
    await writeUsers(users);
    res.json({ user: sanitizeUser(users[idx]) });
  } catch {
    res.status(500).json({ error: 'Failed to save shipping details.' });
  }
});

// Forgot password
app.post('/api/auth/forgot-password', express.json(), async (req, res) => {
  const { email } = req.body || {};
  if (!email) { res.status(400).json({ error: 'Email is required.' }); return; }
  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.email === normalizedEmail);

    // Always respond success to avoid user enumeration
    if (idx !== -1) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
      users[idx].resetToken = resetToken;
      users[idx].resetTokenExpiry = resetExpiry;
      await writeUsers(users);

      const resetLink = `${APP_BASE_URL}?reset=${resetToken}`;
      await sendEmail({
        to: normalizedEmail,
        subject: 'Reset your Twice Upon Us password',
        text: `Hi,\n\nClick the link below to reset your password (expires in 1 hour):\n\n${resetLink}\n\nIf you didn't request this, ignore this email.\n\nTwice Upon Us`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#1e0e28">
            <h2 style="color:#7446a0">Reset your password</h2>
            <p>Click below to set a new password. This link expires in <strong>1 hour</strong>.</p>
            <a href="${resetLink}" style="display:inline-block;margin:20px 0;padding:12px 24px;background:#7446a0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
            <p style="color:#888;font-size:12px">If you didn't request this, you can safely ignore this email.</p>
          </div>`,
      });
    }

    res.json({ ok: true, message: 'If that email exists, a reset link has been sent.' });
  } catch {
    res.status(500).json({ error: 'Failed to process request.' });
  }
});

// Reset password
app.post('/api/auth/reset-password', express.json(), async (req, res) => {
  const { token, password } = req.body || {};
  if (!token || !password) { res.status(400).json({ error: 'Token and password are required.' }); return; }
  if (typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters.' }); return;
  }

  try {
    const users = await readUsers();
    const idx = users.findIndex((u) => u.resetToken === token);
    if (idx === -1) { res.status(400).json({ error: 'Invalid or expired reset link.' }); return; }

    const expiry = new Date(users[idx].resetTokenExpiry || 0);
    if (Date.now() > expiry.getTime()) {
      res.status(400).json({ error: 'This reset link has expired. Please request a new one.' }); return;
    }

    users[idx].passwordHash = await bcrypt.hash(password, 12);
    users[idx].resetToken = null;
    users[idx].resetTokenExpiry = null;
    await writeUsers(users);

    const newToken = jwt.sign({ userId: users[idx].id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ ok: true, token: newToken, user: sanitizeUser(users[idx]) });
  } catch {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Get user's orders
app.get('/api/auth/me/orders', requireAuth, async (req, res) => {
  try {
    await fs.mkdir(ORDERS_ROOT, { recursive: true });
    const entries = await fs.readdir(ORDERS_ROOT, { withFileTypes: true });
    const orderDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);

    const results = await Promise.all(
      orderDirs.map(async (dirName) => {
        const raw = await fs.readFile(path.join(ORDERS_ROOT, dirName, 'order.json'), 'utf8').catch(() => null);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      }),
    );

    const orders = results
      .filter((o) => o && o.userId === req.userId)
      .sort((a, b) => (Date.parse(b?.createdAt) || 0) - (Date.parse(a?.createdAt) || 0))
      .map((o) => ({
        orderId: o.orderId,
        createdAt: o.createdAt,
        status: o.status,
        pageCount: o.pageCount,
        deliveryEstimate: o.deliveryEstimate,
        shipping: o.shipping,
        product: o.product,
        pricing: o.pricing,
      }));

    res.json({ orders });
  } catch {
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

// ─── Promo Codes ─────────────────────────────────────────────────────────────

async function readPromoCodes() {
  try {
    const raw = await fs.readFile(PROMO_CODES_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.codes) ? parsed.codes : [];
  } catch { return []; }
}

async function writePromoCodes(codes) {
  await fs.writeFile(PROMO_CODES_PATH, JSON.stringify({ codes }, null, 2), 'utf8');
}

function applyPromoDiscount(totalCents, promo) {
  if (!promo || !promo.active) return { discountCents: 0, finalCents: totalCents };
  let discountCents = 0;
  if (promo.type === 'percent') {
    discountCents = Math.round(totalCents * (promo.value / 100));
  } else if (promo.type === 'fixed') {
    discountCents = promo.value;
  }
  discountCents = Math.min(discountCents, totalCents);
  return { discountCents, finalCents: totalCents - discountCents };
}

// ─── Contact form ────────────────────────────────────────────────────────────

app.post('/api/contact', express.json(), async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  if (!name || !email || !subject || !message) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }

  const safeSubject = String(subject).slice(0, 200);
  const safeName = String(name).slice(0, 100);
  const safeMessage = String(message).slice(0, 5000);
  const safeEmail = String(email).slice(0, 254);

  try {
    await sendEmail({
      to: ADMIN_EMAIL || 'twiceuponus@gmail.com',
      replyTo: safeEmail,
      subject: `[Customer Support] ${safeSubject}`,
      text: `New support message from ${safeName} <${safeEmail}>\n\nSubject: ${safeSubject}\n\n${safeMessage}`,
      html: `<div style="font-family:sans-serif;max-width:520px;color:#1e0e28">
        <h2 style="color:#7446a0">New support message</h2>
        <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px">
          <tr><td style="padding:6px 0;color:#888;width:80px">From</td><td><strong>${safeName}</strong> &lt;${safeEmail}&gt;</td></tr>
          <tr><td style="padding:6px 0;color:#888">Subject</td><td>${safeSubject}</td></tr>
        </table>
        <div style="background:#f5f0ff;border-radius:10px;padding:16px 20px;white-space:pre-wrap;font-size:14px;line-height:1.6">${safeMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>
        <p style="color:#888;font-size:12px;margin-top:16px">Reply directly to this email to respond to the customer.</p>
      </div>`,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to send message. Please try again.' });
  }
});

// ─── Corporate quote ─────────────────────────────────────────────────────────

app.post('/api/corporate-quote', upload.fields([{ name: 'photos', maxCount: 10 }, { name: 'logo', maxCount: 1 }]), async (req, res) => {
  const { format, pageCount, quantity, name, company, email, phone } = req.body || {};

  if (!format || !pageCount || !quantity || !name || !company || !email || !phone) {
    res.status(400).json({ error: 'All fields are required.' });
    return;
  }
  if (typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Invalid email address.' });
    return;
  }

  const safeName = String(name).slice(0, 100);
  const safeCompany = String(company).slice(0, 100);
  const safeEmail = String(email).slice(0, 254);
  const safePhone = String(phone).slice(0, 30);
  const safeFormat = format === 'large-book' ? 'Large Book' : 'Pocket Book';
  const safePageCount = String(pageCount);
  const safeQuantity = String(quantity);
  const photoCount = (req.files?.photos || []).length;
  const hasLogo = (req.files?.logo || []).length > 0;

  const qty = parseInt(safeQuantity, 10);
  const pricePerBook = qty >= 100 ? 7 : 8;
  const estimatedTotal = isNaN(qty) ? 'Contact us' : `$${(qty * pricePerBook).toLocaleString()}`;

  const adminHtml = `
    <div style="font-family:sans-serif;max-width:560px;color:#1e0e28">
      <h2 style="color:#7446a0">New Corporate Quote Request</h2>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin-bottom:16px">
        <tr><td style="padding:6px 0;color:#888;width:120px">Contact</td><td><strong>${safeName}</strong> — ${safeCompany}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Email</td><td>${safeEmail}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Phone</td><td>${safePhone}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Format</td><td>${safeFormat}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Page Count</td><td>${safePageCount} pages</td></tr>
        <tr><td style="padding:6px 0;color:#888">Quantity</td><td>${safeQuantity} books</td></tr>
        <tr><td style="padding:6px 0;color:#888">Price/Book</td><td>$${pricePerBook}</td></tr>
        <tr><td style="padding:6px 0;color:#888">Est. Total</td><td><strong>${estimatedTotal}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#888">Photos</td><td>${photoCount} inspiration photo(s) uploaded</td></tr>
        <tr><td style="padding:6px 0;color:#888">Logo</td><td>${hasLogo ? 'Yes, logo uploaded' : 'No logo uploaded'}</td></tr>
      </table>
      <p style="color:#888;font-size:12px">Reply to this email to contact the client directly.</p>
    </div>
  `;

  const clientHtml = `
    <div style="font-family:sans-serif;max-width:520px;color:#1e0e28">
      <h2 style="color:#7446a0">We received your quote request!</h2>
      <p style="font-size:15px;line-height:1.6">Hi ${safeName}, thanks for reaching out to Twice Upon Us. We've received your corporate order request for <strong>${safeQuantity} ${safeFormat}s</strong> and will be in touch within 1–2 business days to confirm your quote.</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse;margin:20px 0;background:#f5f0ff;border-radius:10px;padding:16px">
        <tr><td style="padding:6px 12px;color:#888;width:120px">Format</td><td>${safeFormat}</td></tr>
        <tr><td style="padding:6px 12px;color:#888">Pages</td><td>${safePageCount} pages</td></tr>
        <tr><td style="padding:6px 12px;color:#888">Quantity</td><td>${safeQuantity} books</td></tr>
        <tr><td style="padding:6px 12px;color:#888">Est. Total</td><td><strong>${estimatedTotal}</strong></td></tr>
      </table>
      <p style="font-size:14px;color:#61506e">Questions? Reply to this email or reach us at twiceuponus@gmail.com</p>
      <p style="font-size:13px;color:#aaa;margin-top:24px">— The Twice Upon Us Team</p>
    </div>
  `;

  try {
    await sendEmail({
      to: ADMIN_EMAIL || 'twiceuponus@gmail.com',
      replyTo: safeEmail,
      subject: `[Corporate Quote] ${safeCompany} — ${safeQuantity} books`,
      html: adminHtml,
    });
    await sendEmail({
      to: safeEmail,
      subject: 'Your Twice Upon Us corporate quote request',
      html: clientHtml,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to send quote. Please try again.' });
  }
});

// Validate promo code
app.post('/api/promo/validate', express.json(), async (req, res) => {
  const { code, totalCents } = req.body || {};
  if (!code) { res.status(400).json({ error: 'Promo code is required.' }); return; }
  const normalizedCode = String(code).trim().toUpperCase();

  try {
    const codes = await readPromoCodes();
    const promo = codes.find((c) => c.code.toUpperCase() === normalizedCode);

    if (!promo || !promo.active) {
      res.status(404).json({ error: 'Invalid or expired promo code.' }); return;
    }
    if (promo.expiresAt && new Date() > new Date(promo.expiresAt)) {
      res.status(400).json({ error: 'This promo code has expired.' }); return;
    }
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      res.status(400).json({ error: 'This promo code has reached its usage limit.' }); return;
    }

    const { discountCents, finalCents } = applyPromoDiscount(totalCents || 0, promo);
    res.json({
      valid: true,
      code: promo.code,
      type: promo.type,
      value: promo.value,
      discountCents,
      finalCents,
      description: promo.description || '',
    });
  } catch {
    res.status(500).json({ error: 'Failed to validate promo code.' });
  }
});

// Public order status (no auth required — just order ID)
app.get('/api/orders/:orderId/status', async (req, res) => {
  const { orderId } = req.params;
  if (!orderId || !/^[a-zA-Z0-9_-]+$/.test(orderId)) {
    res.status(400).json({ error: 'Invalid order ID.' }); return;
  }
  try {
    const orderPath = path.join(ORDERS_ROOT, orderId, 'order.json');
    const raw = await fs.readFile(orderPath, 'utf8').catch(() => null);
    if (!raw) { res.status(404).json({ error: 'Order not found.' }); return; }
    const order = JSON.parse(raw);
    res.json({
      orderId: order.orderId,
      status: order.status,
      createdAt: order.createdAt,
      deliveryEstimate: order.deliveryEstimate,
      pageCount: order.pageCount,
      product: order.product ? { name: order.product.name, productType: order.product.productType } : null,
      shipping: order.shipping ? {
        firstName: order.shipping.firstName,
        city: order.shipping.city,
        country: order.shipping.country,
      } : null,
    });
  } catch {
    res.status(500).json({ error: 'Failed to load order.' });
  }
});

// ─── Admin ───────────────────────────────────────────────────────────────────

const ADMIN_PASSWORD = normalizeEnvValue(process.env.ADMIN_PASSWORD);
const ADMIN_TOKENS = new Set(); // in-memory; resets on server restart

function requireAdmin(req, res, next) {
  const token = req.headers['x-admin-token'] || req.query.token;
  if (!token || !ADMIN_TOKENS.has(token)) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  next();
}

app.post('/api/admin/login', express.json(), (req, res) => {
  const { password } = req.body || {};
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Incorrect password.' });
    return;
  }
  const token = crypto.randomBytes(32).toString('hex');
  ADMIN_TOKENS.add(token);
  res.json({ token });
});

app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
  try {
    await fs.mkdir(ORDERS_ROOT, { recursive: true });
    const entries = await fs.readdir(ORDERS_ROOT, { withFileTypes: true });
    const orderDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    const results = await Promise.all(
      orderDirs.map(async (dirName) => {
        const raw = await fs.readFile(path.join(ORDERS_ROOT, dirName, 'order.json'), 'utf8').catch(() => null);
        if (!raw) return null;
        try { return JSON.parse(raw); } catch { return null; }
      }),
    );
    const orders = results
      .filter(Boolean)
      .sort((a, b) => (Date.parse(b?.createdAt) || 0) - (Date.parse(a?.createdAt) || 0));
    res.json({ count: orders.length, orders });
  } catch (error) {
    res.status(500).json({ error: 'Failed to load orders.' });
  }
});

app.get('/api/admin/orders/:orderId/image/:type/:filename', requireAdmin, async (req, res) => {
  const { orderId, type, filename } = req.params;
  if (!['originals', 'generated'].includes(type)) {
    res.status(400).json({ error: 'Invalid image type.' });
    return;
  }
  // Prevent path traversal
  const safeFilename = path.basename(filename);
  const imagePath = path.join(ORDERS_ROOT, orderId, type, safeFilename);
  try {
    await fs.access(imagePath);
    if (req.query.dl === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
    }
    res.sendFile(imagePath);
  } catch {
    res.status(404).json({ error: 'Image not found.' });
  }
});

app.patch('/api/admin/orders/:orderId/status', requireAdmin, express.json(), async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body || {};
  const VALID_STATUSES = ['new', 'in-production', 'completed', 'shipped'];
  if (!VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: 'Invalid status.' });
    return;
  }
  const orderPath = path.join(ORDERS_ROOT, orderId, 'order.json');
  try {
    const raw = await fs.readFile(orderPath, 'utf8');
    const order = JSON.parse(raw);
    const previousStatus = order.status;
    order.status = status;
    await fs.writeFile(orderPath, JSON.stringify(order, null, 2));

    // Send shipped email to customer
    if (status === 'shipped' && previousStatus !== 'shipped') {
      const toEmail = order.shipping?.email || order.accountEmail || order.email || '';
      const firstName = order.shipping?.firstName || order.firstName || 'there';
      const statusUrl = `${APP_BASE_URL}?order=${orderId}`;
      if (toEmail) {
        sendEmail({
          to: toEmail,
          subject: `Your Twice Upon Us book is on its way! 📦`,
          text: `Hi ${firstName},\n\nGreat news — your order #${orderId} has shipped!\n\nTrack your order: ${statusUrl}\n\nEstimated delivery: ${order.deliveryEstimate || 'within 7–12 days'}\n\nWith love,\nTwice Upon Us`,
          html: `<div style="font-family:sans-serif;max-width:480px;color:#1e0e28">
            <h2 style="color:#7446a0">Your book is on its way! 📦</h2>
            <p>Hi <strong>${firstName}</strong>, your order <strong>#${orderId}</strong> has shipped and is heading to you.</p>
            <p style="margin:16px 0"><strong>Estimated delivery:</strong> ${order.deliveryEstimate || '7–12 days'}</p>
            <a href="${statusUrl}" style="display:inline-block;padding:12px 24px;background:#7446a0;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Track Your Order</a>
            <p style="margin-top:24px;color:#888;font-size:12px">Questions? Email us at support@twiceuponus.com</p>
          </div>`,
        }).catch(() => {});
      }
    }

    res.json({ ok: true, order });
  } catch {
    res.status(404).json({ error: 'Order not found.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

app.listen(port, () => {
  console.log(`Twice Upon Us backend listening on http://localhost:${port}`);
});
