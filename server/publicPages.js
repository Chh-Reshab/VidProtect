// ============================================
// Pages that must be readable without running JavaScript: the privacy policy, terms of service and
// refund policy, plus the home page's head (for site-ownership verification). Search engines and
// Google's OAuth reviewers read these.
// ============================================

import { PRIVACY_UPDATED, privacySections } from '../shared/privacy.js';
import { LEGAL_UPDATED, termsSections, refundSections, legalLinks } from '../shared/legal.js';

const escape = (text) => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Where people can reach us: CONTACT_EMAIL, else the address the service sends mail from
const contactEmail = () => process.env.CONTACT_EMAIL || process.env.MAIL_FROM || '';

const renderLegalHtml = ({ title, description, updated, sections, contactLine }) => {
  const contact = contactEmail();
  const body = sections.map(([heading, text]) => `<section><h2>${escape(heading)}</h2><p>${escape(text)}</p></section>`).join('\n');
  const nav = legalLinks.map(([label, href]) => `<a href="${href}">${escape(label)}</a>`).join(' &middot; ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)} — VidProtect AI</title>
<meta name="description" content="${escape(description)}">
<style>
body{margin:0;background:#101010;color:#a0a0a0;font:16px/1.65 Arial,Helvetica,sans-serif;padding:2rem 1rem}
main{max-width:720px;margin:0 auto}
a{color:#ff2028}
h1{color:#f8f8f8;font-size:1.8rem;margin:.5rem 0}
h2{color:#f8f8f8;font-size:1.05rem;margin:1.6rem 0 .3rem}
p{margin:.3rem 0}
.top{font-weight:bold;color:#f8f8f8;text-decoration:none}
.updated{font-size:.8rem;color:#8b8b8b}
nav{margin-top:2rem;font-size:.9rem}
</style>
</head>
<body>
<main>
<p><a class="top" href="/">VidProtect AI</a></p>
<h1>${escape(title)}</h1>
<p class="updated">VidProtect AI · Last updated ${escape(updated)}</p>
${body}
<section><h2>Contact</h2><p>${contact ? `${escape(contactLine)} <a href="mailto:${escape(contact)}">${escape(contact)}</a>.` : `${escape(contactLine)} contact the VidProtect AI team through the sign-in page.`}</p></section>
<nav>${nav}</nav>
<p style="margin-top:1rem"><a href="/">&larr; Back to VidProtect AI</a></p>
</main>
</body>
</html>
`;
};

export const renderPrivacyHtml = () => renderLegalHtml({
  title: 'Privacy Policy',
  description: 'How VidProtect AI collects, uses and protects personal information, including how it uses the Gmail API to send account emails.',
  updated: PRIVACY_UPDATED,
  sections: privacySections,
  contactLine: 'Questions or requests about your information:',
});

export const renderTermsHtml = () => renderLegalHtml({
  title: 'Terms of Service',
  description: 'The rules for using VidProtect AI as a learner, creator or admin: accounts, content, payments, content protection and refunds.',
  updated: LEGAL_UPDATED,
  sections: termsSections,
  contactLine: 'Questions about these Terms:',
});

export const renderRefundHtml = () => renderLegalHtml({
  title: 'Refund Policy',
  description: 'When and how you can get a refund for a paid course on VidProtect AI.',
  updated: LEGAL_UPDATED,
  sections: refundSections,
  contactLine: 'To ask for a refund or ask a question, email us at',
});

// The built index.html, with the Google Search Console verification tag added when it is configured
export const prepareIndexHtml = (html) => {
  const token = process.env.GOOGLE_SITE_VERIFICATION;
  return token ? html.replace('</head>', `    <meta name="google-site-verification" content="${escape(token)}" />\n  </head>`) : html;
};
