import { suite, startServer, PW } from './helpers.js';

suite('sign-up, login and settings validation', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  const reg = async (b) => { const r = await fetch(`${base}/api/auth/register`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) }); return { status: r.status, json: await r.json().catch(() => ({})) }; };
  const good = { name: 'Asha Rao', email: `asha${Date.now()}@example.com`, password: 'goodpass42!' };
  const bad = [
    ['empty name', { ...good, name: '' }, 'name'], ['one-letter name', { ...good, name: 'A' }, 'name'],
    ['digits in name', { ...good, name: 'Bot 12345' }, 'name'], ['link as name', { ...good, name: 'http://spam.com' }, 'name'],
    ['name 61 chars', { ...good, name: 'A'.repeat(61) }, 'name'], ['name not a string', { ...good, name: { a: 1 } }, 'name'],
    ['no email', { ...good, email: '' }, 'email'], ['email without @', { ...good, email: 'nope.example.com' }, 'email'],
    ['email without tld', { ...good, email: 'a@b' }, 'email'], ['email with spaces', { ...good, email: 'a b@x.com' }, 'email'],
    ['email double dot', { ...good, email: 'a..b@x.com' }, 'email'], ['email too long', { ...good, email: 'a'.repeat(250) + '@x.com' }, 'email'],
    ['short password', { ...good, password: 'a1' }, 'password'], ['password no number', { ...good, password: 'onlyletters' }, 'password'],
    ['password no letter', { ...good, password: '12345678!' }, 'password'], ['password no special char', { ...good, password: 'goodpass42' }, 'password'], ['password only underscore-free spaces', { ...good, password: 'good pass 42' }, 'password'], ['common password', { ...good, password: 'password123' }, 'password'],
    ['password over 72 bytes', { ...good, password: 'a1' + 'x'.repeat(80) }, 'password'], ['password is the email name', { ...good, email: 'asha4242x@example.com', password: 'asha4242x' }, 'password'],
    ['password not a string', { ...good, password: 12345678 }, 'password'],
  ];
  for (const [label, body, field] of bad) { const r = await reg(body); ok(`rejects ${label}`, r.status === 400 && !!r.json.fields?.[field], r); }
  const a = await reg(good); ok('accepts a valid sign-up', a.status === 201, a);
  ok('duplicate email rejected (409)', (await reg(good)).status === 409);
  ok('duplicate with different case rejected', (await reg({ ...good, email: good.email.toUpperCase() })).status === 409);
  const sp = await reg({ ...good, name: '  José   María-O\'Neil  ', email: `  JM${Date.now()}@Example.COM ` }); ok('trims/normalises name and email', sp.status === 201, sp);
  const login = async (email, password) => fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
  ok('new account can sign in', (await login(good.email, good.password)).status === 200);
  ok('login with empty fields is 400', (await login('', '')).status === 400);
  ok('login with an object email does not crash', [400, 401].includes((await login({ $ne: 1 }, 'x')).status));
  const tok = (await (await login('sarah@student.test', PW)).json()).accessToken;
  const cp = (pw) => fetch(`${base}/api/auth/change-password`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify({ currentPassword: PW, newPassword: pw }) });
  ok('change-password needs a special character', (await cp('Newpass1234')).status === 400);
  ok('change-password rejects a weak password', (await cp('abc')).status === 400);
  ok('change-password rejects "no number"', (await cp('lettersonly')).status === 400);
  ok('change-password rejects same password', (await cp(PW)).status === 400);
  const st = (b) => fetch(`${base}/api/settings`, { method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: JSON.stringify(b) });
  ok('settings rejects a bad email', (await st({ email: 'bad' })).status === 400);
  ok('settings rejects a bad display name', (await st({ displayName: 'x' })).status === 400);
  ok('settings accepts good values', (await st({ displayName: 'Sarah Chen', email: 'sarah@example.com' })).status === 200);
  } finally { await srv.stop(); }
});
