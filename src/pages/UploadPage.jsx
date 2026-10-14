// ============================================
// UPLOAD VIDEO — real multipart upload to the Express API
// ============================================

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, File, X, CheckCircle, FileVideo, Loader2, Circle, XCircle } from 'lucide-react';
import { getCourses, createCourse, uploadVideoFile, setThumbnail, getVideoProcessing, getVideoById, loadData } from '../services/dataService';
import { ThumbnailField } from '../components/DashboardKit';
import { useApp } from '../context/AppContext';

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

const STEPS = [
  { label: 'Verifying file', hint: 'Reading the whole file and fingerprinting it (SHA-256).' },
  { label: 'Encrypting (AES-256-GCM)', hint: 'Locking it in 64 KiB blocks with a brand-new random key.' },
  { label: 'Checking integrity', hint: 'Decrypting a copy and comparing it with the original.' },
  { label: 'Finalizing', hint: 'Sealing the key and making the video available.' },
];

const ProcessingScreen = ({ title, fileName, processing }) => {
  const percent = processing?.percent ?? 0;
  const current = Math.max(1, processing?.step || 1);
  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ maxWidth: 560, margin: '2rem auto' }}>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Processing video</h1>
        <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginBottom: '1.5rem', wordBreak: 'break-all' }}>{title || fileName}. Keep this page open or come back later; it will appear in My Videos when it is ready.</p>

        <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>OVERALL PROGRESS</span>
            <span className="mono" style={{ fontSize: '0.75rem', color: '#F8F8F8' }}>{percent}%</span>
          </div>
          <div style={{ background: '#292929', height: 6 }} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ background: '#FF2028', height: '100%', width: `${percent}%`, transition: 'width 0.25s linear' }} />
          </div>

          <ol style={{ listStyle: 'none', margin: '1.25rem 0 0', padding: 0 }} aria-live="polite">
            <li style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.6rem 0', borderTop: '1px solid #292929' }}>
              <CheckCircle size={18} color="#22c55e" />
              <span style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>Upload received</span>
            </li>
            {STEPS.map((step, i) => {
              const n = i + 1;
              const done = n < current;
              const active = n === current;
              return (
                <li key={step.label} style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.6rem 0', borderTop: '1px solid #292929', opacity: done || active ? 1 : 0.45 }}>
                  <span style={{ marginTop: 1, display: 'flex' }}>
                    {done ? <CheckCircle size={18} color="#22c55e" />
                      : active ? <Loader2 size={18} color="#FF2028" style={{ animation: 'vpSpin 0.9s linear infinite' }} />
                      : <Circle size={18} color="#565656" />}
                  </span>
                  <span>
                    <span style={{ display: 'block', fontSize: '0.9rem', color: '#F8F8F8' }}>{step.label}</span>
                    {active && <span className="mono" style={{ display: 'block', fontSize: '0.6rem', color: '#808080', marginTop: 2 }}>{step.hint}</span>}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
        <style>{'@keyframes vpSpin { to { transform: rotate(360deg); } }'}</style>
      </div>
    </div>
  );
};

export default function UploadPage() {
  const navigate = useNavigate();
  const { currentUser, showNotification, refreshStats } = useApp();
  const fileRef = useRef(null);
  const [courses, setCourses] = useState(() => getCourses(currentUser.id));
  const [thumb, setThumb] = useState(null);
  const [newCourseTitle, setNewCourseTitle] = useState('');
  const [creatingCourse, setCreatingCourse] = useState(false);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [errors, setErrors] = useState({});
  const [stage, setStage] = useState(null); // null | 'uploading' | 'processing' | 'failed' | 'done'
  const [processing, setProcessing] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploaded, setUploaded] = useState(null);

  const [form, setForm] = useState(() => ({ title: '', description: '', courseId: courses.length === 1 ? courses[0].id : '' }));

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

  // While the server verifies and encrypts, poll its real progress
  useEffect(() => {
    if (stage !== 'processing' || !uploaded) return undefined;
    let alive = true;
    const tick = async () => {
      const info = await getVideoProcessing(uploaded.id);
      if (!alive || !info) return;
      setProcessing(info.processing);
      if (info.uploadStatus === 'complete') {
        await loadData();
        if (!alive) return;
        setUploaded(getVideoById(uploaded.id) || uploaded);
        setStage('done');
        refreshStats();
        showNotification('Video is ready.');
      } else if (info.uploadStatus === 'failed') {
        setStage('failed');
      }
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, uploaded?.id]);

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
    let thumbFailed = false;
    if (thumb) thumbFailed = !(await setThumbnail('video', result.video.id, thumb)).success;
    setUploaded(result.video);
    setProcessing(result.video.processing);
    setStage('processing');
    if (thumbFailed) showNotification('Video uploaded, but the thumbnail could not be saved. Add it from the video page.', 'error');
  };

  const handleCreateCourse = async () => {
    const title = newCourseTitle.trim();
    if (!title) return;
    const result = await createCourse(currentUser.id, { title, description: '', visibility: 'public' });
    if (!result.success) { showNotification(result.error, 'error'); return; }
    const updated = getCourses(currentUser.id);
    setCourses(updated);
    setForm(p => ({ ...p, courseId: result.course.id }));
    setErrors(p => ({ ...p, courseId: undefined }));
    setCreatingCourse(false);
    setNewCourseTitle('');
    showNotification('Course created as a draft. Publish it from Courses when ready.');
  };

  const reset = () => {
    setStage(null); setFile(null); setThumb(null); setProgress(0); setUploaded(null); setProcessing(null);
    setForm({ title: '', description: '', courseId: courses.length === 1 ? courses[0].id : '' });
  };

  if (stage === 'processing' && uploaded) {
    return <ProcessingScreen title={uploaded.title} fileName={file?.name} processing={processing} />;
  }

  if (stage === 'failed' && uploaded) {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: 520, margin: '3rem auto', textAlign: 'center' }}>
          <XCircle size={48} color="#FF2028" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Processing failed</h2>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.75rem' }}>{processing?.error || 'Something went wrong while processing this video. Please upload it again.'}</p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={reset}>Try again</button>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/studio/library')}>Go to My Videos</button>
          </div>
        </div>
      </div>
    );
  }

  if (stage === 'done' && uploaded) {
    return (
      <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
        <div style={{ maxWidth: 520, margin: '3rem auto', textAlign: 'center' }}>
          <CheckCircle size={48} color="#22c55e" style={{ marginBottom: '1rem' }} />
          <h2 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Video ready</h2>
          <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.75rem' }}>
            "{uploaded.title}" is {uploaded.encryptionStatus === 'encrypted' ? 'encrypted (AES-256-GCM) and ' : ''}ready. Remember to publish the course so learners can watch it.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => navigate(`/studio/preview/${uploaded.id}`)}>Watch it</button>
            <button className="btn btn-secondary" style={{ fontSize: '0.8rem' }} onClick={() => navigate('/studio/library')}>Go to My Videos</button>
            <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={reset}>Upload another</button>
          </div>
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
              {progress >= 100 ? 'UPLOAD COMPLETE — STARTING PROCESSING...' : `${progress}%`}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>Upload video</h1>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${errors.file || dragging ? '#FF2028' : file ? '#22c55e' : '#3a3a3a'}`,
            background: dragging ? 'rgba(255,32,40,0.05)' : '#1D1D1D',
            padding: '2.5rem 2rem',
            textAlign: 'center',
            cursor: 'pointer',
          }}
        >
          <input ref={fileRef} type="file" accept="video/*,.mkv" style={{ display: 'none' }} onChange={e => handleFile(e.target.files[0])} />
          {file ? (
            <div>
              <File size={32} color="#22c55e" style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '0.95rem', color: '#F8F8F8', marginBottom: '0.25rem', wordBreak: 'break-all' }}>{file.name}</div>
              <div className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0' }}>{formatSize(file.size)}</div>
              <button className="btn btn-ghost" style={{ fontSize: '0.65rem', marginTop: '0.75rem' }} onClick={e => { e.stopPropagation(); setFile(null); }}>
                <X size={12} /> Choose a different file
              </button>
            </div>
          ) : (
            <div>
              <Upload size={34} color={dragging ? '#FF2028' : '#565656'} style={{ marginBottom: '0.75rem' }} />
              <div style={{ fontSize: '1rem', color: '#F8F8F8', marginBottom: '0.25rem' }}>Drop your video here, or click to choose</div>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>MP4 · WEBM · MOV · MKV · AVI · UP TO 2 GB</div>
            </div>
          )}
        </div>
        {errors.file && <div className="form-error">⊗ {errors.file}</div>}

        <div className="form-group">
          <label className="form-label" htmlFor="upload-title">Title</label>
          <input id="upload-title" type="text" className={`form-input${errors.title ? ' error' : ''}`} placeholder="e.g. Lesson 1 — Introduction" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} />
          {errors.title && <div className="form-error">⊗ {errors.title}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="upload-course">Course</label>
          {courses.length > 0 && !creatingCourse && (
            <select
              id="upload-course"
              className={`form-input${errors.courseId ? ' error' : ''}`}
              value={form.courseId}
              onChange={e => {
                if (e.target.value === '__new__') { setCreatingCourse(true); return; }
                setForm(p => ({ ...p, courseId: e.target.value }));
              }}
            >
              <option value="">Select a course...</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              <option value="__new__">+ New course…</option>
            </select>
          )}
          {(creatingCourse || courses.length === 0) && (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input
                id="upload-course"
                className="form-input"
                style={{ flex: 1, minWidth: 200 }}
                placeholder="Name your new course"
                value={newCourseTitle}
                onChange={e => setNewCourseTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateCourse(); }}
                autoFocus={creatingCourse}
              />
              <button className="btn btn-primary" style={{ fontSize: '0.75rem' }} onClick={handleCreateCourse} disabled={!newCourseTitle.trim()}>Create course</button>
              {courses.length > 0 && (
                <button className="btn btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => { setCreatingCourse(false); setNewCourseTitle(''); }}>Cancel</button>
              )}
            </div>
          )}
          {errors.courseId && <div className="form-error">⊗ {errors.courseId}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="upload-desc">Description <span style={{ color: '#565656' }}>(optional)</span></label>
          <textarea id="upload-desc" className="form-input" rows={3} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
        </div>

        <ThumbnailField
          file={thumb}
          onSelect={setThumb}
          onRemove={() => setThumb(null)}
          onError={(msg) => showNotification(msg, 'error')}
        />

        <button className="btn btn-primary" style={{ fontSize: '0.9rem', justifyContent: 'center', padding: '0.9rem' }} onClick={startUpload}>
          <Upload size={16} /> Upload
        </button>
      </div>
    </div>
  );
}
