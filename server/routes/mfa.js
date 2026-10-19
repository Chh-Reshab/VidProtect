// ============================================
// /api/auth/mfa — two-step verification with an authenticator app (TOTP) and recovery codes.
//   POST /setup           start: returns the secret and a QR code (nothing is on yet)
//   POST /enable          confirm with a first code: turns it on and returns 10 recovery codes (shown once)
//   POST /disable         needs the password and a code
//   POST /recovery-codes  new recovery codes (needs the password and a code)
//   POST /login           second step of signing in (after the password step answered mfaRequired)
// ============================================

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { save } from '../db.js';
import {
  requireAuthAllowLocked, readMfaToken, createSession, setRefreshCookie, signAccess, toPublic,
} from '../auth.js';
import { newSecret, verifyTotp, otpauthUrl, sealSecret, openSecret, newRecoveryCodes, hashRecovery } from '../totp.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT || 30),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in a few minutes.' },
});

const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

// Checks an authenticator code or a recovery code for someone who has two-step verification on.
// A code works once (a replayed code is refused), and five wrong tries lock it for 15 minutes.
// Returns true, false, or 'locked'.
const checkSecondFactor = (user, code) => {
  const mfa = user.mfa;
  if (!mfa?.enabled) return false;
  if (mfa.lockUntil && mfa.lockUntil > Date.now()) return 'locked';
  const text = String(code || '').trim();
  let good = false;
  const step = verifyTotp(openSecret(mfa.secret), text);
  if (step !== null && step > (mfa.lastStep || 0)) {
    mfa.lastStep = step;
    good = true;
  } else {
    const index = mfa.recovery.indexOf(hashRecovery(text));
    if (index >= 0) { mfa.recovery.splice(index, 1); good = true; }
  }
  if (good) {
    mfa.fails = 0;
    delete mfa.lockUntil;
  } else {
    mfa.fails = (mfa.fails || 0) + 1;
    if (mfa.fails >= MAX_FAILS) { mfa.lockUntil = Date.now() + LOCK_MS; mfa.fails = 0; }
  }
  save();
  return good;
};

// "Is this really the account holder?" for sensitive actions: the password, plus a code when two-step is on.
// Returns null when fine, otherwise { status, error }.
export const confirmIdentity = async (user, { password, code } = {}) => {
  if (typeof password !== 'string' || !(await bcrypt.compare(password, user.passwordHash))) return { status: 400, error: 'Your password is not correct.' };
  if (user.mfa?.enabled) {
    const result = checkSecondFactor(user, code);
    if (result === 'locked') return { status: 429, error: 'Too many wrong codes. Try again in 15 minutes.' };
    if (!result) return { status: 400, error: 'That verification code is not right.' };
  }
  return null;
};

router.post('/login', limiter, (req, res) => {
  const user = readMfaToken(req.body?.mfaToken);
  if (!user) return res.status(401).json({ error: 'Your sign-in expired. Please sign in again.', code: 'MFA_EXPIRED' });
  if (user.status === 'suspended') return res.status(403).json({ error: 'This account is suspended. Contact support.' });
  const result = checkSecondFactor(user, req.body?.code);
  if (result === 'locked') return res.status(429).json({ error: 'Too many wrong codes. Try again in 15 minutes.' });
  if (!result) return res.status(401).json({ error: 'That code is not right. Try the newest code in your app, or a recovery code.' });
  const { sid, cookieValue } = createSession(user, req);
  setRefreshCookie(res, cookieValue);
  res.json({ accessToken: signAccess(user, sid), user: toPublic(user) });
});

router.post('/setup', requireAuthAllowLocked, limiter, async (req, res) => {
  const user = req.user;
  if (user.mfa?.enabled) return res.status(409).json({ error: 'Two-step verification is already on.' });
  const secret = newSecret();
  user.mfa = { pending: sealSecret(secret) };
  save();
  const url = otpauthUrl(secret, user.email);
  const { default: QRCode } = await import('qrcode');
  res.json({ secret, otpauthUrl: url, qr: await QRCode.toDataURL(url, { margin: 1, width: 220 }) });
});

router.post('/enable', requireAuthAllowLocked, limiter, (req, res) => {
  const user = req.user;
  if (user.mfa?.enabled) return res.status(409).json({ error: 'Two-step verification is already on.' });
  if (!user.mfa?.pending) return res.status(400).json({ error: 'Start the setup first.' });
  const step = verifyTotp(openSecret(user.mfa.pending), req.body?.code);
  if (step === null) return res.status(400).json({ error: 'That code is not right. Check the newest code in your app.' });
  const codes = newRecoveryCodes();
  user.mfa = { enabled: true, secret: user.mfa.pending, lastStep: step, recovery: codes.map(hashRecovery), enabledAt: new Date().toISOString() };
  save();
  res.json({ success: true, recoveryCodes: codes });
});

router.post('/disable', requireAuthAllowLocked, limiter, async (req, res) => {
  const user = req.user;
  if (!user.mfa?.enabled) return res.status(400).json({ error: 'Two-step verification is not on.' });
  const problem = await confirmIdentity(user, req.body);
  if (problem) return res.status(problem.status).json({ error: problem.error });
  delete user.mfa;
  save();
  res.json({ success: true });
});

router.post('/recovery-codes', requireAuthAllowLocked, limiter, async (req, res) => {
  const user = req.user;
  if (!user.mfa?.enabled) return res.status(400).json({ error: 'Two-step verification is not on.' });
  const problem = await confirmIdentity(user, req.body);
  if (problem) return res.status(problem.status).json({ error: problem.error });
  const codes = newRecoveryCodes();
  user.mfa.recovery = codes.map(hashRecovery);
  save();
  res.json({ success: true, recoveryCodes: codes });
});

export default router;
