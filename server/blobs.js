// ============================================
// BLOB STORE — where encrypted videos ("videos") and thumbnails ("thumbs") live.
//   local   : files under the uploads folder (development; survives restarts on your PC)
//   s3      : Amazon S3 (when S3_BUCKET is set), so files survive restarts on hosts with a
//             temporary disk, like Render's free plan. Takes priority over GridFS.
//   gridfs  : MongoDB GridFS (when MONGODB_URI is set but S3_BUCKET is not)
// The routes only talk to this module, so they do not care which one is active.
// Files are written to a local staging folder first, then handed to put().
// ============================================

import fs from 'node:fs';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { UPLOAD_DIR, useMongo } from './db.js';
import { gridfs, filesCollection } from './mongo.js';

const useS3 = () => Boolean(process.env.S3_BUCKET);
export const backend = () => (useS3() ? 's3' : useMongo() ? 'gridfs' : 'local');

let client;
const s3 = () => (client ||= new S3Client({ region: process.env.AWS_REGION || 'us-east-1', ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true } : {}) })); // credentials come from AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
const keyOf = (bucket, name) => `${bucket}/${name}`;
const notFound = (err) => err?.name === 'NotFound' || err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404;

const localPath = (bucket, name) => (bucket === 'thumbs' ? path.join(UPLOAD_DIR, 'thumbs', name) : path.join(UPLOAD_DIR, name));
const WINDOW = 1024 * 1024; // GridFS / S3: fetch this much at a time so playback is not one round trip per 64 KiB block

// Put a staged local file into the store, then delete the staged copy
export const put = async (bucket, name, stagedPath) => {
  if (useS3()) {
    await new Upload({ client: s3(), params: { Bucket: process.env.S3_BUCKET, Key: keyOf(bucket, name), Body: fs.createReadStream(stagedPath), ServerSideEncryption: 'AES256' } }).done();
    fs.rmSync(stagedPath, { force: true });
    return;
  }
  if (useMongo()) {
    await remove(bucket, name); // names are random, but never leave two versions behind
    await pipeline(fs.createReadStream(stagedPath), gridfs(bucket).openUploadStream(name));
    fs.rmSync(stagedPath, { force: true });
    return;
  }
  const dest = localPath(bucket, name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.renameSync(stagedPath, dest);
};

// Size in bytes, or null if it does not exist
export const size = async (bucket, name) => {
  if (useS3()) {
    try { return (await s3().send(new HeadObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyOf(bucket, name) }))).ContentLength; }
    catch (err) { if (notFound(err)) return null; throw err; }
  }
  if (useMongo()) {
    const file = await filesCollection(bucket).findOne({ filename: name }, { projection: { length: 1 } });
    return file ? file.length : null;
  }
  try { return (await fs.promises.stat(localPath(bucket, name))).size; } catch { return null; }
};

export const remove = async (bucket, name) => {
  if (useS3()) {
    await s3().send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyOf(bucket, name) }));
    return;
  }
  if (useMongo()) {
    const file = await filesCollection(bucket).findOne({ filename: name }, { projection: { _id: 1 } });
    if (file) await gridfs(bucket).delete(file._id);
    return;
  }
  fs.rmSync(localPath(bucket, name), { force: true });
};

export const names = async (bucket) => {
  if (useS3()) {
    const out = [];
    let token;
    do {
      const res = await s3().send(new ListObjectsV2Command({ Bucket: process.env.S3_BUCKET, Prefix: `${bucket}/`, ContinuationToken: token }));
      for (const o of res.Contents || []) out.push(o.Key.slice(bucket.length + 1));
      token = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (token);
    return out;
  }
  if (useMongo()) {
    const files = await filesCollection(bucket).find({}, { projection: { filename: 1 } }).toArray();
    return files.map(f => f.filename);
  }
  const dir = bucket === 'thumbs' ? path.join(UPLOAD_DIR, 'thumbs') : UPLOAD_DIR;
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isFile()).map(e => e.name);
};

// Whole-file stream (thumbnails)
export const readStream = (bucket, name) => {
  if (useS3()) {
    // Return a stream right away; it errors (and the caller 404s) if the object is missing
    const out = new PassThrough();
    s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyOf(bucket, name) }))
      .then(res => pipeline(res.Body, out))
      .catch(err => out.destroy(err));
    return out;
  }
  return useMongo() ? gridfs(bucket).openDownloadStreamByName(name) : fs.createReadStream(localPath(bucket, name));
};

// Ranged read of an S3 object: bytes [start, end) as one Buffer
const s3Range = async (bucket, name, start, end) => {
  const res = await s3().send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: keyOf(bucket, name), Range: `bytes=${start}-${end - 1}` }));
  return Buffer.from(await res.Body.transformToByteArray());
};

// Random access for the decrypting reader: { open() -> { read(buf, off, len, pos), close() } }
export const source = (bucket, name) => ({
  open: async () => {
    if (!useMongo() && !useS3()) return fs.promises.open(localPath(bucket, name), 'r');

    const length = await size(bucket, name);
    if (length === null) throw new Error('Stored file is missing.');
    let cacheStart = 0;
    let cache = Buffer.alloc(0);
    return {
      async read(buf, off, len, pos) {
        if (pos >= length) return { bytesRead: 0 };
        const want = Math.min(len, length - pos);
        if (pos < cacheStart || pos + want > cacheStart + cache.length) {
          const end = Math.min(length, pos + Math.max(WINDOW, want)); // exclusive
          if (useS3()) {
            cache = await s3Range(bucket, name, pos, end);
          } else {
            const parts = [];
            for await (const chunk of gridfs(bucket).openDownloadStreamByName(name, { start: pos, end })) parts.push(chunk);
            cache = Buffer.concat(parts);
          }
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
