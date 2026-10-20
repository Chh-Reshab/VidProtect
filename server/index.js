// ============================================
// VIDPROTECT AI — API SERVER (Express)
//   npm run server        → http://localhost:4000
// In dev, Vite proxies /api to this server (see vite.config.js).
// In production this also serves the built SPA from /dist.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import { initDb, closeDb, mongoEnabled } from './db.js';
import { backend } from './blobs.js';
import { mailConfigured, appUrl } from './mail.js';
import { renderPrivacyHtml, renderTermsHtml, renderRefundHtml, prepareIndexHtml } from './publicPages.js';
import { migrateEncryption, recoverInterruptedUploads, backfillActivity, migrateCreatorApplications } from './migrate.js';
import { ensureAdmin, removeDemoData } from './bootstrap.js';
import authRoutes from './routes/auth.js';
import creatorApplicationRoutes from './routes/creatorApplication.js';
import mfaRoutes from './routes/mfa.js';
import profileRoutes from './routes/profile.js';
import chatRoutes from './routes/chat.js';
import dataRoutes from './routes/data.js';
import courseRoutes from './routes/courses.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import thumbnailRoutes from './routes/thumbnails.js';
import paymentRoutes from './routes/payments.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
// Hosts like Render hand the port over in PORT. In development PORT belongs to Vite
// (concurrently sets it), so it is only honoured in production.
const PORT = Number(process.env.API_PORT || (process.env.NODE_ENV === 'production' && process.env.PORT) || 4000);

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Vite's proxy / a load balancer: use the real client IP
// A strict Content Security Policy: only this site's own scripts run; the exceptions are Google Fonts
// (styles and fonts) and Razorpay's payment window. The app styles itself inline, hence 'unsafe-inline' for styles only.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", 'https://checkout.razorpay.com'],
      scriptSrcAttr: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      mediaSrc: ["'self'", 'blob:'],
      connectSrc: ["'self'", 'https://api.razorpay.com', 'https://lumberjack.razorpay.com'],
      frameSrc: ["'self'", 'https://api.razorpay.com', 'https://checkout.razorpay.com'],
      formAction: ["'self'", 'https://api.razorpay.com'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
    },
  },
}));
app.use(compression()); // JSON and the site's JS/CSS shrink a lot; video and other already-compressed types are skipped automatically
app.use(cookieParser());
// The webhook needs the exact bytes that were signed, so keep them for that route
app.use(express.json({ limit: '100kb', verify: (req, res, buf) => { if (req.originalUrl.startsWith('/api/webhooks/')) req.rawBody = buf; } }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

// For search engines: only the public pages are listed, the signed-in areas and the API are not
app.get('/robots.txt', (req, res) => res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /admin\nDisallow: /studio\nDisallow: /learn\nSitemap: ${appUrl(req)}/sitemap.xml\n`));
app.get('/sitemap.xml', (req, res) => {
  const urls = ['/', '/login', '/creator/login', '/terms', '/privacy', '/refund-policy'].map(p => `  <url><loc>${appUrl(req)}${p}</loc></url>`).join('\n');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
});

app.use('/api/auth/mfa', mfaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/creator', creatorApplicationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', thumbnailRoutes);
app.use('/api', profileRoutes);
app.use('/api', paymentRoutes);
app.use('/api', courseRoutes);
app.use('/api', videoRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// The privacy policy is plain HTML (readable without scripts, by search engines and Google's reviewers)
const legalPage = (render) => (req, res) => res.setHeader('Cache-Control', 'no-cache').type('html').send(render());
app.get('/privacy', legalPage(renderPrivacyHtml));
app.get('/terms', legalPage(renderTermsHtml));
app.get('/refund-policy', legalPage(renderRefundHtml));

// Production: serve the built SPA
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  const indexHtml = prepareIndexHtml(fs.readFileSync(path.join(dist, 'index.html'), 'utf8'));
  app.use(express.static(dist, {
    index: false,
    // Built files have a content hash in their name, so browsers may keep them for good; index.html must stay fresh
    setHeaders: (res, file) => res.setHeader('Cache-Control', file.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'),
  }));
  app.get('/{*splat}', (req, res) => res.setHeader('Cache-Control', 'no-cache').type('html').send(indexHtml));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

await initDb(); // loads the data (JSON file or MongoDB) before anything uses it
if (process.env.NODE_ENV === 'production' && !mongoEnabled()) {
  console.warn('[db] MONGODB_URI is not set: data and uploaded videos are kept on this machine\'s disk and will be lost if the host resets it.');
}
if (process.env.NODE_ENV === 'production' && !mailConfigured()) {
  console.warn('[mail] No mail provider is configured (Gmail or Brevo variables): new accounts are NOT email-verified.');
}
ensureAdmin(); // creates / updates the admin from ADMIN_EMAIL + ADMIN_PASSWORD (required in production)
await removeDemoData(); // clears the old built-in beta accounts from databases created before they were removed
backfillActivity();
await recoverInterruptedUploads(); // fail uploads that were mid-processing when the server stopped
migrateCreatorApplications();
await migrateEncryption(); // bring older videos up to AES-256-GCM before serving anything

const server = app.listen(PORT, () => console.log(`VidProtect API listening on port ${PORT} (${process.env.NODE_ENV || 'development'}, ${mongoEnabled() ? 'MongoDB' : 'JSON file'}, videos: ${backend()})`));

// Hosts stop the app with SIGTERM on every deploy: finish writing to the database first
let closing = false;
const shutdown = async () => {
  if (closing) return;
  closing = true;
  server.close();
  try { await closeDb(); } catch (err) { console.error('[db] shutdown flush failed:', err.message); }
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// A crash still saves what was waiting to be written (up to 3 seconds), then exits so the host restarts the app
const crashed = async (err) => {
  console.error('[fatal]', err);
  try { await Promise.race([closeDb(), new Promise(resolve => setTimeout(resolve, 3000))]); } catch { /* nothing more to do */ }
  process.exit(1);
};
process.on('uncaughtException', crashed);
process.on('unhandledRejection', crashed);
