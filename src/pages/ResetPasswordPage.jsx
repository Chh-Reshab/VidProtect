// ============================================
// RESET PASSWORD — the page the emailed link opens
// ============================================

import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { authResetPassword } from '../services/dataService';
import { Logo } from '../components/SharedComponents';
import { validatePassword, PASSWORD_MIN, SPECIAL_CHAR } from '../../shared/validation.js';

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // { message, portal }

  const live = password ? validatePassword(password).error : '';
  const rules = [
    { ok: password.length >= PASSWORD_MIN, text: `At least ${PASSWORD_MIN} characters` },
    { ok: /\p{L}/u.test(password), text: 'A letter' },
    { ok: /\d/.test(password), text: 'A number' },
    { ok: SPECIAL_CHAR.test(password), text: 'A special character (! @ # $ ...)' },
  ];

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (live) { setError(live); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    const r = await authResetPassword(token, password);
    setBusy(false);
    if (r.success) setDone({ message: r.message, portal: r.portal }); else setError(r.error);
  };

  return (
    <div style={{ minHeight: '100vh', background: '#101010', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ marginBottom: '2rem' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo size="sm" /></Link></div>
        <div style={{ background: '#1D1D1D', border: '1px solid #EEEEEE', boxShadow: '8px 8px 0px #292929', padding: '2rem' }}>
          {done ? (
            <div style={{ textAlign: 'center' }}>
              <CheckCircle size={40} color="#22c55e" />
              <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', margin: '1rem 0 0.5rem' }}>PASSWORD UPDATED</h1>
              <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{done.message}</p>
              <Link to={done.portal === 'creator' ? '/creator/login' : '/login'} className="btn btn-primary" style={{ justifyContent: 'center' }}>GO TO SIGN IN</Link>
            </div>
          ) : !token ? (
            <p style={{ color: '#A0A0A0' }}>This reset link is incomplete. <Link to="/login" style={{ color: '#FF2028' }}>Ask for a new one</Link>.</p>
          ) : (
            <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>CHOOSE A NEW PASSWORD</h1>
              <div className="form-group">
                <label className="form-label" htmlFor="rp-new">New password</label>
                <input id="rp-new" type="password" className="form-input" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} />
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                  {rules.map(r => <span key={r.text} className="mono" style={{ fontSize: '0.7rem', color: r.ok ? '#22c55e' : '#8B8B8B' }}>{r.ok ? '✓' : '○'} {r.text}</span>)}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="rp-confirm">Confirm password</label>
                <input id="rp-confirm" type="password" className="form-input" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} />
              </div>
              {error && <div role="alert" style={{ padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028' }}><span style={{ fontSize: '0.8rem', color: '#FF2028' }}>⊗ {error}</span></div>}
              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center' }} disabled={busy}>{busy ? 'SAVING...' : 'UPDATE PASSWORD'}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
