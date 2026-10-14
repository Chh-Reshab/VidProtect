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
import './db.js';
import { migrateEncryption, recoverInterruptedUploads, backfillActivity } from './migrate.js';
import authRoutes from './routes/auth.js';
import dataRoutes from './routes/data.js';
import courseRoutes from './routes/courses.js';
import videoRoutes from './routes/videos.js';
import adminRoutes from './routes/admin.js';
import thumbnailRoutes from './routes/thumbnails.js';
import paymentRoutes from './routes/payments.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.API_PORT || 4000); // not PORT: dev tooling sets PORT for the web server

app.disable('x-powered-by');
app.set('trust proxy', 1); // behind Vite's proxy / a load balancer: use the real client IP
app.use(helmet({ contentSecurityPolicy: false })); // SPA uses inline styles + Google Fonts
app.use(cookieParser());
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
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

backfillActivity();
recoverInterruptedUploads(); // fail uploads that were mid-processing when the server stopped
await migrateEncryption(); // bring older videos up to AES-256-GCM before serving anything

app.listen(PORT, () => console.log(`VidProtect API listening on http://localhost:${PORT}`));
