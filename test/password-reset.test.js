import fs from 'node:fs';
import path from 'node:path';
import { suite, startServer, client, sleep, PW, ADMIN_EMAIL } from './helpers.js';

const linkFor = (log, email) => [...log().matchAll(new RegExp(`password reset link for ${email.replace(/[.+]/g, '\\$&')}: \\S+?token=([0-9a-f]{64})`, 'g'))].at(-1)?.[1];

suite('forgot and reset password', async ({ ok }) => {
  let srv = await startServer();
  try {
    let api = client(srv.base);
    const email = 'sarah@student.test';
    const NEW = 'Brand!New2026x';

    ok('the sign-in pages are told password reset is available', (await api('GET', '/auth/options')).json.passwordReset === true);
    const generic = 'If an account exists for that email, we sent a link to reset the password.';
    const known = await api('POST', '/auth/forgot-password', { body: { email } });
    const unknown = await api('POST', '/auth/forgot-password', { body: { email: 'nobody@example.com' } });
    ok('known and unknown emails get the identical answer (no account discovery)', known.status === 200 && unknown.status === 200 && known.json.message === generic && unknown.json.message === generic, [known.json, unknown.json]);
    ok('an invalid email is refused', (await api('POST', '/auth/forgot-password', { body: { email: 'nope' } })).status === 400);
    await sleep(150);
    const token = linkFor(srv.log, email);
    ok('a reset link with a 64-character token is produced for the real account', !!token);
    ok('nothing is produced for the unknown address', !srv.log().includes('nobody@example.com'));
    await api('POST', '/auth/forgot-password', { body: { email } });
    await sleep(150);
    ok('asking again within a minute does not send another link', [...srv.log().matchAll(/password reset link for sarah@student\.test/g)].length === 1);

    const oldSession = await api('POST', '/auth/login', { body: { email, password: PW } });
    ok('a session exists before the reset', oldSession.status === 200);

    ok('a weak new password is refused', (await api('POST', '/auth/reset-password', { body: { token, password: 'abc' } })).status === 400);
    ok('a password without a special character is refused', (await api('POST', '/auth/reset-password', { body: { token, password: 'Newpass12345' } })).status === 400);
    ok('a wrong token is refused', (await api('POST', '/auth/reset-password', { body: { token: 'f'.repeat(64), password: NEW } })).status === 400);
    ok('garbage and non-string tokens are refused', (await api('POST', '/auth/reset-password', { body: { token: 'abc', password: NEW } })).status === 400 && (await api('POST', '/auth/reset-password', { body: { token: { a: 1 }, password: NEW } })).status === 400);
    const done = await api('POST', '/auth/reset-password', { body: { token, password: NEW } });
    ok('a valid link sets the new password', done.status === 200 && done.json.success && done.json.portal === 'learner', done);
    ok('the link works only once', (await api('POST', '/auth/reset-password', { body: { token, password: 'Other!Pass2026' } })).status === 400);
    ok('the old password no longer works', (await api('POST', '/auth/login', { body: { email, password: PW } })).status === 401);
    ok('the new password works', (await api('POST', '/auth/login', { body: { email, password: NEW } })).status === 200);
    const stale = await api('GET', '/data', { token: oldSession.json.accessToken });
    ok('every device that was signed in is signed out', stale.status === 401, stale.status);

    // a creator is pointed to the creator sign-in
    await api('POST', '/auth/forgot-password', { body: { email: 'maya@creator.test' } });
    await sleep(150);
    const creatorReset = await api('POST', '/auth/reset-password', { body: { token: linkFor(srv.log, 'maya@creator.test'), password: NEW } });
    ok('a creator is told to use the creator sign-in', creatorReset.json.portal === 'creator', creatorReset.json);

    // a suspended account gets nothing
    await api('POST', '/auth/forgot-password', { body: { email: 'james@student.test' } });
    await sleep(150);
    ok('a suspended account is not sent a link', !linkFor(srv.log, 'james@student.test'));

    // an expired link
    await api('POST', '/auth/forgot-password', { body: { email: 'omar@student.test' } });
    await sleep(400);
    const expired = linkFor(srv.log, 'omar@student.test');
    const dir = srv.dir;
    await srv.stop();
    const file = path.join(dir, 'data', 'db.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    state.users.find(u => u.email === 'omar@student.test').passwordReset.expires = Date.now() - 1000;
    fs.writeFileSync(file, JSON.stringify(state));
    srv = await startServer({ dir });
    api = client(srv.base);
    const late = await api('POST', '/auth/reset-password', { body: { token: expired, password: NEW } });
    ok('an expired link is refused with a clear message', late.status === 400 && late.json.code === 'EXPIRED', late);
  } finally { await srv.stop(); }

  // a pending (unverified) account that resets by email is proven to own the inbox
  const v = await startServer({ fixture: false, env: { REQUIRE_EMAIL_VERIFICATION: 'true', ADMIN_PASSWORD: 'A-long-admin-pass-1' } });
  try {
    const api = client(v.base);
    const email = 'pending@example.com';
    await api('POST', '/auth/register', { body: { acceptTerms: true, name: 'Pending Person', email, password: 'First!pass1234' } });
    ok('the pending account cannot sign in', (await api('POST', '/auth/login', { body: { email, password: 'First!pass1234' } })).json.code === 'EMAIL_NOT_VERIFIED');
    await api('POST', '/auth/forgot-password', { body: { email } });
    await sleep(200);
    await api('POST', '/auth/reset-password', { body: { token: linkFor(v.log, email), password: 'Second!pass1234' } });
    ok('resetting by email also verifies the address', (await api('POST', '/auth/login', { body: { email, password: 'Second!pass1234' } })).status === 200);
  } finally { await v.stop(); }

  // production without a mail provider cannot send reset links
  const prod = await startServer({ fixture: false, env: { NODE_ENV: 'production', JWT_SECRET: 'j'.repeat(40), ADMIN_EMAIL, ADMIN_PASSWORD: 'A-long-admin-pass-1' } });
  try {
    const api = client(prod.base);
    ok('production without email says so (503) and the page hides the link', (await api('POST', '/auth/forgot-password', { body: { email: ADMIN_EMAIL } })).status === 503 && (await api('GET', '/auth/options')).json.passwordReset === false);
  } finally { await prod.stop(); }
});
