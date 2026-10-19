// ============================================
// Pages that must be readable without running JavaScript: the privacy policy, and the home page's
// head (for site-ownership verification). Search engines and Google's OAuth reviewers read these.
// ============================================

import { PRIVACY_UPDATED, privacySections } from '../shared/privacy.js';

const escape = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where people can reach us: CONTACT_EMAIL, else the address the service sends mail from
const contactEmail = () => process.env.CONTACT_EMAIL || process.env.MAIL_FROM || '';

export const renderPrivacyHtml = () => {
  const contact = contactEmail();
  const sections = privacySections.map(([title, body]) => `<section><h2>${escape(title)}</h2><p>${escape(body)}</p></section>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — VidProtect AI</title>
<meta name="description" content="How VidProtect AI collects, uses and protects personal information, including how it uses the Gmail API to send account emails.">
<style>
body{margin:0;background:#101010;color:#a0a0a0;font:16px/1.65 Arial,Helvetica,sans-serif;padding:2rem 1rem}
main{max-width:720px;margin:0 auto}
a{color:#ff2028}
h1{color:#f8f8f8;font-size:1.8rem;margin:.5rem 0}
h2{color:#f8f8f8;font-size:1.05rem;margin:1.6rem 0 .3rem}
p{margin:.3rem 0}
.top{font-weight:bold;color:#f8f8f8;text-decoration:none}
.updated{font-size:.8rem;color:#8b8b8b}
</style>
</head>
<body>
<main>
<p><a class="top" href="/">VidProtect AI</a></p>
<h1>Privacy Policy</h1>
<p class="updated">VidProtect AI · Last updated ${escape(PRIVACY_UPDATED)}</p>
${sections}
<section><h2>Contact</h2><p>${contact ? `Questions or requests about your information: <a href="mailto:${escape(contact)}">${escape(contact)}</a>.` : 'Questions or requests about your information: contact the VidProtect AI team through the sign-in page.'}</p></section>
<p style="margin-top:2rem"><a href="/">&larr; Back to VidProtect AI</a></p>
</main>
</body>
</html>
`;
};

// The built index.html, with the Google Search Console verification tag added when it is configured
export const prepareIndexHtml = (html) => {
  const token = process.env.GOOGLE_SITE_VERIFICATION;
  return token ? html.replace('</head>', `    <meta name="google-site-verification" content="${escape(token)}" />\n  </head>`) : html;
};
