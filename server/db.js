// ============================================
// DB — the app's data.
// All routes read and write the in-memory `db` object; save() makes the change durable:
//   - without MONGODB_URI: one JSON file (server/data/db.json), written atomically
//   - with MONGODB_URI   : MongoDB collections (see mongo.js), written in small batches
// Call `await initDb()` once at start-up before using `db`.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './seed.js';
import * as mongo from './mongo.js';

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.VP_DATA_DIR || path.join(here, 'data');
export const UPLOAD_DIR = process.env.VP_UPLOAD_DIR || path.join(here, 'uploads');
export const INCOMING_DIR = path.join(UPLOAD_DIR, 'incoming'); // staging for raw uploads and files on their way into storage
const FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(INCOMING_DIR, { recursive: true });

export const mongoEnabled = () => Boolean(process.env.MONGODB_URI);

// The one live state object; initDb() fills it in place so every importer sees the data
export const db = {};

const freshState = () => {
  const fresh = buildSeed();
  fresh.meta = { jwtSecret: crypto.randomBytes(48).toString('hex'), createdAt: new Date().toISOString() };
  return fresh;
};

let initialised = false;
export const initDb = async () => {
  if (initialised) return;
  let state;
  if (mongoEnabled()) {
    await mongo.connect(process.env.MONGODB_URI, process.env.MONGODB_DB);
    state = await mongo.loadState();
    if (!state) {
      state = freshState();
      Object.assign(db, state);
      await mongo.persistState(db); // first run: store the seed data
    }
  } else if (fs.existsSync(FILE)) {
    state = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } else {
    state = freshState();
  }
  Object.assign(db, state);
  db.meta ||= {};
  db.activity ||= {};   // userId -> { 'YYYY-MM-DD': seconds watched }
  db.payments ||= [];   // added after the first release; older stores lack it
  initialised = true;
  if (!mongoEnabled()) writeJson(); // first run: create the file right away
};

// ── persistence ──────────────────────────────
let timer = null;
let running = Promise.resolve();
let dirty = false;

const writeJson = () => {
  const tmp = `${FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db));
  fs.renameSync(tmp, FILE); // atomic: a crash never leaves a half-written file
};

const runPersist = () => {
  running = running.then(async () => {
    if (!dirty) return;
    dirty = false;
    try {
      await mongo.persistState(db);
    } catch (err) {
      dirty = true; // try again on the next save or flush
      console.error(`[db] Could not write to MongoDB: ${err.message}`);
    }
  });
  return running;
};

export const save = () => {
  dirty = true;
  if (timer) return;
  // Batch bursts of changes: one write (JSON file or MongoDB) per quiet moment instead of one per request
  timer = setTimeout(() => { timer = null; if (mongoEnabled()) runPersist(); else flushJson(); }, mongoEnabled() ? 250 : 100);
};

const flushJson = () => {
  if (!dirty) return;
  dirty = false;
  writeJson();
};
// A normal exit never loses the last few changes (the JSON file is written synchronously here)
process.on('exit', () => { if (!mongoEnabled()) flushJson(); });

// Wait until everything saved so far is durable (used on shutdown and by scripts)
const flush = async () => {
  clearTimeout(timer);
  timer = null;
  if (!mongoEnabled()) { flushJson(); return; }
  await runPersist();
  if (dirty) await runPersist(); // one retry if the first attempt failed
};

export const closeDb = async () => { await flush(); await mongo.close(); };

export const uid = (prefix) => `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
