// ============================================
// DISCUSSION — one room for every learner, creator and admin. Admins also get the report queue.
// ============================================

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flag, Trash2, Send, ChevronUp, ShieldAlert } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useChatRoom } from '../services/useChatRoom';
import { deleteChatMessage, reportChatMessage, getChatReports, reviewChatMessage, muteChatUser } from '../services/dataService';
import Avatar from '../components/Avatar';
import { PageHeader, Panel } from '../components/DashboardKit';

const MAX_CHARS = 500;
const ROLE_BADGE = { creator: ['CREATOR', '#FF2028'], admin: ['ADMIN', '#eab308'] };

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const timeLabel = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function AuthorName({ author }) {
  const badge = ROLE_BADGE[author.role];
  const name = author.role === 'creator'
    ? <Link to={`/learn/creator/${author.id}`} style={{ color: '#F8F8F8', textDecoration: 'none', fontWeight: 600 }}>{author.name}</Link>
    : <span style={{ color: '#F8F8F8', fontWeight: 600 }}>{author.name}</span>;
  return (
    <span style={{ display: 'inline-flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {name}
      {badge && <span className="mono" style={{ fontSize: '0.65rem', color: badge[1], border: `1px solid ${badge[1]}`, padding: '0 0.35rem' }}>{badge[0]}</span>}
    </span>
  );
}

// One message as a chat bubble: yours on the right, everyone else's on the left (like WhatsApp)
function Message({ m, moderator, grouped, onDelete, onReport, onMute }) {
  const mine = m.mine;
  const canDelete = mine || moderator;
  const accent = m.author.role === 'creator' ? '#FF2028' : m.author.role === 'admin' ? '#eab308' : '#7DB5FF';
  const actions = (
    <div className="chat-actions" style={{ display: 'flex', gap: '0.25rem', alignItems: 'center', alignSelf: 'center', flexShrink: 0 }}>
      {!mine && (
        <button type="button" className="btn btn-ghost" title={m.reportedByMe ? 'You reported this' : 'Report this message'} aria-label="Report this message" disabled={m.reportedByMe} style={{ padding: '0.25rem 0.4rem', opacity: m.reportedByMe ? 0.4 : 1 }} onClick={() => onReport(m)}><Flag size={12} /></button>
      )}
      {moderator && !mine && m.author.role !== 'admin' && (
        <select aria-label={`Mute ${m.author.name}`} className="form-input" style={{ padding: '0.2rem 0.3rem', fontSize: '0.65rem', width: 'auto' }} value="" onChange={e => { if (e.target.value) onMute(m.author, Number(e.target.value)); }}>
          <option value="">Mute…</option>
          <option value="1">1 hour</option>
          <option value="24">24 hours</option>
          <option value="168">7 days</option>
        </select>
      )}
      {canDelete && <button type="button" className="btn btn-ghost" title="Delete message" aria-label="Delete message" style={{ padding: '0.25rem 0.4rem' }} onClick={() => onDelete(m)}><Trash2 size={12} /></button>}
    </div>
  );

  const bubble = (
    <div style={{
      maxWidth: 'min(72%, 560px)', minWidth: 0, padding: '0.45rem 0.7rem 0.3rem',
      background: mine ? '#3a1417' : '#1D1D1D', border: `1px solid ${mine ? '#5a1f23' : '#292929'}`,
      borderRadius: mine ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
    }}>
      {!mine && !grouped && (
        <div style={{ marginBottom: '0.15rem' }}>
          {m.author.role === 'creator'
            ? <Link to={`/learn/creator/${m.author.id}`} style={{ color: accent, textDecoration: 'none', fontWeight: 600, fontSize: '0.8rem' }}>{m.author.name}</Link>
            : <span style={{ color: accent, fontWeight: 600, fontSize: '0.8rem' }}>{m.author.name}</span>}
          {ROLE_BADGE[m.author.role] && <span className="mono" style={{ fontSize: '0.6rem', color: accent, border: `1px solid ${accent}`, padding: '0 0.3rem', marginLeft: '0.45rem' }}>{ROLE_BADGE[m.author.role][0]}</span>}
        </div>
      )}
      <div style={{ color: '#F1F1F1', fontSize: '0.9rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.text}</div>
      <div className="mono" style={{ fontSize: '0.6rem', color: '#8B8B8B', textAlign: 'right', marginTop: '0.1rem' }}>{timeLabel(m.createdAt)}</div>
    </div>
  );

  return (
    <div className="chat-row" style={{ display: 'flex', gap: '0.5rem', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', marginTop: grouped ? 2 : 10 }}>
      {mine && actions}
      {!mine && (grouped
        ? <div style={{ width: 30, flexShrink: 0 }} />
        : <Avatar name={m.author.name} url={m.author.avatarUrl} size={30} accent={m.author.role === 'creator'} style={{ borderRadius: '50%' }} />)}
      {bubble}
      {!mine && actions}
    </div>
  );
}

function ReportQueue({ onChanged }) {
  const { showNotification } = useApp();
  const [reports, setReports] = useState(null);

  const load = async () => { const r = await getChatReports(); if (r.success) setReports(r.reports); };
  useEffect(() => { getChatReports().then(r => { if (r.success) setReports(r.reports); }); }, []);

  const review = async (id, action) => {
    const r = await reviewChatMessage(id, action);
    if (!r.success) { showNotification(r.error, 'error'); return; }
    showNotification(action === 'delete' ? 'Message deleted.' : 'Reports dismissed.');
    await load(); onChanged();
  };
  const mute = async (author, hours) => {
    const r = await muteChatUser(author.id, hours);
    showNotification(r.success ? `${author.name} is muted for ${hours === 1 ? '1 hour' : hours === 24 ? '24 hours' : '7 days'}.` : r.error, r.success ? 'success' : 'error');
    await load();
  };

  return (
    <Panel title={`REPORTED MESSAGES${reports ? ` (${reports.length})` : ''}`} style={{ marginBottom: '1.5rem' }}>
      {!reports ? <div style={{ padding: '1.25rem' }}><div className="spinner" /></div> : reports.length === 0 ? (
        <div style={{ padding: '1.25rem', color: '#A0A0A0', fontSize: '0.85rem' }}>Nothing has been reported.</div>
      ) : reports.map(r => (
        <div key={r.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929' }}>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
            <AuthorName author={r.author} />
            <span className="badge badge-yellow" style={{ fontSize: '0.65rem' }}>{r.reportCount} REPORT{r.reportCount === 1 ? '' : 'S'}</span>
            {r.hidden && <span className="badge badge-red" style={{ fontSize: '0.65rem' }}>HIDDEN</span>}
            {r.author.mutedUntil && <span className="badge badge-grey" style={{ fontSize: '0.65rem' }}>MUTED</span>}
          </div>
          <div style={{ color: '#C8C8C8', fontSize: '0.9rem', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', marginBottom: '0.7rem' }}>{r.text}</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.65rem' }} onClick={() => review(r.id, 'dismiss')}>DISMISS REPORTS</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: '0.65rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => review(r.id, 'delete')}>DELETE MESSAGE</button>
            {r.author.role !== 'admin' && (
              <select aria-label={`Mute ${r.author.name}`} className="form-input" style={{ width: 'auto', fontSize: '0.7rem', padding: '0.3rem 0.5rem' }} value="" onChange={e => { if (e.target.value) mute(r.author, Number(e.target.value)); }}>
                <option value="">Mute author…</option>
                <option value="1">1 hour</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
              </select>
            )}
          </div>
        </div>
      ))}
    </Panel>
  );
}

export default function ChatPage() {
  const { currentUser, showNotification } = useApp();
  const moderator = currentUser.role === 'admin';
  const { messages, mutedUntil, hasMore, loading, error, send, loadOlder, refresh } = useChatRoom();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [problem, setProblem] = useState('');
  const [queueKey, setQueueKey] = useState(0);
  const scroller = useRef(null);
  const stickToBottom = useRef(true);

  // follow new messages unless the person has scrolled up to read older ones
  const onScroll = () => {
    const el = scroller.current;
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const submit = async (e) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setProblem('');
    const r = await send(body);
    setSending(false);
    if (r.success) { setText(''); stickToBottom.current = true; } else setProblem(r.error);
  };

  const onDelete = async (m) => {
    const r = await deleteChatMessage(m.id);
    if (!r.success) { showNotification(r.error, 'error'); return; }
    refresh();
  };
  const onReport = async (m) => {
    const r = await reportChatMessage(m.id);
    showNotification(r.success ? 'Thanks. The report was sent to the admins.' : r.error, r.success ? 'success' : 'error');
    refresh();
    setQueueKey(k => k + 1);
  };
  const onMute = async (author, hours) => {
    const r = await muteChatUser(author.id, hours);
    showNotification(r.success ? `${author.name} is muted.` : r.error, r.success ? 'success' : 'error');
    setQueueKey(k => k + 1);
  };

  const muted = mutedUntil && mutedUntil > Date.now();

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 900 }}>
      <PageHeader label="COMMUNITY" title="DISCUSSION" subtitle="Talk with other learners and creators. Everyone who is signed in can read and write here." />

      <div style={{ background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #eab308', padding: '0.7rem 1rem', marginBottom: '1rem', fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6 }}>
        Be respectful and stay on topic. Do not share course videos, other people's personal details or spam. Messages are plain text and visible to everyone signed in; use the flag to report a message.
        See the <Link to="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#FF2028' }}>Terms</Link>.
      </div>

      {moderator && <ReportQueue key={queueKey} onChanged={refresh} />}

      <Panel>
        <div ref={scroller} onScroll={onScroll} role="log" aria-live="polite" aria-label="Discussion messages" style={{ height: 'min(55vh, 520px)', overflowY: 'auto', padding: '0.75rem 1rem' }}>
          {loading && <div className="spinner" style={{ margin: '1rem auto' }} />}
          {error && <div role="alert" style={{ color: '#FF2028', fontSize: '0.8rem', padding: '0.5rem 0' }}>⊗ {error}</div>}
          {hasMore && <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', display: 'flex', margin: '0 auto 0.75rem' }} onClick={loadOlder}><ChevronUp size={12} /> LOAD OLDER MESSAGES</button>}
          {!loading && !error && messages.length === 0 && <div style={{ color: '#8B8B8B', textAlign: 'center', padding: '3rem 1rem', fontSize: '0.9rem' }}>No messages yet. Say hello!</div>}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const day = dayLabel(m.createdAt);
            const newDay = i === 0 || day !== dayLabel(prev.createdAt);
            const grouped = !newDay && prev.author.id === m.author.id && Date.parse(m.createdAt) - Date.parse(prev.createdAt) < 5 * 60_000;
            return (
              <div key={m.id}>
                {newDay && <div className="mono" style={{ textAlign: 'center', margin: '0.9rem 0 0.3rem' }}><span style={{ fontSize: '0.65rem', color: '#8B8B8B', background: '#1D1D1D', border: '1px solid #292929', padding: '0.15rem 0.6rem', borderRadius: 10 }}>{day.toUpperCase()}</span></div>}
                <Message m={m} moderator={moderator} grouped={grouped} onDelete={onDelete} onReport={onReport} onMute={onMute} />
              </div>
            );
          })}
        </div>

        <form onSubmit={submit} style={{ borderTop: '1px solid #292929', padding: '0.85rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {muted && (
            <div role="alert" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: '#eab308', fontSize: '0.8rem' }}>
              <ShieldAlert size={14} /> You are muted until {new Date(mutedUntil).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}. You can still read the discussion.
            </div>
          )}
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-end' }}>
            <textarea
              className="form-input" rows={2} style={{ flex: 1, resize: 'vertical' }} maxLength={MAX_CHARS} disabled={muted} aria-label="Write a message"
              placeholder={muted ? 'You are muted' : 'Write a message… (Enter to send, Shift+Enter for a new line)'}
              value={text} onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
            />
            <button type="submit" className="btn btn-primary" style={{ fontSize: '0.75rem' }} disabled={muted || sending || !text.trim()}><Send size={13} /> SEND</button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.7rem' }}>
            <span style={{ color: '#FF2028' }} role="alert">{problem}</span>
            <span className="mono" style={{ color: text.length > MAX_CHARS - 50 ? '#eab308' : '#8B8B8B' }}>{text.length}/{MAX_CHARS}</span>
          </div>
        </form>
      </Panel>
    </div>
  );
}
