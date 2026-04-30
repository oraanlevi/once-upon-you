import { useState } from 'react';

// mode: 'login' | 'register' | 'forgot' | 'forgot-sent'
function AuthModal({ onClose, onSuccess, apiBase }) {
  const [mode, setMode] = useState('login');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const switchMode = (next) => { setMode(next); setError(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const res = await fetch(`${apiBase}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
        setMode('forgot-sent');
        return;
      }

      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const body = mode === 'login'
        ? { email, password }
        : { email, password, firstName, lastName };

      const res = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return; }
      onSuccess(data.token, data.user);
    } catch {
      setError('Unable to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'forgot-sent') {
    return (
      <div className="auth-modal-backdrop" onClick={onClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">×</button>
          <div className="auth-modal-header">
            <div style={{ fontSize: 36, marginBottom: 12 }}>📬</div>
            <h2 className="auth-modal-title">Check your inbox</h2>
            <p className="auth-modal-sub">
              If an account exists for <strong>{email}</strong>, we've sent a password reset link. Check your spam folder too.
            </p>
          </div>
          <button type="button" className="auth-submit" onClick={onClose}>Done</button>
          <p className="auth-switch">
            <button type="button" className="auth-switch-btn" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="auth-modal-header">
          <h2 className="auth-modal-title">
            {mode === 'login' ? 'Welcome back' : mode === 'forgot' ? 'Reset your password' : 'Create your account'}
          </h2>
          <p className="auth-modal-sub">
            {mode === 'login'
              ? 'Log in to view your orders and saved details.'
              : mode === 'forgot'
              ? "Enter your email and we'll send you a reset link."
              : 'Save your shipping info and track your orders.'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <div className="auth-form-row">
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-first">First name</label>
                <input id="auth-first" className="auth-input" type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" autoComplete="given-name" />
              </div>
              <div className="auth-field">
                <label className="auth-label" htmlFor="auth-last">Last name</label>
                <input id="auth-last" className="auth-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Smith" autoComplete="family-name" />
              </div>
            </div>
          )}

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input id="auth-email" className="auth-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" required />
          </div>

          {mode !== 'forgot' && (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-password">Password</label>
              <input id="auth-password" className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={mode === 'register' ? 'At least 6 characters' : '••••••••'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
              {mode === 'login' && (
                <button type="button" className="auth-forgot-link" onClick={() => switchMode('forgot')}>
                  Forgot password?
                </button>
              )}
            </div>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'login' ? 'Log In'
              : mode === 'forgot' ? 'Send Reset Link'
              : 'Create Account'}
          </button>
        </form>

        {mode !== 'forgot' && (
          <p className="auth-switch">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button type="button" className="auth-switch-btn" onClick={() => switchMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        )}

        {mode === 'forgot' && (
          <p className="auth-switch">
            <button type="button" className="auth-switch-btn" onClick={() => switchMode('login')}>
              Back to log in
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

export default AuthModal;
