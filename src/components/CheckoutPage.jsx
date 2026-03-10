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
  onFieldChange,
  onBack,
  onProceed,
  isProcessingPayment,
  paymentError,
}) {
  return (
    <section className="checkout-step" aria-labelledby="checkout-title">
      <div className="checkout-shell">
        <div className="checkout-top">
          <button type="button" className="upload-back" onClick={onBack}>
            Back to Preview
          </button>
          <p className="builder-eyebrow">Chapter 5</p>
          <h2 id="checkout-title">Finalize Your Order</h2>
        </div>

        <div className="checkout-layout">
          <aside className="order-summary">
            <h3>Order Summary</h3>
            <p className="summary-line summary-product">
              <span>Product</span>
              <strong>Custom Once Upon You Coloring Book</strong>
            </p>
            <p className="summary-line">
              <span>Pages</span>
              <strong>{pageCount}</strong>
            </p>
            <p className="summary-line">
              <span>Uploaded Photos</span>
              <strong>{uploadedCount}</strong>
            </p>
            <p className="summary-delivery">Estimated delivery: {deliveryEstimate}</p>
          </aside>

          <form className="checkout-form" onSubmit={onProceed}>
            {paymentError ? <p className="generation-error">{paymentError}</p> : null}
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
                    onChange={(event) =>
                      onFieldChange(field.name, event.target.value)
                    }
                  />
                </label>
              ))}
            </div>

            <div className="checkout-actions">
              <button
                type="submit"
                className="create-book-button payment-button"
                disabled={isProcessingPayment}
              >
                {isProcessingPayment ? 'Processing Payment...' : 'Proceed to Payment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}

export default CheckoutPage;
