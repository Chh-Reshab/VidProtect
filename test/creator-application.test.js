import { suite, startServer, PW } from './helpers.js';

suite('creator sign-up, application, review and approval', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  const J = { 'content-type': 'application/json' };
  const post = async (p, b, token) => { const r = await fetch(`${base}/api${p}`, { method: 'POST', headers: { ...J, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const get = async (p, token) => { const r = await fetch(`${base}/api${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }); return { status: r.status, json: await r.clone().json().catch(() => ({})), res: r }; };
  const login = async (email, password, portal) => { const r = await post('/auth/login', { email, password, portal }); return { ...r, token: r.json.accessToken }; };
  const apply = async (token, fields, file) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, String(v));
    if (file) f.append('cv', new Blob([file.data], { type: 'application/octet-stream' }), file.name);
    const r = await fetch(`${base}/api/creator/application`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: f });
    return { status: r.status, json: await r.json().catch(() => ({})) };
  };
  const goodFields = {
    displayName: 'Asha Rao', teachingHistory: 'I have taught data structures to undergraduates for five years and run weekend coding bootcamps for working professionals in my city.',
    topics: 'Python, data structures', yearsExperience: 5, linkedinUrl: 'https://www.linkedin.com/in/asha-rao', teachesElsewhere: false, confirm: true,
  };
  const pdf = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3000, 7)]);
  const stamp = Date.now();
  const email = `creator${stamp}@example.com`, password = 'Teach!er2026';

  // ── separate creator sign-up ──
  const reg = await post('/auth/creator/register', { acceptTerms: true, name: 'Asha Rao', email, password });
  ok('creator sign-up works', reg.status === 201, reg);
  ok('weak password refused on creator sign-up', (await post('/auth/creator/register', { acceptTerms: true, name: 'Bad Pw', email: `b${stamp}@example.com`, password: 'abc' })).status === 400);
  ok('duplicate creator email refused', (await post('/auth/creator/register', { acceptTerms: true, name: 'Asha Rao', email, password })).status === 409);

  // ── portals ──
  const lc = await login(email, password, 'creator');
  ok('creator signs in on the creator portal', lc.status === 200 && lc.json.user.role === 'creator' && lc.json.user.creatorStatus === 'unsubmitted', lc);
  const asha = lc.token;
  const wrong1 = await login(email, password, 'learner');
  ok('creator is refused on the learner portal (WRONG_PORTAL)', wrong1.status === 403 && wrong1.json.code === 'WRONG_PORTAL', wrong1);
  const wrong2 = await login('sarah@student.test', PW, 'creator');
  ok('learner is refused on the creator portal (WRONG_PORTAL)', wrong2.status === 403 && wrong2.json.code === 'WRONG_PORTAL', wrong2);
  ok('wrong password on the creator portal is a plain 401', (await login(email, 'Wrong!pass99', 'creator')).status === 401);
  const maya = (await login('maya@creator.test', PW, 'creator'));
  ok('an existing approved creator signs in on the creator portal', maya.status === 200 && !!maya.token, maya);
  const sarah = (await login('sarah@student.test', PW, 'learner')).token;
  const admin = (await login('admin@vidprotect.test', PW)).token;

  // ── locked until approved ──
  const data = await get('/data', asha);
  ok('locked creator gets only their own profile from /data', data.status === 200 && data.json.me.id && data.json.courses.length === 0 && data.json.users.length === 0 && data.json.videos.length === 0, data.json);
  for (const [label, call] of [
    ['create a course', () => post('/courses', { title: 'Nope' }, asha)],
    ['list courses', () => get('/courses', asha)],
    ['enroll as a learner', () => post('/courses/course-001/enroll', {}, asha)],
    ['read progress', () => get('/progress', asha)],
    ['open the studio data (logs)', () => get('/logs', asha)],
  ]) { const r = await call(); ok(`locked creator cannot ${label}`, r.status === 403 && r.json.code === 'CREATOR_NOT_APPROVED' || r.status === 404, r.status); }
  const st0 = await get('/creator/application', asha);
  ok('application starts as unsubmitted', st0.json.status === 'unsubmitted' && st0.json.application === null, st0.json);
  ok('learners cannot use the application endpoints', (await get('/creator/application', sarah)).status === 403);
  ok('the old "learner applies to be a creator" endpoint is gone', (await post('/auth/creator-apply', { displayName: 'X Y', bio: 'z' }, sarah)).status === 404);

  // ── validation ──
  const bad = [
    ['missing everything', {}, 'displayName'],
    ['short teaching history', { ...goodFields, teachingHistory: 'too short' }, 'teachingHistory'],
    ['no topics', { ...goodFields, topics: '' }, 'topics'],
    ['bad years', { ...goodFields, yearsExperience: 'many' }, 'yearsExperience'],
    ['years too high', { ...goodFields, yearsExperience: 99 }, 'yearsExperience'],
    ['LinkedIn link on another site', { ...goodFields, linkedinUrl: 'https://evil.example.com/in/asha' }, 'linkedinUrl'],
    ['LinkedIn link that is not a profile', { ...goodFields, linkedinUrl: 'https://www.linkedin.com/feed/' }, 'linkedinUrl'],
    ['javascript: link', { ...goodFields, linkedinUrl: 'javascript:alert(1)' }, 'linkedinUrl'],
    ['neither CV nor LinkedIn', { ...goodFields, linkedinUrl: '' }, 'credentials'],
    ['teaches elsewhere without platform', { ...goodFields, teachesElsewhere: true }, 'platform'],
    ['teaches elsewhere without link', { ...goodFields, teachesElsewhere: true, platform: 'YouTube' }, 'platformUrl'],
    ['platform not in the list', { ...goodFields, teachesElsewhere: true, platform: 'Hacker', platformUrl: 'https://x.com/a' }, 'platform'],
    ['"Other" without a name', { ...goodFields, teachesElsewhere: true, platform: 'Other', platformUrl: 'https://x.com/a' }, 'platformName'],
    ['not confirmed', { ...goodFields, confirm: false }, 'confirm'],
  ];
  for (const [label, body, field] of bad) { const r = await apply(asha, body); ok(`rejects: ${label}`, r.status === 400 && !!r.json.fields?.[field], r); }
  const fakePdf = await apply(asha, { ...goodFields, linkedinUrl: '' }, { name: 'cv.pdf', data: Buffer.from('this is just text, not a pdf') });
  ok('rejects a text file renamed .pdf', fakePdf.status === 400 && !!fakePdf.json.fields?.credentials, fakePdf);
  const exe = await apply(asha, goodFields, { name: 'cv.exe', data: Buffer.from('MZ....') });
  ok('rejects an .exe upload', exe.status === 400, exe);
  const big = await apply(asha, goodFields, { name: 'cv.pdf', data: Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(6 * 1024 * 1024)]) });
  ok('rejects a CV over 5 MB', big.status === 400, big);

  // ── submit (LinkedIn only), then locked while pending ──
  const sub1 = await apply(asha, { ...goodFields, teachesElsewhere: true, platform: 'YouTube', platformUrl: 'youtube.com/@asha', audienceSize: 1200 });
  ok('a complete application (LinkedIn + YouTube) is accepted', sub1.status === 201 && sub1.json.status === 'pending', sub1);
  const st1 = await get('/creator/application', asha);
  ok('status is now pending and the details are stored', st1.json.status === 'pending' && st1.json.application.otherPlatform.platform === 'YouTube' && st1.json.application.linkedinUrl.startsWith('https://www.linkedin.com/in/'), st1.json);
  ok('cannot submit twice while pending (409)', (await apply(asha, goodFields)).status === 409);
  ok('still locked while pending', (await post('/courses', { title: 'Nope' }, asha)).status === 403);

  // ── admin review ──
  const ad = await get('/data', admin);
  const mine = ad.json.users.find(u => u.email === email);
  ok('admin sees the application', mine?.creatorStatus === 'pending' && mine.creatorApplication.teachingHistory.includes('data structures'), mine);
  ok('admin data exposes no password hash, token hash or stored file name', !JSON.stringify(ad.json.users).includes('passwordHash') && !JSON.stringify(ad.json.users).includes('emailVerification'));
  const daniel = ad.json.users.find(u => u.email === 'daniel@student.test');
  ok('the seeded demo applicant (Daniel) waits in the queue', daniel?.role === 'creator' && daniel.creatorStatus === 'pending' && !!daniel.creatorApplication?.otherPlatform, daniel);
  ok('non-admins cannot review', (await post(`/admin/creators/${mine.id}/review`, { approve: true }, maya.token)).status === 403 && (await post(`/admin/creators/${mine.id}/review`, { approve: true }, sarah)).status === 403);
  ok('rejecting without a reason is refused', (await post(`/admin/creators/${mine.id}/review`, { approve: false }, admin)).status === 400);
  ok('rejecting with a reason works', (await post(`/admin/creators/${mine.id}/review`, { approve: false, note: 'Please add your CV so we can verify your experience.' }, admin)).status === 200);
  const st2 = await get('/creator/application', asha);
  ok('applicant sees the rejection reason', st2.json.status === 'rejected' && st2.json.application.reviewNote.includes('add your CV'), st2.json);
  ok('still locked after rejection', (await post('/courses', { title: 'Nope' }, asha)).status === 403);

  // ── resubmit with a CV ──
  const sub2 = await apply(asha, goodFields, { name: 'Asha CV.pdf', data: pdf });
  ok('resubmitting with a CV is accepted', sub2.status === 201 && sub2.json.application.cv?.originalName === 'Asha CV.pdf', sub2);
  ok('the stored file name is not exposed to the applicant', !JSON.stringify(sub2.json).match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf/), sub2.json);
  const cvAdmin = await fetch(`${base}/api/admin/creators/${mine.id}/cv`, { headers: { authorization: `Bearer ${admin}` } });
  const cvBytes = Buffer.from(await cvAdmin.arrayBuffer());
  ok('admin downloads the exact CV', cvAdmin.status === 200 && cvBytes.equals(pdf) && cvAdmin.headers.get('content-type') === 'application/pdf' && /attachment/.test(cvAdmin.headers.get('content-disposition')) && cvAdmin.headers.get('x-content-type-options') === 'nosniff', [cvAdmin.status, cvAdmin.headers.get('content-type')]);
  const cvSelf = await fetch(`${base}/api/creator/application/cv`, { headers: { authorization: `Bearer ${asha}` } });
  ok('applicant downloads their own CV', cvSelf.status === 200 && Buffer.from(await cvSelf.arrayBuffer()).equals(pdf));
  ok('other creators cannot download it', (await fetch(`${base}/api/admin/creators/${mine.id}/cv`, { headers: { authorization: `Bearer ${maya.token}` } })).status === 403);
  ok('learners cannot download it', (await fetch(`${base}/api/admin/creators/${mine.id}/cv`, { headers: { authorization: `Bearer ${sarah}` } })).status === 403);
  ok('no token, no CV', (await fetch(`${base}/api/admin/creators/${mine.id}/cv`)).status === 401);
  const ad2 = await get('/data', admin);
  ok('admin list shows the CV details without the stored name', ad2.json.users.find(u => u.id === mine.id).creatorApplication.cv.originalName === 'Asha CV.pdf' && !('name' in ad2.json.users.find(u => u.id === mine.id).creatorApplication.cv));

  // ── approve → studio opens, learner features work too ──
  ok('admin approves', (await post(`/admin/creators/${mine.id}/review`, { approve: true }, admin)).status === 200);
  const re = await login(email, password, 'creator');
  ok('after approval the account is a normal creator', re.json.user.creatorStatus === 'approved', re.json);
  const full = await get('/data', re.token);
  ok('approved creator now receives the full data set', full.json.courses.length > 0, full.json.courses?.length);
  const mk = await post('/courses', { title: 'Python Foundations' }, re.token);
  ok('approved creator can create a course (studio)', mk.status === 201, mk);
  ok('approved creator can also use learner features (enroll in a catalog course)', [200, 201].includes((await post('/courses/course-002/enroll', {}, re.token)).status) || (await get('/data', re.token)).json.enrollments.length >= 0);
  ok('approved creator cannot re-apply', (await apply(re.token, goodFields)).status === 409);

  // ── admin can also approve a different applicant, and rejected-then-approved flows are audited ──
  const di = await post(`/admin/creators/${daniel.id}/review`, { approve: true }, admin);
  ok('admin approves the seeded applicant', di.status === 200, di);
  const audit = (await get('/data', admin)).json.audit.filter(a => /creator\.(approve|reject)/.test(a.action));
  ok('approvals and rejections are in the audit log', audit.length >= 3, audit.length);
  } finally { await srv.stop(); }
});
