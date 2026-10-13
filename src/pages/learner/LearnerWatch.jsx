// ============================================
// SECURE PLAYER — requests a stream token, plays (simulated),
// saves progress, renews the token, shows a watermark.
// Access is decided by requestStreamAccess(); a real backend
// would make the same checks before signing any stream URL.
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, Play, Pause, RotateCcw, RotateCw, Lock, XCircle, Shield, SkipForward } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  requestStreamAccess, saveProgress, getProgressMap, getCourseVideos,
} from '../../services/mockServices';
import { TokenCountdown } from '../../components/SharedComponents';
import { formatDuration } from '../../components/DashboardKit';

const SPEEDS = [1, 10, 60]; // demo speeds so a 40-minute video can be finished in a minute

const Denied = ({ reason }) => (
  <div style={{ padding: '2rem' }}>
    <div style={{ background: '#1D1D1D', border: '1px solid #FF2028', padding: '3rem 2rem', textAlign: 'center', maxWidth: 640, margin: '2rem auto' }}>
      <XCircle size={48} color="#FF2028" style={{ marginBottom: '1rem' }} />
      <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.2rem', textTransform: 'uppercase', color: '#FF2028', marginBottom: '0.5rem' }}>ACCESS DENIED</h2>
      <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.25rem' }}>{reason}</p>
      <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1.5rem' }}>THIS ATTEMPT HAS BEEN LOGGED</div>
      <Link to="/learn/courses" className="btn btn-secondary" style={{ fontSize: '0.7rem' }}>BACK TO MY COURSES</Link>
    </div>
  </div>
);

