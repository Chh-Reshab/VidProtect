// ============================================
// Videos: upload, delete, playback sessions, byte-range streaming, progress.
//
// Playback flow:
//   1. POST /videos/:id/stream-session  (signed in) → access rules checked,
//      a 5-minute session is created and logged.
//   2. <video src="/api/videos/:id/stream?s=SESSION"> — every range request
//      re-checks the session AND the viewer's current access.
//   3. POST /stream-sessions/:sid/renew keeps it alive; a suspension,
//      unenrolment or takedown ends playback at the next check.
// Encrypted files live in the blob store (local folder or MongoDB GridFS) under random names
// and are never served statically.
// ============================================

import fs from 'node:fs';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { db, save, INCOMING_DIR } from '../db.js';
import * as blobs from '../blobs.js';
import { requireAuth, requireRole } from '../auth.js';
import { findCourse, findUser, findVideo, checkVideoAccess, logDenied, recordLog } from '../access.js';
import { publicVideo } from './data.js';
import { canManageCourse, canManageVideo } from '../../src/auth/permissions.js';
import { unwrapKey, createDecryptStream, encryptedSize } from '../encryption.js';
import { removeThumb } from './thumbnails.js';
import { processVideo, queuedState } from '../processing.js';
import { recordCapture, SIGNALS } from '../capture.js';
import { appUrl } from '../mail.js';

const router = Router();

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const SESSION_MS = 5 * 60 * 1000;

const EXT_BY_MIME = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv',
  'video/x-msvideo': '.avi',
};

const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Check the file's real container signature, not just the client-sent MIME type
const sniffMime = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  const buf = Buffer.alloc(16);
  fs.readSync(fd, buf, 0, 16, 0);
  fs.closeSync(fd);
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    return buf.subarray(8, 12).toString('latin1').startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm'; // also .mkv
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'AVI ') return 'video/x-msvideo';
  return null;
};

const humanSize = (bytes) => {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const clock = (seconds) => {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
};

const unlink = (p) => { if (p) fs.rm(p, { force: true }, () => {}); };

const storage = multer.diskStorage({
  destination: INCOMING_DIR, // raw uploads wait here until they are encrypted
  // Random server-chosen name: the client's filename never touches the filesystem
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || '.bin'}`),
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_BYTES, files: 1, fields: 10 },
  fileFilter: (req, file, cb) => {
    if (!EXT_BY_MIME[file.mimetype]) return cb(new Error('UNSUPPORTED'));
    return cb(null, true);
  },
}).single('file');

// ── Upload ───────────────────────────────────
// Ownership is checked BEFORE a single byte of the file is accepted.
router.post(
  '/courses/:courseId/videos',
  requireAuth,
  requireRole('creator'),
  (req, res, next) => {
    const course = findCourse(req.params.courseId);
    if (!course || !canManageCourse(req.user, course)) {
      return res.status(404).json({ error: 'Course not found.' });
    }
    if (course.status === 'taken_down') {
      return res.status(403).json({ error: 'This course was taken down by a moderator.' });
    }
    // A few uploads at a time per creator: each one is encrypted in the background and uses disk and CPU
    const busy = db.videos.filter(v => v.creatorId === req.user.id && v.uploadStatus === 'processing').length;
    if (busy >= Number(process.env.MAX_PROCESSING_PER_CREATOR || 3)) {
      return res.status(429).json({ error: 'You already have several videos processing. Wait for them to finish, then upload again.' });
    }
    req.course = course;
    return next();
  },
  (req, res) => {
    upload(req, res, async (err) => {
      if (err) {
        unlink(req.file?.path);
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'This file is larger than the 2 GB limit.' });
        if (err.message === 'UNSUPPORTED') return res.status(415).json({ error: 'Unsupported file type. Use MP4, WebM, MOV, MKV or AVI.' });
        return res.status(400).json({ error: 'Upload failed. Please try again.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Please select a video file.' });

      const title = clean(req.body?.title, 200);
      if (!title) { unlink(req.file.path); return res.status(400).json({ error: 'Title is required.' }); }

      const sniffed = sniffMime(req.file.path);
      if (!sniffed) {
        unlink(req.file.path);
        return res.status(415).json({ error: 'That file does not look like a real video.' });
      }

      // Duration comes from the browser (no ffprobe on the server yet); sanity-checked
      const seconds = Number(req.body?.duration);
      const hasDuration = Number.isFinite(seconds) && seconds > 0 && seconds < 5 * 86400;

      // The upload is accepted now; verification and encryption run in the background
      // (see processing.js). Until they finish the video is hidden from learners.
      const video = {
        id: `vid-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        title,
        description: clean(req.body?.description, 2000),
        courseId: req.course.id,
        courseName: req.course.title,
        creatorId: req.course.creatorId,
        duration: hasDuration ? clock(seconds) : '--:--',
        durationSeconds: hasDuration ? Math.round(seconds) : undefined,
        fileSize: humanSize(req.file.size),
        uploadDate: new Date().toISOString(),
        encryptionStatus: 'pending',
        protectionStatus: 'protected',
        uploadStatus: 'processing',
        processing: queuedState(),
        sessions: 0,
        thumbnail: null,
      };
      db.videos.unshift(video);
      save();
      res.status(201).json({ success: true, video: publicVideo(video) });

      processVideo(video.id, req.file.path, sniffed).catch((e) => console.error('[processing] crashed:', e));
      return undefined;
    });
  },
);

