// ============================================
// Video processing pipeline. After an upload is accepted the server works
// through four real stages while the creator watches the progress:
//   1. verifying   — read the whole file and fingerprint it (SHA-256)
//   2. encrypting  — AES-256-GCM, 64 KiB blocks, fresh per-video key
//   3. integrity   — decrypt the result and compare it to the fingerprint
//   4. finalizing  — wrap the key, publish the record, delete the raw upload
// A video is hidden from learners and cannot be streamed until step 4 is done.
//
// Each stage is shown for at least VP_MIN_STAGE_MS (default 1200 ms, 0 turns it
// off) so even a tiny file's progress is readable. The progress bar never shows
// more than the work actually completed.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, save, INCOMING_DIR } from './db.js';
import * as blobs from './blobs.js';
import {
  ALG, CHUNK_SIZE, newDataKey, wrapKey, keyId, encryptFile, createDecryptStream,
} from './encryption.js';

const MIN_STAGE_MS = Number(process.env.VP_MIN_STAGE_MS ?? 1200);

const STAGES = [
  { key: 'verifying', label: 'Verifying file', weight: 15 },
  { key: 'encrypting', label: 'Encrypting (AES-256-GCM)', weight: 50 },
  { key: 'integrity', label: 'Checking integrity', weight: 25 },
  { key: 'finalizing', label: 'Finalizing', weight: 10 },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const findVideo = (id) => db.videos.find(v => v.id === id);

export const queuedState = () => ({ stage: 'queued', label: 'Queued', step: 0, steps: STAGES.length, percent: 0 });

// Runs one stage; `work(setActual)` reports real progress as a 0..1 fraction
const runStage = async (video, index, work) => {
  const stage = STAGES[index];
  const base = STAGES.slice(0, index).reduce((sum, s) => sum + s.weight, 0);
  const started = Date.now();
  let actual = 0;

  const publish = () => {
    const paced = MIN_STAGE_MS > 0 ? Math.min(1, (Date.now() - started) / MIN_STAGE_MS) : 1;
    const shown = Math.min(actual, paced);
    video.processing = {
      stage: stage.key, label: stage.label, step: index + 1, steps: STAGES.length,
      percent: Math.round(base + stage.weight * shown),
    };
  };

  publish();
  save(); // stage changes are persisted; the per-tick percentage only lives in memory
  const ticker = setInterval(publish, 100);
  try {
    const result = await work((fraction) => { actual = Math.max(actual, Math.min(1, fraction)); });
    actual = 1;
    while (MIN_STAGE_MS > 0 && Date.now() - started < MIN_STAGE_MS) await sleep(50);
    publish();
    return result;
  } finally {
    clearInterval(ticker);
  }
};

const sha256OfFile = async (filePath, onProgress) => {
  const size = fs.statSync(filePath).size || 1;
  const hash = crypto.createHash('sha256');
  let read = 0;
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
    read += chunk.length;
    onProgress(read / size);
  }
  return hash.digest('hex');
};

export const processVideo = async (videoId, tempPath, mime) => {
  const video = findVideo(videoId);
  if (!video) { fs.rmSync(tempPath, { force: true }); return; }

  const storedName = `${crypto.randomUUID()}.vpe`;
  const storedPath = path.join(INCOMING_DIR, storedName); // staged here; moved into the blob store at the end
  try {
    const expected = await runStage(video, 0, (set) => sha256OfFile(tempPath, set));

    const dek = newDataKey();
    const plainLen = await runStage(video, 1, (set) => encryptFile(tempPath, storedPath, dek, set));

    await runStage(video, 2, async (set) => {
      const hash = crypto.createHash('sha256');
      let seen = 0;
      for await (const chunk of createDecryptStream(storedPath, dek, 0, Number.MAX_SAFE_INTEGER, plainLen)) {
        hash.update(chunk);
        seen += chunk.length;
        set(seen / (plainLen || 1));
      }
      if (hash.digest('hex') !== expected) throw new Error('integrity check failed');
    });

    const wrappedKey = await runStage(video, 3, async (set) => {
      if (!findVideo(videoId)) throw new Error('video was removed during processing');
      set(0.3);
      const wrapped = wrapKey(dek, videoId);
      await blobs.put('videos', storedName, storedPath); // the encrypted file moves into permanent storage
      set(0.9);
      return wrapped;
    });

    // Publish only after the last stage has been shown, so "ready" really means ready
    if (!findVideo(videoId)) throw new Error('video was removed during processing');
    video.file = {
      name: storedName,
      size: plainLen,
      mime,
      enc: { v: 1, alg: ALG, chunk: CHUNK_SIZE, kid: keyId(), wrappedKey },
    };
    video.encryptionStatus = 'encrypted';
    video.uploadStatus = 'complete';
    delete video.processing;
    const course = db.courses.find(c => c.id === video.courseId);
    if (course) course.videoCount = (course.videoCount || 0) + 1;
    save();
  } catch (err) {
    console.error(`[processing] video ${videoId} failed: ${err.message}`);
    fs.rmSync(storedPath, { force: true });
    blobs.remove('videos', storedName).catch(() => {});
    if (findVideo(videoId)) {
      video.uploadStatus = 'failed';
      video.processing = { stage: 'failed', label: 'Failed', step: 0, steps: STAGES.length, percent: 0, error: 'Processing failed. Please upload the video again.' };
      delete video.file;
      save();
    }
  } finally {
    fs.rmSync(tempPath, { force: true }); // the raw upload never outlives processing
  }
};
