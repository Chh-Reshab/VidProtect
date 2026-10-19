import { suite, startServer, client, signIn } from './helpers.js';
import { REFUND_DAYS, REFUND_MAX_WATCHED_PERCENT, LEGAL_UPDATED } from '../shared/legal.js';

suite('terms of service, refund policy and agreeing at sign-up', async ({ ok }) => {
  const srv = await startServer({ env: { CONTACT_EMAIL: 'legal@example.com' } });
  try {
    const api = client(srv.base);

    // ── the pages ──
    const terms = await fetch(`${srv.base}/terms`);
    const t = await terms.text();
    ok('/terms is a real HTML page', terms.status === 200 && /text\/html/.test(terms.headers.get('content-type')) && t.includes('<h1>Terms of Service</h1>') && !/<script/i.test(t), terms.status);
    ok('the terms cover accounts, creator content, learner licence, payments, refunds, liability and governing law', ['Your account', 'Creator content', 'Learner licence and content protection', 'Prices and payments', 'Limit of liability', 'Governing law'].every(x => t.includes(x)));
    ok('the terms tell learners about recording and screenshot monitoring', /screenshot/i.test(t) && /watermark/i.test(t));
    ok('the terms link on to the other policies and show the contact', t.includes('href="/privacy"') && t.includes('href="/refund-policy"') && t.includes('mailto:legal@example.com'));

    const refund = await fetch(`${srv.base}/refund-policy`);
    const r = await refund.text();
    ok('/refund-policy is a real HTML page', refund.status === 200 && r.includes('<h1>Refund Policy</h1>'));
    ok('it states the refund window and watch limit from the settings, not made-up numbers', r.includes(`within ${REFUND_DAYS} days`) && r.includes(`less than ${REFUND_MAX_WATCHED_PERCENT}%`), r.slice(0, 600));
    ok('it explains how to ask, how long it takes, and test mode', ['How to ask', 'How refunds are paid', 'Test mode'].every(x => r.includes(x)) && r.includes('mailto:legal@example.com'));
    ok('every legal page shows when it was last updated', [t, r, await (await fetch(`${srv.base}/privacy`)).text()].every(h => h.includes('Last updated')) && t.includes(LEGAL_UPDATED));
    ok('the privacy page links to the new pages', (await (await fetch(`${srv.base}/privacy`)).text()).includes('href="/terms"'));
    const sitemap = await (await fetch(`${srv.base}/sitemap.xml`)).text();
    ok('the sitemap lists the new pages', sitemap.includes('/terms') && sitemap.includes('/refund-policy'));

    // ── agreeing is part of signing up ──
    const email = (n) => `legal${n}${Date.now()}@example.com`;
    const body = (extra = {}) => ({ name: 'Lee Gal', email: email(Math.random().toString(36).slice(2, 6)), password: 'Agree!pass2026', ...extra });
    const missing = await api('POST', '/auth/register', { body: body() });
    ok('signing up without agreeing is refused with a clear message on the right field', missing.status === 400 && /Terms of Service/.test(missing.json.fields?.terms || ''), missing.json);
    ok('"false" and other values are not agreement', (await api('POST', '/auth/register', { body: body({ acceptTerms: false }) })).status === 400 && (await api('POST', '/auth/register', { body: body({ acceptTerms: 'no' }) })).status === 400 && (await api('POST', '/auth/register', { body: body({ acceptTerms: 1 }) })).status === 400);
    ok('creators must agree too', (await api('POST', '/auth/creator/register', { body: body() })).status === 400);
    const good = body({ acceptTerms: true });
    const done = await api('POST', '/auth/register', { body: good });
    ok('agreeing lets the account be created', done.status === 201, done.json);
    const token = (await api('POST', '/auth/login', { body: { email: good.email, password: good.password } })).json.accessToken;
    const me = (await api('GET', '/data', { token })).json.me;
    ok('the date and the version of the terms agreed to are recorded', /^\d{4}-\d\d-\d\dT/.test(me.termsAcceptedAt) && me.termsVersion === LEGAL_UPDATED, me);
    const creator = body({ acceptTerms: 'true' });
    ok('the string "true" (a form field) counts as agreement', (await api('POST', '/auth/creator/register', { body: creator })).status === 201);
    ok('the demo accounts of the tests are unaffected by the new rule', !!(await signIn(api, 'sarah@student.test')));
  } finally { await srv.stop(); }
});
