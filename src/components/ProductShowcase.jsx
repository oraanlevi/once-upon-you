import { useState } from 'react';

const SLIDES = [
  { src: '/images/book-sizes.jpg',    alt: 'Pocket and large book sizes',          label: 'Two sizes',        sub: 'Pocket & Large' },
  { src: '/images/lifestyle.jpg',     alt: 'Twice Upon Us in the wild',            label: 'Made to share',    sub: 'Real stories, real people' },
  { src: '/images/photo-sample.jpg',  alt: 'A memory turned into art',             label: 'Your memories',    sub: 'Turned into coloring pages' },
  { src: '/images/photo-sample-2.jpg',alt: 'A personal moment illustrated',        label: 'Every moment',     sub: 'Beautifully illustrated' },
  { src: '/images/photo-sample-3.jpg',alt: 'Child coloring their personalized book',label: 'Hours of fun',   sub: 'Kids love coloring their story' },
  { src: '/images/photo-sample-4.jpg',alt: 'A cherished family memory',            label: 'Cherished forever',sub: "A keepsake they'll keep" },
];

function ProductShowcase({ onContinue }) {
  const [current, setCurrent] = useState(0);

  const prev = () => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length);
  const next = () => setCurrent((c) => (c + 1) % SLIDES.length);

  const slide = SLIDES[current];

  return (
    <div className="showcase-page">

      {/* ── Main two-column section ── */}
      <section className="showcase-split">

        {/* LEFT — text */}
        <div className="showcase-page-text">
          <h2 className="showcase-page-title">Your photos<br />become art.</h2>
          <p className="showcase-page-sub">
            Every photo you upload gets individually transformed into a stunning
            coloring page. No templates, no stock art. Just your
            memories illustrated. And the cover? <strong>That's on us 😉</strong> We
            design it entirely from the images you provide.
          </p>
          <button type="button" className="showcase-page-cta showcase-page-cta--full" onClick={onContinue}>
            Choose Your Book →
          </button>
        </div>

        {/* RIGHT — carousel */}
        <div className="showcase-carousel">
          <div className="showcase-carousel-frame">
            <img
              key={current}
              src={slide.src}
              alt={slide.alt}
              className="showcase-carousel-img"
            />
            <div className="showcase-carousel-label">
              <span>{slide.label}</span>
              <span className="showcase-photo-sub">{slide.sub}</span>
            </div>
            <button type="button" className="showcase-carousel-arrow showcase-carousel-arrow--prev" onClick={prev} aria-label="Previous photo">&#8592;</button>
            <button type="button" className="showcase-carousel-arrow showcase-carousel-arrow--next" onClick={next} aria-label="Next photo">&#8594;</button>
          </div>
          <div className="showcase-carousel-dots" role="tablist" aria-label="Photo slides">
            {SLIDES.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === current}
                className={`showcase-carousel-dot ${i === current ? 'is-active' : ''}`}
                onClick={() => setCurrent(i)}
                aria-label={`Go to photo ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* FULL WIDTH — Our Story below */}
        <div className="showcase-story-row">
          <img src="/images/founders.jpg" alt="David and Oraan, founders of Twice Upon Us" className="showcase-founders-img" />
          <div className="showcase-founders-text">
            <h3 className="showcase-founders-title">Our story ♡</h3>
            <p>We're David and Oraan, and we are genuinely obsessed with memories, coloring, and the little moments that deserve to last forever.</p>
            <p>What started as a simple idea quickly turned into something we couldn't stop thinking about. We wanted a way to take your most treasured photos and turn them into something you could actually hold, color, and keep. Something that felt personal, emotional, and a little bit magical.</p>
            <p>Every book is made with real love, from the illustrations to the packaging. We pour ourselves into every single order because we know what it means to you.</p>
            <p>We believe memories should live beyond a camera roll. Whether it's beach days with your best friends, a love story, family road trips, or your pet's funniest moments, we're here to help you relive them, one coloring page at a time.</p>
            <p className="showcase-founders-sign">Thank you for being part of our story. We truly can't wait to help bring yours to life. ♡</p>
          </div>
        </div>

      </section>

      {/* ── Lower band: Reviews + CTA ── */}
      <div className="lp-lower-band">
        <div className="lp-lower-band-divider">
          <span>✦</span>
          <span>✦</span>
          <span>✦</span>
        </div>

        {/* ── Reviews placeholder ── */}
        <section className="lp-section lp-reviews-coming">
          <p className="lp-reviews-coming-text">★ Reviews coming soon — be one of the first</p>
        </section>


      </div>

    </div>
  );
}

export default ProductShowcase;
