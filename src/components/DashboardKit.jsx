// ============================================
// DASHBOARD KIT — small shared pieces for the
// learner and admin dashboards
// ============================================

import { SectionLabel } from './SharedComponents';

export const PageHeader = ({ label, title, subtitle, actions }) => (
  <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
    <div>
      <SectionLabel>{label}</SectionLabel>
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
        {title}
      </h1>
      {subtitle && <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>{subtitle}</p>}
    </div>
    {actions && <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>{actions}</div>}
  </div>
);

export const ProgressBar = ({ percent, height = 6 }) => (
  <div style={{ background: '#292929', height, width: '100%' }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
    <div style={{ background: percent >= 100 ? '#22c55e' : '#FF2028', height: '100%', width: `${Math.min(100, percent)}%`, transition: 'width 0.3s' }} />
  </div>
);

export const Panel = ({ title, action, children, style }) => (
  <div style={{ background: '#1D1D1D', border: '1px solid #292929', ...style }}>
    {title && (
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>{title}</div>
        {action}
      </div>
    )}
    {children}
  </div>
);

export const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export const formatDuration = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
};

export const CourseCard = ({ course, footer, onClick }) => (
  <div
    onClick={onClick}
    style={{ background: '#1D1D1D', border: '1px solid #292929', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = '#FF2028'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#292929'; }}
  >
    <div style={{ height: 6, background: course.thumbnail || '#292929' }} />
    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <h3 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
        {course.title}
      </h3>
      <p style={{ color: '#A0A0A0', fontSize: '0.8rem', lineHeight: 1.5, flex: 1 }}>
        {course.description?.length > 110 ? `${course.description.slice(0, 110)}…` : course.description}
      </p>
      {footer}
    </div>
  </div>
);
