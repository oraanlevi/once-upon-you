import { useState, useRef } from 'react';

const FORMATS = [
  {
    id: 'pocket-book',
    name: 'Pocket Book',
    description: 'Compact keepsake, perfect for little hands.',
    emoji: '📖',
    availablePageCounts: [8, 10, 15, 20, 30],
  },
  {
    id: 'large-book',
    name: 'Large Book',
    description: 'Premium layflat hardcover, full-size experience.',
    emoji: '📚',
    availablePageCounts: [8, 10, 15, 20, 30],
  },
];

const QUANTITIES = [50, 75, 100, 150, 200];

function getPricePerBook(qty) {
  if (typeof qty !== 'number') return null;
  return qty >= 100 ? 7 : 8;
}

const STEPS = ['format', 'pages', 'quantity', 'upload', 'backcover', 'contact'];
const STEP_LABELS = ['Format', 'Pages', 'Quantity', 'Upload', 'Back Cover', 'Contact'];

export default function CorporatePortal({ onClose, apiBase }) {
  const [unlocked] = useState(true);

  const [step, setStep] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedPageCount, setSelectedPageCount] = useState(null);
  const [selectedQty, setSelectedQty] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [contact, setContact] = useState({ name: '', company: '', email: '', phone: '' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [done, setDone] = useState(false);

  const photoInputRef = useRef();
  const logoInputRef = useRef();

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);
  }

  function handlePhotosChange(e) {
    const files = Array.from(e.target.files || []);
    setPhotos((prev) => [...prev, ...files].slice(0, 10));
  }

  async function handleSubmit() {
    if (!contact.name || !contact.company || !contact.email || !contact.phone) {
      setSubmitError('Please fill in all fields.');
      return;
    }
    if (!contact.email.includes('@')) {
      setSubmitError('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('format', selectedFormat);
      formData.append('pageCount', selectedPageCount);
      formData.append('quantity', selectedQty === '200+' ? '200+' : String(selectedQty));
      formData.append('name', contact.name);
      formData.append('company', contact.company);
      formData.append('email', contact.email);
      formData.append('phone', contact.phone);
      photos.forEach((f) => formData.append('photos', f));
      if (logoFile) formData.append('logo', logoFile);

      const res = await fetch(`${apiBase}/api/corporate-quote`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit.');
      setDone(true);
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const format = FORMATS.find((f) => f.id === selectedFormat);
  const pricePerBook = getPricePerBook(typeof selectedQty === 'number' ? selectedQty : null);
  const estimatedTotal = pricePerBook && typeof selectedQty === 'number'
    ? `$${(selectedQty * pricePerBook).toLocaleString()}`
    : null;

  return (
    <div className="corp-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="corp-modal">
        {/* Header */}
        <div className="corp-header">
          <div>
            <p className="builder-eyebrow">Twice Upon Us</p>
            <h2 className="corp-title">Events & Group Orders</h2>
          </div>
          <button className="corp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {done ? (
          /* Success */
          <div className="corp-success">
            <div className="corp-success-icon">✓</div>
            <h3>Quote request sent!</h3>
            <p>We'll reach out to <strong>{contact.email}</strong> within 1–2 business days to confirm your order.</p>
            <div className="corp-summary-box">
              <div className="corp-summary-row"><span>Format</span><span>{FORMATS.find(f=>f.id===selectedFormat)?.name}</span></div>
              <div className="corp-summary-row"><span>Pages</span><span>{selectedPageCount} pages</span></div>
              <div className="corp-summary-row"><span>Quantity</span><span>{selectedQty} books</span></div>
              {estimatedTotal && <div className="corp-summary-row"><span>Est. Total</span><strong>{estimatedTotal}</strong></div>}
            </div>
            <button className="corp-submit-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          /* Builder */
          <div className="corp-builder">
            {/* Step indicator */}
            <div className="corp-steps">
              {STEP_LABELS.map((label, i) => (
                <div key={label} className={`corp-step-dot ${i < step ? 'done' : ''} ${i === step ? 'active' : ''}`}>
                  <span className="corp-step-num">{i < step ? '✓' : i + 1}</span>
                  <span className="corp-step-label">{label}</span>
                </div>
              ))}
            </div>

            <div className="corp-step-body">
              {/* Step 0: Format */}
              {step === 0 && (
                <div>
                  <h3 className="corp-step-title">Choose your book format</h3>
                  <div className="product-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                    {FORMATS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`product-card ${selectedFormat === f.id ? 'is-selected' : ''}`}
                        onClick={() => setSelectedFormat(f.id)}
                      >
                        <span className={`product-card-visual product-card-visual--${f.id === 'pocket-book' ? 'pocket' : 'large'}`}>
                          <span className="book-mockup" aria-hidden="true">
                            <span className="book-mockup-emoji">{f.emoji}</span>
                            <span className="book-mockup-cover" />
                            <span className="book-mockup-pages" />
                          </span>
                        </span>
                        <span className="product-card-copy">
                          <strong className="product-card-title">{f.name}</strong>
                          <span className="product-card-description">{f.description}</span>
                        </span>
                        {selectedFormat === f.id && <span className="product-card-check">✓</span>}
                      </button>
                    ))}
                  </div>
                  <button
                    className="corp-next-btn"
                    disabled={!selectedFormat}
                    onClick={() => setStep(1)}
                  >
                    Continue →
                  </button>
                </div>
              )}

              {/* Step 1: Pages */}
              {step === 1 && (
                <div>
                  <h3 className="corp-step-title">How many pages per book?</h3>
                  <div className="builder-options builder-options--pills">
                    {(format?.availablePageCounts || []).map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={`builder-option ${selectedPageCount === n ? 'is-selected' : ''}`}
                        onClick={() => setSelectedPageCount(n)}
                      >
                        {n} Pages
                      </button>
                    ))}
                  </div>
                  <div className="corp-nav">
                    <button className="corp-back-btn" onClick={() => setStep(0)}>← Back</button>
                    <button className="corp-next-btn" disabled={!selectedPageCount} onClick={() => setStep(2)}>Continue →</button>
                  </div>
                </div>
              )}

              {/* Step 2: Quantity */}
              {step === 2 && (
                <div>
                  <h3 className="corp-step-title">How many books?</h3>
                  <div className="corp-pricing-note">
                    <span className="corp-pricing-tier">50–99 books: <strong>$8/book</strong></span>
                    <span className="corp-pricing-tier highlighted">100–200 books: <strong>$7/book</strong></span>
                  </div>
                  <div className="builder-options builder-options--pills">
                    {QUANTITIES.map((q) => (
                      <button
                        key={q}
                        type="button"
                        className={`builder-option ${selectedQty === q ? 'is-selected' : ''}`}
                        onClick={() => setSelectedQty(q)}
                      >
                        {q} books
                        {q >= 100 && <span className="corp-qty-badge">$6/book</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      className={`builder-option ${selectedQty === '200+' ? 'is-selected' : ''}`}
                      onClick={() => setSelectedQty('200+')}
                    >
                      200+ books
                    </button>
                  </div>
                  {selectedQty && selectedQty !== '200+' && (
                    <p className="corp-total-preview">
                      Estimated total: <strong>{estimatedTotal}</strong> ({selectedQty} × ${pricePerBook})
                    </p>
                  )}
                  {selectedQty === '200+' && (
                    <p className="corp-total-preview">We'll provide a custom quote for 200+ books.</p>
                  )}
                  <div className="corp-nav">
                    <button className="corp-back-btn" onClick={() => setStep(1)}>← Back</button>
                    <button className="corp-next-btn" disabled={!selectedQty} onClick={() => setStep(3)}>Continue →</button>
                  </div>
                </div>
              )}

              {/* Step 3: Upload */}
              {step === 3 && (
                <div>
                  <h3 className="corp-step-title">Upload photos & logo</h3>
                  <p className="corp-upload-hint">These help us capture your brand's vibe. We'll use them as inspiration for your book.</p>

                  <div className="corp-upload-section">
                    <label className="corp-upload-label">Inspiration photos <span className="corp-upload-sub">(up to 10)</span></label>
                    <button type="button" className="corp-upload-btn" onClick={() => photoInputRef.current?.click()}>
                      + Add photos
                    </button>
                    <input ref={photoInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={handlePhotosChange} />
                    {photos.length > 0 && (
                      <div className="corp-photo-grid">
                        {photos.map((f, i) => (
                          <div key={i} className="corp-photo-thumb">
                            <img src={URL.createObjectURL(f)} alt="" />
                            <button type="button" className="corp-photo-remove" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="corp-upload-section">
                    <label className="corp-upload-label">Company logo</label>
                    <button type="button" className="corp-upload-btn" onClick={() => logoInputRef.current?.click()}>
                      {logoFile ? 'Change logo' : '+ Upload logo'}
                    </button>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                    {logoPreview && (
                      <div className="corp-logo-preview">
                        <img src={logoPreview} alt="Your logo" />
                      </div>
                    )}
                  </div>

                  <div className="corp-nav">
                    <button className="corp-back-btn" onClick={() => setStep(2)}>← Back</button>
                    <button className="corp-next-btn" onClick={() => setStep(4)}>Continue →</button>
                  </div>
                </div>
              )}

              {/* Step 4: Back cover preview */}
              {step === 4 && (
                <div>
                  <h3 className="corp-step-title">Your back cover</h3>
                  <p className="corp-upload-hint">Both logos will appear on the back cover of every book.</p>
                  <div className="corp-back-preview">
                    <div className="corp-back-logo-box">
                      {logoPreview
                        ? <img src={logoPreview} alt="Your logo" className="corp-back-logo-img" />
                        : <div className="corp-back-logo-placeholder">Your logo</div>
                      }
                    </div>
                    <div className="corp-back-divider">×</div>
                    <div className="corp-back-logo-box">
                      <img src="/images/logo-stacked.png" alt="Twice Upon Us" className="corp-back-logo-img" />
                    </div>
                  </div>
                  <p className="corp-back-caption">Your logo and ours, side by side on every back cover.</p>
                  <div className="corp-nav">
                    <button className="corp-back-btn" onClick={() => setStep(3)}>← Back</button>
                    <button className="corp-next-btn" onClick={() => setStep(5)}>Looks good →</button>
                  </div>
                </div>
              )}

              {/* Step 5: Contact */}
              {step === 5 && (
                <div>
                  <h3 className="corp-step-title">Your contact details</h3>
                  <div className="corp-form">
                    {[
                      { key: 'name', label: 'Full name', placeholder: 'Jane Smith' },
                      { key: 'company', label: 'Company name', placeholder: 'Acme Corp' },
                      { key: 'email', label: 'Email address', placeholder: 'jane@acme.com' },
                      { key: 'phone', label: 'Phone number', placeholder: '+1 555 000 0000' },
                    ].map(({ key, label, placeholder }) => (
                      <div key={key} className="auth-field">
                        <label className="auth-label">{label}</label>
                        <input
                          className="auth-input"
                          type={key === 'email' ? 'email' : 'text'}
                          placeholder={placeholder}
                          value={contact[key]}
                          onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
                        />
                      </div>
                    ))}
                  </div>
                  {submitError && <p className="corp-error">{submitError}</p>}
                  <div className="corp-nav">
                    <button className="corp-back-btn" onClick={() => setStep(4)}>← Back</button>
                    <button
                      className="corp-submit-btn"
                      disabled={submitting}
                      onClick={handleSubmit}
                    >
                      {submitting ? 'Sending…' : 'Request Quote →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
