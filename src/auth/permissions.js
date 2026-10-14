// ============================================
// PERMISSIONS — role → permission map + policies
// Shared by the SPA (to hide controls) and the Express server
// (which enforces them: role checks + ownership on every request).
// ============================================

export const ROLES = { LEARNER: 'learner', CREATOR: 'creator', ADMIN: 'admin' };

const LEARNER_PERMS = ['course:read', 'enrollment:self', 'video:stream', 'progress:own'];

const CREATOR_PERMS = [
  ...LEARNER_PERMS,
  'studio:access',
  'course:create', 'course:update:own',
  'video:upload:own', 'video:delete:own',
  'enrollment:manage:own',
  'logs:read:own', 'alerts:read:own', 'alerts:update:own',
];

const ADMIN_PERMS = [
  'course:read', 'video:stream',
  'admin:access', 'user:manage', 'creator:approve',
  'content:moderate', 'audit:read', 'enrollment:manage:any',
];

export const ROLE_PERMISSIONS = {
  learner: LEARNER_PERMS,
  creator: CREATOR_PERMS,
  admin: ADMIN_PERMS,
};

export const can = (user, permission) =>
  !!user && user.status !== 'suspended' && (ROLE_PERMISSIONS[user.role] || []).includes(permission);

// Where each role lands after login
export const homeFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'creator') return '/studio/overview';
  return '/learn';
};

// ── Ownership policies ──────────────────────
export const canManageCourse = (user, course) =>
  !!user && !!course && user.status !== 'suspended' &&
  (user.role === 'admin' || (user.role === 'creator' && course.creatorId === user.id));

export const canManageVideo = (user, video) =>
  !!user && !!video && user.status !== 'suspended' &&
  (user.role === 'admin' || (user.role === 'creator' && video.creatorId === user.id));
