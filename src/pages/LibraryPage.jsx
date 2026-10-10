// ============================================
// VIDEO LIBRARY — VidProtect AI
// ============================================

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Search, Filter, Shield, Clock, Play, Info, Trash2, Video } from 'lucide-react';
import { getVideos, getCourses, deleteVideo } from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, StatusBadge, EmptyState, ConfirmDialog, VideoThumbnail, SearchInput, SelectFilter, DemoBanner } from '../components/SharedComponents';

export default function LibraryPage() {
  const navigate = useNavigate();
  const { showNotification, refreshStats } = useApp();
  const [videos, setVideos] = useState([]);
  const [courses, setCourses] = useState([]);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    setVideos(getVideos());
    setCourses(getCourses());
  }, []);

  const filtered = videos.filter(v => {
    const matchSearch = !search || v.title.toLowerCase().includes(search.toLowerCase()) || v.courseName?.toLowerCase().includes(search.toLowerCase());
    const matchCourse = !courseFilter || v.courseId === courseFilter;
    const matchStatus = !statusFilter || v.protectionStatus === statusFilter;
    return matchSearch && matchCourse && matchStatus;
  });

  const handleDelete = (id) => {
    deleteVideo(id);
    setVideos(getVideos());
    refreshStats();
    showNotification('Video removed from library.');
  };

  const courseOptions = courses.map(c => ({ value: c.id, label: c.title }));
  const statusOptions = [
    { value: 'protected', label: 'Protected' },
    { value: 'unprotected', label: 'Unprotected' },
  ];

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <SectionLabel>CONTENT MANAGEMENT</SectionLabel>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
            VIDEO LIBRARY
          </h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            {videos.length} protected video{videos.length !== 1 ? 's' : ''} in your library.
          </p>
        </div>
        <Link to="/app/upload" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>
          <Upload size={14} /> UPLOAD VIDEO
        </Link>
      </div>

      <DemoBanner />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search videos..." />
        <SelectFilter value={courseFilter} onChange={setCourseFilter} options={courseOptions} placeholder="All Courses" />
        <SelectFilter value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder="All Statuses" />
        {(search || courseFilter || statusFilter) && (
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => { setSearch(''); setCourseFilter(''); setStatusFilter(''); }}>
            CLEAR FILTERS
          </button>
        )}
      </div>

      {/* Video grid */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title="No Videos Found"
          description={search ? `No videos match "${search}"` : 'Upload your first video to get started.'}
          action={<Link to="/app/upload" className="btn btn-primary" style={{ fontSize: '0.7rem' }}><Upload size={14} /> UPLOAD VIDEO</Link>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1px', background: '#292929', border: '1px solid #292929' }}>
          {filtered.map(video => (
            <VideoCard
              key={video.id}
              video={video}
              onOpen={() => navigate(`/app/video/${video.id}`)}
              onPlay={() => navigate(`/app/video/${video.id}?play=1`)}
              onDelete={() => setDeleteId(video.id)}
              formatDate={formatDate}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="REMOVE VIDEO"
        message="Remove this video from your library? This action cannot be undone in the demo."
        confirmLabel="REMOVE"
        danger
      />
    </div>
  );
}

const VideoCard = ({ video, onOpen, onPlay, onDelete, formatDate }) => (
  <div style={{ background: '#1D1D1D', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', transition: 'background 0.15s' }}
    onMouseEnter={e => e.currentTarget.style.background = '#222'}
    onMouseLeave={e => e.currentTarget.style.background = '#1D1D1D'}>

    {/* Thumbnail */}
    <VideoThumbnail video={video} />

    {/* Info */}
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <h3 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '-0.01em', lineHeight: 1.2, flex: 1 }}>
          {video.title}
        </h3>
        <span className={`badge ${video.protectionStatus === 'protected' ? 'badge-green' : 'badge-grey'}`} style={{ fontSize: '0.55rem', flexShrink: 0 }}>
          {video.protectionStatus === 'protected' ? '⚿ PROTECTED' : '○ UNPROTECTED'}
        </span>
      </div>

      <div className="mono" style={{ fontSize: '0.6rem', color: '#FF2028', marginBottom: '0.6rem' }}>
        {video.courseName}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span className="mono" style={{ fontSize: '0.6rem', color: '#565656', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
          <Clock size={10} /> {video.duration}
        </span>
        <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
          {video.fileSize}
        </span>
        <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
          {video.sessions} sessions
        </span>
      </div>

      <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginTop: '0.4rem' }}>
        Uploaded {formatDate(video.uploadDate)}
      </div>
    </div>

    {/* Actions */}
    <div style={{ display: 'flex', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid #292929' }}>
      <button className="btn btn-primary" style={{ fontSize: '0.6rem', flex: 1, justifyContent: 'center', padding: '0.4rem 0.5rem' }} onClick={onPlay}>
        <Play size={12} /> PLAY
      </button>
      <button className="btn btn-secondary" style={{ fontSize: '0.6rem', flex: 1, justifyContent: 'center', padding: '0.4rem 0.5rem' }} onClick={onOpen}>
        <Info size={12} /> DETAILS
      </button>
      <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.4rem 0.5rem' }} onClick={onDelete} aria-label="Delete video">
        <Trash2 size={12} />
      </button>
    </div>
  </div>
);
