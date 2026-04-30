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
  const uploadedImage = uploads?.[safePreviewIndex] ?? null;
  const generatedImage = generatedImages?.[safePreviewIndex] ?? null;
  const hasGenerated =
    generatedImage &&
    typeof generatedImage.url === 'string' &&
    generatedImage.url.length > 0;
  const imageToRender = hasGenerated ? generatedImage : (!isGenerating ? uploadedImage : null);
  const usedFallback = !hasGenerated && !isGenerating && Boolean(uploadedImage);

  return (
    <section className="preview-step" aria-labelledby="preview-book-title">
      <div className="preview-shell preview-shell--focused">
        <div className="preview-top preview-top--focused">
          <button type="button" className="upload-back" onClick={onBackToUploads}>
            Back to Uploads
          </button>
          <p className="builder-eyebrow">Chapter 4</p>
          <h2 id="preview-book-title">Preview one sample page.</h2>
          <p className="preview-note">
            {isGenerating
              ? (generationProgress || 'Generating your sample coloring page…')
              : 'Take a quick look at one generated sample before you continue with the rest of your order.'}
          </p>
        </div>

        <div className="preview-sample-notice" aria-live="polite">
          <span className="preview-sample-badge">Sample Preview</span>
          <p className="preview-sample-text">
            This is an early draft to give you a feel for your book. Your final pages will be
            hand-illustrated with more precision — sharper lines, finer details, and a closer
            likeness to your photos.
          </p>
        </div>

        <div className="preview-single-page">
          <article className="preview-page preview-page--single">
            <div className="preview-page-media">
              {isGenerating ? (
                <div className="preview-image-loading" aria-label="Generating preview…">
                  <span className="preview-loading-spinner" aria-hidden="true" />
                  <p className="preview-loading-text">Turning your photo into a coloring page…</p>
                </div>
              ) : imageToRender &&
                typeof imageToRender.url === 'string' &&
                imageToRender.url.length > 0 ? (
                <img
                  src={imageToRender.url}
                  alt={`Preview Page ${safePreviewIndex + 1}`}
                  className="preview-image"
                />
              ) : (
                <div className="preview-image-fallback" aria-hidden="true" />
              )}
            </div>
            <p className="preview-label">Sample — Page {safePreviewIndex + 1}</p>
            {usedFallback ? (
              <p className="preview-fallback-note">Original photo shown for this sample.</p>
            ) : null}
            {generationError ? (
              <p className="preview-error-note">{generationError}</p>
            ) : null}
          </article>
        </div>

        <div className="preview-actions">
          <button type="button" className="upload-back" onClick={onBackToUploads}>
            Back to Uploads
          </button>
          <button
            type="button"
            className="create-book-button"
            onClick={onFinishOrder}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating…' : 'Continue to Checkout'}
          </button>
        </div>
      </div>
    </section>
  );
}

export default PreviewBook;
