import fs from 'node:fs';
import path from 'node:path';
import { suite, startServer } from './helpers.js';

const BUILT = fs.existsSync(path.resolve(import.meta.dirname, '..', 'dist', 'index.html')); // `npm run build` first

suite('pages that must be readable without JavaScript (search engines, Google review)', async ({ ok }) => {
  const srv = await startServer({ fixture: false, env: { CONTACT_EMAIL: 'privacy@example.com', GOOGLE_SITE_VERIFICATION: 'tok_abc123' } });
  try {
    const privacy = await fetch(`${srv.base}/privacy`);
    const html = await privacy.text();
    ok('/privacy is a real HTML page, not an empty app shell', privacy.status === 200 && /text\/html/.test(privacy.headers.get('content-type')) && html.includes('<h1>Privacy Policy</h1>'), privacy.status);
    ok('it names the app and carries enough detail (collection, use, sharing, deletion, children)', ['VidProtect AI', 'What we collect', 'How we use it', 'Who we share it with', 'Keeping and deleting your data', 'Children'].every(t => html.includes(t)), html.length);
    ok('it explains the Gmail use and includes the Google Limited Use statement', html.includes('gmail.send') && html.includes('Google API Services User Data Policy') && html.includes('Limited Use'));
    ok('it states that nobody\'s email is read', /does not read, list, search, store or delete anyone/.test(html));
    ok('it shows the contact address', html.includes('mailto:privacy@example.com'));
    ok('it links back to the home page', html.includes('href="/"'));
    ok('it needs no script', !/<script/i.test(html));

    if (!BUILT) return;
    const home = await (await fetch(`${srv.base}/`)).text();
    ok('the home page says what VidProtect AI is before any script runs', home.includes('<h1 style') && home.includes('Secure video hosting for online course creators') && home.includes('VidProtect AI'));
    ok('the home page links to the privacy policy and to sign in, without a login wall', home.includes('href="/privacy"') && home.includes('href="/login"') && home.includes('href="/creator/login"'));
    ok('the home page tells how Google APIs are used', home.includes('Gmail API') && home.includes('does not read or access anyone'));
    ok('the Google Search Console verification tag is added when configured', home.includes('<meta name="google-site-verification" content="tok_abc123"'));
    ok('the same tag reaches deep links too', (await (await fetch(`${srv.base}/creator/login`)).text()).includes('google-site-verification'));
  } finally { await srv.stop(); }

  if (!BUILT) return;
  const plain = await startServer({ fixture: false });
  try {
    ok('without the setting there is no verification tag', !(await (await fetch(`${plain.base}/`)).text()).includes('google-site-verification'));
  } finally { await plain.stop(); }
});
