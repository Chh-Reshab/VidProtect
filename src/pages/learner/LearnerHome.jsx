// ============================================
// LEARNER HOME — continue watching + my courses. Nothing else.
// ============================================

import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, Compass, Play } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getEnrolledCourses, getProgressMap, getVideoById } from '../../services/dataService';
import { useLiveData } from '../../services/useLiveData';
import { ProgressBar, CourseCard, formatDuration } from '../../components/DashboardKit';

export default function LearnerHome() {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  useLiveData();

  const courses = getEnrolledCourses(currentUser.id);
  const progress = getProgressMap(currentUser.id);
  const activeCourseIds = new Set(courses.filter(c => c.enrollmentStatus === 'active').map(c => c.id));

  // Most recently watched, unfinished video the learner can still open
  const resume = Object.entries(progress)
    .filter(([, p]) => !p.completed)
    .sort(([, a], [, b]) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(([videoId, p]) => ({ video: getVideoById(videoId), p }))
    .find(({ video }) => video && activeCourseIds.has(video.courseId));

  return (
    <div style={{ padding: '2rem', maxWidth: 1100, animation: 'fadeIn 0.3s ease' }}>
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '1.5rem' }}>
        Hi {currentUser.name.split(' ')[0]}
      </h1>

      {resume && (
        <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.5rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '0.4rem' }}>CONTINUE WATCHING</div>
            <div style={{ fontSize: '1.15rem', color: '#F8F8F8', marginBottom: '0.25rem' }}>{resume.video.title}</div>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.75rem' }}>
              {resume.video.courseName} · {formatDuration(resume.p.positionSeconds)} / {resume.video.duration}
            </div>
            <ProgressBar percent={Math.round((resume.p.positionSeconds / (resume.video.durationSeconds || 600)) * 100)} />
          </div>
          <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.8rem 1.6rem' }} onClick={() => navigate(`/learn/watch/${resume.video.id}`)}>
            <Play size={16} /> Resume
          </button>
        </div>
      )}

      <div className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0', marginBottom: '0.75rem' }}>MY COURSES</div>

      {courses.length === 0 ? (
        <div style={{ border: '1px dashed #292929', padding: '3rem', textAlign: 'center', color: '#8B8B8B' }}>
          <BookOpen size={28} color="#292929" style={{ marginBottom: '0.75rem' }} />
          <div style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>You are not enrolled in any courses yet.</div>
          <Link to="/learn/catalog" className="btn btn-primary" style={{ fontSize: '0.8rem' }}><Compass size={14} /> Browse courses</Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
          {courses.map(c => (
            <CourseCard
              key={c.id}
              course={c}
              onClick={() => navigate(`/learn/course/${c.id}`)}
              footer={
                <div>
                  <ProgressBar percent={c.percent} />
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginTop: '0.4rem' }}>
                    {c.completedVideos}/{c.totalVideos} videos · {c.percent}%
                  </div>
                </div>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
