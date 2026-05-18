import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import { getHomeRoute } from '../utils/auth';

export default function Login() {
  const { token, user, login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Already logged in — skip the login page
  if (token && user) {
    return <Navigate to={getHomeRoute(user.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', { username, password });
      login(data.token, data.user);
      navigate(getHomeRoute(data.user.role), { replace: true });
    } catch (err) {
      const msg = err.response?.data?.error;
      setError(msg === 'Invalid credentials'
        ? 'Username or password is incorrect'
        : 'Something went wrong — try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={s.page}>
      {/* Background glow */}
      <div style={s.glow} />

      <div style={s.card}>
        {/* Brand */}
        <div style={s.brand}>
          <div style={s.brandName}>PURECODE</div>
          <div style={s.brandSub}>AGENCY</div>
        </div>

        <div style={s.divider} />

        <div style={s.formHeader}>
          <h1 style={s.heading}>Welcome back</h1>
          <p style={s.subheading}>Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} style={s.form}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <input
              id="username"
              className="form-input"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(''); }}
              placeholder="your username"
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              className="form-input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="••••••••••"
              disabled={loading}
              required
            />
          </div>

          {error && <div style={s.errorBox}>{error}</div>}

          <button type="submit" style={{ ...s.submitBtn, ...(loading ? s.submitBtnLoading : {}) }} disabled={loading}>
            {loading ? (
              <span style={s.spinner} />
            ) : null}
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={s.footer}>PureCode Agency — Team Portal</div>
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    position: 'relative',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: '700px',
    height: '700px',
    background: 'radial-gradient(circle, rgba(0,229,160,0.06) 0%, transparent 60%)',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
    zIndex: 0,
  },
  card: {
    position: 'relative',
    zIndex: 1,
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.3)',
  },
  brand: {
    marginBottom: '0',
  },
  brandName: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 800,
    fontSize: '22px',
    color: 'var(--primary)',
    letterSpacing: '0.1em',
    lineHeight: 1,
  },
  brandSub: {
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    color: 'var(--text3)',
    letterSpacing: '0.2em',
    textTransform: 'uppercase',
    marginTop: '4px',
  },
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '24px 0',
  },
  formHeader: {
    marginBottom: '24px',
  },
  heading: {
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: '18px',
    color: 'var(--text)',
    lineHeight: 1.2,
  },
  subheading: {
    fontSize: '13px',
    color: 'var(--text2)',
    marginTop: '4px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  errorBox: {
    background: 'var(--red-dim)',
    border: '1px solid rgba(255,77,106,0.25)',
    borderRadius: '6px',
    padding: '10px 14px',
    color: 'var(--red)',
    fontSize: '12px',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  submitBtn: {
    width: '100%',
    background: 'var(--primary)',
    color: '#000',
    border: 'none',
    borderRadius: 'var(--r)',
    padding: '12px',
    fontFamily: "'Syne', sans-serif",
    fontWeight: 700,
    fontSize: '13px',
    letterSpacing: '0.04em',
    cursor: 'pointer',
    transition: 'filter 0.12s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '4px',
  },
  submitBtnLoading: {
    opacity: 0.7,
    cursor: 'not-allowed',
    filter: 'none',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid rgba(0,0,0,0.25)',
    borderTopColor: '#000',
    borderRadius: '50%',
    display: 'inline-block',
    animation: 'spin 0.7s linear infinite',
  },
  footer: {
    marginTop: '28px',
    fontFamily: "'DM Mono', monospace",
    fontSize: '10px',
    color: 'var(--text3)',
    letterSpacing: '0.06em',
    textAlign: 'center',
  },
};
