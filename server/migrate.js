// ============================================
// Startup migration: bring every stored video up to the current encryption.
//   - older AES-256-CTR files (key + IV kept in db.json)  -> AES-256-GCM, wrapped key
//   - files that were never encrypted                     -> AES-256-GCM, wrapped key
// The new file is verified (SHA-256 of the decrypted result must equal the
// original) before the old file is removed. Safe to run on every start.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { db, save, UPLOAD_DIR, DATA_DIR, INCOMING_DIR, useMongo } from './db.js';
import * as blobs from './blobs.js';
import { backend } from './blobs.js';
import {
  ALG, CHUNK_SIZE, newDataKey, wrapKey, keyId, encryptFile, createDecryptStream, getMasterKey,
} from './encryption.js';

const sha256Of = async (readable) => {
  const hash = crypto.createHash('sha256');
  for await (const chunk of readable) hash.update(chunk);
  return hash.digest('hex');
};

const migrateOne = async (video) => {
  const f = video.file;
  const oldPath = path.join(UPLOAD_DIR, f.name);
  if (!fs.existsSync(oldPath)) throw new Error('file is missing on disk');

  // 1. Get a plaintext source (decrypting the legacy CTR file if needed)
  let source = oldPath;
  let tmpPlain = null;
  if (f.encKey && f.encIv) {
    tmpPlain = `${oldPath}.migrating`;
    const decipher = crypto.createDecipheriv('aes-256-ctr', Buffer.from(f.encKey, 'hex'), Buffer.from(f.encIv, 'hex'));
    await pipeline(fs.createReadStream(oldPath), decipher, fs.createWriteStream(tmpPlain, { mode: 0o600 }));
    source = tmpPlain;
  }

  const newName = `${crypto.randomUUID()}.vpe`;
  const newPath = path.join(UPLOAD_DIR, newName);
  try {
    const expectedHash = await sha256Of(fs.createReadStream(source));
    const dek = newDataKey();
    const plainLen = await encryptFile(source, newPath, dek);

    // 2. Prove the new file decrypts to exactly the same bytes
    const actualHash = await sha256Of(createDecryptStream(newPath, dek, 0, Number.MAX_SAFE_INTEGER, plainLen));
    if (actualHash !== expectedHash) throw new Error('verification failed after re-encryption');

    // 3. Commit the record, then remove the old file
    video.file = {
      name: newName,
      size: plainLen,
      mime: f.mime,
      enc: { v: 1, alg: ALG, chunk: CHUNK_SIZE, kid: keyId(), wrappedKey: wrapKey(dek, video.id) },
    };
    video.encryptionStatus = 'encrypted';
    save();
    fs.rmSync(oldPath, { force: true });
  } catch (err) {
    fs.rmSync(newPath, { force: true });
    throw err;
  } finally {
    if (tmpPlain) fs.rmSync(tmpPlain, { force: true });
  }
};

export const migrateEncryption = async () => {
  getMasterKey(); // fail fast if the master key is missing or malformed
  if (useMongo() || backend() !== 'local') return; // MongoDB / S3 deployments never held the older unencrypted / CTR files
  const pending = db.videos.filter(v => v.file && !v.file.enc);
  const backup = path.join(DATA_DIR, 'db.json.pre-gcm');
  if (pending.length && !fs.existsSync(backup) && fs.existsSync(path.join(DATA_DIR, 'db.json'))) {
    fs.copyFileSync(path.join(DATA_DIR, 'db.json'), backup); // keeps the old CTR keys until you are happy
  }
  let moved = 0;
  for (const video of pending) {
    try {
      await migrateOne(video);
      moved += 1;
    } catch (err) {
      console.error(`[encryption] Could not migrate video ${video.id}: ${err.message}. It stays unavailable until fixed.`);
    }
  }
  if (moved) console.log(`[encryption] Re-encrypted ${moved} video(s) with AES-256-GCM.`);
};

// If the server stopped mid-processing: fail those uploads, delete leftover raw
// files and any half-written encrypted files nothing refers to.
export const recoverInterruptedUploads = async () => {
  let failed = 0;
  for (const video of db.videos) {
    if (video.uploadStatus !== 'processing') continue;
    video.uploadStatus = 'failed';
    video.processing = { stage: 'failed', label: 'Failed', step: 0, steps: 4, percent: 0, error: 'Processing was interrupted. Please upload the video again.' };
    delete video.file;
    failed += 1;
  }
  if (failed) save();

  for (const name of fs.readdirSync(INCOMING_DIR)) fs.rmSync(path.join(INCOMING_DIR, name), { force: true });

  const referenced = new Set(db.videos.map(v => v.file?.name).filter(Boolean));
  let orphans = 0;
  try {
    for (const name of await blobs.names('videos')) {
      if (name.endsWith('.vpe') && !referenced.has(name)) { await blobs.remove('videos', name); orphans += 1; }
    }
  } catch (err) {
    // A storage problem (for example S3 permissions) should be loud, not stop the whole site from starting
    console.error(`[storage] Could not check the video store (${err.name || 'error'}: ${err.message}). Uploads and playback will fail until this is fixed.`);
  }
  if (failed || orphans) console.warn(`[processing] Recovered after restart: ${failed} interrupted upload(s) marked failed, ${orphans} orphaned file(s) removed.`);
};

// One-time: turn the progress saved before activity tracking existed into daily
// watch time, so existing learners start with the history they already have.
const clockSeconds = (text) => {
  const parts = String(text || '').split(':').map(Number);
  if (parts.some(n => !Number.isFinite(n))) return 0;
  return parts.reduce((total, n) => total * 60 + n, 0);
};

export const backfillActivity = () => {
  db.meta ||= {};
  if (db.meta.activityBackfilled) return;
  let days = 0;
  for (const [userId, videos] of Object.entries(db.progress || {})) {
    for (const [videoId, p] of Object.entries(videos)) {
      const video = db.videos.find(v => v.id === videoId);
      const seconds = p.completed
        ? (video?.durationSeconds || clockSeconds(video?.duration) || p.positionSeconds || 0)
        : (p.positionSeconds || 0);
      const day = String(p.updatedAt || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || seconds <= 0) continue;
      const map = db.activity[userId] || (db.activity[userId] = {});
      map[day] = (map[day] || 0) + Math.round(seconds);
      days += 1;
    }
  }
  db.meta.activityBackfilled = true;
  save();
  if (days) console.log(`[activity] Built watch history from ${days} earlier progress record(s).`);
};

// One-time: creators now apply with their own account and stay locked until approved. A learner who
// had applied under the old flow becomes a (locked) creator with the application they already sent.
export const migrateCreatorApplications = () => {
  let moved = 0;
  for (const user of db.users) {
    if (user.role === 'learner' && user.creatorStatus === 'pending') {
      user.role = 'creator';
      const profile = user.creatorProfile || {};
      user.creatorApplication = user.creatorApplication || {
        displayName: profile.displayName || user.name,
        teachingHistory: profile.bio || '',
        topics: '', yearsExperience: null, linkedinUrl: '', teachesElsewhere: false, otherPlatform: null, cv: null,
        submittedAt: user.joinDate ? `${user.joinDate}T00:00:00.000Z` : new Date().toISOString(),
        submissions: 1, reviewNote: '', reviewedAt: null, legacy: true,
      };
      moved += 1;
    }
  }
  if (moved) { save(); console.log(`[creators] ${moved} earlier creator application(s) moved to the new review flow.`); }
};
