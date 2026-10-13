// ============================================
// SETTINGS — VidProtect AI
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, LogOut, Shield, Bell, User, Lock } from 'lucide-react';
import { getSettings, updateSettings } from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, DemoBanner } from '../components/SharedComponents';

const Toggle = ({ checked, onChange, id, label }) => (
  <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
    <div>
      <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{label}</div>
    </div>
    <div
      id={id}
      role="switch"
      aria-checked={checked}
      tabIndex={0}
      onClick={() => onChange(!checked)}
      onKeyDown={e => e.key === ' ' && onChange(!checked)}
      style={{
        width: 40, height: 22,
        background: checked ? '#FF2028' : '#292929',
        borderRadius: 2,
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
      }}
    >
      <div style={{
        position: 'absolute',
        width: 16, height: 16,
        background: '#F8F8F8',
        top: 3, left: checked ? 21 : 3,
        transition: 'left 0.2s',
      }} />
    </div>
  </label>
);

const SettingsSection = ({ title, icon: Icon, children }) => (
  <div style={{ background: '#1D1D1D', border: '1px solid #292929', marginBottom: '1.5rem' }}>
    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#171717' }}>
      <Icon size={16} color="#FF2028" />
      <div className="mono" style={{ fontSize: '0.65rem', color: '#F8F8F8', letterSpacing: '0.1em' }}>{title}</div>
    </div>
    <div style={{ padding: '1.25rem' }}>
      {children}
    </div>
  </div>
);

export default function SettingsPage() {
  const navigate = useNavigate();
  const { logout, currentUser, showNotification } = useApp();
  const [settings, setSettings] = useState(() => getSettings(currentUser));
  const [saved, setSaved] = useState(false);

  const update = (path, value) => {
    setSettings(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let ref = next;
      for (let i = 0; i < keys.length - 1; i++) {
        ref[keys[i]] = { ...ref[keys[i]] };
        ref = ref[keys[i]];
      }
      ref[keys[keys.length - 1]] = value;
      return next;
    });
    setSaved(false);
  };

  const handleSave = () => {
    updateSettings(currentUser, settings);
    setSaved(true);
    showNotification('Settings saved.');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!settings) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <SectionLabel>ACCOUNT SETTINGS</SectionLabel>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
            SETTINGS
          </h1>
        </div>
        <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={handleSave}>
          <Save size={14} /> {saved ? 'SAVED ✓' : 'SAVE CHANGES'}
        </button>
      </div>

      <DemoBanner />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'flex-start' }} className="settings-grid">
        <div>
          {/* Creator Profile */}
          <SettingsSection title="CREATOR PROFILE" icon={User}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="s-name">Display Name</label>
                <input id="s-name" type="text" className="form-input" value={settings.displayName} onChange={e => update('displayName', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="s-email">Email Address</label>
                <input id="s-email" type="email" className="form-input" value={settings.email} onChange={e => update('email', e.target.value)} />
              </div>
              <div style={{ padding: '0.5rem', background: '#101010', border: '1px solid #292929' }}>
                <span className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>Profile changes are stored locally in this demo and do not update a real account.</span>
              </div>
            </div>
          </SettingsSection>

          {/* Access Preferences */}
          <SettingsSection title="ACCESS PREFERENCES" icon={Shield}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="s-token-expiry">Demo Token Expiry (minutes)</label>
                <input id="s-token-expiry" type="number" min="5" max="120" className="form-input" value={settings.defaultTokenExpiry}
                  onChange={e => update('defaultTokenExpiry', parseInt(e.target.value) || 30)} />
                <div style={{ fontSize: '0.75rem', color: '#565656', marginTop: '0.25rem' }}>Default TTL for demo streaming tokens (5–120 min)</div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="s-session">Session Display</label>
                <select id="s-session" className="form-input" value={settings.sessionDisplayPreference} onChange={e => update('sessionDisplayPreference', e.target.value)}>
                  <option value="detailed">Detailed (full token info)</option>
                  <option value="minimal">Minimal (expiry only)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="s-access">Course Access Policy</label>
                <select id="s-access" className="form-input" value={settings.courseAccessPreference} onChange={e => update('courseAccessPreference', e.target.value)}>
                  <option value="enrollment_required">Enrollment Required</option>
                  <option value="course_only">Course Membership Only</option>
                </select>
              </div>
            </div>
          </SettingsSection>
        </div>

        <div>
          {/* Notification Preferences */}
          <SettingsSection title="NOTIFICATION PREFERENCES" icon={Bell}>
            <Toggle id="notif-suspicious" label="Suspicious Activity Alerts" checked={settings.notifications.suspiciousActivity} onChange={v => update('notifications.suspiciousActivity', v)} />
            <Toggle id="notif-denied" label="Access Denied Notifications" checked={settings.notifications.accessDenied} onChange={v => update('notifications.accessDenied', v)} />
            <Toggle id="notif-updates" label="Security Update Notifications" checked={settings.notifications.securityUpdates} onChange={v => update('notifications.securityUpdates', v)} />
            <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#101010', border: '1px solid #292929' }}>
              <span className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>Notification preferences are stored locally. No real notifications are sent in this demo.</span>
            </div>
          </SettingsSection>

          {/* Security Status */}
          <SettingsSection title="SECURITY CONFIGURATION" icon={Lock}>
            {[
              { label: 'Authentication System', key: 'authStatus', activeLabel: 'JWT Auth (Backend)', demoLabel: 'Simulated (Frontend Demo)' },
              { label: 'Video Encryption', key: 'encryptionStatus', activeLabel: 'AES-256 (Backend)', demoLabel: 'Simulated (Frontend Demo)' },
              { label: 'Activity Monitoring', key: 'monitoringStatus', activeLabel: 'Active (Demo Logging)', demoLabel: 'Inactive' },
            ].map(item => (
              <div key={item.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{item.label}</div>
                <span className="badge" style={{
                  color: settings.security[item.key] === 'demo_active' ? '#eab308' : settings.security[item.key] === 'demo_simulated' ? '#eab308' : '#22c55e',
                  borderColor: settings.security[item.key] === 'demo_active' ? '#eab308' : settings.security[item.key] === 'demo_simulated' ? '#eab308' : '#22c55e',
                  fontSize: '0.55rem',
                }}>
                  ◐ {settings.security[item.key] === 'demo_active' ? item.activeLabel : item.demoLabel}
                </span>
              </div>
            ))}
            <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #eab308' }}>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.35rem' }}>PROTOTYPE DISCLOSURE</div>
              <p style={{ fontSize: '0.75rem', color: '#565656', lineHeight: 1.6 }}>
                Security controls in this prototype are simulated for demonstration. Authentication is frontend-only. Encryption does not process real files. Monitoring logs events to localStorage, not a real database.
              </p>
            </div>
          </SettingsSection>

          {/* Account Controls */}
          <SettingsSection title="ACCOUNT CONTROLS" icon={Settings}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.7rem', justifyContent: 'center' }} onClick={handleSave}>
                <Save size={14} /> SAVE ALL SETTINGS
              </button>
              <button className="btn btn-secondary" style={{ fontSize: '0.7rem', justifyContent: 'center' }} onClick={() => navigate('/studio/overview')}>
                RETURN TO DASHBOARD
              </button>
              <button className="btn btn-danger" style={{ fontSize: '0.7rem', justifyContent: 'center' }} onClick={handleLogout}>
                <LogOut size={14} /> LOGOUT
              </button>
            </div>
          </SettingsSection>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .settings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
