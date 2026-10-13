// ============================================
// VIDPROTECT AI — MOCK SERVICES
// Frontend mock service layer (demo only).
//
// Everything here runs in the browser, so none of it is real
// security. It mirrors the rules a backend must enforce:
// ownership checks on every write, scoped reads, and an
// enrollment check before any stream token is issued.
// ============================================

import {
  DEMO_USERS,
  DEMO_PASSWORD,
  DEMO_COURSES,
  DEMO_VIDEOS,
  DEMO_ACCESS_LOGS,
  DEMO_SECURITY_ALERTS,
  DEMO_SETTINGS,
} from '../data/seedData';
import { canManageCourse, canManageVideo } from '../auth/permissions';

const SEED_VERSION = '3';

const LS_KEYS = {
  seed: 'vp_seed_version',
  users: 'vp_users',
  videos: 'vp_videos',
  logs: 'vp_access_logs',
  alerts: 'vp_security_alerts',
  enrollments: 'vp_enrollments',
  settings: 'vp_settings',
  courses: 'vp_courses',
  progress: 'vp_progress',
  audit: 'vp_audit',
};

// ─── LOCAL STORAGE HELPERS ─────────────────
const getFromLS = (key, fallback) => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
};

const saveToLS = (key, data) => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* storage unavailable */ }
};

const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;

// ─── INITIALIZATION ─────────────────────────
export const initDemoData = () => {
  // Re-seed when the data shape changes so old browser data can't break the app
  if (localStorage.getItem(LS_KEYS.seed) !== SEED_VERSION) {
    Object.values(LS_KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.setItem(LS_KEYS.seed, SEED_VERSION);
  }

  if (!localStorage.getItem(LS_KEYS.users)) {
    const all = [
      DEMO_USERS.admin,
      DEMO_USERS.creator,
      ...DEMO_USERS.creators,
      ...DEMO_USERS.students,
      ...DEMO_USERS.applicants,
    ];
    saveToLS(LS_KEYS.users, all);

    const enrollments = [];
    all.forEach(u => {
      (u.enrolledCourses || []).forEach(courseId => {
        enrollments.push({
          id: uid('enr'),
          studentId: u.id,
          courseId,
          enrolledAt: new Date().toISOString(),
          status: u.status === 'suspended' ? 'suspended' : 'active',
          source: 'invite',
        });
      });
    });
    saveToLS(LS_KEYS.enrollments, enrollments);
  }
  if (!localStorage.getItem(LS_KEYS.videos)) saveToLS(LS_KEYS.videos, DEMO_VIDEOS);
  if (!localStorage.getItem(LS_KEYS.logs)) saveToLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  if (!localStorage.getItem(LS_KEYS.alerts)) saveToLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  if (!localStorage.getItem(LS_KEYS.courses)) saveToLS(LS_KEYS.courses, DEMO_COURSES);
  if (!localStorage.getItem(LS_KEYS.settings)) saveToLS(LS_KEYS.settings, {});
  if (!localStorage.getItem(LS_KEYS.progress)) saveToLS(LS_KEYS.progress, {});
  if (!localStorage.getItem(LS_KEYS.audit)) saveToLS(LS_KEYS.audit, []);
};

// ─── USERS & AUTH ────────────────────────────
// The password hash never leaves this module; sessions only get the public fields.
const toPublic = (u) => {
  if (!u) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, enrolledCourses, demo, ...rest } = u;
  return rest;
};

const getStoredUsers = () => getFromLS(LS_KEYS.users, []);

export const getUsers = () => getStoredUsers().map(toPublic);

export const getUserById = (id) => toPublic(getStoredUsers().find(u => u.id === id));

const hashPassword = async (pw) => {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`vp-demo-salt:${pw}`));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `plain:${pw}`; // crypto.subtle unavailable (insecure context)
  }
};

export const authLogin = async (email, password) => {
  const user = getStoredUsers().find(u => u.email.toLowerCase() === (email || '').trim().toLowerCase());
  const invalid = { success: false, error: 'Invalid email or password.' };
  if (!user) return invalid;
  const ok = user.demo ? password === DEMO_PASSWORD : user.passwordHash === await hashPassword(password);
  if (!ok) return invalid;
  if (user.status === 'suspended') {
    return { success: false, error: 'This account is suspended. Contact support.' };
  }
  return { success: true, user: toPublic(user) };
};

