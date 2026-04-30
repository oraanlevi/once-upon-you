import { useMemo } from 'react';
import { Elements } from '@stripe/react-stripe-js';
import { formatMoney, PRODUCT_TYPE_LABELS } from '../utils/pricing';
import CheckoutPaymentForm from './CheckoutPaymentForm';

const fields = [
  { name: 'firstName', label: 'First Name', type: 'text', autoComplete: 'given-name' },
  { name: 'lastName', label: 'Last Name', type: 'text', autoComplete: 'family-name' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'address', label: 'Address', type: 'text', autoComplete: 'street-address' },
  { name: 'city', label: 'City', type: 'text', autoComplete: 'address-level2' },
  { name: 'postalCode', label: 'Postal Code', type: 'text', autoComplete: 'postal-code' },
  { name: 'country', label: 'Country', type: 'text', autoComplete: 'country-name' },
];

function CheckoutPage({
  pageCount,
  uploadedCount,
  deliveryEstimate,
  shippingData,
  selectedProduct,
  cartSummary,
  onFieldChange,
  onBack,
  onContinueToPayment,
  onCompletePaidOrder,
  isPaymentStep,
  isProcessingPayment,
  paymentError,
  paymentClientSecret,
  isPreparingPayment,
  paymentSetupError,
  stripePromise,
  isGeneratingPreview,
  previewReady,
  previewStatusText,
  previewError,
  onReviewPreview,
  onRequestPreview,
  backLabel,
  promoCode,
  promoResult,
  promoError,
  promoLoading,
  onPromoCodeChange,
  onPromoApply,
  onPromoRemove,
}) {
  const elementsOptions = useMemo(
    () => ({
      clientSecret: paymentClientSecret,
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#744695',
          colorText: '#1c141f',
          colorTextSecondary: '#4f4255',
          colorBackground: '#fffdf8',
          colorDanger: '#9b2c2c',
          borderRadius: '14px',
        },
      },
    }),
    [paymentClientSecret],
  );
  const isShippingComplete = fields.every((field) => String(shippingData?.[field.name] || '').trim());

  return (
    <section className="checkout-step" aria-labelledby="checkout-title">
      <div className="checkout-shell checkout-shell--focused">
        <div className="checkout-top checkout-top--focused">
          <button type="button" className="upload-back" onClick={onBack}>
            {backLabel || 'Back'}
          </button>
          <p className="builder-eyebrow">Chapter 5</p>
          <h2 id="checkout-title">{isPaymentStep ? 'Complete payment.' : 'Checkout details.'}</h2>
          <p className="builder-lede checkout-intro">
            {isPaymentStep
              ? 'Review your payment details and pay securely with Stripe.'
              : 'Review your order and enter shipping information before payment.'}
          </p>
        </div>

        <div className={`preview-status-panel${previewReady ? ' is-ready' : ''}`}>
          <p className="preview-status-eyebrow">
            {previewReady
              ? 'Sample preview ready'
              : isGeneratingPreview
                ? 'Sample preview generating'
                : 'Sample preview'}
          </p>
          <h3>
            {previewReady
              ? 'Your sample preview is ready to view.'
              : isGeneratingPreview
                ? 'Your sample preview is being prepared.'
                : 'Want a quick look before the full book is prepared?'}
          </h3>
          <p className="preview-status-copy">
            {previewReady
              ? 'Review one generated sample page, or skip it and continue checkout normally.'
              : isGeneratingPreview
                ? 'This can take a few minutes. You can continue filling out your information while we prepare the sample.'
                : 'Preview one sample page from your uploaded photos. This is completely optional.'}
          </p>
          {isGeneratingPreview && previewStatusText ? (
            <p className="preview-status-progress">{previewStatusText}</p>
          ) : null}
          {!isGeneratingPreview && previewError ? (
            <p className="preview-status-progress">{previewError}</p>
          ) : null}
          <div className="preview-status-actions">
            {previewReady ? (
              <button
                type="button"
                className="upload-back preview-ready-button"
                onClick={onReviewPreview}
              >
                Preview One Page
              </button>
            ) : (
              <button
                type="button"
                className="upload-back preview-ready-button"
                onClick={onRequestPreview}
                disabled={isGeneratingPreview}
              >
                {isGeneratingPreview ? 'Preparing Preview...' : 'Preview One Page'}
              </button>
            )}
          </div>
        </div>

        <div className="checkout-layout">
          <aside className="order-summary">
            <h3>Order Summary</h3>
            <p className="summary-line summary-product">
              <span>Book Type</span>
              <strong>{selectedProduct?.name || 'Custom Twice Upon Us Coloring Book'}</strong>
            </p>
            <p className="summary-line">
              <span>Category</span>
              <strong>
                {selectedProduct
                  ? PRODUCT_TYPE_LABELS[selectedProduct.productType] || selectedProduct.productType
                  : 'Custom Personalized Product'}
              </strong>
            </p>
            <p className="summary-line">
              <span>Page Count</span>
              <strong>{`${cartSummary.selectedPageCount || pageCount} pages`}</strong>
            </p>
            <p className="summary-line">
              <span>{`Base Book (${selectedProduct?.name || 'Selected Book'})`}</span>
              <strong>{formatMoney(cartSummary.basePriceCents)}</strong>
            </p>
            <p className="summary-line">
              <span>{`Extra Pages (${cartSummary.extraPagesCount} x ${formatMoney(
                cartSummary.pricePerPageCents,
              )})`}</span>
              <strong>{formatMoney(cartSummary.extraPagesPriceTotalCents)}</strong>
            </p>
            <p className="summary-line">
              <span>Add-ons</span>
              <strong>{formatMoney(cartSummary.addOnsTotalCents)}</strong>
            </p>
            {cartSummary.addOns.map((addOn) => (
              <p className="summary-line" key={addOn.id}>
                <span>{`${addOn.name}${addOn.quantity > 1 ? ` x${addOn.quantity}` : ''}`}</span>
                <strong>{formatMoney(addOn.totalPriceCents)}</strong>
              </p>
            ))}
            {uploadedCount ? (
              <p className="summary-line">
                <span>Uploaded Photos</span>
                <strong>{uploadedCount}</strong>
              </p>
            ) : null}
            {cartSummary.compareAtTotalCents ? (
              <p className="summary-line">
                <span>Compare-at</span>
                <strong className="summary-compare">{formatMoney(cartSummary.compareAtTotalCents)}</strong>
              </p>
            ) : null}
            {promoResult ? (
              <p className="summary-line summary-discount">
                <span>Promo ({promoResult.code})</span>
                <strong>−{formatMoney(promoResult.discountCents)}</strong>
              </p>
            ) : null}
            <p className="summary-line">
              <span>Shipping</span>
              <strong className="summary-free-shipping">Free shipping included</strong>
            </p>
            <p className="summary-line summary-total">
              <span>Total</span>
              <strong>{formatMoney(promoResult ? Math.max(0, cartSummary.totalCents - promoResult.discountCents) : cartSummary.totalCents)}</strong>
            </p>

            {!isPaymentStep && (
              <div className="promo-code-row">
                {promoResult ? (
                  <div className="promo-applied">
                    <span>🎉 <strong>{promoResult.code}</strong> applied — {promoResult.description || `${promoResult.type === 'percent' ? `${promoResult.value}% off` : `$${(promoResult.value / 100).toFixed(2)} off`}`}</span>
                    <button type="button" className="promo-remove" onClick={onPromoRemove}>Remove</button>
                  </div>
                ) : (
                  <div className="promo-input-row">
                    <input
                      className="promo-input"
                      type="text"
                      placeholder="Promo code"
                      value={promoCode}
                      onChange={(e) => onPromoCodeChange(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && onPromoApply(promoCode)}
                    />
                    <button
                      type="button"
                      className="promo-apply-btn"
                      onClick={() => onPromoApply(promoCode)}
                      disabled={promoLoading || !promoCode.trim()}
                    >
                      {promoLoading ? '…' : 'Apply'}
                    </button>
                  </div>
                )}
                {promoError && <p className="promo-error">{promoError}</p>}
              </div>
            )}

            <p className="summary-delivery">Estimated delivery: {deliveryEstimate}</p>
          </aside>

          <div className="checkout-payment-pane">
            {!isPaymentStep ? (
              <form className="checkout-form" onSubmit={(event) => event.preventDefault()}>
                <div className="form-grid">
                  {fields.map((field) => (
                    <label className="field-group" key={field.name}>
                      <span>{field.label}</span>
                      <input
                        required
                        name={field.name}
                        type={field.type}
                        autoComplete={field.autoComplete}
                        value={shippingData[field.name]}
                        onChange={(event) => onFieldChange(field.name, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
                <div className="checkout-actions">
                  <button
                    type="button"
                    className="create-book-button payment-button"
                    onClick={onContinueToPayment}
                    disabled={!isShippingComplete}
                  >
                    Continue to Payment
                  </button>
                </div>
              </form>
            ) : null}

            {isPaymentStep && isPreparingPayment ? (
              <section className="payment-setup-message" aria-live="polite">
                <h3>Preparing secure payment</h3>
                <p>Loading Stripe so customers can pay here without leaving your site.</p>
              </section>
            ) : null}

            {isPaymentStep && !isPreparingPayment && paymentSetupError ? (
              <section className="payment-setup-message" aria-live="polite">
                <h3>Payment setup required</h3>
                <p>{paymentSetupError}</p>
              </section>
            ) : null}

            {isPaymentStep &&
            !isPreparingPayment &&
            !paymentSetupError &&
            stripePromise &&
            paymentClientSecret ? (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <CheckoutPaymentForm
                  shippingData={shippingData}
                  onCompletePaidOrder={onCompletePaidOrder}
                  cartSummary={cartSummary}
                  isProcessingPayment={isProcessingPayment}
                  processingLabel={previewStatusText || undefined}
                  paymentError={paymentError}
                />
              </Elements>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CheckoutPage;
