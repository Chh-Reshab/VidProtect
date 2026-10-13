// ============================================
// SECURITY ALERTS — VidProtect AI
// ============================================

import { useState } from 'react';
import { ShieldAlert, CheckCircle, Eye } from 'lucide-react';
import { getSecurityAlerts, updateAlertStatus } from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, SeverityBadge, EmptyState, Modal, SearchInput, SelectFilter, DemoBanner } from '../components/SharedComponents';

export default function SecurityAlertsPage() {
  const { currentUser, showNotification } = useApp();
  const [alerts, setAlerts] = useState(() => getSecurityAlerts(currentUser.id));
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState(null);

  const refresh = () => setAlerts(getSecurityAlerts(currentUser.id));

  const handleUpdateStatus = (alertId, newStatus) => {
    if (!updateAlertStatus(alertId, newStatus, currentUser.id)) {
      showNotification('Alert not found.', 'error');
      return;
    }
    refresh();
    if (selectedAlert?.id === alertId) {
      const updated = getSecurityAlerts(currentUser.id).find(a => a.id === alertId);
      setSelectedAlert(updated);
    }
    showNotification(`Alert marked as ${newStatus}.`);
  };

  const filtered = alerts.filter(alert => {
    const matchSearch = !search ||
      alert.userName?.toLowerCase().includes(search.toLowerCase()) ||
      alert.videoTitle?.toLowerCase().includes(search.toLowerCase()) ||
      alert.alertType?.includes(search.toLowerCase());
    const matchSeverity = !severityFilter || alert.severity === severityFilter;
    const matchStatus = !statusFilter || alert.reviewStatus === statusFilter;
    return matchSearch && matchSeverity && matchStatus;
  });

  const openCount = alerts.filter(a => a.reviewStatus === 'open').length;
  const highCount = alerts.filter(a => a.severity === 'high').length;

  const formatTime = (iso) => {
    if (!iso) return 'N/A';
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const alertTypeLabel = (type) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const statusColor = { open: '#FF2028', reviewed: '#eab308', resolved: '#22c55e' };

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>THREAT DETECTION</SectionLabel>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
          SECURITY ALERTS
        </h1>
        <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          {openCount} open alert{openCount !== 1 ? 's' : ''} require review · {highCount} high severity
        </p>
      </div>

      <DemoBanner />

      {/* Stats */}
      <div style={{ display: 'flex', gap: '1px', background: '#292929', marginBottom: '1.5rem' }}>
        {[
          { label: 'TOTAL ALERTS', value: alerts.length, color: '#F8F8F8' },
          { label: 'OPEN', value: alerts.filter(a => a.reviewStatus === 'open').length, color: '#FF2028' },
          { label: 'HIGH SEVERITY', value: alerts.filter(a => a.severity === 'high').length, color: '#FF2028' },
          { label: 'RESOLVED', value: alerts.filter(a => a.reviewStatus === 'resolved').length, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#1D1D1D', padding: '0.75rem 1rem' }}>
            <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{s.label}</div>
            <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.4rem', lineHeight: 1, marginTop: '0.25rem', color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search user, video, type..." />
        <SelectFilter value={severityFilter} onChange={setSeverityFilter} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} placeholder="All Severities" />
        <SelectFilter value={statusFilter} onChange={setStatusFilter} options={[{ value: 'open', label: 'Open' }, { value: 'reviewed', label: 'Reviewed' }, { value: 'resolved', label: 'Resolved' }]} placeholder="All Statuses" />
        {(search || severityFilter || statusFilter) && (
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => { setSearch(''); setSeverityFilter(''); setStatusFilter(''); }}>
            CLEAR
          </button>
        )}
      </div>

      {/* Alerts List */}
      {filtered.length === 0 ? (
        <EmptyState icon={ShieldAlert} title="No Alerts Found" description={search ? 'No alerts match your search.' : 'No security alerts at this time.'} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', background: '#292929', border: '1px solid #292929' }}>
          {filtered.map(alert => (
            <div key={alert.id} style={{
              background: alert.reviewStatus === 'open' ? 'rgba(255,32,40,0.04)' : '#1D1D1D',
              padding: '1.25rem',
              transition: 'background 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = alert.reviewStatus === 'open' ? 'rgba(255,32,40,0.08)' : '#222'}
              onMouseLeave={e => e.currentTarget.style.background = alert.reviewStatus === 'open' ? 'rgba(255,32,40,0.04)' : '#1D1D1D'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <SeverityBadge severity={alert.severity} />
                    <span className="mono" style={{ fontSize: '0.62rem', color: '#A0A0A0' }}>{alertTypeLabel(alert.alertType)}</span>
                    <span className="badge" style={{ color: statusColor[alert.reviewStatus], borderColor: statusColor[alert.reviewStatus], fontSize: '0.6rem' }}>
                      {alert.reviewStatus.toUpperCase()}
                    </span>
                  </div>
                  {/* Meta */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
                      USER: {alert.userName}
                    </span>
                    <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
                      VIDEO: {alert.videoTitle}
                    </span>
                    <span className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>
                      {formatTime(alert.timestamp)}
                    </span>
                  </div>
                  {/* Explanation */}
                  <p style={{ fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6, maxWidth: '600px' }}>
                    {alert.explanation.substring(0, 150)}{alert.explanation.length > 150 ? '...' : ''}
                  </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end', flexShrink: 0 }}>
                  <button className="btn btn-secondary" style={{ fontSize: '0.6rem', padding: '0.35rem 0.7rem' }} onClick={() => setSelectedAlert(alert)}>
                    <Eye size={12} /> DETAILS
                  </button>
                  {alert.reviewStatus === 'open' && (
                    <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.35rem 0.7rem' }} onClick={() => handleUpdateStatus(alert.id, 'reviewed')}>
                      MARK REVIEWED
                    </button>
                  )}
                  {alert.reviewStatus !== 'resolved' && (
                    <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.35rem 0.7rem', color: '#22c55e', borderColor: '#22c55e' }} onClick={() => handleUpdateStatus(alert.id, 'resolved')}>
                      <CheckCircle size={12} /> RESOLVE
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Alert Detail Modal */}
      <Modal isOpen={!!selectedAlert} onClose={() => setSelectedAlert(null)} title="ALERT DETAIL" width="620px">
        {selectedAlert && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <SeverityBadge severity={selectedAlert.severity} />
              <span className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', padding: '0.25rem 0.5rem', border: '1px solid #292929' }}>
                {alertTypeLabel(selectedAlert.alertType)}
              </span>
              <span className="badge" style={{ color: statusColor[selectedAlert.reviewStatus], borderColor: statusColor[selectedAlert.reviewStatus], fontSize: '0.6rem' }}>
                {selectedAlert.reviewStatus.toUpperCase()}
              </span>
            </div>

            <div style={{ background: '#101010', border: '1px solid #292929', padding: '1rem' }}>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '0.5rem' }}>DETECTION EXPLANATION</div>
              <p style={{ fontSize: '0.85rem', color: '#A0A0A0', lineHeight: 1.7 }}>{selectedAlert.explanation}</p>
            </div>

            {[
              { label: 'Alert ID', value: selectedAlert.id },
              { label: 'Detected', value: formatTime(selectedAlert.timestamp) },
              { label: 'User', value: `${selectedAlert.userName} (${selectedAlert.userId})` },
              { label: 'Video', value: selectedAlert.videoTitle },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #292929' }}>
                <span className="mono" style={{ fontSize: '0.6rem', color: '#565656', minWidth: '120px' }}>{item.label.toUpperCase()}</span>
                <span style={{ fontSize: '0.8rem', color: '#F8F8F8', flex: 1 }}>{item.value}</span>
              </div>
            ))}

            <div style={{ background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #eab308', padding: '1rem' }}>
              <div className="mono" style={{ fontSize: '0.6rem', color: '#eab308', marginBottom: '0.4rem' }}>RECOMMENDED ACTION</div>
              <p style={{ fontSize: '0.8rem', color: '#A0A0A0', lineHeight: 1.6 }}>{selectedAlert.recommendedAction}</p>
            </div>

            {selectedAlert.resolvedAt && (
              <div className="mono" style={{ fontSize: '0.6rem', color: '#22c55e' }}>
                ✓ Resolved at {formatTime(selectedAlert.resolvedAt)}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid #292929' }}>
              {selectedAlert.reviewStatus === 'open' && (
                <button className="btn btn-secondary" style={{ fontSize: '0.65rem' }} onClick={() => handleUpdateStatus(selectedAlert.id, 'reviewed')}>
                  MARK REVIEWED
                </button>
              )}
              {selectedAlert.reviewStatus !== 'resolved' && (
                <button className="btn btn-primary" style={{ fontSize: '0.65rem', background: '#22c55e', borderColor: '#22c55e' }} onClick={() => handleUpdateStatus(selectedAlert.id, 'resolved')}>
                  <CheckCircle size={14} /> RESOLVE ALERT
                </button>
              )}
            </div>

            <div style={{ padding: '0.5rem', background: '#101010', border: '1px solid #292929' }}>
              <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>
                ◐ DEMO ALERT — Rule-based simulation. Not connected to a live AI detection service.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
