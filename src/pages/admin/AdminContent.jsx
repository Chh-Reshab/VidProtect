// ============================================
// ADMIN — content moderation (take down courses, remove videos)
// ============================================

import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getCourses, getVideos, getUserById, moderateCourse, deleteVideo } from '../../services/dataService';
import { ConfirmDialog, SearchInput } from '../../components/SharedComponents';
import { usePaged } from '../../services/usePaged';
import Pager from '../../components/Pager';
import { PageHeader, Panel } from '../../components/DashboardKit';

const STATUS_BADGE = { active: ['badge-green', 'PUBLISHED'], draft: ['badge-grey', 'DRAFT'], taken_down: ['badge-red', 'TAKEN DOWN'] };

export default function AdminContent() {
  const { currentUser, showNotification } = useApp();
  const [courses, setCourses] = useState(getCourses);
  const [videos, setVideos] = useState(getVideos);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [search, setSearch] = useState('');
  const text = search.trim().toLowerCase();
  const creatorName = (id) => (getUserById(id)?.name || id || '').toLowerCase();
  const shownCourses = courses.filter(c => !text || c.title.toLowerCase().includes(text) || creatorName(c.creatorId).includes(text));
  const shownVideos = videos.filter(v => !text || v.title.toLowerCase().includes(text) || (v.courseName || '').toLowerCase().includes(text) || creatorName(v.creatorId).includes(text));
  const courseList = usePaged(shownCourses, 20);
  const videoList = usePaged(shownVideos, 20);

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
      <div style={{ marginBottom: '1rem' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search title, course or creator..." />
      </div>
      <Panel title={`COURSES (${shownCourses.length})`} style={{ marginBottom: '1.5rem' }}>
        {courseList.pageItems.map(c => {
          const [cls, label] = STATUS_BADGE[c.status] || STATUS_BADGE.draft;
          return (
            <div key={c.id} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{c.title}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>
                  BY {getUserById(c.creatorId)?.name || c.creatorId} · {c.videoCount} videos · {c.enrolledCount} learners
                </div>
              </div>
              <span className={`badge ${cls}`} style={{ fontSize: '0.7rem' }}>{label}</span>
              <button
                className={c.status === 'taken_down' ? 'btn btn-secondary' : 'btn btn-ghost'}
                style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem', ...(c.status === 'taken_down' ? {} : { color: '#FF2028', borderColor: '#FF2028' }) }}
                onClick={() => toggleCourse(c)}
              >
                {c.status === 'taken_down' ? 'RESTORE' : 'TAKE DOWN'}
              </button>
            </div>
          );
        })}
        <Pager {...courseList} />
      </Panel>

      <Panel title={`VIDEOS (${shownVideos.length})`}>
        {videoList.pageItems.map(v => (
          <div key={v.id} style={{ padding: '0.9rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>{v.title}</div>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{v.courseName} · BY {getUserById(v.creatorId)?.name || v.creatorId}</div>
            </div>
            {v.encryptionStatus === 'encrypted'
              ? <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>AES-256-GCM</span>
              : <span className="badge badge-grey" style={{ fontSize: '0.7rem' }}>UNENCRYPTED</span>}
            <button className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setRemoveTarget(v)}>REMOVE</button>
          </div>
        ))}
      <Pager {...videoList} />
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