// Everyone who registers is a learner. Becoming a creator needs admin approval.
export const authRegister = async (name, email, password) => {
  if (!name || !email || !password) return { success: false, error: 'All fields required.' };
  if (password.length < 8) return { success: false, error: 'Password must be at least 8 characters.' };
  const users = getStoredUsers();
  if (users.some(u => u.email.toLowerCase() === email.trim().toLowerCase())) {
    return { success: false, error: 'An account with this email already exists.' };
  }
  users.push({
    id: uid('usr'),
    name: name.trim(),
    email: email.trim(),
    role: 'learner',
    status: 'active',
    passwordHash: await hashPassword(password),
    joinDate: new Date().toISOString().slice(0, 10),
  });
  saveToLS(LS_KEYS.users, users);
  return { success: true, message: 'Account created. You can now sign in.' };
};

const logAudit = (actorId, action, targetType, targetId, meta = {}) => {
  const audit = getFromLS(LS_KEYS.audit, []);
  audit.unshift({ id: uid('aud'), actorId, action, targetType, targetId, meta, createdAt: new Date().toISOString() });
  saveToLS(LS_KEYS.audit, audit.slice(0, 500));
};

export const getAuditLog = () => getFromLS(LS_KEYS.audit, []);

const requireAdmin = (actorId) => {
  const actor = getStoredUsers().find(u => u.id === actorId);
  return actor && actor.role === 'admin' && actor.status === 'active' ? actor : null;
};

const updateStoredUser = (id, patch) => {
  const users = getStoredUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  saveToLS(LS_KEYS.users, users);
  return users[idx];
};

export const requestCreatorAccess = (userId, { displayName, bio }) => {
  const user = getStoredUsers().find(u => u.id === userId);
  if (!user || user.role !== 'learner') return { success: false, error: 'Only learners can apply.' };
  if (user.creatorStatus === 'pending') return { success: false, error: 'Your application is already pending.' };
  if (!displayName?.trim() || !bio?.trim()) return { success: false, error: 'Display name and bio are required.' };
  const updated = updateStoredUser(userId, {
    creatorStatus: 'pending',
    creatorProfile: { displayName: displayName.trim(), bio: bio.trim() },
  });
  return { success: true, user: toPublic(updated) };
};

export const reviewCreatorApplication = (adminId, userId, approve) => {
  if (!requireAdmin(adminId)) return { success: false, error: 'Admin access required.' };
  const user = getStoredUsers().find(u => u.id === userId);
  if (!user || user.creatorStatus !== 'pending') return { success: false, error: 'No pending application.' };
  updateStoredUser(userId, approve
    ? { role: 'creator', creatorStatus: 'approved' }
    : { creatorStatus: 'rejected' });
  logAudit(adminId, approve ? 'creator.approve' : 'creator.reject', 'user', userId);
  return { success: true };
};

export const setUserStatus = (adminId, userId, status) => {
  if (!requireAdmin(adminId)) return { success: false, error: 'Admin access required.' };
  if (adminId === userId) return { success: false, error: 'You cannot change your own status.' };
  if (!['active', 'suspended'].includes(status)) return { success: false, error: 'Invalid status.' };
  if (!updateStoredUser(userId, { status })) return { success: false, error: 'User not found.' };
  logAudit(adminId, status === 'suspended' ? 'user.suspend' : 'user.reactivate', 'user', userId);
  return { success: true };
};

export const setUserRole = (adminId, userId, role) => {
  if (!requireAdmin(adminId)) return { success: false, error: 'Admin access required.' };
  if (adminId === userId) return { success: false, error: 'You cannot change your own role.' };
  if (!['learner', 'creator', 'admin'].includes(role)) return { success: false, error: 'Invalid role.' };
  if (!updateStoredUser(userId, { role })) return { success: false, error: 'User not found.' };
  logAudit(adminId, 'user.role', 'user', userId, { role });
  return { success: true };
};

// ─── VIDEO SERVICES ──────────────────────────
// Pass a creatorId to scope results to that creator's content.
export const getVideos = (creatorId) => {
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  return creatorId ? videos.filter(v => v.creatorId === creatorId) : videos;
};

export const getVideoById = (id) => getFromLS(LS_KEYS.videos, DEMO_VIDEOS).find(v => v.id === id) || null;

export const getCourseVideos = (courseId) =>
  getVideos().filter(v => v.courseId === courseId)
    .sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));