const Player = ({ access, user }) => {
  const { video, course } = access;
  const duration = video.durationSeconds || 600;

  const [token, setToken] = useState(access.token);
  const [position, setPosition] = useState(() => {
    const p = getProgressMap(user.id)[video.id];
    return p && !p.completed ? p.positionSeconds : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stopReason, setStopReason] = useState(null);

  const posRef = useRef(position);
  const tickRef = useRef(0);

  const persist = () => {
    if (posRef.current > 0) saveProgress(user.id, video.id, posRef.current, duration);
  };

  // Playback clock
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      posRef.current = Math.min(duration, posRef.current + speed);
      setPosition(posRef.current);
      tickRef.current += 1;
      if (tickRef.current % 5 === 0) persist();
      if (posRef.current >= duration) { persist(); setPlaying(false); }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, duration]);

  // Token renewal: tokens live 5 minutes; renew when <30s remain.
  // Renewal re-runs every check, so a suspension or unenrolment stops playback.
  useEffect(() => {
    const timer = setInterval(() => {
      if (token.expiryMs - Date.now() > 30000) return;
      const result = requestStreamAccess(user.id, video.id, { renew: true });
      if (result.granted) {
        setToken(result.token);
      } else {
        persist();
        setPlaying(false);
        setStopReason(result.reason);
      }
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Save on leave
  useEffect(() => () => persist(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  const seek = (to) => {
    posRef.current = Math.max(0, Math.min(duration, to));
    setPosition(posRef.current);
  };

  const togglePlay = () => {
    if (stopReason) return;
    if (playing) persist();
    if (!playing && posRef.current >= duration) seek(0);
    setPlaying(!playing);
  };

  const siblings = getCourseVideos(course.id);
  const next = siblings[siblings.findIndex(v => v.id === video.id) + 1];
  const finished = position >= duration;

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <Link to={`/learn/course/${course.id}`} className="btn btn-ghost" style={{ fontSize: '0.65rem', marginBottom: '1.5rem' }}>
        <ChevronLeft size={14} /> {course.title.toUpperCase()}
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.5rem', alignItems: 'flex-start' }} className="watch-grid">
        <div>
          {/* Player surface */}
          <div style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0a0a0a', border: '1px solid #292929', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5 }} />
            <div style={{ position: 'relative', textAlign: 'center' }}>
              <Shield size={56} color="#FF2028" strokeWidth={1.2} />
              <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginTop: '0.75rem' }}>
                {stopReason ? 'PLAYBACK STOPPED' : playing ? 'STREAMING · ENCRYPTED' : finished ? 'FINISHED' : 'PAUSED'}
              </div>
              <div className="mono" style={{ fontSize: '0.55rem', color: '#565656', marginTop: '0.25rem' }}>SIMULATED PLAYER — NO REAL VIDEO IN THIS DEMO</div>
            </div>

            {/* Dynamic watermark: identifies the viewer if the stream is recorded */}
            <div className="vp-watermark mono">{user.email} · {token.sessionId}</div>

            {stopReason && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,16,16,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <XCircle size={36} color="#FF2028" />
                <div style={{ color: '#F8F8F8', fontSize: '0.9rem' }}>{stopReason}</div>
                <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>STREAM TOKEN COULD NOT BE RENEWED</div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ background: '#171717', border: '1px solid #292929', borderTop: 'none', padding: '0.75rem 1rem' }}>
            <input
              type="range" min={0} max={duration} value={position} disabled={!!stopReason}
              onChange={e => seek(Number(e.target.value))}
              aria-label="Seek"
              style={{ width: '100%', accentColor: '#FF2028' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
              <button className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.65rem' }} onClick={togglePlay} disabled={!!stopReason}>
                {playing ? <><Pause size={12} /> PAUSE</> : <><Play size={12} /> {position > 0 && !finished ? 'RESUME' : 'PLAY'}</>}
              </button>
              <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => seek(position - 10)} aria-label="Back 10 seconds" disabled={!!stopReason}><RotateCcw size={13} /></button>
              <button className="btn btn-ghost" style={{ padding: '0.4rem 0.6rem' }} onClick={() => seek(position + 10)} aria-label="Forward 10 seconds" disabled={!!stopReason}><RotateCw size={13} /></button>
              <span className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{formatDuration(position)} / {formatDuration(duration)}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                <span className="mono" style={{ fontSize: '0.55rem', color: '#565656', marginRight: '0.25rem' }}>DEMO SPEED</span>
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)} className={speed === s ? 'btn btn-secondary' : 'btn btn-ghost'} style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>{s}×</button>
                ))}
              </div>
            </div>
          </div>

          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.3rem', textTransform: 'uppercase', letterSpacing: '-0.01em', marginTop: '1.25rem' }}>{video.title}</h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.85rem', lineHeight: 1.6, marginTop: '0.5rem' }}>{video.description}</p>

          {finished && next && (
            <Link to={`/learn/watch/${next.id}`} className="btn btn-primary" style={{ fontSize: '0.7rem', marginTop: '1rem' }}>
              <SkipForward size={13} /> NEXT: {next.title.toUpperCase()}
            </Link>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TokenCountdown token={token} />
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1rem' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.6rem' }}>SESSION PROTECTION</div>
            {[
              'Enrollment verified',
              'Short-lived stream token (5 min, auto-renewed)',
              'Viewer watermark on screen',
              'Access logged for the creator',
            ].map(t => (
              <div key={t} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.75rem', color: '#A0A0A0', padding: '0.25rem 0' }}>
                <Lock size={11} color="#22c55e" /> {t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        .vp-watermark {
          position: absolute;
          font-size: 0.65rem;
          color: rgba(248,248,248,0.28);
          pointer-events: none;
          user-select: none;
          white-space: nowrap;
          animation: vpDrift 24s linear infinite;
        }
        @keyframes vpDrift {
          0%   { top: 8%;  left: 6%; }
          25%  { top: 70%; left: 55%; }
          50%  { top: 30%; left: 40%; }
          75%  { top: 80%; left: 8%; }
          100% { top: 8%;  left: 6%; }
        }
        @media (max-width: 900px) { .watch-grid { grid-template-columns: 1fr !important; } }
      `}</style>
    </div>
  );
};

// Request access once per page visit, then hand off to the player.
function WatchGate({ videoId }) {
  const { currentUser } = useApp();
  const [access, setAccess] = useState(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return; // StrictMode runs effects twice in dev; log only once
    requested.current = true;
    setAccess(requestStreamAccess(currentUser.id, videoId));
  }, [currentUser.id, videoId]);

  if (!access) {
    return <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>;
  }
  if (!access.granted) return <Denied reason={access.reason} />;
  return <Player access={access} user={currentUser} />;
}

// key resets the gate (and the stream token) when moving to another video
export default function LearnerWatch() {
  const { videoId } = useParams();
  return <WatchGate key={videoId} videoId={videoId} />;
}
