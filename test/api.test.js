import { suite, startServer, PW } from './helpers.js';

suite('API: auth, roles, courses, enrolment and access rules', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  // Integration checks against a running server: node api-test.mjs http://localhost:4100

  const login = async (email, password = PW) => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await r.json();
    return { status: r.status, token: body.accessToken, user: body.user, cookie: (r.headers.get('set-cookie') || '').split(';')[0] };
  };
  const call = async (token, method, path, body, extraHeaders = {}) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...extraHeaders },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    let json = null; try { json = await r.json(); } catch { /* no body */ }
    return { status: r.status, json };
  };


  const waitReady = async (token, id) => {
    for (let i = 0; i < 300; i++) {
      const r = await call(token, 'GET', `/videos/${id}/processing`);
      if (r.json?.uploadStatus === 'complete') return true;
      if (r.json?.uploadStatus === 'failed') return false;
      await new Promise(res => setTimeout(res, 200));
    }
    return false;
  };

  // a minimal "mp4": ftyp box header + padding (enough for the signature sniff)
  const fakeMp4 = (size = 5000) => {
    const b = Buffer.alloc(size, 7);
    b.writeUInt32BE(24, 0); b.write('ftypisom', 4, 'latin1');
    return b;
  };
  const form = (fields, file, name = 'clip.mp4', type = 'video/mp4') => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.append(k, v));
    if (file) f.append('file', new Blob([file], { type }), name);
    return f;
  };

  const bad = await login('sarah@student.test', 'wrong');
  ok('wrong password rejected', bad.status === 401);
  const unknown = await login('nobody@x.com');
  ok('unknown email gives same error', unknown.status === 401);
  const susp = await login('james@student.test');
  ok('suspended account blocked', susp.status === 403);

  const sarah = await login('sarah@student.test');
  const maya = await login('maya@creator.test');
  const reshab = await login('creator@vidprotect.test');
  const admin = await login('admin@vidprotect.test');
  ok('logins work', sarah.token && maya.token && reshab.token && admin.token);
  ok('no token = 401', (await call(null, 'GET', '/data')).status === 401);
  ok('forged token = 401', (await call('abc.def.ghi', 'GET', '/data')).status === 401);

  // ── scoped reads
  const dSarah = (await call(sarah.token, 'GET', '/data')).json;
  const dMaya = (await call(maya.token, 'GET', '/data')).json;
  ok('learner gets no alerts', dSarah.alerts.length === 0);
  ok('learner sees no other users emails', dSarah.users.every(u => !u.email));
  ok('learner cannot see audit', dSarah.audit.length === 0);
  ok('creator sees only own alerts', dMaya.alerts.every(a => a.videoId === 'vid-007'), JSON.stringify(dMaya.alerts.map(a => a.id)));
  ok('creator sees no passwordHash', !JSON.stringify(dMaya).includes('passwordHash'));
  ok('no file path leaks', !JSON.stringify(dMaya).includes('"file"'));

  // ── role gates
  ok('learner cannot create course', (await call(sarah.token, 'POST', '/courses', { title: 'x' })).status === 403);
  ok('learner cannot hit admin API', (await call(sarah.token, 'PATCH', '/admin/users/stu-002', { role: 'admin' })).status === 403);
  ok('creator cannot hit admin API', (await call(maya.token, 'POST', '/admin/courses/course-001/moderate', { takeDown: true })).status === 403);

  // ── upload rules
  const mayaCourse = (await call(maya.token, 'POST', '/courses', { title: 'Maya Course' })).json.course;
  ok('creator created draft course', mayaCourse?.status === 'draft');
  ok('cannot upload to someone elses course', (await call(maya.token, 'POST', '/courses/course-001/videos', form({ title: 'x' }, fakeMp4()))).status === 404);
  ok('learner cannot upload', (await call(sarah.token, 'POST', `/courses/${mayaCourse.id}/videos`, form({ title: 'x' }, fakeMp4()))).status === 403);
  ok('fake video rejected (bad signature)', (await call(maya.token, 'POST', `/courses/${mayaCourse.id}/videos`, form({ title: 'x' }, Buffer.from('this is not a video at all'), 'a.mp4'))).status === 415);
  ok('wrong mime rejected', (await call(maya.token, 'POST', `/courses/${mayaCourse.id}/videos`, form({ title: 'x' }, fakeMp4(), 'a.exe', 'application/x-msdownload'))).status === 415);
  ok('title required', (await call(maya.token, 'POST', `/courses/${mayaCourse.id}/videos`, form({}, fakeMp4()))).status === 400);

  const up = await call(maya.token, 'POST', `/courses/${mayaCourse.id}/videos`, form({ title: 'Real Upload', description: 'd', duration: '125.5' }, fakeMp4(6000)));
  ok('valid upload accepted (processing)', up.status === 201 && up.json.video?.uploadStatus === 'processing', JSON.stringify(up.json));
  const vid = up.json.video;
  ok('processing finishes', await waitReady(maya.token, vid.id));
  ok('duration stored', vid?.duration === '2:06', vid?.duration);

  // ── playback
  const pub = (await call(maya.token, 'PATCH', `/courses/${mayaCourse.id}`, { status: 'active' })).json;
  ok('course published', pub.course.status === 'active');

  const s1 = await call(sarah.token, 'POST', `/videos/${vid.id}/stream-session`);
  ok('unenrolled learner denied', s1.status === 403 && s1.json.granted === false);
  const direct = await fetch(`${base}/api/videos/${vid.id}/stream`);
  ok('stream without session = 401', direct.status === 401);
  const badSess = await fetch(`${base}/api/videos/${vid.id}/stream?s=ss-nope`);
  ok('stream with bad session = 401', badSess.status === 401);

  ok('learner self-enrols', (await call(sarah.token, 'POST', `/courses/${mayaCourse.id}/enroll`)).status === 200);
  const s2 = await call(sarah.token, 'POST', `/videos/${vid.id}/stream-session`);
  ok('enrolled learner granted', s2.status === 200 && s2.json.granted === true);
  const sid = s2.json.session.id;

  const full = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`);
  const fullBuf = Buffer.from(await full.arrayBuffer());
  ok('full stream returns file', full.status === 200 && fullBuf.length === 6000 && full.headers.get('content-type') === 'video/mp4');
  const part = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=100-199' } });
  const partBuf = Buffer.from(await part.arrayBuffer());
  ok('range request 206', part.status === 206 && partBuf.length === 100 && part.headers.get('content-range') === 'bytes 100-199/6000');
  const suffix = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=-50' } });
  ok('suffix range', suffix.status === 206 && (await suffix.arrayBuffer()).byteLength === 50);
  const outOfRange = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=9000-9999' } });
  ok('bad range 416', outOfRange.status === 416);

  // session for video A cannot stream video B
  const other = await fetch(`${base}/api/videos/vid-001/stream?s=${sid}`);
  ok('session is bound to its video', other.status === 401);

  // renewal rechecks access; unenrol -> next range request dies
  const enrId = (await call(maya.token, 'GET', '/data')).json.enrollments.find(e => e.courseId === mayaCourse.id && e.studentId === 'stu-001').id;
  ok('renew works while enrolled', (await call(sarah.token, 'POST', `/stream-sessions/${sid}/renew`)).status === 200);
  ok('creator removes enrollment', (await call(maya.token, 'DELETE', `/enrollments/${enrId}`)).status === 200);
  const after = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=0-9' } });
  ok('stream stops right after unenrol', after.status === 403);
  ok('renew denied after unenrol', (await call(sarah.token, 'POST', `/stream-sessions/${sid}/renew`)).status === 403);

  // another learner cannot reuse sarah's session id on the renew endpoint
  ok('renew of someone elses session = 404', (await call(reshab.token, 'POST', `/stream-sessions/${sid}/renew`)).status === 404);

  // owner preview + other creator denied
  ok('owner can preview', (await call(maya.token, 'POST', `/videos/${vid.id}/stream-session`)).status === 200);
  ok('other creator denied', (await call(reshab.token, 'POST', `/videos/${vid.id}/stream-session`)).status === 403);

  // progress
  ok('progress rejects non-viewer', (await call(sarah.token, 'PUT', `/progress/${vid.id}`, { positionSeconds: 10 })).status === 404);

  // delete
  ok('other creator cannot delete', (await call(reshab.token, 'DELETE', `/videos/${vid.id}`)).status === 404);
  ok('owner deletes', (await call(maya.token, 'DELETE', `/videos/${vid.id}`)).status === 200);
  ok('stream gone after delete', (await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`)).status !== 200);

  // admin
  ok('admin cannot change self', (await call(admin.token, 'PATCH', `/admin/users/${admin.user.id}`, { role: 'learner' })).status === 400);
  ok('admin suspends user', (await call(admin.token, 'PATCH', '/admin/users/stu-003', { status: 'suspended' })).status === 200);
  const p3 = await login('priya@student.test');
  ok('suspended user cannot login', p3.status === 403);
  const dAdmin = (await call(admin.token, 'GET', '/data')).json;
  ok('admin audit recorded', dAdmin.audit.some(a => a.action === 'user.suspend'));

  // refresh cookie rotation + reuse detection
  const r1 = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { cookie: sarah.cookie } });
  ok('refresh with cookie works', r1.status === 200);
  const newCookie = (r1.headers.get('set-cookie') || '').split(';')[0];
  const reuse = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { cookie: sarah.cookie } });
  ok('reusing old refresh token fails', reuse.status === 401);
  const afterReuse = await fetch(`${base}/api/auth/refresh`, { method: 'POST', headers: { cookie: newCookie } });
  ok('session family revoked after reuse', afterReuse.status === 401);
  ok('old access token dies with its session', (await call(sarah.token, 'GET', '/data')).status === 401);

  // register + apply + approve
  const reg = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Test User', email: `t${Date.now()}@x.com`, password: 'longenough1!' }) });
  ok('register ok', reg.status === 201);
  ok('short password rejected', (await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: 'T', email: 'q@x.com', password: 'short' }) })).status === 400);
  } finally { await srv.stop(); }
});
