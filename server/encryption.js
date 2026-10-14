// ============================================
// ENCRYPTION AT REST — AES-256-GCM, chunked, with envelope keys.
//
// File format "VPE1" (all integers big-endian):
//   header, 32 bytes: magic "VPE1" | version u8 | 3 reserved | chunkSize u32
//                     | plaintextLength u64 | noncePrefix 8 bytes | 4 reserved
//   then for every chunk i:  ciphertext (chunkSize bytes, last one shorter) | 16-byte GCM tag
//
// Each chunk is its own GCM message:
//   nonce = noncePrefix (8 random bytes, unique per file) || chunkIndex u32
//   AAD   = header || chunkIndex u32 || isLastChunk u8
// so a flipped bit, a reordered chunk, a truncated file or a chunk moved from
// another file all fail authentication. Seeking decrypts only the chunks a
// byte range touches.
//
// Keys (envelope encryption):
//   - every video has its own random 256-bit data key (DEK)
//   - the DEK is stored only in wrapped form: AES-256-GCM under the master key,
//     bound to the video id so a wrapped key cannot be moved to another video
//   - the master key comes from VP_MASTER_KEY (64 hex chars) or, if unset, from
//     <data dir>/master.key (created on first run, mode 0600). Production
//     deployments should supply it from a secrets manager / KMS and back it up
//     separately: without it the videos cannot be decrypted.
// ============================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { DATA_DIR } from './db.js';

export const ALG = 'AES-256-GCM';
export const CHUNK_SIZE = 64 * 1024;
const MAGIC = Buffer.from('VPE1', 'latin1');
const HEADER_LEN = 32;
const TAG_LEN = 16;
const MAX_CHUNK = 1024 * 1024;

// ── Master key ───────────────────────────────
const KEY_FILE = path.join(DATA_DIR, 'master.key');
let masterKey = null;
let masterKeyHow = '';

const parseKey = (hex) => {
  const v = String(hex || '').trim();
  return /^[0-9a-fA-F]{64}$/.test(v) ? Buffer.from(v, 'hex') : null;
};

export const getMasterKey = () => {
  if (masterKey) return masterKey;
  const fromEnv = process.env.VP_MASTER_KEY;
  if (fromEnv) {
    masterKey = parseKey(fromEnv);
    if (!masterKey) throw new Error('VP_MASTER_KEY must be 64 hex characters (32 bytes).');
    masterKeyHow = 'environment';
    return masterKey;
  }
  if (fs.existsSync(KEY_FILE)) {
    masterKey = parseKey(fs.readFileSync(KEY_FILE, 'utf8'));
    if (!masterKey) throw new Error(`${KEY_FILE} is not a valid 64-hex-character key.`);
    masterKeyHow = 'key file';
    return masterKey;
  }
  masterKey = crypto.randomBytes(32);
  fs.writeFileSync(KEY_FILE, `${masterKey.toString('hex')}\n`, { mode: 0o600 });
  masterKeyHow = 'new key file';
  console.warn(`[encryption] Created a master key at ${KEY_FILE}. Back it up somewhere safe: videos cannot be decrypted without it.`);
  return masterKey;
};

export const masterKeySource = () => { getMasterKey(); return masterKeyHow; };

// A short, non-secret fingerprint so we know which master key wrapped a data key
export const keyId = (key = getMasterKey()) => crypto.createHash('sha256').update(key).digest('hex').slice(0, 8);

// ── Data-key wrapping ────────────────────────
const aadFor = (videoId) => Buffer.from(`vidprotect:dek:${videoId}`, 'utf8');

export const wrapKey = (dek, videoId, key = getMasterKey()) => {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(aadFor(videoId));
  const ct = Buffer.concat([c.update(dek), c.final()]);
  return `v1.${keyId(key)}.${iv.toString('hex')}.${ct.toString('hex')}.${c.getAuthTag().toString('hex')}`;
};

export const unwrapKey = (wrapped, videoId, key = getMasterKey()) => {
  const [v, kid, iv, ct, tag] = String(wrapped).split('.');
  if (v !== 'v1' || !iv || !ct || !tag) throw new Error('Malformed wrapped key.');
  if (kid !== keyId(key)) throw new Error('This key was wrapped with a different master key.');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
  d.setAAD(aadFor(videoId));
  d.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([d.update(Buffer.from(ct, 'hex')), d.final()]);
};

export const wrappedKeyId = (wrapped) => String(wrapped).split('.')[1];

export const newDataKey = () => crypto.randomBytes(32);

// ── File format helpers ──────────────────────
export const encryptedSize = (plainLen) => HEADER_LEN + plainLen + Math.ceil(plainLen / CHUNK_SIZE) * TAG_LEN;

