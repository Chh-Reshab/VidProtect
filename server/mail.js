// ============================================
// Outgoing email (account verification). Two free providers, both over HTTPS so they work on
// hosts that block SMTP ports, like Render's free plan:
//   Gmail API : sends from your own Gmail address (signed by Google, so it is not marked as spam).
//               GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, MAIL_FROM
//   Brevo     : BREVO_API_KEY, MAIL_FROM (an address verified in Brevo)
// Gmail is used when both are set. With neither, nothing is sent: verification stays off (or, with
// REQUIRE_EMAIL_VERIFICATION=true for local testing, the link is printed in the server log).
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

const verificationContent = ({ name, link }) => ({
  subject: 'Verify your email for VidProtect AI',
  text: `Hi ${name},\n\nConfirm your email address to finish creating your VidProtect AI account:\n${link}\n\nThis link works for 24 hours. If you did not sign up, you can ignore this message.`,
  html: `<div style="font-family:Arial,sans-serif;max-width:480px"><h2>Verify your email</h2><p>Hi ${escapeHtml(name)},</p><p>Confirm your email address to finish creating your VidProtect AI account.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;background:#FF2028;color:#fff;padding:12px 20px;text-decoration:none;font-weight:bold">Verify email</a></p><p style="color:#666;font-size:13px">Or paste this link into your browser:<br>${escapeHtml(link)}</p><p style="color:#666;font-size:13px">The link works for 24 hours. If you did not sign up, ignore this message.</p></div>`,
});

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

export const sendVerificationEmail = async ({ to, name, link }) => {
  if (!mailConfigured()) {
    console.log(`[mail] (not sent, no mail provider configured) verification link for ${to}: ${link}`);
    return;
  }
  const message = { to, name, ...verificationContent({ name, link }) };
  if (gmailConfigured()) await sendViaGmail(message);
  else await sendViaBrevo(message);
};
