import UploadCard from './UploadCard';

function UploadPhotos({
  pageCount,
  uploads,
  onUpload,
  onBack,
  onCreateBook,
  generationError,
}) {
  const uploadedCount = uploads.filter(Boolean).length;
  const allUploaded = uploadedCount === pageCount;

  return (
    <section className="upload-step" aria-labelledby="upload-step-title">
      <div className="upload-shell">
        <div className="upload-top">
          <button type="button" className="upload-back" onClick={onBack}>
            Back
          </button>
          <p className="builder-eyebrow">Chapter 3</p>
          <h2 id="upload-step-title">Upload Your Photos</h2>
          <p className="upload-progress">
            Page {uploadedCount} of {pageCount} uploaded
          </p>
          {generationError ? <p className="generation-error">{generationError}</p> : null}
        </div>

        <div className="upload-grid">
          {uploads.map((image, index) => (
            <UploadCard
              key={index + 1}
              pageNumber={index + 1}
              image={image}
              onUpload={(file) => onUpload(index, file)}
            />
          ))}
        </div>

        <div className="upload-footer">
          <button
            type="button"
            className="create-book-button"
            disabled={!allUploaded}
            onClick={onCreateBook}
          >
            Create My Book
          </button>
        </div>
      </div>
    </section>
  );
}

export default UploadPhotos;
