// ============================================
// MY VIDEOS — the creator's home. Click a video to play it.
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Upload, Play, Info, Trash2, Video, Clock } from 'lucide-react';
import { getVideos, getCourses, deleteVideo } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { useLiveData } from '../services/useLiveData';
import { EmptyState, ConfirmDialog, VideoThumbnail, SearchInput, SelectFilter } from '../components/SharedComponents';

export default function LibraryPage() {
  const navigate = useNavigate();
  const { currentUser, showNotification, refreshStats } = useApp();
  const [, setVersion] = useState(0);
  const videos = getVideos(currentUser.id);
  // refresh quickly while anything is still processing, slowly otherwise
  useLiveData(videos.some(v => v.uploadStatus === 'processing') ? 1000 : 20000);
  const [courses] = useState(() => getCourses(currentUser.id));
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');
  const [deleteId, setDeleteId] = useState(null);

  const filtered = videos.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.title.toLowerCase().includes(q) || v.courseName?.toLowerCase().includes(q);
    return matchSearch && (!courseFilter || v.courseId === courseFilter);
  });

  const handleDelete = async (id) => {
    const result = await deleteVideo(currentUser.id, id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setVersion(v => v + 1);
    refreshStats();
    showNotification('Video removed.');
  };

  const play = (id) => navigate(`/studio/preview/${id}`);
  const ready = (v) => v.uploadStatus !== 'processing' && v.uploadStatus !== 'failed';

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>
        My Videos
      </h1>

      {videos.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <SearchInput value={search} onChange={setSearch} placeholder="Search videos..." />
          {courses.length > 1 && (
            <SelectFilter value={courseFilter} onChange={setCourseFilter} options={courses.map(c => ({ value: c.id, label: c.title }))} placeholder="All courses" />
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          icon={Video}
          title={videos.length ? 'No matching videos' : 'No videos yet'}
          description={videos.length ? `Nothing matches "${search}".` : 'Upload your first video to get started.'}
          action={!videos.length && <Link to="/studio/upload" className="btn btn-primary" style={{ fontSize: '0.8rem' }}><Upload size={14} /> Upload video</Link>}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.25rem' }}>
          {filtered.map(video => (
            <div key={video.id} style={{ background: '#1D1D1D', border: '1px solid #292929', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', cursor: ready(video) ? 'pointer' : 'default' }} onClick={() => ready(video) && play(video.id)} title={ready(video) ? 'Play' : undefined}>
                <VideoThumbnail video={video} />
                {video.uploadStatus === 'processing' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,16,16,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.6rem', padding: '0 1.5rem' }}>
                    <span className="mono" style={{ fontSize: '0.7rem', color: '#F8F8F8' }}>{(video.processing?.label || 'Processing').toUpperCase()} · {video.processing?.percent ?? 0}%</span>
                    <div style={{ background: '#292929', height: 4, width: '100%' }}>
                      <div style={{ background: '#FF2028', height: '100%', width: `${video.processing?.percent ?? 0}%`, transition: 'width 0.25s linear' }} />
                    </div>
                  </div>
                )}
                {video.uploadStatus === 'failed' && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,16,16,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 1rem' }}>
                    <span className="mono" style={{ fontSize: '0.7rem', color: '#FF2028' }}>PROCESSING FAILED · DELETE AND UPLOAD AGAIN</span>
                  </div>
                )}
              </div>
              <div style={{ padding: '0.9rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
                <div style={{ fontSize: '0.95rem', color: '#F8F8F8', lineHeight: 1.3 }}>{video.title}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <span style={{ color: '#FF2028' }}>{video.courseName}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Clock size={10} /> {video.duration}</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: '0.75rem' }} onClick={() => play(video.id)} disabled={!ready(video)}>
                    <Play size={13} /> {video.uploadStatus === 'processing' ? 'Processing…' : 'Play'}
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => navigate(`/studio/video/${video.id}`)} aria-label="Video details" title="Details">
                    <Info size={14} />
                  </button>
                  <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => setDeleteId(video.id)} aria-label="Delete video" title="Delete">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => handleDelete(deleteId)}
        title="DELETE VIDEO"
        message="Delete this video? The file is removed and learners lose access."
        confirmLabel="DELETE"
        danger
      />
    </div>
  );
}
