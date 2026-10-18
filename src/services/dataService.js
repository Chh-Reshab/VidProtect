// ============================================
// DATA SERVICE
// Reads are synchronous over an in-memory snapshot fetched from
// GET /api/data (already scoped to the signed-in user by the server).
// Writes call the API, then reload the snapshot so every page
// sees the new state. The server is the only source of truth and
// re-checks every rule; nothing here is trusted.
// ============================================

import { request, uploadForm, setAccessToken, refreshAccess, toResult, downloadBlob, saveBlob } from './api';
import { courseProgress, localDay } from './learningStats';

const emptyCache = () => ({
  me: null, users: [], courses: [], videos: [], enrollments: [],
  logs: [], alerts: [], progress: {}, settings: {}, audit: [], payments: [], activity: {},
});

let cache = emptyCache();

export const loadData = async () => {
  const r = await request('GET', '/data');
  if (r.ok) cache = { ...emptyCache(), ...r.data };
  return r.ok;
};

export const clearData = () => { cache = emptyCache(); };

// Run a write; on success refresh the snapshot before returning
const write = async (promise) => {
  const r = await promise;
  if (r.ok) await loadData();
  return toResult(r);
};

// ─── SESSION / AUTH ──────────────────────────
export const getMe = () => cache.me;

// Restore a session from the httpOnly refresh cookie (page load)
export const restoreSession = async () => {
  const session = await refreshAccess();
  if (!session) return null;
  await loadData();
  return cache.me;
};

export const authLogin = async (email, password, portal) => {
  const r = await request('POST', '/auth/login', { email, password, portal });
  if (!r.ok) return { success: false, error: r.data?.error || 'Sign in failed.', code: r.data?.code };
  setAccessToken(r.data.accessToken);
  await loadData();
  return { success: true, user: cache.me || r.data.user };
};

export const authRegister = async (name, email, password) => {
  const r = await request('POST', '/auth/register', { name, email, password });
  return toResult(r);
};

export const authCreatorRegister = async (name, email, password) =>
  toResult(await request('POST', '/auth/creator/register', { name, email, password }));

export const authVerifyEmail = async (token) => toResult(await request('POST', '/auth/verify-email', { token }));
export const authResendVerification = async (email) => toResult(await request('POST', '/auth/resend-verification', { email }));

export const authLogout = async () => {
  await request('POST', '/auth/logout');
  setAccessToken(null);
  clearData();
};

export const changePassword = async (userId, currentPassword, newPassword) =>
  toResult(await request('POST', '/auth/change-password', { currentPassword, newPassword }));

// ─── CREATOR APPLICATION ─────────────────────
// `fields` are the form values; `file` an optional CV. Sent as multipart so the CV can ride along.
export const submitCreatorApplication = async (fields, file, onProgress) => {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) if (value !== undefined && value !== null) form.append(key, String(value));
  if (file) form.append('cv', file);
  const r = await uploadForm('/creator/application', form, onProgress);
  return r.ok ? { success: true, ...r.data } : { success: false, error: r.data?.error || 'Could not submit the application.', fields: r.data?.fields };
};

const saveDownload = async (path) => {
  const r = await downloadBlob(path);
  if (!r.ok) return { success: false, error: r.error };
  saveBlob(r);
  return { success: true };
};
export const downloadCreatorCv = () => saveDownload('/creator/application/cv');
export const downloadApplicantCv = (userId) => saveDownload(`/admin/creators/${userId}/cv`);

// ─── USERS ───────────────────────────────────
export const getUsers = () => cache.users;
export const getUserById = (id) => cache.users.find(u => u.id === id) || null;

export const reviewCreatorApplication = (adminId, userId, approve, note = '') =>
  write(request('POST', `/admin/creators/${userId}/review`, { approve, note }));

export const setUserStatus = (adminId, userId, status) =>
  write(request('PATCH', `/admin/users/${userId}`, { status }));

export const setUserRole = (adminId, userId, role) =>
  write(request('PATCH', `/admin/users/${userId}`, { role }));

// ─── VIDEOS ──────────────────────────────────
// Pass a creatorId to scope to that creator's content.
export const getVideos = (creatorId) =>
  creatorId ? cache.videos.filter(v => v.creatorId === creatorId) : cache.videos;

export const getVideoById = (id) => cache.videos.find(v => v.id === id) || null;

export const getCourseVideos = (courseId) =>
  cache.videos.filter(v => v.courseId === courseId)
    .sort((a, b) => new Date(a.uploadDate) - new Date(b.uploadDate));

