// ============================================
// LEARNER HOME — continue watching, progress, activity
// ============================================

import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, PlayCircle, Compass } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getEnrolledCourses, getProgressMap, getVideoById, getWatchHistory,
} from '../../services/mockServices';
import { KpiCard, DemoBanner, ResultBadge } from '../../components/SharedComponents';
import { PageHeader, Panel, ProgressBar, CourseCard, formatDate, formatDuration } from '../../components/DashboardKit';

export default function LearnerHome() {
  const { currentUser } = useApp();
  const navigate = useNavigate();

  const courses = getEnrolledCourses(currentUser.id);
  const progress = getProgressMap(currentUser.id);
  const history = getWatchHistory(currentUser.id).slice(0, 5);

  const activeCourseIds = new Set(courses.filter(c => c.enrollmentStatus === 'active').map(c => c.id));

  // Most recently watched, unfinished video the learner can still open
  const resume = Object.entries(progress)
    .filter(([, p]) => !p.completed)
    .sort(([, a], [, b]) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(([videoId, p]) => ({ video: getVideoById(videoId), p }))
    .find(({ video }) => video && activeCourseIds.has(video.courseId));

  const completedVideos = Object.values(progress).filter(p => p.completed).length;
  const finishedCourses = courses.filter(c => c.totalVideos > 0 && c.percent === 100).length;

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader
        label="LEARNER DASHBOARD"
        title="MY LEARNING"
        subtitle={`Welcome back, ${currentUser.name.split(' ')[0]}. Pick up where you left off.`}
        actions={<Link to="/learn/catalog" className="btn btn-secondary" style={{ fontSize: '0.7rem' }}><Compass size={14} /> BROWSE COURSES</Link>}
      />

      <DemoBanner />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', marginBottom: '1.5rem' }}>
        <KpiCard label="ENROLLED COURSES" value={courses.length} icon={BookOpen} />
        <KpiCard label="VIDEOS COMPLETED" value={completedVideos} icon={CheckCircle} />
        <KpiCard label="COURSES FINISHED" value={finishedCourses} icon={PlayCircle} />
      </div>

      {resume && (
        <Panel title="CONTINUE WATCHING" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: '1rem', color: '#F8F8F8', marginBottom: '0.25rem' }}>{resume.video.title}</div>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.75rem' }}>
                {resume.video.courseName} · {formatDuration(resume.p.positionSeconds)} / {resume.video.duration}
              </div>
              <ProgressBar percent={Math.round((resume.p.positionSeconds / (resume.video.durationSeconds || 600)) * 100)} />
            </div>
            <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => navigate(`/learn/watch/${resume.video.id}`)}>
              RESUME
            </button>
          </div>
        </Panel>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>MY COURSES</div>
        {courses.length > 0 && <Link to="/learn/courses" className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }}>VIEW ALL</Link>}
      </div>

      {courses.length === 0 ? (
        <div style={{ border: '1px dashed #292929', padding: '3rem', textAlign: 'center', color: '#565656', marginBottom: '1.5rem' }}>
          <BookOpen size={28} color="#292929" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>You are not enrolled in any courses yet.</div>
          <Link to="/learn/catalog" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>BROWSE COURSES</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          {courses.slice(0, 3).map(c => (
            <CourseCard
              key={c.id}
              course={c}
              onClick={() => navigate(`/learn/course/${c.id}`)}
              footer={
                <div>
                  <ProgressBar percent={c.percent} />
                  <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginTop: '0.4rem' }}>
                    {c.completedVideos}/{c.totalVideos} videos · {c.percent}%
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}

      <Panel title="RECENT ACTIVITY" action={<Link to="/learn/history" className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }}>FULL HISTORY</Link>}>
        {history.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#565656', fontSize: '0.85rem' }}>No activity yet.</div>
        ) : history.map(l => (
          <div key={l.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '0.85rem', color: '#F8F8F8' }}>{l.videoTitle}</div>
              <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{formatDate(l.timestamp)}</div>
            </div>
            <ResultBadge result={l.result} />
          </div>
        ))}
      </Panel>
    </div>
  );
}
