// ============================================
// ACCESS — shared rules: who may stream what, logging, alerts
// ============================================

import { db, save, uid } from './db.js';

export const findUser = (id) => db.users.find(u => u.id === id);
export const findCourse = (id) => db.courses.find(c => c.id === id);
export const findVideo = (id) => db.videos.find(v => v.id === id);

export const audit = (actorId, action, targetType, targetId, meta = {}) => {
  db.audit.unshift({ id: uid('aud'), actorId, action, targetType, targetId, meta, createdAt: new Date().toISOString() });
  db.audit = db.audit.slice(0, 1000);
  save();
};

export const recordLog = (event, userObj = null) => {
  const log = { id: uid('log'), timestamp: new Date().toISOString(), ...event };
  db.logs.unshift(log);
  db.logs = db.logs.slice(0, 2000);
  save();
  // Run velocity check after authorized streams (denial check is in logDenied)
  if (userObj && event.eventType === 'stream_authorized') {
    const video = findVideo(event.videoId);
    if (video) analyzePatterns(userObj, video);
  }
  return log;
};

// ── AI Anomaly Detection ─────────────────────────────────────────────
// Analyses recent access logs for a user and raises alerts when
// suspicious patterns are detected. Called after every denied event
// and after every successful stream session (for velocity checks).

const ANOMALY_RULES = [
  {
    type: 'repeated_denial',
    severity: 'high',
    check: (logs) => {
      const denials = logs.filter(l => l.result === 'denied');
      return denials.length >= 3
        ? { triggered: true, count: denials.length, explanation: `${denials.length} access-denied events in 60 minutes.`, action: 'Review account activity and confirm enrollment status.' }
        : { triggered: false };
    },
  },
  {
    type: 'velocity_burst',
    severity: 'medium',
    check: (logs) => {
      // More than 10 stream sessions started in 10 minutes → unusual burst
      const tenMin = Date.now() - 600000;
      const recent = logs.filter(l => l.eventType === 'stream_authorized' && new Date(l.timestamp).getTime() > tenMin);
      return recent.length >= 10
        ? { triggered: true, count: recent.length, explanation: `${recent.length} stream sessions started within 10 minutes.`, action: 'Check for automated scraping or credential sharing.' }
        : { triggered: false };
    },
  },
  {
    type: 'off_hours_access',
    severity: 'low',
    check: (logs) => {
      // Access between midnight and 4am local server time flagged as unusual
      const midnight = logs.filter(l => {
        const h = new Date(l.timestamp).getHours();
        return h >= 0 && h < 4;
      });
      return midnight.length >= 5
        ? { triggered: true, count: midnight.length, explanation: `${midnight.length} events between midnight and 4am.`, action: 'Verify this is not automated access or account sharing.' }
        : { triggered: false };
    },
  },
];

export const analyzePatterns = (user, video) => {
  const hourAgo = Date.now() - 3600000;
  const logs = db.logs.filter(l => l.userId === user.id && new Date(l.timestamp).getTime() > hourAgo);

  for (const rule of ANOMALY_RULES) {
    const result = rule.check(logs);
    if (!result.triggered) continue;
    // Only one open alert per user per rule type at a time
    if (db.alerts.some(a => a.userId === user.id && a.alertType === rule.type && a.reviewStatus === 'open')) continue;
    db.alerts.unshift({
      id: uid('alert'),
      severity: rule.severity,
      alertType: rule.type,
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      videoId: video.id,
      videoTitle: video.title,
      explanation: result.explanation,
      reviewStatus: 'open',
      recommendedAction: result.action,
      resolvedAt: null,
    });
  }
  save();
};

const flagRepeatedDenials = (user, video) => analyzePatterns(user, video);

// The one rule for playback. Used when a stream session starts, when it renews,
// and on every byte-range request, so changes apply mid-playback.
export const checkVideoAccess = (user, video) => {
  const course = findCourse(video.courseId);
  if (!user || user.status !== 'active') return { ok: false, reason: 'Account suspended — access restricted' };
  if (!course) return { ok: false, reason: 'Video not found.', hidden: true };
  if (video.uploadStatus === 'processing' || video.uploadStatus === 'failed') {
    return { ok: false, reason: 'This video is not ready yet.', hidden: true };
  }

  const isOwner = user.role === 'creator' && video.creatorId === user.id;
  const isAdmin = user.role === 'admin';
  if (isOwner || isAdmin) return { ok: true, course, privileged: true };

  if (course.status !== 'active') return { ok: false, reason: 'This course is not published.', course };
  const enrollment = db.enrollments.find(e => e.studentId === user.id && e.courseId === course.id);
  if (!enrollment) return { ok: false, reason: 'Enrollment verification failed — not enrolled in course', course };
  if (enrollment.status !== 'active') return { ok: false, reason: 'Your enrollment is suspended.', course };
  return { ok: true, course };
};

export const logDenied = (user, video, reason) => {
  recordLog({
    userId: user.id, userName: user.name,
    videoId: video.id, videoTitle: video.title, courseId: video.courseId,
    eventType: 'access_denied', result: 'denied', reason,
    sessionRef: uid('sess'), tokenRef: null,
  });
  flagRepeatedDenials(user, video);
};
