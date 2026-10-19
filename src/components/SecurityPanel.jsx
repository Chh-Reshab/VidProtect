// ============================================
// SECURITY PANEL — change password, two-step verification, delete account.
// Used on the learner profile, the creator settings and the admin account page.
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Copy, Download, ShieldCheck } from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  changePassword, mfaSetup, mfaEnable, mfaDisable, mfaNewRecoveryCodes, deleteMyAccount,
} from '../services/dataService';
import { Panel } from './DashboardKit';
import { validatePassword } from '../../shared/validation.js';

const note = { fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6 };
const problem = (msg) => msg && <div role="alert" style={{ color: '#FF2028', fontSize: '0.75rem' }}>⊗ {msg}</div>;

// ── Change password ──
function ChangePassword() {
  const { currentUser, showNotification } = useApp();
  const [pw, setPw] = useState({ current: '', next: '' });
  const [error, setError] = useState('');
  const live = pw.next ? validatePassword(pw.next, { name: currentUser.name, email: currentUser.email }).error : '';

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (live) { setError(live); return; }
    const result = await changePassword(currentUser.id, pw.current, pw.next);
    if (!result.success) { setError(result.error); return; }
    setPw({ current: '', next: '' });
    showNotification('Password updated. Other devices were signed out.');
  };

  return (
    <Panel title="CHANGE PASSWORD" style={{ marginBottom: '1.5rem' }}>
      <form onSubmit={submit} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 380 }}>
        <div className="form-group">
          <label className="form-label" htmlFor="pw-cur">Current password</label>
          <input id="pw-cur" type="password" className="form-input" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="pw-new">New password</label>
          <input id="pw-new" type="password" className="form-input" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          {pw.next && live && <div style={{ color: '#FF2028', fontSize: '0.7rem', marginTop: '0.3rem' }}>{live}</div>}
        </div>
        {problem(error)}
        <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }} disabled={!pw.current || !pw.next}>UPDATE PASSWORD</button>
      </form>
    </Panel>
  );
}

// ── Two-step verification ──
function RecoveryCodes({ codes, onDone }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join('\n');
  const download = () => {
    const url = URL.createObjectURL(new Blob([`VidProtect AI recovery codes\nEach code works once.\n\n${text}\n`], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = 'vidprotect-recovery-codes.txt'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ ...note, color: '#eab308' }}>Save these recovery codes now. Each works once if you lose your phone, and they will not be shown again.</div>
      <div className="mono" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.4rem', background: '#101010', border: '1px solid #292929', padding: '0.9rem', fontSize: '0.85rem', color: '#F8F8F8' }}>
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={async () => { try { await navigator.clipboard.writeText(text); setCopied(true); } catch { /* clipboard blocked */ } }}><Copy size={12} /> {copied ? 'COPIED' : 'COPY'}</button>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={download}><Download size={12} /> DOWNLOAD</button>
        <button type="button" className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={onDone}>I SAVED THEM</button>
      </div>
    </div>
  );
}

