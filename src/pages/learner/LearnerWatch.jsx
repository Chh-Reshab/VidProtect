// ============================================
// SECURE PLAYER
//  - asks the server for a playback session (enrollment is checked there)
//  - streams the real file with HTTP range requests; the server re-checks
//    access on every request, so a suspension or unenrolment stops playback
//  - renews the 5-minute session while watching, saves progress, shows a watermark
// Seeded sample videos have no media file and use a simulated clock instead.
// ============================================

import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useLocation } from 'react-router-dom';
import {
  ChevronLeft, Play, Pause, RotateCcw, RotateCw, Lock, XCircle, Shield, SkipForward, Maximize,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  startStream, renewStream, streamUrl, saveProgress, getProgressMap, getCourseVideos,
} from '../../services/dataService';
import { TokenCountdown } from '../../components/SharedComponents';
import { formatDuration } from '../../components/DashboardKit';

const MEDIA_SPEEDS = [1, 1.25, 1.5, 2];
const SIM_SPEEDS = [1, 10, 60]; // sample videos only: finish a 40-minute video in a minute

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

const Player = ({ access, user, isStudioPreview }) => {
  const { video, course } = access;
  const hasMedia = !!video.hasMedia;

  const [token, setToken] = useState(access.token);
  const [duration, setDuration] = useState(video.durationSeconds || 600);
  const [position, setPosition] = useState(() => {
    const p = getProgressMap()[video.id];
    return p && !p.completed ? p.positionSeconds : 0;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [stopReason, setStopReason] = useState(null);
  const [mediaError, setMediaError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const surfaceRef = useRef(null);
  const mediaRef = useRef(null);
  const posRef = useRef(position);
  const durRef = useRef(duration);
  const tickRef = useRef(0);
  const retriedRef = useRef(false);
  const watchedRef = useRef(0); // seconds actually played since the last save
  const lastMediaTimeRef = useRef(0);

  const persist = () => {
    if (posRef.current > 0) {
      const watched = watchedRef.current;
      watchedRef.current = 0;
      saveProgress(user.id, video.id, posRef.current, durRef.current, watched);
    }
  };

  const stop = (reason) => {
    persist();
    mediaRef.current?.pause();
    setPlaying(false);
    setStopReason(reason);
  };

  // Simulated clock for sample videos with no file
  useEffect(() => {
    if (hasMedia || !playing) return undefined;
    const timer = setInterval(() => {
      posRef.current = Math.min(durRef.current, posRef.current + speed);
      watchedRef.current += 1;
      setPosition(posRef.current);
      tickRef.current += 1;
      if (tickRef.current % 5 === 0) persist();
      if (posRef.current >= durRef.current) { persist(); setPlaying(false); }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, speed, hasMedia]);

  // Real video: save progress every 5 seconds while playing
  useEffect(() => {
    if (!hasMedia || !playing) return undefined;
    const timer = setInterval(persist, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, hasMedia]);

  // Keep the playback session alive. Renewal re-runs the server's access check,
  // so a suspension or unenrolment ends playback here.
  useEffect(() => {
    const timer = setInterval(async () => {
      if (token.expiryMs - Date.now() > 60000) return;
      const result = await renewStream(token.sessionId);
      if (result.granted) setToken(result.token);
      else stop(result.reason);
    }, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Save on leave
  useEffect(() => () => persist(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []);

  // ── real <video> events ──
  const onLoadedMetadata = () => {
    const el = mediaRef.current;
    if (!el) return;
    if (Number.isFinite(el.duration) && el.duration > 0) {
      durRef.current = el.duration;
      setDuration(el.duration);
    }
    if (posRef.current > 0 && posRef.current < el.duration) el.currentTime = posRef.current; // resume
    lastMediaTimeRef.current = el.currentTime;
    el.playbackRate = speed;
    retriedRef.current = false;
    setMediaError(null);
  };

  const onTimeUpdate = () => {
    const el = mediaRef.current;
    if (!el) return;
    const dt = el.currentTime - lastMediaTimeRef.current;
    if (!el.paused && dt > 0 && dt < 2) watchedRef.current += dt; // a seek is a big jump, not watching
    lastMediaTimeRef.current = el.currentTime;
    posRef.current = el.currentTime;
    setPosition(el.currentTime);
  };

  // A failed load usually means the session lapsed (tab was in the background):
  // renew once and reload at the same spot before blaming the file.
  const onMediaError = async () => {
    if (stopReason) return;
    if (!retriedRef.current) {
      retriedRef.current = true;
      const result = await renewStream(token.sessionId);
      if (result.granted) { setToken(result.token); setReloadKey(k => k + 1); return; }
      stop(result.reason);
      return;
    }
    setMediaError('This browser could not play the file. MP4 (H.264) and WebM play everywhere; MOV, MKV and AVI may not.');
  };

  const seek = (to) => {
    const clamped = Math.max(0, Math.min(durRef.current, to));
    posRef.current = clamped;
    setPosition(clamped);
    if (hasMedia && mediaRef.current) mediaRef.current.currentTime = clamped;
  };

  const togglePlay = () => {
    if (stopReason) return;
    if (hasMedia) {
      const el = mediaRef.current;
      if (!el) return;
      if (el.paused) el.play().catch(() => setPlaying(false));
      else el.pause();
      return;
    }
    if (playing) persist();
    if (!playing && posRef.current >= durRef.current) seek(0);
    setPlaying(!playing);
  };

  const changeSpeed = (s) => {
    setSpeed(s);
    if (hasMedia && mediaRef.current) mediaRef.current.playbackRate = s;
  };

  const fullscreen = () => {
    const el = surfaceRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  const siblings = getCourseVideos(course.id);
  const next = siblings[siblings.findIndex(v => v.id === video.id) + 1];
  const finished = position >= duration - 0.5 && duration > 0;
  const speeds = hasMedia ? MEDIA_SPEEDS : SIM_SPEEDS;
  const statusText = stopReason ? 'PLAYBACK STOPPED' : playing ? 'STREAMING' : finished ? 'FINISHED' : 'PAUSED';

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <Link
        to={isStudioPreview ? `/studio/video/${video.id}` : `/learn/course/${course.id}`}
        className="btn btn-ghost"
        style={{ fontSize: '0.65rem', marginBottom: '1.5rem' }}
      >
        <ChevronLeft size={14} /> {isStudioPreview ? 'BACK TO DETAILS' : course.title.toUpperCase()}
      </Link>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '1.5rem', alignItems: 'flex-start' }} className="watch-grid">
        <div>
          {/* Player surface */}
          <div ref={surfaceRef} style={{ position: 'relative', aspectRatio: '16 / 9', background: '#0a0a0a', border: '1px solid #292929', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasMedia ? (
              <video
                key={reloadKey}
                ref={mediaRef}
                src={streamUrl(video.id, token.sessionId)}
                preload="metadata"
                poster={video.thumbUrl || undefined}
                playsInline
                controlsList="nodownload noremoteplayback"
                disablePictureInPicture
                onContextMenu={e => e.preventDefault()}
                onLoadedMetadata={onLoadedMetadata}
                onTimeUpdate={onTimeUpdate}
                onPlay={() => setPlaying(true)}
                onPause={() => { setPlaying(false); persist(); }}
                onEnded={() => { setPlaying(false); persist(); }}
                onError={onMediaError}
                style={{ width: '100%', height: '100%', background: '#000', objectFit: 'contain' }}
              />
            ) : (
              <>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, #292929 1px, transparent 1px)', backgroundSize: '24px 24px', opacity: 0.5 }} />
                <div style={{ position: 'relative', textAlign: 'center' }}>
                  <Shield size={56} color="#FF2028" strokeWidth={1.2} />
                  <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginTop: '0.75rem' }}>{statusText}</div>
                  <div className="mono" style={{ fontSize: '0.55rem', color: '#565656', marginTop: '0.25rem' }}>SAMPLE VIDEO — NO MEDIA FILE UPLOADED</div>
                </div>
              </>
            )}

            {/* Dynamic watermark: identifies the viewer if the stream is recorded */}
            <div className="vp-watermark mono">{user.email} · {token.sessionId.slice(0, 12)}</div>

            {(stopReason || mediaError) && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(16,16,16,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1rem', textAlign: 'center' }}>
                <XCircle size={36} color="#FF2028" />
                <div style={{ color: '#F8F8F8', fontSize: '0.9rem', maxWidth: 420 }}>{stopReason || mediaError}</div>
                {stopReason && <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>PLAYBACK SESSION COULD NOT BE RENEWED</div>}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{ background: '#171717', border: '1px solid #292929', borderTop: 'none', padding: '0.75rem 1rem' }}>
            <input
              type="range" min={0} max={Math.max(1, Math.floor(duration))} value={Math.min(Math.floor(position), Math.floor(duration))} disabled={!!stopReason}
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
                <span className="mono" style={{ fontSize: '0.55rem', color: '#565656', marginRight: '0.25rem' }}>{hasMedia ? 'SPEED' : 'SAMPLE SPEED'}</span>
                {speeds.map(s => (
                  <button key={s} onClick={() => changeSpeed(s)} className={speed === s ? 'btn btn-secondary' : 'btn btn-ghost'} style={{ padding: '0.25rem 0.5rem', fontSize: '0.6rem' }}>{s}×</button>
                ))}
                <button className="btn btn-ghost" style={{ padding: '0.3rem 0.5rem' }} onClick={fullscreen} aria-label="Fullscreen"><Maximize size={13} /></button>
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
              'Enrollment verified by the server',
              'Checked again on every stream request',
              '5-minute playback session, auto-renewed',
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
          color: rgba(248,248,248,0.3);
          text-shadow: 0 0 4px rgba(0,0,0,0.8);
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
function WatchGate({ videoId, isStudioPreview }) {
  const { currentUser } = useApp();
  const [access, setAccess] = useState(null);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return; // StrictMode runs effects twice in dev; log only once
    requested.current = true;
    startStream(videoId).then(setAccess);
  }, [videoId]);

  if (!access) {
    return <div style={{ padding: '2rem', display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>;
  }
  if (!access.granted) return <Denied reason={access.reason} />;
  return <Player access={access} user={currentUser} isStudioPreview={isStudioPreview} />;
}

// key resets the gate (and the playback session) when moving to another video
export default function LearnerWatch() {
  const { videoId } = useParams();
  const location = useLocation();
  const isStudioPreview = location.pathname.startsWith('/studio/');
  return <WatchGate key={videoId} videoId={videoId} isStudioPreview={isStudioPreview} />;
}
