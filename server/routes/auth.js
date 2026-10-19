// ============================================
// /api/auth — register, login, refresh, logout, password, creator application
// ============================================

import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { db, save, uid } from '../db.js';
import { clean, sha256 } from '../util.js';
import { verificationRequired, emailAvailable, sendVerificationEmail, sendPasswordResetEmail, appUrl } from '../mail.js';
import { confirmIdentity } from './mfa.js';
import { removeUsers } from '../accountData.js';
import { audit } from '../access.js';
import { validateRegistration, validatePassword, validateEmail } from '../../shared/validation.js';
import {
  toPublic, signAccess, signMfaToken, createSession, setRefreshCookie, clearRefreshCookie,
  rotateRefresh, revokeSession, revokeAllSessions, requireAuthAllowLocked,
} from '../auth.js';

const router = Router();


// Slow down password guessing per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

// Compared against when the email is unknown, so timing doesn't reveal which emails exist
const DUMMY_HASH = '$2b$12$aSGUgjKTXJ48wDH412OFVe3ypaYr5gg86s5glPEHoiYh3LBwJ2.la'; // a valid cost-12 hash of a random string

// ── Email verification ───────────────────────
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;

// Creates a fresh single-use link for the user (only a hash of the token is stored) and emails it
const sendVerification = async (user, req) => {
  const token = crypto.randomBytes(32).toString('hex');
  user.emailVerification = { hash: sha256(token), expires: Date.now() + VERIFY_TTL_MS, sentAt: Date.now() };
  save();
  await sendVerificationEmail({ to: user.email, name: user.name, link: `${appUrl(req)}/verify-email?token=${token}` });
};

const register = (role) => async (req, res) => {
  const { values, errors } = validateRegistration({ name: req.body?.name, email: req.body?.email, password: req.body?.password });
  const { name, email, password } = values;
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });
  const needsVerification = verificationRequired();
  const existing = db.users.find(u => u.email.toLowerCase() === email);
  if (existing && existing.emailVerified !== false) {
    return res.status(409).json({ error: 'An account with this email already exists.', fields: { email: 'An account with this email already exists.' } });
  }

  // Never verified: nobody owns this address yet, so signing up again just replaces the pending account
  // (this also stops someone from blocking an email address by registering it without confirming)
  const user = existing || { id: uid('usr'), email, role, status: 'active', joinDate: new Date().toISOString().slice(0, 10) };
  user.name = name;
  user.role = role;
  // Creators start locked: they must submit an application and wait for an admin before the studio opens
  if (role === 'creator') user.creatorStatus = 'unsubmitted';
  else { delete user.creatorStatus; delete user.creatorApplication; }
  user.passwordHash = await bcrypt.hash(password, 12);
  if (needsVerification) user.emailVerified = false;
  if (!existing) db.users.push(user);
  save();

  if (!needsVerification) return res.status(201).json({ success: true, needsVerification: false, message: 'Account created. You can now sign in.' });
  try {
    await sendVerification(user, req);
    res.status(201).json({ success: true, needsVerification: true, message: `Account created. We sent a verification link to ${email}. Open it, then sign in.` });
  } catch (err) {
    console.error(`[mail] Could not send the verification email to ${email}: ${err.message}`);
    res.status(201).json({ success: true, needsVerification: true, message: 'Account created, but the verification email could not be sent. Use "Resend verification email" on the sign-in page in a moment.' });
  }
};

router.post('/register', authLimiter, register('learner'));
// Creators have their own sign-up. They can learn too, but the studio stays locked until an admin approves them
router.post('/creator/register', authLimiter, register('creator'));

router.post('/verify-email', authLimiter, (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const hash = token.length === 64 ? sha256(token) : null;
  const user = hash && db.users.find(u => u.emailVerification?.hash === hash);
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has already been used.' });
  if (user.emailVerification.expires < Date.now()) {
    return res.status(400).json({ error: 'This verification link has expired. Sign in to request a new one.', code: 'EXPIRED' });
  }
  user.emailVerified = true;
  delete user.emailVerification;
  save();
  res.json({ success: true, message: user.role === 'creator' ? 'Email verified. Sign in on the creator login to complete your application.' : 'Email verified. You can now sign in.', portal: user.role === 'creator' ? 'creator' : 'learner' });
});

// Same answer whether or not the address exists, so this can't be used to discover accounts
router.post('/resend-verification', authLimiter, async (req, res) => {
  const reply = { success: true, message: 'If that account exists and is not verified yet, we sent a new link.' };
  const { value: email, error } = validateEmail(req.body?.email);
  if (error) return res.status(400).json({ error });
  const user = db.users.find(u => u.email.toLowerCase() === email);
  if (!user || user.emailVerified !== false) return res.json(reply);
  if (user.emailVerification?.sentAt && Date.now() - user.emailVerification.sentAt < RESEND_COOLDOWN_MS) {
    return res.status(429).json({ error: 'A link was just sent. Wait a minute before asking for another.' });
  }
  try { await sendVerification(user, req); } catch (err) { console.error(`[mail] Could not send the verification email to ${email}: ${err.message}`); }
  res.json(reply);
});

