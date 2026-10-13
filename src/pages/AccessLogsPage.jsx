// ============================================
// ACCESS LOGS — VidProtect AI
// ============================================

import { useState } from 'react';
import { ScrollText, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAccessLogs } from '../services/mockServices';
import { useApp } from '../context/AppContext';
import { SectionLabel, ResultBadge, SearchInput, SelectFilter, EmptyState, Modal, DemoBanner } from '../components/SharedComponents';

const EVENT_TYPES = [
  { value: 'stream_authorized', label: 'Stream Authorized' },
  { value: 'access_denied', label: 'Access Denied' },
  { value: 'token_expired', label: 'Token Expired' },
  { value: 'repeated_attempt', label: 'Repeated Attempt' },
  { value: 'suspicious_session', label: 'Suspicious Session' },
  { value: 'creator_preview', label: 'Owner Preview' },
];

const PAGE_SIZE = 10;

export default function AccessLogsPage() {
  const { currentUser } = useApp();
  const [logs] = useState(() => getAccessLogs(currentUser.id));
  const [search, setSearch] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);

  const filtered = logs.filter(log => {
    const matchSearch = !search || log.userName?.toLowerCase().includes(search.toLowerCase()) || log.videoTitle?.toLowerCase().includes(search.toLowerCase()) || log.sessionRef?.includes(search);
    const matchResult = !resultFilter || log.result === resultFilter;
    const matchType = !typeFilter || log.eventType === typeFilter;
    return matchSearch && matchResult && matchType;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const formatTimestamp = (iso) => {
    const d = new Date(iso);
    return d.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const eventLabel = (type) => type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>SECURITY AUDIT</SectionLabel>
        <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '2rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginTop: '0.75rem', lineHeight: 1 }}>
          ACCESS LOGS
        </h1>
        <p style={{ color: '#A0A0A0', fontSize: '0.85rem', marginTop: '0.3rem' }}>
          {filtered.length} events recorded · newest first
        </p>
      </div>

      <DemoBanner />

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchInput value={search} onChange={v => { setSearch(v); setPage(1); }} placeholder="Search user, video, session..." />
        <SelectFilter value={resultFilter} onChange={v => { setResultFilter(v); setPage(1); }} options={[{ value: 'success', label: 'Success' }, { value: 'denied', label: 'Denied' }]} placeholder="All Results" />
        <SelectFilter value={typeFilter} onChange={v => { setTypeFilter(v); setPage(1); }} options={EVENT_TYPES} placeholder="All Event Types" />
        {(search || resultFilter || typeFilter) && (
          <button className="btn btn-ghost" style={{ fontSize: '0.7rem' }} onClick={() => { setSearch(''); setResultFilter(''); setTypeFilter(''); setPage(1); }}>
            CLEAR
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: '1px', background: '#292929', marginBottom: '1.5rem' }}>
        {[
          { label: 'TOTAL EVENTS', value: logs.length },
          { label: 'AUTHORIZED', value: logs.filter(l => l.result === 'success').length },
          { label: 'DENIED', value: logs.filter(l => l.result === 'denied').length },
          { label: 'TOKEN EVENTS', value: logs.filter(l => l.eventType === 'token_expired').length },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, background: '#1D1D1D', padding: '0.75rem 1rem' }}>
            <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{s.label}</div>
            <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.4rem', lineHeight: 1, marginTop: '0.25rem' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      {paginated.length === 0 ? (
        <EmptyState icon={ScrollText} title="No Events Found" description={search ? `No logs match your search.` : 'Access events will appear here.'} />
      ) : (
        <>
          <div style={{ background: '#1D1D1D', border: '1px solid #292929', overflowX: 'auto' }}>
            <table className="vp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Video</th>
                  <th>Event Type</th>
                  <th>Result</th>
                  <th>Reason</th>
                  <th>Session</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map(log => (
                  <tr key={log.id}>
                    <td className="mono" style={{ fontSize: '0.65rem', color: '#565656', whiteSpace: 'nowrap' }}>
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8rem' }}>{log.userName}</div>
                      <div className="mono" style={{ fontSize: '0.58rem', color: '#565656' }}>{log.userId}</div>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: '#A0A0A0', maxWidth: '160px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.videoTitle}</div>
                    </td>
                    <td>
                      <span className="mono" style={{ fontSize: '0.62rem', color: '#A0A0A0' }}>{eventLabel(log.eventType)}</span>
                    </td>
                    <td><ResultBadge result={log.result} /></td>
                    <td style={{ fontSize: '0.75rem', color: '#565656', maxWidth: '200px' }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{log.reason}</div>
                    </td>
                    <td className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>{log.sessionRef}</td>
                    <td>
                      <button className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.25rem 0.4rem' }} onClick={() => setSelectedLog(log)} aria-label="View details">
                        <Info size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
              <span className="mono" style={{ fontSize: '0.65rem', color: '#565656' }}>
                Page {page} of {totalPages} · {filtered.length} events
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-ghost" style={{ fontSize: '0.65rem', padding: '0.35rem 0.6rem' }} onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                  <ChevronLeft size={12} /> PREV
                </button>
                <button className="btn btn-ghost" style={{ fontSize: '0.65rem', padding: '0.35rem 0.6rem' }} onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                  NEXT <ChevronRight size={12} />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Log Detail Modal */}
      <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="EVENT DETAIL">
        {selectedLog && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <ResultBadge result={selectedLog.result} />
              <span className="mono" style={{ fontSize: '0.65rem', color: '#A0A0A0', padding: '0.25rem 0.5rem', border: '1px solid #292929' }}>
                {eventLabel(selectedLog.eventType)}
              </span>
            </div>
            {[
              { label: 'Event ID', value: selectedLog.id },
              { label: 'Timestamp', value: formatTimestamp(selectedLog.timestamp) },
              { label: 'User', value: `${selectedLog.userName} (${selectedLog.userId})` },
              { label: 'Video', value: selectedLog.videoTitle },
              { label: 'Course ID', value: selectedLog.courseId },
              { label: 'Session Ref', value: selectedLog.sessionRef },
              { label: 'Token Ref', value: selectedLog.tokenRef || 'N/A' },
              { label: 'Reason', value: selectedLog.reason },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #292929' }}>
                <span className="mono" style={{ fontSize: '0.6rem', color: '#565656', minWidth: '120px' }}>{item.label.toUpperCase()}</span>
                <span style={{ fontSize: '0.8rem', color: '#F8F8F8', flex: 1, wordBreak: 'break-all' }}>{item.value}</span>
              </div>
            ))}
            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: '#101010', border: '1px solid #292929' }}>
              <span className="mono" style={{ fontSize: '0.55rem', color: '#565656' }}>DEMO EVENT — Not from a live security service</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
