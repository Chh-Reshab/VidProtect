// ============================================
// AUTH — JWT access tokens + rotating refresh sessions
//   access token : 15 min, sent as `Authorization: Bearer`, kept in memory by the SPA
//   refresh token: httpOnly SameSite=Strict cookie, stored hashed, rotated on every use;
//                  presenting an old one revokes the session (token-theft signal)
// ============================================

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { db, save, uid } from './db.js';
import { sha256 } from './util.js';
import { isCreatorLocked } from '../src/auth/permissions.js';

const isProd = process.env.NODE_ENV === 'production';

if (isProd && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}
const secret = () => process.env.JWT_SECRET || db.meta.jwtSecret;

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_DAYS = 14;
const COOKIE = 'vp_refresh';

export const toPublic = (u) => {
  if (!u) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, emailVerification, passwordReset, mfa, ...rest } = u;
  rest.mfaEnabled = !!mfa?.enabled;
  if (rest.profile?.avatar) rest.profile = { ...rest.profile, avatarUrl: `/api/avatars/${rest.profile.avatar}` };
  if (rest.creatorApplication?.cv) {
    const { name: _stored, ...cv } = rest.creatorApplication.cv; // the stored file name is internal
    rest.creatorApplication = { ...rest.creatorApplication, cv };
  }
  return rest;
};


// Short-lived proof that the password step passed; only good for the two-step verification route
export const signMfaToken = (user) => jwt.sign({ purpose: 'mfa' }, secret(), { subject: user.id, expiresIn: 300, algorithm: 'HS256' });
export const readMfaToken = (token) => {
  try {
    const claims = jwt.verify(String(token || ''), secret(), { algorithms: ['HS256'] });
    return claims.purpose === 'mfa' ? db.users.find(u => u.id === claims.sub && u.status === 'active') || null : null;
  } catch { return null; }
};

export const signAccess = (user, sid) =>
  jwt.sign({ role: user.role, sid }, secret(), { subject: user.id, expiresIn: ACCESS_TTL_SECONDS, algorithm: 'HS256' });

// ── Sessions ──────────────────────────────────
export const createSession = (user, req) => {
  const sid = uid('ses');
  const token = crypto.randomBytes(32).toString('hex');
  db.sessions.push({
    id: sid,
    userId: user.id,
    hash: sha256(token),
    userAgent: (req.get('user-agent') || '').slice(0, 200),
    ip: req.ip,
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400000).toISOString(),
    revokedAt: null,
  });
  // keep the table small
  db.sessions = db.sessions
    .filter(s => !s.revokedAt || Date.now() - new Date(s.revokedAt) < 86400000)
    .slice(-500);
  save();
  return { sid, cookieValue: `${sid}.${token}` };
};

export const setRefreshCookie = (res, value) => {
  res.cookie(COOKIE, value, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isProd,
    path: '/api/auth',
    maxAge: REFRESH_DAYS * 86400000,
  });
};

export const clearRefreshCookie = (res) => res.clearCookie(COOKIE, { path: '/api/auth' });

export const revokeSession = (sid) => {
  const s = db.sessions.find(x => x.id === sid);
  if (s && !s.revokedAt) { s.revokedAt = new Date().toISOString(); save(); }
};

export const revokeAllSessions = (userId, exceptSid) => {
  db.sessions.forEach(s => {
    if (s.userId === userId && s.id !== exceptSid && !s.revokedAt) s.revokedAt = new Date().toISOString();
  });
  save();
};

// Validate + rotate the refresh cookie. Returns { user, sid, cookieValue } or null.
export const rotateRefresh = (req) => {
  const raw = req.cookies?.[COOKIE];
  if (!raw || !raw.includes('.')) return null;
  const [sid, token] = raw.split('.');
  const s = db.sessions.find(x => x.id === sid);
  if (!s || s.revokedAt || new Date(s.expiresAt) < new Date()) return null;

  const a = Buffer.from(sha256(token || ''));
  const b = Buffer.from(s.hash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    revokeSession(sid); // reuse of an old or forged token
    return null;
  }
  const user = db.users.find(u => u.id === s.userId);
  if (!user || user.status !== 'active') { revokeSession(sid); return null; }

  const next = crypto.randomBytes(32).toString('hex');
  s.hash = sha256(next);
  s.lastUsedAt = new Date().toISOString();
  save();
  return { user, sid, cookieValue: `${sid}.${next}` };
};

// ── Middleware ────────────────────────────────
// `allowLocked`: creators whose application is not approved yet may only reach the routes that
// pass true (their own application, their profile data, password change)
const authenticate = (allowLocked) => (req, res, next) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sign in required.' });
  try {
    const claims = jwt.verify(token, secret(), { algorithms: ['HS256'] });
    const user = db.users.find(u => u.id === claims.sub);
    const session = db.sessions.find(s => s.id === claims.sid && !s.revokedAt);
    // Role and status come from the DB on every request, never from the token,
    // so a suspension or role change takes effect immediately.
    if (!user || !session || user.status !== 'active') return res.status(401).json({ error: 'Sign in required.' });
    if (!allowLocked && isCreatorLocked(user)) {
      return res.status(403).json({ error: 'Your creator account is waiting for approval.', code: 'CREATOR_NOT_APPROVED' });
    }
    req.user = user;
    req.sid = claims.sid;
    return next();
  } catch {
    return res.status(401).json({ error: 'Sign in required.' });
  }
};

export const requireAuth = authenticate(false);
export const requireAuthAllowLocked = authenticate(true);

export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ error: 'You do not have access to this.' });
