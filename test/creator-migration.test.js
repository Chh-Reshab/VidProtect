import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { suite, startServer, PW } from './helpers.js';
import { buildFixture } from './fixtures/build.js';

suite('creator applications from the old flow move to the new review flow', async ({ ok }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-legacy-'));
  const post = async (p, b, t) => { const r = await fetch(`${srvBase()}/api${p}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(t ? { authorization: `Bearer ${t}` } : {}) }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  let current;
  const srvBase = () => current;
  // make the database look like the old version: a learner with a pending "become a creator" request
  const state = buildFixture(PW);
  const lena = state.users.find(u => u.email === 'sarah@student.test');
  lena.creatorStatus = 'pending'; lena.creatorProfile = { displayName: 'Sarah C', bio: 'I teach chemistry to high-school students.' };
  fs.mkdirSync(path.join(dir, 'data'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'data', 'db.json'), JSON.stringify(state));
  const srv = await startServer({ dir });
  const base = srv.base; current = base;
  ok('server announces the migration', srv.log().includes('earlier creator application(s) moved'));
  const admin = (await post('/auth/login', { email: 'admin@vidprotect.test', password: PW })).json.accessToken;
  const data = await (await fetch(`${base}/api/data`, { headers: { authorization: `Bearer ${admin}` } })).json();
  const s = data.users.find(u => u.email === 'sarah@student.test');
  ok('the old applicant is now a locked creator with their application', s.role === 'creator' && s.creatorStatus === 'pending' && s.creatorApplication.teachingHistory.includes('chemistry') && s.creatorApplication.legacy === true, s);
  const t = (await post('/auth/login', { email: 'sarah@student.test', password: PW, portal: 'creator' })).json.accessToken;
  ok('they are locked out of the studio until approved', (await post('/courses', { title: 'x' }, t)).status === 403);
  ok('admin can review the migrated application', (await post(`/admin/creators/${s.id}/review`, { approve: true }, admin)).status === 200);
  ok('then the studio opens', (await post('/courses', { title: 'Chemistry 101' }, t)).status === 201);
  await srv.stop();
});
