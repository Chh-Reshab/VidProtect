// ============================================
// LEARNER COURSES
//   mode "mine"    — courses you are enrolled in, with progress
//   mode "catalog" — browse everything published: thumbnails, details, filters
// ============================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Lock, Video, Users, Search, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getEnrolledCourses, getCatalog, getUserById } from '../../services/dataService';
import { useLiveData } from '../../services/useLiveData';
import { SearchInput, SelectFilter } from '../../components/SharedComponents';
import { ProgressBar, CourseCard, formatPrice } from '../../components/DashboardKit';

const PROGRESS_FILTERS = [
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
];

const PRICE_OPTIONS = [
  { value: '', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];
const LENGTH_OPTIONS = [
  { value: '', label: 'Any length' },
  { value: 'short', label: 'Short (1–3 videos)' },
  { value: 'medium', label: 'Medium (4–9 videos)' },
  { value: 'long', label: 'Long (10+ videos)' },
];
const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'popular', label: 'Most learners' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'az', label: 'Title: A–Z' },
];

const initials = (name) => (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
const videoTotal = (c) => c.videoCount ?? c.totalVideos ?? 0;

// Rounded filter chip wrapping a native select, so it works with keyboard and screen readers
const FilterChip = ({ label, value, onChange, options, active }) => (
  <label style={{
    display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
    border: `1px solid ${active ? '#FF2028' : '#3a3a3a'}`,
    background: active ? 'rgba(255,32,40,0.08)' : '#171717',
    borderRadius: 999, padding: '0.35rem 0.5rem 0.35rem 0.85rem', cursor: 'pointer',
  }}>
    <span className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{label}</span>
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      aria-label={label}
      style={{ background: 'transparent', border: 'none', color: '#F8F8F8', fontSize: '0.8rem', outline: 'none', cursor: 'pointer', maxWidth: 170 }}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: '#1D1D1D' }}>{o.label}</option>)}
    </select>
  </label>
);

