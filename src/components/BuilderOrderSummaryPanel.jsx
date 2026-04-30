import { formatMoney } from '../utils/pricing';

function BuilderOrderSummaryPanel({
  selectedProduct,
  cartSummary,
  uploadedCount = 0,
}) {
  const extrasLabel = cartSummary.addOns?.length
    ? cartSummary.addOns.map((addOn) => addOn.name).join(', ')
    : 'No extras selected';

  return (
    <aside className="builder-order-summary" aria-label="Order summary">
      <div className="builder-order-summary-card">
        <div className="summary-header">
          <div>
            <p className="builder-pricing-label">Your Order</p>
            <h3>Your Order</h3>
          </div>
        </div>

        <div className="summary-book-preview">
          <span className="summary-book-image" aria-hidden="true" />
          <div className="summary-book-copy">
            <strong>{selectedProduct?.name || 'Choose a book'}</strong>
            <span>
              {cartSummary.selectedPageCount ? `${cartSummary.selectedPageCount} pages` : 'Pick a page count'}
            </span>
          </div>
          <span className="summary-book-price">
            {selectedProduct ? formatMoney(cartSummary.productSubtotalCents) : '--'}
          </span>
        </div>

        <p className="summary-line">
          <span>Extras</span>
          <strong>{extrasLabel}</strong>
        </p>
        {uploadedCount ? (
          <p className="summary-line">
            <span>Uploaded Photos</span>
            <strong>{uploadedCount}</strong>
          </p>
        ) : null}
        <p className="summary-line">
          <span>Subtotal</span>
          <strong>{selectedProduct ? formatMoney(cartSummary.productSubtotalCents) : '--'}</strong>
        </p>
        <p className="price-grand-total summary-total">
          <span>Total</span>
          <strong>{selectedProduct ? formatMoney(cartSummary.totalCents) : '--'}</strong>
        </p>
      </div>
    </aside>
  );
}

export default BuilderOrderSummaryPanel;
