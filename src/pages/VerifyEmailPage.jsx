// ============================================
// EMAIL VERIFICATION — the page the emailed link opens
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle } from 'lucide-react';
import { authVerifyEmail } from '../services/dataService';
import { Logo } from '../components/SharedComponents';

export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState(token ? { status: 'working' } : { status: 'error', message: 'This verification link is incomplete.' });
  const started = useRef(false); // the link works once, so make sure it is only used once

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    authVerifyEmail(token).then(r => setState(r.success ? { status: 'ok', message: r.message, portal: r.portal } : { status: 'error', message: r.error }));
  }, [token]);

  const ok = state.status === 'ok';
  return (
    <div style={{ minHeight: '100vh', background: '#101010', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem 1rem' }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        <div style={{ marginBottom: '2rem' }}><Link to="/" style={{ textDecoration: 'none' }}><Logo size="sm" /></Link></div>
        <div style={{ background: '#1D1D1D', border: '1px solid #EEEEEE', boxShadow: '8px 8px 0px #292929', padding: '2rem', textAlign: 'center' }}>
          {state.status === 'working' && (<><div className="spinner" style={{ margin: '0 auto 1rem' }} /><p style={{ color: '#A0A0A0' }}>Verifying your email...</p></>)}
          {state.status !== 'working' && (
            <>
              {ok ? <CheckCircle size={40} color="#22c55e" /> : <XCircle size={40} color="#FF2028" />}
              <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', margin: '1rem 0 0.5rem' }}>
                {ok ? 'EMAIL VERIFIED' : 'COULD NOT VERIFY'}
              </h1>
              <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: '1.5rem' }}>{state.message}</p>
              {ok ? (
                <Link to={state.portal === 'creator' ? '/creator/login' : '/login'} className="btn btn-primary" style={{ justifyContent: 'center' }}>GO TO SIGN IN</Link>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <Link to="/login" className="btn btn-primary" style={{ justifyContent: 'center' }}>LEARNER SIGN IN</Link>
                  <Link to="/creator/login" className="btn btn-ghost" style={{ justifyContent: 'center' }}>CREATOR SIGN IN</Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