function TwoStep() {
  const { currentUser, refreshUser, showNotification } = useApp();
  const on = !!currentUser.mfaEnabled;
  const [setup, setSetup] = useState(null); // { secret, qr } while turning on
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null); // recovery codes to show once
  const [manage, setManage] = useState(null); // 'off' | 'codes' while confirming with password + code
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setCode(''); setPassword(''); setError(''); setManage(null); };

  const start = async () => {
    setBusy(true); setError('');
    const r = await mfaSetup();
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setSetup({ secret: r.secret, qr: r.qr });
  };

  const confirm = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await mfaEnable(code);
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    setSetup(null); setCode(''); setCodes(r.recoveryCodes);
    await refreshUser();
  };

  const submitManage = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = manage === 'off' ? await mfaDisable(password, code) : await mfaNewRecoveryCodes(password, code);
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    if (manage === 'codes') setCodes(r.recoveryCodes);
    else showNotification('Two-step verification is off.');
    reset();
    await refreshUser();
  };

  return (
    <Panel title="TWO-STEP VERIFICATION" style={{ marginBottom: '1.5rem' }}>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 520 }}>
        {codes ? <RecoveryCodes codes={codes} onDone={() => setCodes(null)} /> : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {on ? <CheckCircle size={18} color="#22c55e" /> : <ShieldCheck size={18} color="#8B8B8B" />}
              <span style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{on ? 'On: a code from your authenticator app is needed to sign in.' : 'Off'}</span>
            </div>

            {!on && !setup && (
              <>
                <div style={note}>Adds a second step when you sign in: a 6-digit code from an app such as Google Authenticator, Microsoft Authenticator or Authy.{currentUser.role !== 'learner' ? ' Strongly recommended for creators and admins.' : ''}</div>
                {problem(error)}
                <button type="button" className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }} onClick={start} disabled={busy}>TURN ON</button>
              </>
            )}

            {!on && setup && (
              <form onSubmit={confirm} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={note}>1. Scan this QR code with your authenticator app (or type the key in).<br />2. Enter the 6-digit code the app shows.</div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <img src={setup.qr} alt="QR code for your authenticator app" width={160} height={160} style={{ background: '#fff', padding: 6 }} />
                  <div>
                    <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>OR TYPE THIS KEY</div>
                    <div className="mono" style={{ fontSize: '0.85rem', color: '#F8F8F8', wordBreak: 'break-all', userSelect: 'all' }}>{setup.secret}</div>
                  </div>
                </div>
                <div className="form-group" style={{ maxWidth: 220 }}>
                  <label className="form-label" htmlFor="mfa-confirm">6-digit code</label>
                  <input id="mfa-confirm" className="form-input" inputMode="numeric" autoComplete="one-time-code" maxLength={7} value={code} onChange={e => setCode(e.target.value)} />
                </div>
                {problem(error)}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: '0.7rem' }} disabled={busy || code.replace(/\s/g, '').length < 6}>TURN ON</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => { setSetup(null); reset(); }}>CANCEL</button>
                </div>
              </form>
            )}

            {on && !manage && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setManage('codes')}>NEW RECOVERY CODES</button>
                <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setManage('off')}>TURN OFF</button>
              </div>
            )}

            {on && manage && (
              <form onSubmit={submitManage} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 320 }}>
                <div style={note}>{manage === 'off' ? 'Confirm with your password and a code to turn it off.' : 'Confirm with your password and a code. The old recovery codes stop working.'}</div>
                <div className="form-group">
                  <label className="form-label" htmlFor="mfa-pw">Password</label>
                  <input id="mfa-pw" type="password" className="form-input" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="mfa-manage-code">Code from your app, or a recovery code</label>
                  <input id="mfa-manage-code" className="form-input" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} />
                </div>
                {problem(error)}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" style={{ fontSize: '0.7rem' }} disabled={busy || !password || !code.trim()}>CONFIRM</button>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={reset}>CANCEL</button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}

// ── Delete account ──
function DeleteAccount() {
  const { currentUser, logout, showNotification } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [typed, setTyped] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await deleteMyAccount(password, code);
    setBusy(false);
    if (!r.success) { setError(r.error); return; }
    await logout();
    showNotification('Your account was deleted.');
    navigate('/');
  };

  return (
    <Panel title="DELETE ACCOUNT" style={{ marginBottom: '1.5rem' }}>
      <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 420 }}>
        <div style={note}>
          Permanently deletes your account and the data that belongs to it
          {currentUser.role === 'creator' ? ', including your courses, videos and CV' : ': your progress, activity and enrolments'}. This cannot be undone.
        </div>
        {!open ? (
          <button type="button" className="btn btn-ghost" style={{ alignSelf: 'flex-start', fontSize: '0.7rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setOpen(true)}>DELETE MY ACCOUNT</button>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="del-pw">Your password</label>
              <input id="del-pw" type="password" className="form-input" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            {currentUser.mfaEnabled && (
              <div className="form-group">
                <label className="form-label" htmlFor="del-code">Code from your authenticator app</label>
                <input id="del-code" className="form-input" autoComplete="one-time-code" value={code} onChange={e => setCode(e.target.value)} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label" htmlFor="del-type">Type DELETE to confirm</label>
              <input id="del-type" className="form-input" value={typed} onChange={e => setTyped(e.target.value)} />
            </div>
            {problem(error)}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.7rem', background: '#FF2028' }} disabled={busy || typed !== 'DELETE' || !password}>DELETE FOREVER</button>
              <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => { setOpen(false); setError(''); }}>CANCEL</button>
            </div>
          </form>
        )}
      </div>
    </Panel>
  );
}

export default function SecurityPanel() {
  return (
    <>
      <ChangePassword />
      <TwoStep />
      <DeleteAccount />
    </>
  );
}
