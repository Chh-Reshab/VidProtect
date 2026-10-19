import { suite, startServer, PW } from './helpers.js';

suite('thumbnails', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  const login = async (email) => {
    const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) });
    return (await r.json()).accessToken;
  };
  const send = async (token, method, path, body) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: token ? { authorization: `Bearer ${token}` } : {}, body });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  const png = () => { const b = Buffer.alloc(200, 1); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b; };
  const form = (buf, type, name) => { const f = new FormData(); f.append('image', new Blob([buf], { type }), name); return f; };

  const maya = await login('maya@creator.test');
  const reshab = await login('creator@vidprotect.test');
  const sarah = await login('sarah@student.test');

  const created = await fetch(`${base}/api/courses`, { method: 'POST', headers: { authorization: `Bearer ${maya}`, 'content-type': 'application/json' }, body: JSON.stringify({ title: 'Thumb Test' }) }).then(r => r.json());
  const id = created.course.id;

  const up = await send(maya, 'POST', `/courses/${id}/thumbnail`, form(png(), 'image/png', 'a.png'));
  ok('owner uploads course thumbnail', up.status === 200 && /^\/api\/thumbnails\/[0-9a-f-]{36}\.png$/.test(up.json?.thumbUrl), JSON.stringify(up));

  const img = await fetch(`${base}${up.json.thumbUrl}`);
  ok('thumbnail is served as image/png', img.status === 200 && img.headers.get('content-type') === 'image/png' && img.headers.get('x-content-type-options') === 'nosniff');

  ok('other creator cannot change it (404)', (await send(reshab, 'POST', `/courses/${id}/thumbnail`, form(png(), 'image/png', 'a.png'))).status === 404);
  ok('learner cannot change it (403)', (await send(sarah, 'POST', `/courses/${id}/thumbnail`, form(png(), 'image/png', 'a.png'))).status === 403);
  ok('no token = 401', (await send(null, 'POST', `/courses/${id}/thumbnail`, form(png(), 'image/png', 'a.png'))).status === 401);
  ok('svg rejected (415)', (await send(maya, 'POST', `/courses/${id}/thumbnail`, form(Buffer.from('<svg onload=alert(1)>'), 'image/svg+xml', 'a.svg'))).status === 415);
  ok('fake png (text) rejected (415)', (await send(maya, 'POST', `/courses/${id}/thumbnail`, form(Buffer.from('not an image at all'), 'image/png', 'a.png'))).status === 415);
  ok('over 5 MB rejected (413)', (await send(maya, 'POST', `/courses/${id}/thumbnail`, form(Buffer.concat([png(), Buffer.alloc(6 * 1024 * 1024)]), 'image/png', 'big.png'))).status === 413);
  ok('path traversal name = 404', (await fetch(`${base}/api/thumbnails/..%2Fdb.json`)).status === 404);

  const data = await fetch(`${base}/api/data`, { headers: { authorization: `Bearer ${maya}` } }).then(r => r.json());
  ok('course snapshot carries thumbUrl', data.courses.find(c => c.id === id)?.thumbUrl === up.json.thumbUrl);

  const rm = await send(maya, 'DELETE', `/courses/${id}/thumbnail`);
  ok('owner removes thumbnail', rm.status === 200);
  ok('removed image is gone (404)', (await fetch(`${base}${up.json.thumbUrl}`)).status === 404);

  // video thumbnail
  const vids = data.videos.filter(v => v.creatorId === 'creator-002');
  if (vids.length) {
    const v = vids[0];
    const vu = await send(maya, 'POST', `/videos/${v.id}/thumbnail`, form(png(), 'image/png', 'v.png'));
    ok('owner uploads video thumbnail', vu.status === 200);
    ok('other creator cannot touch video thumbnail (404)', (await send(reshab, 'DELETE', `/videos/${v.id}/thumbnail`)).status === 404);
    await send(maya, 'DELETE', `/videos/${v.id}/thumbnail`);
  }
  } finally { await srv.stop(); }
});
