const pageOptions = [
  { value: 2, label: '2 pages', tag: 'test' },
  { value: 8, label: '8 pages' },
  { value: 12, label: '12 pages' },
  { value: 16, label: '16 pages' },
  { value: 20, label: '20 pages' },
];

function ChooseBook({ selectedPageCount, onSelect }) {
  return (
    <section className="builder-intro" aria-labelledby="choose-book-title">
      <div className="builder-card">
        <p className="builder-eyebrow">Chapter 2</p>
        <h2 id="choose-book-title">Choose Your Book</h2>

        <div className="builder-options" role="list" aria-label="Page count options">
          {pageOptions.map((option) => (
            <button
              type="button"
              className={`builder-option ${selectedPageCount === option.value ? 'is-selected' : ''}`}
              key={option.value}
              role="listitem"
              onClick={() => onSelect(option.value)}
            >
              <span className="option-main">{option.label}</span>
              {option.tag ? <span className="option-tag">{option.tag}</span> : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

export default ChooseBook;