// Live progress for the owner's upload screen
router.get('/videos/:id/processing', requireAuth, (req, res) => {
  const video = findVideo(req.params.id);
  const allowed = video && (req.user.role === 'admin' || canManageVideo(req.user, video));
  if (!allowed) return res.status(404).json({ error: 'Video not found.' });
  return res.json({ uploadStatus: video.uploadStatus, processing: video.processing || null });
});

// ── Delete (owner) ───────────────────────────
router.delete('/videos/:id', requireAuth, requireRole('creator'), (req, res) => {
  const video = findVideo(req.params.id);
  if (!video || !canManageVideo(req.user, video)) return res.status(404).json({ error: 'Video not found.' });
  if (video.uploadStatus === 'processing') return res.status(409).json({ error: 'This video is still processing. Try again in a moment.' });
  if (video.file) blobs.remove('videos', video.file.name).catch(() => {});
  removeThumb(video);
  db.videos = db.videos.filter(v => v.id !== video.id);
  db.streamSessions = db.streamSessions.filter(s => s.videoId !== video.id);
  const course = findCourse(video.courseId);
  if (course && video.uploadStatus !== 'failed') course.videoCount = Math.max(0, (course.videoCount || 1) - 1);
  save();
  res.json({ success: true });
});

// ── Playback sessions ────────────────────────
const pruneSessions = () => {
  const now = Date.now();
  db.streamSessions = db.streamSessions.filter(s => s.expiresAt > now);
};

router.post('/videos/:id/stream-session', requireAuth, (req, res) => {
  const video = findVideo(req.params.id);
  if (!video) return res.status(404).json({ granted: false, reason: 'Video not found.' });
  const user = req.user;

  const access = checkVideoAccess(user, video);
  if (!access.ok) {
    if (access.hidden) return res.status(404).json({ granted: false, reason: access.reason });
    logDenied(user, video, access.reason);
    return res.status(403).json({ granted: false, reason: access.reason });
  }

  pruneSessions();
  // One person holds a limited number of playback sessions at once: the oldest end
  const maxSessions = Number(process.env.MAX_STREAM_SESSIONS_PER_USER || 20);
  const own = db.streamSessions.filter(s => s.userId === user.id);
  if (own.length >= maxSessions) {
    const drop = new Set(own.slice(0, own.length - maxSessions + 1).map(s => s.id));
    db.streamSessions = db.streamSessions.filter(s => !drop.has(s.id));
  }
  const session = { id: `ss-${crypto.randomBytes(18).toString('hex')}`, userId: user.id, videoId: video.id, createdAt: Date.now(), expiresAt: Date.now() + SESSION_MS };
  db.streamSessions.push(session);

  recordLog({
    userId: user.id, userName: user.name,
    videoId: video.id, videoTitle: video.title, courseId: video.courseId,
    eventType: access.privileged ? 'creator_preview' : 'stream_authorized',
    result: 'success',
    reason: access.privileged ? 'Owner/admin preview' : 'Enrollment verified, token issued',
    sessionRef: session.id.slice(0, 14), tokenRef: session.id.slice(0, 14),
  }, access.privileged ? null : user);
  video.sessions = (video.sessions || 0) + 1;
  save();

  res.json({
    granted: true,
    session: { id: session.id, expiresAt: session.expiresAt },
    video: publicVideo(video),
    course: access.course,
  });
});

// The player reports a possible screenshot / recording attempt (see capture.js for what happens next)
const captureLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: Number(process.env.CAPTURE_RATE_LIMIT || 40),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reports. Try again in a few minutes.' },
});

