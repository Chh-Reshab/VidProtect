// ============================================
// Checkout.
//  - With RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET set, paid courses are bought through Razorpay
//    (test keys = Razorpay test mode, live keys = real money): the server creates the order, the
//    browser pays in Razorpay's window, and the purchase counts only after the signature is valid
//    AND Razorpay confirms the order id and amount (a webhook backs this up if the browser closes).
//  - Without them, the built-in beta test checkout below is used (no real money moves).
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
import {
  razorpayEnabled, razorpayTestMode, publicKeyId, webhookEnabled, createOrder, fetchPayment, capturePayment,
  checkoutSignatureValid, webhookSignatureValid,
} from '../razorpay.js';

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

// Which checkout the site uses (the page shows Razorpay's button or the test form)
router.get('/payments/config', (req, res) => {
  res.json(razorpayEnabled() ? { provider: 'razorpay', testMode: razorpayTestMode() } : { provider: 'test', testMode: true });
});

// The checks every purchase needs; returns { course } or { status, error }
const purchasable = (user, courseId) => {
  const course = findCourse(courseId);
  if (!course || course.status !== 'active') return { status: 404, error: 'This course is not available.' };
  if (course.creatorId === user.id) return { status: 400, error: 'You own this course.' };
  if (course.visibility === 'invite_only') return { status: 403, error: 'This course is invite-only. Ask the creator to enrol you.' };
  if (db.enrollments.some(e => e.studentId === user.id && e.courseId === course.id)) return { status: 409, error: 'You are already enrolled in this course.' };
  return { course };
};