export const uploadVideo = (userId, videoData) => {
  const actor = getStoredUsers().find(u => u.id === userId);
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const courseIdx = courses.findIndex(c => c.id === videoData.courseId);
  if (courseIdx === -1 || !canManageCourse(actor, courses[courseIdx])) {
    return { success: false, error: 'You can only upload videos to your own courses.' };
  }

  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  const newVideo = {
    id: `vid-${Date.now()}`,
    ...videoData,
    courseName: courses[courseIdx].title,
    creatorId: courses[courseIdx].creatorId,
    encryptionStatus: 'encrypted',
    protectionStatus: 'protected',
    uploadStatus: 'complete',
    sessions: 0,
    uploadDate: new Date().toISOString(),
  };
  videos.unshift(newVideo);
  saveToLS(LS_KEYS.videos, videos);

  courses[courseIdx].videoCount = (courses[courseIdx].videoCount || 0) + 1;
  saveToLS(LS_KEYS.courses, courses);

  return { success: true, video: newVideo };
};

export const deleteVideo = (userId, id) => {
  const actor = getStoredUsers().find(u => u.id === userId);
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  const video = videos.find(v => v.id === id);
  if (!video || !canManageVideo(actor, video)) {
    return { success: false, error: 'Video not found.' }; // same message either way: don't reveal other creators' IDs
  }
  saveToLS(LS_KEYS.videos, videos.filter(v => v.id !== id));

  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === video.courseId);
  if (idx !== -1) {
    courses[idx].videoCount = Math.max(0, (courses[idx].videoCount || 1) - 1);
    saveToLS(LS_KEYS.courses, courses);
  }
  if (actor.role === 'admin') logAudit(actor.id, 'video.remove', 'video', id);
  return { success: true };
};

// ─── COURSE SERVICES ─────────────────────────
export const getCourses = (creatorId) => {
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  return creatorId ? courses.filter(c => c.creatorId === creatorId) : courses;
};

export const getCourseById = (id) => getFromLS(LS_KEYS.courses, DEMO_COURSES).find(c => c.id === id) || null;

export const createCourse = (userId, { title, description, visibility = 'public' }) => {
  const actor = getStoredUsers().find(u => u.id === userId);
  if (!actor || actor.role !== 'creator' || actor.status !== 'active') {
    return { success: false, error: 'Only creators can create courses.' };
  }
  if (!title?.trim()) return { success: false, error: 'Course title is required.' };
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const course = {
    id: `course-${Date.now()}`,
    title: title.trim(),
    description: (description || '').trim(),
    creatorId: actor.id,
    status: 'draft',
    visibility,
    videoCount: 0,
    enrolledCount: 0,
    createdAt: new Date().toISOString(),
    thumbnail: '#292929',
  };
  courses.unshift(course);
  saveToLS(LS_KEYS.courses, courses);
  return { success: true, course };
};

export const updateCourse = (userId, courseId, patch) => {
  const actor = getStoredUsers().find(u => u.id === userId);
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx === -1 || !canManageCourse(actor, courses[idx])) return { success: false, error: 'Course not found.' };
  if (courses[idx].status === 'taken_down' && actor.role !== 'admin') {
    return { success: false, error: 'This course was taken down by a moderator.' };
  }
  // Only these fields are editable; creators can't set 'taken_down'.
  const allowed = ['title', 'description', 'visibility', 'status'];
  const clean = {};
  allowed.forEach(k => { if (patch[k] !== undefined) clean[k] = patch[k]; });
  if (clean.status && !['draft', 'active'].includes(clean.status)) delete clean.status;
  courses[idx] = { ...courses[idx], ...clean };
  saveToLS(LS_KEYS.courses, courses);
  return { success: true, course: courses[idx] };
};

export const moderateCourse = (adminId, courseId, takeDown) => {
  if (!requireAdmin(adminId)) return { success: false, error: 'Admin access required.' };
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx === -1) return { success: false, error: 'Course not found.' };
  courses[idx].status = takeDown ? 'taken_down' : 'draft';
  saveToLS(LS_KEYS.courses, courses);
  logAudit(adminId, takeDown ? 'course.takedown' : 'course.restore', 'course', courseId);
  return { success: true };
};

// ─── ENROLLMENT SERVICES ─────────────────────
export const getEnrollments = () => getFromLS(LS_KEYS.enrollments, []);

