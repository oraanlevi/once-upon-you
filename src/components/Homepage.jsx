import BrandLogo from './BrandLogo';

function Homepage({ onStart }) {
  return (
    <section className="sb-cover sb-cover-minimal" id="top" aria-labelledby="sb-cover-title">
      <div className="sb-cover-spine" aria-hidden="true" />

      <div className="sb-cover-mark" aria-hidden="true">
        <span />
      </div>

      <div className="sb-cover-content">
        <div className="sb-cover-logo-wrap" aria-label="Twice Upon Us">
          <BrandLogo className="app-brand-logo" />
        </div>

        <p className="sb-kicker">Cover</p>
        <h1 id="sb-cover-title">A personalized coloring keepsake made from your memories.</h1>
        <p>
          Upload photo {'->'} Generate coloring page {'->'} Build book {'->'} Order keepsake.
        </p>

        <div className="sb-cover-actions">
          <button type="button" className="sb-button sb-button-primary" onClick={onStart}>
            Open Chapter 2
          </button>
        </div>

        <p className="sb-cover-proof">Premium, soft-touch, and made to keep</p>
      </div>

      <div className="sb-cover-orbs" aria-hidden="true">
        <span className="orb orb-main" />
        <span className="orb orb-side orb-left" />
        <span className="orb orb-side orb-right" />
      </div>
    </section>
  );
}

export default Homepage;
