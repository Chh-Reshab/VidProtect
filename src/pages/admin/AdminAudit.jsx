// ============================================
// ADMIN — audit log of admin actions
// ============================================

import { ClipboardList } from 'lucide-react';
import { getAuditLog, getUserById } from '../../services/mockServices';
import { EmptyState, DemoBanner } from '../../components/SharedComponents';
import { PageHeader, Panel, formatDate } from '../../components/DashboardKit';

export default function AdminAudit() {
  const entries = getAuditLog();

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="AUDIT LOG" subtitle="Every approval, suspension, role change and takedown." />
      <DemoBanner />

      {entries.length === 0 ? (
        <EmptyState icon={ClipboardList} title="NOTHING LOGGED YET" description="Admin actions will be recorded here." />
      ) : (
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table className="vp-table">
              <thead>
                <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr>
              </thead>
              <tbody>
                {entries.map(a => (
                  <tr key={a.id}>
                    <td className="mono" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatDate(a.createdAt)}</td>
                    <td>{getUserById(a.actorId)?.name || a.actorId}</td>
                    <td className="mono" style={{ color: '#FF2028', fontSize: '0.75rem' }}>{a.action}</td>
                    <td className="mono" style={{ fontSize: '0.7rem', color: '#A0A0A0' }}>{a.targetType}:{a.targetId}{a.meta?.role ? ` → ${a.meta.role}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
