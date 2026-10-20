// ============================================
// LOGIN & REGISTRATION — VidProtect AI
// ============================================

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Shield, ArrowRight, CheckCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { authLogin, authMfaLogin, authForgotPassword, getAuthOptions, authRegister, authCreatorRegister, authResendVerification } from '../services/dataService';
import { Logo } from '../components/SharedComponents';
import { homeFor } from '../auth/permissions';
import { validateRegistration, validateEmail, NAME_MAX, EMAIL_MAX, PASSWORD_MIN, SPECIAL_CHAR } from '../../shared/validation.js';

const fieldError = (msg) => msg && <div role="alert" style={{ color: '#FF2028', fontSize: '0.7rem', marginTop: '0.3rem' }}>{msg}</div>;

// One sign-in page, two doors: learners (and admins) at /login, creators at /creator/login
export default function LoginPage({ portal = 'learner' }) {
  const isCreator = portal === 'creator';
  const { login, showNotification } = useApp();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register' | 'forgot'
  const [canReset, setCanReset] = useState(false); // the server can email reset links
  const [mfaToken, setMfaToken] = useState(''); // set after the password step when a code is also needed
  const [mfaCode, setMfaCode] = useState('');
  useEffect(() => { getAuthOptions().then(o => setCanReset(!!o.passwordReset)); }, []);
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
  const [regTerms, setRegTerms] = useState(false);
  const [touched, setTouched] = useState({}); // which register fields the person has visited
  const [serverFields, setServerFields] = useState({});
  const [needsVerify, setNeedsVerify] = useState(false); // login was refused because the email is not verified yet
  const touch = (field) => setTouched(t => ({ ...t, [field]: true }));
  const check = useMemo(
    () => validateRegistration({ name: regName, email: regEmail, password: regPassword, confirm: regConfirm, acceptTerms: regTerms }),
    [regName, regEmail, regPassword, regConfirm, regTerms],
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
    if (result.mfaRequired) { setMfaToken(result.mfaToken); setMfaCode(''); return; }
    if (result.success) {
      login(result.user);
      showNotification(`Welcome back, ${result.user.name}!`);
      navigate(homeFor(result.user));
    } else {
      setError(result.error);
    }
  };

  const handleMfa = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await authMfaLogin(mfaToken, mfaCode);
    setLoading(false);
    if (result.success) {
      login(result.user);
      showNotification(`Welcome back, ${result.user.name}!`);
      navigate(homeFor(result.user));
    } else {
      setError(result.error);
      if (result.code === 'MFA_EXPIRED') { setMfaToken(''); setLoginPassword(''); }
    }
  };

  const handleForgot = async (e) => {
    e.preventDefault();
    setError('');
    const emailCheck = validateEmail(loginEmail);
    if (emailCheck.error) { setError(emailCheck.error); return; }
    setLoading(true);
    const result = await authForgotPassword(emailCheck.value);
    setLoading(false);
    if (result.success) { setSuccess(result.message); setMode('login'); } else { setError(result.error); }
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
      setTouched({ name: true, email: true, password: true, confirm: true, terms: true });
      setError('Please fix the highlighted fields.');
      return;
    }
    setLoading(true);
    const result = await (isCreator ? authCreatorRegister : authRegister)(check.values.name, check.values.email, check.values.password, regTerms);
    setLoading(false);
    if (result.success) {
      setSuccess(result.message);
      setNeedsVerify(!!result.needsVerification);
      setMode('login');
      setLoginEmail(check.values.email);
      setRegPassword(''); setRegConfirm(''); setRegTerms(false); setTouched({});
    } else {
      setError(result.error);
      setServerFields(result.fields || {});
    }
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
            {mfaToken ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>TWO-STEP VERIFICATION</h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>Enter the 6-digit code from your authenticator app, or one of your recovery codes.</p>
                </div>
                {error && <div role="alert" style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028', marginBottom: '1rem' }}><span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span></div>}
                <form onSubmit={handleMfa} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="mfa-code">Verification code</label>
                    <input id="mfa-code" className="form-input" inputMode="text" autoComplete="one-time-code" autoFocus placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={loading || !mfaCode.trim()}>
                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> VERIFYING...</> : <>VERIFY <ArrowRight size={14} /></>}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center', fontSize: '0.7rem' }} onClick={() => { setMfaToken(''); setError(''); setLoginPassword(''); }}>BACK TO SIGN IN</button>
                </form>
              </>
            ) : mode === 'forgot' ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>RESET PASSWORD</h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>Enter your email and we will send you a link to choose a new password.</p>
                </div>
                {error && <div role="alert" style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028', marginBottom: '1rem' }}><span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span></div>}
                <form onSubmit={handleForgot} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="forgot-email">Email Address</label>
                    <input id="forgot-email" type="email" className="form-input" placeholder="you@example.com" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={loading}>
                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> SENDING...</> : <>SEND RESET LINK <ArrowRight size={14} /></>}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ justifyContent: 'center', fontSize: '0.7rem' }} onClick={() => { setMode('login'); setError(''); }}>BACK TO SIGN IN</button>
                </form>
              </>
            ) : mode === 'login' ? (
              <>
                <div style={{ marginBottom: '1.5rem' }}>
                  <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>
                    {isCreator ? 'CREATOR ACCESS' : 'SECURE ACCESS'}
                  </h1>
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.3rem' }}>
                    {isCreator ? 'Sign in to your VidProtect AI creator account.' : 'Sign in to your VidProtect AI account.'}
                  </p>
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
                        style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8B8B8B', cursor: 'pointer' }}
                        aria-label={showPass ? 'Hide password' : 'Show password'}
                      >
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {canReset && (
                    <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccess(''); }} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', color: '#A0A0A0', fontSize: '0.75rem', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                      Forgot password?
                    </button>
                  )}

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
                    {loading ? (
                      <><div className="spinner" style={{ width: 14, height: 14 }} /> VERIFYING...</>
                    ) : (
                      <>SECURE LOGIN <ArrowRight size={14} /></>
                    )}
                  </button>
                </form>

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
                      <button type="button" onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#8B8B8B', cursor: 'pointer' }}>
                        {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                      {rules.map(r => (
                        <span key={r.text} className="mono" style={{ fontSize: '0.7rem', color: r.ok ? '#22c55e' : '#565656' }}>{r.ok ? '✓' : '○'} {r.text}</span>
                      ))}
                    </div>
                    {fieldError(shown('password'))}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="reg-confirm">Confirm Password</label>
                    <input id="reg-confirm" type="password" className="form-input" placeholder="Repeat password" value={regConfirm} autoComplete="new-password" aria-invalid={!!shown('confirm')} onBlur={() => touch('confirm')} onChange={e => setRegConfirm(e.target.value)} />
                    {fieldError(shown('confirm'))}
                  </div>
                  <div>
                    <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.8rem', color: '#A0A0A0', cursor: 'pointer', lineHeight: 1.5 }}>
                      <input type="checkbox" checked={regTerms} onChange={e => { setRegTerms(e.target.checked); touch('terms'); }} style={{ marginTop: 3 }} />
                      <span>
                        I agree to the <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>Terms of Service</Link>, the <Link to="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>Privacy Policy</Link> and the <Link to="/refund-policy" target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>Refund Policy</Link>.
                      </span>
                    </label>
                    {fieldError(shown('terms'))}
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={loading}>
                    {loading ? <><div className="spinner" style={{ width: 14, height: 14 }} /> CREATING...</> : <>CREATE ACCOUNT <ArrowRight size={14} /></>}
                  </button>
                </form>

                <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Shield size={12} color="#8B8B8B" />
                  <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{isCreator ? 'THE STUDIO OPENS AFTER ADMIN APPROVAL' : 'LEARNER ACCOUNTS CANNOT BECOME CREATORS'}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div style={{ marginTop: '1.5rem', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {isCreator
            ? <Link to="/login" style={{ color: '#A0A0A0', fontSize: '0.8rem', textDecoration: 'none' }}>Here to learn? Learner login →</Link>
            : <Link to="/creator/login" style={{ color: '#A0A0A0', fontSize: '0.8rem', textDecoration: 'none' }}>Want to teach? Creator login →</Link>}
          <Link to="/" style={{ color: '#8B8B8B', fontSize: '0.8rem', textDecoration: 'none' }}>
            ← Back to VidProtect AI
          </Link>
        </div>
      </div>
    </div>
  );
}
