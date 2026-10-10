// ============================================
// VIDPROTECT AI — APP CONTEXT
// Global state management via React Context
// ============================================

import { createContext, useContext, useState, useEffect } from 'react';
import { initDemoData, getDashboardStats } from '../services/mockServices';

const AppContext = createContext(null);

export const AppProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [dashboardStats, setDashboardStats] = useState(null);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    initDemoData();
    // Check persisted session
    const savedUser = sessionStorage.getItem('vp_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsAuthenticated(true);
    }
    refreshStats();
  }, []);

  const refreshStats = () => {
    const stats = getDashboardStats();
    setDashboardStats(stats);
  };

  const login = (user) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    sessionStorage.setItem('vp_user', JSON.stringify(user));
    refreshStats();
  };

  const logout = () => {
    setCurrentUser(null);
    setIsAuthenticated(false);
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
      showNotification,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
};
