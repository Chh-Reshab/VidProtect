// ============================================
// Accounts at start-up.
//   ensureAdmin()     creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD (and keeps its
//                     password in step with the variable). There are no built-in accounts or
//                     passwords: in production both variables are required.
//   removeDemoData()  deletes the old built-in beta accounts (*.demo, which shared a public
//                     password) and the sample courses, videos and activity that belonged to them.
//                     Real people's accounts are never touched.
// ============================================

import path from 'node:path';
import bcrypt from 'bcryptjs';
import { db, save, uid } from './db.js';
import * as blobs from './blobs.js';
import { revokeAllSessions } from './auth.js';
import { validateEmail } from '../shared/validation.js';

const isProd = () => process.env.NODE_ENV === 'production';
// Development convenience: used ONLY outside production, when ADMIN_EMAIL / ADMIN_PASSWORD are not set.
// Production never uses them: it requires its own ADMIN_EMAIL and ADMIN_PASSWORD (the code is public).
const LOCAL_ADMIN_EMAIL = 'admin@vidprotect.local';
const LOCAL_ADMIN_PASSWORD = 'VidProtect@Admin1';

// The built-in beta accounts were e-mailed on *.demo addresses with ids like admin-001 / creator-001 / stu-001.
// Both must match, so nobody who signed up normally is ever caught by this.
const isDemoAccount = (u) => /\.demo$/i.test(u.email || '') && /^(admin|creator|stu)-\d+$/.test(u.id || '');

export const ensureAdmin = () => {
  const rawEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (isProd()) {
    if (!rawEmail) throw new Error('ADMIN_EMAIL must be set in production: it is the email address of the admin account.');
    if (!password) throw new Error('ADMIN_PASSWORD must be set in production: it is the admin account\'s password.');
  }
  if (password && password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  let email;
  if (rawEmail) {
    const checked = validateEmail(rawEmail);
    if (checked.error) throw new Error(`ADMIN_EMAIL is not a valid email address (${checked.error})`);
    email = checked.value;
  } else if (db.users.some(u => u.role === 'admin' && !isDemoAccount(u))) {
    return; // development machine that already has a real admin
  } else {
    email = LOCAL_ADMIN_EMAIL;
  }

  const existing = db.users.find(u => (u.email || '').toLowerCase() === email);
  if (existing && existing.role !== 'admin') throw new Error(`ADMIN_EMAIL (${email}) belongs to an account that is not an admin. Use a different address.`);

  if (!existing) {
    const usingDefault = !password;
    const chosen = password || LOCAL_ADMIN_PASSWORD;
    db.users.push({
      id: uid('usr'),
      name: (process.env.ADMIN_NAME || 'Platform Admin').trim().slice(0, 60),
      email,
      role: 'admin',
      status: 'active',
      passwordHash: bcrypt.hashSync(chosen, 12),
      joinDate: new Date().toISOString().slice(0, 10),
    });
    save();
    console.log(`[admin] Created the admin account ${email}.${usingDefault ? ' (local development default; set ADMIN_EMAIL and ADMIN_PASSWORD to choose your own)' : ''}`);
    return;
  }

  if (password && !bcrypt.compareSync(password, existing.passwordHash)) {
    existing.passwordHash = bcrypt.hashSync(password, 12);
    revokeAllSessions(existing.id); // anyone signed in with the old password is signed out
    save();
    console.log('[admin] Admin password set from ADMIN_PASSWORD.');
  }
};

export const removeDemoData = async () => {
  const demoIds = new Set(db.users.filter(isDemoAccount).map(u => u.id));
  if (!demoIds.size) return;
  // Never leave the platform without an admin
  if (!db.users.some(u => u.role === 'admin' && !demoIds.has(u.id))) {
    console.warn('[demo] Built-in accounts were kept because there is no other admin. Set ADMIN_EMAIL and ADMIN_PASSWORD.');
    return;
  }

  const courseIds = new Set(db.courses.filter(c => demoIds.has(c.creatorId)).map(c => c.id));
  const gone = db.videos.filter(v => demoIds.has(v.creatorId) || courseIds.has(v.courseId));
  const videoIds = new Set(gone.map(v => v.id));

  db.users = db.users.filter(u => !demoIds.has(u.id));
  db.courses = db.courses.filter(c => !courseIds.has(c.id));
  db.videos = db.videos.filter(v => !videoIds.has(v.id));
  db.enrollments = db.enrollments.filter(e => !demoIds.has(e.studentId) && !courseIds.has(e.courseId));
  db.payments = db.payments.filter(p => !demoIds.has(p.userId) && !courseIds.has(p.courseId));
  db.logs = db.logs.filter(l => !demoIds.has(l.userId) && !videoIds.has(l.videoId) && !courseIds.has(l.courseId));
  db.alerts = db.alerts.filter(a => !demoIds.has(a.userId) && !videoIds.has(a.videoId));
  db.audit = db.audit.filter(a => !demoIds.has(a.actorId));
  db.sessions = db.sessions.filter(s => !demoIds.has(s.userId));
  db.streamSessions = db.streamSessions.filter(s => !demoIds.has(s.userId) && !videoIds.has(s.videoId));
  for (const map of [db.progress, db.settings, db.activity]) for (const id of demoIds) delete map[id];
  for (const perUser of Object.values(db.progress)) for (const id of videoIds) delete perUser[id];
  save();

  // Stored files that belonged to the removed videos / courses
  for (const v of gone) {
    if (v.file?.name) await blobs.remove('videos', v.file.name).catch(() => {});
    if (v.thumbUrl) await blobs.remove('thumbs', path.basename(v.thumbUrl)).catch(() => {});
  }
  console.log(`[demo] Removed ${demoIds.size} built-in beta account(s) and ${courseIds.size} sample course(s).`);
};
