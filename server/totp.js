// ============================================
// Two-step verification (TOTP, RFC 6238): the 6-digit codes of an authenticator app.
// Secrets are stored encrypted with the master key; recovery codes are stored hashed.
// ============================================

import crypto from 'node:crypto';
import { getMasterKey } from './encryption.js';
import { sha256 } from './util.js';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const STEP_MS = 30_000;

const toBase32 = (buf) => {
  let bits = 0; let value = 0; let out = '';
  for (const byte of buf) {
    value = (value << 8) | byte; bits += 8;
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
};

const fromBase32 = (text) => {
  let bits = 0; let value = 0; const out = [];
  for (const ch of text.replace(/=+$/, '').toUpperCase()) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error('bad base32');
    value = (value << 5) | i; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out);
};

export const newSecret = () => toBase32(crypto.randomBytes(20));

const codeFor = (key, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const h = crypto.createHmac('sha1', key).update(counter).digest();
  const o = h[19] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
};

export const totpAt = (secret, time = Date.now()) => codeFor(fromBase32(secret), Math.floor(time / STEP_MS));

// Returns the time step the code belongs to (one step either side is allowed for clock drift), or null
export const verifyTotp = (secret, code, time = Date.now()) => {
  const given = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(given)) return null;
  const key = fromBase32(secret);
  const now = Math.floor(time / STEP_MS);
  for (const drift of [0, -1, 1]) {
    const expected = codeFor(key, now + drift);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return now + drift;
  }
  return null;
};

export const otpauthUrl = (secret, account, issuer = 'VidProtect AI') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

// ── secrets at rest ──
const sealKey = (key = getMasterKey()) => crypto.createHash('sha256').update('mfa-secret').update(key).digest();
export const sealSecret = (secret, key) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', sealKey(key), iv);
  const ct = Buffer.concat([c.update(secret, 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString('base64');
};
export const openSecret = (sealed, key) => {
  const raw = Buffer.from(sealed, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', sealKey(key), raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString('utf8');
};

// ── recovery codes: shown once, kept as hashes, each works once ──
export const newRecoveryCodes = (count = 10) => Array.from({ length: count }, () => {
  const hex = crypto.randomBytes(5).toString('hex');
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
});
export const hashRecovery = (code) => sha256(String(code || '').trim().toLowerCase().replace(/\s/g, ''));
