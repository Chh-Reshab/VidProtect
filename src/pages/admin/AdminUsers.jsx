// ============================================
// ADMIN — all users: search, change role, suspend
// ============================================

import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { getUsers, setUserRole, setUserStatus } from '../../services/mockServices';
import { SearchInput, SelectFilter, ConfirmDialog, DemoBanner } from '../../components/SharedComponents';
import { PageHeader, Panel } from '../../components/DashboardKit';

const ROLE_OPTIONS = [
  { value: 'learner', label: 'Learner' },
  { value: 'creator', label: 'Creator' },
  { value: 'admin', label: 'Admin' },
];

export default function AdminUsers() {
  const { currentUser, showNotification } = useApp();
  const [users, setUsers] = useState(getUsers);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [suspendTarget, setSuspendTarget] = useState(null);

  const reload = () => setUsers(getUsers());

  const shown = users.filter(u =>
    (!roleFilter || u.role === roleFilter) &&
    (!search || u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase())));

  const changeRole = (user, role) => {
    const result = setUserRole(currentUser.id, user.id, role);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    reload();
    showNotification(`${user.name} is now a ${role}.`);
  };

  const changeStatus = (user, status) => {
    const result = setUserStatus(currentUser.id, user.id, status);
    if (!result.success) { showNotification(result.error, 'error'); return; }
    reload();
    showNotification(status === 'suspended' ? `${user.name} suspended.` : `${user.name} reactivated.`);
  };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="PLATFORM ADMIN" title="USERS" subtitle={`${users.length} accounts on the platform.`} />
      <DemoBanner />

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name or email..." />
        <SelectFilter value={roleFilter} onChange={setRoleFilter} options={ROLE_OPTIONS} placeholder="All roles" />
      </div>

      <Panel>
        <div style={{ overflowX: 'auto' }}>
          <table className="vp-table">
            <thead>
              <tr><th>User</th><th>Role</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
            </thead>
            <tbody>
              {shown.map(u => {
                const isSelf = u.id === currentUser.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ color: '#F8F8F8' }}>{u.name}{isSelf && <span className="mono" style={{ color: '#565656', fontSize: '0.6rem' }}> (you)</span>}</div>
                      <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="form-input" style={{ minWidth: 110, padding: '0.35rem 0.5rem', fontSize: '0.75rem' }}
                        value={u.role} disabled={isSelf} aria-label={`Role for ${u.name}`}
                        onChange={e => changeRole(u, e.target.value)}
                      >
                        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`badge ${u.status === 'active' ? 'badge-green' : 'badge-red'}`} style={{ fontSize: '0.55rem' }}>{u.status.toUpperCase()}</span>
                      {u.creatorStatus === 'pending' && <span className="badge badge-yellow" style={{ fontSize: '0.55rem', marginLeft: 6 }}>CREATOR PENDING</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {!isSelf && (u.status === 'active' ? (
                        <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem', color: '#FF2028', borderColor: '#FF2028' }} onClick={() => setSuspendTarget(u)}>SUSPEND</button>
                      ) : (
                        <button className="btn btn-secondary" style={{ fontSize: '0.6rem', padding: '0.3rem 0.6rem' }} onClick={() => changeStatus(u, 'active')}>REACTIVATE</button>
                      ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <ConfirmDialog
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={() => { changeStatus(suspendTarget, 'suspended'); setSuspendTarget(null); }}
        title="SUSPEND ACCOUNT"
        message={`Suspend ${suspendTarget?.name}? They are blocked from signing in and from streaming any video.`}
        confirmLabel="SUSPEND"
        danger
      />
    </div>
  );
}
