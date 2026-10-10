// ============================================
// SHARED COMPONENTS — VidProtect AI
// ============================================

import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Shield, X, CheckCircle, AlertTriangle, Info } from 'lucide-react';

// ─── LOGO ─────────────────────────────────────
export const Logo = ({ size = 'md' }) => {
  const sizes = { sm: 28, md: 36, lg: 48 };
  const px = sizes[size] || 36;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div style={{
        width: px, height: px,
        background: '#FF2028',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Shield size={px * 0.55} color="#fff" strokeWidth={2.5} />
      </div>
      <div style={{ lineHeight: 1 }}>
        <div style={{
          fontFamily: 'Archivo Black, sans-serif',
          fontSize: size === 'sm' ? '0.9rem' : size === 'lg' ? '1.4rem' : '1.1rem',
          color: '#F8F8F8',
          letterSpacing: '-0.02em',
          textTransform: 'uppercase',
        }}>
          VIDPROTECT
          <span style={{ color: '#FF2028' }}> AI</span>
        </div>
      </div>
    </div>
  );
};

// ─── STATUS BADGE ─────────────────────────────
export const StatusBadge = ({ label, variant = 'grey', dot = true }) => {
  const classes = {
    green: 'badge badge-green',
    red: 'badge badge-red',
    yellow: 'badge badge-yellow',
    grey: 'badge badge-grey',
    white: 'badge badge-white',
  };
  return (
    <span className={classes[variant] || 'badge badge-grey'}>
      {dot && <span className={`status-dot ${variant === 'green' ? 'active' : variant === 'red' ? 'danger' : variant === 'yellow' ? 'warning' : 'inactive'}`} />}
      {label}
    </span>
  );
};

// ─── KPI CARD ─────────────────────────────────
export const KpiCard = ({ label, value, sublabel, icon: Icon, accent = false }) => (
  <div style={{
    background: '#1D1D1D',
    border: `1px solid ${accent ? '#FF2028' : '#292929'}`,
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    position: 'relative',
    overflow: 'hidden',
  }}>
    {accent && <div style={{ position: 'absolute', top: 0, left: 0, width: '3px', height: '100%', background: '#FF2028' }} />}
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <span className="mono" style={{ color: '#A0A0A0', fontSize: '0.65rem' }}>{label}</span>
      {Icon && <Icon size={18} color={accent ? '#FF2028' : '#565656'} />}
    </div>
    <div style={{
      fontFamily: 'Archivo Black, sans-serif',
      fontSize: '2.5rem',
      color: accent ? '#FF2028' : '#F8F8F8',
      lineHeight: 1,
    }}>
      {value}
    </div>
    {sublabel && <span style={{ fontSize: '0.75rem', color: '#565656' }}>{sublabel}</span>}
  </div>
);

// ─── SECTION LABEL ────────────────────────────
export const SectionLabel = ({ children }) => (
  <div style={{
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    border: '1px solid #FF2028',
    padding: '0.25rem 0.75rem',
    fontFamily: 'IBM Plex Mono, monospace',
    fontSize: '0.65rem',
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#FF2028',
  }}>
    <span>●</span>
    {children}
  </div>
);

// ─── NOTIFICATION TOAST ───────────────────────
export const NotificationToast = () => {
  const { notification } = useApp();
  if (!notification) return null;

  const icons = {
    success: <CheckCircle size={16} color="#22c55e" />,
    error: <AlertTriangle size={16} color="#FF2028" />,
    info: <Info size={16} color="#F8F8F8" />,
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '2rem',
      right: '2rem',
      zIndex: 9999,
      background: '#1D1D1D',
      border: `1px solid ${notification.type === 'error' ? '#FF2028' : notification.type === 'success' ? '#22c55e' : '#EEEEEE'}`,
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      maxWidth: '360px',
      animation: 'fadeIn 0.3s ease',
      boxShadow: '4px 4px 0px rgba(0,0,0,0.5)',
    }}>
      {icons[notification.type] || icons.info}
      <span style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{notification.message}</span>
    </div>
  );
};

