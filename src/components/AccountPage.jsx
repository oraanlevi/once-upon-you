import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  new: 'Order Received',
  'in-production': 'In Production',
  completed: 'Completed',
  shipped: 'Shipped',
};

function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(iso));
}

function formatCents(cents) {
  if (typeof cents !== 'number') return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function AccountPage({ user, token, apiBase, onLogout, onClose, onShippingSaved }) {
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  // Shipping form
  const [shipping, setShipping] = useState(user?.savedShipping || {
    firstName: '', lastName: '', email: '', address: '', city: '', postalCode: '', country: '',
  });
  const [shippingSaving, setShippingSaving] = useState(false);
  const [shippingMsg, setShippingMsg] = useState('');

  useEffect(() => {
    if (activeTab !== 'orders') return;
    setOrdersLoading(true);
    fetch(`${apiBase}/api/auth/me/orders`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setOrders(Array.isArray(data.orders) ? data.orders : []))
      .catch(() => setOrders([]))
      .finally(() => setOrdersLoading(false));
  }, [activeTab, apiBase, token]);

  const handleShippingChange = (field, val) => {
    setShipping((prev) => ({ ...prev, [field]: val }));
    setShippingMsg('');
  };

  const handleShippingSave = async (e) => {
    e.preventDefault();
    setShippingSaving(true);
    setShippingMsg('');
    try {
      const res = await fetch(`${apiBase}/api/auth/me/shipping`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(shipping),
      });
      const data = await res.json();
      if (!res.ok) { setShippingMsg(data.error || 'Failed to save.'); return; }
      setShippingMsg('Saved!');
      if (onShippingSaved) onShippingSaved(data.user?.savedShipping);
    } catch {
      setShippingMsg('Failed to save. Please try again.');
    } finally {
      setShippingSaving(false);
    }
  };

  const displayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Account';

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="account-modal" onClick={(e) => e.stopPropagation()}>
        <div className="account-modal-header">
          <div className="account-modal-user">
            <div className="account-avatar">{displayName.charAt(0).toUpperCase()}</div>
            <div>
              <div className="account-name">{displayName}</div>
              <div className="account-email">{user?.email}</div>
            </div>
          </div>
          <div className="account-modal-actions">
            <button type="button" className="account-logout-btn" onClick={onLogout}>Log out</button>
            <button type="button" className="account-close-btn" onClick={onClose} aria-label="Close">×</button>
          </div>
        </div>

        <div className="account-tabs">
          <button
            type="button"
            className={`account-tab${activeTab === 'orders' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            My Orders
          </button>
          <button
            type="button"
            className={`account-tab${activeTab === 'shipping' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            Saved Shipping
          </button>
        </div>

        <div className="account-tab-content">
          {activeTab === 'orders' && (
            ordersLoading ? (
              <p className="account-empty">Loading your orders…</p>
            ) : orders.length === 0 ? (
              <p className="account-empty">No orders yet. Start building your book!</p>
            ) : (
              <div className="account-orders">
                {orders.map((order) => (
                  <div key={order.orderId} className="account-order-card">
                    <div className="account-order-top">
                      <div>
                        <div className="account-order-id">#{order.orderId}</div>
                        <div className="account-order-date">{formatDate(order.createdAt)}</div>
                      </div>
                      <span className={`account-order-status status-${order.status}`}>
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </div>
                    <div className="account-order-detail">
                      <span>{order.product?.name || 'Custom Book'}</span>
                      <span>{order.pageCount} pages</span>
                      {order.pricing?.totalCents ? (
                        <span>{formatCents(order.pricing.totalCents)}</span>
                      ) : null}
                    </div>
                    {order.shipping?.address && (
                      <div className="account-order-shipping">
                        Ships to: {order.shipping.address}, {order.shipping.city} {order.shipping.postalCode}
                      </div>
                    )}
                    {order.deliveryEstimate && (
                      <div className="account-order-delivery">Est. delivery: {order.deliveryEstimate}</div>
                    )}
                  </div>
                ))}
              </div>
            )
          )}

          {activeTab === 'shipping' && (
            <form className="account-shipping-form" onSubmit={handleShippingSave}>
              <div className="auth-form-row">
                <div className="auth-field">
                  <label className="auth-label">First name</label>
                  <input className="auth-input" value={shipping.firstName || ''} onChange={(e) => handleShippingChange('firstName', e.target.value)} placeholder="Jane" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Last name</label>
                  <input className="auth-input" value={shipping.lastName || ''} onChange={(e) => handleShippingChange('lastName', e.target.value)} placeholder="Smith" />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Email</label>
                <input className="auth-input" type="email" value={shipping.email || ''} onChange={(e) => handleShippingChange('email', e.target.value)} placeholder="you@example.com" />
              </div>
              <div className="auth-field">
                <label className="auth-label">Address</label>
                <input className="auth-input" value={shipping.address || ''} onChange={(e) => handleShippingChange('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="auth-form-row">
                <div className="auth-field">
                  <label className="auth-label">City</label>
                  <input className="auth-input" value={shipping.city || ''} onChange={(e) => handleShippingChange('city', e.target.value)} placeholder="New York" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Postal code</label>
                  <input className="auth-input" value={shipping.postalCode || ''} onChange={(e) => handleShippingChange('postalCode', e.target.value)} placeholder="10001" />
                </div>
              </div>
              <div className="auth-field">
                <label className="auth-label">Country</label>
                <input className="auth-input" value={shipping.country || ''} onChange={(e) => handleShippingChange('country', e.target.value)} placeholder="United States" />
              </div>
              {shippingMsg && (
                <p className={`auth-error${shippingMsg === 'Saved!' ? ' auth-success' : ''}`}>{shippingMsg}</p>
              )}
              <button type="submit" className="auth-submit" disabled={shippingSaving}>
                {shippingSaving ? 'Saving…' : 'Save Shipping Details'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default AccountPage;
