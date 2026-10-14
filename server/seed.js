// ============================================
// SEED — first-run demo data (accounts, courses, videos).
// Seeded videos have no media file; uploaded ones do.
// ============================================

import bcrypt from 'bcryptjs';
import {
  DEMO_USERS, DEMO_PASSWORD, DEMO_COURSES, DEMO_VIDEOS,
  DEMO_ACCESS_LOGS, DEMO_SECURITY_ALERTS,
} from './seedData.js';

export const buildSeed = () => {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 12);

  const people = [
    DEMO_USERS.admin,
    DEMO_USERS.creator,
    ...DEMO_USERS.creators,
    ...DEMO_USERS.students,
    ...DEMO_USERS.applicants,
  ];

  const users = people.map(({ enrolledCourses: _courses, demo: _demo, ...u }) => ({ ...u, passwordHash }));

  const enrollments = [];
  people.forEach(u => {
    (u.enrolledCourses || []).forEach((courseId, i) => {
      enrollments.push({
        id: `enr-${u.id}-${i}`,
        studentId: u.id,
        courseId,
        enrolledAt: new Date().toISOString(),
        status: u.status === 'suspended' ? 'suspended' : 'active',
        source: 'invite',
      });
    });
  });

  return {
    meta: {},
    users,
    courses: DEMO_COURSES,
    videos: DEMO_VIDEOS,
    enrollments,
    logs: DEMO_ACCESS_LOGS,
    alerts: DEMO_SECURITY_ALERTS,
    progress: {},        // { [userId]: { [videoId]: {positionSeconds, completed, updatedAt} } }
    settings: {},        // { [userId]: {...} }
    audit: [],
    sessions: [],        // refresh-token sessions
    streamSessions: [],  // short-lived playback sessions
  };
};
