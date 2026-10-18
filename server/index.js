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
import { initDb, closeDb, useMongo } from './db.js';
import { backend } from './blobs.js';
import { mailConfigured } from './mail.js';
import { migrateEncryption, recoverInterruptedUploads, backfillActivity, migrateCreatorApplications } from './migrate.js';
import { ensureAdmin, removeDemoData } from './bootstrap.js';
import authRoutes from './routes/auth.js';
import creatorApplicationRoutes from './routes/creatorApplication.js';
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
app.use(helmet({ contentSecurityPolicy: false })); // SPA uses inline styles + Google Fonts
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/creator', creatorApplicationRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', thumbnailRoutes);
app.use('/api', paymentRoutes);
app.use('/api', courseRoutes);
app.use('/api', videoRoutes);

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// Production: serve the built SPA
const dist = path.join(here, '..', 'dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong.' });
});

await initDb(); // loads the data (JSON file or MongoDB) before anything uses it
if (process.env.NODE_ENV === 'production' && !useMongo()) {
  console.warn('[db] MONGODB_URI is not set: data and uploaded videos are kept on this machine\'s disk and will be lost if the host resets it.');
}
if (process.env.NODE_ENV === 'production' && !mailConfigured()) {
  console.warn('[mail] No mail provider is configured (Gmail or Brevo variables): new accounts are NOT email-verified.');
}
ensureAdmin(); // creates / updates the admin from ADMIN_EMAIL + ADMIN_PASSWORD (required in production)
await removeDemoData(); // clears the old built-in beta accounts from databases created before they were removed
// refuses to start in production without ADMIN_PASSWORD
backfillActivity();
await recoverInterruptedUploads(); // fail uploads that were mid-processing when the server stopped
migrateCreatorApplications();
await migrateEncryption(); // bring older videos up to AES-256-GCM before serving anything

const server = app.listen(PORT, () => console.log(`VidProtect API listening on port ${PORT} (${process.env.NODE_ENV || 'development'}, ${useMongo() ? 'MongoDB' : 'JSON file'}, videos: ${backend()})`));

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
