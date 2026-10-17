// ============================================
// /api/creator — the application a new creator fills in before the studio opens.
// A creator account is locked until an admin approves this application. It holds the teaching
// history, a CV (PDF/Word) and/or a LinkedIn profile, and any other platform they already teach on.
// CVs are private: only the applicant and admins can download them.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { db, save, INCOMING_DIR } from '../db.js';
import * as blobs from '../blobs.js';
import { requireAuthAllowLocked, requireRole, toPublic } from '../auth.js';
import { validateCreatorApplication, CV_MAX_BYTES, CV_EXTENSIONS } from '../../shared/validation.js';

const router = Router();

const MIME_BY_EXT = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const CV_NAME_RE = /^[0-9a-f-]{36}\.(pdf|doc|docx)$/;

// Files are checked by their first bytes, not by the name or type the browser claims
const sniffCv = (filePath) => {
  const fd = fs.openSync(filePath, 'r');
  const b = Buffer.alloc(8);
  fs.readSync(fd, b, 0, 8, 0);
  fs.closeSync(fd);
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return '.pdf';
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) return '.docx'; // a zip container
  if (b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))) return '.doc';
  return null;
};

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: Number(process.env.APPLICATION_RATE_LIMIT || 20),
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: INCOMING_DIR, // staged here, then moved into the blob store
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}.upload`),
  }),
  limits: { fileSize: CV_MAX_BYTES, files: 1, fields: 20, fieldSize: 8 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(CV_EXTENSIONS.includes(ext) ? null : new Error('UNSUPPORTED'), CV_EXTENSIONS.includes(ext));
  },
}).single('cv');

const removeCv = (application) => {
  if (application?.cv?.name && CV_NAME_RE.test(application.cv.name)) blobs.remove('cvs', application.cv.name).catch(() => {});
};

// What the applicant (and admins) may see about a CV: never the stored file name
export const publicApplication = (application) => {
  if (!application) return null;
  const { cv, ...rest } = application;
  return { ...rest, cv: cv ? { originalName: cv.originalName, size: cv.size, uploadedAt: cv.uploadedAt } : null };
};

// Streams a stored CV as a download (nosniff + attachment, so a browser never renders it as a page)
export const sendCv = async (res, application) => {
  const cv = application?.cv;
  if (!cv || !CV_NAME_RE.test(cv.name)) return res.status(404).json({ error: 'No CV on file.' });
  if ((await blobs.size('cvs', cv.name).catch(() => null)) === null) return res.status(404).json({ error: 'The CV file is missing.' });
  const ext = path.extname(cv.name);
  const safeName = (cv.originalName || `cv${ext}`).replace(/[^\w. -]/g, '_').slice(0, 100);
  res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  const stream = blobs.readStream('cvs', cv.name);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
};

router.use(requireAuthAllowLocked, requireRole('creator'));

router.get('/application', (req, res) => {
  res.json({ status: req.user.creatorStatus || 'approved', application: publicApplication(req.user.creatorApplication) });
});

router.get('/application/cv', (req, res) => sendCv(res, req.user.creatorApplication));

router.post('/application', limiter, (req, res) => {
  const user = req.user;
  if (!['unsubmitted', 'rejected'].includes(user.creatorStatus)) {
    return res.status(409).json({ error: user.creatorStatus === 'pending' ? 'Your application is already waiting for review.' : 'You are already approved.' });
  }
  upload(req, res, async (err) => {
    const staged = req.file?.path;
    const cleanup = () => { if (staged) fs.rmSync(staged, { force: true }); };
    if (err) {
      cleanup();
      const message = err.code === 'LIMIT_FILE_SIZE' ? `The CV must be ${CV_MAX_BYTES / 1024 / 1024} MB or smaller.`
        : err.message === 'UNSUPPORTED' ? 'The CV must be a PDF or Word file (.pdf, .doc, .docx).' : 'The upload could not be read.';
      return res.status(400).json({ error: message, fields: { credentials: message } });
    }
    try {
      const previous = user.creatorApplication;
      const keepOldCv = !!previous?.cv && req.body?.removeCv !== 'true';
      const hasCv = !!staged || keepOldCv;
      const { values, errors } = validateCreatorApplication(req.body || {}, { hasCv });
      if (staged && !sniffCv(staged)) errors.credentials = 'That file is not a real PDF or Word document.';
      if (Object.keys(errors).length) {
        cleanup();
        return res.status(400).json({ error: Object.values(errors)[0], fields: errors });
      }

      let cv = keepOldCv ? previous.cv : null;
      if (staged) {
        const ext = sniffCv(staged);
        const name = `${crypto.randomUUID()}${ext}`;
        const size = fs.statSync(staged).size;
        await blobs.put('cvs', name, staged);
        const original = path.basename(req.file.originalname || `cv${ext}`).slice(0, 100);
        cv = { name, originalName: original, size, uploadedAt: new Date().toISOString() };
        removeCv(previous); // the replaced file is no longer needed
      } else if (previous?.cv && !keepOldCv) {
        removeCv(previous);
      }

      user.creatorApplication = {
        ...values,
        cv,
        submittedAt: new Date().toISOString(),
        submissions: (previous?.submissions || 0) + 1,
        reviewNote: '', reviewedAt: null,
      };
      user.creatorStatus = 'pending';
      save();
      res.status(201).json({ success: true, user: toPublic(user), status: 'pending', application: publicApplication(user.creatorApplication) });
    } catch (e) {
      cleanup();
      console.error(`[creator] application failed for ${user.id}: ${e.message}`);
      res.status(500).json({ error: 'Could not save your application. Please try again.' });
    }
  });
});

export default router;
