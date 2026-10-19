// ============================================
// Account input rules, shared by the server (the real check) and the sign-up form (instant
// feedback). Each validator returns { value, error }: `value` is the cleaned input,
// `error` is a message or null.
// ============================================

const NAME_MIN = 2;
export const NAME_MAX = 60;
export const EMAIL_MAX = 254;
export const PASSWORD_MIN = 8;
const PASSWORD_MAX_BYTES = 72; // bcrypt ignores everything past 72 bytes, so refuse longer ones instead of silently truncating

// Anything that is not a letter, a digit or whitespace counts as a special character
export const SPECIAL_CHAR = /[^\p{L}\p{N}\s]/u;
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
  if (!SPECIAL_CHAR.test(value)) return { value, error: 'Password must include at least one special character, like ! @ # $ % & * ?' };
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

// ============================================
// Creator application rules (shared by the server and the application form)
// ============================================

export const APP_HISTORY_MIN = 100;
export const APP_HISTORY_MAX = 2000;
export const APP_TOPICS_MAX = 200;
export const PLATFORMS = ['YouTube', 'Udemy', 'Coursera', 'Skillshare', 'Teachable', 'Other'];
export const CV_MAX_BYTES = 5 * 1024 * 1024;
export const CV_EXTENSIONS = ['.pdf', '.doc', '.docx'];

const cleanText = (input, max) => (typeof input === 'string' ? input.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max + 1) : '');

// Only http(s) links with a real host and no embedded credentials
const validateUrl = (input, { host } = {}) => {
  const value = typeof input === 'string' ? input.trim() : '';
  if (!value) return { value, error: 'Enter a link.' };
  if (value.length > 300) return { value, error: 'That link is too long.' };
  let url;
  try { url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`); } catch { return { value, error: 'Enter a valid link, like https://example.com/you.' }; }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname.includes('.') || url.username || url.password) {
    return { value, error: 'Enter a valid link, like https://example.com/you.' };
  }
  if (host && !(url.hostname === host || url.hostname.endsWith(`.${host}`))) return { value, error: `Enter a link on ${host}.` };
  return { value: url.href, error: null };
};

const LINKEDIN_PATH = /^\/(in|pub|company|school)\/[^/]+/i;

// `hasCv` says whether a CV file is (or already was) attached
export const validateCreatorApplication = (input, { hasCv = false } = {}) => {
  const errors = {};
  const name = validateName(input.displayName);
  if (name.error) errors.displayName = name.error;

  const teachingHistory = cleanText(input.teachingHistory, APP_HISTORY_MAX);
  if (teachingHistory.length < APP_HISTORY_MIN) errors.teachingHistory = `Describe your teaching history in at least ${APP_HISTORY_MIN} characters.`;
  else if (teachingHistory.length > APP_HISTORY_MAX) errors.teachingHistory = `Keep your teaching history under ${APP_HISTORY_MAX} characters.`;

  const topics = cleanText(input.topics, APP_TOPICS_MAX).replace(/\n/g, ' ');
  if (topics.length < 2) errors.topics = 'Say what you want to teach.';
  else if (topics.length > APP_TOPICS_MAX) errors.topics = `Keep the topics under ${APP_TOPICS_MAX} characters.`;

  const years = Number(input.yearsExperience);
  if (String(input.yearsExperience ?? '').trim() === '' || !Number.isInteger(years) || years < 0 || years > 60) errors.yearsExperience = 'Enter your years of teaching experience (0 to 60).';

  let linkedinUrl = '';
  if (typeof input.linkedinUrl === 'string' && input.linkedinUrl.trim()) {
    const u = validateUrl(input.linkedinUrl, { host: 'linkedin.com' });
    if (u.error) errors.linkedinUrl = u.error;
    else if (!LINKEDIN_PATH.test(new URL(u.value).pathname)) errors.linkedinUrl = 'Use your profile link, like https://www.linkedin.com/in/your-name.';
    else linkedinUrl = u.value;
  }
  if (!hasCv && !linkedinUrl && !errors.linkedinUrl) errors.credentials = 'Upload your CV or add your LinkedIn profile.';

  const teachesElsewhere = input.teachesElsewhere === true || input.teachesElsewhere === 'true';
  let otherPlatform = null;
  if (teachesElsewhere) {
    const platform = typeof input.platform === 'string' ? input.platform.trim() : '';
    const platformName = cleanText(input.platformName, 40).replace(/\n/g, ' ');
    const pe = {};
    if (!PLATFORMS.includes(platform)) pe.platform = 'Choose the platform where you teach.';
    if (platform === 'Other' && platformName.length < 2) pe.platformName = 'Enter the name of the platform.';
    const link = validateUrl(input.platformUrl);
    if (link.error) pe.platformUrl = 'Enter the link to your channel or profile there.';
    let audience = null;
    if (String(input.audienceSize ?? '').trim() !== '') {
      audience = Number(input.audienceSize);
      if (!Number.isInteger(audience) || audience < 0 || audience > 1e9) pe.audienceSize = 'Enter a whole number, or leave it empty.';
    }
    if (Object.keys(pe).length) Object.assign(errors, pe);
    else otherPlatform = { platform, platformName: platform === 'Other' ? platformName : '', platformUrl: link.value, audienceSize: audience };
  }

  if (!(input.confirm === true || input.confirm === 'true')) errors.confirm = 'Please confirm that your information is accurate.';

  return {
    errors,
    values: { displayName: name.value, teachingHistory, topics, yearsExperience: years, linkedinUrl, teachesElsewhere, otherPlatform },
  };
};

// ============================================
// Creator public profile (what learners see before they enrol)
// ============================================

export const PROFILE_HEADLINE_MAX = 100;
export const PROFILE_BIO_MAX = 1000;
export const ACHIEVEMENT_MIN = 3;
export const ACHIEVEMENT_MAX = 100;
export const ACHIEVEMENTS_LIMIT = 8;

export const validateCreatorProfile = (input = {}) => {
  const errors = {};
  const headline = cleanText(input.headline, PROFILE_HEADLINE_MAX).replace(/\n/g, ' ');
  if (headline.length > PROFILE_HEADLINE_MAX) errors.headline = `Keep the headline under ${PROFILE_HEADLINE_MAX} characters.`;
  const bio = cleanText(input.bio, PROFILE_BIO_MAX);
  if (bio.length > PROFILE_BIO_MAX) errors.bio = `Keep the bio under ${PROFILE_BIO_MAX} characters.`;

  let website = '';
  if (typeof input.website === 'string' && input.website.trim()) {
    const u = validateUrl(input.website);
    if (u.error) errors.website = u.error; else website = u.value;
  }

  const list = Array.isArray(input.achievements) ? input.achievements : [];
  const achievements = list.map(a => cleanText(a, ACHIEVEMENT_MAX).replace(/\n/g, ' ')).filter(Boolean);
  if (list.length > ACHIEVEMENTS_LIMIT || achievements.length > ACHIEVEMENTS_LIMIT) errors.achievements = `Add at most ${ACHIEVEMENTS_LIMIT} achievements.`;
  else if (achievements.some(a => a.length < ACHIEVEMENT_MIN || a.length > ACHIEVEMENT_MAX)) errors.achievements = `Each achievement must be ${ACHIEVEMENT_MIN} to ${ACHIEVEMENT_MAX} characters.`;

  return {
    errors,
    values: {
      headline, bio, website, achievements,
      showExperience: input.showExperience !== false && input.showExperience !== 'false',
      showLinks: input.showLinks === true || input.showLinks === 'true',
    },
  };
};
