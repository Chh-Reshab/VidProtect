// ============================================
// BLOB STORE — where encrypted videos ("videos"), thumbnails ("thumbs") and CVs ("cvs") live.
//   s3      : Amazon S3 (when S3_BUCKET is set), so files survive restarts on hosts with a
//             temporary disk, like Render's free plan. Takes priority over GridFS.
//   gridfs  : MongoDB GridFS (when MONGODB_URI is set but S3_BUCKET is not)
//   local   : files under the uploads folder (development)
// The routes only talk to this module, so they do not care which one is active.
// Files are written to a local staging folder first, then handed to put().
// The AWS SDK is loaded only when S3 is actually used (it is heavy to start).
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { UPLOAD_DIR, mongoEnabled } from './db.js';
import { gridfs, filesCollection } from './mongo.js';

const s3Enabled = () => Boolean(process.env.S3_BUCKET);
export const backend = () => (s3Enabled() ? 's3' : mongoEnabled() ? 'gridfs' : 'local');

const WINDOW = 1024 * 1024; // GridFS / S3: fetch this much at a time so playback is not one round trip per 64 KiB block
const localDir = (bucket) => (bucket === 'videos' ? UPLOAD_DIR : path.join(UPLOAD_DIR, bucket)); // videos sit in the uploads root; every other bucket gets its own folder
const localPath = (bucket, name) => path.join(localDir(bucket), name);
const dropStaged = (stagedPath) => fs.rmSync(stagedPath, { force: true });

// ── Amazon S3 ────────────────────────────────
let sdk; // { client, Upload, ...commands }, created on first use
const aws = () => (sdk ||= Promise.all([import('@aws-sdk/client-s3'), import('@aws-sdk/lib-storage')]).then(([s3, lib]) => ({
  ...s3,
  Upload: lib.Upload,
  // credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  client: new s3.S3Client({ region: process.env.AWS_REGION || 'us-east-1', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) }),
})));
const keyOf = (bucket, name) => ({ Bucket: process.env.S3_BUCKET, Key: `${bucket}/${name}` });
const send = async (command, input) => { const a = await aws(); return a.client.send(new a[command](input)); };
const missing = (err) => err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;

const s3 = {
  async put(bucket, name, staged) {
    const a = await aws();
    await new a.Upload({ client: a.client, params: { ...keyOf(bucket, name), Body: fs.createReadStream(staged), ServerSideEncryption: 'AES256' } }).done();
    dropStaged(staged);
  },
  async size(bucket, name) {
    try { return (await send('HeadObjectCommand', keyOf(bucket, name))).ContentLength; } catch (err) { if (missing(err)) return null; throw err; }
  },
  async remove(bucket, name) { await send('DeleteObjectCommand', keyOf(bucket, name)); },
  async names(bucket) {
    const out = [];
    let token;
    do {
      const res = await send('ListObjectsV2Command', { Bucket: process.env.S3_BUCKET, Prefix: `${bucket}/`, ContinuationToken: token });
      for (const o of res.Contents || []) out.push(o.Key.slice(bucket.length + 1));
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  },
  stream(bucket, name) {
    // Returned right away; it errors (and the caller answers 404) if the object is missing
    const out = new PassThrough();
    send('GetObjectCommand', keyOf(bucket, name)).then(res => pipeline(res.Body, out)).catch(err => out.destroy(err));
    return out;
  },
  async range(bucket, name, start, end) { // bytes [start, end)
    const res = await send('GetObjectCommand', { ...keyOf(bucket, name), Range: `bytes=${start}-${end - 1}` });
    return Buffer.from(await res.Body.transformToByteArray());
  },
};

// ── MongoDB GridFS ───────────────────────────
const file = (bucket, name, projection) => filesCollection(bucket).findOne({ filename: name }, { projection });

const mongoStore = {
  async put(bucket, name, staged) {
    await mongoStore.remove(bucket, name); // names are random, but never leave two versions behind
    await pipeline(fs.createReadStream(staged), gridfs(bucket).openUploadStream(name));
    dropStaged(staged);
  },
  async size(bucket, name) { return (await file(bucket, name, { length: 1 }))?.length ?? null; },
  async remove(bucket, name) {
    const found = await file(bucket, name, { _id: 1 });
    if (found) await gridfs(bucket).delete(found._id);
  },
  async names(bucket) { return (await filesCollection(bucket).find({}, { projection: { filename: 1 } }).toArray()).map(f => f.filename); },
  stream: (bucket, name) => gridfs(bucket).openDownloadStreamByName(name),
  async range(bucket, name, start, end) {
    const parts = [];
    for await (const chunk of gridfs(bucket).openDownloadStreamByName(name, { start, end })) parts.push(chunk);
    return Buffer.concat(parts);
  },
};

// ── Local disk ───────────────────────────────
const local = {
  async put(bucket, name, staged) {
    const dest = localPath(bucket, name);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(staged, dest);
  },
  async size(bucket, name) { try { return (await fs.promises.stat(localPath(bucket, name))).size; } catch { return null; } },
  async remove(bucket, name) { fs.rmSync(localPath(bucket, name), { force: true }); },
  async names(bucket) {
    const dir = localDir(bucket);
    return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name) : [];
  },
  stream: (bucket, name) => fs.createReadStream(localPath(bucket, name)),
  open: (bucket, name) => fs.promises.open(localPath(bucket, name), 'r'),
};

const store = () => ({ s3, gridfs: mongoStore, local })[backend()];

export const put = (bucket, name, stagedPath) => store().put(bucket, name, stagedPath); // moves/uploads the staged file, then removes it
export const size = (bucket, name) => store().size(bucket, name); // bytes, or null if it does not exist
export const remove = (bucket, name) => store().remove(bucket, name);
export const names = (bucket) => store().names(bucket);
export const readStream = (bucket, name) => store().stream(bucket, name); // whole file (thumbnails, CVs)

// Random access for the decrypting reader: { open() -> { read(buf, off, len, pos), close() } }
export const source = (bucket, name) => ({
  open: async () => {
    const b = store();
    if (b.open) return b.open(bucket, name);

    const length = await b.size(bucket, name);
    if (length === null) throw new Error('Stored file is missing.');
    let cacheStart = 0;
    let cache = Buffer.alloc(0);
    return {
      async read(buf, off, len, pos) {
        if (pos >= length) return { bytesRead: 0 };
        const want = Math.min(len, length - pos);
        if (pos < cacheStart || pos + want > cacheStart + cache.length) {
          cache = await b.range(bucket, name, pos, Math.min(length, pos + Math.max(WINDOW, want)));
          cacheStart = pos;
        }
        const from = pos - cacheStart;
        const bytes = Math.min(want, cache.length - from);
        cache.copy(buf, off, from, from + bytes);
        return { bytesRead: bytes };
      },
      async close() { cache = Buffer.alloc(0); },
    };
  },
});
