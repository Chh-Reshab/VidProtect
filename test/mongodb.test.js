// Needs a real MongoDB: set MONGODB_TEST_URI to a server address such as mongodb://127.0.0.1:27017
// (a throw-away database is created and dropped). Without it this test is skipped.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { test } from 'node:test';
import { MongoClient } from 'mongodb';
import { suite, startServer, sleep, PW } from './helpers.js';
import { buildFixture } from './fixtures/build.js';

const BASE_URI = process.env.MONGODB_TEST_URI;

if (!BASE_URI) {
  test('MongoDB persistence on an empty disk (set MONGODB_TEST_URI to run it)', { skip: true }, () => {});
} else {
  suite('MongoDB + GridFS persistence: restart on an EMPTY disk (like Render\'s free plan)', async ({ ok }) => {
    const URI = `${BASE_URI.replace(/\/+$/, '')}/vp_persist_${Date.now()}`;
    const MASTER = crypto.randomBytes(32).toString('hex'); // on Render this comes from an env var, so it survives
    let base;
    const freshDisk = () => ({ dir: fs.mkdtempSync(path.join(os.tmpdir(), 'vp-disk-')) });
    const start = async (disk) => { const s = await startServer({ dir: disk.dir, fixture: false, env: { MONGODB_URI: URI, VP_MASTER_KEY: MASTER } }); base = s.base; return s; };
    const stop = async (s) => { await sleep(900); await s.stop(); }; // hard kill: only already-written data survives
    const login = async (email, password = PW) => { const r = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); return { status: r.status, token: (await r.json()).accessToken }; };
    const call = async (token, method, p, body) => {
      const r = await fetch(`${base}/api${p}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      let json = null; try { json = await r.json(); } catch { /* none */ }
      return { status: r.status, json };
    };
    const png = () => { const b = Buffer.alloc(400, 3); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b; };
  { const mongo = await import('../server/mongo.js'); await mongo.connect(URI); await mongo.persistState(buildFixture(PW)); await mongo.close(); }
    const disk1 = freshDisk();
    let srv = await start(disk1);
    const maya = (await login('maya@creator.test')).token;
    const sarah = (await login('sarah@student.test')).token;
  
    const reg = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acceptTerms: true, name: 'New Person', email: 'newperson@example.com', password: 'a-long-password-1' }) });
    ok('register a new account', reg.status === 201);
  
    const course = (await call(maya, 'POST', '/courses', { title: 'Persistence Course', price: 250 })).json.course;
    await call(maya, 'PATCH', `/courses/${course.id}`, { status: 'active' });
    const plain = crypto.randomBytes(900000); plain.writeUInt32BE(24, 0); plain.write('ftypisom', 4, 'latin1'); // 900 KB: many 64 KiB blocks
    const form = new FormData(); form.append('title', 'Survives Restart'); form.append('duration', '10'); form.append('file', new Blob([plain], { type: 'video/mp4' }), 'v.mp4');
    const up = await (await fetch(`${base}/api/courses/${course.id}/videos`, { method: 'POST', headers: { authorization: `Bearer ${maya}` }, body: form })).json();
    let status;
    for (let i = 0; i < 80; i++) { status = (await call(maya, 'GET', `/videos/${up.video.id}/processing`)).json.uploadStatus; if (status !== 'processing') break; await sleep(250); }
    ok('video processed', status === 'complete', status);
    const tf = new FormData(); tf.append('image', new Blob([png()], { type: 'image/png' }), 't.png');
    const thumb = await (await fetch(`${base}/api/videos/${up.video.id}/thumbnail`, { method: 'POST', headers: { authorization: `Bearer ${maya}` }, body: tf })).json();
    ok('thumbnail stored', !!thumb.thumbUrl, thumb);
  
    const pay = await call(sarah, 'POST', `/courses/${course.id}/checkout`, { method: 'upi', upiId: 'sarah@okbank' });
    ok('learner buys the course', pay.status === 201, pay);
    await call(sarah, 'PUT', `/progress/${up.video.id}`, { positionSeconds: 4, durationSeconds: 10, watchedSeconds: 4 });
    const before = (await call(maya, 'GET', '/data')).json;
    const beforeSarah = (await call(sarah, 'GET', '/data')).json;
    const order = (d) => ({ courses: d.courses.map(c => c.id).join(','), videos: d.videos.map(v => v.id).join(','), logs: d.logs.slice(0, 15).map(l => l.id).join(','), users: d.users.map(u => u.id).join(',') });
    const orderBefore = order(before);
    await stop(srv);
  
    // ── the disk is gone (a fresh Render instance) ──
    fs.rmSync(disk1.dir, { recursive: true, force: true });
    const disk2 = freshDisk();
    srv = await start(disk2);
    ok('local uploads folder is empty after the "restart"', fs.readdirSync(path.join(disk2.dir, 'uploads')).filter(f => f.endsWith('.vpe')).length === 0);
  
    ok('registered account still exists', (await login('newperson@example.com', 'a-long-password-1')).status === 200);
    const maya2 = (await login('maya@creator.test')).token;
    const sarah2 = (await login('sarah@student.test')).token;
    const after = (await call(maya2, 'GET', '/data')).json;
    const afterSarah = (await call(sarah2, 'GET', '/data')).json;
    const orderAfter = order(after);
    ok('courses keep their order', orderAfter.courses === orderBefore.courses);
    ok('videos keep their order', orderAfter.videos === orderBefore.videos);
    ok('newest logs keep their order', orderAfter.logs === orderBefore.logs, [orderBefore.logs, orderAfter.logs]);
    ok('users keep their order', orderAfter.users === orderBefore.users);
    ok('course price survived', after.courses.find(c => c.id === course.id)?.price === 250);
    ok('purchase and enrolment survived', afterSarah.enrollments.some(e => e.courseId === course.id && e.paymentId) && afterSarah.payments.some(p => p.courseId === course.id));
    ok('watch progress survived', afterSarah.progress[up.video.id]?.positionSeconds === 4);
    ok('watch activity survived', JSON.stringify(afterSarah.activity) === JSON.stringify(beforeSarah.activity), [beforeSarah.activity, afterSarah.activity]);
    const v = after.videos.find(x => x.id === up.video.id);
    ok('video record has its media and thumbnail', v?.hasMedia && v.encryptionStatus === 'encrypted' && v.thumbUrl === thumb.thumbUrl, v);
  
    // the encrypted video itself comes back from GridFS
    const sess = await call(sarah2, 'POST', `/videos/${up.video.id}/stream-session`);
    ok('playback session granted', sess.status === 200 && sess.json.granted, sess);
    const full = Buffer.from(await (await fetch(`${base}/api/videos/${up.video.id}/stream?s=${sess.json.session.id}`)).arrayBuffer());
    ok('full video decrypts identically from MongoDB (900 KB)', full.equals(plain), full.length);
    for (const [a, b] of [[0, 99], [65530, 65600], [300000, 450000], [899900, 899999]]) {
      const r = await fetch(`${base}/api/videos/${up.video.id}/stream?s=${sess.json.session.id}`, { headers: { range: `bytes=${a}-${b}` } });
      ok(`range ${a}-${b} is exact`, r.status === 206 && Buffer.from(await r.arrayBuffer()).equals(plain.subarray(a, b + 1)));
    }
    const timg = await fetch(`${base}${thumb.thumbUrl}`);
    ok('thumbnail is served from MongoDB', timg.status === 200 && Buffer.from(await timg.arrayBuffer()).equals(png()));
  
    // what is actually in MongoDB
    const mc = new MongoClient(URI); await mc.connect(); const mdb = mc.db();
    const counts = {};
    for (const c of ['users', 'courses', 'videos', 'enrollments', 'logs', 'payments', 'progress', 'activity', 'meta', 'videos.files', 'videos.chunks', 'thumbs.files']) counts[c] = await mdb.collection(c).countDocuments();
    ok('collections hold real data', counts.users >= 10 && counts.courses >= 6 && counts['videos.files'] === 1 && counts['videos.chunks'] > 0 && counts['thumbs.files'] === 1 && counts.meta === 1, counts);
    const stored = await mdb.collection('videos.files').findOne({});
    ok('stored bytes are ciphertext, not the video', stored.length > plain.length && stored.length < plain.length * 1.01);
    const chunk = await mdb.collection('videos.chunks').findOne({ n: 1 });
    ok('plaintext is nowhere in the stored chunks', chunk.data.buffer.indexOf(plain.subarray(10000, 10048)) === -1);
  
    // orphan sweep: a stray file in GridFS that no video refers to is removed at start-up
    const { GridFSBucket } = await import('mongodb');
    await new Promise((res, rej) => { const w = new GridFSBucket(mdb, { bucketName: 'videos' }).openUploadStream('orphan-0000.vpe'); w.on('finish', res); w.on('error', rej); w.end(Buffer.from('stray')); });
    ok('orphan planted', (await mdb.collection('videos.files').countDocuments()) === 2);
  
    // deleting the video removes its stored file
    const del = await call(maya2, 'DELETE', `/videos/${up.video.id}`);
    ok('video deleted', del.status === 200);
    await sleep(600);
    ok('deleting a video removes it from GridFS', (await mdb.collection('videos.files').findOne({ filename: stored.filename })) === null);
    await stop(srv);
  
    // ── life 3: the orphan is swept, deletion persisted ──
    srv = await start(freshDisk());
    await sleep(500);
    ok('stray orphan file removed at start-up', (await mdb.collection('videos.files').countDocuments()) === 0, await mdb.collection('videos.files').countDocuments());
    const maya3 = (await login('maya@creator.test')).token;
    const final = (await call(maya3, 'GET', '/data')).json;
    ok('deleted video stays deleted after another restart', !final.videos.some(x => x.id === up.video.id));
    ok('...and the course video count is right', final.courses.find(c => c.id === course.id)?.videoCount === 0);
    await stop(srv);
    await mdb.dropDatabase(); await mc.close();
  });
}
