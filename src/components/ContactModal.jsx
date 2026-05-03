import { useState } from 'react';

const API = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001').trim().replace(/\/+$/, '');

export default function ContactModal({ onClose }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send message.');
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-modal-backdrop" onClick={onClose}>
      <div className="auth-modal contact-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="contact-title">
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">✕</button>

        {sent ? (
          <div className="contact-success">
            <div className="contact-success-icon">✓</div>
            <h2 id="contact-title">Message sent!</h2>
            <p>We'll get back to you at <strong>{email}</strong> as soon as possible.</p>
            <button type="button" className="auth-submit" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <div className="auth-modal-header">
              <div className="contact-avatar">💬</div>
              <h2 id="contact-title">Get in touch</h2>
              <p>We typically reply within 24 hours.</p>
            </div>

            <form onSubmit={submit} className="auth-form">
              <div className="auth-field-row">
                <div className="auth-field">
                  <label className="auth-label">Your name</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Your email</label>
                  <input
                    type="email"
                    className="auth-input"
                    placeholder="jane@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">Subject</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="What's your question about?"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label className="auth-label">Message</label>
                <textarea
                  className="auth-input contact-textarea"
                  placeholder="Tell us how we can help…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  required
                />
              </div>

              {error && <p className="auth-error">{error}</p>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? 'Sending…' : 'Send Message'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
