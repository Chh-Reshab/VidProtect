// ============================================
// DB — tiny JSON-file store (no native deps).
// One object in memory, written atomically on every change.
// Swap for Postgres/SQLite later; the route code only
// touches the collections on `db`.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VP_DATA_DIR || path.join(here, 'data');
export const UPLOAD_DIR = process.env.VP_UPLOAD_DIR || path.join(here, 'uploads');
export const INCOMING_DIR = path.join(UPLOAD_DIR, 'incoming'); // raw uploads, deleted once encrypted
const FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(INCOMING_DIR, { recursive: true });

const load = () => {
  if (fs.existsSync(FILE)) return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  const fresh = buildSeed();
  fresh.meta = { jwtSecret: crypto.randomBytes(48).toString('hex'), createdAt: new Date().toISOString() };
  return fresh;
};

export const db = load();
db.activity ||= {}; // userId -> { 'YYYY-MM-DD': seconds watched }
db.payments ||= []; // added after the first release; older db.json files lack it

export const save = () => {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE); // atomic: a crash never leaves a half-written file
};

save();

export const uid = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
