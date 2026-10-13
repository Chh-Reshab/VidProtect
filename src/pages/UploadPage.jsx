// ============================================
// UPLOAD VIDEO — VidProtect AI
// ============================================

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, CheckCircle, Lock, Shield, Database } from 'lucide-react';
import { getCourses, uploadVideo } from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, DemoBanner } from '../components/SharedComponents';

const STAGES = [
  { id: 'upload', label: 'UPLOAD', icon: Upload },
  { id: 'encrypt', label: 'ENCRYPTION DEMO', icon: Lock },
  { id: 'store', label: 'STORAGE DEMO', icon: Database },
  { id: 'complete', label: 'PROTECTION STATUS', icon: Shield },
];

export default function UploadPage() {
  const navigate = useNavigate();
  const { currentUser, showNotification, refreshStats } = useApp();
  const fileRef = useRef(null);
  const [courses] = useState(() => getCourses(currentUser.id));
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState(null); // null | 'uploading' | 'encrypting' | 'storing' | 'done'
  const [progress, setProgress] = useState(0);
  const [newVideoId, setNewVideoId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    courseId: '',
    accessConfig: 'enrollment_required',
  });

  const ACCEPTED = ['video/mp4', 'video/webm', 'video/mov', 'video/avi', 'video/x-matroska', 'video/quicktime'];

  const handleFile = (f) => {
    if (!f) return;
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
      setErrors(p => ({ ...p, file: 'Please select a video file (MP4, WebM, MOV, AVI, MKV).' }));
      return;
    }
    setFile(f);
    setErrors(p => ({ ...p, file: undefined }));
    if (!form.title) setForm(p => ({ ...p, title: f.name.replace(/\.[^.]+$/, '') }));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const validate = () => {
    const err = {};
    if (!file) err.file = 'Please select a video file.';
    if (!form.title.trim()) err.title = 'Title is required.';
    if (!form.courseId) err.courseId = 'Please select a course.';
    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const simulateUpload = async () => {
    if (!validate()) return;

    // Stage 1: Upload
    setStage('uploading');
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(r => setTimeout(r, 60));
      setProgress(i);
    }

    // Stage 2: Encryption demo
    setStage('encrypting');
    setProgress(0);
    for (let i = 0; i <= 100; i += 8) {
      await new Promise(r => setTimeout(r, 80));
      setProgress(i);
    }

    // Stage 3: Storage demo
    setStage('storing');
    setProgress(0);
    for (let i = 0; i <= 100; i += 12) {
      await new Promise(r => setTimeout(r, 60));
      setProgress(i);
    }

    // Create video record
    const course = courses.find(c => c.id === form.courseId);
    const result = uploadVideo(currentUser.id, {
      title: form.title,
      description: form.description,
      courseId: form.courseId,
      courseName: course?.title || '',
      duration: '--:--',
      fileSize: file ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : '0 MB',
    });

    if (!result.success) {
      showNotification(result.error, 'error');
      setStage(null);
      setProgress(0);
      return;
    }

    setNewVideoId(result.video.id);
    setStage('done');
    setProgress(100);
    refreshStats();
    showNotification('Video added to protected library (demo).');
  };

  const currentStageIndex = { uploading: 0, encrypting: 1, storing: 2, done: 3 }[stage] ?? -1;

  if (stage === 'done') {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            VIDEO PROTECTED
          </h2>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '2rem' }}>
            "{form.title}" has been processed and added to your protected library.
          </p>

          {/* Processing stages */}
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1rem' }}>PROCESSING LOG (DEMO)</div>
            {[
              { label: 'File received', status: 'COMPLETE', note: 'Video file validated and received.' },
              { label: 'Encryption demo', status: 'SIMULATED', note: 'AES-256 encryption is simulated in this prototype. Real implementation would encrypt before storage.' },
              { label: 'Storage demo', status: 'SIMULATED', note: 'Encrypted storage is simulated. Production would use secure media storage.' },
              { label: 'Protection status', status: 'ACTIVE', note: 'Enrollment verification and token issuance are enabled for this video.' },
            ].map(item => (
              <div key={item.label} style={{ padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#F8F8F8' }}>{item.label}</span>
                  <span className="badge" style={{
                    color: item.status === 'COMPLETE' || item.status === 'ACTIVE' ? '#22c55e' : '#eab308',
                    borderColor: item.status === 'COMPLETE' || item.status === 'ACTIVE' ? '#22c55e' : '#eab308',
                    fontSize: '0.55rem',
                  }}>
                    {item.status}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginTop: '0.2rem' }}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => navigate(`/studio/video/${newVideoId}`)}>
              VIEW DETAILS
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => {
              setStage(null); setFile(null); setProgress(0); setNewVideoId(null);
              setForm({ title: '', description: '', courseId: '', accessConfig: 'enrollment_required' });
            }}>
              UPLOAD ANOTHER
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (stage) {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
            PROCESSING VIDEO
          </h1>

          {/* Stage indicators */}
          <div style={{ display: 'flex', gap: '0', marginBottom: '2rem' }}>
            {STAGES.map((s, i) => (
              <div key={s.id} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
                <div style={{
                  width: 32, height: 32,
                  background: i <= currentStageIndex ? '#FF2028' : '#292929',
                  border: `1px solid ${i <= currentStageIndex ? '#FF2028' : '#292929'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 0.4rem',
                  transition: 'all 0.3s',
                }}>
                  {i < currentStageIndex ? <CheckCircle size={14} color="#fff" /> : <s.icon size={14} color={i <= currentStageIndex ? '#fff' : '#565656'} />}
                </div>
                <div className="mono" style={{ fontSize: '0.55rem', color: i <= currentStageIndex ? '#F8F8F8' : '#565656' }}>{s.label}</div>
                {i < STAGES.length - 1 && (
                  <div style={{ position: 'absolute', top: 16, left: '50%', width: '100%', height: 1, background: i < currentStageIndex ? '#FF2028' : '#292929', transition: 'background 0.3s' }} />
                )}
              </div>
            ))}
          </div>

          {/* Current stage */}
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '2rem', textAlign: 'center' }}>
            <div style={{ marginBottom: '1rem' }}>
              {stage === 'uploading' && <Upload size={40} color="#FF2028" />}
              {stage === 'encrypting' && <Lock size={40} color="#FF2028" />}
              {stage === 'storing' && <Database size={40} color="#FF2028" />}
            </div>
            <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.1rem', textTransform: 'uppercase', marginBottom: '0.4rem' }}>
              {stage === 'uploading' && 'Uploading Video...'}
              {stage === 'encrypting' && 'Encryption Demo...'}
              {stage === 'storing' && 'Storage Demo...'}
            </div>
            {stage === 'encrypting' && (
              <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.75rem' }}>
                ◐ SIMULATED — AES-256 encryption is demonstrated, not applied to actual file
              </div>
            )}
            {stage === 'storing' && (
              <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.75rem' }}>
                ◐ SIMULATED — Storage demonstration. Production would use secure encrypted media storage.
              </div>
            )}
            <div style={{ background: '#292929', height: '4px', width: '100%', marginTop: '1rem', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#FF2028', width: `${progress}%`, transition: 'width 0.1s' }} />
            </div>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#565656', marginTop: '0.5rem' }}>{progress}%</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>CONTENT UPLOAD</SectionLabel>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
          UPLOAD VIDEO
        </h1>
      </div>

      <DemoBanner />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.5rem', alignItems: 'flex-start' }} className="upload-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${errors.file ? '#FF2028' : dragging ? '#FF2028' : file ? '#22c55e' : '#292929'}`,
              background: dragging ? 'rgba(255,32,40,0.05)' : '#1D1D1D',
              padding: '3rem 2rem',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <File size={32} color="#22c55e" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{file.name}</div>
                <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                <button className="btn btn-ghost" style={{ fontSize: '0.6rem', marginTop: '0.75rem' }} onClick={e => { e.stopPropagation(); setFile(null); }}>
                  <X size={12} /> REMOVE
                </button>
              </div>
            ) : (
              <div>
                <Upload size={32} color={dragging ? '#FF2028' : '#565656'} style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                  DROP VIDEO FILE HERE
                </div>
                <div style={{ color: '#565656', fontSize: '0.8rem' }}>or click to browse</div>
                <div className="mono" style={{ fontSize: '0.6rem', color: '#292929', marginTop: '0.5rem' }}>MP4 · WEBM · MOV · AVI · MKV</div>
              </div>
            )}
          </div>
          {errors.file && <div className="form-error">⊗ {errors.file}</div>}

          {/* Form */}
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="upload-title">Video Title *</label>
              <input id="upload-title" type="text" className={`form-input${errors.title ? ' error' : ''}`} placeholder="e.g. Advanced JavaScript — Closures" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
              {errors.title && <div className="form-error">⊗ {errors.title}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="upload-desc">Description</label>
              <textarea id="upload-desc" className="form-input" placeholder="What will learners gain from this video?" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="upload-course">Course *</label>
              <select id="upload-course" className={`form-input${errors.courseId ? ' error' : ''}`} value={form.courseId} onChange={e => setForm(p => ({ ...p, courseId: e.target.value }))}>
                <option value="">Select a course...</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
              {errors.courseId && <div className="form-error">⊗ {errors.courseId}</div>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="upload-access">Access Configuration</label>
              <select id="upload-access" className="form-input" value={form.accessConfig} onChange={e => setForm(p => ({ ...p, accessConfig: e.target.value }))}>
                <option value="enrollment_required">Enrollment Required (Recommended)</option>
                <option value="course_only">Course Members Only</option>
              </select>
            </div>

            <button className="btn btn-primary" style={{ fontSize: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }} onClick={simulateUpload}>
              <Upload size={14} /> START UPLOAD
            </button>
          </div>
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>UPLOAD WORKFLOW</div>
            {STAGES.map((s, i) => (
              <div key={s.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < STAGES.length - 1 ? '1px solid #292929' : 'none' }}>
                <div style={{ width: 24, height: 24, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <s.icon size={12} color="#A0A0A0" />
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '0.65rem', color: '#F8F8F8' }}>{String(i + 1).padStart(2, '0')} {s.label}</div>
                  <div style={{ fontSize: '0.75rem', color: '#565656' }}>
                    {i === 0 && 'Video file transferred to platform'}
                    {i === 1 && 'AES-256 encryption demo applied'}
                    {i === 2 && 'Encrypted storage demo complete'}
                    {i === 3 && 'Access controls activated'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#101010', border: '1px solid #292929', padding: '1rem', borderLeft: '3px solid #eab308' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.4rem' }}>IMPORTANT NOTE</div>
            <p style={{ fontSize: '0.75rem', color: '#565656', lineHeight: 1.6 }}>
              Encryption and cloud storage are demonstrated visually in this prototype. The video file is not actually encrypted or uploaded to secure production storage.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .upload-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