const CatalogCard = ({ course, creator, enrolled, onOpen }) => {
  const price = course.price || 0;
  const inviteOnly = course.visibility === 'invite_only';
  return (
    <article
      onClick={onOpen}
      onKeyDown={e => { if (e.key === 'Enter') onOpen(); }}
      tabIndex={0}
      role="link"
      aria-label={course.title}
      style={{ background: '#1D1D1D', border: '1px solid #292929', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'border-color 0.15s, transform 0.15s' }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#FF2028'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#292929'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Thumbnail */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#101010', overflow: 'hidden' }}>
        {course.thumbUrl ? (
          <img src={course.thumbUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `linear-gradient(135deg, ${course.thumbnail && course.thumbnail !== '#292929' ? course.thumbnail : '#2a1215'} 0%, #101010 85%)` }}>
            <BookOpen size={36} color="rgba(248,248,248,0.35)" strokeWidth={1.3} />
          </div>
        )}
        <span style={{
          position: 'absolute', top: 10, left: 10, fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem', borderRadius: 4,
          background: price > 0 ? 'rgba(16,16,16,0.9)' : '#22c55e', color: price > 0 ? '#F8F8F8' : '#06260f',
        }}>
          {formatPrice(price)}
        </span>
      </div>

      {/* Details */}
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem', flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <div style={{ width: 28, height: 28, background: '#292929', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', color: '#A0A0A0', flexShrink: 0 }} aria-hidden="true">
            {initials(creator?.name)}
          </div>
          <span style={{ fontSize: '0.8rem', color: '#A0A0A0' }}>{creator?.name || 'VidProtect creator'}</span>
        </div>

        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#F8F8F8', lineHeight: 1.3 }}>{course.title}</h3>

        <p style={{
          fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.5, flex: 1,
          display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {course.description || 'No description yet.'}
        </p>

        <div style={{ display: 'flex', gap: '0.9rem', fontSize: '0.72rem', color: '#808080', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Video size={12} /> {videoTotal(course)} video{videoTotal(course) !== 1 ? 's' : ''}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {course.enrolledCount || 0} learner{course.enrolledCount !== 1 ? 's' : ''}</span>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', minHeight: 22 }}>
          {enrolled ? (
            <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>ENROLLED</span>
          ) : inviteOnly ? (
            <span className="badge badge-grey" style={{ fontSize: '0.7rem' }}><Lock size={9} style={{ marginRight: 4 }} />INVITE ONLY</span>
          ) : (
            <span className="badge" style={{ fontSize: '0.7rem', color: '#C8C8C8', borderColor: '#3a3a3a' }}>{price > 0 ? 'PAID COURSE' : 'FREE TO JOIN'}</span>
          )}
        </div>
      </div>
    </article>
  );
};

const emptyFilters = { price: '', creator: '', length: '', sort: 'newest', notEnrolled: false };

export default function LearnerCourses({ mode }) {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  useLiveData();
  const [search, setSearch] = useState('');
  const [progress, setProgress] = useState('');
  const [filters, setFilters] = useState(emptyFilters);
  const mine = getEnrolledCourses(currentUser.id);
  const enrolledIds = new Set(mine.map(c => c.id));
  const setFilter = (key) => (value) => setFilters(f => ({ ...f, [key]: value }));

  const matches = (c) => {
    const q = search.trim().toLowerCase();
    return !q || c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q) || getUserById(c.creatorId)?.name?.toLowerCase().includes(q);
  };

  // ── My courses ──
  if (mode === 'mine') {
    const list = mine.filter(matches).filter(c => {
      if (progress === 'completed') return c.totalVideos > 0 && c.percent === 100;
      if (progress === 'in_progress') return !(c.totalVideos > 0 && c.percent === 100);
      return true;
    });
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>My courses</h1>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search courses..." />
          <SelectFilter value={progress} onChange={setProgress} options={PROGRESS_FILTERS} placeholder="All courses" />
        </div>
        {list.length === 0 ? (
          <div style={{ border: '1px dashed #292929', padding: '3rem', textAlign: 'center', color: '#8B8B8B' }}>
            <BookOpen size={28} color="#292929" style={{ marginBottom: '0.75rem' }} />
            <div style={{ fontSize: '0.85rem' }}>No courses to show. Browse the catalog to enrol.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {list.map(c => (
              <CourseCard
                key={c.id}
                course={c}
                onClick={() => navigate(`/learn/course/${c.id}`)}
                footer={c.enrollmentStatus !== 'active' ? (
                  <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>ENROLLMENT {c.enrollmentStatus.toUpperCase()}</span>
                ) : (
                  <div>
                    <ProgressBar percent={c.percent} />
                    <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginTop: '0.4rem' }}>{c.completedVideos}/{c.totalVideos} videos · {c.percent}%</div>
                  </div>
                )}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Catalog ──
  // creators don't see their own courses here
  const all = getCatalog().filter(c => c.creatorId !== currentUser.id);
  const creatorOptions = [
    { value: '', label: 'Any creator' },
    ...[...new Set(all.map(c => c.creatorId))]
      .map(id => ({ value: id, label: getUserById(id)?.name || id }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const lengthOk = (c) => {
    const n = videoTotal(c);
    if (filters.length === 'short') return n >= 1 && n <= 3;
    if (filters.length === 'medium') return n >= 4 && n <= 9;
    if (filters.length === 'long') return n >= 10;
    return true;
  };

  const sorters = {
    newest: (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0),
    popular: (a, b) => (b.enrolledCount || 0) - (a.enrolledCount || 0),
    price_asc: (a, b) => (a.price || 0) - (b.price || 0),
    price_desc: (a, b) => (b.price || 0) - (a.price || 0),
    az: (a, b) => a.title.localeCompare(b.title),
  };

  const list = all
    .filter(matches)
    .filter(c => !filters.price || (filters.price === 'free' ? !(c.price > 0) : c.price > 0))
    .filter(c => !filters.creator || c.creatorId === filters.creator)
    .filter(lengthOk)
    .filter(c => !filters.notEnrolled || !enrolledIds.has(c.id))
    .sort(sorters[filters.sort] || sorters.newest);

  const activeCount = [filters.price, filters.creator, filters.length, filters.notEnrolled, search.trim()].filter(Boolean).length;
  const clearAll = () => { setFilters(emptyFilters); setSearch(''); };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.25rem' }}>Browse courses</h1>
      <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: '1.25rem' }}>Learn from creators on VidProtect AI. Every video is protected and streams only to enrolled learners.</p>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div style={{ position: 'relative', minWidth: 220, flex: '0 1 280px' }}>
          <Search size={14} color="#8B8B8B" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: 34, borderRadius: 999 }}
            placeholder="Search courses or creators"
            value={search}
            onChange={e => setSearch(e.target.value)}
            aria-label="Search courses"
          />
        </div>
        <FilterChip label="PRICE" value={filters.price} onChange={setFilter('price')} options={PRICE_OPTIONS} active={!!filters.price} />
        <FilterChip label="CREATOR" value={filters.creator} onChange={setFilter('creator')} options={creatorOptions} active={!!filters.creator} />
        <FilterChip label="LENGTH" value={filters.length} onChange={setFilter('length')} options={LENGTH_OPTIONS} active={!!filters.length} />
        <button
          type="button"
          aria-pressed={filters.notEnrolled}
          onClick={() => setFilter('notEnrolled')(!filters.notEnrolled)}
          style={{
            border: `1px solid ${filters.notEnrolled ? '#FF2028' : '#3a3a3a'}`, background: filters.notEnrolled ? 'rgba(255,32,40,0.08)' : '#171717',
            color: '#F8F8F8', borderRadius: 999, padding: '0.5rem 0.9rem', fontSize: '0.8rem', cursor: 'pointer',
          }}
        >
          Not enrolled yet
        </button>
        <div style={{ marginLeft: 'auto' }}>
          <FilterChip label="SORT" value={filters.sort} onChange={setFilter('sort')} options={SORT_OPTIONS} active={false} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', minHeight: 28 }}>
        <span className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{list.length} COURSE{list.length !== 1 ? 'S' : ''}</span>
        {activeCount > 0 && (
          <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.25rem 0.6rem' }} onClick={clearAll}>
            <X size={11} /> Clear filters ({activeCount})
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div style={{ border: '1px dashed #292929', padding: '3rem', textAlign: 'center', color: '#8B8B8B' }}>
          <BookOpen size={28} color="#292929" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>No courses match these filters.</div>
          {activeCount > 0 && <button className="btn btn-secondary" style={{ fontSize: '0.75rem' }} onClick={clearAll}>Clear filters</button>}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
          {list.map(c => (
            <CatalogCard
              key={c.id}
              course={c}
              creator={getUserById(c.creatorId)}
              enrolled={enrolledIds.has(c.id)}
              onOpen={() => navigate(`/learn/course/${c.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
