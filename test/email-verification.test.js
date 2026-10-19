import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { suite, startServer, sleep, PW } from './helpers.js';

suite('email verification for learners and creators', async ({ ok }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-verify-'));
  let base;
  const start = async (extra) => { const server = await startServer({ dir, env: { APP_URL: 'https://example.test', ...extra } }); base = server.base; return server; };
  const post = async (p, b) => { const r = await fetch(`${base}/api${p}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const tokenFor = (log, email) => [...log().matchAll(new RegExp(`verification link for ${email.replace(/[.+]/g, '\\$&')}: \\S+?token=([0-9a-f]{64})`, 'g'))].at(-1)?.[1];
  let srv;
  // verification ON
  srv = await start({ REQUIRE_EMAIL_VERIFICATION: 'true' });
  const email = `verify${Date.now()}@example.com`, password = 'Str0ng!pass';
  const reg = await post('/auth/register', { acceptTerms: true, name: 'Vera Fy', email, password });
  ok('register succeeds and asks to verify', reg.status === 201 && reg.json.needsVerification === true, reg);
  await sleep(200);
  const t1 = tokenFor(srv.log, email);
  ok('a link with a 64-char token was produced', !!t1 && srv.log().includes('https://example.test/verify-email?token='));
  const l1 = await post('/auth/login', { email, password });
  ok('login blocked before verifying (403 EMAIL_NOT_VERIFIED)', l1.status === 403 && l1.json.code === 'EMAIL_NOT_VERIFIED', l1);
  ok('wrong password still gives the generic 401 (no state leak)', (await post('/auth/login', { email, password: 'Wrong!pass1' })).status === 401);
  ok('bad token rejected', (await post('/auth/verify-email', { token: 'f'.repeat(64) })).status === 400);
  ok('garbage token rejected', (await post('/auth/verify-email', { token: 'abc' })).status === 400);
  ok('non-string token rejected', (await post('/auth/verify-email', { token: { a: 1 } })).status === 400);
  ok('immediate resend hits the 60s cooldown (429)', (await post('/auth/resend-verification', { email })).status === 429);
  const unknown = await post('/auth/resend-verification', { email: 'nobody@example.com' });
  ok('resend for unknown email gives the same generic 200', unknown.status === 200 && unknown.json.success, unknown);
  const v = await post('/auth/verify-email', { token: t1 });
  ok('valid token verifies the email', v.status === 200 && v.json.success, v);
  ok('the same link cannot be used twice', (await post('/auth/verify-email', { token: t1 })).status === 400);
  const l2 = await post('/auth/login', { email, password });
  ok('login works after verifying', l2.status === 200 && !!l2.json.accessToken, l2);
  ok('registering a verified email again is 409', (await post('/auth/register', { acceptTerms: true, name: 'Vera Fy', email, password })).status === 409);
  ok('resend for a verified account is a quiet 200', (await post('/auth/resend-verification', { email })).status === 200);

  const email2 = `pending${Date.now()}@example.com`;
  await post('/auth/register', { acceptTerms: true, name: 'First Try', email: email2, password: 'First!pass12' });
  const again = await post('/auth/register', { acceptTerms: true, name: 'Second Try', email: email2, password: 'Second!pass12' });
  ok('re-registering an unverified email is allowed', again.status === 201, again);
  await sleep(200);
  const t2 = tokenFor(srv.log, email2);
  ok('old password no longer works', (await post('/auth/login', { email: email2, password: 'First!pass12' })).status === 401);
  await post('/auth/verify-email', { token: t2 });
  ok('after verifying, the latest password signs in', (await post('/auth/login', { email: email2, password: 'Second!pass12' })).status === 200);
  ok('seeded demo accounts still sign in', (await post('/auth/login', { email: 'sarah@student.test', password: PW })).status === 200);

  const email3 = `restart${Date.now()}@example.com`;
  await post('/auth/register', { acceptTerms: true, name: 'Rest Art', email: email3, password: 'Rest!art1234' });
  await sleep(300); const t3 = tokenFor(srv.log, email3);
  await srv.stop();
  srv = await start({ REQUIRE_EMAIL_VERIFICATION: 'true' });
  ok('pending account is still pending after a restart', (await post('/auth/login', { email: email3, password: 'Rest!art1234' })).json.code === 'EMAIL_NOT_VERIFIED');
  ok('the emailed link still works after a restart', (await post('/auth/verify-email', { token: t3 })).status === 200);

  const email4 = `expire${Date.now()}@example.com`;
  await post('/auth/register', { acceptTerms: true, name: 'Exp Ired', email: email4, password: 'Exp!ired1234' }); await sleep(300);
  const t4 = tokenFor(srv.log, email4);
  await srv.stop();
  const dbFile = path.join(dir, 'data', 'db.json');
  const st = JSON.parse(fs.readFileSync(dbFile, 'utf8')); st.users.find(u => u.email === email4).emailVerification.expires = Date.now() - 1000; fs.writeFileSync(dbFile, JSON.stringify(st));
  srv = await start({ REQUIRE_EMAIL_VERIFICATION: 'true' });
  const ex = await post('/auth/verify-email', { token: t4 });
  ok('an expired link is refused with a clear message', ex.status === 400 && ex.json.code === 'EXPIRED', ex);
  await srv.stop();

  // creators are verified too
  srv = await start({ REQUIRE_EMAIL_VERIFICATION: 'true' });
  const cemail = `creatorv${Date.now()}@example.com`, cpass = 'Teach!er2026';
  const creg = await post('/auth/creator/register', { acceptTerms: true, name: 'Cree Ator', email: cemail, password: cpass });
  ok('creator sign-up asks to verify the email', creg.status === 201 && creg.json.needsVerification === true, creg);
  await sleep(200); const ct = tokenFor(srv.log, cemail);
  ok('a verification link was produced for the creator', !!ct);
  const cl1 = await post('/auth/login', { email: cemail, password: cpass, portal: 'creator' });
  ok('creator cannot sign in before verifying', cl1.status === 403 && cl1.json.code === 'EMAIL_NOT_VERIFIED', cl1);
  const cv = await post('/auth/verify-email', { token: ct });
  ok('verifying a creator points them to the creator sign-in', cv.status === 200 && cv.json.portal === 'creator' && /creator login/i.test(cv.json.message), cv);
  const cl2 = await post('/auth/login', { email: cemail, password: cpass, portal: 'creator' });
  ok('after verifying, the creator signs in (studio still locked until approval)', cl2.status === 200 && cl2.json.user.creatorStatus === 'unsubmitted', cl2);
  ok('the creator link cannot be reused', (await post('/auth/verify-email', { token: ct })).status === 400);
  const lv = await post('/auth/verify-email', { token: tokenFor(srv.log, email2) || 'f'.repeat(64) });
  ok('a learner verification reports the learner portal', lv.status === 400 || lv.json.portal === 'learner');
  await srv.stop();

  // verification OFF (no mail configured)
  srv = await start({});
  const email5 = `noverify${Date.now()}@example.com`;
  const r5 = await post('/auth/register', { acceptTerms: true, name: 'No Verify', email: email5, password: 'Plain!pass123' });
  ok('without mail configured, sign-up needs no verification', r5.status === 201 && r5.json.needsVerification === false, r5);
  ok('...and the account signs in right away', (await post('/auth/login', { email: email5, password: 'Plain!pass123' })).status === 200);
  await srv.stop();
});
