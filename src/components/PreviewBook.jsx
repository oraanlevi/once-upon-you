function PreviewBook({ uploads, pageCount, onBackToUploads, onFinishOrder }) {
  return (
    <section className="preview-step" aria-labelledby="preview-book-title">
      <div className="preview-shell preview-shell--focused">

        <div className="preview-top preview-top--focused">
          <h2 id="preview-book-title">Review your photos.</h2>
          <p className="preview-note">
            Make sure everything looks right before you checkout. These are the photos we'll turn into your coloring book.
          </p>
        </div>

        <div className="upload-grid upload-grid--focused">
          {uploads.map((image, index) => (
            <div key={index} className="preview-review-card">
              <p className="preview-review-label">Page {index + 1}</p>
              {image?.url ? (
                <img
                  src={image.url}
                  alt={`Page ${index + 1}`}
                  className="preview-review-img"
                />
              ) : (
                <div className="preview-review-empty">No photo</div>
              )}
            </div>
          ))}
        </div>

        <div className="preview-actions">
          <button type="button" className="upload-back" onClick={onBackToUploads}>
            ← Back to Photos
          </button>
          <button type="button" className="create-book-button" onClick={onFinishOrder}>
            Continue to Checkout →
          </button>
        </div>

      </div>
    </section>
  );
}

export default PreviewBook;
