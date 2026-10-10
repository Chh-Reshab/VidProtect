// ============================================
// VIDPROTECT AI — MOCK SERVICES
// Frontend mock service layer (demo only)
// ============================================

import {
  DEMO_USERS,
  DEMO_COURSES,
  DEMO_VIDEOS,
  DEMO_ACCESS_LOGS,
  DEMO_SECURITY_ALERTS,
  DEMO_SETTINGS,
} from '../data/seedData';

const LS_KEYS = {
  videos: 'vp_videos',
  logs: 'vp_access_logs',
  alerts: 'vp_security_alerts',
  enrollments: 'vp_enrollments',
  settings: 'vp_settings',
  courses: 'vp_courses',
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
  } catch {}
};

// ─── INITIALIZATION ─────────────────────────
export const initDemoData = () => {
  if (!localStorage.getItem(LS_KEYS.videos)) {
    saveToLS(LS_KEYS.videos, DEMO_VIDEOS);
  }
  if (!localStorage.getItem(LS_KEYS.logs)) {
    saveToLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  }
  if (!localStorage.getItem(LS_KEYS.alerts)) {
    saveToLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  }
  if (!localStorage.getItem(LS_KEYS.courses)) {
    saveToLS(LS_KEYS.courses, DEMO_COURSES);
  }
  if (!localStorage.getItem(LS_KEYS.enrollments)) {
    const enrollments = [];
    DEMO_USERS.students.forEach(student => {
      student.enrolledCourses.forEach(courseId => {
        enrollments.push({
          id: `enr-${Math.random().toString(36).substr(2, 6)}`,
          studentId: student.id,
          courseId,
          enrolledAt: new Date().toISOString(),
          status: student.status === 'suspended' ? 'suspended' : 'active',
        });
      });
    });
    saveToLS(LS_KEYS.enrollments, enrollments);
  }
  if (!localStorage.getItem(LS_KEYS.settings)) {
    saveToLS(LS_KEYS.settings, DEMO_SETTINGS);
  }
};

// ─── AUTH SERVICES ───────────────────────────
export const authLogin = (email, password) => {
  const creator = DEMO_USERS.creator;
  if (email === creator.email && password === creator.password) {
    return { success: true, user: creator };
  }
  const student = DEMO_USERS.students.find(s => s.email === email && password === 'demo1234');
  if (student) {
    return { success: true, user: student };
  }
  return { success: false, error: 'Invalid credentials. Use creator@vidprotect.demo / demo1234' };
};

export const authRegister = (name, email, password) => {
  if (!name || !email || !password) return { success: false, error: 'All fields required.' };
  if (password.length < 6) return { success: false, error: 'Password must be at least 6 characters.' };
  return {
    success: true,
    user: { id: 'new-creator', name, email, role: 'creator', avatar: name.substring(0, 2).toUpperCase() },
    message: 'Account created (demo). You can now log in.',
  };
};

// ─── VIDEO SERVICES ──────────────────────────
export const getVideos = () => getFromLS(LS_KEYS.videos, DEMO_VIDEOS);

export const getVideoById = (id) => {
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  return videos.find(v => v.id === id) || null;
};

export const uploadVideo = (videoData) => {
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  const newVideo = {
    id: `vid-${Date.now()}`,
    ...videoData,
    encryptionStatus: 'encrypted',
    protectionStatus: 'protected',
    uploadStatus: 'complete',
    sessions: 0,
    uploadDate: new Date().toISOString(),
  };
  videos.unshift(newVideo);
  saveToLS(LS_KEYS.videos, videos);

  // Also update course video count
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const courseIdx = courses.findIndex(c => c.id === videoData.courseId);
  if (courseIdx !== -1) {
    courses[courseIdx].videoCount = (courses[courseIdx].videoCount || 0) + 1;
    saveToLS(LS_KEYS.courses, courses);
  }

  return newVideo;
};

export const deleteVideo = (id) => {
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS).filter(v => v.id !== id);
  saveToLS(LS_KEYS.videos, videos);
};

// ─── COURSE SERVICES ─────────────────────────
export const getCourses = () => getFromLS(LS_KEYS.courses, DEMO_COURSES);

export const getCourseById = (id) => {
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  return courses.find(c => c.id === id) || null;
};

// ─── ENROLLMENT SERVICES ─────────────────────
export const getEnrollments = () => getFromLS(LS_KEYS.enrollments, []);

export const getStudentsForCourse = (courseId) => {
  const enrollments = getFromLS(LS_KEYS.enrollments, []);
  const courseEnrollments = enrollments.filter(e => e.courseId === courseId);
  return courseEnrollments.map(e => {
    const student = DEMO_USERS.students.find(s => s.id === e.studentId);
    return { ...student, enrollmentId: e.id, enrollmentStatus: e.status, enrolledAt: e.enrolledAt };
  }).filter(Boolean);
};