// ─── LOADING OVERLAY ──────────────────────────
export const LoadingSpinner = ({ size = 20 }) => (
  <div style={{ width: size, height: size, border: '2px solid #292929', borderTop: '2px solid #FF2028', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
);

// ─── EMPTY STATE ──────────────────────────────
export const EmptyState = ({ icon: Icon, title, description, action }) => (
  <div style={{ textAlign: 'center', padding: '4rem 2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
    {Icon && <Icon size={48} color="#565656" />}
    <div>
      <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>{title}</div>
      <div style={{ color: '#A0A0A0', fontSize: '0.85rem' }}>{description}</div>
    </div>
    {action}
  </div>
);

// ─── MODAL ────────────────────────────────────
export const Modal = ({ isOpen, onClose, title, children, width = '540px' }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.85)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
    }} onClick={onClose}>
      <div style={{
        background: '#1D1D1D',
        border: '1px solid #EEEEEE',
        width: '100%',
        maxWidth: width,
        maxHeight: '90vh',
        overflow: 'auto',
        animation: 'fadeIn 0.2s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem',
          borderBottom: '1px solid #292929',
        }}>
          <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.95rem', textTransform: 'uppercase', letterSpacing: '-0.01em' }}>{title}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#A0A0A0', cursor: 'pointer', display: 'flex', padding: '4px' }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '1.5rem' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

// ─── CONFIRM DIALOG ───────────────────────────
export const ConfirmDialog = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) => (
  <Modal isOpen={isOpen} onClose={onClose} title={title} width="400px">
    <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.5rem' }}>{message}</p>
    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
      <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
      <button className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => { onConfirm(); onClose(); }}>
        {confirmLabel}
      </button>
    </div>
  </Modal>
);

// ─── SEARCH INPUT ─────────────────────────────
export const SearchInput = ({ value, onChange, placeholder = 'Search...' }) => (
  <div style={{ position: 'relative' }}>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="form-input"
      style={{ paddingLeft: '2.5rem', minWidth: '220px' }}
    />
    <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#565656', pointerEvents: 'none', fontSize: '0.85rem' }}>⌕</span>
  </div>
);

// ─── SELECT FILTER ────────────────────────────
export const SelectFilter = ({ value, onChange, options, placeholder }) => (
  <select value={value} onChange={e => onChange(e.target.value)} className="form-input" style={{ minWidth: '160px' }}>
    <option value="">{placeholder}</option>
    {options.map(opt => (
      <option key={opt.value} value={opt.value}>{opt.label}</option>
    ))}
  </select>
);

// ─── PROTECTION STATUS PANEL ──────────────────
export const ProtectionStatusPanel = () => (
  <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
    <div className="mono" style={{ color: '#A0A0A0', marginBottom: '1rem', fontSize: '0.65rem' }}>PROTECTION STATUS</div>
    {[
      { label: 'AES-256 Encryption', status: 'demo', desc: 'Simulated' },
      { label: 'JWT Authentication', status: 'demo', desc: 'Simulated' },
      { label: 'Enrollment Verification', status: 'active', desc: 'Active' },
      { label: 'Temporary Tokens', status: 'active', desc: 'Active' },
      { label: 'Access Monitoring', status: 'active', desc: 'Active' },
    ].map(item => (
      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #292929' }}>
        <span style={{ fontSize: '0.8rem', color: '#F8F8F8' }}>{item.label}</span>
        <span className="badge" style={{ color: item.status === 'active' ? '#22c55e' : '#eab308', borderColor: item.status === 'active' ? '#22c55e' : '#eab308', fontSize: '0.6rem' }}>
          {item.status === 'active' ? '● ' : '◐ '}{item.desc}
        </span>
      </div>
    ))}
    <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: '#101010', border: '1px solid #292929' }}>
      <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>◐ DEMO SIMULATION — Not production security</span>
    </div>
  </div>
);

