// ============================================
// LEARNER COURSE PAGE — video list + enrollment gate
// ============================================

import { useState } from 'react';
import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Lock, Play, Circle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getCourseById, getCourseVideos, getEnrollments, getProgressMap, getUserById, selfEnroll,
} from '../../services/mockServices';
import { DemoBanner } from '../../components/SharedComponents';
import { Panel, ProgressBar } from '../../components/DashboardKit';

export default function LearnerCourse() {
  const { courseId } = useParams();
  const { currentUser, showNotification } = useApp();
  const navigate = useNavigate();
  const [, setVersion] = useState(0); // bumped after enrolling to re-read the store

  const course = getCourseById(courseId);
  const isOwner = course?.creatorId === currentUser.id;

  // Hide unpublished courses from everyone but their owner (404-style redirect)
  if (!course || (course.status !== 'active' && !isOwner)) {
    return <Navigate to="/learn/courses" replace />;
  }

  const enrollment = getEnrollments().find(e => e.studentId === currentUser.id && e.courseId === course.id);
  const hasAccess = isOwner || enrollment?.status === 'active';
  const videos = getCourseVideos(course.id);
  const progress = getProgressMap(currentUser.id);
  const creator = getUserById(course.creatorId);
  const done = videos.filter(v => progress[v.id]?.completed).length;
  const percent = videos.length ? Math.round((done / videos.length) * 100) : 0;

  const handleEnroll = () => {
    const result = selfEnroll(currentUser.id, course.id);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setVersion(v => v + 1);
    showNotification('You are enrolled. Happy learning!');
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <button className="btn btn-ghost" style={{ fontSize: '0.65rem', marginBottom: '1.5rem' }} onClick={() => navigate(-1)}>
        <ChevronLeft size={14} /> BACK
      </button>
      <DemoBanner />

      <Panel style={{ marginBottom: '1.5rem' }}>
        <div style={{ height: 6, background: course.thumbnail || '#292929' }} />
        <div style={{ padding: '1.5rem' }}>
          <div className="mono" style={{ fontSize: '0.6rem', color: '#FF2028', marginBottom: '0.4rem' }}>
            COURSE{creator ? ` · BY ${creator.name.toUpperCase()}` : ''}
            {course.status !== 'active' && ' · UNPUBLISHED (ONLY YOU CAN SEE THIS)'}
          </div>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            {course.title}
          </h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 720, marginBottom: '1.25rem' }}>{course.description}</p>

          {hasAccess ? (
            !isOwner && (
              <div style={{ maxWidth: 360 }}>
                <ProgressBar percent={percent} />
                <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginTop: '0.4rem' }}>{done}/{videos.length} videos completed · {percent}%</div>
              </div>
            )
          ) : enrollment ? (
            <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>YOUR ENROLLMENT IS {enrollment.status.toUpperCase()}</span>
          ) : course.visibility === 'invite_only' ? (
            <span className="badge badge-grey" style={{ fontSize: '0.65rem' }}><Lock size={10} style={{ marginRight: 4 }} />INVITE ONLY — ASK THE CREATOR TO ENROL YOU</span>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} onClick={handleEnroll}>ENROLL IN THIS COURSE</button>
          )}
        </div>
      </Panel>

      <Panel title={`VIDEOS (${videos.length})`}>
        {videos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#565656', fontSize: '0.85rem' }}>No videos have been added yet.</div>
        ) : videos.map((v, i) => {
          const p = progress[v.id];
          return (
            <div key={v.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ width: 24, flexShrink: 0 }}>
                {!hasAccess ? <Lock size={16} color="#565656" />
                  : p?.completed ? <CheckCircle size={16} color="#22c55e" />
                  : <Circle size={16} color="#565656" />}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.9rem', color: hasAccess ? '#F8F8F8' : '#A0A0A0' }}>{i + 1}. {v.title}</div>
                <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{v.duration}</div>
              </div>
              {hasAccess ? (
                <Link to={`/learn/watch/${v.id}`} className="btn btn-secondary" style={{ fontSize: '0.6rem', padding: '0.35rem 0.75rem' }}>
                  <Play size={11} /> {p && !p.completed && p.positionSeconds > 0 ? 'RESUME' : p?.completed ? 'WATCH AGAIN' : 'WATCH'}
                </Link>
              ) : (
                <span className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>ENROL TO WATCH</span>
              )}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
