// ============================================
// GET /api/data — everything the signed-in user may see, in one call.
// This is where read scoping lives: learners get published courses and
// their own records, creators their own content, admins everything.
// ============================================

import { Router } from 'express';
import { db } from '../db.js';
import { requireAuthAllowLocked, toPublic } from '../auth.js';
import { isCreatorLocked } from '../../src/auth/permissions.js';
import { DEFAULT_SETTINGS } from '../defaults.js';

const router = Router();

// Never expose where the file lives on disk or anything about its key
export const publicVideo = (v) => {
  // eslint-disable-next-line no-unused-vars
  const { file, ...rest } = v;
  return {
    ...rest,
    hasMedia: !!file,
    encryptionStatus: file?.enc ? 'encrypted' : (rest.encryptionStatus || 'access_controlled'),
    encryptionAlg: file?.enc?.alg || null,
  };
};

const maskEmail = (email = '') => { const [name, domain = ''] = email.split('@'); return `${name.slice(0, 1)}•••@${domain}`; };
// A creator sees the real email of their own learners; everyone else's address is masked (enough to tell people apart)
const slimUser = (u, showEmail) => ({ id: u.id, name: u.name, email: showEmail ? u.email : maskEmail(u.email), role: u.role, status: u.status, joinDate: u.joinDate });

export const settingsFor = (user) => ({
  ...DEFAULT_SETTINGS,
  displayName: user.name,
  email: user.email,
  ...(db.settings[user.id] || {}),
});

router.get('/', requireAuthAllowLocked, (req, res) => {
  const me = req.user;
  if (isCreatorLocked(me)) {
    // Not approved yet: nothing but their own profile and application
    return res.json({ me: toPublic(me), payments: [], users: [], courses: [], videos: [], enrollments: [], logs: [], alerts: [], progress: {}, activity: {}, settings: settingsFor(me), audit: [] });
  }
  const isAdmin = me.role === 'admin';
  const isCreator = me.role === 'creator';

  const published = db.courses.filter(c => c.status === 'active');
  const myCourses = db.courses.filter(c => c.creatorId === me.id);
  const courses = isAdmin ? db.courses : [...new Map([...published, ...(isCreator ? myCourses : [])].map(c => [c.id, c])).values()];
  const courseIds = new Set(courses.map(c => c.id));
  const myCourseIds = new Set(myCourses.map(c => c.id));

  const unfinished = (v) => v.uploadStatus === 'processing' || v.uploadStatus === 'failed';
  const videos = db.videos.filter(v => courseIds.has(v.courseId) && (isAdmin || v.creatorId === me.id || !unfinished(v)));
  const myVideoIds = new Set(db.videos.filter(v => v.creatorId === me.id).map(v => v.id));

  const enrollments = db.enrollments.filter(e =>
    isAdmin || e.studentId === me.id || (isCreator && myCourseIds.has(e.courseId)));

  let users;
  if (isAdmin) users = db.users.map(toPublic);
  else if (isCreator) {
    const mine = new Set(db.enrollments.filter(e => myCourseIds.has(e.courseId)).map(e => e.studentId));
    users = db.users.filter(u => u.role !== 'admin').map(u => slimUser(u, u.id === me.id || mine.has(u.id)));
  }
  else {
    const creatorIds = new Set(courses.map(c => c.creatorId));
    users = db.users.filter(u => creatorIds.has(u.id) || u.id === me.id).map(u => ({ id: u.id, name: u.name, role: u.role }));
  }

  const logs = db.logs.filter(l => isAdmin || l.userId === me.id || (isCreator && myCourseIds.has(l.courseId)));
  const alerts = isAdmin ? db.alerts : isCreator ? db.alerts.filter(a => myVideoIds.has(a.videoId)) : [];

  // Learners see their own payments, creators the payments for their courses, admins all
  const payments = db.payments.filter(p => p.userId === me.id ||
    (p.status !== 'created' && (isAdmin || (isCreator && myCourseIds.has(p.courseId)))));

  res.json({
    payments,
    me: toPublic(me),
    users,
    courses,
    videos: videos.map(publicVideo),
    enrollments,
    logs,
    alerts,
    progress: db.progress[me.id] || {},
    activity: db.activity[me.id] || {},
    settings: settingsFor(me),
    audit: isAdmin ? db.audit : [],
  });
});

export default router;
