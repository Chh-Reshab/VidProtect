// ============================================
// VIDEO DETAIL & PROTECTED PLAYER — VidProtect AI
// ============================================

import { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Play, Pause, Volume2, Shield, Lock, CheckCircle, XCircle,
  User, Clock, AlertTriangle, ChevronLeft, Eye,
} from 'lucide-react';
import {
  getVideoById, getCourseById, checkEnrollment, createDemoStreamToken,
  recordAccessEvent, getUsers,
} from '../services/mockServices';
import { useApp } from '../context/AppContext';
import {
  SectionLabel, DemoBanner, VideoThumbnail,
  TokenCountdown, Modal,
} from '../components/SharedComponents';

// ── DEMO VIDEO (uses a public test video) ──
const DEMO_VIDEO_SRC = 'https://www.w3schools.com/html/mov_bbb.mp4';

// ── SECURE PLAYER ─────────────────────────
const SecurePlayer = ({ video, token, student }) => {
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const videoRef = useRef(null);

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) { videoRef.current.pause(); setPlaying(false); }
    else { videoRef.current.play().catch(() => {}); setPlaying(true); }
  };

  const formatT = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div style={{ background: '#101010', border: '1px solid #EEEEEE', boxShadow: '8px 8px 0px #292929' }}>
      {/* Player title bar */}
      <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#171717' }}>
        <div style={{ width: 8, height: 8, background: '#FF2028', borderRadius: '50%' }} />
        <div style={{ width: 8, height: 8, background: '#292929', borderRadius: '50%' }} />
        <div style={{ width: 8, height: 8, background: '#292929', borderRadius: '50%' }} />
        <span className="mono" style={{ marginLeft: '0.5rem', fontSize: '0.58rem', color: '#565656' }}>SECURE_PLAYER v1.0 — {video.title.toUpperCase()}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span className="badge badge-green" style={{ fontSize: '0.55rem' }}>⚿ PROTECTED SESSION</span>
        </div>
      </div>

      {/* Video */}
      <div style={{ position: 'relative', background: '#000', aspectRatio: '16/9' }}>
        <video
          ref={videoRef}
          src={DEMO_VIDEO_SRC}
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
          onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
          onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
          onEnded={() => setPlaying(false)}
          volume={volume}
        />
        {/* Watermark */}
        <div style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', opacity: 0.25, pointerEvents: 'none', textAlign: 'right' }}>
          <div className="mono" style={{ fontSize: '0.6rem', color: '#FF2028', transform: 'rotate(-8deg)', display: 'block' }}>
            {student.name.toUpperCase()} · {token.sessionId.toUpperCase()}
          </div>
          <div className="mono" style={{ fontSize: '0.5rem', color: '#FF2028' }}>DEMO WATERMARK</div>
        </div>
        {/* Play overlay */}
        {!playing && (
          <button
            onClick={toggle}
            style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', border: 'none', cursor: 'pointer' }}
          >
            <div style={{ width: 64, height: 64, background: 'rgba(255,32,40,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Play size={28} color="#fff" fill="#fff" />
            </div>
          </button>
        )}
      </div>

      {/* Controls */}
      <div style={{ padding: '0.75rem 1rem', background: '#171717', borderTop: '1px solid #292929' }}>
        <input
          type="range" min={0} max={duration || 100} value={currentTime}
          onChange={e => { if (videoRef.current) { videoRef.current.currentTime = e.target.value; setCurrentTime(e.target.value); } }}
          style={{ width: '100%', accentColor: '#FF2028', height: '4px', cursor: 'pointer', marginBottom: '0.75rem' }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={toggle} style={{ background: 'none', border: 'none', color: '#F8F8F8', cursor: 'pointer', display: 'flex' }}>
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>
          <span className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>
            {formatT(currentTime)} / {duration ? formatT(duration) : video.duration}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
            <Volume2 size={16} color="#565656" />
            <input type="range" min={0} max={1} step={0.1} value={volume}
              onChange={e => { setVolume(e.target.value); if (videoRef.current) videoRef.current.volume = e.target.value; }}
              style={{ width: '80px', accentColor: '#FF2028', cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* Session status bar */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #292929', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <TokenCountdown token={token} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={12} color="#565656" />
            <span className="mono" style={{ fontSize: '0.6rem', color: '#A0A0A0' }}>{student.name}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={12} color="#22c55e" />
            <span className="mono" style={{ fontSize: '0.6rem', color: '#22c55e' }}>SESSION VERIFIED</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── ACCESS DENIED SCREEN ──────────────────
const AccessDenied = ({ reason, scenario }) => (
  <div style={{ background: '#1D1D1D', border: '1px solid #FF2028', padding: '3rem 2rem', textAlign: 'center' }}>
    <XCircle size={48} color="#FF2028" style={{ marginBottom: '1rem' }} />
    <h3 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.2rem', textTransform: 'uppercase', marginBottom: '0.5rem', color: '#FF2028' }}>
      ACCESS DENIED
    </h3>
    <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: '1rem' }}>{reason}</p>
    <div style={{ background: '#101010', border: '1px solid #292929', padding: '0.75rem', display: 'inline-block' }}>
      <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
        EVENT: {scenario.toUpperCase().replace(/-/g, '_')} · LOGGED IN ACCESS LOG
      </span>
    </div>
  </div>
);

// ── MAIN VIDEO DETAIL PAGE ────────────────
export default function VideoDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, showNotification } = useApp();
  const [video, setVideo] = useState(null);
  const [course, setCourse] = useState(null);

  // Demo authorization flow state
  const [selectedStudent, setSelectedStudent] = useState('');
  const [scenario, setScenario] = useState('authorized'); // authorized | unauthorized | expired
  const [authState, setAuthState] = useState('idle'); // idle | checking | authorized | denied | expired
  const [token, setToken] = useState(null);
  const [activeStudent, setActiveStudent] = useState(null);
  const [showPlayerModal, setShowPlayerModal] = useState(false);

  const autoPlay = searchParams.get('play') === '1';

  useEffect(() => {
    const v = getVideoById(id);
    // Creators can only open their own videos (same response as a missing video)
    if (!v || v.creatorId !== currentUser.id) { navigate('/studio/library'); return; }
    setVideo(v);
    setCourse(getCourseById(v.courseId));
    if (autoPlay) {
      setTimeout(() => handleVerify(), 100);
    }
  }, [id]);

  const students = getUsers().filter(u => u.role === 'learner');

  const handleVerify = async () => {
    if (!selectedStudent && scenario !== 'expired') {
      showNotification('Please select a student to verify.', 'error');
      return;
    }

    setAuthState('checking');
    await new Promise(r => setTimeout(r, 1200));

    const student = students.find(s => s.id === selectedStudent) || students[0];

    if (scenario === 'expired') {
      // Scenario C: expired token
      const expiredToken = { ...createDemoStreamToken(student.id, video.id, -5), expiryMs: Date.now() - 1000, status: 'active' };
      recordAccessEvent({
        userId: student.id, userName: student.name,
        videoId: video.id, videoTitle: video.title,
        courseId: video.courseId, eventType: 'token_expired',
        result: 'denied', reason: 'Expired token reuse attempt',
        sessionRef: expiredToken.sessionId,
      });
      setAuthState('expired');
      return;
    }

    if (scenario === 'unauthorized') {
      // Scenario B: not enrolled
      recordAccessEvent({
        userId: student.id, userName: student.name,
        videoId: video.id, videoTitle: video.title,
        courseId: video.courseId, eventType: 'access_denied',
        result: 'denied', reason: 'Enrollment verification failed — not enrolled in course',
        sessionRef: `sess-${Math.random().toString(36).substr(2,6)}`,
      });
      setAuthState('denied');
      return;
    }

    // Scenario A: authorized — check enrollment
    const enrollment = checkEnrollment(student.id, video.courseId);
    if (!enrollment) {
      recordAccessEvent({
        userId: student.id, userName: student.name,
        videoId: video.id, videoTitle: video.title,
        courseId: video.courseId, eventType: 'access_denied',
        result: 'denied', reason: 'Enrollment verification failed',
        sessionRef: `sess-${Math.random().toString(36).substr(2,6)}`,
      });
      setAuthState('denied');
      return;
    }

    // Issue token
    const newToken = createDemoStreamToken(student.id, video.id, 30);
    recordAccessEvent({
      userId: student.id, userName: student.name,
      videoId: video.id, videoTitle: video.title,
      courseId: video.courseId, eventType: 'stream_authorized',
      result: 'success', reason: 'Enrollment verified, demo token issued',
      sessionRef: newToken.sessionId, tokenRef: newToken.tokenId,
    });
    setToken(newToken);
    setActiveStudent(student);
    setAuthState('authorized');
    setShowPlayerModal(true);
  };

  if (!video) return (
    <div style={{ padding: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
      <div className="spinner" />
    </div>
  );

  const formatDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Back */}
      <button className="btn btn-ghost" style={{ fontSize: '0.65rem', marginBottom: '1.5rem' }} onClick={() => navigate('/studio/library')}>
        <ChevronLeft size={14} /> BACK TO LIBRARY
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '1.5rem', alignItems: 'flex-start' }} className="detail-grid">
        {/* Left */}
        <div>
          <SectionLabel>VIDEO DETAILS</SectionLabel>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.8rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', marginBottom: '0.5rem', lineHeight: 1.05 }}>
            {video.title}
          </h1>
          <div className="mono" style={{ fontSize: '0.65rem', color: '#FF2028', marginBottom: '1rem' }}>{course?.title}</div>

          <DemoBanner />

          {/* Thumbnail */}
          <div style={{ marginBottom: '1.5rem' }}>
            <VideoThumbnail video={video} size="lg" />
          </div>

          {/* Metadata grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: '#292929', border: '1px solid #292929', marginBottom: '1.5rem' }}>
            {[
              { label: 'Duration', value: video.duration },
              { label: 'File Size', value: video.fileSize },
              { label: 'Upload Date', value: formatDate(video.uploadDate) },
              { label: 'Sessions', value: `${video.sessions} authorized` },
              { label: 'Encryption', value: video.encryptionStatus },
              { label: 'Protection', value: video.protectionStatus },
            ].map(m => (
              <div key={m.label} style={{ background: '#1D1D1D', padding: '0.75rem 1rem' }}>
                <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginBottom: '0.2rem' }}>{m.label.toUpperCase()}</div>
                <div className="mono" style={{ fontSize: '0.75rem', color: '#F8F8F8', textTransform: 'uppercase' }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Description */}
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem', marginBottom: '1.5rem' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.75rem' }}>DESCRIPTION</div>
            <p style={{ color: '#A0A0A0', fontSize: '0.85rem', lineHeight: 1.7 }}>{video.description}</p>
          </div>
        </div>

        {/* Right: Authorization demo */}
        <div style={{ position: 'sticky', top: '80px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>AUTHORIZATION DEMO</div>

            {/* Scenario selector */}
            <div style={{ marginBottom: '1rem' }}>
              <div className="form-label" style={{ marginBottom: '0.5rem' }}>SELECT SCENARIO</div>
              {[
                { id: 'authorized', label: 'Scenario A — Authorized', desc: 'Enrolled student, valid access' },
                { id: 'unauthorized', label: 'Scenario B — Unauthorized', desc: 'Not enrolled, access denied' },
                { id: 'expired', label: 'Scenario C — Expired Token', desc: 'Token expired, stream rejected' },
              ].map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem', border: `1px solid ${scenario === s.id ? '#FF2028' : '#292929'}`, background: scenario === s.id ? 'rgba(255,32,40,0.06)' : 'transparent', marginBottom: '0.4rem', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <input type="radio" name="scenario" value={s.id} checked={scenario === s.id} onChange={() => { setScenario(s.id); setAuthState('idle'); setToken(null); }} style={{ accentColor: '#FF2028', marginTop: '2px' }} />
                  <div>
                    <div className="mono" style={{ fontSize: '0.65rem', color: '#F8F8F8' }}>{s.label}</div>
                    <div style={{ fontSize: '0.7rem', color: '#565656' }}>{s.desc}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Student selector */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" htmlFor="student-select">SELECT STUDENT</label>
              <select id="student-select" className="form-input" value={selectedStudent} onChange={e => { setSelectedStudent(e.target.value); setAuthState('idle'); setToken(null); }}>
                <option value="">Choose student...</option>
                {students.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.enrolledCourses.includes(video.courseId) ? '(enrolled)' : '(not enrolled)'}
                  </option>
                ))}
              </select>
            </div>

            {/* Auth state display */}
            {authState === 'idle' && (
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.7rem' }} onClick={handleVerify}>
                <Shield size={14} /> VERIFY & REQUEST ACCESS
              </button>
            )}

            {authState === 'checking' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {['Authenticating identity (JWT demo)...', 'Checking course enrollment...', 'Validating access rights...'].map((step, _i) => (
                  <div key={step} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.4rem 0' }}>
                    <div className="spinner" style={{ width: 12, height: 12 }} />
                    <span className="mono" style={{ fontSize: '0.6rem', color: '#A0A0A0' }}>{step}</span>
                  </div>
                ))}
              </div>
            )}

            {authState === 'authorized' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e' }}>
                  <CheckCircle size={16} color="#22c55e" />
                  <span style={{ fontSize: '0.8rem', color: '#22c55e', fontWeight: 600 }}>Access Authorized</span>
                </div>
                {token && <TokenCountdown token={token} />}
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '0.7rem', marginTop: '0.75rem' }} onClick={() => setShowPlayerModal(true)}>
                  <Play size={14} /> OPEN SECURE PLAYER
                </button>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.65rem', marginTop: '0.4rem' }} onClick={() => { setAuthState('idle'); setToken(null); }}>
                  RESET
                </button>
              </div>
            )}

            {authState === 'denied' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028' }}>
                  <XCircle size={16} color="#FF2028" />
                  <span style={{ fontSize: '0.8rem', color: '#FF2028', fontWeight: 600 }}>Access Denied</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#A0A0A0', marginBottom: '0.75rem' }}>
                  {scenario === 'unauthorized' ? 'Student is not enrolled in this course.' : 'Authorization check failed.'}
                  {' '}Event recorded in Access Logs.
                </p>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.65rem' }} onClick={() => { setAuthState('idle'); setToken(null); }}>
                  RESET
                </button>
              </div>
            )}

            {authState === 'expired' && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.75rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028' }}>
                  <AlertTriangle size={16} color="#FF2028" />
                  <span style={{ fontSize: '0.8rem', color: '#FF2028', fontWeight: 600 }}>Token Expired</span>
                </div>
                <p style={{ fontSize: '0.75rem', color: '#A0A0A0', marginBottom: '0.75rem' }}>
                  The streaming token has expired. A new authorization request is required. Event recorded.
                </p>
                <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: '0.65rem' }} onClick={() => { setAuthState('idle'); setToken(null); }}>
                  RESET
                </button>
              </div>
            )}
          </div>

          {/* Security info */}
          <div style={{ background: '#101010', border: '1px solid #292929', padding: '1rem' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.5rem' }}>SECURITY INFO</div>
            {[
              { icon: Lock, label: 'AES-256 Encrypted', sub: 'Demo state' },
              { icon: Shield, label: 'Enrollment Verified', sub: 'Per access request' },
              { icon: Clock, label: '30-min Token TTL', sub: 'Auto-expiry demo' },
              { icon: Eye, label: 'Access Logged', sub: 'Every event recorded' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.4rem 0', borderBottom: '1px solid #1D1D1D' }}>
                <item.icon size={12} color="#FF2028" />
                <div>
                  <div className="mono" style={{ fontSize: '0.6rem', color: '#F8F8F8' }}>{item.label}</div>
                  <div className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Secure Player Modal */}
      {showPlayerModal && authState === 'authorized' && token && activeStudent && (
        <Modal isOpen={showPlayerModal} onClose={() => setShowPlayerModal(false)} title="SECURE VIDEO PLAYER" width="780px">
          <SecurePlayer video={video} token={token} student={activeStudent} onRevoke={() => { setShowPlayerModal(false); setAuthState('idle'); setToken(null); }} />
          <div style={{ marginTop: '0.75rem', padding: '0.5rem', border: '1px solid #292929', background: '#101010' }}>
            <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>
              ◐ Demo player — Not DRM-protected. Watermark is demonstrative. Authorization is simulated on frontend.
            </span>
          </div>
        </Modal>
      )}

      <style>{`
        @media (max-width: 900px) {
          .detail-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
