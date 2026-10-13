// ============================================
// VIDPROTECT AI — APP CONTEXT
// Auth session + global UI state
// ============================================

import { createContext, useContext, useState, useCallback } from 'react';
import { getDashboardStats, getUserById } from '../services/mockServices';

const AppContext = createContext(null);

// Only public fields are kept in the session (never a password or hash).
// On load the user is re-read from the store so role/status changes
// (e.g. an admin suspending the account) take effect immediately.
const loadSessionUser = () => {
  try {
    const saved = JSON.parse(sessionStorage.getItem('vp_user'));
    if (!saved?.id) return null;
    const fresh = getUserById(saved.id);
    return fresh && fresh.status === 'active' ? fresh : null;
  } catch {
    return null;
  }
};

const statsFor = (user) =>
  user?.role === 'creator' ? getDashboardStats(user.id) : null;

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(loadSessionUser);
  const [dashboardStats, setDashboardStats] = useState(() => statsFor(loadSessionUser()));
  const [notification, setNotification] = useState(null);

  const isAuthenticated = !!currentUser;

  const refreshStats = useCallback(() => {
    setDashboardStats(statsFor(currentUser));
  }, [currentUser]);

  // Re-read the signed-in user (after e.g. a creator application is approved)
  const refreshUser = useCallback(() => {
    if (!currentUser) return;
    const fresh = getUserById(currentUser.id);
    if (!fresh || fresh.status !== 'active') {
      sessionStorage.removeItem('vp_user');
      setCurrentUser(null);
      return;
    }
    sessionStorage.setItem('vp_user', JSON.stringify(fresh));
    setCurrentUser(fresh);
    setDashboardStats(statsFor(fresh));
  }, [currentUser]);

  const login = (user) => {
    setCurrentUser(user);
    sessionStorage.setItem('vp_user', JSON.stringify(user));
    setDashboardStats(statsFor(user));
  };

  const logout = () => {
    setCurrentUser(null);
    setDashboardStats(null);
    sessionStorage.removeItem('vp_user');
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      isAuthenticated,
      dashboardStats,
      notification,
      login,
      logout,
      refreshStats,
      refreshUser,
      showNotification,
    }}>
      {children}
    </AppContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
