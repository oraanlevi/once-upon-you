function TopProgressBar({ steps, currentStep, onNavigate }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep),
  );

  return (
    <nav className="top-progress-bar" aria-label="Order progress">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isActive = index === currentIndex;
        const isClickable = step.key !== 'preview' && typeof onNavigate === 'function';
        const stateClass = isComplete ? 'is-complete' : isActive ? 'is-active' : 'is-upcoming';

        return (
          <div className={`top-progress-step ${stateClass}`} key={step.key}>
            {index > 0 && <span className="progress-sep" aria-hidden="true" />}
            {isClickable ? (
              <button
                type="button"
                className="top-progress-chip"
                onClick={() => onNavigate(step.key)}
                aria-current={isActive ? 'step' : undefined}
              >
                {isComplete && (
                  <svg className="chip-check" width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                    <circle cx="6.5" cy="6.5" r="6.5" fill="currentColor" fillOpacity="0.18"/>
                    <path d="M3.5 6.5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {step.shortLabel || step.label}
              </button>
            ) : (
              <span className="top-progress-chip">
                {step.shortLabel || step.label}
              </span>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export default TopProgressBar;
