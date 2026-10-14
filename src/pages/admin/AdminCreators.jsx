// ============================================
// ADMIN — creator application queue
// ============================================

import { useState } from 'react';
import { UserCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getUsers, reviewCreatorApplication } from '../../services/dataService';
import { EmptyState } from '../../components/SharedComponents';
import { PageHeader, Panel } from '../../components/DashboardKit';

export default function AdminCreators() {
  const { currentUser, showNotification } = useApp();
  const [applicants, setApplicants] = useState(() => getUsers().filter(u => u.creatorStatus === 'pending'));

  const decide = async (user, approve) => {
    const result = await reviewCreatorApplication(currentUser.id, user.id, approve);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    setApplicants(getUsers().filter(u => u.creatorStatus === 'pending'));
    showNotification(approve ? `${user.name} is now a creator.` : `Application from ${user.name} rejected.`);
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="CREATOR APPROVALS" subtitle="Learners who applied to publish courses." />
      {applicants.length === 0 ? (
        <EmptyState icon={UserCheck} title="NO PENDING APPLICATIONS" description="New applications will show up here." />
      ) : applicants.map(u => (
        <Panel key={u.id} style={{ marginBottom: '1rem' }}>
          <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: '1rem', color: '#F8F8F8' }}>{u.creatorProfile?.displayName || u.name}</div>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.6rem' }}>{u.email} · joined {u.joinDate}</div>
              <p style={{ color: '#A0A0A0', fontSize: '0.85rem', lineHeight: 1.5 }}>{u.creatorProfile?.bio}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
              <button className="btn btn-primary" style={{ fontSize: '0.65rem' }} onClick={() => decide(u, true)}>APPROVE</button>
              <button className="btn btn-ghost" style={{ fontSize: '0.65rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => decide(u, false)}>REJECT</button>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}
