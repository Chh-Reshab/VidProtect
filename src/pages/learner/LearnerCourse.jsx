// ============================================
// LEARNER COURSE PAGE — video list + enrollment gate
// ============================================

import { Link, useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronLeft, CheckCircle, Lock, Play, Circle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  getCourseById, getCourseVideos, getEnrollments, getProgressMap, getUserById,
} from '../../services/dataService';
import { Panel, ProgressBar, CourseCover, formatPrice } from '../../components/DashboardKit';
import { ProgressRing } from '../../components/LearningWidgets';
import { courseProgress, formatHours } from '../../services/learningStats';

export default function LearnerCourse() {
  const { courseId } = useParams();
  const { currentUser } = useApp();
  const navigate = useNavigate();

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
  const prog = courseProgress(videos, progress);
  const showProgress = hasAccess && !isOwner;
  // Where to pick up: the video you started last, otherwise the first one you have not finished
  const resumeVideo = videos
    .filter(v => progress[v.id] && !progress[v.id].completed && progress[v.id].positionSeconds > 0)
    .sort((a, b) => new Date(progress[b.id].updatedAt) - new Date(progress[a.id].updatedAt))[0]
    || videos.find(v => !progress[v.id]?.completed);

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <button className="btn btn-ghost" style={{ fontSize: '0.7rem', marginBottom: '1.5rem' }} onClick={() => navigate(-1)}>
        <ChevronLeft size={14} /> BACK
      </button>

      <Panel style={{ marginBottom: '1.5rem' }}>
        <CourseCover course={course} height={200} />
        <div style={{ padding: '1.5rem' }}>
          <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028', marginBottom: '0.4rem' }}>
            COURSE{creator && <> · BY <Link to={`/learn/creator/${creator.id}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{creator.name.toUpperCase()}</Link></>}
            {course.status !== 'active' && ' · UNPUBLISHED (ONLY YOU CAN SEE THIS)'}
          </div>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '0.75rem' }}>
            {course.title}
          </h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 720, marginBottom: '1.25rem' }}>{course.description}</p>

          {hasAccess ? (
            !isOwner && (
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap', background: '#171717', border: '1px solid #292929', padding: '1rem 1.25rem' }}>
                <ProgressRing percent={prog.percent} size={92} stroke={8} color={prog.percent === 100 ? '#22c55e' : '#FF2028'} label={`Course progress ${prog.percent} percent`}>
                  <span style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', color: '#F8F8F8' }}>{prog.percent}%</span>
                </ProgressRing>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#808080', marginBottom: '0.3rem' }}>YOUR PROGRESS</div>
                  <div style={{ fontSize: '1rem', color: '#F8F8F8', marginBottom: '0.5rem' }}>
                    {prog.percent === 100 ? 'Course completed' : `${prog.percent}% complete`}
                  </div>
                  <ProgressBar percent={prog.percent} />
                  <div style={{ fontSize: '0.75rem', color: '#808080', marginTop: '0.5rem' }}>
                    {prog.completed} of {prog.total} video{prog.total !== 1 ? 's' : ''} completed
                    {prog.totalSeconds > 0 && <> · {formatHours(prog.watchedSeconds)} of {formatHours(prog.totalSeconds)} watched</>}
                  </div>
                </div>
                {resumeVideo && prog.percent < 100 && (
                  <Link to={`/learn/watch/${resumeVideo.id}`} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>
                    <Play size={13} /> {prog.percent === 0 ? 'Start course' : 'Continue'}
                  </Link>
                )}
              </div>
            )
          ) : enrollment ? (
            <span className="badge badge-red" style={{ fontSize: '0.7rem' }}>YOUR ENROLLMENT IS {enrollment.status.toUpperCase()}</span>
          ) : course.visibility === 'invite_only' ? (
            <span className="badge badge-grey" style={{ fontSize: '0.7rem' }}><Lock size={10} style={{ marginRight: 4 }} />INVITE ONLY — ASK THE CREATOR TO ENROL YOU</span>
          ) : (
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => navigate(`/learn/checkout/${course.id}`)}>
              {course.price > 0 ? `ENROLL · ${formatPrice(course.price)}` : 'ENROLL · FREE'}
            </button>
          )}
        </div>
      </Panel>

      <Panel title={`VIDEOS (${videos.length})`}>
        {videos.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#8B8B8B', fontSize: '0.85rem' }}>No videos have been added yet.</div>
        ) : videos.map((v, i) => {
          const p = progress[v.id];
          const fraction = prog.perVideo[v.id] || 0;
          const pct = Math.round(fraction * 100);
          return (
            <div key={v.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div style={{ width: 24, flexShrink: 0 }}>
                {!hasAccess ? <Lock size={16} color="#8B8B8B" />
                  : p?.completed ? <CheckCircle size={16} color="#22c55e" />
                  : <Circle size={16} color="#8B8B8B" />}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: '0.9rem', color: hasAccess ? '#F8F8F8' : '#A0A0A0' }}>{i + 1}. {v.title}</div>
                <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{v.duration}</div>
                {showProgress && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.45rem', maxWidth: 340 }}>
                    <div style={{ flex: 1 }}><ProgressBar percent={pct} height={4} /></div>
                    <span className="mono" style={{ fontSize: '0.7rem', color: p?.completed ? '#22c55e' : pct > 0 ? '#F8F8F8' : '#565656', minWidth: 74, textAlign: 'right' }}>
                      {p?.completed ? 'COMPLETED' : pct > 0 ? `${pct}% WATCHED` : 'NOT STARTED'}
                    </span>
                  </div>
                )}
              </div>
              {hasAccess ? (
                <Link to={`/learn/watch/${v.id}`} className="btn btn-secondary" style={{ fontSize: '0.7rem', padding: '0.35rem 0.75rem' }}>
                  <Play size={11} /> {p && !p.completed && p.positionSeconds > 0 ? 'RESUME' : p?.completed ? 'WATCH AGAIN' : 'WATCH'}
                </Link>
              ) : (
                <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>ENROL TO WATCH</span>
              )}
            </div>
          );
        })}
      </Panel>
    </div>
  );
}
