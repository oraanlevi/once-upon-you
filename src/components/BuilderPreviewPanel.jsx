import { formatMoney } from '../utils/pricing';

const PREVIEW_THEME = {
  'digital-book': 'digital',
  'pocket-book': 'pocket',
  'large-book': 'large',
  'premium-keepsake-book': 'premium',
};

function getPreviewTheme(product) {
  return PREVIEW_THEME[product?.id] || 'large';
}

function getPreviewImages({ generatedImages = [], uploadedImages = [] }) {
  const generated = Array.isArray(generatedImages) ? generatedImages.filter(Boolean) : [];
  if (generated.length) {
    return generated.slice(0, 3);
  }

  const uploaded = Array.isArray(uploadedImages) ? uploadedImages.filter(Boolean) : [];
  return uploaded.slice(0, 3);
}

function BuilderPreviewPanel({
  chapterLabel,
  selectedProduct,
  cartSummary,
  uploadedImages = [],
  generatedImages = [],
  detailText = '',
}) {
  const previewTheme = getPreviewTheme(selectedProduct);
  const previewImages = getPreviewImages({ generatedImages, uploadedImages });
  const pageCount = cartSummary?.selectedPageCount || 0;
  const addOnCount = cartSummary?.addOns?.length || 0;
  const total = cartSummary?.totalCents || 0;

  return (
    <aside className="builder-preview-panel" aria-label="Live book preview">
      <div className="builder-preview-head">
        <p className="builder-eyebrow">{chapterLabel}</p>
        <h3>Your Book in Progress</h3>
        <p className="builder-preview-copy">
          {detailText || 'A live keepsake preview stays here while you build chapter by chapter.'}
        </p>
      </div>

      <div className={`keepsake-stage keepsake-stage--${previewTheme}`}>
        <div className="keepsake-book" style={{ '--page-depth': Math.max(6, Math.min(pageCount, 30)) }}>
          <div className="keepsake-book-spine" />
          <div className="keepsake-book-pages" />
          <div className="keepsake-book-cover">
            <span className="keepsake-book-emblem" />
            <span className="keepsake-book-title">{selectedProduct?.name || 'Twice Upon Us'}</span>
            <span className="keepsake-book-subtitle">
              {pageCount ? `${pageCount} pages` : 'Choose your format'}
            </span>
          </div>
        </div>
      </div>

      <div className="builder-preview-meta">
        <p>
          <span>Format</span>
          <strong>{selectedProduct?.name || 'Not chosen yet'}</strong>
        </p>
        <p>
          <span>Pages</span>
          <strong>{pageCount ? `${pageCount} selected` : 'Choose pages'}</strong>
        </p>
        <p>
          <span>Extras</span>
          <strong>{addOnCount ? `${addOnCount} selected` : 'Optional'}</strong>
        </p>
        <p>
          <span>Current total</span>
          <strong>{total ? formatMoney(total) : 'Build your book'}</strong>
        </p>
      </div>

      <div className="builder-preview-strip" aria-label="Page snapshots">
        {previewImages.length
          ? previewImages.map((image, index) => (
              <span className="builder-preview-thumb" key={`preview-thumb-${index + 1}`}>
                <img src={image.url} alt="" />
              </span>
            ))
          : Array.from({ length: 3 }, (_, index) => (
              <span className="builder-preview-thumb is-placeholder" key={`preview-placeholder-${index + 1}`}>
                <span>{index === 0 ? 'Cover' : `Page ${index}`}</span>
              </span>
            ))}
      </div>
    </aside>
  );
}

export default BuilderPreviewPanel;
