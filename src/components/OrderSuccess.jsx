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
        <p className="builder-eyebrow">Order received</p>
        <h2>Order received</h2>
        <p className="success-magic-text">
          Your memories are now becoming a coloring book.
        </p>
        <p className="success-support-note">
          We'll send progress updates to your email as your personalized pages are
          prepared.
        </p>

        <div className="success-meta">
          <p>
            <span>Order Number</span>
            <strong>{orderNumber}</strong>
          </p>
          <p>
            <span>Delivery Estimate</span>
            <strong>{deliveryEstimate}</strong>
          </p>
          <p>
            <span>Support</span>
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
