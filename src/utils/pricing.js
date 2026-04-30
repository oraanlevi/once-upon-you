export const PRODUCT_TYPE_LABELS = {
  digital: 'Digital Product',
  physical: 'Printed Physical Product',
  custom: 'Custom Personalized Product',
  bundle: 'Bundle',
};

const currencyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});
const INCLUDED_PAGES_IN_BASE = 8;
const DEFAULT_PAGE_COUNT = 8;

const DEFAULT_PRICE_PER_PAGE_BY_TYPE = {
  digital: 100,
  physical: 150,
  custom: 200,
  bundle: 250,
};

function asNonNegativeInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  const rounded = Math.round(parsed);
  return rounded < 0 ? fallback : rounded;
}

function normalizeQuantity(value, { min = 1, max = 99 } = {}) {
  const parsed = Number.parseInt(String(value || '1'), 10);
  if (!Number.isFinite(parsed)) {
    return min;
  }

  return Math.min(max, Math.max(min, parsed));
}

export function normalizeAvailablePageCounts(pageCounts, fallback = [2, 5, 10, 15, 20, 30]) {
  const normalized = Array.isArray(pageCounts)
    ? Array.from(
        new Set(
          pageCounts
            .map((value) => Number.parseInt(String(value), 10))
            .filter((value) => Number.isFinite(value) && value > 0 && value <= 500),
        ),
      ).sort((a, b) => a - b)
    : [];

  return normalized.length ? normalized : fallback;
}

export function getDefaultPageCount(pageCounts) {
  const normalized = normalizeAvailablePageCounts(pageCounts);
  return normalized.includes(DEFAULT_PAGE_COUNT) ? DEFAULT_PAGE_COUNT : normalized[0];
}

export function formatMoney(cents = 0) {
  return currencyFormatter.format(asNonNegativeInt(cents) / 100);
}

export function dollarsInputToCents(input) {
  const value = String(input ?? '').trim();
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[$,\s]/g, '');
  const numeric = Number(normalized);

  if (!Number.isFinite(numeric) || numeric < 0) {
    return null;
  }

  return Math.round(numeric * 100);
}

export function centsToDollarsInput(cents) {
  if (cents === null || cents === undefined) {
    return '';
  }

  return (asNonNegativeInt(cents) / 100).toFixed(2);
}

function resolvePricePerPageCents(product) {
  const rawPricePerPageCents = asNonNegativeInt(product?.pricePerPageCents);
  const fallbackPricePerPageCents =
    DEFAULT_PRICE_PER_PAGE_BY_TYPE[product?.productType] || 100;

  return rawPricePerPageCents > 0 ? rawPricePerPageCents : fallbackPricePerPageCents;
}

export function calculateProductPricing(product, selectedPageCount = 0) {
  const requestedPageCount = Number.parseInt(String(selectedPageCount), 10);
  const normalizedRequestedPageCount =
    Number.isFinite(requestedPageCount) && requestedPageCount > 0 ? requestedPageCount : 0;

  if (!product) {
    return {
      selectedPageCount: normalizedRequestedPageCount,
      includedPagesCount: Math.min(INCLUDED_PAGES_IN_BASE, normalizedRequestedPageCount),
      extraPagesCount: Math.max(normalizedRequestedPageCount - INCLUDED_PAGES_IN_BASE, 0),
      basePriceCents: 0,
      pricePerPageCents: 0,
      pagePriceTotalCents: 0,
      extraPagesPriceTotalCents: 0,
      productSubtotalCents: 0,
      compareAtPriceCents: null,
      compareAtTotalCents: null,
    };
  }

  const basePriceCents = asNonNegativeInt(product.basePriceCents);
  const pricePerPageCents = resolvePricePerPageCents(product);
  const pageCountOptions = normalizeAvailablePageCounts(product.availablePageCounts);
  const fallbackPageCount = getDefaultPageCount(pageCountOptions);
  const safePageCount = pageCountOptions.includes(requestedPageCount)
    ? requestedPageCount
    : fallbackPageCount;
  const includedPagesCount = Math.min(INCLUDED_PAGES_IN_BASE, safePageCount);
  const extraPagesCount = Math.max(safePageCount - INCLUDED_PAGES_IN_BASE, 0);
  // Tiered pricing: pages 9-15 at full rate, pages 16+ at reduced rate ($2/page)
  const tierOneCount = Math.min(extraPagesCount, 7); // up to page 15
  const tierTwoCount = Math.max(extraPagesCount - 7, 0); // page 16+
  const reducedPricePerPageCents = 200;
  const extraPagesPriceTotalCents = tierOneCount * pricePerPageCents + tierTwoCount * reducedPricePerPageCents;
  const pagePriceTotalCents = extraPagesPriceTotalCents;
  const productSubtotalCents = basePriceCents + extraPagesPriceTotalCents;
  const compareAtPriceCentsRaw = product.compareAtPriceCents;
  const compareAtPriceCents =
    compareAtPriceCentsRaw === null || compareAtPriceCentsRaw === undefined
      ? null
      : asNonNegativeInt(compareAtPriceCentsRaw);
  const compareAtTotalCents =
    compareAtPriceCents === null ? null : compareAtPriceCents + extraPagesPriceTotalCents;

  return {
    selectedPageCount: safePageCount,
    includedPagesCount,
    extraPagesCount,
    basePriceCents,
    pricePerPageCents,
    pagePriceTotalCents,
    extraPagesPriceTotalCents,
    productSubtotalCents,
    compareAtPriceCents,
    compareAtTotalCents,
  };
}