const buildHeader = (plainLen, noncePrefix) => {
  const h = Buffer.alloc(HEADER_LEN);
  MAGIC.copy(h, 0);
  h.writeUInt8(1, 4);
  h.writeUInt32BE(CHUNK_SIZE, 8);
  h.writeBigUInt64BE(BigInt(plainLen), 12);
  noncePrefix.copy(h, 20);
  return h;
};

const parseHeader = (h) => {
  if (h.length < HEADER_LEN || !h.subarray(0, 4).equals(MAGIC) || h[4] !== 1) throw new Error('Not an encrypted VidProtect file.');
  const chunkSize = h.readUInt32BE(8);
  if (chunkSize < 1024 || chunkSize > MAX_CHUNK) throw new Error('Corrupt file header.');
  return { chunkSize, plainLen: Number(h.readBigUInt64BE(12)), noncePrefix: h.subarray(20, 28) };
};

const chunkNonce = (prefix, index) => {
  const n = Buffer.alloc(12);
  prefix.copy(n, 0);
  n.writeUInt32BE(index, 8);
  return n;
};

const chunkAad = (header, index, isLast) => {
  const tail = Buffer.alloc(5);
  tail.writeUInt32BE(index, 0);
  tail.writeUInt8(isLast ? 1 : 0, 4);
  return Buffer.concat([header, tail]);
};

const readExactly = async (fh, length, position) => {
  const buf = Buffer.alloc(length);
  let off = 0;
  while (off < length) {
    const { bytesRead } = await fh.read(buf, off, length - off, position + off);
    if (bytesRead === 0) throw new Error('Encrypted file is truncated.');
    off += bytesRead;
  }
  return buf;
};

// ── Encrypt / decrypt ────────────────────────
// Encrypt srcPath into destPath. Returns the plaintext length.
export const encryptFile = async (srcPath, destPath, dek, onProgress) => {
  const plainLen = (await fs.promises.stat(srcPath)).size;
  const noncePrefix = crypto.randomBytes(8);
  const header = buildHeader(plainLen, noncePrefix);
  const total = Math.ceil(plainLen / CHUNK_SIZE);

  const src = await fs.promises.open(srcPath, 'r');
  const dest = await fs.promises.open(destPath, 'w', 0o600);
  try {
    await dest.write(header);
    for (let i = 0; i < total; i += 1) {
      const len = Math.min(CHUNK_SIZE, plainLen - i * CHUNK_SIZE);
      const plain = await readExactly(src, len, i * CHUNK_SIZE);
      const c = crypto.createCipheriv('aes-256-gcm', dek, chunkNonce(noncePrefix, i));
      c.setAAD(chunkAad(header, i, i === total - 1));
      const out = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
      await dest.write(out);
      onProgress?.((i + 1) / total);
    }
    await dest.sync();
  } finally {
    await src.close();
    await dest.close();
  }
  return plainLen;
};

// Readable of plaintext bytes [start, end] (inclusive). Only the chunks that
// range touches are read and authenticated; a bad chunk errors the stream.
export const createDecryptStream = (filePath, dek, start, end, expectedPlainLen) => {
  async function* generate() {
    const fh = await fs.promises.open(filePath, 'r');
    try {
      const header = await readExactly(fh, HEADER_LEN, 0);
      const { chunkSize, plainLen, noncePrefix } = parseHeader(header);
      if (expectedPlainLen !== undefined && plainLen !== expectedPlainLen) throw new Error('Encrypted file does not match its record.');
      const total = Math.ceil(plainLen / chunkSize);
      const stride = chunkSize + TAG_LEN;
      const last = Math.min(end, plainLen - 1);

      for (let i = Math.floor(start / chunkSize); i <= Math.floor(last / chunkSize); i += 1) {
        const len = Math.min(chunkSize, plainLen - i * chunkSize);
        const sealed = await readExactly(fh, len + TAG_LEN, HEADER_LEN + i * stride);
        const d = crypto.createDecipheriv('aes-256-gcm', dek, chunkNonce(noncePrefix, i));
        d.setAAD(chunkAad(header, i, i === total - 1));
        d.setAuthTag(sealed.subarray(len));
        const plain = Buffer.concat([d.update(sealed.subarray(0, len)), d.final()]); // throws if tampered
        const from = Math.max(start, i * chunkSize) - i * chunkSize;
        const to = Math.min(last, i * chunkSize + len - 1) - i * chunkSize;
        yield plain.subarray(from, to + 1);
      }
    } finally {
      await fh.close();
    }
  }
  return Readable.from(generate(), { objectMode: false });
};

// Decrypt a whole file to destPath (used to verify and for key-rotation tooling)
export const decryptFileTo = async (srcPath, destPath, dek, expectedPlainLen) => {
  const out = fs.createWriteStream(destPath, { mode: 0o600 });
  const stream = createDecryptStream(srcPath, dek, 0, Number.MAX_SAFE_INTEGER, expectedPlainLen);
  await new Promise((resolve, reject) => {
    stream.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    stream.pipe(out);
  });
};
