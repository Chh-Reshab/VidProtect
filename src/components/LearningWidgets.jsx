// ============================================
// LEARNING WIDGETS — progress ring, activity grid, stat tile
// ============================================

import { buildHeatmap, formatHours } from '../services/learningStats';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LEVEL_COLORS = ['#232323', '#0e4429', '#006d32', '#26a641', '#39d353'];

const prettyDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
};

export const ProgressRing = ({ percent, size = 120, stroke = 10, color = '#22c55e', children, label }) => {
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }} role="img" aria-label={label || `${clamped}% complete`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#292929" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={circumference * (1 - clamped / 100)}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {children}
      </div>
    </div>
  );
};

export const StatTile = ({ label, value, sub, accent }) => (
  <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '0.9rem 1rem', minWidth: 0 }}>
    <div className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', marginBottom: '0.35rem' }}>{label}</div>
    <div style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', lineHeight: 1, color: accent || '#F8F8F8' }}>{value}</div>
    {sub && <div style={{ fontSize: '0.7rem', color: '#808080', marginTop: '0.35rem' }}>{sub}</div>}
  </div>
);

export const ActivityHeatmap = ({ activity }) => {
  const { weeks, months } = buildHeatmap(activity);
  const CELL = 12;
  const GAP = 3;
  const total = weeks.flat().reduce((sum, d) => sum + d.seconds, 0);
  return (
    <div>
      <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
        <div role="img" aria-label={`Watch activity for the past year: ${formatHours(total)} in total`} style={{ display: 'inline-block', minWidth: 'max-content' }}>
          {/* month labels */}
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(53, ${CELL}px)`, columnGap: GAP, marginLeft: 30, marginBottom: 6, height: 14 }} aria-hidden="true">
            {months.map(({ week, month }, i) => {
              const next = months[i + 1]?.week ?? 53;
              return next - week >= 3
                ? <span key={`${month}-${week}`} className="mono" style={{ gridColumn: `${week + 1} / span 3`, fontSize: '0.7rem', color: '#808080', whiteSpace: 'nowrap' }}>{MONTHS[month - 1]}</span>
                : null;
            })}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, rowGap: GAP, width: 24 }} aria-hidden="true">
              {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => <span key={i} className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B', lineHeight: `${CELL}px` }}>{d}</span>)}
            </div>
            <div style={{ display: 'grid', gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: 'column', gridAutoColumns: `${CELL}px`, gap: GAP }} aria-hidden="true">
              {weeks.flat().map(cell => (
                <div
                  key={cell.date}
                  title={cell.future ? undefined : `${prettyDate(cell.date)}: ${cell.seconds >= 30 ? `${formatHours(cell.seconds)} watched` : 'no activity'}`}
                  style={{ width: CELL, height: CELL, borderRadius: 2, background: cell.future ? 'transparent' : LEVEL_COLORS[cell.level] }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginTop: 4 }} aria-hidden="true">
        <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>LESS</span>
        {LEVEL_COLORS.map(c => <span key={c} style={{ width: CELL, height: CELL, borderRadius: 2, background: c }} />)}
        <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>MORE</span>
      </div>
    </div>
  );
};
