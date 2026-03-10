function ProcessingStep({ progressText }) {
  return (
    <section className="processing-step" aria-live="polite">
      <div className="processing-card">
        <p className="builder-eyebrow">Chapter 4</p>
        <h2>We're turning your memories into coloring pages...</h2>
        <p className="processing-copy">
          {progressText || 'Creating your coloring pages...'}
        </p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

export default ProcessingStep;
