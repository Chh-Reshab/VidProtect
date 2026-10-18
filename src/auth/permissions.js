// ============================================
// PERMISSIONS — who may do what, shared by the SPA (routing, hiding controls) and the Express
// server (which enforces it on every request: role checks + ownership + creator approval).
// ============================================

// Creator accounts are locked until an admin approves their application. Accounts created
// before applications existed have no creatorStatus and count as approved.
export const isCreatorLocked = (user) =>
  !!user && user.role === 'creator' && !!user.creatorStatus && user.creatorStatus !== 'approved';

// Where each role lands after login
export const homeFor = (user) => {
  if (!user) return '/login';
  if (user.role === 'admin') return '/admin';
  if (user.role === 'creator') return isCreatorLocked(user) ? '/creator/apply' : '/studio/library';
  return '/learn';
};

// ── Ownership policies ──────────────────────
export const canManageCourse = (user, course) =>
  !!user && !!course && user.status !== 'suspended' && !isCreatorLocked(user) &&
  (user.role === 'admin' || (user.role === 'creator' && course.creatorId === user.id));

export const canManageVideo = (user, video) =>
  !!user && !!video && user.status !== 'suspended' && !isCreatorLocked(user) &&
  (user.role === 'admin' || (user.role === 'creator' && video.creatorId === user.id));
