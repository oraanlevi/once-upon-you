import { useState } from 'react';

const LOGO_SRC = '/src/assets/logo.png';

function BrandLogo({ className = '' }) {
  const [hasError, setHasError] = useState(false);

  if (hasError) {
    return <span className={`brand-logo-fallback ${className}`.trim()} aria-hidden="true" />;
  }

  return (
    <img
      className={className}
      src={LOGO_SRC}
      alt="Once Upon You"
      onError={() => setHasError(true)}
    />
  );
}

export default BrandLogo;
