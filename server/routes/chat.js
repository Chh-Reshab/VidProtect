// ============================================
// /api/chat — one community discussion room for every learner, creator and admin.
//   GET    /chat?v=N            the latest messages (or { unchanged: true } when nothing changed since version N)
//   GET    /chat/older?before=  earlier messages
//   POST   /chat                post a message (plain text, 500 characters)
//   DELETE /chat/:id            delete your own message (an admin can delete any)
//   POST   /chat/:id/report     report a message; enough reports hide it until an admin looks
//   admin: GET /chat/reports, POST /chat/:id/review, POST /chat/mute/:userId
// The page polls a few seconds apart, so it works on any host without special connections.
// Messages are plain text and never contain HTML or clickable links; authors are shown by name,
// role and picture only (never an email address).
// ============================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, save, uid } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { audit, findUser } from '../access.js';

const router = Router();
router.use(requireAuth);

const MAX_CHARS = 500;
const PAGE = 100;
const num = (name, fallback) => (process.env[name] !== undefined && process.env[name] !== '' ? Number(process.env[name]) : fallback);
const LIMIT = () => num('CHAT_LIMIT', 2000);              // messages kept (the newest)
const MIN_GAP_MS = () => num('CHAT_MIN_GAP_MS', 1500);     // pause between two messages from one person
const REPEAT_MS = () => num('CHAT_REPEAT_MS', 60_000);     // the same text twice in this time is refused
const HIDE_AT = () => num('CHAT_HIDE_AT', 3);              // reports that hide a message until an admin reviews it
const MUTE_HOURS = [0, 1, 24, 168, 720];                   // 0 = lift a mute

let version = Date.now(); // changes whenever the room changes, so the page only downloads when needed
const touch = () => { version += 1; };

const perMinute = rateLimit({
  windowMs: 60_000,
  limit: () => num('CHAT_PER_MINUTE', 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => req.user.id,
  validate: { keyGeneratorIpFallback: false },
  message: { error: 'You are sending messages too fast. Wait a moment.' },
});

const authorOf = (id) => {
  const u = db.users.find(x => x.id === id);
  return u
    ? { id: u.id, name: u.name, role: u.role, avatarUrl: u.profile?.avatar ? `/api/avatars/${u.profile.avatar}` : null }
    : { id, name: 'Former member', role: 'learner', avatarUrl: null };
};

const view = (m, me) => ({
  id: m.id,
  text: m.text,
  createdAt: m.createdAt,
  author: authorOf(m.userId),
  mine: m.userId === me.id,
  reportedByMe: (m.reports || []).includes(me.id),
});

const visible = () => db.chat.filter(m => !m.hidden);
const mutedUntil = (user) => (user.chatMutedUntil && user.chatMutedUntil > Date.now() ? user.chatMutedUntil : null);

router.get('/', (req, res) => {
  if (String(req.query.v) === String(version)) return res.json({ unchanged: true, v: version });
  const list = visible();
  res.json({
    v: version,
    messages: list.slice(0, PAGE).reverse().map(m => view(m, req.user)), // oldest first, for reading top to bottom
    hasMore: list.length > PAGE,
    mutedUntil: mutedUntil(req.user),
  });
});

router.get('/older', (req, res) => {
  const list = visible();
  const index = list.findIndex(m => m.id === req.query.before);
  if (index < 0) return res.json({ messages: [], hasMore: false });
  const page = list.slice(index + 1, index + 1 + PAGE);
  res.json({ messages: page.reverse().map(m => view(m, req.user)), hasMore: list.length > index + 1 + PAGE });
});

router.post('/', perMinute, (req, res) => {
  const user = req.user;
  const until = mutedUntil(user);
  if (until) return res.status(403).json({ error: `You are muted in the discussion until ${new Date(until).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.`, mutedUntil: until });

  const raw = typeof req.body?.text === 'string' ? req.body.text : '';
  // plain text only: no control characters, no runs of blank lines
  // eslint-disable-next-line no-control-regex
  const text = raw.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) return res.status(400).json({ error: 'Write a message first.' });
  if (text.length > MAX_CHARS) return res.status(400).json({ error: `Messages can be at most ${MAX_CHARS} characters.` });

  const now = Date.now();
  const recent = db.chat.find(m => m.userId === user.id);
  if (recent && now - Date.parse(recent.createdAt) < MIN_GAP_MS()) return res.status(429).json({ error: 'You are sending messages too fast. Wait a moment.' });
  if (db.chat.some(m => m.userId === user.id && m.text === text && now - Date.parse(m.createdAt) < REPEAT_MS())) {
    return res.status(409).json({ error: 'You already sent that.' });
  }

  const message = { id: uid('msg'), userId: user.id, text, createdAt: new Date(now).toISOString(), reports: [] };
  db.chat.unshift(message);
  db.chat = db.chat.slice(0, LIMIT());
  touch();
  save();
  res.status(201).json({ message: view(message, user), v: version });
});

