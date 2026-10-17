// ============================================
// ROUTE GUARDS
// UX-level protection only — a real backend must re-check
// every request. Wrong role → bounced to that role's home.
// ============================================

import { Navigate, Outlet } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { can, homeFor, isCreatorLocked } from './permissions';

export const RequireRole = ({ roles }) => {
  const { currentUser, isAuthenticated } = useApp();
  if (!isAuthenticated) return <Navigate to={roles.length === 1 && roles[0] === 'creator' ? '/creator/login' : '/login'} replace />;
  if (isCreatorLocked(currentUser)) return <Navigate to="/creator/apply" replace />; // not approved yet: only the application is open
  if (!roles.includes(currentUser.role)) return <Navigate to={homeFor(currentUser)} replace />;
  return <Outlet />;
};

// Renders children only if the signed-in user holds the permission
export const Can = ({ do: permission, children, fallback = null }) => {
  const { currentUser } = useApp();
  return can(currentUser, permission) ? children : fallback;
};
