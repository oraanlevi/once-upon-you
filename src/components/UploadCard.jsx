import { useId, useRef, useState } from 'react';

const ACCEPTED_UPLOAD_TYPES =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

function getFileExtension(filename = '') {
  const match = String(filename).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isSupportedUploadFile(file) {
  if (!(file instanceof File)) {
    return false;
  }

  if (file.type.startsWith('image/')) {
    return true;
  }

  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(
    getFileExtension(file.name),
  );
}

function UploadCard({ pageNumber, image, onUpload }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const handleSelectedFile = (file) => {
    if (!isSupportedUploadFile(file)) {
      return;
    }

    onUpload(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    handleSelectedFile(file);
    event.target.value = '';
  };

  const handleDragEnter = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragActive(true);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    setIsDragActive(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = Math.max(dragDepthRef.current - 1, 0);

    if (dragDepthRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    handleSelectedFile(file);
  };

  const safeImageUrl =
    image && typeof image.url === 'string' && image.url.length > 0
      ? image.url
      : '';

  return (
    <article
      className={`upload-card${isDragActive ? ' is-drag-active' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <header className="upload-card-header">Page {pageNumber}</header>

      <div className="upload-card-body">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={`Page ${pageNumber} uploaded preview`}
            className="upload-preview"
          />
        ) : (
          <div className="upload-placeholder" aria-hidden="true">
            <img
              src="/src/assets/logo-stacked.png"
              alt=""
              className="upload-placeholder-logo"
            />
          </div>
        )}
        {isDragActive ? (
          <div className="upload-drop-indicator" aria-hidden="true">
            <span>Drop photo here</span>
          </div>
        ) : null}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
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
