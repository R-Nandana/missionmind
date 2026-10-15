import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Rocket, ShieldCheck, UserRoundPlus } from 'lucide-react';
import { API_BASE_URL } from '../api';

export default function Login() {
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const endpoint = mode === 'register'
        ? '/auth/register'
        : mode === 'admin'
          ? '/auth/admin-login'
          : '/auth/login';
      const payload = mode === 'register'
        ? { name, email, password }
        : { email, password };
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, payload);

      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const selectMode = (nextMode) => {
    setMode(nextMode);
    setError('');
  };

  return (
    <div className="auth-shell">
      <div className="auth-orb orb-one" />
      <div className="auth-orb orb-two" />

      <div className="auth-card glass-panel animate-fade-in">
        <div className="auth-header">
          <div className="auth-logo">
            <Rocket size={42} />
          </div>
          <div className="eyebrow">Mission Control</div>
          <h2>
            {mode === 'register' ? 'Create your' : mode === 'admin' ? 'Admin' : 'Welcome to'}
            <span>{mode === 'admin' ? 'MissionMind' : mode === 'register' ? 'account' : 'MissionMind'}</span>
          </h2>
          <p>
            {mode === 'register'
              ? 'Create a scientist account to access MEDA telemetry and mission analysis.'
              : mode === 'admin'
                ? 'Sign in with the administrator credentials configured for this deployment.'
                : 'Sign in to access MEDA telemetry, anomaly intelligence, and evidence-backed mission analysis.'}
          </p>
        </div>

        <div className="auth-mode-switch" role="group" aria-label="Account access type">
          <button
            type="button"
            className={`btn btn-secondary auth-mode-button ${mode === 'login' ? 'active' : ''}`}
            onClick={() => selectMode('login')}
            aria-pressed={mode === 'login'}
            disabled={loading}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`btn btn-secondary auth-mode-button ${mode === 'register' ? 'active' : ''}`}
            onClick={() => selectMode('register')}
            aria-pressed={mode === 'register'}
            disabled={loading}
          >
            <UserRoundPlus size={15} /> Create account
          </button>
          <button
            type="button"
            className={`btn btn-secondary auth-mode-button ${mode === 'admin' ? 'active' : ''}`}
            onClick={() => selectMode('admin')}
            aria-pressed={mode === 'admin'}
            disabled={loading}
          >
            <ShieldCheck size={15} /> Admin
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}

          {mode === 'register' && (
            <label className="field-wrap">
              <span>Name</span>
              <input
                type="text"
                className="input-field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="field-wrap">
            <span>Email address</span>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'admin' ? 'admin@missionmind.ai' : 'scientist@missionmind.ai'}
              autoComplete="email"
              required
            />
          </label>

          <label className="field-wrap">
            <span>Password</span>
            <input
              type="password"
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={mode === 'register' ? 8 : undefined}
              required
            />
          </label>

          <button type="submit" className="btn auth-submit" disabled={loading}>
            {loading
              ? mode === 'register' ? 'Creating account...' : 'Authenticating...'
              : mode === 'register' ? 'Create Account' : mode === 'admin' ? 'Admin Sign In' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