router.delete('/:id', (req, res) => {
  const message = db.chat.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  const isAdmin = req.user.role === 'admin';
  if (message.userId !== req.user.id && !isAdmin) return res.status(403).json({ error: 'You can only delete your own messages.' });
  db.chat = db.chat.filter(m => m.id !== message.id);
  touch();
  save();
  if (isAdmin && message.userId !== req.user.id) audit(req.user.id, 'chat.delete', 'message', message.id, { authorId: message.userId });
  res.json({ success: true, v: version });
});

router.post('/:id/report', (req, res) => {
  const message = db.chat.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  if (message.userId === req.user.id) return res.status(400).json({ error: 'You cannot report your own message.' });
  message.reports ||= [];
  if (!message.reports.includes(req.user.id)) {
    message.reports.push(req.user.id);
    if (message.reports.length >= HIDE_AT()) message.hidden = true; // hidden for everyone until an admin decides
    touch();
    save();
  }
  res.json({ success: true });
});

// ── admin ──
const admin = requireRole('admin');

router.get('/reports', admin, (req, res) => {
  const reported = db.chat.filter(m => (m.reports || []).length > 0);
  res.json({
    reports: reported.map(m => ({
      id: m.id, text: m.text, createdAt: m.createdAt, hidden: !!m.hidden, reportCount: m.reports.length,
      author: { ...authorOf(m.userId), mutedUntil: mutedUntil(findUser(m.userId) || {}) },
    })),
  });
});

router.post('/:id/review', admin, (req, res) => {
  const message = db.chat.find(m => m.id === req.params.id);
  if (!message) return res.status(404).json({ error: 'Message not found.' });
  const action = req.body?.action;
  if (action === 'dismiss') { message.reports = []; delete message.hidden; } // the message is fine: show it again
  else if (action === 'delete') db.chat = db.chat.filter(m => m.id !== message.id);
  else return res.status(400).json({ error: 'Choose dismiss or delete.' });
  touch();
  save();
  audit(req.user.id, action === 'delete' ? 'chat.delete' : 'chat.dismiss', 'message', message.id, { authorId: message.userId });
  res.json({ success: true });
});

router.post('/mute/:userId', admin, (req, res) => {
  const target = findUser(req.params.userId);
  if (!target) return res.status(404).json({ error: 'User not found.' });
  if (target.id === req.user.id) return res.status(400).json({ error: 'You cannot mute yourself.' });
  if (target.role === 'admin') return res.status(400).json({ error: 'Admins cannot be muted.' });
  const hours = Number(req.body?.hours);
  if (!MUTE_HOURS.includes(hours)) return res.status(400).json({ error: 'Choose 0 (unmute), 1, 24, 168 or 720 hours.' });
  if (hours === 0) delete target.chatMutedUntil; else target.chatMutedUntil = Date.now() + hours * 3_600_000;
  save();
  audit(req.user.id, hours === 0 ? 'chat.unmute' : 'chat.mute', 'user', target.id, { hours });
  res.json({ success: true, mutedUntil: mutedUntil(target) });
});

export default router;
