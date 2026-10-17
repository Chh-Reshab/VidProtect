// ============================================
// Account input rules, shared by the server (the real check) and the sign-up form (instant
// feedback). Each validator returns { value, error }: `value` is the cleaned input,
// `error` is a message or null.
// ============================================

export const NAME_MIN = 2;
export const NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes, so refuse longer ones instead of silently truncating

const NAME_CHARS = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’-]*$/u;
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)*\.[A-Za-z]{2,}$/;
const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', 'passw0rd', '12345678', '123456789', '1234567890', 'qwerty123',
  'qwertyuiop', 'iloveyou1', 'admin123', 'welcome1', 'letmein123', 'abc12345', 'abcd1234', '11111111', '00000000',
]);

export const validateName = (input) => {
  const value = typeof input === 'string' ? input.normalize('NFC').replace(/\s+/g, ' ').trim() : '';
  if (!value) return { value, error: 'Enter your name.' };
  if (value.length < NAME_MIN) return { value, error: `Name must be at least ${NAME_MIN} characters.` };
  if (value.length > NAME_MAX) return { value, error: `Name must be at most ${NAME_MAX} characters.` };
  if (!NAME_CHARS.test(value)) return { value, error: 'Name can contain only letters, spaces, apostrophes, hyphens and dots.' };
  return { value, error: null };
};

export const validateEmail = (input) => {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  if (!value) return { value, error: 'Enter your email address.' };
  if (value.length > EMAIL_MAX) return { value, error: 'Email address is too long.' };
  const [local = ''] = value.split('@');
  if (!EMAIL_RE.test(value) || local.length > 64 || local.startsWith('.') || local.endsWith('.') || value.includes('..')) {
    return { value, error: 'Enter a valid email address, like name@example.com.' };
  }
  return { value, error: null };
};

// `related` lets the check refuse a password that is just the person's own name or email
export const validatePassword = (input, related = {}) => {
  const value = typeof input === 'string' ? input : '';
  if (!value) return { value, error: 'Enter a password.' };
  if (value.length < PASSWORD_MIN) return { value, error: `Password must be at least ${PASSWORD_MIN} characters.` };
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return { value, error: `Password is too long (at most ${PASSWORD_MAX_BYTES} bytes).` };
  if (!value.trim()) return { value, error: 'Password cannot be only spaces.' };
  if (!/\p{L}/u.test(value) || !/\d/.test(value)) return { value, error: 'Password must include at least one letter and one number.' };
  const lower = value.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return { value, error: 'That password is too common. Choose something harder to guess.' };
  const email = typeof related.email === 'string' ? related.email.trim().toLowerCase() : '';
  const name = typeof related.name === 'string' ? related.name.trim().toLowerCase() : '';
  if ((email && (lower === email || lower === email.split('@')[0])) || (name && lower === name)) {
    return { value, error: 'Password must not be the same as your name or email.' };
  }
  return { value, error: null };
};

// Validates a whole sign-up in one go: { values, errors } where errors is {} when everything is fine
export const validateRegistration = ({ name, email, password, confirm }) => {
  const n = validateName(name);
  const e = validateEmail(email);
  const p = validatePassword(password, { name: n.value, email: e.value });
  const errors = {};
  if (n.error) errors.name = n.error;
  if (e.error) errors.email = e.error;
  if (p.error) errors.password = p.error;
  if (confirm !== undefined && !p.error && password !== confirm) errors.confirm = 'Passwords do not match.';
  return { values: { name: n.value, email: e.value, password: p.value }, errors };
};
