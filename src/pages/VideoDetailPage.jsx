// ============================================
// VIDEO DETAIL (creator) — facts about one of your videos,
// its real access history, and a preview link.
// ============================================

import { useState } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Play, ChevronLeft, Trash2, ShieldCheck } from 'lucide-react';
import { getVideoById, getCourseById, getAccessLogs, deleteVideo, setThumbnail, removeThumbnail } from '../services/dataService';
import { ThumbnailField } from '../components/DashboardKit';
import { useLiveData } from '../services/useLiveData';
import { useApp } from '../context/AppContext';
import { SectionLabel, ResultBadge, ConfirmDialog, VideoThumbnail } from '../components/SharedComponents';

const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
const formatTime = (iso) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

const Row = ({ label, children }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.6rem 0', borderBottom: '1px solid #292929', fontSize: '0.8rem' }}>
    <span className="mono" style={{ color: '#565656', fontSize: '0.65rem' }}>{label}</span>
    <span style={{ color: '#F8F8F8', textAlign: 'right' }}>{children}</span>
  </div>
);

export default function VideoDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser, showNotification, refreshStats } = useApp();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [, setVersion] = useState(0); // re-read the store after a thumbnail change

  const video = getVideoById(id);
  useLiveData(video?.uploadStatus === 'processing' ? 1000 : 20000);
  // Creators can only open their own videos; anything else looks like "not found"
  if (!video || video.creatorId !== currentUser.id) return <Navigate to="/studio/library" replace />;

  const course = getCourseById(video.courseId);
  const events = getAccessLogs(currentUser.id).filter(l => l.videoId === video.id).slice(0, 10);

  const changeThumb = async (file) => {
    const result = await setThumbnail('video', video.id, file);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setVersion(v => v + 1);
    showNotification('Thumbnail updated.');
  };

  const clearThumb = async () => {
    const result = await removeThumbnail('video', video.id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setVersion(v => v + 1);
    showNotification('Thumbnail removed.');
  };

  const handleDelete = async () => {
    const result = await deleteVideo(currentUser.id, video.id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    refreshStats();
    showNotification('Video removed from your library.');
    navigate('/studio/library');
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <button className="btn btn-ghost" style={{ fontSize: '0.65rem' }} onClick={() => navigate('/studio/library')}>
          <ChevronLeft size={14} /> BACK TO LIBRARY
        </button>
        <button className="btn btn-primary" style={{ fontSize: '0.65rem' }} onClick={() => navigate(`/studio/preview/${video.id}`)} disabled={video.uploadStatus === 'processing' || video.uploadStatus === 'failed'}>
          <Play size={12} /> PREVIEW VIDEO
        </button>
        <button className="btn btn-ghost" style={{ fontSize: '0.65rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setConfirmDelete(true)}>
          <Trash2 size={12} /> DELETE
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: '1.5rem', alignItems: 'flex-start' }} className="detail-grid">
        <div>
          <SectionLabel>VIDEO DETAILS</SectionLabel>
          {video.uploadStatus === 'processing' && (
            <div role="status" style={{ background: '#1D1D1D', border: '1px solid #292929', borderLeft: '3px solid #eab308', padding: '0.75rem 1rem', margin: '0.75rem 0', fontSize: '0.85rem', color: '#C8C8C8' }}>
              Processing: {video.processing?.label || 'starting'} · {video.processing?.percent ?? 0}%. Learners cannot see this video until it is ready.
            </div>
          )}
          {video.uploadStatus === 'failed' && (
            <div role="alert" style={{ background: '#1D1D1D', border: '1px solid #292929', borderLeft: '3px solid #FF2028', padding: '0.75rem 1rem', margin: '0.75rem 0', fontSize: '0.85rem', color: '#C8C8C8' }}>
              {video.processing?.error || 'Processing failed.'} Delete this video and upload it again.
            </div>
          )}
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '-0.02em', margin: '0.75rem 0 0.5rem', lineHeight: 1.1 }}>
            {video.title}
          </h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>{video.description || 'No description.'}</p>

          <VideoThumbnail video={video} size="lg" />

          <div style={{ background: '#1D1D1D', border: '1px solid #292929', marginTop: '1.5rem' }}>
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929' }}>
              <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>RECENT ACCESS ({events.length})</div>
            </div>
            {events.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: '#565656', fontSize: '0.85rem' }}>Nobody has played this video yet.</div>
            ) : events.map(l => (
              <div key={l.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{l.userName}</div>
                  <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{formatTime(l.timestamp)} · {l.reason}</div>
                </div>
                <ResultBadge result={l.result} />
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <ThumbnailField
              url={video.thumbUrl}
              onSelect={changeThumb}
              onRemove={clearThumb}
              onError={(msg) => showNotification(msg, 'error')}
            />
          </div>

          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '0.5rem' }}>FILE</div>
            <Row label="COURSE">{course?.title || video.courseName}</Row>
            <Row label="DURATION">{video.duration}</Row>
            <Row label="SIZE">{video.fileSize}</Row>
            <Row label="UPLOADED">{formatDate(video.uploadDate)}</Row>
            <Row label="PLAYS">{video.sessions}</Row>
            <Row label="MEDIA FILE">{video.hasMedia ? 'Stored on server' : 'Sample (no file)'}</Row>
          </div>

          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '0.75rem' }}>PROTECTION</div>
            {[
              ['Enrollment check on every play', true],
              ['5-minute playback sessions, renewed while watching', true],
              ['Viewer watermark', true],
              ['Access logging + AI anomaly detection', true],
              ['AES-256-GCM encrypted at rest', video.encryptionStatus === 'encrypted'],
            ].map(([label, on]) => (
              <div key={label} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.3rem 0', fontSize: '0.8rem', color: on ? '#A0A0A0' : '#eab308' }}>
                <ShieldCheck size={13} color={on ? '#22c55e' : '#eab308'} />
                {label}{!on && ' — upload new video to enable'}
              </div>
            ))}
            {video.encryptionStatus === 'encrypted' && (
              <div className="mono" style={{ marginTop: '0.75rem', fontSize: '0.58rem', color: '#22c55e', padding: '0.5rem', background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                AES-256-GCM · ENCRYPTED AT REST · UNIQUE KEY PER VIDEO · TAMPER-PROOF
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="DELETE VIDEO"
        message={`Permanently delete "${video.title}"? The file is removed from the server and learners lose access.`}
        confirmLabel="DELETE"
        danger
      />

      <style>{`
        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
