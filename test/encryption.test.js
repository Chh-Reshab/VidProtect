import { suite, startServer, PW } from './helpers.js';

suite('upload, AES-256 encryption and range streaming', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  // Test: AES-256 encryption round-trip

  const login = async (email, password = PW) => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const body = await r.json();
    return { status: r.status, token: body.accessToken, user: body.user };
  };

  const call = async (token, method, path, body) => {
    const r = await fetch(`${base}/api${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) },
      body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };

  // 8192-byte fake MP4 with ftyp signature
  const fakeMp4 = (size = 8192) => {
    const b = Buffer.alloc(size, 0x47);
    b.writeUInt32BE(24, 0); b.write('ftypisom', 4, 'latin1');
    return b;
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

  const form = (fields, file) => {
    const f = new FormData();
    Object.entries(fields).forEach(([k, v]) => f.append(k, v));
    if (file) f.append('file', new Blob([file], { type: 'video/mp4' }), 'test.mp4');
    return f;
  };


  const maya = await login('maya@creator.test');
  ok('Creator login', maya.status === 200);

  const courseRes = await call(maya.token, 'POST', '/courses', { title: 'Encryption Test ' + Date.now() });
  const course = courseRes.json?.course;
  ok('Create course', !!course?.id);

  const plaintext = fakeMp4(8192);
  const up = await call(maya.token, 'POST', `/courses/${course.id}/videos`,
    form({ title: 'AES-256 Test Video', duration: '60' }, plaintext));
  ok('Upload returns 201', up.status === 201, `got ${up.status}`);
  ok('upload starts in processing state', up.json?.video?.uploadStatus === 'processing');
  ok('processing finishes', await waitReady(maya.token, up.json.video.id));
  const fresh = (await call(maya.token, 'GET', '/data')).json.videos.find(v => v.id === up.json.video.id);
  ok('encryptionStatus = encrypted', fresh?.encryptionStatus === 'encrypted', fresh?.encryptionStatus);
  ok('hasMedia = true', fresh?.hasMedia === true);

  const vid = up.json?.video;
  if (!vid) { console.log('No video — aborting'); process.exit(1); }

  // Enrol sarah and get a stream session
  const pub = await call(maya.token, 'PATCH', `/courses/${course.id}`, { status: 'active' });
  ok('Course published', pub.json?.course?.status === 'active');

  const sarah = await login('sarah@student.test');
  await call(sarah.token, 'POST', `/courses/${course.id}/enroll`);
  const s = await call(sarah.token, 'POST', `/videos/${vid.id}/stream-session`);
  ok('Stream session granted', s.json?.granted === true, s.json?.reason || '');

  if (s.json?.granted) {
    const sid = s.json.session.id;

    // Full file decryption
    const full = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`);
    const fullBuf = Buffer.from(await full.arrayBuffer());
    ok('Full stream 200', full.status === 200);
    ok('Decrypted size correct', fullBuf.length === 8192, `got ${fullBuf.length}`);
    ok('First 8 bytes match original', fullBuf.subarray(0, 8).equals(plaintext.subarray(0, 8)));
    ok('Last 8 bytes match original', fullBuf.subarray(-8).equals(plaintext.subarray(-8)));
    ok('Middle bytes match original', fullBuf.subarray(512, 520).equals(plaintext.subarray(512, 520)));

    // Range within first block
    const r1 = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=4-11' } });
    const b1 = Buffer.from(await r1.arrayBuffer());
    ok('Range 4-11 decrypts correctly', b1.equals(plaintext.subarray(4, 12)));

    // Range crossing block boundary (block 0 = bytes 0-15, block 1 = bytes 16-31)
    const r2 = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=12-19' } });
    const b2 = Buffer.from(await r2.arrayBuffer());
    ok('Cross-block range 12-19 decrypts correctly', b2.equals(plaintext.subarray(12, 20)));

    // Range at high offset (crosses many blocks)
    const r3 = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=4096-4207' } });
    const b3 = Buffer.from(await r3.arrayBuffer());
    ok('High-offset range 4096-4207 decrypts correctly', b3.equals(plaintext.subarray(4096, 4208)));

    // Suffix range
    const r4 = await fetch(`${base}/api/videos/${vid.id}/stream?s=${sid}`, { headers: { range: 'bytes=-64' } });
    const b4 = Buffer.from(await r4.arrayBuffer());
    ok('Suffix range -64 decrypts correctly', b4.equals(plaintext.subarray(8192 - 64)));
  }
  } finally { await srv.stop(); }
});