// ─── VIDEO THUMBNAIL ──────────────────────────
export const VideoThumbnail = ({ video, size = 'md' }) => {
  const colors = ['#1a0a0a', '#0a0a1a', '#0a1a0a', '#1a1a0a', '#0a1a1a', '#1a0a1a'];
  const colorIdx = parseInt(video.id?.split('-')[1] || '0') % colors.length;
  const thumbH = size === 'sm' ? '80px' : size === 'lg' ? '200px' : '120px';

  return (
    <div style={{
      width: '100%',
      height: thumbH,
      background: colors[colorIdx],
      border: '1px solid #292929',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)', backgroundSize: '20px 20px', opacity: 0.4 }} />
      <Shield size={size === 'sm' ? 20 : 32} color="#FF2028" strokeWidth={1.5} style={{ position: 'relative', zIndex: 1 }} />
      <span className="mono" style={{ fontSize: '0.55rem', color: '#FF2028', marginTop: '0.4rem', position: 'relative', zIndex: 1 }}>PROTECTED</span>
      {video.duration && (
        <span className="mono" style={{ position: 'absolute', bottom: '0.4rem', right: '0.4rem', fontSize: '0.6rem', color: '#A0A0A0', background: 'rgba(0,0,0,0.7)', padding: '1px 4px' }}>
          {video.duration}
        </span>
      )}
    </div>
  );
};

// ─── SEVERITY BADGE ───────────────────────────
export const SeverityBadge = ({ severity }) => {
  const map = {
    high: { label: 'HIGH', color: '#FF2028' },
    medium: { label: 'MEDIUM', color: '#eab308' },
    low: { label: 'LOW', color: '#A0A0A0' },
  };
  const s = map[severity] || map.low;
  return (
    <span className="badge" style={{ color: s.color, borderColor: s.color, fontSize: '0.6rem' }}>
      ▲ {s.label}
    </span>
  );
};

// ─── RESULT BADGE ─────────────────────────────
export const ResultBadge = ({ result }) => {
  const map = {
    success: { label: '✓ SUCCESS', color: '#22c55e' },
    denied: { label: '✗ DENIED', color: '#FF2028' },
  };
  const r = map[result] || { label: result?.toUpperCase(), color: '#A0A0A0' };
  return (
    <span className="badge" style={{ color: r.color, borderColor: r.color, fontSize: '0.6rem' }}>
      {r.label}
    </span>
  );
};

// ─── DEMO BANNER ──────────────────────────────
export const DemoBanner = () => (
  <div style={{
    background: '#171717',
    border: '1px solid #292929',
    borderLeft: '3px solid #eab308',
    padding: '0.6rem 1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    margin: '0 0 1.5rem 0',
  }}>
    <span style={{ color: '#eab308', fontSize: '0.7rem' }}>⚠</span>
    <span className="mono" style={{ fontSize: '0.6rem', color: '#A0A0A0' }}>
      DEMO ENVIRONMENT — Security operations are simulated for prototype demonstration purposes
    </span>
  </div>
);

// ─── TOKEN COUNTDOWN ──────────────────────────
export const TokenCountdown = ({ token }) => {
  const [remaining, setRemaining] = useState(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!token) return;
    const update = () => {
      const diff = token.expiryMs - Date.now();
      if (diff <= 0) { setExpired(true); setRemaining(0); return; }
      setRemaining(Math.floor(diff / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [token]);

  if (!token) return null;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div style={{
      background: '#101010',
      border: `1px solid ${expired ? '#FF2028' : '#292929'}`,
      padding: '0.75rem 1rem',
      fontFamily: 'IBM Plex Mono, monospace',
      fontSize: '0.8rem',
    }}>
      <div className="mono" style={{ color: '#565656', fontSize: '0.6rem', marginBottom: '0.3rem' }}>TOKEN EXPIRY</div>
      {expired ? (
        <span style={{ color: '#FF2028' }}>⊗ TOKEN EXPIRED</span>
      ) : (
        <span style={{ color: remaining < 120 ? '#FF2028' : '#22c55e' }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')} REMAINING
        </span>
      )}
      <div className="mono" style={{ fontSize: '0.55rem', color: '#565656', marginTop: '0.3rem', wordBreak: 'break-all' }}>
        {token.tokenId}
      </div>
    </div>
  );
};
