function BookCover({ isOpening, onStart }) {
  return (
    <section className={`book-scene ${isOpening ? 'is-opening' : ''}`}>
      <div className={`book-shell ${isOpening ? '' : 'book-shell--idle'}`}>
        <div className="book-spine" aria-hidden="true" />

        <div className="book-inside" aria-hidden="true">
          <div className="inside-glow" />
        </div>

        <article className="book-cover" aria-label="Twice Upon Us cover">
          <div className="cover-filigree" aria-hidden="true" />
          <div className="cover-edition" aria-hidden="true">Vol. I</div>

          <div className="cover-content">
            <div className="cover-group">
              <img
                src="/images/logo-title-cropped.png"
                alt="Twice Upon Us"
                className="cover-logo-title"
              />
              <p className="cover-tagline">
                Upload your favorite photos and we transform each one into a
                beautiful coloring page, bound into a keepsake book that's
                entirely yours.
              </p>
              <button
                type="button"
                className="cover-button"
                style={{ marginTop: '28px' }}
                onClick={onStart}
                disabled={isOpening}
              >
                Start Your Book
              </button>
            </div>
          </div>
        </article>
      </div>

    </section>
  );
}

export default BookCover;
