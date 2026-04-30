import { formatMoney, getDefaultPageCount, PRODUCT_TYPE_LABELS } from '../utils/pricing';

function FeaturedProducts({ products, weeklyFavoriteProductId }) {
  const weeklyFavorite =
    products.find((product) => product.id === weeklyFavoriteProductId) ||
    products.find((product) => product.isWeeklyFavorite) ||
    null;
  const featured = products.filter((product) => product.isFeatured);

  if (!weeklyFavorite && !featured.length) {
    return null;
  }

  const favoriteDefaultPageCount = getDefaultPageCount(
    (weeklyFavorite || featured[0])?.availablePageCounts,
  );

  return (
    <section className="featured-pricing" aria-labelledby="featured-pricing-title">
      <div className="featured-weekly-card">
        <p className="builder-eyebrow">Favorite of the Week</p>
        <h3 id="featured-pricing-title">{weeklyFavorite?.name || featured[0].name}</h3>
        <p className="featured-copy">
          {(weeklyFavorite || featured[0]).description}
        </p>
        <p className="featured-weekly-price">
          {weeklyFavorite?.compareAtPriceCents ? (
            <span className="featured-compare">
              {formatMoney(
                weeklyFavorite.compareAtPriceCents +
                  (weeklyFavorite.pricePerPageCents || 0) *
                    favoriteDefaultPageCount,
              )}
            </span>
          ) : null}
          <strong>
            {formatMoney(
              (weeklyFavorite || featured[0]).basePriceCents +
                ((weeklyFavorite || featured[0]).pricePerPageCents || 0) *
                  favoriteDefaultPageCount,
            )}
          </strong>
        </p>
      </div>

      <div className="featured-grid" role="list" aria-label="Featured product pricing">
        {featured.map((product) => {
          const pageCount = getDefaultPageCount(product.availablePageCounts);
          const baseForPages = product.basePriceCents + (product.pricePerPageCents || 0) * pageCount;

          return (
            <article className="featured-card" key={product.id} role="listitem">
              <p className="featured-type">{PRODUCT_TYPE_LABELS[product.productType] || product.productType}</p>
              <h4>{product.name}</h4>
              <p>{product.description}</p>
              <p className="featured-price-row">
                {typeof product.compareAtPriceCents === 'number' &&
                product.compareAtPriceCents > product.basePriceCents ? (
                  <span className="featured-compare">
                    {formatMoney(product.compareAtPriceCents + (product.pricePerPageCents || 0) * pageCount)}
                  </span>
                ) : null}
                <strong>{formatMoney(baseForPages)}</strong>
              </p>
              <p className="featured-page-note">
                {`for ${pageCount} pages (${formatMoney(product.pricePerPageCents || 0)}/page)`}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default FeaturedProducts;
