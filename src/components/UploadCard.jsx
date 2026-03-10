import { useId, useRef } from 'react';

function UploadCard({ pageNumber, image, onUpload }) {
  const inputId = useId();
  const inputRef = useRef(null);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    onUpload(file);
    event.target.value = '';
  };

  const safeImageUrl =
    image && typeof image.url === 'string' && image.url.length > 0
      ? image.url
      : '';

  return (
    <article className="upload-card">
      <header className="upload-card-header">Page {pageNumber}</header>

      <div className="upload-card-body">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={`Page ${pageNumber} uploaded preview`}
            className="upload-preview"
          />
        ) : (
          <div className="upload-placeholder" aria-hidden="true" />
        )}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept="image/*"
        className="upload-input"
        onChange={handleFileChange}
      />

      <button
        type="button"
        className="upload-action"
        onClick={() => inputRef.current?.click()}
      >
        {safeImageUrl ? 'Replace Photo' : 'Upload Photo'}
      </button>
    </article>
  );
}

export default UploadCard;
