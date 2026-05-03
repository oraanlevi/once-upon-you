function ProductShowcase({ onContinue }) {
  return (
    <section className="showcase-page">
      <div className="showcase-page-inner">

        <div className="showcase-page-text">
          <p className="showcase-page-kicker">Here's how it works</p>
          <h2 className="showcase-page-title">Your photos<br />become art.</h2>
          <p className="showcase-page-sub">
            Every photo you upload gets individually transformed into a stunning
            coloring page. No templates, no stock art. Just your
            memories illustrated. And the cover? <strong>That's on us 😉</strong> We
            design it entirely from the images you provide.
          </p>
          <button type="button" className="showcase-page-cta" onClick={onContinue}>
            Choose Your Book →
          </button>
        </div>

        <div className="showcase-page-photos">
          {/* Top row */}
          <div className="showcase-photo-card">
            <img src="/images/book-sizes.jpg" alt="Pocket and large book sizes" className="showcase-photo-img" />
            <div className="showcase-photo-label"><span>Two sizes</span><span className="showcase-photo-sub">Pocket &amp; Large</span></div>
          </div>
          <div className="showcase-photo-card">
            <img src="/images/lifestyle.jpg" alt="Twice Upon Us in the wild" className="showcase-photo-img showcase-photo-img--life" />
            <div className="showcase-photo-label"><span>Made to share</span><span className="showcase-photo-sub">Real stories, real people</span></div>
          </div>
          <div className="showcase-photo-card">
            <img src="/images/photo-sample.jpg" alt="A memory turned into art" className="showcase-photo-img" />
            <div className="showcase-photo-label"><span>Your memories</span><span className="showcase-photo-sub">Turned into coloring pages</span></div>
          </div>

          {/* Bottom row — offset down for stagger */}
          <div className="showcase-photo-card showcase-photo-offset">
            <img src="/images/photo-sample-2.jpg" alt="A personal moment illustrated" className="showcase-photo-img" />
            <div className="showcase-photo-label"><span>Every moment</span><span className="showcase-photo-sub">Beautifully illustrated</span></div>
          </div>
          <div className="showcase-photo-card showcase-photo-offset">
            <img src="/images/photo-sample-3.jpg" alt="Child coloring their personalized book" className="showcase-photo-img" />
            <div className="showcase-photo-label"><span>Hours of fun</span><span className="showcase-photo-sub">Kids love coloring their story</span></div>
          </div>
          <div className="showcase-photo-card showcase-photo-offset">
            <img src="/images/photo-sample-4.jpg" alt="A cherished family memory" className="showcase-photo-img" />
            <div className="showcase-photo-label"><span>Cherished forever</span><span className="showcase-photo-sub">A keepsake they'll keep</span></div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default ProductShowcase;
