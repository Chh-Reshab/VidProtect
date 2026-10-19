import { suite, startServer, PW } from './helpers.js';

suite('upload processing stages', async ({ ok }) => {
  const srv = await startServer({ env: {'VP_MIN_STAGE_MS': '3000'} });
  const base = srv.base;
  try {
  const login = async (email) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).accessToken;
  const call = async (token, method, path, body) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  const maya = await login('maya@creator.test');
  const reshab = await login('creator@vidprotect.test');
  const sarah = await login('sarah@student.test');

  const course = (await call(maya, 'POST', '/courses', { title: 'Processing Test ' + Date.now() })).json.course;
  await call(maya, 'PATCH', `/courses/${course.id}`, { status: 'active' });
  await call(sarah, 'POST', `/courses/${course.id}/enroll`);
  const countOf = async () => (await call(maya, 'GET', '/data')).json.courses.find(c => c.id === course.id).videoCount;

  const plain = Buffer.alloc(30000, 0x42); plain.writeUInt32BE(24, 0); plain.write('ftypisom', 4, 'latin1');
  const f = new FormData(); f.append('title', 'Tiny'); f.append('duration', '5'); f.append('file', new Blob([plain], { type: 'video/mp4' }), 'tiny.mp4');
  const t0 = Date.now();
  const upRes = await fetch(`${base}/api/courses/${course.id}/videos`, { method: 'POST', headers: { authorization: `Bearer ${maya}` }, body: f });
  const up = await upRes.json();
  const vid = up.video;
  ok('upload returns immediately with status processing', upRes.status === 201 && vid.uploadStatus === 'processing' && Date.now() - t0 < 2000, `${upRes.status} ${vid?.uploadStatus} ${Date.now() - t0}ms`);
  ok('not playable yet (hasMedia false)', vid.hasMedia === false);
  ok('course video count not bumped yet', (await countOf()) === 0);

  // while processing
  const during = await call(sarah, 'GET', '/data');
  ok('enrolled learner cannot see the unfinished video', !during.json.videos.some(v => v.id === vid.id));
  const ss = await call(sarah, 'POST', `/videos/${vid.id}/stream-session`);
  ok('learner cannot start playback (404)', ss.status === 404);
  ok('owner cannot preview unfinished video', (await call(maya, 'POST', `/videos/${vid.id}/stream-session`)).status === 404);
  ok('other creator cannot read progress (404)', (await call(reshab, 'GET', `/videos/${vid.id}/processing`)).status === 404);
  ok('learner cannot read progress (404)', (await call(sarah, 'GET', `/videos/${vid.id}/processing`)).status === 404);
  ok('delete while processing is refused (409)', (await call(maya, 'DELETE', `/videos/${vid.id}`)).status === 409);
  const own = (await call(maya, 'GET', '/data')).json.videos.find(v => v.id === vid.id);
  ok('owner sees it with processing info', own?.uploadStatus === 'processing' && own.processing);

  // follow progress to the end
  const seen = []; let last = -1, monotonic = true, final;
  for (let i = 0; i < 200; i++) {
    const r = (await call(maya, 'GET', `/videos/${vid.id}/processing`)).json;
    if (r.processing && r.uploadStatus === 'processing') {
      if (!seen.includes(r.processing.stage)) seen.push(r.processing.stage);
      if (r.processing.percent < last) monotonic = false;
      last = r.processing.percent;
    }
    if (r.uploadStatus !== 'processing') { final = r; break; }
    await new Promise(res => setTimeout(res, 150));
  }
  const elapsed = (Date.now() - t0) / 1000;
  console.log(`      stages seen: ${seen.join(' → ')} | total ${elapsed.toFixed(1)}s`);
  ok('all four stages were visible, in order', ['verifying', 'encrypting', 'integrity', 'finalizing'].every((s, i) => seen[seen.length - 4 + i] === s || seen.includes(s)) && seen.indexOf('verifying') < seen.indexOf('encrypting') && seen.indexOf('encrypting') < seen.indexOf('integrity') && seen.indexOf('integrity') < seen.indexOf('finalizing'), seen.join(','));
  ok('percentage never went backwards', monotonic);
  ok('even a 30 KB video takes visible time (>= 3s)', elapsed >= 3, `${elapsed}s`);
  ok('finished as complete', final?.uploadStatus === 'complete');
  ok('course video count bumped after finishing', (await countOf()) === 1);

  // after
  const ss2 = await call(sarah, 'POST', `/videos/${vid.id}/stream-session`);
  ok('learner can now play it', ss2.status === 200 && ss2.json.granted);
  const full = await fetch(`${base}/api/videos/${vid.id}/stream?s=${ss2.json.session.id}`);
  ok('decrypted stream matches the upload', full.status === 200 && Buffer.from(await full.arrayBuffer()).equals(plain));
  const after = (await call(sarah, 'GET', '/data')).json.videos.find(v => v.id === vid.id);
  ok('learner now sees it, encrypted', after?.encryptionStatus === 'encrypted' && after.hasMedia === true && !after.processing);

  await call(maya, 'DELETE', `/videos/${vid.id}`);
  ok('count back to 0 after delete', (await countOf()) === 0);
  } finally { await srv.stop(); }
});
