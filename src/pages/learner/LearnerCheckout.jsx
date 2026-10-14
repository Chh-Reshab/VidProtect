// ============================================
// CHECKOUT — enrol in a course.
// Paid courses: card / UPI / net banking (beta test mode, no real money).
// Free courses: the same page with a total of ₹0.00.
// The server decides the amount; this page only displays it.
// ============================================

import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, CheckCircle, CreditCard, Landmark, Smartphone, Lock, Gift } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { checkoutCourse, getCourseById, getEnrollments, getUserById } from '../../services/dataService';
import { CourseCover, Panel, formatDate, formatPrice } from '../../components/DashboardKit';

const BANKS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];
const METHODS = [
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'upi', label: 'UPI', icon: Smartphone },
  { id: 'netbanking', label: 'Net banking', icon: Landmark },
];

const rupees = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const groupCard = (v) => v.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
const formatExpiry = (v) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

const Receipt = ({ payment, course }) => (
  <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
    <div style={{ maxWidth: 520, margin: '2rem auto', textAlign: 'center' }}>
      <CheckCircle size={52} color="#22c55e" style={{ marginBottom: '1rem' }} />
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.5rem', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
        {payment.amount > 0 ? 'Payment successful' : 'You are enrolled'}
      </h1>
      <p style={{ color: '#A0A0A0', fontSize: '0.9rem', marginBottom: '1.5rem' }}>You now have access to {course.title}.</p>

      <div style={{ background: '#1D1D1D', border: '1px solid #292929', padding: '1rem 1.25rem', textAlign: 'left', marginBottom: '1.5rem' }}>
        {[
          ['Receipt', payment.id],
          ['Course', payment.courseTitle],
          ['Amount paid', rupees(payment.amount)],
          ['Method', payment.detail],
          ['Date', formatDate(payment.createdAt)],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderBottom: '1px solid #292929', fontSize: '0.85rem' }}>
            <span className="mono" style={{ color: '#565656', fontSize: '0.65rem' }}>{k.toUpperCase()}</span>
            <span style={{ color: '#F8F8F8', textAlign: 'right', wordBreak: 'break-all' }}>{v}</span>
          </div>
        ))}
        <div className="mono" style={{ fontSize: '0.55rem', color: '#565656', paddingTop: '0.6rem' }}>BETA TEST PAYMENT — NO REAL MONEY WAS CHARGED</div>
      </div>

      <Link to={`/learn/course/${course.id}`} className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Start learning</Link>
    </div>
  </div>
);

