import { useMemo, useState } from 'react';
import {
  calculateProductPricing,
  formatMoney,
  normalizeAvailablePageCounts,
} from '../utils/pricing';

const PRODUCT_PRESENTATION = {
  'digital-book': {
    shortLine: 'Instant download coloring book',
    visualClass: 'digital',
    emoji: '🎨',
  },
  'pocket-book': {
    shortLine: 'Petite printed keepsake',
    visualClass: 'pocket',
    emoji: '🌸',
  },
  'large-book': {
    shortLine: 'Classic giftable format',
    visualClass: 'large',
    recommendation: 'Most Popular',
    emoji: '⭐',
  },
  'premium-keepsake-book': {
    shortLine: 'Our most elevated edition.',
    visualClass: 'premium',
    emoji: '👑',
    perks: ['Premium thick art paper', 'Glossy laminated cover included', '10% off your next order'],
  },
};

const FEATURED_ADDON_IDS = ['digital-download', 'gift-wrap', 'custom-cover-photo', 'coloring-pencil-set', 'rush-order'];

const ADDON_GROUPS = [
  { label: '🎁 Make it a Gift', ids: ['gift-wrap', 'greeting-card', 'dedication-page'] },
  { label: '✨ Personalize It', ids: ['custom-name', 'custom-cover-photo', 'protective-sleeve'] },
  { label: '⚡ Get It Faster', ids: ['rush-order', 'additional-copy'] },
];

function getProductPresentation(product) {
  return PRODUCT_PRESENTATION[product?.id] || {
    shortLine: product?.description || 'A personalized storybook made just for your family.',
    visualClass: 'large',
    emoji: '📚',
  };
}

