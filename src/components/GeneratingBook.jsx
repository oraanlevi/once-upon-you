function GeneratingBook() {
  return (
    <section className="generating-step" aria-live="polite">
      <div className="generating-card">
        <h2>Generating Your Coloring Book</h2>
        <p>We're turning your memories into coloring pages...</p>
        <div className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
    </section>
  );
}

export default GeneratingBook;
