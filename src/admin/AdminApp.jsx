import { useEffect, useState } from 'react';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001').trim().replace(/\/+$/, '');
const TOKEN_KEY = 'ouy_admin_token';

const THEME_LABELS = {
  'beach-days': 'Beach Days',
  'best-friends': 'Best Friends',
  'love-story': 'Love Story',
  'pet-memories': 'Pet Memories',
  'baby-family': 'Family',
  'travel-story': 'Travel Story',
  'mood-board': 'Mood Board',
};

const STATUS_COLORS = {
  new: '#6366f1',
  'in-production': '#f59e0b',
  completed: '#10b981',
  shipped: '#3b82f6',
};

const STATUS_LABELS = {
  new: 'New',
  'in-production': 'In Production',
  completed: 'Completed',
  shipped: 'Shipped',
};

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatMoney(cents) {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed.');
      sessionStorage.setItem(TOKEN_KEY, data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.loginWrap}>
      <div style={styles.loginCard}>
        <div style={styles.loginLogo}>🔐</div>
        <h1 style={styles.loginTitle}>Twice Upon Us</h1>
        <p style={styles.loginSub}>Admin Portal</p>
        <form onSubmit={submit} style={styles.loginForm}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={styles.loginInput}
            autoFocus
            required
          />
          {error && <p style={styles.loginError}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.loginBtn}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Order row ────────────────────────────────────────────────────────────────

function imgSrc(API, orderId, type, file, token) {
  return `${API}/api/admin/orders/${orderId}/image/${type}/${file}?token=${token}`;
}

async function downloadImage(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
  } catch {
    window.open(url, '_blank');
  }
}

