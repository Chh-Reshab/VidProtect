// ============================================
// Removing accounts and everything that belongs to them (self-service deletion, admin deletion,
// and clearing the old built-in beta accounts). A creator's courses, videos, thumbnails and CV go
// with them; a learner's progress, activity, settings and enrolments go.
// ============================================

import path from 'node:path';
import { db, save } from './db.js';
import * as blobs from './blobs.js';

// options.payments: 'anonymize' keeps payment records (money trails) without the person,
//                   'remove' deletes them
export const removeUsers = async (ids, { payments = 'anonymize' } = {}) => {
  const removedUsers = db.users.filter(u => ids.has(u.id));
  const courseIds = new Set(db.courses.filter(c => ids.has(c.creatorId)).map(c => c.id));
  const goneVideos = db.videos.filter(v => ids.has(v.creatorId) || courseIds.has(v.courseId));
  const goneCourses = db.courses.filter(c => courseIds.has(c.id));
  const videoIds = new Set(goneVideos.map(v => v.id));

  db.users = db.users.filter(u => !ids.has(u.id));
  db.courses = db.courses.filter(c => !courseIds.has(c.id));
  db.videos = db.videos.filter(v => !videoIds.has(v.id));
  db.enrollments = db.enrollments.filter(e => !ids.has(e.studentId) && !courseIds.has(e.courseId));
  db.payments = payments === 'remove'
    ? db.payments.filter(p => !ids.has(p.userId) && !courseIds.has(p.courseId))
    : db.payments.map(p => (ids.has(p.userId) ? { ...p, userId: 'deleted-user' } : p));
  db.logs = db.logs.filter(l => !ids.has(l.userId) && !videoIds.has(l.videoId) && !courseIds.has(l.courseId));
  db.alerts = db.alerts.filter(a => !ids.has(a.userId) && !videoIds.has(a.videoId));
  db.audit = payments === 'remove'
    ? db.audit.filter(a => !ids.has(a.actorId))
    : db.audit.map(a => (ids.has(a.actorId) || ids.has(a.targetId) ? { ...a, actorId: ids.has(a.actorId) ? 'deleted-user' : a.actorId, targetId: ids.has(a.targetId) ? 'deleted-user' : a.targetId } : a));
  db.sessions = db.sessions.filter(s => !ids.has(s.userId));
  db.streamSessions = db.streamSessions.filter(s => !ids.has(s.userId) && !videoIds.has(s.videoId));
  for (const map of [db.progress, db.settings, db.activity]) for (const id of ids) delete map[id];
  for (const perUser of Object.values(db.progress)) for (const id of videoIds) delete perUser[id];
  save();

  // Stored files last, best effort: the records are already gone
  const files = [];
  for (const v of goneVideos) {
    if (v.file?.name) files.push(['videos', v.file.name]);
    if (v.thumbUrl) files.push(['thumbs', path.basename(v.thumbUrl)]);
  }
  for (const c of goneCourses) if (c.thumbUrl) files.push(['thumbs', path.basename(c.thumbUrl)]);
  for (const u of removedUsers) {
    if (u.creatorApplication?.cv?.name) files.push(['cvs', u.creatorApplication.cv.name]);
    if (u.profile?.avatar) files.push(['avatars', u.profile.avatar]);
  }
  await Promise.all(files.map(([bucket, name]) => blobs.remove(bucket, name).catch(() => {})));

  return { users: removedUsers.length, courses: goneCourses.length, videos: goneVideos.length };
};