export const getStudentsForCourse = (courseId) =>
  getEnrollments()
    .filter(e => e.courseId === courseId)
    .map(e => {
      const student = getStoredUsers().find(s => s.id === e.studentId);
      return student ? { ...toPublic(student), enrollmentId: e.id, enrollmentStatus: e.status, enrolledAt: e.enrolledAt } : null;
    })
    .filter(Boolean);

// People a creator can enrol: learners (and other creators acting as learners)
export const getAllStudents = () =>
  getUsers().filter(u => (u.role === 'learner' || u.role === 'creator') && u.status === 'active');

const addEnrollment = (studentId, courseId, source) => {
  const enrollments = getEnrollments();
  if (enrollments.find(e => e.studentId === studentId && e.courseId === courseId)) {
    return { success: false, error: 'Already enrolled in this course.' };
  }
  enrollments.push({ id: uid('enr'), studentId, courseId, enrolledAt: new Date().toISOString(), status: 'active', source });
  saveToLS(LS_KEYS.enrollments, enrollments);

  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) {
    courses[idx].enrolledCount = (courses[idx].enrolledCount || 0) + 1;
    saveToLS(LS_KEYS.courses, courses);
  }
  return { success: true };
};

// A creator/admin enrols someone into a course they manage
export const enrollStudent = (actorId, studentId, courseId) => {
  const actor = getStoredUsers().find(u => u.id === actorId);
  const course = getCourseById(courseId);
  if (!course || !canManageCourse(actor, course)) return { success: false, error: 'Course not found.' };
  if (!getStoredUsers().some(u => u.id === studentId)) return { success: false, error: 'User not found.' };
  return addEnrollment(studentId, courseId, 'invite');
};

// A learner enrols themselves into a published, public course
export const selfEnroll = (userId, courseId) => {
  const user = getStoredUsers().find(u => u.id === userId);
  const course = getCourseById(courseId);
  if (!user || user.status !== 'active') return { success: false, error: 'Your account cannot enrol right now.' };
  if (!course || course.status !== 'active') return { success: false, error: 'This course is not available.' };
  if (course.creatorId === userId) return { success: false, error: 'You own this course.' };
  if (course.visibility === 'invite_only') return { success: false, error: 'This course is invite-only. Ask the creator to enrol you.' };
  return addEnrollment(userId, courseId, 'self');
};

export const removeEnrollment = (actorId, enrollmentId, courseId) => {
  const actor = getStoredUsers().find(u => u.id === actorId);
  const course = getCourseById(courseId);
  if (!course || !canManageCourse(actor, course)) return { success: false, error: 'Course not found.' };
  const enrollments = getEnrollments();
  if (!enrollments.some(e => e.id === enrollmentId && e.courseId === courseId)) {
    return { success: false, error: 'Enrollment not found.' };
  }
  saveToLS(LS_KEYS.enrollments, enrollments.filter(e => e.id !== enrollmentId));

  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) {
    courses[idx].enrolledCount = Math.max(0, (courses[idx].enrolledCount || 1) - 1);
    saveToLS(LS_KEYS.courses, courses);
  }
  return { success: true };
};

export const checkEnrollment = (studentId, courseId) =>
  getEnrollments().find(e => e.studentId === studentId && e.courseId === courseId && e.status === 'active') || null;

// ─── LEARNER SERVICES ────────────────────────
export const getCatalog = () => getCourses().filter(c => c.status === 'active');

export const getProgressMap = (userId) => getFromLS(LS_KEYS.progress, {})[userId] || {};

export const saveProgress = (userId, videoId, positionSeconds, durationSeconds) => {
  const all = getFromLS(LS_KEYS.progress, {});
  const mine = all[userId] || {};
  const completed = durationSeconds > 0 && positionSeconds >= durationSeconds * 0.95;
  mine[videoId] = {
    positionSeconds: Math.floor(positionSeconds),
    completed: completed || !!mine[videoId]?.completed,
    updatedAt: new Date().toISOString(),
  };
  all[userId] = mine;
  saveToLS(LS_KEYS.progress, all);
};

