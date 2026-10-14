// ============================================
// DASHBOARD KIT — small shared pieces for the
// learner and admin dashboards
// ============================================

import { useEffect, useMemo, useRef } from 'react';
import { Image as ImageIcon } from 'lucide-react';
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

// Whole rupees; 0 (or missing) is free
export const formatPrice = (amount) =>
  amount > 0 ? `₹${Number(amount).toLocaleString('en-IN')}` : 'Free';

export const PriceBadge = ({ price }) => (
  <span className={`badge ${price > 0 ? 'badge-grey' : 'badge-green'}`} style={{ fontSize: '0.6rem', color: price > 0 ? '#F8F8F8' : undefined }}>
    {formatPrice(price).toUpperCase()}
  </span>
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

const THUMB_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const THUMB_MAX = 5 * 1024 * 1024;

// Picks a thumbnail image. `url` is the saved image, `file` a chosen-but-not-yet-uploaded one.
// onSelect(file) receives a validated file; onRemove() clears it (omit to hide the button).
export const ThumbnailField = ({ url, file, onSelect, onRemove, label = 'Thumbnail', onError }) => {
  const inputRef = useRef(null);
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : url || null), [file, url]);
  useEffect(() => () => { if (file && preview) URL.revokeObjectURL(preview); }, [file, preview]);

  const pick = (f) => {
    if (!f) return;
    if (!THUMB_TYPES.includes(f.type)) { onError?.('Use a JPEG, PNG or WebP image.'); return; }
    if (f.size > THUMB_MAX) { onError?.('Image is larger than 5 MB.'); return; }
    onSelect(f);
  };

  return (
    <div className="form-group">
      <label className="form-label">{label} <span style={{ color: '#565656' }}>(optional)</span></label>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ width: 160, aspectRatio: '16 / 9', background: '#101010', border: '1px solid #292929', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
          {preview
            ? <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <ImageIcon size={22} color="#565656" />}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-start' }}>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={e => { pick(e.target.files[0]); e.target.value = ''; }} />
          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => inputRef.current?.click()}>
            {preview ? 'Change image' : 'Choose image'}
          </button>
          {preview && onRemove && (
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.65rem' }} onClick={onRemove}>Remove</button>
          )}
          <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>JPEG · PNG · WEBP · UP TO 5 MB</span>
        </div>
      </div>
    </div>
  );
};

// A banner image when the course has one, otherwise the thin colour bar
export const CourseCover = ({ course, height = 130 }) => (
  course.thumbUrl
    ? <img src={course.thumbUrl} alt="" style={{ width: '100%', height, objectFit: 'cover', display: 'block' }} />
    : <div style={{ height: 6, background: course.thumbnail || '#292929' }} />
);

export const CourseCard = ({ course, footer, onClick }) => (
  <div
    onClick={onClick}
    style={{ background: '#1D1D1D', border: '1px solid #292929', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', transition: 'border-color 0.15s' }}
    onMouseEnter={e => { if (onClick) e.currentTarget.style.borderColor = '#FF2028'; }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = '#292929'; }}
  >
    <CourseCover course={course} />
    <div style={{ padding: '1.25rem', flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
        <h3 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {course.title}
        </h3>
        <PriceBadge price={course.price} />
      </div>
      <p style={{ color: '#A0A0A0', fontSize: '0.8rem', lineHeight: 1.5, flex: 1 }}>
        {course.description?.length > 110 ? `${course.description.slice(0, 110)}…` : course.description}
      </p>
      {footer}
    </div>
  </div>
);