export function calculateCartPricing({
  product,
  selectedPageCount = 0,
  selectedAddOnIds = [],
  addOnQuantities = {},
}) {
  const requestedPageCount = Number.parseInt(String(selectedPageCount), 10);
  const normalizedRequestedPageCount =
    Number.isFinite(requestedPageCount) && requestedPageCount > 0 ? requestedPageCount : 0;

  if (!product) {
    return {
      currency: 'USD',
      selectedPageCount: normalizedRequestedPageCount,
      includedPagesCount: Math.min(INCLUDED_PAGES_IN_BASE, normalizedRequestedPageCount),
      extraPagesCount: Math.max(normalizedRequestedPageCount - INCLUDED_PAGES_IN_BASE, 0),
      basePriceCents: 0,
      pricePerPageCents: 0,
      pagePriceTotalCents: 0,
      extraPagesPriceTotalCents: 0,
      productSubtotalCents: 0,
      compareAtPriceCents: null,
      addOnsTotalCents: 0,
      savingsCents: null,
      totalCents: 0,
      addOns: [],
    };
  }

  const productPricing = calculateProductPricing(product, selectedPageCount);
  const selectedSet = new Set(Array.isArray(selectedAddOnIds) ? selectedAddOnIds : []);

  const addOns = (Array.isArray(product.addOns) ? product.addOns : [])
    .filter((addOn) => selectedSet.has(addOn.id))
    .map((addOn) => {
      const unitPriceCents = asNonNegativeInt(addOn.priceCents);
      const quantity = addOn.supportsQuantity
        ? normalizeQuantity(addOnQuantities[addOn.id], {
            min: asNonNegativeInt(addOn.minQuantity, 1),
            max: asNonNegativeInt(addOn.maxQuantity, 99),
          })
        : 1;
      const totalPriceCents = unitPriceCents * quantity;

      return {
        id: addOn.id,
        name: addOn.name,
        quantity,
        unitPriceCents,
        totalPriceCents,
      };
    });

  const addOnsTotalCents = addOns.reduce((sum, addOn) => sum + addOn.totalPriceCents, 0);
  const totalCents = productPricing.productSubtotalCents + addOnsTotalCents;
  const compareAtTotalCents =
    productPricing.compareAtPriceCents === null
      ? null
      : productPricing.compareAtTotalCents + addOnsTotalCents;
  const savingsCents =
    compareAtTotalCents !== null && compareAtTotalCents > totalCents
      ? compareAtTotalCents - totalCents
      : null;

  return {
    currency: 'USD',
    selectedPageCount: productPricing.selectedPageCount,
    includedPagesCount: productPricing.includedPagesCount,
    extraPagesCount: productPricing.extraPagesCount,
    basePriceCents: productPricing.basePriceCents,
    pricePerPageCents: productPricing.pricePerPageCents,
    pagePriceTotalCents: productPricing.pagePriceTotalCents,
    extraPagesPriceTotalCents: productPricing.extraPagesPriceTotalCents,
    productSubtotalCents: productPricing.productSubtotalCents,
    compareAtPriceCents: productPricing.compareAtPriceCents,
    compareAtTotalCents,
    addOnsTotalCents,
    savingsCents,
    totalCents,
    addOns,
  };
}