router.post('/courses/:id/checkout', requireAuth, limiter, (req, res) => {
  const user = req.user;
  const found = purchasable(user, req.params.id);
  if (found.error) return res.status(found.status).json({ error: found.error });
  const { course } = found;

  const amount = course.price || 0; // never taken from the request
  if (amount > 0 && razorpayEnabled()) return res.status(400).json({ error: 'Use the online payment button to buy this course.' });
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

// ── Razorpay ─────────────────────────────────
const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;

// What Razorpay says was used, without storing anything sensitive
const describePayment = (rz) => {
  if (rz.method === 'card') return `${rz.card?.network || 'Card'} •••• ${rz.card?.last4 || ''}`.trim();
  if (rz.method === 'upi' && rz.vpa) { const [name, bank] = String(rz.vpa).split('@'); return `UPI ${name.slice(0, 2)}•••@${bank || ''}`; }
  if (rz.method === 'netbanking') return `Net banking ${rz.bank || ''}`.trim();
  if (rz.method === 'wallet') return `Wallet ${rz.wallet || ''}`.trim();
  return 'Razorpay';
};

class Mismatch extends Error {}

// Turns an order into a purchase, once. Asks Razorpay itself whether the money really arrived.
// Safe to call twice at the same time (the browser and the webhook both do).
const settle = async (payment, razorpayPaymentId) => {
  if (payment.status === 'succeeded') return { payment };
  let rz = await fetchPayment(razorpayPaymentId);
  if (rz.order_id !== payment.orderId || rz.amount !== payment.amountPaise || rz.currency !== 'INR') throw new Mismatch('payment does not match the order');
  if (rz.status === 'authorized') rz = await capturePayment(razorpayPaymentId, payment.amountPaise);
  if (rz.status !== 'captured') return { payment, pending: rz.status };
  if (payment.status === 'succeeded') return { payment }; // the other request won the race

  Object.assign(payment, { status: 'succeeded', method: rz.method || 'online', detail: describePayment(rz), razorpayPaymentId, paidAt: new Date().toISOString() });
  addEnrollment(payment.userId, payment.courseId, 'purchase', payment.id); // already enrolled is fine: the payment is still recorded
  save();
  return { payment };
};

router.post('/courses/:id/checkout/order', requireAuth, limiter, async (req, res) => {
  if (!razorpayEnabled()) return res.status(400).json({ error: 'Online payments are not set up.' });
  const found = purchasable(req.user, req.params.id);
  if (found.error) return res.status(found.status).json({ error: found.error });
  const { course } = found;
  const amount = course.price || 0; // from the course record, never from the request
  const amountPaise = Math.round(amount * 100);
  if (amountPaise < 100) return res.status(400).json({ error: 'This course is free: use the free enrolment.' });

  const id = uid('pay');
  let order;
  try {
    order = await createOrder(amountPaise, id, { courseId: course.id, userId: req.user.id });
  } catch (err) {
    console.error(`[payments] could not create an order: ${err.message}`);
    return res.status(502).json({ error: 'Could not start the payment. Please try again.' });
  }
  db.payments = db.payments.filter(p => !(p.status === 'created' && Date.now() - Date.parse(p.createdAt) > THREE_DAYS)); // forget abandoned orders
  db.payments.unshift({
    id, userId: req.user.id, courseId: course.id, courseTitle: course.title, amount, amountPaise, currency: 'INR',
    createdAt: new Date().toISOString(), status: 'created', provider: 'razorpay', orderId: order.id,
    method: 'online', detail: 'Razorpay', testMode: razorpayTestMode(),
  });
  save();
  res.json({ keyId: publicKeyId(), orderId: order.id, amount: amountPaise, currency: 'INR', testMode: razorpayTestMode() });
});

router.post('/courses/:id/checkout/verify', requireAuth, limiter, async (req, res) => {
  const text = (v) => (typeof v === 'string' ? v.slice(0, 100) : '');
  const orderId = text(req.body?.razorpay_order_id);
  const paymentId = text(req.body?.razorpay_payment_id);
  const signature = text(req.body?.razorpay_signature);
  const payment = db.payments.find(p => p.provider === 'razorpay' && p.orderId === orderId && p.userId === req.user.id && p.courseId === req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found.' });
  if (!checkoutSignatureValid(orderId, paymentId, signature)) {
    console.warn(`[payments] bad checkout signature for ${payment.id}`);
    return res.status(400).json({ error: 'Payment verification failed. You have not been charged for this course.' });
  }
  try {
    const result = await settle(payment, paymentId);
    if (result.pending) return res.status(202).json({ pending: true, error: 'Your payment is still being confirmed. This page will update shortly.' });
    return res.status(201).json({ success: true, payment: result.payment });
  } catch (err) {
    console.error(`[payments] could not confirm ${payment.id}: ${err.message}`);
    return err instanceof Mismatch
      ? res.status(400).json({ error: 'Payment verification failed.' })
      : res.status(502).json({ error: 'We could not confirm the payment yet. If money was taken, you will be enrolled automatically.' });
  }
});

// Razorpay calls this itself, so a purchase still completes if the buyer closes the tab right after paying.
// Add https://YOUR-SITE/api/webhooks/razorpay in Razorpay (event: payment.captured) with RAZORPAY_WEBHOOK_SECRET.
router.post('/webhooks/razorpay', async (req, res) => {
  if (!webhookEnabled()) return res.status(503).json({ error: 'Webhook is not configured.' });
  if (!webhookSignatureValid(req.rawBody, req.get('x-razorpay-signature'))) return res.status(400).json({ error: 'Bad signature.' });
  const entity = req.body?.payload?.payment?.entity;
  if (['payment.captured', 'order.paid'].includes(req.body?.event) && entity?.order_id && entity?.id) {
    const payment = db.payments.find(p => p.provider === 'razorpay' && p.orderId === entity.order_id);
    if (payment) {
      try { await settle(payment, entity.id); } catch (err) { console.error(`[payments] webhook could not confirm ${payment.id}: ${err.message}`); }
    }
  }
  res.json({ ok: true }); // always 200 for a genuine call, so Razorpay does not keep retrying
});

export default router;
