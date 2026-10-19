// Previous / next controls under a long table (pairs with usePaged)
export default function Pager({ page, pages, total, size, setPage }) {
  if (total <= size) return null;
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', padding: '0.9rem 1rem', borderTop: '1px solid #292929', flexWrap: 'wrap' }}>
      <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>{from}–{to} OF {total}</span>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem' }} disabled={page === 0} onClick={() => setPage(page - 1)}>PREVIOUS</button>
        <span className="mono" style={{ fontSize: '0.7rem', color: '#8B8B8B' }}>PAGE {page + 1} / {pages}</span>
        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.7rem', padding: '0.3rem 0.7rem' }} disabled={page >= pages - 1} onClick={() => setPage(page + 1)}>NEXT</button>
      </div>
    </div>
  );
}
