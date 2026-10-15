// ============================================
// The seeded admin account starts with the public demo password. On a real
// deployment set ADMIN_PASSWORD and it replaces that password at every start.
// In production the server refuses to run without it.
// ============================================

import bcrypt from 'bcryptjs';
import { db, save } from './db.js';
import { revokeAllSessions } from './auth.js';

export const applyAdminPassword = () => {
  const password = process.env.ADMIN_PASSWORD;
  const isProd = process.env.NODE_ENV === 'production';

  if (!password) {
    if (isProd) throw new Error('ADMIN_PASSWORD must be set in production: the seeded admin password is public.');
    return;
  }
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  let changed = false;
  for (const admin of db.users.filter(u => u.role === 'admin')) {
    if (bcrypt.compareSync(password, admin.passwordHash)) continue;
    admin.passwordHash = bcrypt.hashSync(password, 12);
    revokeAllSessions(admin.id); // anyone signed in with the old password is signed out
    changed = true;
  }
  if (changed) {
    save();
    console.log('[admin] Admin password set from ADMIN_PASSWORD.');
  }
};
