// ============================================
// LOGIN & REGISTRATION — VidProtect AI
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authLogin, authRegister } from '../services/mockServices';
import { Logo } from '../components/SharedComponents';
import { homeFor } from '../auth/permissions';

const DEMO_ACCOUNTS = [
  { label: 'Learner', email: 'sarah@student.demo' },
  { label: 'Creator', email: 'creator@vidprotect.demo' },
  { label: 'Admin', email: 'admin@vidprotect.demo' },
];

export default function LoginPage() {
  const { login, showNotification } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    if (!loginEmail || !loginPassword) { setError('Email and password are required.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800)); // Simulate network delay
    const result = await authLogin(loginEmail, loginPassword);
    setLoading(false);
    if (result.success) {
      login(result.user);
      showNotification(`Welcome back, ${result.user.name}!`);
      navigate(homeFor(result.user));
    } else {
      setError(result.error);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (!regName || !regEmail || !regPassword) { setError('All fields are required.'); return; }
    if (regPassword !== regConfirm) { setError('Passwords do not match.'); return; }
    if (regPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    const result = await authRegister(regName, regEmail, regPassword);
    setLoading(false);
    if (result.success) {
      setSuccess(result.message);
      setMode('login');
      setLoginEmail(regEmail);
    } else {
      setError(result.error);
    }
  };

  const fillDemo = (email) => {
    setLoginEmail(email);
    setLoginPassword('demo1234');
    setError('');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#101010',
      backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Back to home */}
        <div style={{ marginBottom: '2rem' }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none' }}>
            <Logo size="sm" />
          </Link>
        </div>

        {/* Card */}
        <div style={{ background: '#1D1D1D', border: '1px solid #EEEEEE', boxShadow: '8px 8px 0px #292929' }}>
          {/* Header */}
          <div style={{ padding: '1.5rem', borderBottom: '1px solid #292929' }}>
            <div style={{ display: 'flex', gap: '0' }}>
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                style={{
                  flex: 1, background: mode === 'login' ? '#FF2028' : 'transparent',
                  border: 'none', borderRight: '1px solid #292929',
                  color: mode === 'login' ? '#fff' : '#A0A0A0',
                  padding: '0.6rem', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  transition: 'all 0.15s',
                }}
              >
                LOGIN
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                style={{
                  flex: 1, background: mode === 'register' ? '#FF2028' : 'transparent',
                  border: 'none',
                  color: mode === 'register' ? '#fff' : '#A0A0A0',
                  padding: '0.6rem', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  transition: 'all 0.15s',
                }}
              >
                REGISTER
              </button>
            </div>
          </div>

          <div style={{ padding: '2rem' }}>
            {mode === 'login' ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    SECURE ACCESS
                  </h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    Sign in to your VidProtect AI account.
                  </p>
                </div>

                {/* Demo banner */}
                <div style={{ background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #FF2028', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                  <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.3rem' }}>DEMO ACCOUNTS · PASSWORD demo1234</div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    {DEMO_ACCOUNTS.map(a => (
                      <button key={a.email} type="button" onClick={() => fillDemo(a.email)} className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }}>
                        {a.label.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {success && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.75rem', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', marginBottom: '1rem' }}>
                    <CheckCircle size={14} color="#22c55e" />
                    <span style={{ fontSize: '0.8rem', color: '#22c55e' }}>{success}</span>
                  </div>
                )}

                {error && (
                  <div style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span>
                  </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="login-email">Email Address</label>
                    <input
                      id="login-email"
                      type="email"
                      className="form-input"
                      placeholder="you@example.com"
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      autoComplete="email"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="login-password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        id="login-password"
                        type={showPass ? 'text' : 'password'}
                        className="form-input"
                        placeholder="Enter password"
                        value={loginPassword}
                        onChange={e => setLoginPassword(e.target.value)}
                        autoComplete="current-password"
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass(!showPass)}
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#565656', cursor: 'pointer' }}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
                    {loading ? (
                      <><div className="spinner" style={{ width: 14, height: 14 }} /> VERIFYING...</>
                    ) : (
                      <>SECURE LOGIN <ArrowRight size={14} /></>
                    )}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={12} color="#565656" />
                  <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>AUTHENTICATION IS SIMULATED IN THIS DEMO</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    CREATE ACCOUNT
                  </h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    Join as a learner. You can apply to become a creator later.
                  </p>
                </div>

                {error && (
                  <div style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-name">Full Name</label>
                    <input id="reg-name" type="text" className="form-input" placeholder="Reshab Basnet" value={regName} onChange={e => setRegName(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">Email Address</label>
                    <input id="reg-email" type="email" className="form-input" placeholder="you@example.com" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="reg-password" type={showPass ? 'text' : 'password'} className="form-input" placeholder="Min. 8 characters" value={regPassword} onChange={e => setRegPassword(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#565656', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                    <input id="reg-confirm" type="password" className="form-input" placeholder="Repeat password" value={regConfirm} onChange={e => setRegConfirm(e.target.value)} />
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> CREATING...</> : <>CREATE ACCOUNT <ArrowRight size={14} /></>}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={12} color="#565656" />
                  <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>REGISTRATION IS SIMULATED IN THIS DEMO</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <Link to="/" style={{ color: '#565656', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← Back to VidProtect AI
          </Link>
        </div>
      </div>
    </div>
  );
}
