import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Rocket } from 'lucide-react';
import { API_BASE_URL } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/auth/register`, {
        email,
        password,
        name: 'Scientist'
      }).catch(async (err) => {
        if (err.response && err.response.status === 400) {
           return await axios.post(`${API_BASE_URL}/auth/login`, { email, password });
        }
        throw err;
      });

      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
            Welcome to <span>MissionMind</span>
          </h2>
          <p>Login to access MEDA telemetry, anomaly intelligence, and evidence-backed mission analysis.</p>
        </div>

        <form className="auth-form" onSubmit={handleLogin}>
          {error && <div className="auth-error">{error}</div>}

          <label className="field-wrap">
            <span>Email address</span>
            <input
              type="email"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="scientist@missionmind.ai"
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
              required
            />
          </label>

          <button type="submit" className="btn auth-submit" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
