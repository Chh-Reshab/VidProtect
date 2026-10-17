// ============================================
// LEARNER ACCOUNT — profile, password, become-a-creator
// ============================================

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, Clapperboard, Award, Lock, Flame } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { changePassword, getEnrolledCourses, getProgressMap, getActivity } from '../../services/dataService';
import { useLiveData } from '../../services/useLiveData';
import { activityStats, formatHours } from '../../services/learningStats';
import { ProgressRing, ActivityHeatmap, StatTile } from '../../components/LearningWidgets';
import { PageHeader, Panel } from '../../components/DashboardKit';

const Card = ({ children, style }) => (
  <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem', ...style }}>{children}</div>
);

const Chip = ({ label, value, color }) => (
  <div style={{ background: '#171717', border: '1px solid #292929', padding: '0.5rem 0.9rem', minWidth: 92 }}>
    <div style={{ fontSize: '0.7rem', color, fontWeight: 600 }}>{label}</div>
    <div style={{ fontSize: '0.85rem', color: '#F8F8F8', marginTop: 2 }}>{value}</div>
  </div>
);

// Everything here comes from the learner's own saved watch progress and daily watch time
const LearningDashboard = ({ userId }) => {
  useLiveData(15000);
  const courses = getEnrolledCourses(userId).filter(c => c.enrollmentStatus === 'active');
  const progress = getProgressMap();
  const stats = activityStats(getActivity());

  const totalVideos = courses.reduce((n, c) => n + c.totalVideos, 0);
  const completedVideos = courses.reduce((n, c) => n + c.completedVideos, 0);
  const percent = totalVideos ? Math.round((completedVideos / totalVideos) * 100) : 0;
  const finished = courses.filter(c => c.totalVideos > 0 && c.percent === 100).length;
  const notStarted = courses.filter(c => c.completedVideos === 0 && !(c.watchedSeconds > 0)).length;
  const inProgress = courses.length - finished - notStarted;
  const videosWatched = Object.values(progress).filter(p => p.completed || p.positionSeconds > 0).length;

  const badges = [
    { id: 'first', label: 'First video', hint: 'Finish a video', earned: completedVideos >= 1, have: completedVideos, need: 1 },
    { id: 's3', label: '3-day streak', hint: 'Watch 3 days in a row', earned: stats.maxStreak >= 3, have: stats.maxStreak, need: 3 },
    { id: 's7', label: '7-day streak', hint: 'Watch 7 days in a row', earned: stats.maxStreak >= 7, have: stats.maxStreak, need: 7 },
    { id: 's30', label: '30-day streak', hint: 'Watch 30 days in a row', earned: stats.maxStreak >= 30, have: stats.maxStreak, need: 30 },
    { id: 'h10', label: '10 hours', hint: 'Watch 10 hours in total', earned: stats.totalSeconds >= 36000, have: Math.floor(stats.totalSeconds / 3600), need: 10 },
    { id: 'course', label: 'Course finished', hint: 'Complete every video in a course', earned: finished >= 1, have: finished, need: 1 },
  ];
  const earned = badges.filter(b => b.earned).length;
  const next = badges.find(b => !b.earned);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
        <Card style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <ProgressRing percent={percent} size={130} stroke={10} label={`${completedVideos} of ${totalVideos} videos completed`}>
            <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.9rem', lineHeight: 1, color: '#F8F8F8' }}>
              {completedVideos}<span style={{ fontSize: '0.8rem', color: '#808080' }}>/{totalVideos}</span>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#22c55e', marginTop: 4 }}>✓ Completed</div>
          </ProgressRing>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, minWidth: 140 }}>
            <Chip label="Courses finished" value={finished} color="#22c55e" />
            <Chip label="In progress" value={inProgress} color="#eab308" />
            <Chip label="Not started" value={notStarted} color="#A0A0A0" />
          </div>
        </Card>

        <Card>
          <div style={{ fontSize: '0.8rem', color: '#A0A0A0' }}>Badges</div>
          <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', lineHeight: 1.1, margin: '0.25rem 0 0.9rem' }}>{earned}<span style={{ fontSize: '0.9rem', color: '#808080' }}> / {badges.length}</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {badges.map(b => (
              <span key={b.id} title={b.hint} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.72rem', padding: '0.3rem 0.65rem',
                border: `1px solid ${b.earned ? '#22c55e' : '#292929'}`, color: b.earned ? '#F8F8F8' : '#565656',
                background: b.earned ? 'rgba(34,197,94,0.08)' : 'transparent',
              }}>
                {b.earned ? <Award size={12} color="#22c55e" /> : <Lock size={11} />} {b.label}
              </span>
            ))}
          </div>
          {next && (
            <div className="mono" style={{ fontSize: '0.6rem', color: '#808080', marginTop: '0.9rem' }}>
              NEXT: {next.label.toUpperCase()} · {Math.min(next.have, next.need)}/{next.need}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'baseline', marginBottom: '1rem' }}>
          <div style={{ fontSize: '0.85rem', color: '#A0A0A0' }}>
            <strong style={{ fontSize: '1.25rem', color: '#F8F8F8' }}>{formatHours(stats.yearSeconds)}</strong> watched in the past year
          </div>
          <div style={{ fontSize: '0.75rem', color: '#808080', display: 'flex', gap: '1.1rem', flexWrap: 'wrap' }}>
            <span>Total active days: <strong style={{ color: '#F8F8F8' }}>{stats.yearActiveDays}</strong></span>
            <span>Max streak: <strong style={{ color: '#F8F8F8' }}>{stats.maxStreak}</strong></span>
            <span>Current streak: <strong style={{ color: '#F8F8F8' }}>{stats.currentStreak}</strong></span>
          </div>
        </div>
        <ActivityHeatmap activity={getActivity()} />
        {stats.activeDays === 0 && (
          <div style={{ fontSize: '0.8rem', color: '#808080', marginTop: '0.75rem' }}>Watch a video for at least 30 seconds to light up your first day.</div>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
        <StatTile label="DAYS ONLINE" value={stats.activeDays} sub={stats.today ? 'including today' : 'days with watching'} />
        <StatTile label="VIDEOS WATCHED" value={videosWatched} sub={`${completedVideos} completed`} />
        <StatTile label="HOURS WATCHED" value={formatHours(stats.totalSeconds)} sub="all time" />
        <StatTile label="CURRENT STREAK" value={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{stats.currentStreak}<Flame size={18} color={stats.currentStreak ? '#f97316' : '#565656'} /></span>} sub={stats.currentStreak === 1 ? 'day' : 'days'} />
        <StatTile label="MAX STREAK" value={stats.maxStreak} sub={stats.maxStreak === 1 ? 'day' : 'days'} />
      </div>
    </div>
  );
};

