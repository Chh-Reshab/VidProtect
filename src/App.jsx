// ============================================
// APP.JSX — VidProtect AI Router
//   /learn/*   learners (and creators acting as learners)
//   /studio/*  creators
//   /admin/*   platform admins
// ============================================

import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AppProvider, useApp } from './context/AppContext';
import { InitialLoader } from './components/InitialLoader';
import ErrorBoundary from './components/ErrorBoundary';
import { RequireRole } from './auth/guards';
import { homeFor } from './auth/permissions';

// Every page is its own chunk, downloaded only when someone opens it (the landing page's 3D
// deck, for example, never reaches a signed-in creator)
const page = (load) => lazy(load);
const layout = (name) => lazy(() => import('./components/AppLayout').then(m => ({ default: m[name] })));
const LandingPage = page(() => import('./pages/LandingPage'));
const LoginPage = page(() => import('./pages/LoginPage'));
const VerifyEmailPage = page(() => import('./pages/VerifyEmailPage'));
const PrivacyPage = page(() => import('./pages/PrivacyPage'));
const TermsPage = page(() => import('./pages/TermsPage'));
const RefundPage = page(() => import('./pages/RefundPage'));
const ResetPasswordPage = page(() => import('./pages/ResetPasswordPage'));
const AdminAccount = page(() => import('./pages/admin/AdminAccount'));
const CreatorApplyPage = page(() => import('./pages/CreatorApplyPage'));
const StudioLayout = layout('StudioLayout');
const LearnerLayout = layout('LearnerLayout');
const AdminLayout = layout('AdminLayout');
const OverviewPage = page(() => import('./pages/OverviewPage'));
const LibraryPage = page(() => import('./pages/LibraryPage'));
const UploadPage = page(() => import('./pages/UploadPage'));
const VideoDetailPage = page(() => import('./pages/VideoDetailPage'));
const CoursesPage = page(() => import('./pages/CoursesPage'));
const AccessLogsPage = page(() => import('./pages/AccessLogsPage'));
const SecurityAlertsPage = page(() => import('./pages/SecurityAlertsPage'));
const SettingsPage = page(() => import('./pages/SettingsPage'));
const CreatorProfileEditor = page(() => import('./pages/CreatorProfileEditor'));
const CreatorProfile = page(() => import('./pages/learner/CreatorProfile'));
const ChatPage = page(() => import('./pages/ChatPage'));
const LearnerHome = page(() => import('./pages/learner/LearnerHome'));
const LearnerCourses = page(() => import('./pages/learner/LearnerCourses'));
const LearnerCourse = page(() => import('./pages/learner/LearnerCourse'));
const LearnerWatch = page(() => import('./pages/learner/LearnerWatch'));
const LearnerCheckout = page(() => import('./pages/learner/LearnerCheckout'));
const LearnerHistory = page(() => import('./pages/learner/LearnerHistory'));
const LearnerAccount = page(() => import('./pages/learner/LearnerAccount'));
const AdminOverview = page(() => import('./pages/admin/AdminOverview'));
const AdminCreators = page(() => import('./pages/admin/AdminCreators'));
const AdminUsers = page(() => import('./pages/admin/AdminUsers'));
const AdminContent = page(() => import('./pages/admin/AdminContent'));
const AdminAudit = page(() => import('./pages/admin/AdminAudit'));

// A page title for the tab and for search results
const TITLES = [
  ['/creator/login', 'Creator sign in'], ['/creator/apply', 'Creator application'], ['/login', 'Sign in'],
  ['/verify-email', 'Verify your email'], ['/reset-password', 'Reset your password'], ['/privacy', 'Privacy policy'],
  ['/terms', 'Terms of service'], ['/refund-policy', 'Refund policy'],
  ['/learn/chat', 'Discussion'], ['/studio/chat', 'Discussion'], ['/admin/chat', 'Discussion moderation'],
  ['/learn', 'Learn'], ['/studio', 'Creator studio'], ['/admin', 'Admin'],
];
const DEFAULT_TITLE = 'VidProtect AI — Secure the Content. Protect the Creator.';
const TitleManager = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const found = TITLES.find(([prefix]) => pathname.startsWith(prefix));
    document.title = found ? `${found[1]} — VidProtect AI` : DEFAULT_TITLE;
  }, [pathname]);
  return null;
};

const Spinner = () => <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

// Old /app/* links land on the right dashboard for the signed-in role
const LegacyRedirect = () => {
  const { currentUser } = useApp();
  return <Navigate to={currentUser ? homeFor(currentUser) : '/login'} replace />;
};

const AppRoutes = () => {
  const { currentUser, isAuthenticated, ready } = useApp();

  // Wait until we know whether the refresh cookie restores a session
  if (!ready) return <Spinner />;

  return (
    <Suspense fallback={<Spinner />}>
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/refund-policy" element={<RefundPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/creator/login" element={isAuthenticated ? <Navigate to={homeFor(currentUser)} replace /> : <LoginPage portal="creator" />} />
      <Route path="/creator/apply" element={<CreatorApplyPage />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to={homeFor(currentUser)} replace /> : <LoginPage />} />

      {/* Learners (creators may also learn) */}
      <Route element={<RequireRole roles={['learner', 'creator']} />}>
        <Route path="/learn" element={<LearnerLayout />}>
          <Route index element={<LearnerHome />} />
          <Route path="courses" element={<LearnerCourses mode="mine" />} />
          <Route path="catalog" element={<LearnerCourses mode="catalog" />} />
          <Route path="course/:courseId" element={<LearnerCourse />} />
          <Route path="checkout/:courseId" element={<LearnerCheckout />} />
          <Route path="creator/:creatorId" element={<CreatorProfile />} />
          <Route path="chat" element={<ChatPage />} />
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
          <Route path="profile" element={<CreatorProfileEditor />} />
          <Route path="chat" element={<ChatPage />} />
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
          <Route path="account" element={<AdminAccount />} />
          <Route path="chat" element={<ChatPage />} />
        </Route>
      </Route>

      {/* Old URLs */}
      <Route path="/app/*" element={<LegacyRedirect />} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
};

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <TitleManager />
        <InitialLoader>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </InitialLoader>
      </BrowserRouter>
    </AppProvider>
  );
}