// Real multipart upload; onProgress gets 0..1
export const uploadVideoFile = async (courseId, { title, description, duration, file }, onProgress) => {
  const form = new FormData();
  // text fields first, file last
  form.append('title', title);
  form.append('description', description || '');
  if (duration) form.append('duration', String(duration));
  form.append('file', file);
  const r = await uploadForm(`/courses/${courseId}/videos`, form, onProgress);
  if (r.ok) await loadData();
  return toResult(r);
};

// Live processing state of an upload: { uploadStatus, processing: { stage, label, step, steps, percent, error? } }
export const getVideoProcessing = async (videoId) => {
  const r = await request('GET', `/videos/${videoId}/processing`);
  return r.ok ? r.data : null;
};

// kind is 'course' or 'video'
export const setThumbnail = async (kind, id, file) => {
  const form = new FormData();
  form.append('image', file);
  const r = await uploadForm(`/${kind}s/${id}/thumbnail`, form);
  if (r.ok) await loadData();
  return toResult(r);
};

export const removeThumbnail = (kind, id) => write(request('DELETE', `/${kind}s/${id}/thumbnail`));

export const deleteVideo = (userId, id) =>
  write(request('DELETE', cache.me?.role === 'admin' ? `/admin/videos/${id}` : `/videos/${id}`));

// ─── COURSES ─────────────────────────────────
export const getCourses = (creatorId) =>
  creatorId ? cache.courses.filter(c => c.creatorId === creatorId) : cache.courses;

export const getCourseById = (id) => cache.courses.find(c => c.id === id) || null;

export const createCourse = (userId, data) => write(request('POST', '/courses', data));

export const updateCourse = async (userId, courseId, patch) => {
  const result = await write(request('PATCH', `/courses/${courseId}`, patch));
  return result.success ? { ...result, course: getCourseById(courseId) } : result;
};

export const moderateCourse = (adminId, courseId, takeDown) =>
  write(request('POST', `/admin/courses/${courseId}/moderate`, { takeDown }));

// ─── ENROLLMENTS ─────────────────────────────
export const getEnrollments = () => cache.enrollments;

export const getStudentsForCourse = (courseId) =>
  cache.enrollments
    .filter(e => e.courseId === courseId)
    .map(e => {
      const student = cache.users.find(s => s.id === e.studentId);
      return student ? { ...student, enrollmentId: e.id, enrollmentStatus: e.status, enrolledAt: e.enrolledAt } : null;
    })
    .filter(Boolean);

// People a creator can enrol: active learners (and other creators acting as learners)
export const getAllStudents = () =>
  cache.users.filter(u => (u.role === 'learner' || u.role === 'creator') && u.status === 'active');

export const enrollStudent = (actorId, studentId, courseId) =>
  write(request('POST', `/courses/${courseId}/enrollments`, { userId: studentId }));

// ─── PAYMENTS (beta test mode) ───────────────
export const getPayments = () => cache.payments;

// payload: { method: 'free' } or { method: 'card'|'upi'|'netbanking', ...fields }.
// The server decides the amount; the browser never sends a price.
export const checkoutCourse = async (courseId, payload) => {
  const r = await request('POST', `/courses/${courseId}/checkout`, payload);
  if (r.ok) await loadData();
  return r.ok ? { success: true, payment: r.data.payment } : toResult(r);
};

export const removeEnrollment = (actorId, enrollmentId) =>
  write(request('DELETE', `/enrollments/${enrollmentId}`));

// ─── LEARNER ─────────────────────────────────
export const getCatalog = () => cache.courses.filter(c => c.status === 'active');

export const getProgressMap = () => cache.progress || {};

// Saved on pause / every few seconds / on leave. The local copy updates
// immediately so "continue watching" is right even before the request lands.
// watchedSeconds = time actually played since the last save; it feeds the activity stats
export const saveProgress = (userId, videoId, positionSeconds, durationSeconds, watchedSeconds = 0) => {
  const completed = durationSeconds > 0 && positionSeconds >= durationSeconds * 0.95;
  const today = localDay();
  cache.progress = {
    ...cache.progress,
    [videoId]: {
      positionSeconds: Math.floor(positionSeconds),
      completed: completed || !!cache.progress?.[videoId]?.completed,
      updatedAt: new Date().toISOString(),
    },
  };
  if (watchedSeconds > 0) cache.activity = { ...cache.activity, [today]: (cache.activity?.[today] || 0) + Math.round(watchedSeconds) };
  return request('PUT', `/progress/${videoId}`, {
    positionSeconds, durationSeconds, watchedSeconds: Math.round(watchedSeconds), localDate: today,
  });
};

