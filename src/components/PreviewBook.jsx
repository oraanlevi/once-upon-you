function PreviewBook({
  pageCount,
  generatedImages,
  uploads,
  onBackToUploads,
  onFinishOrder,
}) {
  const totalPages = Math.max(
    Number(pageCount) || 0,
    uploads?.length || 0,
    generatedImages?.length || 0,
  );
  const spreads = [];

  for (let index = 0; index < totalPages; index += 2) {
    spreads.push([index, index + 1]);
  }

  return (
    <section className="preview-step" aria-labelledby="preview-book-title">
      <div className="preview-shell">
        <div className="preview-top">
          <p className="builder-eyebrow">Chapter 4</p>
          <h2 id="preview-book-title">Preview Your Book</h2>
          <p className="preview-note">
            These are placeholder preview pages. Final artwork will be refined in
            the completed coloring book.
          </p>
        </div>

        <div className="preview-book-spreads">
          {spreads.map(([leftIndex, rightIndex]) => (
            <article className="book-spread" key={`spread-${leftIndex + 1}`}>
              {[leftIndex, rightIndex].map((index) => {
                if (index >= totalPages) {
                  return <div className="preview-page empty-page" key={`empty-${index}`} aria-hidden="true" />;
                }

                const uploadedImage = uploads?.[index] ?? null;
                const generatedImage = generatedImages?.[index];
                const hasGenerated =
                  generatedImage &&
                  typeof generatedImage.url === 'string' &&
                  generatedImage.url.length > 0;
                const imageToRender = hasGenerated ? generatedImage : uploadedImage;
                const usedFallback = !hasGenerated && Boolean(uploadedImage);

                return (
                  <div className="preview-page" key={index + 1}>
                    <div className="preview-page-media">
                      {imageToRender &&
                      typeof imageToRender.url === 'string' &&
                      imageToRender.url.length > 0 ? (
                        <img
                          src={imageToRender.url}
                          alt={`Preview Page ${index + 1}`}
                          className="preview-image"
                        />
                      ) : (
                        <div className="preview-image-fallback" aria-hidden="true" />
                      )}
                    </div>
                    <p className="preview-label">Page {index + 1}</p>
                    {usedFallback ? (
                      <p className="preview-fallback-note">Original photo shown for this page.</p>
                    ) : null}
                  </div>
                );
              })}
            </article>
          ))}
        </div>

        <div className="preview-actions">
          <button type="button" className="upload-back" onClick={onBackToUploads}>
            Back to Uploads
          </button>
          <button type="button" className="create-book-button" onClick={onFinishOrder}>
            Finish My Order
          </button>
        </div>
      </div>
    </section>
  );
}

export default PreviewBook;
