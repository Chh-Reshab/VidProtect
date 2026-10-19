// ============================================
// ADMIN — your own account: password, two-step verification, deletion
// ============================================

import { useApp } from '../../context/AppContext';
import { PageHeader, Panel } from '../../components/DashboardKit';
import SecurityPanel from '../../components/SecurityPanel';

export default function AdminAccount() {
  const { currentUser } = useApp();
  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease', maxWidth: 900 }}>
      <PageHeader label="PLATFORM ADMIN" title="MY ACCOUNT" subtitle="Admins can approve creators and remove content, so protect this account with two-step verification." />
      <Panel title="PROFILE" style={{ marginBottom: '1.5rem' }}>
        <div style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {[['NAME', currentUser.name], ['EMAIL', currentUser.email], ['ROLE', 'ADMIN']].map(([k, v]) => (
            <div key={k}>
              <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.2rem' }}>{k}</div>
              <div style={{ fontSize: '0.9rem', color: '#F8F8F8', wordBreak: 'break-all' }}>{v}</div>
            </div>
          ))}
        </div>
      </Panel>
      <SecurityPanel />
    </div>
  );
}
