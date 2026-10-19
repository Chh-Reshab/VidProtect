// ============================================
// Razorpay (online payments). Used when RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set;
// otherwise the app keeps its built-in beta test checkout.
//   rzp_test_… keys  -> Razorpay's test mode (free, no KYC, no real money)
//   rzp_live_… keys  -> real payments (needs your Razorpay KYC)
// Nothing here trusts the browser: orders are created by the server, and a payment only counts
// after (1) its signature checks out and (2) Razorpay itself confirms the amount and order.
// ============================================

import crypto from 'node:crypto';

const keyId = () => process.env.RAZORPAY_KEY_ID || '';
const keySecret = () => process.env.RAZORPAY_KEY_SECRET || '';
const API = () => (process.env.RAZORPAY_API_URL || 'https://api.razorpay.com/v1').replace(/\/+$/, '');

export const razorpayEnabled = () => Boolean(keyId() && keySecret());
export const razorpayTestMode = () => keyId().startsWith('rzp_test_');
export const publicKeyId = keyId;
export const webhookEnabled = () => Boolean(process.env.RAZORPAY_WEBHOOK_SECRET);

const call = async (method, path, body) => {
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: {
      authorization: `Basic ${Buffer.from(`${keyId()}:${keySecret()}`).toString('base64')}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${res.status}: ${data?.error?.description || 'request failed'}`);
  return data;
};

// amountPaise is an integer (₹499 = 49900)
export const createOrder = (amountPaise, receipt, notes) => call('POST', '/orders', { amount: amountPaise, currency: 'INR', receipt, notes });
export const fetchPayment = (paymentId) => call('GET', `/payments/${encodeURIComponent(paymentId)}`);
export const capturePayment = (paymentId, amountPaise) => call('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' });

const hmac = (secret, text) => crypto.createHmac('sha256', secret).update(text).digest('hex');
const sameHex = (a, b) => {
  const x = Buffer.from(String(a || ''), 'utf8');
  const y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

// The signature the browser hands back after checkout: HMAC-SHA256 of "order_id|payment_id"
export const checkoutSignatureValid = (orderId, paymentId, signature) => sameHex(hmac(keySecret(), `${orderId}|${paymentId}`), signature);

// Razorpay signs the exact bytes of each webhook body with the webhook secret
export const webhookSignatureValid = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  return Boolean(secret && rawBody) && sameHex(hmac(secret, rawBody), signature);
};
