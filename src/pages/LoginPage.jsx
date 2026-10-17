// ============================================
// LOGIN & REGISTRATION — VidProtect AI
// ============================================

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authLogin, authRegister, authCreatorRegister, authResendVerification } from '../services/dataService';
import { Logo } from '../components/SharedComponents';
import { homeFor } from '../auth/permissions';
import { validateRegistration, validateEmail, NAME_MAX, EMAIL_MAX, PASSWORD_MIN, SPECIAL_CHAR } from '../../shared/validation.js';

const fieldError = (msg) => msg && <div role="alert" style={{ color: '#FF2028', fontSize: '0.7rem', marginTop: '0.3rem' }}>{msg}</div>;

const demoAccounts = (portal) => (portal === 'creator'
  ? [
    { label: 'Approved creator', email: 'creator@vidprotect.demo' },
    { label: 'Pending applicant', email: 'daniel@student.demo' },
  ]
  : [
    { label: 'Learner', email: 'sarah@student.demo' },
    { label: 'Admin', email: 'admin@vidprotect.demo' },
  ].filter(a => !(import.meta.env.PROD && a.label === 'Admin'))); // the admin password is set by ADMIN_PASSWORD when deployed

// One sign-in page, two doors: learners (and admins) at /login, creators at /creator/login
export default function LoginPage({ portal = 'learner' }) {
  const isCreator = portal === 'creator';
  const DEMO_ACCOUNTS = demoAccounts(portal);
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
  const [touched, setTouched] = useState({}); // which register fields the person has visited
  const [serverFields, setServerFields] = useState({});
  const [needsVerify, setNeedsVerify] = useState(false); // login was refused because the email is not verified yet
  const touch = (field) => setTouched(t => ({ ...t, [field]: true }));
  const check = useMemo(
    () => validateRegistration({ name: regName, email: regEmail, password: regPassword, confirm: regConfirm }),
    [regName, regEmail, regPassword, regConfirm],
  );
  const shown = (field) => (touched[field] ? check.errors[field] : undefined) || serverFields[field];
  const rules = [
    { ok: regPassword.length >= PASSWORD_MIN, text: `At least ${PASSWORD_MIN} characters` },
    { ok: /\p{L}/u.test(regPassword), text: 'A letter' },
    { ok: /\d/.test(regPassword), text: 'A number' },
    { ok: SPECIAL_CHAR.test(regPassword), text: 'A special character (! @ # $ ...)' },
  ];

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const emailCheck = validateEmail(loginEmail);
    if (!loginEmail.trim() || !loginPassword) { setError('Email and password are required.'); return; }
    if (emailCheck.error) { setError(emailCheck.error); return; }
    setLoading(true);
    const result = await authLogin(loginEmail, loginPassword, portal);
    setLoading(false);
    setNeedsVerify(result.code === 'EMAIL_NOT_VERIFIED');
    if (result.success) {
      login(result.user);
      showNotification(`Welcome back, ${result.user.name}!`);
      navigate(homeFor(result.user));
    } else {
      setError(result.error);
    }
  };

  const resendVerification = async () => {
    setLoading(true);
    const result = await authResendVerification(loginEmail);
    setLoading(false);
    if (result.success) { setError(''); setSuccess(result.message); setNeedsVerify(false); } else { setError(result.error); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setServerFields({});
    if (Object.keys(check.errors).length) {
      setTouched({ name: true, email: true, password: true, confirm: true });
      setError('Please fix the highlighted fields.');
      return;
    }
    setLoading(true);
    const result = await (isCreator ? authCreatorRegister : authRegister)(check.values.name, check.values.email, check.values.password);
    setLoading(false);
    if (result.success) {
      setSuccess(result.message);
      setNeedsVerify(!!result.needsVerification);
      setMode('login');
      setLoginEmail(check.values.email);
      setRegPassword(''); setRegConfirm(''); setTouched({});
    } else {
      setError(result.error);
      setServerFields(result.fields || {});
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
                    {isCreator ? 'CREATOR ACCESS' : 'SECURE ACCESS'}
                  </h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    {isCreator ? 'Sign in to your VidProtect AI creator account.' : 'Sign in to your VidProtect AI account.'}
                  </p>
                </div>

                {/* Demo banner */}
                <div style={{ background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #FF2028', padding: '0.75rem 1rem', marginBottom: '1.5rem' }}>
                  <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.3rem' }}>BETA TEST ACCOUNTS · PASSWORD demo1234</div>
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

                {needsVerify && (
                  <button type="button" className="btn btn-ghost" onClick={resendVerification} disabled={loading || !loginEmail} style={{ width: '100%', justifyContent: 'center', marginBottom: '1rem', fontSize: '0.7rem' }}>
                    RESEND VERIFICATION EMAIL
                  </button>
                )}

                <form onSubmit={handleLogin} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                  <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>BETA TEST ACCOUNTS ARE SEEDED ON THE SERVER</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    {isCreator ? 'CREATOR SIGN UP' : 'CREATE ACCOUNT'}
                  </h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    {isCreator
                      ? 'Create a creator account, then fill in your teaching background. An admin reviews it before your studio opens. Creators can learn on the platform too.'
                      : 'Join as a learner and start watching protected courses.'}
                  </p>
                </div>

                {error && (
                  <div style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span>
                  </div>
                )}

                <form onSubmit={handleRegister} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-name">Full Name</label>
                    <input id="reg-name" type="text" className="form-input" placeholder="Reshab Basnet" value={regName} maxLength={NAME_MAX} autoComplete="name" aria-invalid={!!shown('name')} onBlur={() => touch('name')} onChange={e => { setRegName(e.target.value); setServerFields({}); }} />
                    {fieldError(shown('name'))}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-email">Email Address</label>
                    <input id="reg-email" type="email" className="form-input" placeholder="you@example.com" value={regEmail} maxLength={EMAIL_MAX + 20} autoComplete="email" aria-invalid={!!shown('email')} onBlur={() => touch('email')} onChange={e => { setRegEmail(e.target.value); setServerFields({}); }} />
                    {fieldError(shown('email'))}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-password">Password</label>
                    <div style={{ position: 'relative' }}>
                      <input id="reg-password" type={showPass ? 'text' : 'password'} className="form-input" placeholder="Min. 8 characters, with a symbol" value={regPassword} autoComplete="new-password" aria-invalid={!!shown('password')} onBlur={() => touch('password')} onChange={e => setRegPassword(e.target.value)} style={{ paddingRight: '2.5rem' }} />
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#565656', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {rules.map(r => (
                        <span key={r.text} className="mono" style={{ fontSize: '0.6rem', color: r.ok ? '#22c55e' : '#565656' }}>{r.ok ? '✓' : '○'} {r.text}</span>
                      ))}
                    </div>
                    {fieldError(shown('password'))}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                    <input id="reg-confirm" type="password" className="form-input" placeholder="Repeat password" value={regConfirm} autoComplete="new-password" aria-invalid={!!shown('confirm')} onBlur={() => touch('confirm')} onChange={e => setRegConfirm(e.target.value)} />
                    {fieldError(shown('confirm'))}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> CREATING...</> : <>CREATE ACCOUNT <ArrowRight size={14} /></>}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={12} color="#565656" />
                  <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>{isCreator ? 'THE STUDIO OPENS AFTER ADMIN APPROVAL' : 'LEARNER ACCOUNTS CANNOT BECOME CREATORS'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {isCreator
            ? <Link to="/login" style={{ color: '#A0A0A0', fontSize: '0.8rem', textDecoration: 'none' }}>Here to learn? Learner login →</Link>
            : <Link to="/creator/login" style={{ color: '#A0A0A0', fontSize: '0.8rem', textDecoration: 'none' }}>Want to teach? Creator login →</Link>}
          <Link to="/" style={{ color: '#565656', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← Back to VidProtect AI
          </Link>
        </div>
      </div>
    </div>
  );
}
