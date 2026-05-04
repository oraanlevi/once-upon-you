const COVER_GALLERY = [
  {
    id: 'classic-split',
    label: 'Classic Split',
    badge: '⭐ Best Seller',
    src: '/images/cover-classic-split.jpg',
  },
];

const BACK_COVERS = [
  { id: 'classic',  label: 'Classic',  badge: '⭐ Best Seller', src: '/images/back-classic.png' },
  { id: 'pink',     label: 'Pink',     src: '/images/back-pink.png' },
  { id: 'ocean',    label: 'Ocean',    src: '/images/back-ocean.png' },
  { id: 'orange',   label: 'Orange',   src: '/images/back-orange.png' },
  { id: 'midnight', label: 'Midnight', src: '/images/back-midnight.png' },
];

function CustomizeBack({ backCoverId, dedication, coverNotes, onBackCoverChange, onDedicationChange, onCoverNotesChange, onBack, onContinue }) {
  const selectedBack = BACK_COVERS.find((c) => c.id === backCoverId) || BACK_COVERS[0];

  return (
    <section className="customize-back-step">
      <div className="customize-back-shell">
        <div className="customize-back-controls">
          <button type="button" className="upload-back" onClick={onBack}>← Back</button>

          {/* ── BACK COVER ── */}
          <div className="customize-section-block">
            <div className="customize-section-header">
              <h3 className="customize-section-title">Back Cover</h3>
              <span className="customize-optional">Pick your favorite</span>
            </div>
            <div className="back-cover-options">
              {BACK_COVERS.map((cover) => (
                <button
                  key={cover.id}
                  type="button"
                  className={`back-cover-option ${backCoverId === cover.id ? 'is-selected' : ''}`}
                  onClick={() => onBackCoverChange(cover.id)}
                >
                  <img src={cover.src} alt={cover.label} className="back-cover-option-img" />
                  <span className="back-cover-option-label">
                    {cover.label}
                    {cover.badge && <span className="back-cover-option-badge">{cover.badge}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── FRONT COVER ── */}
          <div className="customize-section-block">
            <div className="customize-section-header">
              <h3 className="customize-section-title">Front Cover</h3>
              <span className="customize-optional">We design it from your photos</span>
            </div>

            <p className="customize-section-sub">Here's our signature style — every cover is made by hand just for you.</p>

            <div className="cover-gallery">
              {COVER_GALLERY.map((item) => (
                <div key={item.id} className="cover-gallery-item">
                  <img src={item.src} alt={item.label} className="cover-gallery-img" />
                  <span className="cover-gallery-label">
                    {item.label}
                    {item.badge && <span className="cover-gallery-badge">{item.badge}</span>}
                  </span>
                </div>
              ))}
            </div>

            <div className="field-group" style={{ marginTop: '14px' }}>
              <label className="customize-field-label">
                Any preferences? <span className="customize-optional">(optional)</span>
              </label>
              <textarea
                className="field-input customize-dedication-input"
                maxLength={300}
                rows={2}
                placeholder="e.g. include my daughter's name on the cover, warm tones"
                value={coverNotes || ''}
                onChange={(e) => onCoverNotesChange(e.target.value)}
              />
              <p className="builder-tip">We'll use this as our creative brief when designing your cover.</p>
            </div>
          </div>
        </div>

        {/* Preview panel */}
        <div className="customize-back-preview">
          <p className="builder-pricing-label" style={{ marginBottom: '10px' }}>Back Cover Preview</p>
          <div className="back-cover-mockup">
            <img src={selectedBack.src} alt={selectedBack.label} className="back-cover-mockup-image" />
          </div>
          <p className="builder-tip" style={{ marginTop: '8px', textAlign: 'center' }}>{selectedBack.label}</p>
        </div>

        <div className="customize-back-footer">
          <button type="button" className="create-book-button" onClick={onContinue}>
            Upload Your Photos →
          </button>
        </div>
      </div>
    </section>
  );
}

export default CustomizeBack;
