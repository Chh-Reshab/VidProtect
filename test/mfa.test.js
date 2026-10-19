import fs from 'node:fs';
import path from 'node:path';
import { suite, startServer, client, signIn, sleep, PW } from './helpers.js';
import { totpAt } from '../server/totp.js';

// The code that was just used cannot be used again, so wait for the next 30-second window
const nextCode = async (secret) => {
  const next = (Math.floor(Date.now() / 30000) + 1) * 30000;
  await sleep(next - Date.now() + 200);
  return totpAt(secret);
};

suite('two-step verification (authenticator app)', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const email = 'admin@vidprotect.test';
    const token = await signIn(api, email);

    ok('it starts off', (await api('GET', '/data', { token })).json.me.mfaEnabled === false);
    const setup = await api('POST', '/auth/mfa/setup', { token });
    ok('setup returns a secret, an otpauth link and a QR code', /^[A-Z2-7]{32}$/.test(setup.json.secret) && setup.json.otpauthUrl.startsWith('otpauth://totp/') && setup.json.qr.startsWith('data:image/png;base64,'), setup.json.secret);
    ok('nothing is on until a code is confirmed', !!(await api('POST', '/auth/login', { body: { email, password: PW } })).json.accessToken);
    ok('a wrong first code is refused', (await api('POST', '/auth/mfa/enable', { token, body: { code: '000000' } })).status === 400);
    ok('enabling needs setup first', (await api('POST', '/auth/mfa/enable', { token: await signIn(api, 'sarah@student.test'), body: { code: totpAt(setup.json.secret) } })).status === 400);
    const enabled = await api('POST', '/auth/mfa/enable', { token, body: { code: totpAt(setup.json.secret) } });
    const codes = enabled.json.recoveryCodes;
    ok('a correct code turns it on and returns 10 recovery codes', enabled.status === 200 && codes.length === 10 && codes.every(c => /^[0-9a-f]{5}-[0-9a-f]{5}$/.test(c)), enabled.json);
    const profile = await api('GET', '/data', { token });
    ok('the profile now says it is on, without leaking the secret', profile.json.me.mfaEnabled === true && !JSON.stringify(profile.json).includes(setup.json.secret));
    ok('starting setup again is refused', (await api('POST', '/auth/mfa/setup', { token })).status === 409);

    // sign-in is now two steps
    const step1 = await api('POST', '/auth/login', { body: { email, password: PW } });
    ok('the password step alone gives no session, only a short-lived token', step1.status === 200 && step1.json.mfaRequired === true && !step1.json.accessToken && !!step1.json.mfaToken, step1.json);
    ok('that token is useless as a normal access token', (await api('GET', '/data', { token: step1.json.mfaToken })).status === 401);
    ok('a wrong code is refused', (await api('POST', '/auth/mfa/login', { body: { mfaToken: step1.json.mfaToken, code: '123456' } })).status === 401);
    ok('a made-up token is refused', (await api('POST', '/auth/mfa/login', { body: { mfaToken: 'abc', code: totpAt(setup.json.secret) } })).status === 401);
    const good = await nextCode(setup.json.secret);
    const step2 = await api('POST', '/auth/mfa/login', { body: { mfaToken: step1.json.mfaToken, code: good } });
    ok('the right code finishes the sign-in', step2.status === 200 && !!step2.json.accessToken && step2.json.user.mfaEnabled === true, step2.json);
    ok('the session works', (await api('GET', '/data', { token: step2.json.accessToken })).status === 200);
    const again = await api('POST', '/auth/login', { body: { email, password: PW } });
    ok('the same code cannot be used twice (replay)', (await api('POST', '/auth/mfa/login', { body: { mfaToken: again.json.mfaToken, code: good } })).status === 401);

    // recovery codes
    const viaRecovery = await api('POST', '/auth/mfa/login', { body: { mfaToken: again.json.mfaToken, code: codes[0] } });
    ok('a recovery code signs in', viaRecovery.status === 200 && !!viaRecovery.json.accessToken, viaRecovery.json);
    const again2 = await api('POST', '/auth/login', { body: { email, password: PW } });
    ok('...but only once', (await api('POST', '/auth/mfa/login', { body: { mfaToken: again2.json.mfaToken, code: codes[0] } })).status === 401);

    // lockout after five wrong codes
    const lockToken = (await api('POST', '/auth/login', { body: { email, password: PW } })).json.mfaToken;
    for (let i = 0; i < 5; i += 1) await api('POST', '/auth/mfa/login', { body: { mfaToken: lockToken, code: '111111' } });
    const locked = await api('POST', '/auth/mfa/login', { body: { mfaToken: lockToken, code: codes[1] } });
    ok('five wrong codes lock it for a while, even for a valid recovery code', locked.status === 429, locked);

    // secrets at rest
    await sleep(300);
    ok('the secret is encrypted in the database file', !fs.readFileSync(path.join(srv.dir, 'data', 'db.json'), 'utf8').includes(setup.json.secret));
    ok('disabling without the right password is refused', (await api('POST', '/auth/mfa/disable', { token, body: { password: 'wrong', code: codes[2] } })).status === 400);
  } finally { await srv.stop(); }
});

suite('two-step verification: management', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const token = await signIn(api, 'maya@creator.test');
    const setup = await api('POST', '/auth/mfa/setup', { token });
    const codes = (await api('POST', '/auth/mfa/enable', { token, body: { code: totpAt(setup.json.secret) } })).json.recoveryCodes;
    const regenerated = await api('POST', '/auth/mfa/recovery-codes', { token, body: { password: PW, code: codes[0] } });
    ok('recovery codes can be regenerated with the password and a code', regenerated.json.recoveryCodes?.length === 10, regenerated);
    ok('the old recovery codes stop working', (await api('POST', '/auth/mfa/recovery-codes', { token, body: { password: PW, code: codes[1] } })).status === 400);
    ok('disabling needs a code as well as the password', (await api('POST', '/auth/mfa/disable', { token, body: { password: PW } })).status === 400);
    const off = await api('POST', '/auth/mfa/disable', { token, body: { password: PW, code: regenerated.json.recoveryCodes[0] } });
    ok('with both it is turned off', off.status === 200 && (await api('GET', '/data', { token })).json.me.mfaEnabled === false, off);
    ok('signing in is one step again', !!(await api('POST', '/auth/login', { body: { email: 'maya@creator.test', password: PW } })).json.accessToken);
  } finally { await srv.stop(); }
});
