// ============================================
// Outgoing email (verification, password reset, creator decisions). Two free providers, both over HTTPS so they work on
// hosts that block SMTP ports, like Render's free plan:
//   Gmail API : sends from your own Gmail address (signed by Google, so it is not marked as spam).
//               GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, MAIL_FROM
//   Brevo     : BREVO_API_KEY, MAIL_FROM (an address verified in Brevo)
// Gmail is used when both are set. With neither, nothing is sent: verification stays off (or, with
// REQUIRE_EMAIL_VERIFICATION=true for local testing, the links are printed in the server log).
// ============================================

const gmailConfigured = () => Boolean(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN && process.env.MAIL_FROM);
const brevoConfigured = () => Boolean(process.env.BREVO_API_KEY && process.env.MAIL_FROM);

export const mailConfigured = () => gmailConfigured() || brevoConfigured();
export const verificationRequired = () => mailConfigured() || process.env.REQUIRE_EMAIL_VERIFICATION === 'true';

// Public address of the site, used to build links in emails
export const appUrl = (req) => (
  process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || req.get('origin') || `${req.protocol}://${req.get('host')}`
).replace(/\/+$/, '');

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const senderName = () => process.env.MAIL_FROM_NAME || 'VidProtect AI';
// Header values must never contain line breaks (header injection)
const oneLine = (text) => String(text).replace(/[\r\n]+/g, ' ').trim();

// One look for every message: a heading, some paragraphs, an optional button, and a small footer
const layout = ({ heading, paragraphs, button, link, footer }) => ({
  text: [...paragraphs, link ? `${button}: ${link}` : '', footer].filter(Boolean).join('\n\n'),
  html: `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>${escapeHtml(heading)}</h2>${paragraphs.map(p => `<p>${escapeHtml(p)}</p>`).join('')}${link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;background:#FF2028;color:#fff;padding:12px 20px;text-decoration:none;font-weight:bold">${escapeHtml(button)}</a></p><p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(link)}</p>` : ''}${footer ? `<p style="color:#666;font-size:13px">${escapeHtml(footer)}</p>` : ''}</div>`,
});

const messages = {
  verification: ({ name, link }) => ({
    subject: 'Verify your email for VidProtect AI',
    ...layout({ heading: 'Verify your email', paragraphs: [`Hi ${name},`, 'Confirm your email address to finish creating your VidProtect AI account.'], button: 'Verify email', link, footer: 'The link works for 24 hours. If you did not sign up, ignore this message.' }),
  }),
  'password reset': ({ name, link }) => ({
    subject: 'Reset your VidProtect AI password',
    ...layout({ heading: 'Reset your password', paragraphs: [`Hi ${name},`, 'We received a request to reset the password of your VidProtect AI account.'], button: 'Choose a new password', link, footer: 'The link works for 1 hour and only once. If you did not ask for this, ignore this message: your password has not changed.' }),
  }),
  'capture warning': ({ name, videoTitle, count, blocked }) => ({
    subject: blocked ? 'Your VidProtect AI account was suspended' : 'Warning: screenshots and recordings are not allowed',
    ...layout({
      heading: blocked ? 'Account suspended' : 'A warning about screen capture',
      paragraphs: [
        `Hi ${name},`,
        `While you were watching "${videoTitle}" we noticed what looks like an attempt to take a screenshot or a recording (attempt ${count}).`,
        blocked
          ? 'Because this kept happening, your account has been suspended. Contact support if you think this is a mistake.'
          : 'Taking or sharing copies of creators\' videos is against the terms of use. If it happens again, the creator is told and your access can be restricted or your account suspended.',
        'If this was a mistake, for example a key pressed by accident, you do not need to do anything.',
      ],
    }),
  }),
  'capture alert': ({ name, link, learnerName, videoTitle, count }) => ({
    subject: `Possible screen capture on "${videoTitle}"`,
    ...layout({
      heading: 'Possible screen capture',
      paragraphs: [
        `Hi ${name},`,
        `${learnerName} triggered a possible screenshot or recording attempt while watching "${videoTitle}". This is their attempt number ${count}.`,
        'This is a warning sign, not proof: it is based on keyboard shortcuts and can be a false alarm. Review it before acting.',
      ],
      button: 'Review in your alerts',
      link,
    }),
  }),
  'creator decision': ({ name, link, approved, note }) => (approved
    ? {
      subject: 'Your VidProtect AI creator application was approved',
      ...layout({ heading: 'You are approved', paragraphs: [`Hi ${name},`, 'Good news: your creator application has been approved and your studio is now open.'], button: 'Open your studio', link }),
    }
    : {
      subject: 'Update on your VidProtect AI creator application',
      ...layout({ heading: 'Your application needs changes', paragraphs: [`Hi ${name},`, 'We could not approve your creator application yet.', note ? `Reviewer note: ${note}` : '', 'You can update your details and apply again.'].filter(Boolean), button: 'Update your application', link }),
    }),
};

// ── Gmail API ────────────────────────────────
let gmailToken = { value: null, expires: 0 };
const gmailAccessToken = async () => {
  if (gmailToken.value && Date.now() < gmailToken.expires - 60_000) return gmailToken.value;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GMAIL_CLIENT_ID,
      client_secret: process.env.GMAIL_CLIENT_SECRET,
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(`Google sign-in failed (${res.status}: ${data.error_description || data.error || 'unknown'})`);
  gmailToken = { value: data.access_token, expires: Date.now() + (data.expires_in || 3600) * 1000 };
  return gmailToken.value;
};

const b64 = (text) => Buffer.from(text, 'utf8').toString('base64');
const wrap76 = (text) => text.replace(/(.{76})/g, '$1\r\n');

// Builds the raw RFC 2822 message Gmail expects: UTF-8 subject/name, plain text + HTML alternatives
const buildRawMessage = ({ from, fromName, to, toName, subject, text, html }) => {
  const boundary = `vp_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const lines = [
    `From: =?UTF-8?B?${b64(oneLine(fromName))}?= <${oneLine(from)}>`,
    `To: =?UTF-8?B?${b64(oneLine(toName))}?= <${oneLine(to)}>`,
    `Subject: =?UTF-8?B?${b64(oneLine(subject))}?=`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    `--${boundary}--`,
    '',
  ];
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64url');
};

