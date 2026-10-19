import { suite, startServer, PW } from './helpers.js';

suite('built-in test checkout', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  const login = async (email) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).accessToken;
  const call = async (token, method, path, body) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  const card = (over = {}) => ({ method: 'card', number: '4242 4242 4242 4242', expiry: '12/39', cvv: '123', cardName: 'Test User', ...over });

  const maya = await login('maya@creator.test');
  const reshab = await login('creator@vidprotect.test');
  const sarah = await login('sarah@student.test');
  const priya = await login('priya@student.test');

  // pricing rules
  ok('negative price rejected', (await call(maya, 'POST', '/courses', { title: 'x', price: -5 })).status === 400);
  ok('decimal price rejected', (await call(maya, 'POST', '/courses', { title: 'x', price: 9.99 })).status === 400);
  ok('text price rejected', (await call(maya, 'POST', '/courses', { title: 'x', price: 'abc' })).status === 400);
  ok('absurd price rejected', (await call(maya, 'POST', '/courses', { title: 'x', price: 99999999 })).status === 400);

  const paid = (await call(maya, 'POST', '/courses', { title: 'Paid Course ' + Date.now(), price: 499 })).json.course;
  const free = (await call(maya, 'POST', '/courses', { title: 'Free Course ' + Date.now() })).json.course;
  ok('paid course has price 499 INR', paid.price === 499 && paid.currency === 'INR');
  ok('course defaults to free (0)', free.price === 0);
  await call(maya, 'PATCH', `/courses/${paid.id}`, { status: 'active' });
  await call(maya, 'PATCH', `/courses/${free.id}`, { status: 'active' });
  ok('other creator cannot reprice', (await call(reshab, 'PATCH', `/courses/${paid.id}`, { price: 1 })).status === 404);
  ok('learner cannot reprice (404, same as non-owner)', (await call(sarah, 'PATCH', `/courses/${paid.id}`, { price: 1 })).status === 404);

  // paid flow
  ok('one-click enrol blocked for paid course (402)', (await call(sarah, 'POST', `/courses/${paid.id}/enroll`)).status === 402);
  ok('free confirm method on paid course rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, { method: 'free' })).status === 400);
  ok('real-looking card rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, card({ number: '4111 1111 1111 1111' }))).status === 400);
  ok('expired card rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, card({ expiry: '01/20' }))).status === 400);
  ok('bad cvv rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, card({ cvv: '1' }))).status === 400);
  const declined = await call(sarah, 'POST', `/courses/${paid.id}/checkout`, card({ number: '4000000000000002' }));
  ok('declined test card = 402, no enrolment', declined.status === 402);
  ok('bad UPI rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, { method: 'upi', upiId: 'nope' })).status === 400);
  ok('unknown bank rejected', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, { method: 'netbanking', bank: 'Evil Bank' })).status === 400);
  ok('no token = 401', (await call(null, 'POST', `/courses/${paid.id}/checkout`, card())).status === 401);

  const sent = card({ amount: 1 }); // client tries to set its own price
  const buy = await call(sarah, 'POST', `/courses/${paid.id}/checkout`, { ...sent, price: 1 });
  ok('card purchase succeeds', buy.status === 201 && buy.json.payment.status === 'succeeded');
  ok('amount is server price, not client value', buy.json.payment.amount === 499);
  ok('card number never returned/stored in full', !JSON.stringify(buy.json).includes('4242 4242') && buy.json.payment.detail === 'Visa •••• 4242');
  const dbRaw = (await import('node:fs')).readFileSync('D:/vidprotect/server/data/db.json', 'utf8');
  ok('card number not in database file', dbRaw.length > 1000 && !dbRaw.includes('4242424242424242') && !dbRaw.includes('4242 4242'));
  ok('second purchase blocked (409)', (await call(sarah, 'POST', `/courses/${paid.id}/checkout`, card())).status === 409);

  const dSarah = (await call(sarah, 'GET', '/data')).json;
  ok('learner enrolled after payment', dSarah.enrollments.some(e => e.courseId === paid.id && e.paymentId === buy.json.payment.id));
  ok('learner sees own payments only', dSarah.payments.every(p => p.userId === 'stu-001'));
  const dMaya = (await call(maya, 'GET', '/data')).json;
  ok('creator sees revenue rows for own course', dMaya.payments.some(p => p.courseId === paid.id && p.amount === 499));
  const dReshab = (await call(reshab, 'GET', '/data')).json;
  ok('other creator sees none of them', !dReshab.payments.some(p => p.courseId === paid.id));

  // UPI + netbanking
  ok('UPI purchase succeeds', (await call(priya, 'POST', `/courses/${paid.id}/checkout`, { method: 'upi', upiId: 'priya@okbank' })).status === 201);

  // repricing doesn't touch existing learners
  await call(maya, 'PATCH', `/courses/${paid.id}`, { price: 999 });
  const stream = (await call(sarah, 'GET', '/data')).json;
  ok('existing learner keeps access after price change', stream.enrollments.some(e => e.courseId === paid.id && e.status === 'active'));

  // free flow
  ok('free course needs explicit free confirm', (await call(sarah, 'POST', `/courses/${free.id}/checkout`, {})).status === 400);
  const f = await call(sarah, 'POST', `/courses/${free.id}/checkout`, { method: 'free' });
  ok('free enrol at INR 0 succeeds', f.status === 201 && f.json.payment.amount === 0 && f.json.payment.method === 'free');
  ok('free enrol twice = 409', (await call(sarah, 'POST', `/courses/${free.id}/checkout`, { method: 'free' })).status === 409);

  // creator cannot buy own, invite-only
  ok('owner cannot buy own course', (await call(maya, 'POST', `/courses/${paid.id}/checkout`, card())).status === 400);
  const inv = (await call(maya, 'POST', '/courses', { title: 'Invite ' + Date.now(), visibility: 'invite_only', price: 10 })).json.course;
  await call(maya, 'PATCH', `/courses/${inv.id}`, { status: 'active' });
  ok('invite-only course cannot be bought', (await call(priya, 'POST', `/courses/${inv.id}/checkout`, card())).status === 403);
  } finally { await srv.stop(); }
});
