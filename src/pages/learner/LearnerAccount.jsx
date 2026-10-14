// ============================================
// LEARNER ACCOUNT — profile, password, become-a-creator
// ============================================

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Clapperboard, Clock, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { changePassword, requestCreatorAccess } from '../../services/dataService';
import { DemoBanner } from '../../components/SharedComponents';
import { PageHeader, Panel } from '../../components/DashboardKit';

export default function LearnerAccount() {
  const { currentUser, refreshUser, logout, showNotification } = useApp();
  const navigate = useNavigate();

  const [pw, setPw] = useState({ current: '', next: '' });
  const [apply, setApply] = useState({ displayName: currentUser.name, bio: '' });

  // Pick up an approval/suspension decided since login
  useEffect(() => { refreshUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePassword = async (e) => {
    e.preventDefault();
    const result = await changePassword(currentUser.id, pw.current, pw.next);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setPw({ current: '', next: '' });
    showNotification('Password updated.');
  };

  const handleApply = async (e) => {
    e.preventDefault();
    const result = await requestCreatorAccess(currentUser.id, apply);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    await refreshUser();
    showNotification('Application submitted. An admin will review it.');
  };

  const status = currentUser.creatorStatus;

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 820 }}>
      <PageHeader label="ACCOUNT" title="MY ACCOUNT" />
      <DemoBanner />

      <Panel title="PROFILE" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            ['NAME', currentUser.name],
            ['EMAIL', currentUser.email],
            ['ROLE', currentUser.role.toUpperCase()],
            ['MEMBER SINCE', currentUser.joinDate || '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginBottom: '0.2rem' }}>{k}</div>
              <div style={{ fontSize: '0.9rem', color: '#F8F8F8', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Creator access */}
      <Panel title="CREATOR ACCESS" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem' }}>
          {currentUser.role === 'creator' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <Clapperboard size={18} color="#22c55e" />
              <span style={{ fontSize: '0.85rem', color: '#A0A0A0', flex: 1 }}>You are an approved creator.</span>
              <Link to="/studio/overview" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>OPEN CREATOR STUDIO</Link>
            </div>
          ) : status === 'pending' ? (
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <Clock size={18} color="#eab308" />
              <span style={{ fontSize: '0.85rem', color: '#A0A0A0' }}>Your application is waiting for admin review.</span>
            </div>
          ) : (
            <form onSubmit={handleApply} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {status === 'rejected' && (
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#FF2028', fontSize: '0.8rem' }}>
                  <XCircle size={14} /> Your previous application was not approved. You can apply again.
                </div>
              )}
              <p style={{ color: '#A0A0A0', fontSize: '0.85rem' }}>
                Want to publish your own protected courses? Apply to become a creator. An admin reviews every application.
              </p>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-name">Creator display name</label>
                <input id="cr-name" className="form-input" value={apply.displayName} onChange={e => setApply({ ...apply, displayName: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="cr-bio">What will you teach?</label>
                <textarea id="cr-bio" className="form-input" rows={3} value={apply.bio} onChange={e => setApply({ ...apply, bio: e.target.value })} />
              </div>
              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>APPLY TO BECOME A CREATOR</button>
            </form>
          )}
        </div>
      </Panel>

      <Panel title="CHANGE PASSWORD" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handlePassword} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-cur">Current password</label>
            <input id="pw-cur" type="password" className="form-input" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-new">New password (min. 8 characters)</label>
            <input id="pw-new" type="password" className="form-input" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>UPDATE PASSWORD</button>
        </form>
      </Panel>

      <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={async () => { await logout(); navigate('/'); }}>
        <LogOut size={14} /> SIGN OUT
      </button>
    </div>
  );
}
