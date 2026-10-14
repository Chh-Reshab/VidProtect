// ============================================
// Checkout (beta test mode — no real money moves until a live payment provider is connected).
//
// - The amount always comes from the course record on the server.
// - Free courses (price 0) go through the same checkout at INR 0.
// - Card numbers are never stored: only brand + last 4 digits. To stop a real
//   card from ever being entered, only published TEST card numbers are accepted.
// - A successful payment creates the enrolment; there is no other way into a
//   paid course except the owner inviting a learner.
// ============================================

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { db, save, uid } from '../db.js';
import { requireAuth } from '../auth.js';
import { findCourse } from '../access.js';
import { addEnrollment } from './courses.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many payment attempts. Please wait a few minutes.' },
});

const TEST_CARDS = {
  '4242424242424242': { brand: 'Visa', ok: true },
  '5555555555554444': { brand: 'Mastercard', ok: true },
  '4000000000000002': { brand: 'Visa', ok: false }, // always declined
};
const BANKS = ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'];
const UPI_RE = /^[a-z0-9._-]{2,40}@[a-z]{2,20}$/i;

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// Returns { error } for bad input, otherwise { method, detail, approved }
const readMethod = (body) => {
  const method = text(body?.method, 12);

  if (method === 'card') {
    const number = text(body.number, 30).replace(/[\s-]/g, '');
    const known = TEST_CARDS[number];
    if (!known) {
      return { error: 'Beta test mode: use the test card 4242 4242 4242 4242. Real cards are not accepted.' };
    }
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(text(body.expiry, 7));
    const month = m ? Number(m[1]) : 0;
    const year = m ? 2000 + Number(m[2]) : 0;
    const now = new Date();
    const expired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
    if (!m || month < 1 || month > 12 || expired) return { error: 'Enter a valid expiry date (MM/YY).' };
    if (!/^\d{3,4}$/.test(text(body.cvv, 4))) return { error: 'Enter the 3 or 4 digit security code.' };
    if (!text(body.cardName, 80)) return { error: 'Enter the name on the card.' };
    return { method, detail: `${known.brand} •••• ${number.slice(-4)}`, approved: known.ok };
  }

  if (method === 'upi') {
    const upiId = text(body.upiId, 60);
    if (!UPI_RE.test(upiId)) return { error: 'Enter a valid UPI ID, like name@bank.' };
    const [name, bank] = upiId.split('@');
    return { method, detail: `UPI ${name.slice(0, 2)}•••@${bank}`, approved: true };
  }

  if (method === 'netbanking') {
    const bank = text(body.bank, 40);
    if (!BANKS.includes(bank)) return { error: 'Choose your bank.' };
    return { method, detail: bank, approved: true };
  }

  return { error: 'Choose a payment method.' };
};

router.post('/courses/:id/checkout', requireAuth, limiter, (req, res) => {
  const user = req.user;
  const course = findCourse(req.params.id);
  if (!course || course.status !== 'active') return res.status(404).json({ error: 'This course is not available.' });
  if (course.creatorId === user.id) return res.status(400).json({ error: 'You own this course.' });
  if (course.visibility === 'invite_only') {
    return res.status(403).json({ error: 'This course is invite-only. Ask the creator to enrol you.' });
  }
  if (db.enrollments.some(e => e.studentId === user.id && e.courseId === course.id)) {
    return res.status(409).json({ error: 'You are already enrolled in this course.' });
  }

  const amount = course.price || 0; // never taken from the request
  const base = {
    id: uid('pay'),
    userId: user.id,
    courseId: course.id,
    courseTitle: course.title,
    amount,
    currency: 'INR',
    createdAt: new Date().toISOString(),
    testMode: true,
  };

  let detail;
  let approved = true;
  if (amount === 0) {
    if (text(req.body?.method, 12) !== 'free') return res.status(400).json({ error: 'Confirm the free enrolment to continue.' });
    detail = 'No payment needed';
  } else {
    const read = readMethod(req.body);
    if (read.error) return res.status(400).json({ error: read.error });
    ({ detail, approved } = read);
  }

  if (!approved) {
    db.payments.unshift({ ...base, method: req.body.method, detail, status: 'failed' });
    save();
    return res.status(402).json({ error: 'Your card was declined (test card). Try 4242 4242 4242 4242.' });
  }

  const payment = { ...base, method: amount === 0 ? 'free' : req.body.method, detail, status: 'succeeded' };
  db.payments.unshift(payment);
  const { error } = addEnrollment(user.id, course.id, amount === 0 ? 'free' : 'purchase', payment.id);
  if (error) return res.status(409).json({ error });
  save();
  return res.status(201).json({ success: true, payment });
});

export default router;
