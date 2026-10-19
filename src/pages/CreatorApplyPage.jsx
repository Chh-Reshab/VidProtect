// ============================================
// CREATOR APPLICATION — the only page a new creator can open until an admin approves them.
// Teaching history, a CV and/or LinkedIn profile, and any other platform they already teach on.
// ============================================

import { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { Clock, XCircle, LogOut, FileText, ExternalLink } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { submitCreatorApplication, downloadCreatorCv } from '../services/dataService';
import { Logo } from '../components/SharedComponents';
import {
  validateCreatorApplication, PLATFORMS, APP_HISTORY_MIN, APP_HISTORY_MAX, APP_TOPICS_MAX, CV_MAX_BYTES, CV_EXTENSIONS, NAME_MAX,
} from '../../shared/validation.js';

const fieldError = (msg) => msg && <div role="alert" style={{ color: '#FF2028', fontSize: '0.7rem', marginTop: '0.3rem' }}>{msg}</div>;
const hint = { fontSize: '0.7rem', color: '#8B8B8B', marginTop: '0.3rem' };
const section = { fontFamily: 'IBM Plex Mono, monospace', fontSize: '0.7rem', letterSpacing: '0.1em', color: '#A0A0A0', textTransform: 'uppercase', margin: '0.5rem 0' };
const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
const formatSize = (bytes) => (bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);

function Summary({ application, onCv }) {
  const a = application || {};
  const rows = [
    ['Name', a.displayName], ['Years teaching', a.yearsExperience ?? '—'], ['Topics', a.topics || '—'],
  ];
  const linkedin = safeHref(a.linkedinUrl);
  const other = a.otherPlatform;
  const otherLink = safeHref(other?.platformUrl);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
      {rows.map(([k, v]) => (<div key={k}><div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{k.toUpperCase()}</div><div style={{ color: '#F8F8F8' }}>{v}</div></div>))}
      <div><div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>TEACHING HISTORY</div><div style={{ color: '#A0A0A0', whiteSpace: 'pre-wrap' }}>{a.teachingHistory}</div></div>
      {a.cv && <div><button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={onCv}><FileText size={12} /> {a.cv.originalName}</button></div>}
      {linkedin && <div><a href={linkedin} target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>LinkedIn profile <ExternalLink size={11} /></a></div>}
      {other && otherLink && <div style={{ color: '#A0A0A0' }}>Also teaches on {other.platform === 'Other' ? other.platformName : other.platform}: <a href={otherLink} target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>{other.platformUrl}</a>{other.audienceSize != null && ` · ${other.audienceSize.toLocaleString()} followers/students`}</div>}
    </div>
  );
}

