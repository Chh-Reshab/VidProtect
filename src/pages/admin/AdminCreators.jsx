// ============================================
// ADMIN — creator applications: read the teaching history, CV and links, then approve or reject
// ============================================

import { useState } from 'react';
import { UserCheck, FileText, ExternalLink } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getUsers, reviewCreatorApplication, downloadApplicantCv } from '../../services/dataService';
import { EmptyState } from '../../components/SharedComponents';
import { PageHeader, Panel } from '../../components/DashboardKit';

const safeHref = (url) => (/^https?:\/\//i.test(url || '') ? url : null);
const TABS = [['pending', 'PENDING'], ['approved', 'APPROVED'], ['rejected', 'REJECTED']];
const BADGE = { pending: 'badge-yellow', approved: 'badge-green', rejected: 'badge-red' };

const applicants = () => getUsers().filter(u => u.role === 'creator' && u.creatorApplication && u.creatorStatus && u.creatorStatus !== 'unsubmitted');

function Detail({ label, children }) {
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.15rem' }}>{label}</div>
      <div style={{ fontSize: '0.85rem', color: '#F8F8F8', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export default function AdminCreators() {
  const { currentUser, showNotification } = useApp();
  const [list, setList] = useState(applicants);
  const [tab, setTab] = useState('pending');
  const [rejecting, setRejecting] = useState(null); // user id whose rejection reason is being typed
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const decide = async (user, approve) => {
    if (!approve && note.trim().length < 10) { showNotification('Write a reason of at least 10 characters so the applicant can fix it.', 'error'); return; }
    setBusy(true);
    const result = await reviewCreatorApplication(currentUser.id, user.id, approve, approve ? '' : note);
    setBusy(false);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setList(applicants());
    setRejecting(null);
    setNote('');
    showNotification(approve ? `${user.name} is now an approved creator.` : `Application from ${user.name} rejected.`);
  };

  const openCv = async (user) => {
    const r = await downloadApplicantCv(user.id);
    if (!r.success) showNotification(r.error, 'error');
  };

  const shown = list.filter(u => u.creatorStatus === tab);
  const count = (status) => list.filter(u => u.creatorStatus === status).length;

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="CREATOR APPROVALS" subtitle="New creators stay locked out of the studio until you approve their application." />

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {TABS.map(([key, label]) => (
          <button key={key} type="button" className={tab === key ? 'btn btn-primary' : 'btn btn-ghost'} style={{ fontSize: '0.7rem' }} onClick={() => setTab(key)}>
            {label} ({count(key)})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={UserCheck} title={`NO ${tab.toUpperCase()} APPLICATIONS`} description="Applications appear here as creators submit them." />
      ) : shown.map(u => {
        const a = u.creatorApplication;
        const linkedin = safeHref(a.linkedinUrl);
        const other = a.otherPlatform;
        const otherLink = safeHref(other?.platformUrl);
        return (
          <Panel key={u.id} style={{ marginBottom: '1rem' }}>
            <div style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '1.05rem', color: '#F8F8F8' }}>{a.displayName || u.name} <span className={`badge ${BADGE[u.creatorStatus] || ''}`} style={{ fontSize: '0.7rem', marginLeft: 6 }}>{u.creatorStatus.toUpperCase()}</span></div>
                  <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>
                    {u.email}{u.emailVerified === false ? ' (EMAIL NOT VERIFIED)' : ''} · joined {u.joinDate} · submitted {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '—'}{a.submissions > 1 ? ` · attempt ${a.submissions}` : ''}
                  </div>
                </div>
                {u.creatorStatus === 'pending' && rejecting !== u.id && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.7rem' }} disabled={busy} onClick={() => decide(u, true)}>APPROVE</button>
                    <button className="btn btn-ghost" style={{ fontSize: '0.7rem', color: '#FF2028', borderColor: '#FF2028' }} disabled={busy} onClick={() => { setRejecting(u.id); setNote(''); }}>REJECT</button>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0 1.5rem' }}>
                <Detail label="YEARS TEACHING">{a.yearsExperience ?? '—'}</Detail>
                <Detail label="WANTS TO TEACH">{a.topics || '—'}</Detail>
              </div>
              <Detail label="TEACHING HISTORY"><span style={{ whiteSpace: 'pre-wrap', color: '#A0A0A0' }}>{a.teachingHistory || '—'}</span></Detail>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
                {a.cv
                  ? <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => openCv(u)}><FileText size={12} /> CV: {a.cv.originalName}</button>
                  : <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>NO CV UPLOADED</span>}
                {linkedin
                  ? <a href={linkedin} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ fontSize: '0.7rem' }}>LINKEDIN <ExternalLink size={11} /></a>
                  : <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>NO LINKEDIN</span>}
              </div>

              <Detail label="TEACHES ON ANOTHER PLATFORM">
                {other ? (
                  <>
                    {other.platform === 'Other' ? other.platformName : other.platform}
                    {otherLink ? <> · <a href={otherLink} target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>{other.platformUrl} <ExternalLink size={11} /></a></> : null}
                    {other.audienceSize != null ? ` · ${other.audienceSize.toLocaleString()} followers/students` : ''}
                  </>
                ) : 'No'}
              </Detail>

              {u.creatorStatus === 'rejected' && a.reviewNote && <Detail label="REASON GIVEN">{a.reviewNote}</Detail>}

              {rejecting === u.id && (
                <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  <label className="form-label" htmlFor={`note-${u.id}`}>Reason for the applicant (they will see this)</label>
                  <textarea id={`note-${u.id}`} className="form-input" rows={3} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. Please add your CV so we can verify your experience." />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-primary" style={{ fontSize: '0.7rem', background: '#FF2028' }} disabled={busy} onClick={() => decide(u, false)}>CONFIRM REJECTION</button>
                    <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => setRejecting(null)}>CANCEL</button>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