// What the sign-in pages may offer (the "forgot password" link needs email to work)
router.get('/options', (req, res) => res.json({ passwordReset: emailAvailable() }));

// ── Forgotten password ───────────────────────
const RESET_TTL_MS = 60 * 60 * 1000;

// Always the same answer, so this cannot be used to find out who has an account
router.post('/forgot-password', authLimiter, (req, res) => {
  if (!emailAvailable()) return res.status(503).json({ error: 'Password reset by email is not set up on this site yet. Ask an admin for help.' });
  const { value: email, error } = validateEmail(req.body?.email);
  if (error) return res.status(400).json({ error });
  const user = db.users.find(u => u.email.toLowerCase() === email);
  if (user && user.status !== 'suspended' && !(user.passwordReset?.sentAt && Date.now() - user.passwordReset.sentAt < RESEND_COOLDOWN_MS)) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordReset = { hash: sha256(token), expires: Date.now() + RESET_TTL_MS, sentAt: Date.now() };
    save();
    // not awaited: the answer takes the same time whether or not the account exists
    sendPasswordResetEmail({ to: user.email, name: user.name, link: `${appUrl(req)}/reset-password?token=${token}` })
      .catch(err => console.error(`[mail] Could not send the password reset email to ${email}: ${err.message}`));
  }
  res.json({ success: true, message: 'If an account exists for that email, we sent a link to reset the password.' });
});

router.post('/reset-password', authLimiter, async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const hash = token.length === 64 ? sha256(token) : null;
  const user = hash && db.users.find(u => u.passwordReset?.hash === hash);
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
  if (user.passwordReset.expires < Date.now()) return res.status(400).json({ error: 'This reset link has expired. Ask for a new one.', code: 'EXPIRED' });
  const check = validatePassword(req.body?.password, { name: user.name, email: user.email });
  if (check.error) return res.status(400).json({ error: check.error, fields: { password: check.error } });
  user.passwordHash = await bcrypt.hash(check.value, 12);
  delete user.passwordReset;
  if (user.emailVerified === false) { user.emailVerified = true; delete user.emailVerification; } // they just proved they own the inbox
  save();
  revokeAllSessions(user.id); // every device is signed out
  res.json({ success: true, message: 'Password updated. Sign in with your new password.', portal: user.role === 'creator' ? 'creator' : 'learner' });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = clean(req.body?.email, 254).toLowerCase();
  const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 1000) : '';
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = db.users.find(u => u.email.toLowerCase() === email);

  const ok = await bcrypt.compare(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !ok) return res.status(401).json({ error: 'Invalid email or password.' });
  const portal = req.body?.portal;
  if (portal === 'creator' && user.role !== 'creator') {
    return res.status(403).json({ error: 'This is the creator sign-in. Learners and admins sign in on the main login page.', code: 'WRONG_PORTAL' });
  }
  if (portal === 'learner' && user.role === 'creator') {
    return res.status(403).json({ error: 'This is a creator account. Sign in on the creator login page.', code: 'WRONG_PORTAL' });
  }
  if (user.emailVerified === false) {
    return res.status(403).json({ error: 'Verify your email address first. Check your inbox for the link.', code: 'EMAIL_NOT_VERIFIED' });
  }
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact support.' });
  if (user.mfa?.enabled) return res.json({ mfaRequired: true, mfaToken: signMfaToken(user) }); // the second step finishes the sign-in

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

router.post('/change-password', requireAuthAllowLocked, authLimiter, async (req, res) => {
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

// Deletes the account and everything that belongs to it. Needs the password (and a code if two-step is on).
router.delete('/account', requireAuthAllowLocked, authLimiter, async (req, res) => {
  const user = req.user;
  const problem = await confirmIdentity(user, req.body);
  if (problem) return res.status(problem.status).json({ error: problem.error });
  if (user.role === 'admin' && !db.users.some(u => u.id !== user.id && u.role === 'admin' && u.status === 'active')) {
    return res.status(400).json({ error: 'You are the only admin. Make someone else an admin first.' });
  }
  if (user.role === 'creator') {
    const live = db.courses.filter(c => c.creatorId === user.id && c.status === 'active' && db.enrollments.some(e => e.courseId === c.id && e.studentId !== user.id));
    if (live.length) {
      return res.status(409).json({ error: `${live.length === 1 ? 'One of your published courses has' : `${live.length} of your published courses have`} learners enrolled. Unpublish ${live.length === 1 ? 'it' : 'them'} first, or ask an admin to remove your account.` });
    }
  }
  const id = user.id;
  await removeUsers(new Set([id]));
  audit('deleted-user', 'account.delete', 'user', 'deleted-user', { role: user.role });
  clearRefreshCookie(res);
  res.json({ success: true });
});

export default router;