function ChooseBook({
  products,
  selectedProductId,
  selectedPageCount,
  selectedAddOnIds,
  addOnQuantities,
  cartSummary,
  onSelectProduct,
  onSelectPageCount,
  onContinueToUploads,
  onToggleAddOn,
  onAddOnQuantityChange,
}) {
  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) || products[0] || null,
    [products, selectedProductId],
  );
  const bundleProducts = useMemo(() => {
    const preferredOrder = ['digital-book', 'pocket-book', 'large-book', 'premium-keepsake-book'];
    const byId = new Map(products.map((product) => [product.id, product]));
    const preferred = preferredOrder.map((id) => byId.get(id)).filter(Boolean);
    if (preferred.length >= 4) return preferred.slice(0, 4);
    return products.slice(0, 4);
  }, [products]);

  const [showMoreAddons, setShowMoreAddons] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedAddOnIds), [selectedAddOnIds]);
  const selectedPageOptions = normalizeAvailablePageCounts(selectedProduct?.availablePageCounts);
  const summaryAddOnsLabel = cartSummary.addOns.length
    ? cartSummary.addOns.map((addOn) => addOn.name).join(', ')
    : 'No extras selected';

  return (
    <section className="builder-intro" aria-labelledby="choose-book-title">
      <div className="builder-card">
        <div className="choose-page-layout">
          <div className="choose-page-main">
            <div className="choose-book-hero choose-top--focused">
              <p className="builder-eyebrow">Step 1 of 3</p>
              <h2 id="choose-book-title">Choose your format</h2>
            </div>

            <div className="chapter-control-stack">
              <section className="builder-panel builder-panel-books" aria-labelledby="book-selection-title">
                <div className="builder-section-head">
                  <span className="builder-step-number">1</span>
                  <div>
                    <p className="builder-pricing-label">Choose a book</p>
                    <h3 id="book-selection-title">Pick the type of book that fits your story best.</h3>
                  </div>
                </div>

                <div className="product-grid product-grid--three" role="list" aria-label="Product options">
                  {bundleProducts.slice(0, 3).map((product) => {
                    const isSelected = product.id === selectedProduct?.id;
                    const previewPricing = calculateProductPricing(product);
                    const presentation = getProductPresentation(product);
                    const recommendation = presentation.recommendation || (product.id === 'large-book' ? 'Most Popular' : '');

                    return (
                      <button
                        type="button"
                        className={`product-card ${isSelected ? 'is-selected' : ''}`}
                        key={product.id}
                        role="listitem"
                        onClick={() => onSelectProduct(product.id)}
                      >
                        <span className={`product-card-visual product-card-visual--${presentation.visualClass}`}>
                          {recommendation ? (
                            <span className="product-card-flag">{recommendation}</span>
                          ) : null}
                          <span className="book-mockup" aria-hidden="true">
                            <span className="book-mockup-emoji">{presentation.emoji}</span>
                            <span className="book-mockup-cover" />
                            <span className="book-mockup-pages" />
                            <span className="book-mockup-charm" />
                          </span>
                        </span>
                        <span className="product-card-copy">
                          <strong className="product-card-title">{product.name}</strong>
                          <span className="product-card-description">{presentation.shortLine}</span>
                          {presentation.perks && (
                            <ul className="product-card-perks">
                              {presentation.perks.map((perk) => (
                                <li key={perk}><span className="perk-check">✓</span>{perk}</li>
                              ))}
                            </ul>
                          )}
                          <span className="product-card-price-row">
                            <span className="product-card-price">
                              {`Starts at ${formatMoney(previewPricing.productSubtotalCents)}`}
                            </span>
                          </span>
                        </span>
                        {isSelected ? <span className="product-card-check">✓</span> : null}
                      </button>
                    );
                  })}
                  {!products.length ? (
                    <p className="generation-error">No products are available yet.</p>
                  ) : null}
                </div>
              </section>

              {selectedProduct ? (
                <section className="builder-panel builder-panel-customize" aria-labelledby="page-customization-title">
                  <div className="builder-section-head">
                    <span className="builder-step-number">2</span>
                    <div>
                      <p className="builder-pricing-label">Select page count</p>
                      <h3 id="page-customization-title">How many pages would you like?</h3>
                    </div>
                  </div>

                  <div className="builder-options builder-options--pills" role="list" aria-label="Page count options">
                    {selectedPageOptions.map((pageCount) => {
                      const isPopular = pageCount === 15;
                      return (
                        <button
                          type="button"
                          className={`builder-option ${selectedPageCount === pageCount ? 'is-selected' : ''} ${isPopular ? 'builder-option--popular' : ''}`}
                          key={pageCount}
                          role="listitem"
                          onClick={() => onSelectPageCount(Number(pageCount))}
                        >
                          {isPopular && <span className="option-popular-badge">Most Popular · Best for gifts</span>}
                          <span className="option-main">{`${pageCount} Pages`}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="builder-tip">Tip: More pages = more memories to color.</p>
                </section>
              ) : null}

              {selectedProduct ? (
                <section className="builder-panel builder-panel-addons" aria-labelledby="add-ons-title">
                  <div className="builder-section-head">
                    <div>
                      <p className="builder-pricing-label">Optional add-ons</p>
                      <h3 id="add-ons-title">Add Extras</h3>
                    </div>
                  </div>

                  {/* Featured add-ons — always visible */}
                  <div className="addon-grid addon-grid--two" role="list" aria-label="Optional add-ons">
                    {(selectedProduct.addOns || [])
                      .filter((a) => FEATURED_ADDON_IDS.includes(a.id))
                      .sort((a, b) => FEATURED_ADDON_IDS.indexOf(a.id) - FEATURED_ADDON_IDS.indexOf(b.id))
                      .map((addOn) => {
                        const isChecked = selectedSet.has(addOn.id);
                        const quantity = addOn.supportsQuantity
                          ? addOnQuantities[addOn.id] || addOn.defaultQuantity || 1
                          : 1;
                        return (
                          <label className={`addon-card ${isChecked ? 'is-selected' : ''}`} key={addOn.id} role="listitem">
                            <span className="addon-check"><input type="checkbox" checked={isChecked} onChange={() => onToggleAddOn(addOn.id)} /></span>
                            <span className="addon-meta"><strong>{addOn.name}</strong><span>{addOn.description}</span></span>
                            <span className="addon-price">{formatMoney(addOn.priceCents)}</span>
                            {addOn.supportsQuantity && isChecked ? (
                              <span className="addon-qty" onClick={(e) => e.preventDefault()}>
                                <button type="button" onClick={() => onAddOnQuantityChange(addOn.id, quantity - 1)} disabled={quantity <= addOn.minQuantity} aria-label={`Reduce ${addOn.name} quantity`}>-</button>
                                <strong>{quantity}</strong>
                                <button type="button" onClick={() => onAddOnQuantityChange(addOn.id, quantity + 1)} disabled={quantity >= addOn.maxQuantity} aria-label={`Increase ${addOn.name} quantity`}>+</button>
                              </span>
                            ) : null}
                          </label>
                        );
                      })}
                  </div>

                  {/* More options — grouped */}
                  {!showMoreAddons ? (
                    <button type="button" className="addon-more-btn" onClick={() => setShowMoreAddons(true)}>
                      + More options
                    </button>
                  ) : (
                    <div className="addon-extra-groups">
                      {ADDON_GROUPS.map((group) => {
                        const groupAddons = (selectedProduct.addOns || []).filter(
                          (a) => group.ids.includes(a.id) && !FEATURED_ADDON_IDS.includes(a.id)
                        );
                        if (!groupAddons.length) return null;
                        return (
                          <div key={group.label} className="addon-group">
                            <p className="addon-group-label">{group.label}</p>
                            <div className="addon-grid addon-grid--two">
                              {groupAddons.map((addOn) => {
                                const isChecked = selectedSet.has(addOn.id);
                                const quantity = addOn.supportsQuantity
                                  ? addOnQuantities[addOn.id] || addOn.defaultQuantity || 1
                                  : 1;
                                return (
                                  <label className={`addon-card ${isChecked ? 'is-selected' : ''}`} key={addOn.id} role="listitem">
                                    <span className="addon-check"><input type="checkbox" checked={isChecked} onChange={() => onToggleAddOn(addOn.id)} /></span>
                                    <span className="addon-meta"><strong>{addOn.name}</strong><span>{addOn.description}</span></span>
                                    <span className="addon-price">{formatMoney(addOn.priceCents)}</span>
                                    {addOn.supportsQuantity && isChecked ? (
                                      <span className="addon-qty" onClick={(e) => e.preventDefault()}>
                                        <button type="button" onClick={() => onAddOnQuantityChange(addOn.id, quantity - 1)} disabled={quantity <= addOn.minQuantity} aria-label={`Reduce ${addOn.name} quantity`}>-</button>
                                        <strong>{quantity}</strong>
                                        <button type="button" onClick={() => onAddOnQuantityChange(addOn.id, quantity + 1)} disabled={quantity >= addOn.maxQuantity} aria-label={`Increase ${addOn.name} quantity`}>+</button>
                                      </span>
                                    ) : null}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                      <button type="button" className="addon-more-btn addon-more-btn--less" onClick={() => setShowMoreAddons(false)}>
                        − Show less
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
            </div>

            {selectedProduct ? (
              <section className="price-totals-card order-summary-card choose-order-section" aria-live="polite">
                <div className="summary-header">
                  <div>
                    <p className="builder-pricing-label">Your Order</p>
                    <h3>Your Order</h3>
                  </div>
                </div>
                <p className="summary-line">
                  <span>Extras</span>
                  <strong>{summaryAddOnsLabel}</strong>
                </p>
                <p className="summary-line">
                  <span>Subtotal</span>
                  <strong>{formatMoney(cartSummary.productSubtotalCents)}</strong>
                </p>
                <p className="price-grand-total summary-total">
                  <span>Total</span>
                  <strong>{formatMoney(cartSummary.totalCents)}</strong>
                </p>
              </section>
            ) : null}

            {selectedProduct ? (
              <div className="choose-page-footer-cta">
                <button
                  type="button"
                  className="create-book-button builder-cta-button"
                  onClick={onContinueToUploads}
                  disabled={!selectedProduct || !selectedPageCount}
                >
                  Start Creating Your Book →
                </button>
                <p className="builder-cta-note">
                  Next chapter: add your favorite photos so we can begin building your keepsake.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default ChooseBook;
