// ============================================
// /api/admin — creator approvals, user management, moderation.
// Every route requires an active admin; every action is audited.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { db, save, UPLOAD_DIR } from '../db.js';
import { requireAuth, requireRole, revokeAllSessions, toPublic } from '../auth.js';
import { audit, findCourse, findUser } from '../access.js';

const router = Router();
router.use(requireAuth, requireRole('admin'));

router.post('/creators/:id/review', (req, res) => {
  const user = findUser(req.params.id);
  if (!user || user.creatorStatus !== 'pending') return res.status(404).json({ error: 'No pending application.' });
  const approve = !!req.body?.approve;
  if (approve) { user.role = 'creator'; user.creatorStatus = 'approved'; }
  else user.creatorStatus = 'rejected';
  save();
  audit(req.user.id, approve ? 'creator.approve' : 'creator.reject', 'user', user.id);
  res.json({ success: true });
});

router.patch('/users/:id', (req, res) => {
  const user = findUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found.' });
  if (user.id === req.user.id) return res.status(400).json({ error: 'You cannot change your own account here.' });

  const { status, role } = req.body || {};
  if (status !== undefined) {
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    user.status = status;
    if (status === 'suspended') revokeAllSessions(user.id); // kick them out now
    audit(req.user.id, status === 'suspended' ? 'user.suspend' : 'user.reactivate', 'user', user.id);
  }
  if (role !== undefined) {
    if (!['learner', 'creator', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
    user.role = role;
    audit(req.user.id, 'user.role', 'user', user.id, { role });
  }
  save();
  res.json({ success: true, user: toPublic(user) });
});

router.post('/courses/:id/moderate', (req, res) => {
  const course = findCourse(req.params.id);
  if (!course) return res.status(404).json({ error: 'Course not found.' });
  const takeDown = !!req.body?.takeDown;
  course.status = takeDown ? 'taken_down' : 'draft';
  save();
  audit(req.user.id, takeDown ? 'course.takedown' : 'course.restore', 'course', course.id);
  res.json({ success: true });
});

// Admin removal of any video (creators delete via DELETE /api/videos/:id)
router.delete('/videos/:id', (req, res) => {
  const video = db.videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found.' });
  if (video.file) fs.rm(path.join(UPLOAD_DIR, video.file.name), { force: true }, () => {});
  db.videos = db.videos.filter(v => v.id !== video.id);
  const course = findCourse(video.courseId);
  if (course) course.videoCount = Math.max(0, (course.videoCount || 1) - 1);
  db.streamSessions = db.streamSessions.filter(s => s.videoId !== video.id);
  save();
  audit(req.user.id, 'video.remove', 'video', video.id);
  res.json({ success: true });
});

export default router;