export const getActivity = () => cache.activity || {};

export const getEnrolledCourses = (userId) => {
  const progress = getProgressMap();
  return cache.enrollments
    .filter(e => e.studentId === userId)
    .map(e => {
      const course = getCourseById(e.courseId);
      if (!course) return null;
      const videos = getCourseVideos(course.id);
      const prog = courseProgress(videos, progress);
      return {
        ...course,
        enrollmentId: e.id,
        enrollmentStatus: e.status,
        totalVideos: videos.length,
        completedVideos: prog.completed,
        percent: prog.percent,
        watchedSeconds: prog.watchedSeconds,
        totalSeconds: prog.totalSeconds,
      };
    })
    .filter(Boolean);
};

export const getWatchHistory = (userId) => cache.logs.filter(l => l.userId === userId).slice(0, 100);

// ─── PLAYBACK ────────────────────────────────
// The server decides. A grant gives a 5-minute playback session id;
// the player renews it, and the stream endpoint re-checks access on every range request.
const toToken = (id, expiresAt) => ({ tokenId: id, sessionId: id, expiryMs: expiresAt, status: 'active' });

export const startStream = async (videoId) => {
  const r = await request('POST', `/videos/${videoId}/stream-session`);
  if (!r.ok) return { granted: false, reason: r.data?.reason || r.data?.error || 'Access denied.' };
  const { session, video, course } = r.data;
  await loadData(); // pick up the new access-log entry
  return { granted: true, token: toToken(session.id, session.expiresAt), video, course };
};

export const renewStream = async (sessionId) => {
  const r = await request('POST', `/stream-sessions/${sessionId}/renew`);
  if (!r.ok) return { granted: false, reason: r.data?.reason || r.data?.error || 'Playback session ended.' };
  return { granted: true, token: toToken(sessionId, r.data.expiresAt) };
};

export const streamUrl = (videoId, sessionId) => `/api/videos/${videoId}/stream?s=${encodeURIComponent(sessionId)}`;

// ─── LOGS & ALERTS ───────────────────────────
export const getAccessLogs = (creatorId) => {
  if (!creatorId) return cache.logs;
  const mine = new Set(getCourses(creatorId).map(c => c.id));
  return cache.logs.filter(l => mine.has(l.courseId));
};

export const getSecurityAlerts = (creatorId) => {
  if (!creatorId) return cache.alerts;
  const mine = new Set(getVideos(creatorId).map(v => v.id));
  return cache.alerts.filter(a => mine.has(a.videoId));
};

export const updateAlertStatus = async (alertId, status) => {
  const result = await write(request('PATCH', `/alerts/${alertId}`, { status }));
  return result.success ? cache.alerts.find(a => a.id === alertId) || result.alert : null;
};

// ─── SETTINGS ────────────────────────────────
export const getSettings = () => cache.settings;

export const updateSettings = (user, updates) => write(request('PUT', '/settings', updates));

// ─── STATS ───────────────────────────────────
export const getDashboardStats = (creatorId) => {
  const videos = getVideos(creatorId);
  const logs = getAccessLogs(creatorId);
  const alerts = getSecurityAlerts(creatorId);
  const myCourseIds = new Set(getCourses(creatorId).map(c => c.id));
  const enrollments = cache.enrollments.filter(e => !creatorId || myCourseIds.has(e.courseId));

  return {
    protectedVideos: videos.filter(v => v.protectionStatus === 'protected').length,
    enrolledLearners: new Set(enrollments.map(e => e.studentId)).size,
    streamingSessions: logs.filter(l => l.result === 'success').length,
    suspiciousEvents: alerts.filter(a => a.reviewStatus === 'open').length,
  };
};

export const getAuditLog = () => cache.audit;

export const getPlatformStats = () => {
  const users = cache.users;
  return {
    learners: users.filter(u => u.role === 'learner').length,
    creators: users.filter(u => u.role === 'creator').length,
    admins: users.filter(u => u.role === 'admin').length,
    suspended: users.filter(u => u.status === 'suspended').length,
    pendingCreators: users.filter(u => u.creatorStatus === 'pending').length,
    courses: cache.courses.length,
    videos: cache.videos.length,
    openAlerts: cache.alerts.filter(a => a.reviewStatus === 'open').length,
  };
};