// Courses a user is enrolled in, with progress numbers for the dashboard
export const getEnrolledCourses = (userId) => {
  const progress = getProgressMap(userId);
  return getEnrollments()
    .filter(e => e.studentId === userId)
    .map(e => {
      const course = getCourseById(e.courseId);
      if (!course) return null;
      const videos = getCourseVideos(course.id);
      const done = videos.filter(v => progress[v.id]?.completed).length;
      return {
        ...course,
        enrollmentId: e.id,
        enrollmentStatus: e.status,
        totalVideos: videos.length,
        completedVideos: done,
        percent: videos.length ? Math.round((done / videos.length) * 100) : 0,
      };
    })
    .filter(Boolean);
};

export const getWatchHistory = (userId) =>
  getAccessLogs().filter(l => l.userId === userId).slice(0, 100);

// ─── STREAM TOKEN SERVICES ───────────────────
export const createDemoStreamToken = (userId, videoId, expiryMinutes = 5) => {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  return {
    tokenId: `vp-tok-${Math.random().toString(36).slice(2, 18).toUpperCase()}`,
    sessionId: `sess-${Math.random().toString(36).slice(2, 10)}`,
    userId,
    videoId,
    issuedAt: now.toISOString(),
    expiresAt: expiry.toISOString(),
    expiryMs: expiry.getTime(),
    status: 'active',
    isDemoToken: true,
  };
};

export const validateDemoToken = (token) => {
  if (!token) return { valid: false, reason: 'No token provided.' };
  if (token.status !== 'active') return { valid: false, reason: 'Token has been revoked.' };
  if (new Date().getTime() > token.expiryMs) return { valid: false, reason: 'Token has expired.' };
  return { valid: true };
};

// The one gate every playback goes through (a real API does this server-side).
// Order matters: account → video → course published → ownership/admin → enrollment.
export const requestStreamAccess = (userId, videoId, { renew = false } = {}) => {
  const user = getStoredUsers().find(u => u.id === userId);
  const video = getVideoById(videoId);
  const course = video ? getCourseById(video.courseId) : null;

  const deny = (reason, eventType = 'access_denied') => {
    if (user && video) {
      recordAccessEvent({
        userId: user.id, userName: user.name,
        videoId: video.id, videoTitle: video.title,
        courseId: video.courseId, eventType, result: 'denied', reason,
        sessionRef: uid('sess'), tokenRef: null,
      });
      flagRepeatedDenials(user, video);
    }
    return { granted: false, reason };
  };

  if (!user) return { granted: false, reason: 'You must be signed in.' };
  if (user.status !== 'active') return deny('Account suspended — access restricted');
  if (!video || !course) return { granted: false, reason: 'Video not found.' };

  const isOwner = user.role === 'creator' && video.creatorId === user.id;
  const isAdmin = user.role === 'admin';

  if (!isOwner && !isAdmin) {
    if (course.status !== 'active') return deny('This course is not published.');
    const enrollment = getEnrollments().find(e => e.studentId === user.id && e.courseId === course.id);
    if (!enrollment) return deny('Enrollment verification failed — not enrolled in course');
    if (enrollment.status !== 'active') return deny('Your enrollment is suspended.');
  }

  const token = createDemoStreamToken(user.id, video.id, 5);
  if (!renew) {
    recordAccessEvent({
      userId: user.id, userName: user.name,
      videoId: video.id, videoTitle: video.title, courseId: video.courseId,
      eventType: isOwner || isAdmin ? 'creator_preview' : 'stream_authorized',
      result: 'success', reason: isOwner || isAdmin ? 'Owner/admin preview' : 'Enrollment verified, token issued',
      sessionRef: token.sessionId, tokenRef: token.tokenId,
    });
    const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
    const i = videos.findIndex(v => v.id === video.id);
    if (i !== -1) { videos[i].sessions = (videos[i].sessions || 0) + 1; saveToLS(LS_KEYS.videos, videos); }
  }
  return { granted: true, token, video, course };
};

// 3+ denials by one account in an hour raises an alert (once per account/video until resolved)
const flagRepeatedDenials = (user, video) => {
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const denials = getFromLS(LS_KEYS.logs, []).filter(l =>
    l.userId === user.id && l.result === 'denied' && new Date(l.timestamp).getTime() > hourAgo);
  if (denials.length < 3) return;
  const alerts = getFromLS(LS_KEYS.alerts, []);
  if (alerts.some(a => a.userId === user.id && a.alertType === 'repeated_denial' && a.reviewStatus === 'open')) return;
  alerts.unshift({
    id: uid('alert'),
    severity: 'high',
    alertType: 'repeated_denial',
    timestamp: new Date().toISOString(),
    userId: user.id, userName: user.name,
    videoId: video.id, videoTitle: video.title,
    explanation: `Account ${user.id} (${user.name}) generated ${denials.length} access-denied events within 60 minutes.`,
    reviewStatus: 'open',
    recommendedAction: 'Review account activity and confirm whether the learner should have access.',
    resolvedAt: null,
  });
  saveToLS(LS_KEYS.alerts, alerts);
};

