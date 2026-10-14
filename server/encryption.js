// ============================================
// AES-256-CTR encryption for video files at rest.
//
// CTR (Counter) mode is used so that range requests can seek directly
// to any byte offset without decrypting from the start. Each 16-byte
// block has an independent keystream: to start at byte N, advance the
// counter to block floor(N/16) and consume the first N%16 keystream
// bytes. The ciphertext is the same length as the plaintext.
// ============================================

import crypto from 'node:crypto';
import fs from 'node:fs';
import { pipeline } from 'node:stream/promises';

export const BLOCK_SIZE = 16;

// Advance a 128-bit CTR counter (16-byte Buffer) by `blocks` blocks.
// Treats the buffer as a big-endian 128-bit integer.
export function advanceIV(iv, blocks) {
  if (blocks === 0) return iv;
  const MAX64 = 0xFFFFFFFFFFFFFFFFn;
  const hi = iv.readBigUInt64BE(0);
  const lo = iv.readBigUInt64BE(8);
  const b = BigInt(blocks);
  let newLo = lo + b;
  const carry = newLo > MAX64 ? 1n : 0n;
  newLo &= MAX64;
  const newHi = (hi + carry) & MAX64;
  const result = Buffer.alloc(16);
  result.writeBigUInt64BE(newHi, 0);
  result.writeBigUInt64BE(newLo, 8);
  return result;
}

// Generate a random per-video key (32 bytes) and IV (16 bytes).
export function generateVideoKey() {
  return { key: crypto.randomBytes(32), iv: crypto.randomBytes(16) };
}

// Return a CTR decipher whose keystream is already positioned at `byteOffset`.
// Feed it ciphertext starting at `byteOffset` → get plaintext starting there.
export function createRangeDecipher(keyHex, ivHex, byteOffset = 0) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const blockNum = Math.floor(byteOffset / BLOCK_SIZE);
  const blockOffset = byteOffset % BLOCK_SIZE;
  const seekedIv = blockNum > 0 ? advanceIV(iv, blockNum) : iv;
  const decipher = crypto.createDecipheriv('aes-256-ctr', key, seekedIv);
  if (blockOffset > 0) {
    // Consume partial block keystream so the next byte aligns with byteOffset
    decipher.update(Buffer.alloc(blockOffset));
  }
  return decipher;
}

// Encrypt srcPath → destPath using AES-256-CTR with the given key/iv.
// Returns a Promise that resolves when the encrypted file is fully written.
export function encryptFile(srcPath, destPath, key, iv) {
  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  return pipeline(
    fs.createReadStream(srcPath),
    cipher,
    fs.createWriteStream(destPath),
  );
}
