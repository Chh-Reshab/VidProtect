// ============================================
// /api/auth — register, login, refresh, logout, password, creator application
// ============================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, save, uid } from '../db.js';
import { validateRegistration, validatePassword, validateEmail } from '../../shared/validation.js';
import {
  toPublic, signAccess, createSession, setRefreshCookie, clearRefreshCookie,
  rotateRefresh, revokeSession, revokeAllSessions, requireAuth,
} from '../auth.js';

const router = Router();

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Slow down password guessing per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// Compared against when the email is unknown, so timing doesn't reveal which emails exist
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/register', authLimiter, async (req, res) => {
  const { values, errors } = validateRegistration({ name: req.body?.name, email: req.body?.email, password: req.body?.password });
  const { name, email, password } = values;
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });
  if (db.users.some(u => u.email.toLowerCase() === email)) {
    return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'An account with this email already exists.' } });
  }

  // Everyone starts as a learner; creator access needs admin approval
  db.users.push({
    id: uid('usr'),
    name,
    email,
    role: 'learner',
    status: 'active',
    passwordHash: await bcrypt.hash(password, 12),
    joinDate: new Date().toISOString().slice(0, 10),
  });
  save();
  res.status(201).json({ success: true, message: 'Account created. You can now sign in.' });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 1000) : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.users.find(u => u.email.toLowerCase() === email);

  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password.' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact support.' });

  const { sid, cookieValue } = createSession(user, req);
  setRefreshCookie(res, cookieValue);
  res.json({ accessToken: signAccess(user, sid), user: toPublic(user) });
});

// Restores a session from the httpOnly cookie and rotates it
router.post('/refresh', (req, res) => {
  const result = rotateRefresh(req);
  if (!result) {
    clearRefreshCookie(res);
    return res.status(401).json({ error: 'Session expired.' });
  }
  setRefreshCookie(res, result.cookieValue);
  res.json({ accessToken: signAccess(result.user, result.sid), user: toPublic(result.user) });
});

router.post('/logout', (req, res) => {
  const raw = req.cookies?.vp_refresh;
  if (raw?.includes('.')) revokeSession(raw.split('.')[0]);
  clearRefreshCookie(res);
  res.json({ success: true });
});

router.post('/change-password', requireAuth, authLimiter, async (req, res) => {
  const current = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const next = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!(await bcrypt.compare(current, req.user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect.' });
  }
  const check = validatePassword(next, { name: req.user.name, email: req.user.email });
  if (check.error) return res.status(400).json({ error: check.error });
  if (next === current) return res.status(400).json({ error: 'The new password must be different from the current one.' });
  req.user.passwordHash = await bcrypt.hash(next, 12);
  save();
  revokeAllSessions(req.user.id, req.sid); // sign out every other device
  res.json({ success: true });
});

// A learner applies to become a creator; an admin reviews it
router.post('/creator-apply', requireAuth, (req, res) => {
  const user = req.user;
  if (user.role !== 'learner') return res.status(400).json({ error: 'Only learners can apply.' });
  if (user.creatorStatus === 'pending') return res.status(400).json({ error: 'Your application is already pending.' });
  const displayName = clean(req.body?.displayName, 60);
  const bio = clean(req.body?.bio, 1000);
  if (!displayName || !bio) return res.status(400).json({ error: 'Display name and bio are required.' });
  user.creatorStatus = 'pending';
  user.creatorProfile = { displayName, bio };
  save();
  res.json({ success: true, user: toPublic(user) });
});

export default router;
