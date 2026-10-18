// Small helpers shared by several routes
import crypto from 'node:crypto';

// Trimmed, length-capped string ('' when the value is not a string)
export const clean = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export const sha256 = (text) => crypto.createHash('sha256').update(text).digest('hex');
