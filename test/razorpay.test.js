import http from 'node:http';
import crypto from 'node:crypto';
import { suite, startServer, PW } from './helpers.js';

suite('Razorpay payments: orders, signatures, amounts and the webhook', async ({ ok }) => {
  const SECRET = 'rzp_secret_for_tests', WH = 'whsec_for_tests', KEY = 'rzp_test_abc123';
  // ── a tiny fake Razorpay ──
  const orders = new Map(), payments = new Map(); const seen = { orders: [], captures: [] };
  const fake = http.createServer(async (req, res) => {
    const chunks = []; for await (const c of req) chunks.push(c); const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {};
    const send = (code, obj) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
    if (req.url === '/_set') { payments.set(body.id, body); return send(200, {}); }
    const expectAuth = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');
    if (req.headers.authorization !== expectAuth) return send(401, { error: { description: 'Authentication failed' } });
    if (req.method === 'POST' && req.url === '/v1/orders') { const o = { id: 'order_' + crypto.randomBytes(5).toString('hex'), ...body, status: 'created' }; orders.set(o.id, o); seen.orders.push(body); return send(200, o); }
    const m = /^\/v1\/payments\/([^/]+)(\/capture)?$/.exec(req.url);
    if (m && payments.has(m[1])) {
      const p = payments.get(m[1]);
      if (m[2]) { seen.captures.push(body); p.status = 'captured'; return send(200, p); }
      return send(200, p);
    }
    send(404, { error: { description: 'not found' } });
  });
  await new Promise(resolve => fake.listen(0, '127.0.0.1', resolve));
  const FAKE = fake.address().port;

  // ── the app ──
  const srv = await startServer({ env: { RAZORPAY_KEY_ID: KEY, RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_WEBHOOK_SECRET: WH, RAZORPAY_API_URL: `http://127.0.0.1:${FAKE}/v1` } });
  const base = srv.base;

  const J = { 'content-type': 'application/json' };
  const api = async (method, p, token, body, extraHeaders = {}) => { const r = await fetch(`${base}/api${p}`, { method, headers: { ...J, ...(token ? { authorization: `Bearer ${token}` } : {}), ...extraHeaders }, body: body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body)) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const login = async (email) => (await api('POST', '/auth/login', null, { email, password: PW })).json.accessToken;
  const maya = await login('maya@creator.test'), sarah = await login('sarah@student.test'), marcus = await login('marcus@student.test'), admin = await login('admin@vidprotect.test');
  const sign = (o, p) => crypto.createHmac('sha256', SECRET).update(`${o}|${p}`).digest('hex');
  const whSign = (raw) => crypto.createHmac('sha256', WH).update(raw).digest('hex');
  const setRz = (p) => fetch(`http://127.0.0.1:${FAKE}/_set`, { method: 'POST', body: JSON.stringify(p) });
  const rzPay = (id, order, amount, extra = {}) => ({ id, order_id: order, amount, currency: 'INR', status: 'captured', method: 'card', card: { network: 'Visa', last4: '1111' }, ...extra });
  const mine = async (t) => (await api('GET', '/data', t)).json;

  // a paid course by a creator
  const course = (await api('POST', '/courses', maya, { title: 'Razorpay Course', price: 499 })).json.course;
  await api('PATCH', `/courses/${course.id}`, maya, { status: 'active' });
  const freeCourse = (await api('POST', '/courses', maya, { title: 'Free One', price: 0 })).json.course;
  await api('PATCH', `/courses/${freeCourse.id}`, maya, { status: 'active' });

  const cfg = await api('GET', '/payments/config');
  ok('the site is told to use Razorpay (test mode)', cfg.json.provider === 'razorpay' && cfg.json.testMode === true, cfg);
  ok('building a paid purchase the old way is refused', (await api('POST', `/courses/${course.id}/checkout`, sarah, { method: 'upi', upiId: 'a@okbank' })).status === 400);
  ok('free courses still enrol directly', (await api('POST', `/courses/${freeCourse.id}/checkout`, sarah, { method: 'free' })).status === 201);

  // ── orders ──
  ok('an order needs a signed-in user', (await api('POST', `/courses/${course.id}/checkout/order`, null, {})).status === 401);
  ok('the owner cannot buy their own course', (await api('POST', `/courses/${course.id}/checkout/order`, maya, {})).status === 400);
  ok('a free course is not sold through Razorpay', (await api('POST', `/courses/${freeCourse.id}/checkout/order`, marcus, {})).status === 400);
  const o1 = await api('POST', `/courses/${course.id}/checkout/order`, sarah, { amount: 1, price: 1 });
  ok('an order is created at the course price (₹499 = 49900 paise), ignoring anything the browser sends', o1.status === 200 && o1.json.amount === 49900 && seen.orders.at(-1).amount === 49900 && o1.json.currency === 'INR', [o1, seen.orders.at(-1)]);
  ok('the public key id is returned and the secret never is', o1.json.keyId === KEY && !JSON.stringify(o1.json).includes(SECRET));
  const order1 = o1.json.orderId;
  ok('the unpaid order is not shown to the creator or admin', !(await mine(maya)).payments.some(p => p.orderId === order1) && !(await mine(admin)).payments.some(p => p.orderId === order1));
  ok('...but the buyer sees it as created', (await mine(sarah)).payments.some(p => p.orderId === order1 && p.status === 'created'));
  ok('no enrolment exists before payment', !(await mine(sarah)).enrollments.some(e => e.courseId === course.id));

  // ── verify ──
  const pay1 = 'pay_ok1';
  await setRz(rzPay(pay1, order1, 49900));
  ok('a wrong signature is refused', (await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: 'f'.repeat(64) })).status === 400);
  ok('a signature made with another key is refused', (await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: crypto.createHmac('sha256', 'wrong').update(`${order1}|${pay1}`).digest('hex') })).status === 400);
  ok('someone else cannot verify another person\'s order', (await api('POST', `/courses/${course.id}/checkout/verify`, marcus, { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sign(order1, pay1) })).status === 404);
  ok('an unknown order is refused', (await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: 'order_nope', razorpay_payment_id: pay1, razorpay_signature: sign('order_nope', pay1) })).status === 404);
  ok('still not enrolled after those attempts', !(await mine(sarah)).enrollments.some(e => e.courseId === course.id));

  // right signature but Razorpay says the amount was only ₹1
  const payLow = 'pay_low'; await setRz(rzPay(payLow, order1, 100));
  ok('a valid signature with the wrong amount at Razorpay is refused', (await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: payLow, razorpay_signature: sign(order1, payLow) })).status === 400);
  // a payment that belongs to a different order
  const payOther = 'pay_other'; await setRz(rzPay(payOther, 'order_other', 49900));
  ok('a valid signature for a payment on a different order is refused', (await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: payOther, razorpay_signature: sign(order1, payOther) })).status === 400);
  // payment not captured yet
  const payWait = 'pay_wait'; await setRz(rzPay(payWait, order1, 49900, { status: 'created' }));
  const wait = await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: payWait, razorpay_signature: sign(order1, payWait) });
  ok('a payment Razorpay has not captured is "pending", not a purchase', wait.status === 202 && !(await mine(sarah)).enrollments.some(e => e.courseId === course.id), wait);

  const good = await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sign(order1, pay1) });
  ok('a genuine payment completes the purchase', good.status === 201 && good.json.payment.status === 'succeeded' && good.json.payment.detail === 'Visa •••• 1111', good);
  let me = await mine(sarah);
  ok('the learner is enrolled once', me.enrollments.filter(e => e.courseId === course.id).length === 1);
  const again = await api('POST', `/courses/${course.id}/checkout/verify`, sarah, { razorpay_order_id: order1, razorpay_payment_id: pay1, razorpay_signature: sign(order1, pay1) });
  ok('verifying again is harmless (no second enrolment)', again.status === 201 && (await mine(sarah)).enrollments.filter(e => e.courseId === course.id).length === 1);
  ok('the creator now sees the paid sale', (await mine(maya)).payments.some(p => p.orderId === order1 && p.status === 'succeeded' && p.amount === 499));
  ok('already enrolled: a new order is refused', (await api('POST', `/courses/${course.id}/checkout/order`, sarah, {})).status === 409);

  // ── authorized payments are captured by the server ──
  const o2 = (await api('POST', `/courses/${course.id}/checkout/order`, marcus, {})).json;
  const pay2 = 'pay_auth'; await setRz(rzPay(pay2, o2.orderId, 49900, { status: 'authorized', method: 'upi', vpa: 'priya@okbank' }));
  const cap = await api('POST', `/courses/${course.id}/checkout/verify`, marcus, { razorpay_order_id: o2.orderId, razorpay_payment_id: pay2, razorpay_signature: sign(o2.orderId, pay2) });
  ok('an authorized payment is captured, then counted', cap.status === 201 && seen.captures.at(-1)?.amount === 49900 && cap.json.payment.detail === 'UPI pr•••@okbank', [cap, seen.captures]);

  // ── webhook ──
  const course2 = (await api('POST', '/courses', maya, { title: 'Webhook Course', price: 250 })).json.course; await api('PATCH', `/courses/${course2.id}`, maya, { status: 'active' });
  const o3 = (await api('POST', `/courses/${course2.id}/checkout/order`, sarah, {})).json;
  const pay3 = 'pay_wh'; await setRz(rzPay(pay3, o3.orderId, 25000));
  const event = (id, order) => JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id, order_id: order } } } });
  const raw3 = event(pay3, o3.orderId);
  ok('a webhook without a signature is refused', (await api('POST', '/webhooks/razorpay', null, raw3)).status === 400);
  ok('a webhook with a wrong signature is refused', (await api('POST', '/webhooks/razorpay', null, raw3, { 'x-razorpay-signature': 'a'.repeat(64) })).status === 400);
  ok('a webhook for an unknown order is accepted but does nothing', (await api('POST', '/webhooks/razorpay', null, event('pay_x', 'order_unknown'), { 'x-razorpay-signature': whSign(event('pay_x', 'order_unknown')) })).status === 200);
  const payBad = 'pay_whbad'; await setRz(rzPay(payBad, o3.orderId, 100));
  await api('POST', '/webhooks/razorpay', null, event(payBad, o3.orderId), { 'x-razorpay-signature': whSign(event(payBad, o3.orderId)) });
  ok('a signed webhook with the wrong amount does not enrol anyone', !(await mine(sarah)).enrollments.some(e => e.courseId === course2.id));
  const wh = await api('POST', '/webhooks/razorpay', null, raw3, { 'x-razorpay-signature': whSign(raw3) });
  ok('a genuine webhook completes the purchase even though the browser never came back', wh.status === 200 && (await mine(sarah)).enrollments.some(e => e.courseId === course2.id));
  await api('POST', '/webhooks/razorpay', null, raw3, { 'x-razorpay-signature': whSign(raw3) });
  ok('a repeated webhook does not enrol twice', (await mine(sarah)).enrollments.filter(e => e.courseId === course2.id).length === 1);
  const racePay = 'pay_race'; const o4 = (await api('POST', `/courses/${course2.id}/checkout/order`, marcus, {})).json; await setRz(rzPay(racePay, o4.orderId, 25000));
  const rawRace = event(racePay, o4.orderId);
  await Promise.all([
    api('POST', `/courses/${course2.id}/checkout/verify`, marcus, { razorpay_order_id: o4.orderId, razorpay_payment_id: racePay, razorpay_signature: sign(o4.orderId, racePay) }),
    api('POST', '/webhooks/razorpay', null, rawRace, { 'x-razorpay-signature': whSign(rawRace) }),
  ]);
  ok('browser and webhook at the same moment still enrol exactly once', (await mine(marcus)).enrollments.filter(e => e.courseId === course2.id).length === 1);
  ok('the course enrolment counter matches', (await api('GET', '/data', admin)).json.courses.find(c => c.id === course2.id).enrolledCount === 2);

  await srv.stop(); fake.close();
});
