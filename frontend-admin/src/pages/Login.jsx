import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, ApiError } from '../lib/auth';
import Button from '../components/ui/Button';
import './Login.css';

export default function Login() {
  const { signIn, status } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (status === 'signed-in') {
    return <Navigate to={location.state?.from || '/'} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login">
      <div className="login__panel">
        <div className="login__brand">
          <img
            className="login__brand-mark"
            src="/assets/pf-new-logo.png"
            alt="Prashanth Fertility"
            width="36"
            height="36"
          />
          <div>
            <p className="login__brand-name">Prashanth Fertility</p>
            <p className="login__brand-sub">Events Admin</p>
          </div>
        </div>

        <h1 className="login__title">Sign in</h1>
        <p className="login__subtitle">Manage events, registrations and check-in from one place.</p>

        <form className="login__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="field__label">Email</span>
            <input
              className="field__input"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@prashanthhospitals.com"
            />
          </label>

          <label className="field">
            <span className="field__label">Password</span>
            <input
              className="field__input"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="login__error" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" fullWidth disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>

      <div className="login__aside" aria-hidden="true">
        <div className="login__aside-content">
          <p className="login__aside-eyebrow">Fertility &amp; Gynaecology</p>
          <h2 className="login__aside-title">Run every event from one dashboard</h2>
          <p className="login__aside-text">
            Content, tickets, promo codes, payments, check-in and reports — all in one place, all in
            sync with the public microsite.
          </p>
        </div>
      </div>
    </div>
  );
}
