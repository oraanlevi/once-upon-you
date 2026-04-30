import { useEffect, useState } from 'react';

const STATUS_STEPS = [
  { key: 'new', label: 'Order Received', desc: 'We have your order and are preparing it for production.' },
  { key: 'in-production', label: 'In Production', desc: 'Our illustrators are working on your coloring pages.' },
  { key: 'completed', label: 'Ready to Ship', desc: 'Your book is printed and packaged.' },
  { key: 'shipped', label: 'Shipped', desc: 'Your book is on its way!' },
];

const STATUS_ORDER = ['new', 'in-production', 'completed', 'shipped'];

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function OrderStatusPage({ orderId, apiBase, onBack }) {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    fetch(`${apiBase}/api/orders/${orderId}/status`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) { setError(data.error); return; }
        setOrder(data);
      })
      .catch(() => setError('Unable to load order. Please try again.'))
      .finally(() => setLoading(false));
  }, [orderId, apiBase]);

  const currentStatusIdx = order ? STATUS_ORDER.indexOf(order.status) : -1;

  return (
    <div className="order-status-page">
      <button type="button" className="order-status-back" onClick={onBack}>
        ← Back
      </button>

      <div className="order-status-card">
        {loading && <p className="order-status-loading">Looking up your order…</p>}

        {error && (
          <div className="order-status-error">
            <p>{error}</p>
            <p style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>Order ID: {orderId}</p>
          </div>
        )}

        {order && (
          <>
            <div className="order-status-header">
              <div className="order-status-icon" aria-hidden="true">📦</div>
              <h1 className="order-status-title">Order #{order.orderId}</h1>
              <p className="order-status-date">Placed {formatDate(order.createdAt)}</p>
              {order.shipping?.firstName && (
                <p className="order-status-name">
                  For {order.shipping.firstName}{order.shipping.city ? `, shipping to ${order.shipping.city}` : ''}
                </p>
              )}
            </div>

            <div className="order-status-tracker">
              {STATUS_STEPS.map((step, idx) => {
                const isDone = idx < currentStatusIdx;
                const isCurrent = idx === currentStatusIdx;
                return (
                  <div key={step.key} className={`status-step${isDone ? ' is-done' : isCurrent ? ' is-current' : ''}`}>
                    <div className="status-step-dot">
                      {isDone ? (
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
                          <path d="M1 4l3 3L9 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      ) : null}
                    </div>
                    <div className="status-step-body">
                      <div className="status-step-label">{step.label}</div>
                      {isCurrent && <div className="status-step-desc">{step.desc}</div>}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="order-status-details">
              {order.product?.name && (
                <div className="order-detail-row">
                  <span>Product</span><span>{order.product.name}</span>
                </div>
              )}
              <div className="order-detail-row">
                <span>Pages</span><span>{order.pageCount}</span>
              </div>
              {order.deliveryEstimate && (
                <div className="order-detail-row">
                  <span>Est. delivery</span><span>{order.deliveryEstimate}</span>
                </div>
              )}
            </div>

            <p className="order-status-help">
              Questions? Email us at{' '}
              <a href="mailto:twiceuponus@gmail.com">twiceuponus@gmail.com</a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default OrderStatusPage;
