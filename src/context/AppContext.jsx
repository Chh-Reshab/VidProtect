// ============================================
// VIDPROTECT AI — APP CONTEXT
// Auth session + global UI state.
// The session lives in the server (httpOnly refresh cookie);
// nothing identifying is kept in localStorage/sessionStorage.
// ============================================

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  getDashboardStats, getMe, loadData, restoreSession, authLogout, clearData,
} from '../services/dataService';
import { onAuthLost, setAccessToken } from '../services/api';

const AppContext = createContext(null);

const statsFor = (user) =>
  user?.role === 'creator' ? getDashboardStats(user.id) : null;

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [ready, setReady] = useState(false); // false until we know whether a session exists
  const [dashboardStats, setDashboardStats] = useState(null);
  const [notification, setNotification] = useState(null);

  const isAuthenticated = !!currentUser;

  // Restore the session from the refresh cookie, and react to it dying later
  useEffect(() => {
    let alive = true;
    restoreSession().then((user) => {
      if (!alive) return;
      setCurrentUser(user);
      setDashboardStats(statsFor(user));
      setReady(true);
    });
    onAuthLost(() => {
      setAccessToken(null);
      clearData();
      setCurrentUser(null);
      setDashboardStats(null);
    });
    return () => { alive = false; };
  }, []);

  const refreshStats = useCallback(() => {
    setDashboardStats(statsFor(getMe()));
  }, []);

  // Re-read the signed-in user from the server (e.g. a creator application was approved)
  const refreshUser = useCallback(async () => {
    const ok = await loadData();
    const fresh = getMe();
    if (!ok || !fresh) return;
    setCurrentUser(fresh);
    setDashboardStats(statsFor(fresh));
  }, []);

  const login = (user) => {
    setCurrentUser(user);
    setDashboardStats(statsFor(user));
  };

  const logout = async () => {
    await authLogout();
    setCurrentUser(null);
    setDashboardStats(null);
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <AppContext.Provider value={{
      currentUser,
      isAuthenticated,
      ready,
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
