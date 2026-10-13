// ============================================
// ADMIN OVERVIEW — platform-wide numbers
// ============================================

import { Link } from 'react-router-dom';
import { Users, Clapperboard, Video, ShieldAlert, UserCheck, BookOpen } from 'lucide-react';
import { getPlatformStats, getAuditLog, getUserById } from '../../services/mockServices';
import { KpiCard, DemoBanner } from '../../components/SharedComponents';
import { PageHeader, Panel, formatDate } from '../../components/DashboardKit';

export default function AdminOverview() {
  const stats = getPlatformStats();
  const recent = getAuditLog().slice(0, 6);

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="PLATFORM OVERVIEW" subtitle="Users, content and security across all creators." />
      <DemoBanner />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1px', marginBottom: '1.5rem' }}>
        <KpiCard label="LEARNERS" value={stats.learners} icon={Users} />
        <KpiCard label="CREATORS" value={stats.creators} icon={Clapperboard} />
        <KpiCard label="COURSES" value={stats.courses} icon={BookOpen} />
        <KpiCard label="VIDEOS" value={stats.videos} icon={Video} />
        <KpiCard label="OPEN ALERTS" value={stats.openAlerts} icon={ShieldAlert} accent={stats.openAlerts > 0} />
        <KpiCard label="PENDING CREATORS" value={stats.pendingCreators} icon={UserCheck} accent={stats.pendingCreators > 0} sublabel={stats.suspended ? `${stats.suspended} suspended account(s)` : undefined} />
      </div>

      {stats.pendingCreators > 0 && (
        <div style={{ background: '#1D1D1D', border: '1px solid #FF2028', padding: '1rem 1.25rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.85rem' }}>{stats.pendingCreators} creator application(s) are waiting for review.</span>
          <Link to="/admin/creators" className="btn btn-primary" style={{ fontSize: '0.65rem' }}>REVIEW</Link>
        </div>
      )}

      <Panel title="RECENT ADMIN ACTIONS" action={<Link to="/admin/audit" className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }}>FULL LOG</Link>}>
        {recent.length === 0 ? (
          <div style={{ padding: '1.5rem', textAlign: 'center', color: '#565656', fontSize: '0.85rem' }}>No admin actions recorded yet.</div>
        ) : recent.map(a => (
          <div key={a.id} style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid #292929', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.85rem' }}>
              <span className="mono" style={{ color: '#FF2028', fontSize: '0.7rem' }}>{a.action}</span>
              {' '}· {getUserById(a.actorId)?.name || a.actorId} → {a.targetId}
            </span>
            <span className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{formatDate(a.createdAt)}</span>
          </div>
        ))}
      </Panel>
    </div>
  );
}
