// ============================================
// LEARNER WATCH HISTORY — the learner's own access events
// ============================================

import { useState } from 'react';
import { History } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getWatchHistory } from '../../services/dataService';
import { ResultBadge, EmptyState, SelectFilter } from '../../components/SharedComponents';
import { PageHeader, Panel, formatDate } from '../../components/DashboardKit';

export default function LearnerHistory() {
  const { currentUser } = useApp();
  const [logs] = useState(() => getWatchHistory(currentUser.id));
  const [result, setResult] = useState('');

  const shown = logs.filter(l => !result || l.result === result);

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <PageHeader label="ACTIVITY" title="WATCH HISTORY" subtitle="Every playback request on your account, including any that were denied." />
      <div style={{ marginBottom: '1rem' }}>
        <SelectFilter value={result} onChange={setResult} placeholder="All results" options={[{ value: 'success', label: 'Authorized' }, { value: 'denied', label: 'Denied' }]} />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={History} title="NO ACTIVITY YET" description="Videos you watch will appear here." />
      ) : (
        <Panel>
          <div style={{ overflowX: 'auto' }}>
            <table className="vp-table">
              <thead>
                <tr><th>Time</th><th>Video</th><th>Result</th><th>Details</th></tr>
              </thead>
              <tbody>
                {shown.map(l => (
                  <tr key={l.id}>
                    <td className="mono" style={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }}>{formatDate(l.timestamp)}</td>
                    <td>{l.videoTitle}</td>
                    <td><ResultBadge result={l.result} /></td>
                    <td style={{ color: '#A0A0A0', fontSize: '0.8rem' }}>{l.reason}</td>
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
