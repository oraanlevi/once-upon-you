function StepTracker({ steps, currentStep, onNavigate }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep),
  );

  return (
    <nav className="step-tracker" aria-label="Builder navigation">
      <div className="step-tracker-head">
        <p className="step-chapter-kicker">Builder</p>
        <p className="step-current-title">Twice Upon Us</p>
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
          const canNavigate = onNavigate && step.key !== 'preview' && !isCurrent;

          return (
            <li
              className={`step-tracker-item ${stateClass}${canNavigate ? ' is-clickable' : ''}`}
              key={step.key}
              onClick={canNavigate ? () => onNavigate(step.key) : undefined}
              role={canNavigate ? 'button' : undefined}
              tabIndex={canNavigate ? 0 : undefined}
              onKeyDown={canNavigate ? (e) => e.key === 'Enter' && onNavigate(step.key) : undefined}
              aria-label={canNavigate ? `Go back to ${step.label}` : undefined}
            >
              <span className="step-icon" aria-hidden="true">
                {step.icon || '•'}
              </span>
              <span className="step-label-wrap">
                <span className="step-label">{step.label}</span>
                <span className="step-label-chapter">
                  {isComplete ? 'Completed' : isCurrent ? 'Current step' : `Step ${index + 1}`}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default StepTracker;
