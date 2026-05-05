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
  const pct = Math.round((uploadedCount / pageCount) * 100);

  const handleBulkSelect = (e) => {
    const files = Array.from(e.target.files || []).filter(isSupportedUploadFile);
    files.slice(0, pageCount).forEach((file, i) => onUpload(i, file));
    e.target.value = '';
  };

  return (
    <section className="upload-step" aria-labelledby="upload-step-title">
      <div className="upload-shell upload-shell--focused">

        {/* ── Header ── */}
        <div className="upload-top upload-top--focused">
          <button type="button" className="upload-back" onClick={onBack}>← Back</button>
          <p className="builder-eyebrow">Step 2 of 3</p>
          <h2 id="upload-step-title">Upload your photos</h2>
          <p className="builder-lede upload-intro">
            Each photo becomes its own coloring page — clear, well-lit shots work best.
          </p>
        </div>

        {/* ── Bulk upload zone ── */}
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
          className="upload-drop-zone"
          onClick={() => bulkInputRef.current?.click()}
        >
          <span className="upload-drop-zone-icon">🖼️</span>
          <span className="upload-drop-zone-label">
            {uploadedCount === 0
              ? `Choose all ${pageCount} photos at once`
              : `Add or replace photos`}
          </span>
          <span className="upload-drop-zone-hint">JPG, PNG, HEIC · tap to browse</span>
        </button>

        {/* ── Progress bar ── */}
        {uploadedCount > 0 && (
          <div className="upload-progress-bar-wrap">
            <div className="upload-progress-bar-track">
              <div className="upload-progress-bar-fill" style={{ width: `${pct}%` }} />
            </div>
            <span className="upload-progress-bar-label">
              {uploadedCount} of {pageCount} photos ready
            </span>
          </div>
        )}

        {generationError && <p className="generation-error">{generationError}</p>}

        {/* ── Individual slots ── */}
        <div className="upload-slots-label">Or upload one by one</div>
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

        {/* ── Footer ── */}
        <div className="upload-footer upload-footer--focused">
          {!allUploaded && (
            <p className="upload-remaining-note">
              {pageCount - uploadedCount} photo{pageCount - uploadedCount !== 1 ? 's' : ''} still needed
            </p>
          )}
          <button
            type="button"
            className="create-book-button"
            disabled={!allUploaded}
            onClick={onCreateBook}
          >
            Continue to Preview →
          </button>
        </div>

      </div>
    </section>
  );
}

export default UploadPhotos;
