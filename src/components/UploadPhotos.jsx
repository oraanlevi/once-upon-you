import { useRef } from 'react';
import UploadCard from './UploadCard';

const ACCEPTED_UPLOAD_TYPES =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

function isSupportedUploadFile(file) {
  if (!(file instanceof File)) return false;
  if (file.type.startsWith('image/')) return true;
  const ext = file.name.toLowerCase().match(/(\.[a-z0-9]+)$/)?.[1] || '';
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(ext);
}

function UploadPhotos({
  pageCount,
  uploads,
  onUpload,
  onBack,
  onCreateBook,
  generationError,
}) {
  const bulkInputRef = useRef(null);
  const uploadedCount = uploads.filter(Boolean).length;
  const allUploaded = uploadedCount === pageCount;

  const handleBulkSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(isSupportedUploadFile);
    files.slice(0, pageCount).forEach((file, i) => onUpload(i, file));
    e.target.value = '';
  };

  return (
    <section className="upload-step" aria-labelledby="upload-step-title">
      <div className="upload-shell upload-shell--focused">
        <div className="upload-top upload-top--focused">
          <button type="button" className="upload-back" onClick={onBack}>
            Back
          </button>
          <p className="builder-eyebrow">Step 2 of 3</p>
          <h2 id="upload-step-title">Upload your photos</h2>
          <p className="builder-lede upload-intro">
            Each photo becomes its own coloring page.
          </p>
          <div className="upload-guidance">
            <div className="upload-guidance-title">📸 Tips for the best coloring pages</div>
            <div className="upload-guidance-grid">
              <div className="upload-guidance-item upload-guidance-item--good">
                <span className="guidance-icon">✓</span>
                <span>Clear, well-lit photo — faces, scenes, places, anything</span>
              </div>
              <div className="upload-guidance-item upload-guidance-item--good">
                <span className="guidance-icon">✓</span>
                <span>Subject fills most of the frame</span>
              </div>
              <div className="upload-guidance-item upload-guidance-item--good">
                <span className="guidance-icon">✓</span>
                <span>Sharp focus — not blurry or motion-blurred</span>
              </div>
              <div className="upload-guidance-item upload-guidance-item--bad">
                <span className="guidance-icon">✗</span>
                <span>Dark, shadowy, or backlit photos</span>
              </div>
              <div className="upload-guidance-item upload-guidance-item--good">
                <span className="guidance-icon">✓</span>
                <span>Groups, events, candid moments — all welcome</span>
              </div>
              <div className="upload-guidance-item upload-guidance-item--good">
                <span className="guidance-icon">✓</span>
                <span>Sunglasses, hats, full scenes — it's about the vibe</span>
              </div>
            </div>
          </div>
          <p className="upload-progress">
            {uploadedCount} of {pageCount} pages have a photo ready
          </p>
          {generationError ? <p className="generation-error">{generationError}</p> : null}
        </div>

        <div className="upload-bulk-row">
          <input
            ref={bulkInputRef}
            type="file"
            accept={ACCEPTED_UPLOAD_TYPES}
            multiple
            className="upload-input"
            onChange={handleBulkSelect}
          />
          <button
            type="button"
            className="upload-bulk-btn"
            onClick={() => bulkInputRef.current?.click()}
          >
            📂 Select all {pageCount} photos at once
          </button>
          {uploadedCount > 0 && (
            <span className="upload-bulk-hint">{uploadedCount} of {pageCount} filled</span>
          )}
        </div>

        <div className="upload-grid upload-grid--focused">
          {uploads.map((image, index) => (
            <UploadCard
              key={index + 1}
              pageNumber={index + 1}
              image={image}
              onUpload={(file) => onUpload(index, file)}
            />
          ))}
        </div>

        <div className="upload-footer upload-footer--focused">
          <button
            type="button"
            className="create-book-button"
            disabled={!allUploaded}
            onClick={onCreateBook}
          >
            Continue to Preview
          </button>
        </div>
      </div>
    </section>
  );
}

export default UploadPhotos;
