const BACK_COVERS = [
  {
    id: 'classic',
    label: 'Classic',
    badge: '⭐ Best Seller',
    src: '/images/book-back.png',
  },
  {
    id: 'colorful',
    label: 'Colorful',
    src: '/images/back-colorful.jpg',
  },
  {
    id: 'sky',
    label: 'Blue Sky',
    src: '/images/back-sky.jpg',
  },
  {
    id: 'kraft',
    label: 'Kraft',
    src: '/images/back-kraft.jpg',
  },
  {
    id: 'hollywood',
    label: 'Hollywood',
    src: '/images/back-hollywood.jpg',
  },
];

function CustomizeBack({ backCoverId, dedication, onBackCoverChange, onDedicationChange, onBack, onContinue }) {
  const selected = BACK_COVERS.find((c) => c.id === backCoverId) || BACK_COVERS[0];

  return (
    <section className="customize-back-step">
      <div className="customize-back-shell">

        <div className="customize-back-controls">
          <button type="button" className="upload-back" onClick={onBack}>
            ← Back
          </button>

          <div className="builder-section-head">
            <span className="builder-step-number">1</span>
            <div>
              <p className="builder-pricing-label">Dedication page</p>
              <h3 className="builder-section-title">Add a personal message <span className="customize-optional">(optional)</span></h3>
            </div>
          </div>

          <div className="field-group">
            <textarea
              className="field-input customize-dedication-input"
              maxLength={220}
              rows={4}
              placeholder="e.g. This book belongs to you and the sweetest moments and the best memories 💫"
              value={dedication}
              onChange={(e) => onDedicationChange(e.target.value)}
            />
            <p className="builder-tip">We'll print this as a dedication page inside the front cover.</p>
          </div>

          <div className="builder-section-head" style={{ marginTop: '8px' }}>
            <span className="builder-step-number">2</span>
            <div>
              <p className="builder-pricing-label">Back cover design</p>
              <h3 className="builder-section-title">Pick your back cover</h3>
            </div>
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

        <div className="customize-back-preview">
          <p className="builder-pricing-label" style={{ marginBottom: '10px' }}>Preview</p>
          <div className="back-cover-mockup">
            <img
              src={selected.src}
              alt={selected.label}
              className="back-cover-mockup-image"
            />
          </div>
          <p className="builder-tip" style={{ marginTop: '8px', textAlign: 'center' }}>{selected.label}</p>
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
