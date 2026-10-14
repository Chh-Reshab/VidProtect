// ============================================
// Courses, enrollments, alerts and settings
// Ownership is checked on every write; a resource you don't own
// answers 404 so IDs of other creators' content can't be probed.
// ============================================

import { Router } from 'express';
import { db, save, uid } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';
import { findCourse, findUser } from '../access.js';
import { settingsFor } from './data.js';
import { canManageCourse } from '../../src/auth/permissions.js';

const router = Router();
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const VISIBILITY = ['public', 'invite_only'];
const MAX_PRICE = 100000; // whole rupees

// Price in whole rupees; 0 means free. Returns null when the value is not a valid price.
export const parsePrice = (v) => {
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= MAX_PRICE ? n : null;
};

// ── Courses ──────────────────────────────────
router.post('/courses', requireAuth, requireRole('creator'), (req, res) => {
  const title = clean(req.body?.title, 120);
  if (!title) return res.status(400).json({ error: 'Course title is required.' });
  const visibility = VISIBILITY.includes(req.body?.visibility) ? req.body.visibility : 'public';
  let price = 0;
  if (req.body?.price !== undefined && req.body.price !== '') {
    price = parsePrice(req.body.price);
    if (price === null) return res.status(400).json({ error: `Price must be a whole number of rupees between 0 and ${MAX_PRICE}.` });
  }
  const course = {
    id: uid('course'),
    title,
    description: clean(req.body?.description, 2000),
    creatorId: req.user.id,
    status: 'draft',
    visibility,
    price,
    currency: 'INR',
    videoCount: 0,
    enrolledCount: 0,
    createdAt: new Date().toISOString(),
    thumbnail: '#292929',
  };
  db.courses.unshift(course);
  save();
  res.status(201).json({ success: true, course });
});

router.patch('/courses/:id', requireAuth, (req, res) => {
  const course = findCourse(req.params.id);
  if (!course || !canManageCourse(req.user, course)) return res.status(404).json({ error: 'Course not found.' });
  if (course.status === 'taken_down' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'This course was taken down by a moderator.' });
  }
  // Allow-list: creators can never set 'taken_down' or change the owner
  if (typeof req.body?.title === 'string' && clean(req.body.title, 120)) course.title = clean(req.body.title, 120);
  if (typeof req.body?.description === 'string') course.description = clean(req.body.description, 2000);
  if (VISIBILITY.includes(req.body?.visibility)) course.visibility = req.body.visibility;
  if (req.body?.price !== undefined) {
    const price = parsePrice(req.body.price);
    if (price === null) return res.status(400).json({ error: `Price must be a whole number of rupees between 0 and ${MAX_PRICE}.` });
    course.price = price; // existing learners keep their access; only new enrolments pay this
    course.currency = 'INR';
  }
  if (['draft', 'active'].includes(req.body?.status)) course.status = req.body.status;
  save();
  res.json({ success: true, course });
});

// ── Enrollments ──────────────────────────────
export const addEnrollment = (studentId, courseId, source, paymentId = null) => {
  if (db.enrollments.some(e => e.studentId === studentId && e.courseId === courseId)) {
    return { error: 'Already enrolled in this course.' };
  }
  db.enrollments.push({ id: uid('enr'), studentId, courseId, enrolledAt: new Date().toISOString(), status: 'active', source, ...(paymentId ? { paymentId } : {}) });
  const course = findCourse(courseId);
  if (course) course.enrolledCount = (course.enrolledCount || 0) + 1;
  save();
  return {};
};

// A learner enrols themselves in a published, open course
router.post('/courses/:id/enroll', requireAuth, (req, res) => {
  const course = findCourse(req.params.id);
  if (!course || course.status !== 'active') return res.status(404).json({ error: 'This course is not available.' });
  if (course.creatorId === req.user.id) return res.status(400).json({ error: 'You own this course.' });
  if ((course.price || 0) > 0) return res.status(402).json({ error: 'This is a paid course. Complete checkout to enrol.' });
  if (course.visibility === 'invite_only') {
    return res.status(403).json({ error: 'This course is invite-only. Ask the creator to enrol you.' });
  }
  const { error } = addEnrollment(req.user.id, course.id, 'self');
  if (error) return res.status(409).json({ error });
  res.json({ success: true });
});

// The course owner (or an admin) enrols someone
router.post('/courses/:id/enrollments', requireAuth, (req, res) => {
  const course = findCourse(req.params.id);
  if (!course || !canManageCourse(req.user, course)) return res.status(404).json({ error: 'Course not found.' });
  const target = findUser(req.body?.userId);
  if (!target || target.status !== 'active') return res.status(404).json({ error: 'User not found.' });
  const { error } = addEnrollment(target.id, course.id, 'invite');
  if (error) return res.status(409).json({ error });
  res.status(201).json({ success: true });
});

router.delete('/enrollments/:id', requireAuth, (req, res) => {
  const enrollment = db.enrollments.find(e => e.id === req.params.id);
  const course = enrollment && findCourse(enrollment.courseId);
  if (!enrollment || !course || !canManageCourse(req.user, course)) {
    return res.status(404).json({ error: 'Enrollment not found.' });
  }
  db.enrollments = db.enrollments.filter(e => e.id !== enrollment.id);
  course.enrolledCount = Math.max(0, (course.enrolledCount || 1) - 1);
  save();
  res.json({ success: true });
});

// ── Alerts (creator reviews alerts on their own videos) ──
router.patch('/alerts/:id', requireAuth, requireRole('creator', 'admin'), (req, res) => {
  const alert = db.alerts.find(a => a.id === req.params.id);
  const video = alert && db.videos.find(v => v.id === alert.videoId);
  const allowed = alert && (req.user.role === 'admin' || video?.creatorId === req.user.id);
  if (!allowed) return res.status(404).json({ error: 'Alert not found.' });
  if (!['open', 'reviewed', 'resolved'].includes(req.body?.status)) return res.status(400).json({ error: 'Invalid status.' });
  alert.reviewStatus = req.body.status;
  alert.resolvedAt = req.body.status === 'resolved' ? new Date().toISOString() : alert.resolvedAt;
  save();
  res.json({ success: true, alert });
});

// ── Settings (own record only) ───────────────
router.put('/settings', requireAuth, (req, res) => {
  const b = req.body || {};
  const next = {};
  if (typeof b.displayName === 'string') next.displayName = clean(b.displayName, 80);
  if (typeof b.email === 'string') next.email = clean(b.email, 200);
  if (Number.isFinite(Number(b.defaultTokenExpiry))) next.defaultTokenExpiry = Math.min(120, Math.max(5, Number(b.defaultTokenExpiry)));
  if (typeof b.sessionDisplayPreference === 'string') next.sessionDisplayPreference = clean(b.sessionDisplayPreference, 40);
  if (typeof b.courseAccessPreference === 'string') next.courseAccessPreference = clean(b.courseAccessPreference, 40);
  if (b.notifications && typeof b.notifications === 'object') {
    next.notifications = {
      suspiciousActivity: !!b.notifications.suspiciousActivity,
      accessDenied: !!b.notifications.accessDenied,
      securityUpdates: !!b.notifications.securityUpdates,
    };
  }
  db.settings[req.user.id] = { ...(db.settings[req.user.id] || {}), ...next };
  save();
  res.json({ success: true, settings: settingsFor(req.user) });
});

export default router;
