// ============================================
// APP LAYOUT — Sidebar + Dashboard Shell
// ============================================

import { useState } from 'react';
import { Link, NavLink, useNavigate, Outlet } from 'react-router-dom';
import {
  LayoutDashboard, Video, Upload, BookOpen, ScrollText,
  ShieldAlert, Settings, LogOut,
  Menu, X, Compass, History, User, Users,
  UserCheck, Layers, ClipboardList, Repeat
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Logo, NotificationToast, BetaBanner } from './SharedComponents';

const STUDIO_NAV = [
  { to: '/studio/library', icon: Video, label: 'My Videos' },
  { to: '/studio/upload', icon: Upload, label: 'Upload' },
  { to: '/studio/courses', icon: BookOpen, label: 'Courses' },
];
const STUDIO_MORE = [
  { to: '/studio/logs', icon: ScrollText, label: 'Who watched' },
  { to: '/studio/alerts', icon: ShieldAlert, label: 'Security alerts' },
  { to: '/studio/settings', icon: Settings, label: 'Settings' },
];

const LEARNER_NAV = [
  { to: '/learn', icon: LayoutDashboard, label: 'Home', end: true },
  { to: '/learn/catalog', icon: Compass, label: 'Browse courses' },
];
const LEARNER_MORE = [
  { to: '/learn/history', icon: History, label: 'Watch history' },
  { to: '/learn/account', icon: User, label: 'Profile' },
];

const ADMIN_NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Overview', end: true },
  { to: '/admin/creators', icon: UserCheck, label: 'Creator approvals' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/content', icon: Layers, label: 'Content' },
];
const ADMIN_MORE = [
  { to: '/admin/audit', icon: ClipboardList, label: 'Audit log' },
  { to: '/admin/account', icon: User, label: 'Account' },
];

const initials = (name) =>
  name ? name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';

const DashboardShell = ({ navItems, moreItems = [], roleLabel, homePath, switchTo, action }) => {
  const { currentUser, logout } = useApp();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const renderLink = ({ to, icon: Icon, label, end }, primary) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setSidebarOpen(false)}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: primary ? '0.8rem 1rem' : '0.5rem 1rem',
        textDecoration: 'none',
        color: isActive ? '#F8F8F8' : primary ? '#C8C8C8' : '#808080',
        background: isActive ? 'rgba(255,32,40,0.08)' : 'transparent',
        borderLeft: isActive ? '3px solid #FF2028' : '3px solid transparent',
        fontSize: primary ? '0.95rem' : '0.8rem',
        fontWeight: primary ? 500 : 400,
        transition: 'all 0.15s',
      })}
    >
      <Icon size={primary ? 18 : 15} />
      <span>{label}</span>
    </NavLink>
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#101010' }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 40 }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── SIDEBAR ── */}
      <aside style={{
        width: '240px',
        background: '#171717',
        borderRight: '1px solid #292929',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0, bottom: 0, left: 0,
        zIndex: 50,
        transform: sidebarOpen ? 'translateX(0)' : undefined,
        transition: 'transform 0.25s ease',
      }} className="sidebar">
        {/* Sidebar header */}
        <div style={{ padding: '1.25rem 1rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Link to={homePath} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Logo size="sm" />
            <span className="mono" style={{ fontSize: '0.7rem', color: '#eab308', border: '1px solid #eab308', padding: '1px 4px' }}>BETA</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            style={{ background: 'none', border: 'none', color: '#8B8B8B', cursor: 'pointer', display: 'none' }}
            className="sidebar-close-btn"
          >
            <X size={18} />
          </button>
        </div>

        {/* User info */}
        <div style={{ padding: '1rem', borderBottom: '1px solid #292929', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 32, height: 32,
            background: '#FF2028',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '0.7rem', fontWeight: 600,
            color: '#fff',
            flexShrink: 0,
          }}>
            {initials(currentUser?.name)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#F8F8F8', lineHeight: 1.2 }}>{currentUser?.name}</div>
            <div className="mono" style={{ fontSize: '0.7rem', color: '#FF2028' }}>{roleLabel}</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
          {navItems.map(item => renderLink(item, true))}
          {moreItems.length > 0 && (
            <>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', padding: '1.25rem 1rem 0.35rem', letterSpacing: '0.12em' }}>MORE</div>
              {moreItems.map(item => renderLink(item, false))}
            </>
          )}
        </nav>

        {switchTo && (
          <Link
            to={switchTo.to}
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderTop: '1px solid #292929', color: '#A0A0A0', textDecoration: 'none', fontSize: '0.8rem' }}
          >
            <Repeat size={14} />
            <span>{switchTo.label}</span>
          </Link>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.85rem 1rem',
            background: 'none', border: 'none',
            color: '#8B8B8B', cursor: 'pointer',
            fontSize: '0.85rem', width: '100%', textAlign: 'left',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.color = '#FF2028'}
          onMouseLeave={e => e.currentTarget.style.color = '#565656'}
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <div style={{ marginLeft: '240px', flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }} className="main-content">
        {/* Top bar */}
        <header style={{
          background: '#171717',
          borderBottom: '1px solid #292929',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          position: 'sticky',
          top: 0,
          zIndex: 30,
        }}>
          <button
            onClick={() => setSidebarOpen(true)}
            style={{ background: 'none', border: 'none', color: '#8B8B8B', cursor: 'pointer', display: 'none', padding: '4px' }}
            className="mobile-menu-btn"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          <div style={{ flex: 1 }} />

          {action && (
            <Link to={action.to} className="btn btn-primary" style={{ fontSize: '0.75rem' }}>
              <action.icon size={14} /> {action.label}
            </Link>
          )}
        </header>

        <BetaBanner />

        {/* Page content */}
        <main style={{ flex: 1, overflow: 'auto' }}>
          <Outlet />
        </main>
      </div>

      <NotificationToast />

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
            width: 260px !important;
          }
          .main-content {
            margin-left: 0 !important;
          }
          .mobile-menu-btn {
            display: flex !important;
          }
          .sidebar-close-btn {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .sidebar {
            transform: translateX(0) !important;
          }
        }
      `}</style>
    </div>
  );
};

// ── Role-specific shells ──────────────────────
export const StudioLayout = () => (
  <DashboardShell
    navItems={STUDIO_NAV}
    moreItems={STUDIO_MORE}
    roleLabel="CREATOR"
    homePath="/studio/library"
    action={{ to: '/studio/upload', icon: Upload, label: 'Upload video' }}
    switchTo={{ to: '/learn', label: 'Switch to learner view' }}
  />
);

export const LearnerLayout = () => {
  const { currentUser } = useApp();
  return (
    <DashboardShell
      navItems={LEARNER_NAV}
      moreItems={LEARNER_MORE}
      roleLabel="LEARNER"
      homePath="/learn"
      switchTo={currentUser?.role === 'creator' ? { to: '/studio/library', label: 'Back to Creator Studio' } : null}
    />
  );
};

export const AdminLayout = () => (
  <DashboardShell navItems={ADMIN_NAV} moreItems={ADMIN_MORE} roleLabel="PLATFORM ADMIN" homePath="/admin" />
);
