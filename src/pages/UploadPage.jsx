// ============================================
// UPLOAD VIDEO — real multipart upload to the Express API
// ============================================

import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, CheckCircle, ShieldCheck, FileVideo } from 'lucide-react';
import { getCourses, uploadVideoFile } from '../services/dataService';
import { useApp } from '../context/AppContext';
import { SectionLabel } from '../components/SharedComponents';

const ACCEPTED_EXT = /\.(mp4|webm|mov|avi|mkv)$/i;
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // matches the server limit

const formatSize = (bytes) =>
  bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

// Read the real length from the file so the library shows an accurate duration
const readDuration = (file) => new Promise((resolve) => {
  const url = URL.createObjectURL(file);
  const el = document.createElement('video');
  const finish = (value) => { URL.revokeObjectURL(url); el.removeAttribute('src'); resolve(value); };
  const timer = setTimeout(() => finish(null), 8000);
  el.preload = 'metadata';
  el.onloadedmetadata = () => { clearTimeout(timer); finish(Number.isFinite(el.duration) ? el.duration : null); };
  el.onerror = () => { clearTimeout(timer); finish(null); };
  el.src = url;
});

export default function UploadPage() {
  const navigate = useNavigate();
  const { currentUser, showNotification, refreshStats } = useApp();
  const fileRef = useRef(null);
  const [courses] = useState(() => getCourses(currentUser.id));
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState(null); // null | 'uploading' | 'done'
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(null);

  const [form, setForm] = useState({ title: '', description: '', courseId: '' });

  const handleFile = (f) => {
    if (!f) return;
    if (!f.type.startsWith('video/') && !ACCEPTED_EXT.test(f.name)) {
      setErrors(p => ({ ...p, file: 'Please select a video file (MP4, WebM, MOV, AVI, MKV).' }));
      return;
    }
    if (f.size > MAX_BYTES) {
      setErrors(p => ({ ...p, file: 'This file is larger than the 2 GB limit.' }));
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

  const startUpload = async () => {
    if (!validate()) return;
    setStage('uploading');
    setProgress(0);

    const duration = await readDuration(file);
    const result = await uploadVideoFile(
      form.courseId,
      { title: form.title.trim(), description: form.description, duration, file },
      (fraction) => setProgress(Math.round(fraction * 100)),
    );

    if (!result.success) {
      showNotification(result.error, 'error');
      setStage(null);
      setProgress(0);
      return;
    }
    setUploaded(result.video);
    setStage('done');
    refreshStats();
    showNotification('Video uploaded to your library.');
  };

  const reset = () => {
    setStage(null); setFile(null); setProgress(0); setUploaded(null);
    setForm({ title: '', description: '', courseId: '' });
  };

  if (stage === 'done' && uploaded) {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'rgba(34,197,94,0.1)', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
            <CheckCircle size={32} color="#22c55e" />
          </div>
          <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
            VIDEO UPLOADED
          </h2>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '2rem' }}>
            "{uploaded.title}" is {uploaded.encryptionStatus === 'encrypted' ? 'AES-256 encrypted and stored on the server' : 'stored on the server'}. Only enrolled learners can stream it.
          </p>

          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.5rem', marginBottom: '2rem', textAlign: 'left' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1rem' }}>PROCESSING LOG</div>
            {[
              { label: 'File received', status: 'COMPLETE', note: `${uploaded.fileSize} — transferred to server.` },
              { label: 'File signature verified', status: 'COMPLETE', note: 'Server checked the real video container signature (not just extension).' },
              { label: 'AES-256-CTR encrypted at rest', status: uploaded.encryptionStatus === 'encrypted' ? 'COMPLETE' : 'SKIPPED', note: uploaded.encryptionStatus === 'encrypted' ? 'Unique per-video key generated. Plaintext file destroyed. Ciphertext stored on disk.' : 'Encryption unavailable for this upload.' },
              { label: 'Access control applied', status: 'ACTIVE', note: 'Streaming requires enrollment. Server re-checks on every byte-range request.' },
              { label: 'AI anomaly detection', status: 'ACTIVE', note: 'Every playback event is analysed for suspicious patterns.' },
            ].map(item => (
              <div key={item.label} style={{ padding: '0.6rem 0', borderBottom: '1px solid #292929' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#F8F8F8' }}>{item.label}</span>
                  <span className="badge" style={{
                    color: item.status === 'SKIPPED' ? '#eab308' : '#22c55e',
                    borderColor: item.status === 'SKIPPED' ? '#eab308' : '#22c55e',
                    fontSize: '0.55rem',
                  }}>
                    {item.status}
                  </span>
                </div>
                <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginTop: '0.2rem' }}>{item.note}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} onClick={() => navigate(`/learn/watch/${uploaded.id}`)}>
              PREVIEW VIDEO
            </button>
            <button className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={() => navigate(`/studio/video/${uploaded.id}`)}>
              VIEW DETAILS
            </button>
            <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={reset}>
              UPLOAD ANOTHER
            </button>
          </div>
          <p className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginTop: '1.25rem' }}>
            Remember to publish the course so learners can find it.
          </p>
        </div>
      </div>
    );
  }

  if (stage === 'uploading') {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '2rem', letterSpacing: '-0.02em' }}>
            UPLOADING VIDEO
          </h1>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '2rem', textAlign: 'center' }}>
            <FileVideo size={40} color="#FF2028" style={{ marginBottom: '1rem' }} />
            <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1rem', textTransform: 'uppercase', marginBottom: '0.3rem', wordBreak: 'break-all' }}>
              {file?.name}
            </div>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>
              {file && formatSize(file.size)} · keep this tab open
            </div>
            <div style={{ background: '#292929', height: '6px', width: '100%', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: '#FF2028', width: `${progress}%`, transition: 'width 0.15s' }} />
            </div>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#F8F8F8', marginTop: '0.6rem' }}>
              {progress >= 100 ? 'VERIFYING FILE...' : `${progress}%`}
            </div>
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

      {courses.length === 0 && (
        <div style={{ background: '#1D1D1D', border: '1px solid #eab308', padding: '1rem 1.25rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#A0A0A0' }}>
          You need a course before you can upload. <button className="btn btn-ghost" style={{ fontSize: '0.65rem', marginLeft: '0.5rem' }} onClick={() => navigate('/studio/courses')}>CREATE A COURSE</button>
        </div>
      )}

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
            <input ref={fileRef} type="file" accept="video/*,.mkv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
            {file ? (
              <div>
                <File size={32} color="#22c55e" style={{ marginBottom: '0.75rem' }} />
                <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '0.9rem', textTransform: 'uppercase', marginBottom: '0.25rem', wordBreak: 'break-all' }}>{file.name}</div>
                <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>{formatSize(file.size)}</div>
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
                <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginTop: '0.5rem' }}>MP4 · WEBM · MOV · MKV · AVI · UP TO 2 GB</div>
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

            <button className="btn btn-primary" style={{ fontSize: '0.75rem', justifyContent: 'center', marginTop: '0.5rem' }} onClick={startUpload} disabled={courses.length === 0}>
              <Upload size={14} /> START UPLOAD
            </button>
          </div>
        </div>

        {/* Info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
            <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', marginBottom: '1rem' }}>WHAT HAPPENS TO YOUR VIDEO</div>
            {[
              ['Uploaded to the server', 'Sent in one request with live progress.'],
              ['Checked by the server', 'Real file signature and size are verified.'],
              ['Access-controlled', 'Only enrolled, signed-in learners can stream it.'],
              ['Logged', 'Every play or denied attempt appears in your access logs.'],
            ].map(([title, text], i) => (
              <div key={title} style={{ display: 'flex', gap: '0.75rem', padding: '0.6rem 0', borderBottom: i < 3 ? '1px solid #292929' : 'none' }}>
                <div style={{ width: 24, height: 24, background: '#292929', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ShieldCheck size={12} color="#A0A0A0" />
                </div>
                <div>
                  <div className="mono" style={{ fontSize: '0.65rem', color: '#F8F8F8' }}>{String(i + 1).padStart(2, '0')} {title}</div>
                  <div style={{ fontSize: '0.75rem', color: '#565656' }}>{text}</div>
                </div>
              </div>
            ))}
          </div>

          <div style={{ background: '#101010', border: '1px solid #292929', padding: '1rem', borderLeft: '3px solid #eab308' }}>
            <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.4rem' }}>GOOD TO KNOW</div>
            <p style={{ fontSize: '0.75rem', color: '#565656', lineHeight: 1.6 }}>
              MP4 (H.264) and WebM play in every browser. MOV, MKV and AVI upload fine but may not play in all browsers. Files are not yet encrypted on disk.
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
