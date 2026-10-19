// ============================================
// STUDIO — edit your public profile (what learners see before enrolling)
// ============================================

import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Plus, Trash2, Upload } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveMyProfile, uploadMyAvatar, removeMyAvatar } from '../services/dataService';
import Avatar from '../components/Avatar';
import { PageHeader, Panel } from '../components/DashboardKit';
import {
  validateCreatorProfile, PROFILE_HEADLINE_MAX, PROFILE_BIO_MAX, ACHIEVEMENT_MAX, ACHIEVEMENTS_LIMIT,
} from '../../shared/validation.js';

const problem = (msg) => msg && <div role="alert" style={{ color: '#FF2028', fontSize: '0.75rem', marginTop: '0.3rem' }}>{msg}</div>;
const count = { fontSize: '0.7rem', color: '#8B8B8B', marginTop: '0.3rem' };

export default function CreatorProfileEditor() {
  const { currentUser, refreshUser, showNotification } = useApp();
  const saved = currentUser.profile || {};
  const hasApplication = !!currentUser.creatorApplication;

  const [form, setForm] = useState({
    headline: saved.headline || '',
    bio: saved.bio || '',
    website: saved.website || '',
    achievements: saved.achievements || [],
    showExperience: saved.showExperience !== false,
    showLinks: !!saved.showLinks,
  });
  const [newAchievement, setNewAchievement] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [picBusy, setPicBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (key, value) => { setForm(f => ({ ...f, [key]: value })); setErrors({}); };

  const addAchievement = () => {
    const text = newAchievement.trim();
    if (!text) return;
    if (form.achievements.length >= ACHIEVEMENTS_LIMIT) { setErrors({ achievements: `Add at most ${ACHIEVEMENTS_LIMIT} achievements.` }); return; }
    if (text.length < 3) { setErrors({ achievements: 'An achievement needs at least 3 characters.' }); return; }
    set('achievements', [...form.achievements, text]);
    setNewAchievement('');
  };

  const save = async (e) => {
    e.preventDefault();
    const check = validateCreatorProfile(form);
    if (Object.keys(check.errors).length) { setErrors(check.errors); return; }
    setBusy(true);
    const result = await saveMyProfile(form);
    setBusy(false);
    if (!result.success) { setErrors(result.fields || {}); showNotification(result.error, 'error'); return; }
    await refreshUser();
    showNotification('Profile saved.');
  };

  const choosePicture = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { showNotification('Use a JPEG, PNG or WebP image.', 'error'); return; }
    if (file.size > 2 * 1024 * 1024) { showNotification('The picture must be 2 MB or smaller.', 'error'); return; }
    setPicBusy(true);
    const result = await uploadMyAvatar(file);
    setPicBusy(false);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    await refreshUser();
  };

  const removePicture = async () => {
    setPicBusy(true);
    const result = await removeMyAvatar();
    setPicBusy(false);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    await refreshUser();
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 820 }}>
      <PageHeader label="CREATOR STUDIO" title="PUBLIC PROFILE" subtitle="Learners can open your profile from your courses before they enrol. Tell them who you are." />
      <div style={{ marginBottom: '1.25rem' }}>
        <Link to={`/learn/creator/${currentUser.id}`} className="btn btn-ghost" style={{ fontSize: '0.7rem' }}><Eye size={12} /> VIEW MY PUBLIC PROFILE</Link>
      </div>

      <Panel title="PROFILE PICTURE" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <Avatar name={currentUser.name} url={saved.avatarUrl} size={96} accent style={{ border: '1px solid #292929' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={choosePicture} />
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem' }} disabled={picBusy} onClick={() => fileRef.current?.click()}><Upload size={12} /> {saved.avatarUrl ? 'CHANGE PICTURE' : 'UPLOAD PICTURE'}</button>
              {saved.avatarUrl && <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} disabled={picBusy} onClick={removePicture}>REMOVE</button>}
            </div>
            <span style={{ fontSize: '0.75rem', color: '#8B8B8B' }}>JPEG, PNG or WebP, up to 2 MB. A square photo of your face works best.</span>
          </div>
        </div>
      </Panel>

      <form onSubmit={save}>
        <Panel title="ABOUT YOU" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-headline">Headline</label>
              <input id="pf-headline" className="form-input" maxLength={PROFILE_HEADLINE_MAX + 20} placeholder="e.g. Full-stack engineer and teacher" value={form.headline} onChange={e => set('headline', e.target.value)} />
              <div style={count}>{form.headline.trim().length}/{PROFILE_HEADLINE_MAX}</div>
              {problem(errors.headline)}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-bio">About</label>
              <textarea id="pf-bio" className="form-input" rows={6} maxLength={PROFILE_BIO_MAX + 100} placeholder="Who you are, what you teach and what learners can expect." value={form.bio} onChange={e => set('bio', e.target.value)} />
              <div style={count}>{form.bio.trim().length}/{PROFILE_BIO_MAX}</div>
              {problem(errors.bio)}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-site">Website (optional)</label>
              <input id="pf-site" className="form-input" placeholder="https://your-site.com" value={form.website} onChange={e => set('website', e.target.value)} />
              {problem(errors.website)}
            </div>
          </div>
        </Panel>

        <Panel title="YOUR ACHIEVEMENTS" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <div style={{ fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6 }}>
              Badges such as "Verified creator" and the number of courses and learners are added automatically. Add your own highlights below (up to {ACHIEVEMENTS_LIMIT}).
            </div>
            {form.achievements.map((a, i) => (
              <div key={`${a}-${i}`} style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', background: '#101010', border: '1px solid #292929', padding: '0.5rem 0.75rem' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', color: '#F8F8F8' }}>{a}</span>
                <button type="button" aria-label={`Remove ${a}`} className="btn btn-ghost" style={{ padding: '0.25rem 0.5rem' }} onClick={() => set('achievements', form.achievements.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
              </div>
            ))}
            {form.achievements.length < ACHIEVEMENTS_LIMIT && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input className="form-input" style={{ flex: 1 }} aria-label="New achievement" maxLength={ACHIEVEMENT_MAX} placeholder="e.g. 10,000 YouTube subscribers" value={newAchievement} onChange={e => setNewAchievement(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAchievement(); } }} />
                <button type="button" className="btn btn-secondary" style={{ fontSize: '0.7rem' }} onClick={addAchievement}><Plus size={12} /> ADD</button>
              </div>
            )}
            {problem(errors.achievements)}
          </div>
        </Panel>

        <Panel title="WHAT LEARNERS CAN SEE" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem', color: '#F8F8F8', cursor: hasApplication ? 'pointer' : 'default', opacity: hasApplication ? 1 : 0.6 }}>
              <input type="checkbox" disabled={!hasApplication} checked={form.showExperience} onChange={e => set('showExperience', e.target.checked)} style={{ marginTop: 3 }} />
              <span>My years of teaching and the topics I teach<br /><span style={{ fontSize: '0.75rem', color: '#8B8B8B' }}>From your creator application. Your CV and the details you wrote for the admin are never shown.</span></span>
            </label>
            <label style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', fontSize: '0.85rem', color: '#F8F8F8', cursor: hasApplication ? 'pointer' : 'default', opacity: hasApplication ? 1 : 0.6 }}>
              <input type="checkbox" disabled={!hasApplication} checked={form.showLinks} onChange={e => set('showLinks', e.target.checked)} style={{ marginTop: 3 }} />
              <span>My LinkedIn and other teaching platform links<br /><span style={{ fontSize: '0.75rem', color: '#8B8B8B' }}>The links from your creator application.</span></span>
            </label>
            {!hasApplication && <div style={{ fontSize: '0.75rem', color: '#8B8B8B' }}>These options are available to creators who applied through the creator application.</div>}
          </div>
        </Panel>

        <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={busy}>{busy ? 'SAVING...' : 'SAVE PROFILE'}</button>
      </form>
    </div>
  );
}
