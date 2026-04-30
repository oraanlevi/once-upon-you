import BuilderPreviewPanel from './BuilderPreviewPanel';

function ProcessingStep({ progressText, selectedProduct, cartSummary, uploadedImages }) {
  return (
    <section className="processing-step" aria-live="polite">
      <div className="chapter-editor-shell">
        <BuilderPreviewPanel
          chapterLabel="Chapter 4"
          selectedProduct={selectedProduct}
          cartSummary={cartSummary}
          uploadedImages={uploadedImages}
          detailText="Your uploaded memories are being turned into book pages. This chapter should only take a moment."
        />

        <div className="chapter-controls-shell">
          <div className="processing-card">
            <p className="builder-eyebrow">Chapter 4</p>
            <h2>We’re turning your memories into pages...</h2>
            <p className="processing-copy">
              {progressText || 'Creating your coloring pages...'}
            </p>
            <div className="loading-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ProcessingStep;