export default function LearnerAccount() {
  const { currentUser, refreshUser, logout, showNotification } = useApp();
  const navigate = useNavigate();

  const [pw, setPw] = useState({ current: '', next: '' });

  // Pick up an approval/suspension decided since login
  useEffect(() => { refreshUser(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePassword = async (e) => {
    e.preventDefault();
    const result = await changePassword(currentUser.id, pw.current, pw.next);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setPw({ current: '', next: '' });
    showNotification('Password updated.');
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 1000 }}>
      <PageHeader label="PROFILE" title={currentUser.name} subtitle="Your learning activity, streaks and progress." />
      <LearningDashboard userId={currentUser.id} />
      <Panel title="PROFILE" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[
            ['NAME', currentUser.name],
            ['EMAIL', currentUser.email],
            ['ROLE', currentUser.role.toUpperCase()],
            ['MEMBER SINCE', currentUser.joinDate || '—'],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginBottom: '0.2rem' }}>{k}</div>
              <div style={{ fontSize: '0.9rem', color: '#F8F8F8', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Creators have their own account; a learner account stays a learner account */}
      {currentUser.role === 'creator' && (
        <Panel title="CREATOR STUDIO" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <Clapperboard size={18} color="#22c55e" />
            <span style={{ fontSize: '0.85rem', color: '#A0A0A0', flex: 1 }}>You are an approved creator.</span>
            <Link to="/studio/library" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>OPEN CREATOR STUDIO</Link>
          </div>
        </Panel>
      )}

      <Panel title="CHANGE PASSWORD" style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handlePassword} style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 360 }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-cur">Current password</label>
            <input id="pw-cur" type="password" className="form-input" autoComplete="current-password" value={pw.current} onChange={e => setPw({ ...pw, current: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pw-new">New password (min. 8 characters)</label>
            <input id="pw-new" type="password" className="form-input" autoComplete="new-password" value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} />
          </div>
          <button type="submit" className="btn btn-secondary" style={{ alignSelf: 'flex-start', fontSize: '0.7rem' }}>UPDATE PASSWORD</button>
        </form>
      </Panel>

      <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={async () => { await logout(); navigate('/'); }}>
        <LogOut size={14} /> SIGN OUT
      </button>
    </div>
  );
}
