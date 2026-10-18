// ============================================
// First-run state: an empty platform. There are no built-in accounts or sample content;
// the admin account is created from ADMIN_EMAIL / ADMIN_PASSWORD (see bootstrap.js).
// ============================================

export const buildSeed = () => ({
  meta: {},
  users: [],
  courses: [],
  videos: [],
  enrollments: [],
  logs: [],
  alerts: [],
  progress: {},        // { [userId]: { [videoId]: {positionSeconds, completed, updatedAt} } }
  settings: {},        // { [userId]: {...} }
  audit: [],
  sessions: [],        // refresh-token sessions
  streamSessions: [],  // short-lived playback sessions
});
