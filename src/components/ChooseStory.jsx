export const STORY_THEMES = [
  {
    id: 'beach-days',
    label: 'Beach Days',
    emoji: '☼',
    accent: '#f4a85a',
    gradient: 'linear-gradient(135deg, #fff3e0 0%, #ffcc80 100%)',
    description: 'Sandy toes and the kind of light that makes everything golden.',
    tagline: 'The kind of trip you never want to forget.',
    inspiration: 'Think beach days, sunsets, palm trees, ocean views, swimsuits, sandy toes, vacation mornings ☼',
  },
  {
    id: 'best-friends',
    label: 'Best Friends',
    emoji: '♡',
    accent: '#e57fa0',
    gradient: 'linear-gradient(135deg, #fce4ec 0%, #f48fb1 100%)',
    description: 'The ones who show up in every chapter.',
    tagline: 'Your favorite memories together, turned into something personal.',
    inspiration: 'Think mirror selfies, dinners, coffee runs, matching outfits, candid laughs, sleepovers, travel moments ♡',
  },
  {
    id: 'love-story',
    label: 'Love Story',
    emoji: '♡',
    accent: '#c2185b',
    gradient: 'linear-gradient(135deg, #fdf2f8 0%, #e91e8c22 50%, #f8bbd0 100%)',
    description: 'Every quiet moment between you two.',
    tagline: 'Your favorite person, turned into a keepsake.',
    inspiration: 'Think date nights, flowers, sunsets, hand holding, cozy moments, vacations together ♡',
  },
  {
    id: 'pet-memories',
    label: 'Pet Memories',
    emoji: '🐾',
    accent: '#9c4dcc',
    gradient: 'linear-gradient(135deg, #ede7f6 0%, #ce93d8 100%)',
    description: 'Honestly? They deserved their own book.',
    tagline: 'Their little moments, forever remembered 🐾',
    inspiration: 'Think sleepy faces, park days, favorite toys, cuddles, funny little moments 🐾',
  },
  {
    id: 'baby-family',
    label: 'Family',
    emoji: '☁',
    accent: '#43a047',
    gradient: 'linear-gradient(135deg, #e8f5e9 0%, #a5d6a7 100%)',
    description: 'Blink and they grow. This is how you keep it.',
    tagline: 'Favorite family memories, turned into pages to cherish.',
    inspiration: 'Think baby smiles, birthdays, family vacations, tiny moments, cuddles, everyday memories ☁',
  },
  {
    id: 'travel-story',
    label: 'Travel Story',
    emoji: '✈',
    accent: '#1976d2',
    gradient: 'linear-gradient(135deg, #e3f2fd 0%, #64b5f6 100%)',
    description: 'Postcards from places you never want to forget.',
    tagline: 'Every trip deserves its own story.',
    inspiration: 'Think city streets, cafés, passports, sunsets, landmarks, vacation photos ✈',
  },
  {
    id: 'mood-board',
    label: 'Mood Board',
    emoji: '✦',
    accent: '#f9a825',
    gradient: 'linear-gradient(135deg, #fffde7 0%, #ffe082 100%)',
    description: 'A feeling, a season, an aesthetic. Yours.',
    tagline: 'Your aesthetic, turned into something personal.',
    inspiration: 'Think Pinterest photos, flowers, coffee, outfits, magazines, interiors, textures, beauty shots, and dreamy little moments ☁',
  },
];

export const DEFAULT_INSPIRATION = 'Think favorite memories, everyday moments, pets, vacations, flowers, friends, and little things you love ♡';

function ChooseStory({ selectedThemeId, onSelectTheme, onContinue, onSkip }) {
  return (
    <section className="story-step" aria-labelledby="story-step-title">
      <div className="story-shell">
        <div className="story-header">
          <h2 id="story-step-title">Choose Your Story</h2>
          <p className="story-subtitle">
            Pick a theme for inspiration — or create your own story.
          </p>
        </div>

        <div className="story-scroll-track" role="list" aria-label="Story themes">
          {STORY_THEMES.map((theme) => {
            const isSelected = theme.id === selectedThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                role="listitem"
                className={`story-card ${isSelected ? 'is-selected' : ''}`}
                style={{ '--card-gradient': theme.gradient, '--card-accent': theme.accent }}
                onClick={() => onSelectTheme(isSelected ? null : theme.id)}
                aria-pressed={isSelected}
              >
                <span className="story-card-emoji" aria-hidden="true">{theme.emoji}</span>
                <strong className="story-card-label">{theme.label}</strong>
                {isSelected && <span className="story-card-check" aria-hidden="true">✓</span>}
              </button>
            );
          })}
        </div>

        <div className="story-footer">
          <button
            type="button"
            className="create-book-button"
            onClick={onContinue}
          >
            {selectedThemeId ? 'Continue with this theme →' : 'Continue →'}
          </button>
          {selectedThemeId && (
            <button
              type="button"
              className="story-skip-btn"
              onClick={onSkip}
            >
              Skip theme selection
            </button>
          )}
          {!selectedThemeId && (
            <button
              type="button"
              className="story-skip-btn"
              onClick={onSkip}
            >
              Skip — I'll upload any photos
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default ChooseStory;