export default function CreatorApplyPage() {
  const { currentUser, logout, refreshUser, showNotification } = useApp();
  const status = currentUser?.creatorStatus;
  const previous = currentUser?.creatorApplication;

  const [form, setForm] = useState(() => ({
    displayName: previous?.displayName || currentUser?.name || '',
    teachingHistory: previous?.teachingHistory || '',
    topics: previous?.topics || '',
    yearsExperience: previous?.yearsExperience ?? '',
    linkedinUrl: previous?.linkedinUrl || '',
    teachesElsewhere: !!previous?.teachesElsewhere,
    platform: previous?.otherPlatform?.platform || '',
    platformName: previous?.otherPlatform?.platformName || '',
    platformUrl: previous?.otherPlatform?.platformUrl || '',
    audienceSize: previous?.otherPlatform?.audienceSize ?? '',
    confirm: false,
  }));
  const [file, setFile] = useState(null);
  const [keepCv, setKeepCv] = useState(!!previous?.cv);
  const [touched, setTouched] = useState({});
  const [serverErrors, setServerErrors] = useState({});
  const [fileError, setFileError] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const hasCv = !!file || (keepCv && !!previous?.cv);
  const check = useMemo(() => validateCreatorApplication(form, { hasCv }), [form, hasCv]);
  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setServerErrors({}); };
  const touch = (key) => setTouched(t => ({ ...t, [key]: true }));
  const err = (key) => ((touched[key] || touched.all) ? check.errors[key] : undefined) || serverErrors[key];

  if (!currentUser) return <Navigate to="/creator/login" replace />;
  if (currentUser.role !== 'creator') return <Navigate to="/learn" replace />;
  if (!status || status === 'approved') return <Navigate to="/studio/library" replace />;

  const chooseFile = (e) => {
    const f = e.target.files?.[0];
    setFileError('');
    if (!f) { setFile(null); return; }
    const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
    if (!CV_EXTENSIONS.includes(ext)) { setFileError('The CV must be a PDF or Word file (.pdf, .doc, .docx).'); e.target.value = ''; setFile(null); return; }
    if (f.size > CV_MAX_BYTES) { setFileError(`The CV must be ${CV_MAX_BYTES / 1024 / 1024} MB or smaller.`); e.target.value = ''; setFile(null); return; }
    setFile(f);
  };

  const submit = async (e) => {
    e.preventDefault();
    setTouched({ all: true });
    if (Object.keys(check.errors).length || fileError) return;
    setBusy(true);
    setProgress(0);
    const result = await submitCreatorApplication({ ...form, removeCv: !keepCv && !file && !!previous?.cv }, file, setProgress);
    setBusy(false);
    if (!result.success) { setServerErrors(result.fields || {}); showNotification(result.error, 'error'); return; }
    await refreshUser();
    showNotification('Application submitted. An admin will review it.');
  };

  const downloadCv = async () => {
    const r = await downloadCreatorCv();
    if (!r.success) showNotification(r.error, 'error');
  };

  const pending = status === 'pending';
  return (
    <div style={{ minHeight: '100vh', background: '#101010', padding: '1.5rem 1rem 3rem' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem', flexWrap: 'wrap' }}>
          <Link to="/" style={{ textDecoration: 'none' }}><Logo size="sm" /></Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{currentUser.email}</span>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={logout}><LogOut size={12} /> LOGOUT</button>
          </div>
        </div>

        <div style={{ background: '#1D1D1D', border: '1px solid #EEEEEE', boxShadow: '8px 8px 0px #292929', padding: '2rem' }}>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.4rem', textTransform: 'uppercase', letterSpacing: '-0.02em' }}>CREATOR APPLICATION</h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.85rem', margin: '0.4rem 0 1.5rem' }}>
            Your creator studio is locked until an admin reviews and approves your teaching background. Once approved you can publish courses and also learn on the platform.
          </p>

          {pending && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', padding: '0.9rem', background: 'rgba(234,179,8,0.1)', border: '1px solid #eab308', marginBottom: '1.5rem' }}>
                <Clock size={18} color="#eab308" />
                <span style={{ fontSize: '0.85rem', color: '#eab308' }}>Under review. We will unlock your studio as soon as an admin approves your application.</span>
              </div>
              <Summary application={previous} onCv={downloadCv} />
            </>
          )}

          {!pending && (
            <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {status === 'rejected' && (
                <div style={{ padding: '0.9rem', background: 'rgba(255,32,40,0.1)', border: '1px solid #FF2028' }}>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#FF2028', fontSize: '0.85rem' }}><XCircle size={16} /> Your application was not approved.</div>
                  {previous?.reviewNote && <p style={{ color: '#F8F8F8', fontSize: '0.85rem', marginTop: '0.5rem' }}>Reviewer note: {previous.reviewNote}</p>}
                  <p style={{ color: '#A0A0A0', fontSize: '0.8rem', marginTop: '0.4rem' }}>Update the details below and submit again.</p>
                </div>
              )}

              <div style={section}>About you</div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-name">Display name</label>
                <input id="ca-name" className="form-input" value={form.displayName} maxLength={NAME_MAX} onBlur={() => touch('displayName')} onChange={e => set('displayName', e.target.value)} />
                {fieldError(err('displayName'))}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-years">Years of teaching experience</label>
                <input id="ca-years" type="number" min="0" max="60" className="form-input" value={form.yearsExperience} onBlur={() => touch('yearsExperience')} onChange={e => set('yearsExperience', e.target.value)} />
                {fieldError(err('yearsExperience'))}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-topics">What will you teach?</label>
                <input id="ca-topics" className="form-input" value={form.topics} maxLength={APP_TOPICS_MAX} placeholder="e.g. Python, data structures" onBlur={() => touch('topics')} onChange={e => set('topics', e.target.value)} />
                {fieldError(err('topics'))}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-history">Teaching history</label>
                <textarea id="ca-history" className="form-input" rows={6} value={form.teachingHistory} maxLength={APP_HISTORY_MAX} placeholder="Where and what have you taught, to whom, and for how long?" onBlur={() => touch('teachingHistory')} onChange={e => set('teachingHistory', e.target.value)} />
                <div style={hint}>{form.teachingHistory.trim().length}/{APP_HISTORY_MAX} characters (at least {APP_HISTORY_MIN})</div>
                {fieldError(err('teachingHistory'))}
              </div>

              <div style={section}>Proof of experience (add a CV, a LinkedIn profile, or both)</div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-cv">CV (PDF or Word, up to {CV_MAX_BYTES / 1024 / 1024} MB)</label>
                {keepCv && previous?.cv && !file && (
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.4rem', fontSize: '0.8rem', color: '#A0A0A0', flexWrap: 'wrap' }}>
                    <FileText size={14} /> {previous.cv.originalName} ({formatSize(previous.cv.size)})
                    <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setKeepCv(false)}>REMOVE</button>
                  </div>
                )}
                <input id="ca-cv" type="file" accept=".pdf,.doc,.docx" className="form-input" onChange={chooseFile} />
                {fieldError(fileError)}
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="ca-linkedin">LinkedIn profile</label>
                <input id="ca-linkedin" className="form-input" value={form.linkedinUrl} placeholder="https://www.linkedin.com/in/your-name" onBlur={() => touch('linkedinUrl')} onChange={e => set('linkedinUrl', e.target.value)} />
                {fieldError(err('linkedinUrl'))}
              </div>
              {fieldError(err('credentials'))}

              <div style={section}>Other platforms</div>
              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.85rem', color: '#F8F8F8', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.teachesElsewhere} onChange={e => set('teachesElsewhere', e.target.checked)} />
                I already teach on YouTube or a similar platform
              </label>
              {form.teachesElsewhere && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingLeft: '1rem', borderLeft: '2px solid #292929' }}>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ca-platform">Platform</label>
                    <select id="ca-platform" className="form-input" value={form.platform} onBlur={() => touch('platform')} onChange={e => set('platform', e.target.value)}>
                      <option value="">Choose...</option>
                      {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {fieldError(err('platform'))}
                  </div>
                  {form.platform === 'Other' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="ca-pname">Platform name</label>
                      <input id="ca-pname" className="form-input" maxLength={40} value={form.platformName} onBlur={() => touch('platformName')} onChange={e => set('platformName', e.target.value)} />
                      {fieldError(err('platformName'))}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label" htmlFor="ca-purl">Link to your channel or profile there</label>
                    <input id="ca-purl" className="form-input" value={form.platformUrl} placeholder="https://www.youtube.com/@yourchannel" onBlur={() => touch('platformUrl')} onChange={e => set('platformUrl', e.target.value)} />
                    {fieldError(err('platformUrl'))}
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ca-aud">Subscribers or students (optional)</label>
                    <input id="ca-aud" type="number" min="0" className="form-input" value={form.audienceSize} onBlur={() => touch('audienceSize')} onChange={e => set('audienceSize', e.target.value)} />
                    {fieldError(err('audienceSize'))}
                  </div>
                </div>
              )}

              <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.8rem', color: '#A0A0A0', cursor: 'pointer', marginTop: '0.5rem' }}>
                <input type="checkbox" checked={form.confirm} onChange={e => set('confirm', e.target.checked)} style={{ marginTop: 3 }} />
                I confirm that the information above is accurate and I agree to it being reviewed by the VidProtect AI team.
              </label>
              {fieldError(err('confirm'))}

              <button type="submit" className="btn btn-primary" style={{ justifyContent: 'center', marginTop: '0.5rem' }} disabled={busy}>
                {busy ? <><div className="spinner" style={{ width: 14, height: 14 }} /> SUBMITTING{file ? ` ${Math.round(progress * 100)}%` : '...'}</> : 'SUBMIT FOR REVIEW'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