export default function LearnerCheckout() {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { currentUser, showNotification } = useApp();

  const [method, setMethod] = useState('card');
  const [card, setCard] = useState({ number: '', expiry: '', cvv: '', cardName: '' });
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState(null);

  const course = getCourseById(courseId);
  if (receipt && course) return <Receipt payment={receipt} course={course} />;

  const alreadyEnrolled = getEnrollments().some(e => e.studentId === currentUser.id && e.courseId === courseId);
  if (!course || course.status !== 'active' || course.creatorId === currentUser.id) return <Navigate to="/learn/catalog" replace />;
  if (alreadyEnrolled) return <Navigate to={`/learn/course/${course.id}`} replace />;

  const price = course.price || 0;
  const isFree = price === 0;
  const creator = getUserById(course.creatorId);
  const inviteOnly = course.visibility === 'invite_only';

  const buildPayload = () => {
    if (isFree) return { method: 'free' };
    if (method === 'card') return { method: 'card', ...card };
    if (method === 'upi') return { method: 'upi', upiId };
    return { method: 'netbanking', bank };
  };

  const pay = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    const result = await checkoutCourse(course.id, buildPayload());
    setBusy(false);
    if (!result.success) {
      setError(result.error);
      showNotification(result.error, 'error');
      return;
    }
    setReceipt(result.payment);
  };

  const fillTestCard = () => setCard({ number: '4242 4242 4242 4242', expiry: '12/39', cvv: '123', cardName: currentUser.name });

  return (
    <div style={{ padding: '2rem', animation: 'fadeIn 0.3s ease' }}>
      <button className="btn btn-ghost" style={{ fontSize: '0.65rem', marginBottom: '1.25rem' }} onClick={() => navigate(-1)}>
        <ChevronLeft size={14} /> BACK
      </button>
      <h1 style={{ fontFamily: 'Archivo Black, sans-serif', fontSize: '1.6rem', textTransform: 'uppercase', letterSpacing: '-0.02em', marginBottom: '1.25rem' }}>Checkout</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '1.5rem', alignItems: 'flex-start' }} className="checkout-grid">
        {/* Payment */}
        <form onSubmit={pay}>
          <Panel title="PAYMENT">
            <div style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {inviteOnly && (
                <div style={{ color: '#eab308', fontSize: '0.85rem' }}>This course is invite-only. Ask the creator to enrol you.</div>
              )}

              {isFree ? (
                <>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', background: '#101010', border: '1px solid #292929', padding: '1rem' }}>
                    <Gift size={22} color="#22c55e" />
                    <div>
                      <div style={{ fontSize: '0.9rem', color: '#F8F8F8' }}>This course is free</div>
                      <div className="mono" style={{ fontSize: '0.6rem', color: '#565656' }}>NO PAYMENT METHOD NEEDED</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: '#A0A0A0' }}>
                    <span>Amount to pay</span><span style={{ color: '#F8F8F8' }}>{rupees(0)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }} role="tablist">
                    {METHODS.map(({ id, label, icon: Icon }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        aria-selected={method === id}
                        className={method === id ? 'btn btn-secondary' : 'btn btn-ghost'}
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => { setMethod(id); setError(''); }}
                      >
                        <Icon size={14} /> {label}
                      </button>
                    ))}
                  </div>

                  {method === 'card' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div className="form-group">
                        <label className="form-label" htmlFor="cc-number">Card number</label>
                        <input id="cc-number" className="form-input" inputMode="numeric" autoComplete="cc-number" placeholder="4242 4242 4242 4242" value={card.number} onChange={e => setCard({ ...card, number: groupCard(e.target.value) })} />
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                          <label className="form-label" htmlFor="cc-expiry">Expiry</label>
                          <input id="cc-expiry" className="form-input" inputMode="numeric" autoComplete="cc-exp" placeholder="MM/YY" value={card.expiry} onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })} />
                        </div>
                        <div className="form-group" style={{ flex: 1, minWidth: 120 }}>
                          <label className="form-label" htmlFor="cc-cvv">Security code</label>
                          <input id="cc-cvv" className="form-input" inputMode="numeric" type="password" autoComplete="cc-csc" placeholder="123" maxLength={4} value={card.cvv} onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '') })} />
                        </div>
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="cc-name">Name on card</label>
                        <input id="cc-name" className="form-input" autoComplete="cc-name" value={card.cardName} onChange={e => setCard({ ...card, cardName: e.target.value })} />
                      </div>
                      <div style={{ background: '#101010', border: '1px solid #292929', borderLeft: '3px solid #eab308', padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#A0A0A0' }}>
                        Beta testing: payments are in test mode. Only the test card <span className="mono" style={{ color: '#F8F8F8' }}>4242 4242 4242 4242</span> works (any future expiry, any code). Real cards are rejected and nothing is charged.{' '}
                        <button type="button" className="btn btn-ghost" style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem' }} onClick={fillTestCard}>Fill test card</button>
                      </div>
                    </div>
                  )}

                  {method === 'upi' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="upi-id">UPI ID</label>
                      <input id="upi-id" className="form-input" placeholder="name@bank" value={upiId} onChange={e => setUpiId(e.target.value)} />
                      <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginTop: '0.4rem' }}>BETA TEST MODE: ANY VALID-LOOKING ID, E.G. PRIYA@OKBANK. NOTHING IS SENT TO A BANK.</div>
                    </div>
                  )}

                  {method === 'netbanking' && (
                    <div className="form-group">
                      <label className="form-label" htmlFor="nb-bank">Choose your bank</label>
                      <select id="nb-bank" className="form-input" value={bank} onChange={e => setBank(e.target.value)}>
                        <option value="">Select a bank...</option>
                        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <div className="mono" style={{ fontSize: '0.58rem', color: '#565656', marginTop: '0.4rem' }}>BETA TEST MODE: NO REDIRECT TO A REAL BANK HAPPENS.</div>
                    </div>
                  )}
                </>
              )}

              {error && <div className="form-error" role="alert">⊗ {error}</div>}

              <button className="btn btn-primary" type="submit" disabled={busy || inviteOnly} style={{ justifyContent: 'center', fontSize: '0.9rem', padding: '0.9rem' }}>
                {busy ? 'Processing…' : isFree ? 'Complete enrollment · ₹0' : <><Lock size={14} /> Pay {rupees(price)}</>}
              </button>
            </div>
          </Panel>
        </form>

        {/* Order summary */}
        <Panel title="ORDER SUMMARY">
          <CourseCover course={course} height={140} />
          <div style={{ padding: '1.25rem' }}>
            <div style={{ fontSize: '1rem', color: '#F8F8F8', marginBottom: '0.25rem' }}>{course.title}</div>
            {creator && <div className="mono" style={{ fontSize: '0.6rem', color: '#565656', marginBottom: '1rem' }}>BY {creator.name.toUpperCase()} · {course.videoCount ?? 0} VIDEOS</div>}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderTop: '1px solid #292929', fontSize: '0.85rem', color: '#A0A0A0' }}>
              <span>Price</span><span>{isFree ? 'Free' : rupees(price)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.6rem 0', borderTop: '1px solid #292929', fontSize: '1rem', color: '#F8F8F8' }}>
              <strong>Total</strong><strong>{rupees(price)}</strong>
            </div>
          </div>
        </Panel>
      </div>

      <style>{`@media (max-width: 900px) { .checkout-grid { grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
}
