// ============================================
// APP.JSX — VidProtect AI Router
//   /learn/*   learners (and creators acting as learners)
//   /studio/*  creators
//   /admin/*   platform admins
// ============================================

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { StudioLayout, LearnerLayout, AdminLayout } from './components/AppLayout';
import { InitialLoader } from './components/InitialLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireRole } from './auth/guards';
import { homeFor } from './auth/permissions';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import LibraryPage from './pages/LibraryPage';
import UploadPage from './pages/UploadPage';
import VideoDetailPage from './pages/VideoDetailPage';
import CoursesPage from './pages/CoursesPage';
import AccessLogsPage from './pages/AccessLogsPage';
import SecurityAlertsPage from './pages/SecurityAlertsPage';
import SettingsPage from './pages/SettingsPage';
import LearnerHome from './pages/learner/LearnerHome';
import LearnerCourses from './pages/learner/LearnerCourses';
import LearnerCourse from './pages/learner/LearnerCourse';
import LearnerWatch from './pages/learner/LearnerWatch';
import LearnerCheckout from './pages/learner/LearnerCheckout';
import LearnerHistory from './pages/learner/LearnerHistory';
import LearnerAccount from './pages/learner/LearnerAccount';
import AdminOverview from './pages/admin/AdminOverview';
import AdminCreators from './pages/admin/AdminCreators';
import AdminUsers from './pages/admin/AdminUsers';
import AdminContent from './pages/admin/AdminContent';
import AdminAudit from './pages/admin/AdminAudit';

// Old /app/* links land on the right dashboard for the signed-in role
const LegacyRedirect = () => {
  const { currentUser } = useApp();
  return <Navigate to={currentUser ? homeFor(currentUser) : '/login'} replace />;
};

const AppRoutes = () => {
  const { currentUser, isAuthenticated, ready } = useApp();

  // Wait until we know whether the refresh cookie restores a session
  if (!ready) {
    return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={homeFor(currentUser)} replace /> : <LoginPage />} />

      {/* Learners (creators may also learn) */}
      <Route element={<RequireRole roles={['learner', 'creator']} />}>
        <Route path="/learn" element={<LearnerLayout />}>
          <Route index element={<LearnerHome />} />
          <Route path="courses" element={<LearnerCourses mode="mine" />} />
          <Route path="catalog" element={<LearnerCourses mode="catalog" />} />
          <Route path="course/:courseId" element={<LearnerCourse />} />
          <Route path="checkout/:courseId" element={<LearnerCheckout />} />
          <Route path="watch/:videoId" element={<LearnerWatch />} />
          <Route path="history" element={<LearnerHistory />} />
          <Route path="account" element={<LearnerAccount />} />
        </Route>
      </Route>

      {/* Creator Studio */}
      <Route element={<RequireRole roles={['creator']} />}>
        <Route path="/studio" element={<StudioLayout />}>
          <Route index element={<Navigate to="/studio/library" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="library" element={<LibraryPage />} />
          <Route path="upload" element={<UploadPage />} />
          <Route path="video/:id" element={<VideoDetailPage />} />
          <Route path="preview/:videoId" element={<LearnerWatch />} />
          <Route path="courses" element={<CoursesPage />} />
          <Route path="logs" element={<AccessLogsPage />} />
          <Route path="alerts" element={<SecurityAlertsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* Platform admin */}
      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminOverview />} />
          <Route path="creators" element={<AdminCreators />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="content" element={<AdminContent />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
      </Route>

      {/* Old URLs */}
      <Route path="/app/*" element={<LegacyRedirect />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <InitialLoader>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </InitialLoader>
      </BrowserRouter>
    </AppProvider>
  );
}
