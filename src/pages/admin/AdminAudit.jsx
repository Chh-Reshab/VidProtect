// ============================================
// ADMIN — audit log of admin actions (search, filter by action, paged)
// ============================================

import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { getAuditLog, getUserById } from '../../services/dataService';
import { usePaged } from '../../services/usePaged';
import Pager from '../../components/Pager';
import { EmptyState, SearchInput, SelectFilter } from '../../components/SharedComponents';
import { PageHeader, Panel, formatDate } from '../../components/DashboardKit';

export default function AdminAudit() {
  const entries = getAuditLog();
  const [search, setSearch] = useState('');
  const [action, setAction] = useState('');

  const actions = [...new Set(entries.map(a => a.action))].sort().map(a => ({ value: a, label: a }));
  const text = search.trim().toLowerCase();
  const shown = entries.filter(a => (!action || a.action === action) && (!text
    || a.action.toLowerCase().includes(text)
    || `${a.targetType}:${a.targetId}`.toLowerCase().includes(text)
    || (getUserById(a.actorId)?.name || a.actorId || '').toLowerCase().includes(text)));
  const paged = usePaged(shown, 25);

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="AUDIT LOG" subtitle="Every approval, suspension, role change, deletion and takedown." />
      {entries.length === 0 ? (
        <EmptyState icon={ClipboardList} title="NOTHING LOGGED YET" description="Admin actions will be recorded here." />
      ) : (
        <>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <SearchInput value={search} onChange={setSearch} placeholder="Search admin, action or target..." />
            <SelectFilter value={action} onChange={setAction} options={actions} placeholder="All actions" />
          </div>
          <Panel>
            <div style={{ overflowX: 'auto' }}>
              <table className="vp-table">
                <thead>
                  <tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th></tr>
                </thead>
                <tbody>
                  {paged.pageItems.map(a => (
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
            <Pager {...paged} />
          </Panel>
        </>
      )}
    </div>
  );
}
