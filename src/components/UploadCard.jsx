import { useId, useRef, useState } from 'react';

const ACCEPTED_UPLOAD_TYPES =
  '.jpg,.jpeg,.png,.webp,.heic,.heif,image/jpeg,image/png,image/webp,image/heic,image/heif';

// Subtle alternating tilts for organic polaroid feel
const TILTS = [-1.8, 1.2, -0.7, 1.6, -1.3, 0.9, -1.5, 1.1, -0.8, 1.4];

function getFileExtension(filename = '') {
  const match = String(filename).toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match ? match[1] : '';
}

function isSupportedUploadFile(file) {
  if (!(file instanceof File)) return false;
  if (file.type.startsWith('image/')) return true;
  return ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'].includes(getFileExtension(file.name));
}

function UploadCard({ pageNumber, image, onUpload }) {
  const inputId = useId();
  const inputRef = useRef(null);
  const dragDepthRef = useRef(0);
  const [isDragActive, setIsDragActive] = useState(false);

  const tilt = TILTS[(pageNumber - 1) % TILTS.length];

  const handleSelectedFile = (file) => {
    if (!isSupportedUploadFile(file)) return;
    onUpload(file);
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
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
    if (dragDepthRef.current === 0) setIsDragActive(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current = 0;
    setIsDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    handleSelectedFile(file);
  };

  const safeImageUrl =
    image && typeof image.url === 'string' && image.url.length > 0 ? image.url : '';

  return (
    <article
      className={`polaroid-card${isDragActive ? ' is-drag-active' : ''}${safeImageUrl ? ' has-photo' : ''}`}
      style={{ '--tilt': `${tilt}deg` }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <div className="polaroid-photo">
        {safeImageUrl ? (
          <img
            src={safeImageUrl}
            alt={`Page ${pageNumber} photo`}
            className="polaroid-img"
          />
        ) : (
          <div className="polaroid-empty" aria-hidden="true" />
        )}
        {isDragActive && (
          <div className="upload-drop-indicator" aria-hidden="true">
            <span>Drop here</span>
          </div>
        )}
      </div>
      <div className="polaroid-caption">
        {safeImageUrl ? `Photo ${pageNumber}` : `Page ${pageNumber}`}
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={ACCEPTED_UPLOAD_TYPES}
        className="upload-input"
        onChange={handleFileChange}
      />
    </article>
  );
}

export default UploadCard;
