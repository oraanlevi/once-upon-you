function StepTracker({ steps, currentStep }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep),
  );
  const currentLabel = steps[currentIndex]?.label ?? '';

  return (
    <nav className="step-tracker" aria-label="Book chapters">
      <div className="step-tracker-head">
        <p className="step-chapter-kicker">Book Chapters</p>
        <p className="step-chapter">Chapter {currentIndex + 1}</p>
        <p className="step-current-title">{currentLabel}</p>
      </div>

      <ol className="step-tracker-list">
        {steps.map((step, index) => {
          const isComplete = index < currentIndex;
          const isCurrent = index === currentIndex;
          const stateClass = isComplete
            ? 'is-complete'
            : isCurrent
              ? 'is-current'
              : 'is-upcoming';

          return (
            <li className={`step-tracker-item ${stateClass}`} key={step.key}>
              <span className="step-marker" aria-hidden="true" />
              <span className="step-index">
                {isComplete ? '✓' : index + 1}
              </span>
              <span className="step-label">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StepTracker;
