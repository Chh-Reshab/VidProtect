// ============================================
// Thumbnails for courses and videos.
// Images are JPEG/PNG/WebP only (no SVG: it can carry scripts), checked by
// file signature, stored under random names. Only the owner can set or
// remove one. Serving is public by random name because <img> tags cannot
// send an Authorization header; a thumbnail is not protected content.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { save, UPLOAD_DIR } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { findCourse, findVideo } from '../access.js';
import { canManageCourse, canManageVideo } from '../../src/auth/permissions.js';

const router = Router();

const THUMB_DIR = path.join(UPLOAD_DIR, 'thumbs');
fs.mkdirSync(THUMB_DIR, { recursive: true });

const MAX_BYTES = 5 * 1024 * 1024;
const EXT_BY_MIME = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MIME_BY_EXT = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const sniffImage = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  const b = Buffer.alloc(12);
  fs.readSync(fd, b, 0, 12, 0);
  fs.closeSync(fd);
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return '.jpg';
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return '.png';
  if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return '.webp';
  return null;
};

// Remove the image a record points to (no-op when it has none)
export const removeThumb = (record) => {
  if (!record?.thumbUrl) return;
  const name = path.basename(record.thumbUrl);
  if (NAME_RE.test(name)) fs.rm(path.join(THUMB_DIR, name), { force: true }, () => {});
  record.thumbUrl = null;
};

const upload = multer({
  storage: multer.diskStorage({
    destination: THUMB_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || '.bin'}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 2 },
  fileFilter: (req, file, cb) => cb(EXT_BY_MIME[file.mimetype] ? null : new Error('UNSUPPORTED'), !!EXT_BY_MIME[file.mimetype]),
}).single('image');

// Shared handler: `find` resolves the record and ownership, 404 otherwise
const setThumbnail = (find) => [
  requireAuth,
  requireRole('creator'),
  (req, res, next) => {
    const record = find(req);
    if (!record) return res.status(404).json({ error: 'Not found.' });
    req.record = record;
    return next();
  },
  (req, res) => {
    upload(req, res, (err) => {
      const discard = () => req.file && fs.rm(req.file.path, { force: true }, () => {});
      if (err) {
        discard();
        if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image is larger than 5 MB.' });
        if (err.message === 'UNSUPPORTED') return res.status(415).json({ error: 'Use a JPEG, PNG or WebP image.' });
        return res.status(400).json({ error: 'Upload failed. Please try again.' });
      }
      if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
      const ext = sniffImage(req.file.path);
      if (!ext) { discard(); return res.status(415).json({ error: 'That file is not a valid image.' }); }
      // Name carries the real type, not what the client claimed
      const finalName = `${path.parse(req.file.filename).name}${ext}`;
      fs.renameSync(req.file.path, path.join(THUMB_DIR, finalName));

      removeThumb(req.record);
      req.record.thumbUrl = `/api/thumbnails/${finalName}`;
      save();
      return res.json({ success: true, thumbUrl: req.record.thumbUrl });
    });
  },
];

const clearThumbnail = (find) => [
  requireAuth,
  requireRole('creator'),
  (req, res) => {
    const record = find(req);
    if (!record) return res.status(404).json({ error: 'Not found.' });
    removeThumb(record);
    save();
    return res.json({ success: true });
  },
];

const ownCourse = (req) => {
  const c = findCourse(req.params.id);
  return c && canManageCourse(req.user, c) && c.status !== 'taken_down' ? c : null;
};
const ownVideo = (req) => {
  const v = findVideo(req.params.id);
  return v && canManageVideo(req.user, v) ? v : null;
};

router.post('/courses/:id/thumbnail', ...setThumbnail(ownCourse));
router.delete('/courses/:id/thumbnail', ...clearThumbnail(ownCourse));
router.post('/videos/:id/thumbnail', ...setThumbnail(ownVideo));
router.delete('/videos/:id/thumbnail', ...clearThumbnail(ownVideo));

router.get('/thumbnails/:name', (req, res) => {
  const name = req.params.name;
  if (!NAME_RE.test(name)) return res.status(404).end();
  const file = path.join(THUMB_DIR, name);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set({
    'Content-Type': MIME_BY_EXT[path.extname(name)],
    'Cache-Control': 'public, max-age=86400, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  return fs.createReadStream(file).pipe(res);
});

export default router;
