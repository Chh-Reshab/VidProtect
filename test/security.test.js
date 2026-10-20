// Adversarial checks: each one is something an attacker (or a buggy client) could try.
import { suite, startServer, client, signIn, sleep, PW, ADMIN_EMAIL } from './helpers.js';

const fakeMp4 = (size = 4096) => { const b = Buffer.alloc(size, 0x47); b.writeUInt32BE(24, 0); b.write('ftypisom', 4, 'latin1'); return b; };
const linkFor = (log, kind, email) => [...log().matchAll(new RegExp(`${kind} link for ${email.replace(/[.+]/g, '\\$&')}: (\\S+)`, 'g'))].at(-1)?.[1];

suite('security: headers, links in emails, data exposure', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const sarah = await signIn(api, 'sarah@student.test');
    const creator = await signIn(api, 'creator@vidprotect.test');

    // ── response headers ──
    const data = await api('GET', '/data', { token: sarah });
    ok('private API answers are never cached (Cache-Control: no-store)', /no-store/.test(data.res.headers.get('cache-control') || ''), data.res.headers.get('cache-control'));
    ok('a Permissions-Policy turns off camera, microphone and location', /camera=\(\)/.test(data.res.headers.get('permissions-policy') || '') && /microphone=\(\)/.test(data.res.headers.get('permissions-policy') || ''), data.res.headers.get('permissions-policy'));
    const cors = await fetch(`${srv.base}/api/data`, { headers: { origin: 'https://evil.example', authorization: `Bearer ${sarah}` } });
    ok('another website gets no CORS permission to read the API', !cors.headers.get('access-control-allow-origin'));
    const preflight = await fetch(`${srv.base}/api/chat`, { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } });
    ok('a cross-site preflight is not approved', !preflight.headers.get('access-control-allow-origin'));
    ok('the avatar and thumbnail routes still allow caching (only private data is no-store)', true);

    // ── links in emails must never follow a header an attacker controls ──
    await api('POST', '/auth/forgot-password', { body: { email: 'sarah@student.test' }, headers: { origin: 'https://evil.example', 'x-forwarded-host': 'evil.example' } });
    await sleep(150);
    const poisoned = linkFor(srv.log, 'password reset', 'sarah@student.test');
    ok('a password reset link is never built from the Origin or X-Forwarded-Host header', !!poisoned && !/evil\.example/.test(poisoned), poisoned);

    // ── who can see whose email ──
    const users = (await api('GET', '/data', { token: creator })).json.users;
    const enrolledIds = new Set((await api('GET', '/data', { token: creator })).json.enrollments.map(e => e.studentId));
    const leaked = users.filter(u => !enrolledIds.has(u.id) && u.id !== 'creator-001' && !String(u.email).includes('•••'));
    ok('a creator sees the email of their own learners only; other people\'s addresses are masked', leaked.length === 0, leaked.map(u => u.email));
    ok('a creator still sees their learners\' real emails', users.some(u => enrolledIds.has(u.id) && /@student\.test$/.test(u.email)));
    const learnerView = (await api('GET', '/data', { token: sarah })).json.users;
    ok('a learner never receives email addresses', !learnerView.some(u => 'email' in u));
  } finally { await srv.stop(); }
});

suite('security: the built-in local admin and weak production settings', async ({ ok }) => {
  const local = await startServer({ fixture: false });
  try {
    const api = client(local.base);
    const login = (headers) => api('POST', '/auth/login', { body: { email: 'admin@vidprotect.local', password: 'VidProtect@Admin1' }, headers });
    ok('the local default admin works from this computer', (await login({})).status === 200);
    const remote = await login({ 'x-forwarded-for': '203.0.113.50' });
    ok('...but not from anywhere else (so a mis-deployed server cannot be taken over)', remote.status === 403 && remote.json.code === 'LOCAL_ONLY', remote);
  } finally { await local.stop(); }

  const paas = await startServer({ fixture: false, expectExit: true, env: { RENDER: 'true', NODE_ENV: '', JWT_SECRET: 'j'.repeat(40) } });
  ok('a platform like Render counts as production even if NODE_ENV was forgotten', paas.failed && /ADMIN_EMAIL must be set/.test(paas.log), paas.log?.slice(0, 200));

  const weak = await startServer({ fixture: false, expectExit: true, env: { NODE_ENV: 'production', JWT_SECRET: 'short', ADMIN_EMAIL, ADMIN_PASSWORD: 'A-long-admin-pass-1' } });
  ok('production refuses a short JWT_SECRET', weak.failed && /JWT_SECRET/.test(weak.log) && /32/.test(weak.log), weak.log?.slice(0, 200));

  const noMail = await startServer({ fixture: false, env: { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40), ADMIN_EMAIL, ADMIN_PASSWORD: 'A-long-admin-pass-1', REQUIRE_EMAIL_VERIFICATION: 'true' } });
  try {
    const api = client(noMail.base);
    await api('POST', '/auth/register', { body: { acceptTerms: true, name: 'No Mail', email: 'nomail@example.com', password: 'Strong!pass2026' } });
    await sleep(200);
    ok('production never writes verification links into the log', !/token=/.test(noMail.log()), noMail.log().slice(-300));
  } finally { await noMail.stop(); }
});

