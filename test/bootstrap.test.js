import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { suite, startServer, PW } from './helpers.js';
import { buildFixture } from './fixtures/build.js';

suite('admin account from the environment, and removing the old built-in beta accounts', async ({ ok }) => {
  let base;
  const mkdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vp-boot-'));
  // Starts a server on a data folder with no sample data (the old built-in data is written by the tests themselves)
  const run = async (dir, extra, opts = {}) => {
    const server = await startServer({ dir, fixture: false, env: { JWT_SECRET: 'x'.repeat(40), ...extra }, expectExit: opts.expectFail });
    if (server.base) base = server.base;
    return server;
  };
  const post = async (p, b, t) => { const r = await fetch(`${base}/api${p}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const data = async (t) => (await fetch(`${base}/api/data`, { headers: { authorization: `Bearer ${t}` } })).json();
  const writeState = (dir, state) => { fs.mkdirSync(path.join(dir, 'data'), { recursive: true }); fs.writeFileSync(path.join(dir, 'data', 'db.json'), JSON.stringify(state)); };
  // 1. a brand-new local install has no accounts except the generated admin
  let disk = mkdir();
  let s = await run(disk, {});
  ok('a fresh dev install creates only the local default admin', /Created the admin account admin@vidprotect\.local/.test(s.log()), s.log());
  const adminPw = 'VidProtect@Admin1';
  const login = await post('/auth/login', { email: 'admin@vidprotect.local', password: adminPw });
  ok('the local default password signs in', login.status === 200 && login.json.user.role === 'admin', login);
  const d1 = await data(login.json.accessToken);
  ok('there are no other users, courses or videos', d1.users.length === 1 && d1.courses.length === 0 && d1.videos.length === 0, [d1.users.length, d1.courses.length]);
  ok('some other password does not work', (await post('/auth/login', { email: 'admin@vidprotect.local', password: PW })).status === 401);
  ok('none of the old built-in accounts exist', !d1.users.some(u => /\.demo$/.test(u.email)));
  await s.stop();
  let r = await run(mkdir(), { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com' }, { expectFail: true });
  ok('production never falls back to the default password', r.failed && /ADMIN_PASSWORD must be set/.test(r.log));
  s = await run(disk, {});
  ok('a restart does not create another admin or a new password', !/Created the admin/.test(s.log()) && (await post('/auth/login', { email: 'admin@vidprotect.local', password: adminPw })).status === 200);
  await s.stop();

  // 2. production needs the admin variables
  disk = mkdir();
  r = await run(disk, { NODE_ENV: 'production', ADMIN_PASSWORD: 'A-long-admin-pass-1' }, { expectFail: true });
  ok('production refuses to start without ADMIN_EMAIL', r.failed && /ADMIN_EMAIL must be set/.test(r.log), r.log.slice(0, 200));
  r = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com' }, { expectFail: true });
  ok('production refuses to start without ADMIN_PASSWORD', r.failed && /ADMIN_PASSWORD must be set/.test(r.log), r.log.slice(0, 200));
  r = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'short' }, { expectFail: true });
  ok('a short ADMIN_PASSWORD is refused', r.failed && /at least 12/.test(r.log));
  r = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'not-an-email', ADMIN_PASSWORD: 'A-long-admin-pass-1' }, { expectFail: true });
  ok('an invalid ADMIN_EMAIL is refused', r.failed && /ADMIN_EMAIL is not a valid/.test(r.log));
  s = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'Boss@Example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' });
  const pl = await post('/auth/login', { email: 'boss@example.com', password: 'A-long-admin-pass-1' });
  ok('production creates the admin from the variables', pl.status === 200 && pl.json.user.role === 'admin', pl);
  ok('and nothing else', (await data(pl.json.accessToken)).users.length === 1);
  await s.stop();
  s = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'Another-admin-pass-2' });
  ok('changing ADMIN_PASSWORD updates the admin and signs out the old session', (await post('/auth/login', { email: 'boss@example.com', password: 'Another-admin-pass-2' })).status === 200 && (await post('/auth/login', { email: 'boss@example.com', password: 'A-long-admin-pass-1' })).status === 401);
  const stale = await fetch(`${base}/api/data`, { headers: { authorization: `Bearer ${pl.json.accessToken}` } });
  ok('the old session token stopped working', stale.status === 401);
  await s.stop();

  // 3. an older database that still has the built-in beta accounts
  disk = mkdir();
  const old = buildFixture(PW); // the previous sample data
  old.meta = { jwtSecret: crypto.randomBytes(24).toString('hex') };
  for (const u of old.users) u.email = u.email.replace(/\.test$/, '.demo'); // exactly the old addresses

  const realHash = bcrypt.hashSync('Real!person1', 4);
  old.users.push({ id: 'usr-real0001', name: 'Real Learner', email: 'real@example.com', role: 'learner', status: 'active', passwordHash: realHash, joinDate: '2026-10-01' });
  old.users.push({ id: 'usr-real0002', name: 'Real Creator', email: 'realc@example.com', role: 'creator', status: 'active', passwordHash: realHash, joinDate: '2026-10-01' });
  old.users.push({ id: 'usr-look0003', name: 'Look Alike', email: 'lookalike@mail.demo', role: 'learner', status: 'active', passwordHash: realHash, joinDate: '2026-10-01' }); // a .demo address, but not a built-in id
  old.courses.push({ id: 'course-real1', title: 'A Real Course', creatorId: 'usr-real0002', status: 'active', price: 0, videoCount: 0, createdAt: new Date().toISOString() });
  old.enrollments.push({ id: 'enr-real-1', studentId: 'usr-real0001', courseId: 'course-real1', enrolledAt: new Date().toISOString(), status: 'active', source: 'invite' });
  old.enrollments.push({ id: 'enr-real-2', studentId: 'usr-real0001', courseId: old.courses[0].id, enrolledAt: new Date().toISOString(), status: 'active', source: 'invite' }); // a real person in a sample course
  const sampleCourses = old.courses.filter(c => c.id !== 'course-real1').length;
  writeState(disk, old);
  s = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' });
  ok('the cleanup is announced', /Removed \d+ built-in beta account/.test(s.log()), s.log().slice(0, 300));
  const al = await post('/auth/login', { email: 'boss@example.com', password: 'A-long-admin-pass-1' });
  const d3 = await data(al.json.accessToken);
  ok('no built-in .demo accounts remain', !d3.users.some(u => /^(admin|creator|stu)-\d+$/.test(u.id)), d3.users.map(u => u.email));
  ok('the old admin and demo password cannot sign in', (await post('/auth/login', { email: 'admin@vidprotect.demo', password: PW })).status === 401 && (await post('/auth/login', { email: 'sarah@student.demo', password: PW })).status === 401);
  ok('real people are untouched (even one with a lookalike .demo address)', ['real@example.com', 'realc@example.com', 'lookalike@mail.demo'].every(e => d3.users.some(u => u.email === e)), d3.users.map(u => u.email));
  ok('their course stays and the sample courses are gone', d3.courses.length === 1 && d3.courses[0].id === 'course-real1' && sampleCourses > 1, d3.courses.map(c => c.id));
  ok('sample videos, logs and alerts are gone', d3.videos.length === 0 && d3.logs.length === 0 && d3.alerts.length === 0, [d3.videos.length, d3.logs.length, d3.alerts.length]);
  ok('real enrolments to real courses stay, ones to sample courses are dropped', d3.enrollments.length === 1 && d3.enrollments[0].id === 'enr-real-1', d3.enrollments);
  const rl = await post('/auth/login', { email: 'real@example.com', password: 'Real!person1', portal: 'learner' });
  ok('a real person can still sign in', rl.status === 200, rl);
  await s.stop();
  s = await run(disk, { NODE_ENV: 'production', ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' });
  ok('a second start has nothing more to remove', !/Removed \d+ built-in/.test(s.log()));
  await s.stop();

  // 4. the cleanup never removes the last admin
  disk = mkdir();
  const only = buildFixture(PW); only.meta = { jwtSecret: 'z'.repeat(40) };
  for (const u of only.users) u.email = u.email.replace(/\.test$/, '.demo');
  writeState(disk, only);
  s = await run(disk, { ADMIN_EMAIL: 'boss@example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' });
  const pa = await post('/auth/login', { email: 'boss@example.com', password: 'A-long-admin-pass-1' });
  ok('with ADMIN_EMAIL set the new admin exists before the cleanup', pa.status === 200 && pa.json.user.role === 'admin', pa);
  await s.stop();

  // 5. ADMIN_EMAIL must not collide with a normal account
  disk = mkdir();
  const coll = buildFixture(PW); coll.meta = { jwtSecret: 'y'.repeat(40) };
  coll.users.push({ id: 'usr-aaaa0001', name: 'Normal Person', email: 'normal@example.com', role: 'learner', status: 'active', passwordHash: realHash, joinDate: '2026-10-01' });
  writeState(disk, coll);
  r = await run(disk, { ADMIN_EMAIL: 'normal@example.com', ADMIN_PASSWORD: 'A-long-admin-pass-1' }, { expectFail: true });
  ok('ADMIN_EMAIL that belongs to a learner is refused', r.failed && /not an admin/.test(r.log), r.log.slice(0, 200));
});