// ─── ACCESS LOG SERVICES ─────────────────────
export const getAccessLogs = (creatorId) => {
  const logs = getFromLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  if (!creatorId) return logs;
  const mine = new Set(getCourses(creatorId).map(c => c.id));
  return logs.filter(l => mine.has(l.courseId));
};

export const recordAccessEvent = (event) => {
  const logs = getFromLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  const newLog = { id: uid('log'), timestamp: new Date().toISOString(), ...event };
  logs.unshift(newLog);
  saveToLS(LS_KEYS.logs, logs.slice(0, 1000));
  return newLog;
};

// ─── SECURITY ALERT SERVICES ─────────────────
export const getSecurityAlerts = (creatorId) => {
  const alerts = getFromLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  if (!creatorId) return alerts;
  const mine = new Set(getVideos(creatorId).map(v => v.id));
  return alerts.filter(a => mine.has(a.videoId));
};

export const updateAlertStatus = (alertId, status, creatorId) => {
  const alerts = getFromLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx === -1) return null;
  if (creatorId && !getVideos(creatorId).some(v => v.id === alerts[idx].videoId)) return null;
  alerts[idx].reviewStatus = status;
  if (status === 'resolved') alerts[idx].resolvedAt = new Date().toISOString();
  saveToLS(LS_KEYS.alerts, alerts);
  return alerts[idx];
};

// ─── SETTINGS SERVICES (per user) ────────────
export const getSettings = (user) => {
  const all = getFromLS(LS_KEYS.settings, {});
  return {
    ...DEMO_SETTINGS,
    displayName: user?.name || DEMO_SETTINGS.displayName,
    email: user?.email || DEMO_SETTINGS.email,
    ...(all[user?.id] || {}),
  };
};

export const updateSettings = (user, updates) => {
  const all = getFromLS(LS_KEYS.settings, {});
  all[user.id] = { ...(all[user.id] || {}), ...updates };
  saveToLS(LS_KEYS.settings, all);
  return getSettings(user);
};

// ─── DASHBOARD STATS ─────────────────────────
// Creator stats are computed only from that creator's content.
export const getDashboardStats = (creatorId) => {
  const videos = getVideos(creatorId);
  const logs = getAccessLogs(creatorId);
  const alerts = getSecurityAlerts(creatorId);
  const myCourseIds = new Set(getCourses(creatorId).map(c => c.id));
  const enrollments = getEnrollments().filter(e => !creatorId || myCourseIds.has(e.courseId));

  return {
    protectedVideos: videos.filter(v => v.protectionStatus === 'protected').length,
    enrolledLearners: new Set(enrollments.map(e => e.studentId)).size,
    streamingSessions: logs.filter(l => l.result === 'success').length,
    suspiciousEvents: alerts.filter(a => a.reviewStatus === 'open').length,
  };
};

export const getPlatformStats = () => {
  const users = getUsers();
  return {
    learners: users.filter(u => u.role === 'learner').length,
    creators: users.filter(u => u.role === 'creator').length,
    admins: users.filter(u => u.role === 'admin').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    pendingCreators: users.filter(u => u.creatorStatus === 'pending').length,
    courses: getCourses().length,
    videos: getVideos().length,
    openAlerts: getSecurityAlerts().filter(a => a.reviewStatus === 'open').length,
  };
};

// ─── ACCOUNT SERVICES ────────────────────────
export const changePassword = async (userId, currentPassword, newPassword) => {
  const user = getStoredUsers().find(u => u.id === userId);
  if (!user) return { success: false, error: 'User not found.' };
  if (user.demo) return { success: false, error: 'Demo accounts cannot change their password.' };
  if (user.passwordHash !== await hashPassword(currentPassword)) return { success: false, error: 'Current password is incorrect.' };
  if (!newPassword || newPassword.length < 8) return { success: false, error: 'New password must be at least 8 characters.' };
  updateStoredUser(userId, { passwordHash: await hashPassword(newPassword) });
  return { success: true };
};
