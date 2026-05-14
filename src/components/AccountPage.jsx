import { useEffect, useState } from 'react';

const STATUS_LABELS = {
  new: 'Order Received',
  'in-production': 'In Production',
  completed: 'Completed',
  shipped: 'Shipped',
};

const STATUS_COLORS = {
  new: 'status-new',
  'in-production': 'status-in-production',
  completed: 'status-completed',
  shipped: 'status-shipped',
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
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <section className="account-inline-page">

      {/* ── Top bar ── */}
      <div className="account-inline-topbar">
        <button type="button" className="account-inline-back" onClick={onClose}>
          ← Back
        </button>
        <h1 className="account-inline-title">My Account</h1>
        <button type="button" className="account-logout-inline" onClick={onLogout}>
          Log out
        </button>
      </div>

      <div className="account-inline-body">

        {/* ── Greeting ── */}
        <div className="account-greeting">
          <h2 className="account-greeting-text">Hi, {user?.firstName || displayName}</h2>
          <p className="account-greeting-email">{user?.email}</p>
        </div>

        {/* ── Tabs ── */}
        <div className="account-inline-tabs">
          <button
            type="button"
            className={`account-inline-tab${activeTab === 'orders' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
            My Orders
          </button>
          <button
            type="button"
            className={`account-inline-tab${activeTab === 'shipping' ? ' is-active' : ''}`}
            onClick={() => setActiveTab('shipping')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Saved Shipping
          </button>
        </div>

        {/* ── Orders ── */}
        {activeTab === 'orders' && (
          ordersLoading ? (
            <div className="account-loading">
              <div className="account-loading-spinner" />
              <p>Loading your orders…</p>
            </div>
          ) : orders.length === 0 ? (
            <div className="account-empty-state">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(116,70,149,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
              <h3>No orders yet</h3>
              <p>Your orders will show up here once you place one.</p>
              <button type="button" className="account-cta-btn" onClick={onClose}>
                Start Building →
              </button>
            </div>
          ) : (
            <div className="account-orders-grid">
              {orders.map((order) => (
                <div key={order.orderId} className="account-order-card">
                  <div className="account-order-top">
                    <div>
                      <div className="account-order-id">#{order.orderId}</div>
                      <div className="account-order-date">{formatDate(order.createdAt)}</div>
                    </div>
                    <span className={`account-order-status ${STATUS_COLORS[order.status] || ''}`}>
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                  </div>
                  <div className="account-order-product">
                    <span className="account-order-product-name">{order.product?.name || 'Custom Book'}</span>
                    <span className="account-order-product-meta">{order.pageCount} pages</span>
                  </div>
                  <div className="account-order-footer">
                    {order.shipping?.address && (
                      <span className="account-order-shipping">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        {order.shipping.city}, {order.shipping.postalCode}
                      </span>
                    )}
                    {order.deliveryEstimate && (
                      <span className="account-order-delivery">Est. {order.deliveryEstimate}</span>
                    )}
                    {order.pricing?.totalCents ? (
                      <span className="account-order-total">{formatCents(order.pricing.totalCents)}</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── Shipping ── */}
        {activeTab === 'shipping' && (
          <div className="account-shipping-section">
            <form className="account-shipping-form" onSubmit={handleShippingSave}>
              <div className="auth-field-row">
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
                <label className="auth-label">Street address</label>
                <input className="auth-input" value={shipping.address || ''} onChange={(e) => handleShippingChange('address', e.target.value)} placeholder="123 Main St" />
              </div>
              <div className="auth-field-row">
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
                <p className={shippingMsg === 'Saved!' ? 'account-save-success' : 'auth-error'}>{shippingMsg}</p>
              )}
              <button type="submit" className="auth-submit" disabled={shippingSaving}>
                {shippingSaving ? 'Saving…' : 'Save Shipping Details'}
              </button>
            </form>
          </div>
        )}

      </div>
    </section>
  );
}

export default AccountPage;
