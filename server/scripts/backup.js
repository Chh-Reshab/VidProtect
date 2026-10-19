// ============================================
// Backup of the database (accounts, courses, enrolments, payments, logs...) to one JSON file.
//   npm run backup                 -> backups/vidprotect-<date>.json
//   npm run backup -- my-file.json -> that file
// Works with the JSON file store and with MongoDB (set MONGODB_URI).
// NOT included: the encrypted videos (they live in S3 / MongoDB / uploads: back those up there)
// and the master key. Keep a copy of VP_MASTER_KEY somewhere safe: without it no video can be played.
// The file contains password hashes, so treat it like a secret.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { db, initDb, closeDb } from '../db.js';

await initDb();
const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const target = path.resolve(process.argv[2] || path.join('backups', `vidprotect-${stamp}.json`));
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(db, null, 1), { mode: 0o600 });
await closeDb();

console.log(`Backup written to ${target}`);
console.log(`  ${db.users.length} users, ${db.courses.length} courses, ${db.videos.length} videos, ${db.enrollments.length} enrolments, ${db.payments.length} payments`);
console.log('Remember to keep a safe copy of VP_MASTER_KEY too.');