function OrderRow({ order, token, onStatusChange }) {
  const [status, setStatus] = useState(order.status || 'new');
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateMsg, setGenerateMsg] = useState('');
  const [orderData, setOrderData] = useState(order);

  const triggerGenerate = async () => {
    setGenerating(true);
    setGenerateMsg('Starting generation…');
    try {
      const res = await fetch(`${API}/api/admin/orders/${order.orderId}/generate`, {
        method: 'POST',
        headers: { 'x-admin-token': token },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setGenerateMsg(`${data.message} Refresh in a few minutes to see results.`);
    } catch (err) {
      setGenerateMsg(`Error: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  const updateStatus = async (newStatus) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/admin/orders/${order.orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
        onStatusChange(order.orderId, newStatus);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <tr style={styles.tr} onClick={() => setExpanded((p) => !p)}>
        <td style={styles.td}>
          <span style={styles.orderId}>{order.orderId?.slice(-12) || '—'}</span>
        </td>
        <td style={styles.td}>{order.customer?.name || `${order.firstName || ''} ${order.lastName || ''}`.trim() || '—'}</td>
        <td style={styles.td}>{order.customer?.email || order.email || '—'}</td>
        <td style={styles.td}>
          <span>{order.product?.name || '—'}</span>
          {order.loyaltyCode && <span style={styles.loyaltyBadge} title={`Loyalty code: ${order.loyaltyCode}`}>👑</span>}
          {order.promoCode && <span style={styles.promoBadge} title={`Promo: ${order.promoCode}`}>%</span>}
        </td>
        <td style={styles.td}>{order.pageCount ?? '—'} pages</td>
        <td style={styles.td}>
          {formatMoney(order.pricing?.totalCents ?? order.pricingSummary?.totalCents)}
          {order.discountCents ? <span style={styles.discountBadge}> −{formatMoney(order.discountCents)}</span> : null}
        </td>
        <td style={styles.td}>{formatDate(order.createdAt)}</td>
        <td style={styles.td} onClick={(e) => e.stopPropagation()}>
          <select
            value={status}
            onChange={(e) => updateStatus(e.target.value)}
            disabled={saving}
            style={{ ...styles.statusSelect, borderColor: STATUS_COLORS[status] || '#ccc', color: STATUS_COLORS[status] || '#333' }}
          >
            {Object.entries(STATUS_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={styles.expandedCell}>
            {/* Order details */}
            <div style={styles.expandedGrid}>
              <div>
                <p style={styles.expandedLabel}>Product</p>
                <p style={styles.expandedValue}>{order.product?.name || '—'}</p>
                {order.product?.id === 'premium-keepsake-book' && (
                  <p style={{ marginTop: 6, fontSize: 12, fontWeight: 600, color: '#92400e', background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '5px 10px' }}>
                    ⭐ Reminder: send this customer a 10% off promo code for their next order.
                  </p>
                )}
              </div>
              {order.storyThemeId && (
                <div>
                  <p style={styles.expandedLabel}>Story Theme</p>
                  <p style={styles.expandedValue}>{THEME_LABELS[order.storyThemeId] || order.storyThemeId}</p>
                </div>
              )}
              <div>
                <p style={styles.expandedLabel}>Shipping Address</p>
                <p style={styles.expandedValue}>
                  {[order.shipping?.address, order.shipping?.city, order.shipping?.postalCode, order.shipping?.country]
                    .filter(Boolean).join(', ') || '—'}
                </p>
              </div>
              <div>
                <p style={styles.expandedLabel}>Delivery Estimate</p>
                <p style={styles.expandedValue}>{order.deliveryEstimate || '—'}</p>
              </div>
              <div>
                <p style={styles.expandedLabel}>Payment Intent</p>
                <p style={styles.expandedValue}>{order.payment?.paymentIntentId || order.paymentIntentId || '—'}</p>
              </div>
            </div>

            {/* Back Cover & Dedication */}
            {(order.backCoverId || order.backCoverDedication || order.dedicationPageText) && (
              <div style={{ padding: '0 20px 16px', borderTop: '1px solid #ede9fe', marginTop: 4 }}>
                <p style={styles.imagesSectionTitle}>Back Cover & Dedication</p>
                <div style={styles.expandedGrid}>
                  {order.backCoverId && (
                    <div>
                      <p style={styles.expandedLabel}>Back Cover Style</p>
                      <p style={styles.expandedValue}>{order.backCoverId}</p>
                    </div>
                  )}
                  {order.backCoverDedication && (
                    <div style={{ gridColumn: 'span 3' }}>
                      <p style={styles.expandedLabel}>Back Cover Message</p>
                      <p style={{ ...styles.expandedValue, fontStyle: 'italic', color: '#5b21b6' }}>"{order.backCoverDedication}"</p>
                    </div>
                  )}
                  {order.dedicationPageText && (
                    <div style={{ gridColumn: 'span 3' }}>
                      <p style={styles.expandedLabel}>Dedication Page Text</p>
                      <p style={{ ...styles.expandedValue, fontStyle: 'italic', color: '#5b21b6' }}>"{order.dedicationPageText}"</p>
                    </div>
                  )}
                  {order.coverNotes && (
                    <div style={{ gridColumn: 'span 3' }}>
                      <p style={styles.expandedLabel}>Cover Notes / Preferences</p>
                      <p style={{ ...styles.expandedValue, color: '#92400e', background: '#fffbeb', padding: '6px 10px', borderRadius: 8 }}>"{order.coverNotes}"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Add-ons */}
            {(order.pricing?.selectedAddOns?.length > 0 || order.selectedAddOns?.length > 0) && (
              <div style={{ padding: '0 20px 16px', borderTop: '1px solid #ede9fe', marginTop: 4 }}>
                <p style={styles.imagesSectionTitle}>Add-ons</p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(order.pricing?.selectedAddOns || order.selectedAddOns || []).map((addOn, i) => (
                    <div key={i} style={{ background: '#f5f0ff', border: '1px solid #c4a8f0', borderRadius: 10, padding: '8px 14px', fontSize: 13 }}>
                      <strong>{addOn.name}</strong>
                      {addOn.quantity > 1 && <span style={{ color: '#7c6f8e' }}> ×{addOn.quantity}</span>}
                      <span style={{ color: '#059669', marginLeft: 8 }}>{formatMoney(addOn.totalPriceCents)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Promo / Loyalty */}
            {(order.promoCode || order.loyaltyCode) && (
              <div style={styles.promoRow}>
                {order.promoCode && (
                  <div style={styles.promoChip}>
                    <span style={styles.promoChipLabel}>Promo used</span>
                    <span style={styles.promoChipCode}>{order.promoCode}</span>
                    {order.discountCents ? (
                      <span style={styles.promoChipDiscount}>−{formatMoney(order.discountCents)}</span>
                    ) : null}
                  </div>
                )}
                {order.loyaltyCode && (
                  <div style={{ ...styles.promoChip, ...styles.loyaltyChip }}>
                    <span style={styles.promoChipLabel}>Loyalty code issued</span>
                    <span style={styles.promoChipCode}>{order.loyaltyCode}</span>
                    <span style={styles.promoChipDiscount}>10% off next order</span>
                  </div>
                )}
              </div>
            )}

            {/* Generate button */}
            {orderData.files?.originals?.length > 0 && (
              <div style={{ padding: '0 20px 16px' }}>
                <button
                  style={{ ...styles.refreshBtn, background: generating ? '#f5f0ff' : '#7c3aed', color: generating ? '#7c3aed' : '#fff', borderColor: '#7c3aed', fontSize: 13 }}
                  onClick={triggerGenerate}
                  disabled={generating}
                >
                  {generating ? '⏳ Generating…' : '✦ Generate Coloring Pages'}
                </button>
                {generateMsg && <p style={{ margin: '8px 0 0', fontSize: 12, color: '#5b21b6' }}>{generateMsg}</p>}
              </div>
            )}

            {/* Generation status warning */}
            {order.generationStatus && order.generationStatus !== 'complete' && (
              <div style={{ margin: '12px 0', padding: '10px 14px', borderRadius: 8, background: order.generationStatus === 'pending' ? '#fff3cd' : '#fff8e1', border: `1px solid ${order.generationStatus === 'pending' ? '#ffc107' : '#ffca28'}`, fontSize: 13, color: '#7a5c00' }}>
                <strong>{order.generationStatus === 'pending' ? '⚠️ No coloring pages generated' : '⚠️ Partial generation'}</strong>
                {' — '}
                {order.generationStatus === 'pending'
                  ? 'OpenAI generation failed for all pages. Only originals are available. Please generate manually.'
                  : `Only ${order.files?.generated?.length || 0} of ${order.pageCount} pages were generated. Please complete manually.`}
              </div>
            )}

            {/* Images */}
            {order.files && (order.files.originals?.length > 0 || order.files.generated?.length > 0) && (
              <div style={styles.imagesSection}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '16px 0 12px' }}>
                  <p style={{ ...styles.imagesSectionTitle, margin: 0 }}>Pages — Original vs Generated</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      style={{ ...styles.refreshBtn, fontSize: 12 }}
                      onClick={async () => {
                        for (let i = 0; i < (order.files.originals || []).length; i++) {
                          const origFile = (order.files.originals[i] || '').split('/').pop();
                          if (origFile) await downloadImage(imgSrc(API, order.orderId, 'originals', origFile, token), origFile);
                          await new Promise((r) => setTimeout(r, 400));
                        }
                      }}
                    >
                      ↓ Download Originals
                    </button>
                    {order.files.generated?.length > 0 && (
                      <button
                        style={{ ...styles.refreshBtn, fontSize: 12 }}
                        onClick={async () => {
                          for (let i = 0; i < (order.files.generated || []).length; i++) {
                            const genFile = (order.files.generated[i] || '').split('/').pop();
                            if (genFile) await downloadImage(imgSrc(API, order.orderId, 'generated', genFile, token), genFile);
                            await new Promise((r) => setTimeout(r, 400));
                          }
                        }}
                      >
                        ↓ Download Generated
                      </button>
                    )}
                  </div>
                </div>
                <div style={styles.pagesGrid}>

                  {(order.files.originals || []).map((origPath, i) => {
                    const origFile = origPath.split('/').pop();
                    const genPath = (order.files.generated || [])[i];
                    const genFile = genPath ? genPath.split('/').pop() : null;
                    return (
                      <div key={i} style={styles.pageCard}>
                        <p style={styles.pageLabel}>Page {i + 1}</p>
                        <div style={styles.pageImages}>
                          <div style={styles.pageImageWrap}>
                            <p style={styles.imageTypeLabel}>Original</p>
                            <img
                              src={imgSrc(API, order.orderId, 'originals', origFile, token)}
                              style={styles.pageImg}
                              alt={`Page ${i + 1} original`}
                              loading="lazy"
                              onClick={() => window.open(imgSrc(API, order.orderId, 'originals', origFile, token), '_blank')}
                            />
                            <button
                              style={styles.imgDlBtn}
                              onClick={() => downloadImage(imgSrc(API, order.orderId, 'originals', origFile, token), origFile)}
                            >↓ Save</button>
                          </div>
                          {genFile && (
                            <div style={styles.pageImageWrap}>
                              <p style={styles.imageTypeLabel}>Generated</p>
                              <img
                                src={imgSrc(API, order.orderId, 'generated', genFile, token)}
                                style={styles.pageImg}
                                alt={`Page ${i + 1} generated`}
                                loading="lazy"
                                onClick={() => window.open(imgSrc(API, order.orderId, 'generated', genFile, token), '_blank')}
                              />
                              <button
                                style={styles.imgDlBtn}
                                onClick={() => downloadImage(imgSrc(API, order.orderId, 'generated', genFile, token), genFile)}
                              >↓ Save</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Products ─────────────────────────────────────────────────────────────────

function ProductsTab({ token }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { product, basePriceCents, addOnPrices: {id: '$'} }
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    fetch(`${API}/api/products`)
      .then((r) => r.json())
      .then((d) => setProducts(d.products || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const startEdit = (p) => {
    const addOnPrices = {};
    (p.addOns || []).forEach((a) => { addOnPrices[a.id] = (a.priceCents / 100).toFixed(2); });
    setEditing({ product: p, basePriceCents: (p.basePriceCents / 100).toFixed(2), addOnPrices });
    setNotice('');
  };

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    setNotice('');
    try {
      const updatedAddOns = (editing.product.addOns || []).map((a) => ({
        ...a,
        priceCents: Math.round(Number(editing.addOnPrices[a.id] || a.priceCents / 100) * 100),
      }));
      const res = await fetch(`${API}/api/products/${editing.product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
        body: JSON.stringify({ ...editing.product, basePriceCents: Math.round(Number(editing.basePriceCents) * 100), addOns: updatedAddOns }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save.');
      setProducts((prev) => prev.map((p) => p.id === editing.product.id ? data.product : p));
      setNotice('Saved!');
      setEditing(null);
    } catch (err) {
      setNotice(err.message);
    } finally {
      setSaving(false);
    }
  };

  const priceInput = (value, onChange) => (
    <input
      type="number" step="0.01" min="0.01" value={value} onChange={onChange}
      style={{ width: 70, padding: '3px 6px', borderRadius: 6, border: '1.5px solid #7c3aed', fontSize: 13 }}
    />
  );

  if (loading) return <div style={styles.centered}>Loading products…</div>;

  return (
    <div style={{ padding: '0 0 40px' }}>
      {products.map((p) => {
        const isEditing = editing?.product?.id === p.id;
        return (
          <div key={p.id} style={{ background: '#fff', borderRadius: 16, border: '1px solid #ede9fe', marginBottom: 20, overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
            {/* Product header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid #f0ebff', background: '#faf8ff' }}>
              <div>
                <strong style={{ fontSize: 15, color: '#1e1033' }}>{p.name}</strong>
                <span style={{ marginLeft: 10, fontSize: 12, color: '#7c6f8e' }}>{p.id}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isEditing ? (
                  <>
                    <button onClick={save} disabled={saving} style={{ ...styles.refreshBtn, borderColor: '#10b981', color: '#10b981' }}>{saving ? 'Saving…' : 'Save'}</button>
                    <button onClick={() => setEditing(null)} style={styles.logoutBtn}>Cancel</button>
                  </>
                ) : (
                  <button onClick={() => startEdit(p)} style={styles.refreshBtn}>Edit Prices</button>
                )}
              </div>
            </div>

            {/* Base prices */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderBottom: '1px solid #f0ebff' }}>
              {[
                ['Base Price', isEditing ? priceInput(editing.basePriceCents, (e) => setEditing((prev) => ({ ...prev, basePriceCents: e.target.value }))) : formatMoney(p.basePriceCents)],
                ['Per Page', formatMoney(p.pricePerPageCents)],
                ['Page Options', (p.availablePageCounts || []).join(', ')],
              ].map(([label, val]) => (
                <div key={label} style={{ padding: '12px 20px', borderRight: '1px solid #f0ebff' }}>
                  <p style={styles.expandedLabel}>{label}</p>
                  <p style={{ margin: 0, fontSize: 14, color: '#1e1033', fontWeight: 600 }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Add-ons */}
            {(p.addOns || []).length > 0 && (
              <div style={{ padding: '12px 20px' }}>
                <p style={{ ...styles.expandedLabel, marginBottom: 10 }}>Add-ons</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(p.addOns || []).map((a) => (
                    <div key={a.id} style={{ background: '#f5f0ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '8px 12px', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, color: '#1e1033' }}>{a.name}</span>
                      {isEditing ? priceInput(editing.addOnPrices[a.id], (e) => setEditing((prev) => ({ ...prev, addOnPrices: { ...prev.addOnPrices, [a.id]: e.target.value } }))) : <span style={{ color: '#5b21b6', fontWeight: 700 }}>{formatMoney(a.priceCents)}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {notice && <p style={{ color: notice === 'Saved!' ? '#059669' : '#dc2626', fontWeight: 600 }}>{notice}</p>}
    </div>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab({ token }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${API}/api/admin/users`, { headers: { 'x-admin-token': token } })
      .then((r) => r.json())
      .then((d) => setUsers(d.users || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.firstName?.toLowerCase().includes(q) ||
      u.lastName?.toLowerCase().includes(q)
    );
  });

  if (loading) return <div style={styles.centered}>Loading users…</div>;

  return (
    <div style={{ padding: '0 0 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <p style={{ margin: 0, color: '#7c6f8e', fontSize: 14 }}>{users.length} registered account{users.length !== 1 ? 's' : ''}</p>
        <input
          type="search"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={styles.centered}>No users found.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Name', 'Email', 'Joined', 'Orders', 'Saved Address'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} style={styles.tr}>
                  <td style={styles.td}>
                    <strong>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</strong>
                  </td>
                  <td style={styles.td}>{u.email}</td>
                  <td style={styles.td}>{u.createdAt ? formatDate(u.createdAt) : '—'}</td>
                  <td style={styles.td}>
                    <span style={{ background: u.orderCount > 0 ? '#ede9fe' : '#f3f4f6', color: u.orderCount > 0 ? '#7c3aed' : '#9ca3af', borderRadius: 999, padding: '2px 10px', fontSize: 13, fontWeight: 600 }}>
                      {u.orderCount}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {u.savedShipping?.address
                      ? `${u.savedShipping.address}, ${u.savedShipping.city} ${u.savedShipping.postalCode}`
                      : <span style={{ color: '#bbb' }}>Not saved</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ token, onLogout }) {
  const [tab, setTab] = useState('orders');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/orders`, {
        headers: { 'x-admin-token': token },
      });
      if (res.status === 401) { onLogout(); return; }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch {
      setError('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleStatusChange = (orderId, newStatus) => {
    setOrders((prev) => prev.map((o) => o.orderId === orderId ? { ...o, status: newStatus } : o));
  };

  const filtered = orders.filter((o) => {
    if (filter !== 'all' && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        o.orderId?.toLowerCase().includes(q) ||
        o.customer?.name?.toLowerCase().includes(q) ||
        o.customer?.email?.toLowerCase().includes(q) ||
        o.email?.toLowerCase().includes(q) ||
        o.firstName?.toLowerCase().includes(q) ||
        o.lastName?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = orders.reduce((acc, o) => {
    acc[o.status || 'new'] = (acc[o.status || 'new'] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={styles.dash}>
      {/* Header */}
      <div style={styles.dashHeader}>
        <div>
          <h1 style={styles.dashTitle}>Orders</h1>
          <p style={styles.dashSub}>{orders.length} total orders</p>
        </div>
        <div style={styles.dashHeaderActions}>
          <button onClick={load} style={styles.refreshBtn}>↻ Refresh</button>
          <button onClick={onLogout} style={styles.logoutBtn}>Sign Out</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[['orders', 'Orders'], ['products', 'Products'], ['users', 'Users']].map(([val, label]) => (
          <button key={val} onClick={() => setTab(val)} style={{ ...styles.pill, ...(tab === val ? styles.pillActive : {}) }}>{label}</button>
        ))}
      </div>

      {tab === 'products' ? <ProductsTab token={token} /> : null}
      {tab === 'users' ? <UsersTab token={token} /> : null}

      {tab === 'orders' && <>
      {/* Stats */}
      <div style={styles.statsRow}>
        {Object.entries(STATUS_LABELS).map(([val, label]) => (
          <div key={val} style={{ ...styles.statCard, borderTopColor: STATUS_COLORS[val] }}>
            <p style={{ ...styles.statNum, color: STATUS_COLORS[val] }}>{counts[val] || 0}</p>
            <p style={styles.statLabel}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={styles.toolbar}>
        <div style={styles.filterPills}>
          {['all', ...Object.keys(STATUS_LABELS)].map((val) => (
            <button
              key={val}
              onClick={() => setFilter(val)}
              style={{ ...styles.pill, ...(filter === val ? styles.pillActive : {}) }}
            >
              {val === 'all' ? 'All' : STATUS_LABELS[val]}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Search by name, email, order ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div style={styles.centered}>Loading orders…</div>
      ) : error ? (
        <div style={styles.centered}>{error}</div>
      ) : filtered.length === 0 ? (
        <div style={styles.centered}>No orders found.</div>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                {['Order ID', 'Customer', 'Email', 'Product', 'Pages', 'Total', 'Date', 'Status'].map((h) => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((order) => (
                <OrderRow
                  key={order.orderId}
                  order={order}
                  token={token}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      </>}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function AdminApp() {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');

  const logout = () => {
    sessionStorage.removeItem(TOKEN_KEY);
    setToken('');
  };

  if (!token) return <LoginScreen onLogin={setToken} />;
  return <Dashboard token={token} onLogout={logout} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  loginWrap: {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  loginCard: {
    background: '#fff', borderRadius: 20, padding: '48px 40px', width: 360,
    boxShadow: '0 24px 64px rgba(109,40,217,0.12)', textAlign: 'center',
  },
  loginLogo: { fontSize: 40, marginBottom: 12 },
  loginTitle: { margin: '0 0 4px', fontSize: 24, fontWeight: 700, color: '#1e1033' },
  loginSub: { margin: '0 0 32px', fontSize: 14, color: '#7c6f8e' },
  loginForm: { display: 'flex', flexDirection: 'column', gap: 14 },
  loginInput: {
    padding: '12px 16px', borderRadius: 12, border: '1.5px solid #e5e0f0',
    fontSize: 15, outline: 'none', fontFamily: 'inherit',
  },
  loginError: { margin: 0, color: '#dc2626', fontSize: 13 },
  loginBtn: {
    padding: '13px', borderRadius: 12, border: 0,
    background: 'linear-gradient(160deg, #7c3aed, #5b21b6)',
    color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dash: {
    minHeight: '100vh', background: '#f9f8ff',
    fontFamily: "'DM Sans', system-ui, sans-serif", padding: '32px 40px',
    boxSizing: 'border-box',
  },
  dashHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 },
  dashTitle: { margin: '0 0 4px', fontSize: 28, fontWeight: 700, color: '#1e1033' },
  dashSub: { margin: 0, fontSize: 14, color: '#7c6f8e' },
  dashHeaderActions: { display: 'flex', gap: 10, alignItems: 'center' },
  refreshBtn: {
    padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e0f0',
    background: '#fff', color: '#5b21b6', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  logoutBtn: {
    padding: '9px 16px', borderRadius: 10, border: '1.5px solid #fecaca',
    background: '#fff', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 },
  statCard: {
    background: '#fff', borderRadius: 14, padding: '16px 20px',
    borderTop: '3px solid #ccc', boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
  },
  statNum: { margin: '0 0 4px', fontSize: 28, fontWeight: 700 },
  statLabel: { margin: 0, fontSize: 13, color: '#7c6f8e', fontWeight: 500 },
  toolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 16, flexWrap: 'wrap' },
  filterPills: { display: 'flex', gap: 6 },
  pill: {
    padding: '7px 14px', borderRadius: 999, border: '1.5px solid #e5e0f0',
    background: '#fff', color: '#7c6f8e', fontSize: 13, fontWeight: 500, cursor: 'pointer',
    fontFamily: 'inherit',
  },
  pillActive: { background: '#7c3aed', borderColor: '#7c3aed', color: '#fff' },
  searchInput: {
    padding: '9px 16px', borderRadius: 10, border: '1.5px solid #e5e0f0',
    fontSize: 14, outline: 'none', fontFamily: 'inherit', minWidth: 260, background: '#fff',
  },
  tableWrap: { background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.05)', border: '1px solid #ede9fe' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
  th: { padding: '13px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#7c6f8e', letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: '1px solid #f0ebff', background: '#faf8ff' },
  tr: { cursor: 'pointer', transition: 'background 150ms' },
  td: { padding: '14px 16px', borderBottom: '1px solid #f5f3ff', color: '#1e1033', verticalAlign: 'middle' },
  orderId: { fontFamily: 'monospace', fontSize: 12, color: '#7c6f8e' },
  statusSelect: {
    padding: '6px 10px', borderRadius: 8, border: '1.5px solid', fontSize: 12,
    fontWeight: 600, cursor: 'pointer', background: '#fff', fontFamily: 'inherit', outline: 'none',
  },
  expandedCell: { padding: 0, background: '#faf8ff' },
  expandedGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '16px 20px' },
  expandedLabel: { margin: '0 0 4px', fontSize: 11, fontWeight: 600, color: '#7c6f8e', textTransform: 'uppercase', letterSpacing: '0.06em' },
  expandedValue: { margin: 0, fontSize: 13, color: '#1e1033', wordBreak: 'break-all' },
  centered: { textAlign: 'center', padding: '60px 20px', color: '#7c6f8e', fontSize: 15 },
  promoRow: { display: 'flex', gap: 12, padding: '0 20px 16px', flexWrap: 'wrap' },
  promoChip: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
    background: '#f5f0ff', border: '1px solid #c4a8f0', borderRadius: 10,
    fontSize: 13,
  },
  loyaltyChip: { background: '#fff7ed', border: '1px solid #fed7aa' },
  promoChipLabel: { color: '#7c6f8e', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' },
  promoChipCode: { fontFamily: 'monospace', fontWeight: 700, color: '#5b21b6', fontSize: 13, letterSpacing: '0.06em' },
  promoChipDiscount: { color: '#059669', fontWeight: 600, fontSize: 12 },
  loyaltyBadge: { marginLeft: 6, fontSize: 13, cursor: 'default' },
  promoBadge: {
    marginLeft: 4, fontSize: 10, fontWeight: 700, background: '#7c3aed', color: '#fff',
    borderRadius: 4, padding: '1px 4px', cursor: 'default',
  },
  discountBadge: { color: '#059669', fontSize: 12, fontWeight: 600 },
  imagesSection: { padding: '0 20px 20px', borderTop: '1px solid #ede9fe', marginTop: 4 },
  imagesSectionTitle: { margin: '16px 0 12px', fontSize: 12, fontWeight: 700, color: '#7c6f8e', textTransform: 'uppercase', letterSpacing: '0.06em' },
  pagesGrid: { display: 'flex', flexWrap: 'wrap', gap: 16 },
  pageCard: { background: '#fff', borderRadius: 12, border: '1px solid #ede9fe', padding: '12px 14px', minWidth: 220 },
  pageLabel: { margin: '0 0 10px', fontSize: 12, fontWeight: 700, color: '#5b21b6' },
  pageImages: { display: 'flex', gap: 10 },
  pageImageWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 },
  imageTypeLabel: { margin: 0, fontSize: 10, fontWeight: 600, color: '#7c6f8e', textTransform: 'uppercase', letterSpacing: '0.05em' },
  pageImg: { width: 120, height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e0f0', cursor: 'pointer', transition: 'opacity 150ms' },
  imgDlBtn: { marginTop: 4, padding: '3px 10px', borderRadius: 6, border: '1px solid #ddd6fe', background: '#f5f0ff', color: '#5b21b6', fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
};
