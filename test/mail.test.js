import { suite } from './helpers.js';

suite('outgoing email: Gmail request flow and message format (unit)', async ({ ok }) => {
  // Stubs fetch to check the Gmail request flow and the MIME message, without touching Google.
  Object.assign(process.env, { GMAIL_CLIENT_ID: 'cid', GMAIL_CLIENT_SECRET: 'sec', GMAIL_REFRESH_TOKEN: 'rt', MAIL_FROM: 'me@gmail.com', MAIL_FROM_NAME: 'VidProtect AI' });
  delete process.env.BREVO_API_KEY;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('oauth2.googleapis.com')) return new Response(JSON.stringify({ access_token: 'AT1', expires_in: 3600 }), { status: 200 });
    return new Response(JSON.stringify({ id: 'm1' }), { status: 200 });
  };
  const mail = await import('../server/mail.js');
  ok('configured with Gmail variables', mail.mailConfigured() && mail.verificationRequired());
  await mail.sendVerificationEmail({ to: 'new@user.com', name: 'Zoë <b>Test</b>', link: 'https://site.test/verify-email?token=' + 'a'.repeat(64) });
  ok('asks Google for an access token with the refresh token', calls[0].url.includes('oauth2.googleapis.com/token') && String(calls[0].init.body).includes('refresh_token=rt') && String(calls[0].init.body).includes('grant_type=refresh_token'), calls[0]);
  ok('sends through the Gmail API with the bearer token', calls[1].url === 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send' && calls[1].init.headers.authorization === 'Bearer AT1', calls[1]);
  const raw = Buffer.from(JSON.parse(calls[1].init.body).raw, 'base64url').toString('utf8');
  const dec = (b) => Buffer.from(b, 'base64').toString('utf8');
  ok('From is the Gmail address with the sender name', /^From: =\?UTF-8\?B\?(.+?)\?= <me@gmail\.com>/m.test(raw) && dec(raw.match(/^From: =\?UTF-8\?B\?(.+?)\?=/m)[1]) === 'VidProtect AI', raw.slice(0, 200));
  ok('To is the new user', /^To: .* <new@user\.com>/m.test(raw));
  ok('subject is encoded UTF-8', dec(raw.match(/^Subject: =\?UTF-8\?B\?(.+?)\?=/m)[1]) === 'Verify your email for VidProtect AI');
  const parts = raw.split(/--vp_[a-z0-9]+/).slice(1, 3).map(p => dec(p.split('\r\n\r\n')[1].replace(/\r\n/g, '')));
  ok('plain text part contains the link and the name', parts[0].includes('verify-email?token=') && parts[0].includes('Zoë <b>Test</b>'));
  ok('HTML part escapes the name (no injected tags)', parts[1].includes('Zoë &lt;b&gt;Test&lt;/b&gt;') && !parts[1].includes('<b>Test</b>'));
  await mail.sendVerificationEmail({ to: 'two@user.com', name: 'Two', link: 'https://site.test/x' });
  ok('the access token is reused for the next email', calls.filter(c => c.url.includes('oauth2')).length === 1 && calls.length === 3);
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ access_token: 'AT1', expires_in: 3600, id: 'm' }), { status: 200 }); };
  await mail.sendVerificationEmail({ to: 'a@b.com', name: 'Evil\r\nBcc: victim@x.com', link: 'https://s/x' });
  const injRaw = Buffer.from(JSON.parse(calls.at(-1).init.body).raw, 'base64url').toString('utf8');
  ok('line breaks in names/subjects cannot inject headers', !/^Bcc:/m.test(injRaw), injRaw.slice(0, 300));
  globalThis.fetch = async (url) => (String(url).includes('oauth2') ? new Response(JSON.stringify({ access_token: 'AT2', expires_in: 3600 }), { status: 200 }) : new Response('{"error":{"message":"bad"}}', { status: 403 }));
  let err; try { await mail.sendVerificationEmail({ to: 'x@y.com', name: 'X', link: 'https://s/x' }); } catch (e) { err = e; }
  ok('a Gmail error is raised so the caller can log it', /Gmail responded 403/.test(err?.message || ''), err?.message);

  // the other messages use the same layout
  const decodeLast = () => {
    const raw = Buffer.from(JSON.parse(calls.at(-1).init.body).raw, 'base64url').toString('utf8');
    const part = (re) => Buffer.from(raw.match(re)[1], 'base64').toString('utf8');
    return { subject: part(/^Subject: =\?UTF-8\?B\?(.+?)\?=/m), text: Buffer.from(raw.split(/--vp_[a-z0-9]+/)[1].split('\r\n\r\n')[1].replace(/\r\n/g, ''), 'base64').toString('utf8') };
  };
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init }); return new Response(JSON.stringify({ access_token: 'AT1', expires_in: 3600, id: 'm' }), { status: 200 }); };
  await mail.sendPasswordResetEmail({ to: 'a@b.com', name: 'Ann', link: 'https://s/reset-password?token=abc' });
  let m = decodeLast();
  ok('password reset email: subject, link and the one-hour note', m.subject === 'Reset your VidProtect AI password' && m.text.includes('https://s/reset-password?token=abc') && m.text.includes('1 hour'), m);
  await mail.sendCreatorDecisionEmail({ to: 'a@b.com', name: 'Ann', link: 'https://s/creator/login', approved: true });
  m = decodeLast();
  ok('approval email says the studio is open', /approved/.test(m.subject) && m.text.includes('studio is now open'), m);
  await mail.sendCreatorDecisionEmail({ to: 'a@b.com', name: 'Ann', link: 'https://s/creator/login', approved: false, note: 'Please add your CV.' });
  m = decodeLast();
  ok('rejection email carries the reviewer note and invites a new application', /Update on/.test(m.subject) && m.text.includes('Please add your CV.') && m.text.includes('apply again'), m);
  ok('email is available for reset links on a developer machine only', mail.emailAvailable() === true);
});