export const getAllStudents = () => DEMO_USERS.students;

export const enrollStudent = (studentId, courseId) => {
  const enrollments = getFromLS(LS_KEYS.enrollments, []);
  const exists = enrollments.find(e => e.studentId === studentId && e.courseId === courseId);
  if (exists) return { success: false, error: 'Student already enrolled.' };
  const newEnrollment = {
    id: `enr-${Math.random().toString(36).substr(2, 6)}`,
    studentId,
    courseId,
    enrolledAt: new Date().toISOString(),
    status: 'active',
  };
  enrollments.push(newEnrollment);
  saveToLS(LS_KEYS.enrollments, enrollments);

  // Update course enrolled count
  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) {
    courses[idx].enrolledCount = (courses[idx].enrolledCount || 0) + 1;
    saveToLS(LS_KEYS.courses, courses);
  }

  return { success: true };
};

export const removeEnrollment = (enrollmentId, courseId) => {
  let enrollments = getFromLS(LS_KEYS.enrollments, []);
  enrollments = enrollments.filter(e => e.id !== enrollmentId);
  saveToLS(LS_KEYS.enrollments, enrollments);

  const courses = getFromLS(LS_KEYS.courses, DEMO_COURSES);
  const idx = courses.findIndex(c => c.id === courseId);
  if (idx !== -1) {
    courses[idx].enrolledCount = Math.max(0, (courses[idx].enrolledCount || 1) - 1);
    saveToLS(LS_KEYS.courses, courses);
  }
};

export const checkEnrollment = (studentId, courseId) => {
  const enrollments = getFromLS(LS_KEYS.enrollments, []);
  return enrollments.find(e => e.studentId === studentId && e.courseId === courseId && e.status === 'active') || null;
};

// ─── STREAM TOKEN SERVICES ───────────────────
export const createDemoStreamToken = (userId, videoId, expiryMinutes = 30) => {
  const now = new Date();
  const expiry = new Date(now.getTime() + expiryMinutes * 60 * 1000);
  const tokenId = `vp-tok-${Math.random().toString(36).substr(2, 16).toUpperCase()}`;
  const sessionId = `sess-${Math.random().toString(36).substr(2, 8)}`;
  return {
    tokenId,
    sessionId,
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

// ─── ACCESS LOG SERVICES ─────────────────────
export const getAccessLogs = () => getFromLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);

export const recordAccessEvent = (event) => {
  const logs = getFromLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  const newLog = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  logs.unshift(newLog);
  saveToLS(LS_KEYS.logs, logs);
  return newLog;
};

// ─── SECURITY ALERT SERVICES ─────────────────
export const getSecurityAlerts = () => getFromLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);

export const updateAlertStatus = (alertId, status) => {
  const alerts = getFromLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  const idx = alerts.findIndex(a => a.id === alertId);
  if (idx !== -1) {
    alerts[idx].reviewStatus = status;
    if (status === 'resolved') alerts[idx].resolvedAt = new Date().toISOString();
    saveToLS(LS_KEYS.alerts, alerts);
    return alerts[idx];
  }
  return null;
};

// ─── SETTINGS SERVICES ───────────────────────
export const getSettings = () => getFromLS(LS_KEYS.settings, DEMO_SETTINGS);

export const updateSettings = (updates) => {
  const current = getFromLS(LS_KEYS.settings, DEMO_SETTINGS);
  const updated = { ...current, ...updates };
  saveToLS(LS_KEYS.settings, updated);
  return updated;
};

// ─── DASHBOARD STATS ─────────────────────────
export const getDashboardStats = () => {
  const videos = getFromLS(LS_KEYS.videos, DEMO_VIDEOS);
  const logs = getFromLS(LS_KEYS.logs, DEMO_ACCESS_LOGS);
  const alerts = getFromLS(LS_KEYS.alerts, DEMO_SECURITY_ALERTS);
  const enrollments = getFromLS(LS_KEYS.enrollments, []);

  const uniqueStudents = new Set(enrollments.map(e => e.studentId)).size;
  const successfulSessions = logs.filter(l => l.result === 'success').length;
  const openAlerts = alerts.filter(a => a.reviewStatus === 'open').length;

  return {
    protectedVideos: videos.filter(v => v.protectionStatus === 'protected').length,
    enrolledLearners: uniqueStudents,
    streamingSessions: successfulSessions,
    suspiciousEvents: openAlerts,
  };
};
