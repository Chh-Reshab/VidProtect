// Builds a database state for the tests: the sample accounts, courses and videos from seedData.js,
// all sharing one password that the test run picked (cost 4 keeps the hashing fast).
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { DEMO_USERS, DEMO_COURSES, DEMO_VIDEOS, DEMO_ACCESS_LOGS, DEMO_SECURITY_ALERTS } from './seedData.js';

export const buildFixture = (password) => {
  const passwordHash = bcrypt.hashSync(password, 4);
  const people = [DEMO_USERS.admin, DEMO_USERS.creator, ...DEMO_USERS.creators, ...DEMO_USERS.students, ...DEMO_USERS.applicants];
  const users = people.map(({ enrolledCourses: _courses, demo: _demo, ...u }) => ({ ...u, passwordHash }));
  const enrollments = [];
  people.forEach(u => (u.enrolledCourses || []).forEach((courseId, i) => enrollments.push({
    id: `enr-${u.id}-${i}`, studentId: u.id, courseId, enrolledAt: new Date().toISOString(),
    status: u.status === 'suspended' ? 'suspended' : 'active', source: 'invite',
  })));
  return {
    meta: { jwtSecret: crypto.randomBytes(24).toString('hex'), createdAt: new Date().toISOString() },
    users, courses: DEMO_COURSES, videos: DEMO_VIDEOS, enrollments, logs: DEMO_ACCESS_LOGS, alerts: DEMO_SECURITY_ALERTS,
    progress: {}, settings: {}, activity: {}, payments: [], audit: [], sessions: [], streamSessions: [],
  };
};
