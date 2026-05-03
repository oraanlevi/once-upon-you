function OrderSuccess({
  orderNumber,
  deliveryEstimate,
  supportEmail,
  onStartOver,
  onReturnHome,
}) {
  return (
    <section className="order-success-step" aria-live="polite">
      <div className="order-success-card">
        <p className="builder-eyebrow">Order confirmed</p>
        <h2>Thank you for your order!</h2>
        <p className="success-magic-text">
          Your personalized coloring book is on its way.
        </p>
        <p className="success-support-note">
          We'll have your book ready and shipped within 5 business days. You'll receive a confirmation email shortly.
        </p>

        <div className="success-meta">
          <p>
            <span>Order Number</span>
            <strong>{orderNumber}</strong>
          </p>
          <p>
            <span>Estimated Shipping</span>
            <strong>Within 5 business days</strong>
          </p>
          <p>
            <span>Questions?</span>
            <strong>{supportEmail}</strong>
          </p>
        </div>

        <div className="success-actions">
          <button type="button" className="upload-back" onClick={onReturnHome}>
            Return Home
          </button>
          <button type="button" className="create-book-button" onClick={onStartOver}>
            Start Another Book
          </button>
        </div>
      </div>
    </section>
  );
}

export default OrderSuccess;
