function PreviewBook({
  generatedImages,
  uploads,
  samplePreviewIndex,
  isGenerating,
  generationProgress,
  generationError,
  onBackToUploads,
  onFinishOrder,
}) {
  const safePreviewIndex = samplePreviewIndex >= 0 ? samplePreviewIndex : 0;
  const generatedImage = generatedImages?.[safePreviewIndex] ?? null;
  const hasGenerated =
    generatedImage &&
    typeof generatedImage.url === 'string' &&
    generatedImage.url.length > 0;

  return (
    <section className="preview-step" aria-labelledby="preview-book-title">
      <div className="preview-shell preview-shell--focused">

        {/* Header */}
        <div className="preview-top preview-top--focused">
          <p className="builder-eyebrow">Your Sample Page</p>
          <h2 id="preview-book-title">
            {isGenerating ? 'Creating your coloring page…' : hasGenerated ? 'Here\'s a peek inside your book.' : 'Your preview is almost ready.'}
          </h2>
          <p className="preview-note">
            {isGenerating
              ? 'This usually takes 15–20 seconds. Hang tight!'
              : hasGenerated
              ? 'This is one page from your book. Final pages are hand-refined for even sharper detail.'
              : 'Something went wrong generating your preview. You can still continue to checkout.'}
          </p>
        </div>

        {/* Preview image */}
        <div className="preview-single-page">
          <article className="preview-page preview-page--single">
            <div className="preview-page-media">
              {isGenerating ? (
                <div className="preview-image-loading" aria-label="Generating preview…">
                  <span className="preview-loading-spinner" aria-hidden="true" />
                  <p className="preview-loading-text">
                    {generationProgress || 'Turning your photo into a coloring page…'}
                  </p>
                </div>
              ) : hasGenerated ? (
                <img
                  src={generatedImage.url}
                  alt={`Sample coloring page ${safePreviewIndex + 1}`}
                  className="preview-image"
                />
              ) : (
                <div className="preview-image-fallback" aria-hidden="true" />
              )}
            </div>
            {generationError && (
              <p className="preview-error-note">{generationError}</p>
            )}
          </article>
        </div>

        {/* Quality notice */}
        {hasGenerated && (
          <div className="preview-sample-notice">
            <span className="preview-sample-badge">Sample Preview</span>
            <p className="preview-sample-text">
              Final pages are hand-refined with sharper lines, finer details, and a closer
              likeness to your photos.
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="preview-actions">
          <button type="button" className="upload-back" onClick={onBackToUploads}>
            ← Back to Photos
          </button>
          <button
            type="button"
            className="create-book-button"
            onClick={onFinishOrder}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Continue to Checkout →'}
          </button>
        </div>

      </div>
    </section>
  );
}

export default PreviewBook;
