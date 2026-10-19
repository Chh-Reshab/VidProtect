// ============================================
// Creator public profiles: what a learner sees before they enrol.
//   GET    /api/creators/:id        the public profile + published courses (signed-in users)
//   PUT    /api/profile             a creator edits their own headline, bio, achievements, links
//   POST   /api/profile/avatar      profile picture (JPEG/PNG/WebP, 2 MB)
//   DELETE /api/profile/avatar
//   GET    /api/avatars/:name       the picture itself (public by its random name, like thumbnails)
// Only fields a creator chose to share are returned: never the email, the CV or the application text.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { db, save, INCOMING_DIR } from '../db.js';
import * as blobs from '../blobs.js';
import { requireAuth, requireRole } from '../auth.js';
import { validateCreatorProfile } from '../../shared/validation.js';
import { sniffImage, MIME_BY_EXT, EXT_BY_MIME } from './thumbnails.js';
import { isCreatorLocked } from '../../src/auth/permissions.js';

const router = Router();

const MAX_BYTES = 2 * 1024 * 1024;
const NAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const upload = multer({
  storage: multer.diskStorage({
    destination: INCOMING_DIR,
    filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXT_BY_MIME[file.mimetype] || '.bin'}`),
  }),
  limits: { fileSize: MAX_BYTES, files: 1, fields: 2 },
  fileFilter: (req, file, cb) => cb(EXT_BY_MIME[file.mimetype] ? null : new Error('UNSUPPORTED'), !!EXT_BY_MIME[file.mimetype]),
}).single('image');

const removeAvatarFile = (profile) => {
  if (profile?.avatar && NAME_RE.test(profile.avatar)) blobs.remove('avatars', profile.avatar).catch(() => {});
};

// ── the creator edits their own profile ──
router.put('/profile', requireAuth, requireRole('creator'), (req, res) => {
  const { values, errors } = validateCreatorProfile(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: Object.values(errors)[0], fields: errors });
  req.user.profile = { ...(req.user.profile || {}), ...values };
  save();
  res.json({ success: true, profile: req.user.profile });
});

router.post('/profile/avatar', requireAuth, requireRole('creator'), (req, res) => {
  upload(req, res, async (err) => {
    const discard = () => req.file && fs.rm(req.file.path, { force: true }, () => {});
    if (err) {
      discard();
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'The picture is larger than 2 MB.' });
      if (err.message === 'UNSUPPORTED') return res.status(415).json({ error: 'Use a JPEG, PNG or WebP image.' });
      return res.status(400).json({ error: 'Upload failed. Please try again.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Please choose an image.' });
    const ext = sniffImage(req.file.path);
    if (!ext) { discard(); return res.status(415).json({ error: 'That file is not a valid image.' }); }
    const finalName = `${path.parse(req.file.filename).name}${ext}`; // the name carries the real type
    const staged = path.join(INCOMING_DIR, finalName);
    fs.renameSync(req.file.path, staged);
    try {
      await blobs.put('avatars', finalName, staged);
    } catch (putErr) {
      console.error('[profile] could not store the picture:', putErr.message);
      fs.rmSync(staged, { force: true });
      return res.status(500).json({ error: 'Could not save the picture. Please try again.' });
    }
    removeAvatarFile(req.user.profile);
    req.user.profile = { ...(req.user.profile || {}), avatar: finalName };
    save();
    return res.json({ success: true, avatarUrl: `/api/avatars/${finalName}` });
  });
});

router.delete('/profile/avatar', requireAuth, requireRole('creator'), (req, res) => {
  removeAvatarFile(req.user.profile);
  if (req.user.profile) delete req.user.profile.avatar;
  save();
  res.json({ success: true });
});

router.get('/avatars/:name', async (req, res) => {
  const name = req.params.name;
  if (!NAME_RE.test(name) || (await blobs.size('avatars', name).catch(() => null)) === null) return res.status(404).end();
  res.set({
    'Content-Type': MIME_BY_EXT[path.extname(name)],
    'Cache-Control': 'public, max-age=86400, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'",
  });
  const stream = blobs.readStream('avatars', name);
  stream.on('error', () => { if (!res.headersSent) { res.removeHeader('Content-Type'); res.status(404).end(); } else res.destroy(); });
  return stream.pipe(res);
});

// ── what learners see ──
const hoursOf = (videos) => Math.round((videos.reduce((sum, v) => sum + (v.durationSeconds || 0), 0) / 3600) * 10) / 10;

// Achievements the platform can vouch for, computed from real data
const badgesFor = ({ user, courses, learners, years }) => {
  const badges = [{ id: 'verified', label: 'Verified creator', detail: 'Approved by the VidProtect AI team after a review.' }];
  if (courses >= 1) badges.push({ id: 'publisher', label: 'Course creator', detail: `${courses} published course${courses === 1 ? '' : 's'}` });
  if (courses >= 5) badges.push({ id: 'library', label: 'Course library', detail: '5 or more published courses' });
  if (learners >= 25) badges.push({ id: 'community', label: 'Growing community', detail: '25 or more learners' });
  if (learners >= 100) badges.push({ id: 'popular', label: 'Popular creator', detail: '100 or more learners' });
  if (years >= 5) badges.push({ id: 'experienced', label: 'Experienced teacher', detail: `${years} years of teaching experience` });
  if (user.joinDate && Date.now() - Date.parse(user.joinDate) > 365 * 86_400_000) badges.push({ id: 'veteran', label: 'Member for a year', detail: `On VidProtect AI since ${user.joinDate.slice(0, 4)}` });
  return badges;
};

router.get('/creators/:id', requireAuth, (req, res) => {
  const user = db.users.find(u => u.id === req.params.id);
  if (!user || user.role !== 'creator' || isCreatorLocked(user) || user.status !== 'active') return res.status(404).json({ error: 'Creator not found.' });

  const listed = db.courses.filter(c => c.creatorId === user.id && c.status === 'active' && c.visibility !== 'invite_only');
  const listedIds = new Set(listed.map(c => c.id));
  const videos = db.videos.filter(v => listedIds.has(v.courseId) && v.uploadStatus !== 'processing' && v.uploadStatus !== 'failed');
  const learners = new Set(db.enrollments.filter(e => listedIds.has(e.courseId) && e.studentId !== user.id).map(e => e.studentId)).size;

  const profile = user.profile || {};
  const application = user.creatorApplication;
  const showExperience = profile.showExperience !== false;
  const years = application?.yearsExperience ?? null;
  const experience = showExperience && application ? { years, topics: application.topics || '' } : null;

  const links = [];
  if (profile.website) links.push({ label: 'Website', url: profile.website });
  if (profile.showLinks && application) {
    if (application.linkedinUrl) links.push({ label: 'LinkedIn', url: application.linkedinUrl });
    const other = application.otherPlatform;
    if (other?.platformUrl) links.push({ label: other.platform === 'Other' ? other.platformName : other.platform, url: other.platformUrl });
  }

  res.json({
    creator: {
      id: user.id,
      name: user.name,
      joinedAt: user.joinDate || null,
      avatarUrl: profile.avatar ? `/api/avatars/${profile.avatar}` : null,
      headline: profile.headline || '',
      bio: profile.bio || '',
      experience,
      links,
      achievements: profile.achievements || [],
      badges: badgesFor({ user, courses: listed.length, learners, years: showExperience ? years || 0 : 0 }),
      stats: { courses: listed.length, videos: videos.length, learners, hours: hoursOf(videos) },
    },
    courses: listed.map(c => ({
      id: c.id, title: c.title, description: (c.description || '').slice(0, 300), thumbUrl: c.thumbUrl || null,
      price: c.price || 0, videoCount: c.videoCount || 0, enrolledCount: c.enrolledCount || 0, createdAt: c.createdAt || null,
    })),
  });
});

export default router;