const sendViaGmail = async ({ to, name, subject, text, html }) => {
  const raw = buildRawMessage({ from: process.env.MAIL_FROM, fromName: senderName(), to, toName: name, subject, text, html });
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${await gmailAccessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify({ raw }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Gmail responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

// ── Brevo ────────────────────────────────────
const sendViaBrevo = async ({ to, name, subject, text, html }) => {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({ sender: { email: process.env.MAIL_FROM, name: senderName() }, to: [{ email: to, name }], subject, textContent: text, htmlContent: html }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Brevo responded ${res.status}: ${(await res.text()).slice(0, 200)}`);
};

// Sends one of the messages above. Without a provider the link is printed in the server log instead.
const deliver = async (kind, { to, name, link, ...rest }) => {
  if (!mailConfigured()) {
    console.log(`[mail] (not sent, no mail provider configured) ${kind} link for ${to}: ${link}`);
    return;
  }
  const message = { to, name, ...messages[kind]({ name, link, ...rest }) };
  if (gmailConfigured()) await sendViaGmail(message);
  else await sendViaBrevo(message);
};

// In production a real provider is needed; on a developer machine the links go to the console
export const emailAvailable = () => mailConfigured() || process.env.NODE_ENV !== 'production';

export const sendVerificationEmail = (to) => deliver('verification', to);
export const sendPasswordResetEmail = (to) => deliver('password reset', to);
export const sendCaptureWarningEmail = (to) => deliver('capture warning', to); // { to, name, link, videoTitle, count, blocked }
export const sendCaptureAlertEmail = (to) => deliver('capture alert', to); // { to, name, link, learnerName, videoTitle, count }
export const sendCreatorDecisionEmail = (to) => deliver('creator decision', to); // { to, name, link, approved, note }