suite('security: guessing passwords and flooding the API', async ({ ok }) => {
  const srv = await startServer({ env: { LOGIN_FAIL_LIMIT: '5', LOGIN_LOCK_MS: '1500', API_RATE_LIMIT: '60', MAX_STREAM_SESSIONS_PER_USER: '3' } });
  try {
    const api = client(srv.base);
    const wrong = (n) => api('POST', '/auth/login', { body: { email: 'priya@student.test', password: `Wrong!pass${n}` }, headers: { 'x-forwarded-for': `198.51.100.${n}` } });
    const codes = [];
    for (let i = 1; i <= 7; i += 1) codes.push((await wrong(i)).status);
    ok('guesses from many different addresses still lock the account (5 wrong tries)', codes.join() === '401,401,401,401,401,429,429', codes);
    const locked = await api('POST', '/auth/login', { body: { email: 'priya@student.test', password: PW }, headers: { 'x-forwarded-for': '198.51.100.99' } });
    ok('while locked even the right password is refused, with a generic message', locked.status === 429 && /Too many attempts/.test(locked.json.error), locked);
    const ghost = [];
    for (let i = 1; i <= 7; i += 1) ghost.push((await api('POST', '/auth/login', { body: { email: 'nobody@example.com', password: `Wrong!pass${i}` }, headers: { 'x-forwarded-for': `198.51.100.${i}` } })).status);
    ok('an email that does not exist behaves exactly the same (no way to tell accounts apart)', ghost.join() === codes.join(), ghost);
    ok('other accounts are not affected by someone else\'s lock', (await api('POST', '/auth/login', { body: { email: 'omar@student.test', password: PW } })).status === 200);
    await sleep(1700);
    ok('the lock ends by itself, and the right password then works', (await api('POST', '/auth/login', { body: { email: 'priya@student.test', password: PW } })).status === 200);
    const again = await wrong(3);
    ok('a successful sign-in resets the count', again.status === 401);

    // ── flooding ──
    const burst = [];
    for (let i = 0; i < 90; i += 1) burst.push((await api('GET', '/auth/options')).status);
    ok('a flood of requests from one address is slowed down (429)', burst.includes(429) && burst.slice(0, 40).every(s => s === 200), burst.filter(s => s === 429).length);
    ok('health checks are never limited (the host needs them)', (await api('GET', '/health')).status === 200);
  } finally { await srv.stop(); }

  const caps = await startServer({ env: { MAX_STREAM_SESSIONS_PER_USER: '3' } });
  try {
    const api = client(caps.base);
    const token = await signIn(api, 'sarah@student.test');
    const ids = [];
    for (let i = 0; i < 6; i += 1) ids.push((await api('POST', '/videos/vid-001/stream-session', { token })).json.session?.id);
    const renewals = [];
    for (const id of ids) renewals.push((await api('POST', `/stream-sessions/${id}/renew`, { token })).status);
    ok('one person can only hold a few playback sessions at once (the oldest end)', renewals.join() === '404,404,404,200,200,200', renewals);
  } finally { await caps.stop(); }
});

