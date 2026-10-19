import { suite, startServer } from './helpers.js';

suite('security headers, robots and sitemap', async ({ ok }) => {
  const srv = await startServer({ fixture: false });
  try {
    const res = await fetch(`${srv.base}/api/health`);
    const csp = res.headers.get('content-security-policy') || '';
    ok('a Content Security Policy is sent', csp.length > 0);
    ok('scripts: only this site and Razorpay', /script-src 'self' https:\/\/checkout\.razorpay\.com(;|$)/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp) && !/script-src[^;]*unsafe-eval/.test(csp), csp);
    ok('inline script attributes are blocked', /script-src-attr 'none'/.test(csp));
    ok('framing, plugins and base tag are locked down', /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp));
    ok('Google Fonts are allowed', /style-src[^;]*fonts\.googleapis\.com/.test(csp) && /font-src[^;]*fonts\.gstatic\.com/.test(csp));
    ok('the server does not announce itself', !res.headers.has('x-powered-by'));
    ok('content sniffing is off', res.headers.get('x-content-type-options') === 'nosniff');

    const robots = await (await fetch(`${srv.base}/robots.txt`)).text();
    ok('robots.txt hides the signed-in areas and the API', /Disallow: \/api\//.test(robots) && /Disallow: \/admin/.test(robots) && /Disallow: \/studio/.test(robots) && /Sitemap: http/.test(robots), robots);
    const sitemap = await (await fetch(`${srv.base}/sitemap.xml`)).text();
    ok('the sitemap lists only the public pages', sitemap.includes('/privacy') && sitemap.includes('/creator/login') && !sitemap.includes('/admin') && sitemap.includes('<urlset'), sitemap);

    const gz = await fetch(`${srv.base}/api/health`, { headers: { 'accept-encoding': 'gzip' } });
    ok('API answers work with compression asked for', gz.status === 200);
  } finally { await srv.stop(); }
});
