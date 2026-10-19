import { suite } from './helpers.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

suite('encryption file format and key wrapping (unit)', async ({ ok }) => {
  // Unit tests for server/encryption.js (uses a throwaway data dir, never the real one)

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-enc-'));
  process.env.VP_DATA_DIR = path.join(tmp, 'data');
  process.env.VP_UPLOAD_DIR = path.join(tmp, 'uploads');
  process.env.VP_MASTER_KEY = crypto.randomBytes(32).toString('hex');

  const enc = await import('../server/encryption.js');

  const collect = async (s) => { const parts = []; for await (const c of s) parts.push(c); return Buffer.concat(parts); };
  const rejects = async (fn) => { try { await fn(); return false; } catch { return true; } };

  // 5 chunks + a partial one
  const plain = crypto.randomBytes(enc.CHUNK_SIZE * 5 + 12345);
  const src = path.join(tmp, 'plain.bin'), out = path.join(tmp, 'out.vpe');
  fs.writeFileSync(src, plain);
  const dek = enc.newDataKey();
  const len = await enc.encryptFile(src, out, dek);
  const file = fs.readFileSync(out);

  ok('reported plaintext length', len === plain.length);
  ok('encrypted size matches the format', file.length === enc.encryptedSize(plain.length), `${file.length} vs ${enc.encryptedSize(plain.length)}`);
  ok('file starts with the VPE1 magic', file.subarray(0, 4).toString() === 'VPE1');
  ok('plaintext does not appear in the file', file.indexOf(plain.subarray(1000, 1064)) === -1);
  ok('encrypting twice gives different output', !fs.readFileSync(out).equals((await (async () => { const o2 = path.join(tmp, 'o2.vpe'); await enc.encryptFile(src, o2, dek); return fs.readFileSync(o2); })())));

  const full = await collect(enc.createDecryptStream(out, dek, 0, plain.length - 1, plain.length));
  ok('full round trip is identical', full.equals(plain));

  for (const [s, e] of [[0, 0], [5, 40], [65535, 65536], [65536, 65536 * 2 - 1], [100000, 250000], [plain.length - 1, plain.length - 1], [plain.length - 100, plain.length + 500]]) {
    const got = await collect(enc.createDecryptStream(out, dek, s, e, plain.length));
    ok(`range ${s}-${e}`, got.equals(plain.subarray(s, Math.min(e, plain.length - 1) + 1)));
  }

  // ── attacks
  const tampered = async (mutate, label) => {
    const p = path.join(tmp, `t-${label}.vpe`);
    const b = Buffer.from(file); mutate(b); fs.writeFileSync(p, b);
    return rejects(() => collect(enc.createDecryptStream(p, dek, 0, plain.length - 1, plain.length)));
  };
  ok('flipped ciphertext bit is detected', await tampered(b => { b[32 + 70000] ^= 1; }, 'ct'));
  ok('flipped auth tag is detected', await tampered(b => { b[32 + enc.CHUNK_SIZE + 3] ^= 1; }, 'tag'));
  ok('modified header is detected', await tampered(b => { b[20] ^= 1; }, 'hdr'));
  ok('truncated file is detected', await tampered(_b => { /* handled below */ }, 'noop') === false);
  fs.writeFileSync(path.join(tmp, 'trunc.vpe'), file.subarray(0, file.length - 5000));
  ok('truncated file is rejected', await rejects(() => collect(enc.createDecryptStream(path.join(tmp, 'trunc.vpe'), dek, 0, plain.length - 1, plain.length))));
  { // drop the whole final chunk but keep the header (length mismatch / last-chunk flag)
    const stride = enc.CHUNK_SIZE + 16;
    fs.writeFileSync(path.join(tmp, 'drop.vpe'), file.subarray(0, 32 + stride * 5));
    ok('dropped final chunk is rejected', await rejects(() => collect(enc.createDecryptStream(path.join(tmp, 'drop.vpe'), dek, 0, plain.length - 1, plain.length))));
  }
  { // swap two chunks
    const stride = enc.CHUNK_SIZE + 16; const b = Buffer.from(file);
    file.subarray(32, 32 + stride).copy(b, 32 + stride); file.subarray(32 + stride, 32 + 2 * stride).copy(b, 32);
    fs.writeFileSync(path.join(tmp, 'swap.vpe'), b);
    ok('reordered chunks are rejected', await rejects(() => collect(enc.createDecryptStream(path.join(tmp, 'swap.vpe'), dek, 0, plain.length - 1, plain.length))));
  }
  ok('wrong key is rejected', await rejects(() => collect(enc.createDecryptStream(out, enc.newDataKey(), 0, 100, plain.length))));
  ok('wrong expected length is rejected', await rejects(() => collect(enc.createDecryptStream(out, dek, 0, 100, plain.length + 1))));
  fs.writeFileSync(path.join(tmp, 'junk.vpe'), crypto.randomBytes(500));
  ok('non-VPE file is rejected', await rejects(() => collect(enc.createDecryptStream(path.join(tmp, 'junk.vpe'), dek, 0, 100))));

  // ── envelope keys
  const wrapped = enc.wrapKey(dek, 'vid-1');
  ok('wrapped key does not contain the raw key', !wrapped.includes(dek.toString('hex')));
  ok('unwrap returns the key', enc.unwrapKey(wrapped, 'vid-1').equals(dek));
  ok('wrapped key is bound to its video id', await rejects(() => enc.unwrapKey(wrapped, 'vid-2')));
  ok('tampered wrapped key is rejected', await rejects(() => { const p = wrapped.split('.'); p[3] = (p[3][0] === 'a' ? 'b' : 'a') + p[3].slice(1); return enc.unwrapKey(p.join('.'), 'vid-1'); }));
  const otherMaster = crypto.randomBytes(32);
  ok('different master key cannot unwrap', await rejects(() => enc.unwrapKey(wrapped, 'vid-1', otherMaster)));
  const rewrapped = enc.wrapKey(enc.unwrapKey(wrapped, 'vid-1'), 'vid-1', otherMaster);
  ok('rotation: re-wrapped key unwraps under the new master', enc.unwrapKey(rewrapped, 'vid-1', otherMaster).equals(dek));

  fs.rmSync(tmp, { recursive: true, force: true });
});