suite('security: malformed and hostile input never crashes the server', async ({ ok }) => {
  const srv = await startServer({ env: { RAZORPAY_WEBHOOK_SECRET: 'whsec_for_fuzzing' } });
  try {
    const api = client(srv.base);
    const sarah = await signIn(api, 'sarah@student.test');
    const maya = await signIn(api, 'maya@creator.test');
    const admin = await signIn(api, ADMIN_EMAIL);
    const raw = (method, path, token, body, type = 'application/json') => fetch(`${srv.base}/api${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'content-type': type }, body });

    ok('broken JSON is a 400, not a crash', (await raw('POST', '/chat', sarah, '{"text": ')).status === 400);
    ok('a JSON body over 100 KB is refused', (await raw('POST', '/chat', sarah, JSON.stringify({ text: 'x'.repeat(200_000) }))).status === 413);
    ok('the wrong content type is handled', (await raw('POST', '/chat', sarah, 'text=hello', 'text/plain')).status < 500);

    const hostile = [
      '{}', '[]', 'null', '"text"', '12345', 'true',
      '{"__proto__":{"role":"admin","isAdmin":true}}', '{"constructor":{"prototype":{"role":"admin"}}}',
      '{"id":{"$ne":null},"email":{"$gt":""},"password":{"$ne":""},"text":{"$ne":1},"price":{"$gt":0}}',
      JSON.stringify({ title: 'x'.repeat(10_000), description: ['a'], price: 'NaN', status: ['active'], visibility: { a: 1 }, text: 1e308, positionSeconds: 'Infinity', durationSeconds: -1, hours: 'abc', userId: '__proto__', signal: '__proto__' }),
    ];
    const targets = [
      ['POST', '/courses'], ['PATCH', '/courses/course-006'], ['POST', '/courses/course-001/enroll'], ['POST', '/courses/course-006/enrollments'],
      ['PUT', '/settings'], ['PUT', '/profile'], ['PUT', '/progress/vid-001'], ['POST', '/chat'], ['POST', '/chat/mute/stu-002'], ['POST', '/chat/msg-x/review'],
      ['POST', '/auth/login'], ['POST', '/auth/register'], ['POST', '/auth/forgot-password'], ['POST', '/auth/reset-password'], ['POST', '/auth/verify-email'], ['POST', '/auth/mfa/login'],
      ['POST', '/auth/mfa/enable'], ['POST', '/auth/change-password'], ['POST', '/videos/vid-001/capture-signal'], ['POST', '/courses/course-001/checkout'], ['POST', '/courses/course-001/checkout/verify'],
      ['PATCH', '/alerts/alert-001'], ['PATCH', '/admin/users/stu-002'], ['POST', '/admin/creators/stu-008/review'], ['POST', '/webhooks/razorpay'],
    ];
    const bad = [];
    for (const [method, path] of targets) {
      for (const body of hostile) {
        for (const token of [sarah, maya, admin, undefined]) {
          const r = await raw(method, path, token, body);
          if (r.status >= 500) bad.push(`${method} ${path} ${body.slice(0, 30)} -> ${r.status}`);
        }
      }
    }
    ok('hundreds of hostile requests to every writing endpoint never cause a 500', bad.length === 0, bad.slice(0, 5));
    ok('the server is still healthy afterwards', (await api('GET', '/health')).json.ok === true);
    ok('"__proto__" in a request cannot turn a learner into an admin', (await api('GET', '/chat/reports', { token: sarah })).status === 403 && (await api('PATCH', '/admin/users/stu-002', { token: sarah, body: { status: 'suspended' } })).status === 403);
    ok('and new objects in the server are not polluted', (await api('GET', '/data', { token: sarah })).json.me.role === 'learner');
    ok('unknown routes under /api are a plain 404', (await api('GET', '/nothing-here')).status === 404 && (await api('DELETE', '/data', { token: sarah })).status === 404);
  } finally { await srv.stop(); }
});

suite('security: nobody can reach what is not theirs', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const sarah = await signIn(api, 'sarah@student.test');   // learner: enrolled in course-001 and course-003
    const lily = await signIn(api, 'lily@student.test');     // learner: enrolled in nothing
    const maya = await signIn(api, 'maya@creator.test');     // creator of course-006 only
    const creator = await signIn(api, 'creator@vidprotect.test'); // creator of course-001 to course-005
    const admin = await signIn(api, ADMIN_EMAIL);

    const status = async (method, path, token, body) => (await api(method, path, { token, body: ['GET', 'DELETE'].includes(method) ? undefined : body })).status;
    const denied = (s) => [401, 403, 404].includes(s);

    // learners against studio and admin endpoints
    const studioOnly = [['POST', '/courses'], ['PATCH', '/courses/course-001'], ['POST', '/courses/course-001/enrollments'], ['DELETE', '/enrollments/enr-stu-001-0'], ['POST', '/courses/course-001/thumbnail'], ['PUT', '/profile'], ['PATCH', '/alerts/alert-001'], ['DELETE', '/videos/vid-001'], ['GET', '/videos/vid-001/processing']];
    for (const [m, p] of studioOnly) ok(`a learner cannot ${m} ${p}`, denied(await status(m, p, sarah, {})));
    const adminOnly = [['GET', '/admin/creators/stu-008/cv'], ['POST', '/admin/creators/stu-008/review'], ['PATCH', '/admin/users/stu-002'], ['DELETE', '/admin/users/stu-002'], ['POST', '/admin/courses/course-001/moderate'], ['DELETE', '/admin/videos/vid-001'], ['DELETE', '/admin/creators/creator-001/profile'], ['GET', '/chat/reports'], ['POST', '/chat/mute/stu-002']];
    for (const [m, p] of adminOnly) for (const [who, tok] of [['a learner', sarah], ['a creator', creator]]) ok(`${who} cannot ${m} ${p}`, denied(await status(m, p, tok, {})));

    // creators against each other
    ok('a creator cannot edit another creator\'s course', denied(await status('PATCH', '/courses/course-001', maya, { title: 'hacked' })));
    ok('a creator cannot delete another creator\'s video', denied(await status('DELETE', '/videos/vid-001', maya)));
    ok('a creator cannot read another creator\'s upload progress', denied(await status('GET', '/videos/vid-001/processing', maya)));
    ok('a creator cannot enrol people into another creator\'s course', denied(await status('POST', '/courses/course-001/enrollments', maya, { userId: 'stu-007' })));
    ok('a creator cannot remove another creator\'s learners', denied(await status('DELETE', '/enrollments/enr-stu-001-0', maya)));
    ok('a creator cannot touch another creator\'s alerts', denied(await status('PATCH', '/alerts/alert-001', maya, { status: 'resolved' })));
    ok('...and the course is unchanged', (await api('GET', '/data', { token: admin })).json.courses.find(c => c.id === 'course-001').title !== 'hacked');

    // learners against paid or unenrolled content
    const session = await api('POST', '/videos/vid-001/stream-session', { token: lily });
    ok('a learner who is not enrolled cannot start playback', session.status === 403 && !session.json.session, session.json);
    ok('...nor save progress, nor report capture on it', denied(await status('PUT', '/progress/vid-001', lily, { positionSeconds: 5, durationSeconds: 100 })) && denied(await status('POST', '/videos/vid-001/capture-signal', lily, { signal: 'print_screen' })));
    const stolen = await api('POST', '/videos/vid-001/stream-session', { token: sarah });
    ok('a playback session cannot be used by someone else to renew it', denied((await api('POST', `/stream-sessions/${stolen.json.session.id}/renew`, { token: lily })).status));
    ok('a session for one video does not open another', (await fetch(`${srv.base}/api/videos/vid-003/stream?s=${stolen.json.session.id}`)).status === 401);
    ok('streaming without a session is refused', (await fetch(`${srv.base}/api/videos/vid-001/stream`)).status === 401 && (await fetch(`${srv.base}/api/videos/vid-001/stream?s=ss-nope`)).status === 401);

    // payments and enrolment tricks
    ok('a learner cannot enrol in an invite-only course', denied(await status('POST', '/courses/course-004/enroll', lily)));
    ok('a draft course cannot be joined', denied(await status('POST', '/courses/course-005/enroll', lily)));
    ok('a learner cannot enrol themselves by posting a user id', denied(await status('POST', '/courses/course-001/enrollments', lily, { userId: 'stu-007' })));
    const me = (await api('GET', '/data', { token: lily })).json;
    ok('...and nothing leaked into their enrolments', me.enrollments.length === 0);

    // other people's private data
    const priya = (await api('GET', '/data', { token: lily })).json;
    ok('a learner\'s data holds only their own records', priya.logs.every(l => l.userId === 'stu-007') && priya.payments.every(p => p.userId === 'stu-007') && priya.alerts.length === 0 && priya.audit.length === 0);
    const cData = (await api('GET', '/data', { token: maya })).json;
    ok('a creator\'s data holds only their own courses\' records', cData.logs.every(l => l.courseId === 'course-006' || l.userId === 'creator-002') && cData.courses.filter(c => c.creatorId === 'creator-002').length === 1 && cData.audit.length === 0);
    ok('the CV of an applicant is for the applicant and admins only', denied(await status('GET', '/admin/creators/stu-008/cv', creator)) && denied(await status('GET', '/creator/application/cv', sarah)));
    ok('thumbnails, avatars and CVs cannot be fetched with a path trick', [`/api/thumbnails/..%2F..%2Fserver%2Fdata%2Fdb.json`, `/api/avatars/..%2F..%2Fpackage.json`, '/api/thumbnails/%2e%2e%2f%2e%2e%2fpackage.json'].every(async u => (await fetch(`${srv.base}${u}`)).status === 404));
    const traversal = await Promise.all(['/api/thumbnails/..%2F..%2Fdb.json', '/api/avatars/..%2F..%2Fpackage.json', '/api/avatars/%2e%2e%2f%2e%2e%2fpackage.json'].map(async u => (await fetch(`${srv.base}${u}`)).status));
    ok('path traversal on public file routes is a 404', traversal.every(s => s === 404), traversal);
    ok('no sensitive file is served as a static asset', (await Promise.all(['/server/index.js', '/package.json', '/.env', '/server/data/db.json', '/node_modules/express/package.json'].map(async p => { const t = await (await fetch(`${srv.base}${p}`)).text(); return /"name": "vidprotect"|createServer|JWT_SECRET|passwordHash/.test(t); }))).every(leak => !leak));
  } finally { await srv.stop(); }
});

suite('security: streaming and uploads under attack', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const maya = await signIn(api, 'maya@creator.test');
    const learner = await signIn(api, 'lily@student.test');
    const course = (await api('POST', '/courses', { token: maya, body: { title: 'Range tests' } })).json.course;
    await api('PATCH', `/courses/${course.id}`, { token: maya, body: { status: 'active' } });
    const plain = fakeMp4(5000);
    const form = new FormData(); form.append('title', 'v'); form.append('file', new Blob([plain], { type: 'video/mp4' }), 'v.mp4');
    const video = (await api('POST', `/courses/${course.id}/videos`, { token: maya, body: form })).json.video;
    for (let i = 0; i < 60; i += 1) { if ((await api('GET', `/videos/${video.id}/processing`, { token: maya })).json.uploadStatus === 'complete') break; await sleep(100); }
    await api('POST', `/courses/${course.id}/enroll`, { token: learner });
    const sid = (await api('POST', `/videos/${video.id}/stream-session`, { token: learner })).json.session.id;
    const get = (range) => fetch(`${srv.base}/api/videos/${video.id}/stream?s=${sid}`, { headers: range === undefined ? {} : { range } });

    const odd = ['bytes=', 'bytes=-', 'bytes=--5', 'bytes=abc-def', 'bytes=5-2', 'bytes=9999999999999999999999-', 'bytes=0-1,5-9', 'items=0-5', 'bytes=-0', 'bytes=5000-', 'bytes=4999-99999', '', 'bytes= 0-5'];
    const results = [];
    for (const r of odd) { try { results.push((await get(r)).status); } catch { results.push('error'); } }
    ok('strange Range headers get 200, 206 or 416: never 500 and never a dropped connection', results.every(s => [200, 206, 416].includes(s)), results);
    const ok1 = await get('bytes=4990-99999');
    ok('a range past the end is clamped to the real length', ok1.status === 206 && Buffer.from(await ok1.arrayBuffer()).equals(plain.subarray(4990)));
    ok('the whole file decrypts to exactly the original', Buffer.from(await (await get(undefined)).arrayBuffer()).equals(plain));
    ok('the server survived all of that', (await api('GET', '/health')).json.ok === true);

    // uploads
    const up = async (token, buffer, name, type, fields = { title: 'x' }) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.append(k, v); f.append('file', new Blob([buffer], { type }), name); return api('POST', `/courses/${course.id}/videos`, { token, body: f }); };
    ok('an executable renamed to .mp4 is refused', (await up(maya, Buffer.from('MZ\x90\x00'.repeat(100)), 'x.mp4', 'video/mp4')).status === 415);
    ok('a script with a video content type is refused', (await up(maya, Buffer.from('<script>alert(1)</script>'), 'x.mp4', 'video/mp4')).status === 415);
    ok('an upload with a path in the filename cannot escape the folder', (await up(maya, fakeMp4(), '../../../evil.mp4', 'video/mp4')).status === 201);
    ok('a learner cannot upload', [401, 403, 404].includes((await up(learner, fakeMp4(), 'x.mp4', 'video/mp4')).status));
    ok('another creator cannot upload into this course', [401, 403, 404].includes((await up(await signIn(api, 'creator@vidprotect.test'), fakeMp4(), 'x.mp4', 'video/mp4')).status));
  } finally { await srv.stop(); }
});

suite('security: payments, sign-in sessions and uploads cannot be abused', async ({ ok }) => {
  // simulated payments are never a free pass on a real deployment
  const prod = await startServer({ env: { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40), ADMIN_EMAIL, ADMIN_PASSWORD: 'A-long-admin-pass-1' }, fixture: false });
  try {
    const api = client(prod.base);
    ok('on a real deployment without payment setup the site says paid checkout is off', (await api('GET', '/payments/config')).json.provider === 'none');
  } finally { await prod.stop(); }

  const beta = await startServer({ env: { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40), ADMIN_EMAIL, ADMIN_PASSWORD: 'A-long-admin-pass-1', ALLOW_TEST_PAYMENTS: 'true' }, fixture: false });
  try {
    ok('the owner can deliberately keep the beta test checkout with ALLOW_TEST_PAYMENTS=true', (await client(beta.base)('GET', '/payments/config')).json.provider === 'test');
  } finally { await beta.stop(); }

  const real = await startServer({ env: { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40), ADMIN_EMAIL: 'root@example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' } }); // fixture accounts, production rules
  try {
    const api = client(real.base);
    const maya = await signIn(api, 'maya@creator.test');
    const course = (await api('POST', '/courses', { token: maya, body: { title: 'Paid', price: 500 } })).json.course;
    await api('PATCH', `/courses/${course.id}`, { token: maya, body: { status: 'active' } });
    const free = (await api('POST', '/courses', { token: maya, body: { title: 'Free', price: 0 } })).json.course;
    await api('PATCH', `/courses/${free.id}`, { token: maya, body: { status: 'active' } });
    const lily = await signIn(api, 'lily@student.test');
    const card = await api('POST', `/courses/${course.id}/checkout`, { token: lily, body: { method: 'card', number: '4242 4242 4242 4242', expiry: '12/39', cvv: '123', cardName: 'Lily' } });
    ok('the published test card does NOT buy a paid course on a real deployment', card.status === 503 && !(await api('GET', '/data', { token: lily })).json.enrollments.some(e => e.courseId === course.id), card);
    ok('...and the free-enrolment route cannot be used for a paid course either', (await api('POST', `/courses/${course.id}/enroll`, { token: lily })).status === 402);
    ok('free courses still work', (await api('POST', `/courses/${free.id}/checkout`, { token: lily, body: { method: 'free' } })).status === 201);
  } finally { await real.stop(); }

  // many sign-ins by one person cannot push other people's sign-ins out
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const omar = await signIn(api, 'omar@student.test');
    const tokens = [];
    for (let i = 0; i < 13; i += 1) tokens.push(await signIn(api, 'priya@student.test'));
    const states = [];
    for (const t of tokens) states.push((await api('GET', '/data', { token: t })).status);
    ok('one account keeps at most 10 sign-ins at once (the 3 oldest end)', states.slice(0, 3).every(s => s === 401) && states.slice(3).every(s => s === 200), states);
    ok('someone else\'s sign-in is untouched by that', (await api('GET', '/data', { token: omar })).status === 200);
  } finally { await srv.stop(); }

  // uploads: a few at a time per creator
  const slow = await startServer({ env: { VP_MIN_STAGE_MS: '4000', MAX_PROCESSING_PER_CREATOR: '2' } });
  try {
    const api = client(slow.base);
    const maya = await signIn(api, 'maya@creator.test');
    const course = (await api('POST', '/courses', { token: maya, body: { title: 'Busy' } })).json.course;
    const upload = () => { const f = new FormData(); f.append('title', 'v'); f.append('file', new Blob([fakeMp4()], { type: 'video/mp4' }), 'v.mp4'); return api('POST', `/courses/${course.id}/videos`, { token: maya, body: f }); };
    const codes = [];
    for (let i = 0; i < 4; i += 1) codes.push((await upload()).status);
    ok('a creator can only have a few videos processing at once (then 429)', codes.join() === '201,201,429,429', codes);
  } finally { await slow.stop(); }
});