router.post('/videos/:id/capture-signal', requireAuth, captureLimiter, (req, res) => {
  const video = findVideo(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  if (!Object.hasOwn(SIGNALS, req.body?.signal)) return res.status(400).json({ error: 'Unknown signal.' });
  const access = checkVideoAccess(req.user, video);
  if (!access.ok) return res.status(access.hidden ? 404 : 403).json({ error: access.reason });
  if (access.privileged) return res.json({ counted: false }); // creators previewing their own videos and admins are never flagged
  res.json(recordCapture(req.user, video, req.body.signal, `${appUrl(req)}/studio/alerts`));
});

router.post('/stream-sessions/:sid/renew', requireAuth, (req, res) => {
  const session = db.streamSessions.find(s => s.id === req.params.sid && s.userId === req.user.id);
  if (!session || session.expiresAt < Date.now()) return res.status(404).json({ granted: false, reason: 'Playback session expired.' });
  const video = findVideo(session.videoId);
  const access = video ? checkVideoAccess(req.user, video) : { ok: false, reason: 'Video not found.' };
  if (!access.ok) {
    db.streamSessions = db.streamSessions.filter(s => s.id !== session.id);
    if (video && !access.hidden) logDenied(req.user, video, access.reason);
    save();
    return res.status(403).json({ granted: false, reason: access.reason });
  }
  session.expiresAt = Date.now() + SESSION_MS;
  save();
  res.json({ granted: true, expiresAt: session.expiresAt });
});

// ── Byte-range streaming ─────────────────────
router.get('/videos/:id/stream', async (req, res) => {
  const deny = (code) => res.status(code).end();

  const sid = typeof req.query.s === 'string' ? req.query.s : '';
  const session = db.streamSessions.find(s => s.id === sid);
  if (!session || session.videoId !== req.params.id || session.expiresAt < Date.now()) return deny(401);

  const user = findUser(session.userId);
  const video = findVideo(req.params.id);
  if (!video || !video.file) return deny(404);
  if (!checkVideoAccess(user, video).ok) return deny(403);

  const source = blobs.source('videos', video.file.name);
  const total = video.file.size; // plaintext length
  let dek;
  try {
    if (!video.file.enc) return deny(404); // not migrated: never serve unencrypted bytes
    if ((await blobs.size('videos', video.file.name)) !== encryptedSize(total)) return deny(404);
    dek = unwrapKey(video.file.enc.wrappedKey, video.id);
  } catch (err) {
    console.error(`[encryption] cannot open video ${video.id}: ${err.message}`);
    return deny(500);
  }

  res.set({
    'Content-Type': video.file.mime,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'private, no-store',
    'Content-Disposition': 'inline',
    'X-Content-Type-Options': 'nosniff',
  });

  // Every chunk is authenticated before a single plaintext byte leaves the server
  const sendRange = (start, end) => {
    const stream = createDecryptStream(source, dek, start, end, total);
    stream.on('error', (err) => {
      console.error(`[encryption] integrity/read failure on video ${video.id}: ${err.message}`);
      res.destroy();
    });
    res.on('close', () => stream.destroy());
    return stream.pipe(res);
  };

  const range = req.headers.range;
  if (!range) {
    res.set('Content-Length', String(total));
    return sendRange(0, total - 1);
  }

  const m = /^bytes=(\d*)-(\d*)$/.exec(range);
  if (!m || (m[1] === '' && m[2] === '')) {
    res.set('Content-Range', `bytes */${total}`);
    return deny(416);
  }
  let start; let end;
  if (m[1] === '') { // suffix range: last N bytes
    start = Math.max(0, total - Number(m[2]));
    end = total - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1);
  }
  if (start > end || start >= total) {
    res.set('Content-Range', `bytes */${total}`);
    return deny(416);
  }

  res.status(206).set({
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Content-Length': String(end - start + 1),
  });
  return sendRange(start, end);
});

// ── Progress (own record, only for videos you may watch) ──
// Watch time per day feeds the learner's activity stats. The browser reports how many
// seconds it played, but the server only accepts what real elapsed time allows.
const lastSave = new Map(); // "user:video" -> ms of the previous accepted save
const MAX_PER_SAVE = 120;

const activityDay = (clientDay) => {
  const utc = new Date().toISOString().slice(0, 10);
  if (typeof clientDay !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(clientDay)) return utc;
  const diffDays = Math.abs(Date.parse(`${clientDay}T00:00:00Z`) - Date.parse(`${utc}T00:00:00Z`)) / 86400000;
  return diffDays <= 1 ? clientDay : utc; // the learner's own calendar day, but never far from the server's
};

const creditWatchTime = (userId, videoId, claimed, clientDay) => {
  const now = Date.now();
  const key = `${userId}:${videoId}`;
  const prev = lastSave.get(key);
  lastSave.set(key, now);
  if (lastSave.size > 5000) lastSave.clear();
  const seconds = Number(claimed);
  if (!Number.isFinite(seconds) || seconds <= 0) return;
  const room = prev && now - prev < 120000 ? ((now - prev) / 1000) * 2 + 2 : 10; // up to 2x playback speed
  const add = Math.min(seconds, room, MAX_PER_SAVE);
  const days = db.activity[userId] || (db.activity[userId] = {});
  const day = activityDay(clientDay);
  days[day] = Math.round((days[day] || 0) + add);
};

router.put('/progress/:videoId', requireAuth, (req, res) => {
  const video = findVideo(req.params.videoId);
  if (!video || !checkVideoAccess(req.user, video).ok) return res.status(404).json({ error: 'Video not found.' });

  const pos = Number(req.body?.positionSeconds);
  const dur = Number(req.body?.durationSeconds);
  if (!Number.isFinite(pos) || pos < 0) return res.status(400).json({ error: 'Invalid position.' });
  const duration = Number.isFinite(dur) && dur > 0 ? dur : video.durationSeconds || 0;

  const mine = db.progress[req.user.id] || (db.progress[req.user.id] = {});
  const completed = duration > 0 && pos >= duration * 0.95;
  mine[video.id] = {
    positionSeconds: Math.floor(pos),
    completed: completed || !!mine[video.id]?.completed,
    updatedAt: new Date().toISOString(),
  };
  creditWatchTime(req.user.id, video.id, req.body?.watchedSeconds, req.body?.localDate);
  save();
  res.json({ success: true });
});

export default router;
