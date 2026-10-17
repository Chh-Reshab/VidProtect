// ============================================
// Copy your local data into MongoDB (one time).
//   MONGODB_URI="mongodb+srv://..." npm run migrate:mongo
// With S3_BUCKET (+ AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) set, videos and
// thumbnails go to S3 instead of GridFS.
// Reads server/data/db.json and the encrypted videos and thumbnails under server/uploads,
// and writes them to MongoDB collections and GridFS. Your local files are left untouched.
// Refuses to run if the MongoDB database already has data.
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import * as mongo from '../mongo.js';
import * as blobs from '../blobs.js';
import { DATA_DIR, UPLOAD_DIR } from '../db.js';

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('Set MONGODB_URI first, for example:\n  MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/vidprotect" npm run migrate:mongo');
  process.exit(1);
}

const file = path.join(DATA_DIR, 'db.json');
if (!fs.existsSync(file)) {
  console.error(`No local data found at ${file}. Nothing to migrate.`);
  process.exit(1);
}
const state = JSON.parse(fs.readFileSync(file, 'utf8'));
state.activity ||= {};
state.payments ||= [];
state.meta ||= {};

await mongo.connect(uri, process.env.MONGODB_DB);
if (await mongo.loadState()) {
  console.error('That MongoDB database already contains VidProtect data. Use an empty database (or a different name) so nothing is overwritten.');
  await mongo.close();
  process.exit(1);
}

const upload = async (bucket, name, localFile) => {
  if (!fs.existsSync(localFile)) { console.warn(`  skipped ${bucket}/${name}: file not found on disk`); return false; }
  if (blobs.backend() === 's3') {
    const staged = `${localFile}.upload`; // put() deletes its source, so hand it a copy
    fs.copyFileSync(localFile, staged);
    await blobs.put(bucket, name, staged);
  } else {
    await pipeline(fs.createReadStream(localFile), mongo.gridfs(bucket).openUploadStream(name));
  }
  return true;
};

let videos = 0;
let thumbs = 0;
for (const v of state.videos) {
  if (v.file?.name && await upload('videos', v.file.name, path.join(UPLOAD_DIR, v.file.name))) videos += 1;
  if (v.thumbUrl) { const n = path.basename(v.thumbUrl); if (await upload('thumbs', n, path.join(UPLOAD_DIR, 'thumbs', n))) thumbs += 1; }
}
for (const c of state.courses) {
  if (c.thumbUrl) { const n = path.basename(c.thumbUrl); if (await upload('thumbs', n, path.join(UPLOAD_DIR, 'thumbs', n))) thumbs += 1; }
}

await mongo.persistState(state);
await mongo.close();
console.log(`Done. Copied the data (${state.users.length} users, ${state.courses.length} courses, ${state.videos.length} videos), ${videos} encrypted video file(s) and ${thumbs} thumbnail(s).`);
console.log('Use the SAME VP_MASTER_KEY as before, or the copied videos cannot be decrypted.');
