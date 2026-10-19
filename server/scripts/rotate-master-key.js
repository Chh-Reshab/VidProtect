// ============================================
// Rotate the master key.
//   1. Stop the server.
//   2. node server/scripts/rotate-master-key.js <NEW_KEY_HEX>
//      (generate one with:  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
//   3. Start the server with VP_MASTER_KEY=<NEW_KEY_HEX> (or replace server/data/master.key).
//
// Only the small wrapped data keys are re-encrypted; the video files are not
// touched. Nothing is written unless every key unwraps and re-wraps cleanly.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { db, save, DATA_DIR, initDb, closeDb } from '../db.js';
import { getMasterKey, unwrapKey, wrapKey, keyId } from '../encryption.js';
import { sealSecret, openSecret } from '../totp.js';

const next = (process.argv[2] || '').trim();
if (!/^[0-9a-fA-F]{64}$/.test(next)) {
  console.error('Usage: node server/scripts/rotate-master-key.js <64 hex characters>');
  process.exit(1);
}

await initDb(); // loads the JSON file or MongoDB, whichever is configured
const oldKey = getMasterKey();
const newKey = Buffer.from(next, 'hex');
if (oldKey.equals(newKey)) {
  console.error('The new key is the same as the current one.');
  process.exit(1);
}

const rewrapped = [];
for (const video of db.videos) {
  const enc = video.file?.enc;
  if (!enc) continue;
  const dek = unwrapKey(enc.wrappedKey, video.id, oldKey); // throws if anything is wrong
  rewrapped.push([enc, wrapKey(dek, video.id, newKey)]);
}

// Two-step verification secrets are sealed with the master key too
const resealed = [];
for (const user of db.users) {
  for (const field of ['secret', 'pending']) {
    if (user.mfa?.[field]) resealed.push([user.mfa, field, sealSecret(openSecret(user.mfa[field], oldKey), newKey)]);
  }
}

for (const [enc, wrapped] of rewrapped) {
  enc.wrappedKey = wrapped;
  enc.kid = keyId(newKey);
}
for (const [mfa, field, sealed] of resealed) mfa[field] = sealed;
save();
await closeDb(); // makes sure a MongoDB write is finished before the script exits

const keyFile = path.join(DATA_DIR, 'master.key');
if (!process.env.VP_MASTER_KEY && fs.existsSync(keyFile)) {
  fs.copyFileSync(keyFile, `${keyFile}.previous`);
  fs.writeFileSync(keyFile, `${next}\n`, { mode: 0o600 });
  console.log(`Master key file updated (old key kept at ${keyFile}.previous; delete it once you have confirmed playback).`);
} else {
  console.log('Set VP_MASTER_KEY to the new key before starting the server.');
}
console.log(`Re-wrapped ${rewrapped.length} video key(s) and ${resealed.length} two-step secret(s): ${keyId(oldKey)} -> ${keyId(newKey)}.`);
