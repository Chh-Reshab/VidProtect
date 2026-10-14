// ============================================
// ADMIN — content moderation (take down courses, remove videos)
// ============================================

import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getCourses, getVideos, getUserById, moderateCourse, deleteVideo } from '../../services/dataService';
import { ConfirmDialog } from '../../components/SharedComponents';
import { PageHeader, Panel } from '../../components/DashboardKit';

const STATUS_BADGE = { active: ['badge-green', 'PUBLISHED'], draft: ['badge-grey', 'DRAFT'], taken_down: ['badge-red', 'TAKEN DOWN'] };

export default function AdminContent() {
  const { currentUser, showNotification } = useApp();
  const [courses, setCourses] = useState(getCourses);
  const [videos, setVideos] = useState(getVideos);
  const [removeTarget, setRemoveTarget] = useState(null);

  const toggleCourse = async (course) => {
    const result = await moderateCourse(currentUser.id, course.id, course.status !== 'taken_down');
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setCourses(getCourses());
    showNotification(course.status === 'taken_down' ? 'Course restored as a draft.' : 'Course taken down.');
  };

  const removeVideo = async () => {
    const result = await deleteVideo(currentUser.id, removeTarget.id);
    if (!result.success) showNotification(result.error, 'error');
    else showNotification('Video removed.');
    setVideos(getVideos());
    setCourses(getCourses());
    setRemoveTarget(null);
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="CONTENT MODERATION" subtitle="Take down courses or remove videos that break the content policy. Actions are written to the audit log." />
      <Panel title={`COURSES (${courses.length})`} style={{ marginBottom: '1.5rem' }}>
        {courses.map(c => {
          const [cls, label] = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
          return (
            <div key={c.id} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{c.title}</div>
                <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>
                  BY {getUserById(c.creatorId)?.name || c.creatorId} · {c.videoCount} videos · {c.enrolledCount} learners
                </div>
              </div>
              <span className={`badge ${cls}`} style={{ fontSize: '0.55rem' }}>{label}</span>
              <button
                className={c.status === 'taken_down' ? 'btn btn-secondary' : 'btn btn-ghost'}
                style={{ fontSize: '0.6rem', padding: '0.3rem 0.7rem', ...(c.status === 'taken_down' ? {} : { color: '#FF2028', borderColor: '#FF2028' }) }}
                onClick={() => toggleCourse(c)}
              >
                {c.status === 'taken_down' ? 'RESTORE' : 'TAKE DOWN'}
              </button>
            </div>
          );
        })}
      </Panel>

      <Panel title={`VIDEOS (${videos.length})`}>
        {videos.map(v => (
          <div key={v.id} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{v.title}</div>
              <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{v.courseName} · BY {getUserById(v.creatorId)?.name || v.creatorId}</div>
            </div>
            {v.encryptionStatus === 'encrypted'
              ? <span className="badge badge-green" style={{ fontSize: '0.5rem' }}>AES-256-GCM</span>
              : <span className="badge badge-grey" style={{ fontSize: '0.5rem' }}>UNENCRYPTED</span>}
            <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.7rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setRemoveTarget(v)}>REMOVE</button>
          </div>
        ))}
      </Panel>

      <ConfirmDialog
        isOpen={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        onConfirm={removeVideo}
        title="REMOVE VIDEO"
        message={`Permanently remove "${removeTarget?.title}"? The creator will lose this video.`}
        confirmLabel="REMOVE"
        danger
      />
    </div>
  );
}
