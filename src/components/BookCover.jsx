import BrandLogo from './BrandLogo';

function BookCover({ isOpening, onStart }) {
  return (
    <section className={`book-scene ${isOpening ? 'is-opening' : ''}`}>
      <div className="book-shell">
        <div className="book-spine" aria-hidden="true" />

        <div className="book-inside" aria-hidden="true">
          <div className="inside-glow" />
        </div>

        <article className="book-cover" aria-label="Once Upon You cover">
          <div className="cover-filigree" aria-hidden="true" />
          <div className="cover-content">
            <BrandLogo className="cover-logo" />
            <p className="cover-kicker">A Story Worth Holding</p>
            <h1 className="cover-title">Once Upon You</h1>
            <p className="cover-tagline">
              Turn cherished moments into a personalized coloring book that
              feels like your own fairytale keepsake.
            </p>
            <button
              type="button"
              className="cover-button"
              onClick={onStart}
              disabled={isOpening}
            >
              Start Your Book
            </button>
          </div>
        </article>
      </div>
    </section>
  );
}

export default BookCover;
