// ============================================
// DASHBOARD OVERVIEW — VidProtect AI
// ============================================

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Video, Users, Play, ShieldAlert, Upload, BookOpen, ArrowRight, Activity, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getAccessLogs, getSecurityAlerts } from '../services/dataService';
import { KpiCard, SectionLabel, ProtectionStatusPanel, ResultBadge, SeverityBadge } from '../components/SharedComponents';

export default function OverviewPage() {
  const { dashboardStats, currentUser } = useApp();
  const navigate = useNavigate();
  // Everything on this page is scoped to the signed-in creator's own content
  const [recentLogs] = useState(() => getAccessLogs(currentUser.id).slice(0, 5));
  const [recentAlerts] = useState(() =>
    getSecurityAlerts(currentUser.id).filter(a => a.reviewStatus === 'open').slice(0, 3));

  const formatTime = (iso) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    return d.toLocaleDateString();
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      {/* Page header */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <SectionLabel>CREATOR DASHBOARD</SectionLabel>
          <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
            OVERVIEW
          </h1>
          <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>
            Welcome back, {currentUser?.name}. Here's your security snapshot.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <Link to="/studio/upload" className="btn btn-primary" style={{ fontSize: '0.7rem' }}>
            <Upload size={14} /> UPLOAD VIDEO
          </Link>
          <Link to="/studio/alerts" className="btn btn-secondary" style={{ fontSize: '0.7rem' }}>
            <ShieldAlert size={14} /> REVIEW ALERTS
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1px', background: '#292929', border: '1px solid #292929', marginBottom: '2rem' }}>
        <KpiCard
          label="PROTECTED VIDEOS"
          value={dashboardStats?.protectedVideos ?? 0}
          sublabel="AES-256-GCM encrypted"
          icon={Lock}
          accent
        />
        <KpiCard
          label="ENROLLED LEARNERS"
          value={dashboardStats?.enrolledLearners ?? 0}
          sublabel="Across all courses"
          icon={Users}
        />
        <KpiCard
          label="STREAMING SESSIONS"
          value={dashboardStats?.streamingSessions ?? 0}
          sublabel="Authorized access events"
          icon={Play}
        />
        <KpiCard
          label="OPEN SECURITY ALERTS"
          value={dashboardStats?.suspiciousEvents ?? 0}
          sublabel="Require review"
          icon={ShieldAlert}
          accent={dashboardStats?.suspiciousEvents > 0}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }} className="overview-grid">
        {/* Protection Status */}
        <ProtectionStatusPanel />

        {/* Quick Actions */}
        <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1.25rem' }}>
          <div className="mono" style={{ color: '#A0A0A0', marginBottom: '1rem', fontSize: '0.7rem' }}>QUICK ACTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {[
              { label: 'Upload New Video', icon: Upload, to: '/studio/upload', variant: 'primary' },
              { label: 'View Video Library', icon: Video, to: '/studio/library', variant: 'secondary' },
              { label: 'Manage Enrollments', icon: BookOpen, to: '/studio/courses', variant: 'secondary' },
              { label: 'Review Security Alerts', icon: ShieldAlert, to: '/studio/alerts', variant: 'secondary' },
              { label: 'View Access Logs', icon: Activity, to: '/studio/logs', variant: 'secondary' },
            ].map(action => (
              <Link key={action.label} to={action.to} className={`btn btn-${action.variant}`} style={{ fontSize: '0.7rem', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <action.icon size={14} />
                  {action.label}
                </span>
                <ArrowRight size={12} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div style={{ marginTop: '2rem', background: '#1D1D1D', border: '1px solid #292929' }}>
        <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="mono" style={{ color: '#A0A0A0', fontSize: '0.7rem' }}>RECENT ACCESS ACTIVITY</div>
          <Link to="/studio/logs" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>VIEW ALL</Link>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="vp-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Video</th>
                <th>Event</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.map(log => (
                <tr key={log.id}>
                  <td className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', whiteSpace: 'nowrap' }}>{formatTime(log.timestamp)}</td>
                  <td style={{ fontSize: '0.8rem' }}>{log.userName}</td>
                  <td style={{ fontSize: '0.8rem', color: '#A0A0A0' }}>{log.videoTitle}</td>
                  <td className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{log.eventType.replace(/_/g, ' ').toUpperCase()}</td>
                  <td><ResultBadge result={log.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Security Alerts */}
      {recentAlerts.length > 0 && (
        <div style={{ marginTop: '1.5rem', background: '#1D1D1D', border: '1px solid #FF2028' }}>
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,32,40,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert size={16} color="#FF2028" />
              <div className="mono" style={{ color: '#FF2028', fontSize: '0.7rem' }}>OPEN SECURITY ALERTS — ACTION REQUIRED</div>
            </div>
            <Link to="/studio/alerts" className="btn btn-danger" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}>REVIEW ALL</Link>
          </div>
          {recentAlerts.map(alert => (
            <div key={alert.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid #292929' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                    <SeverityBadge severity={alert.severity} />
                    <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{alert.alertType.replace(/_/g, ' ').toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#A0A0A0', maxWidth: '600px' }}>{alert.explanation.substring(0, 120)}...</div>
                </div>
                <button onClick={() => navigate('/studio/alerts')} className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem', whiteSpace: 'nowrap' }}>
                  REVIEW
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .overview-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
