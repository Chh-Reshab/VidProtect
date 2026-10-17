// ============================================
// One-time helper: gets the Gmail refresh token the server needs to send verification emails.
//   GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... npm run gmail:token
// Open the printed link, approve sending with the Gmail account you want emails to come from,
// and the refresh token is printed here. Put it in GMAIL_REFRESH_TOKEN (never commit it).
// ============================================

import http from 'node:http';
import crypto from 'node:crypto';

const clientId = process.env.GMAIL_CLIENT_ID;
const clientSecret = process.env.GMAIL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error('Set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET first (from your Google Cloud OAuth client).');
  process.exit(1);
}

const PORT = 53682;
const redirect = `http://127.0.0.1:${PORT}`;
const state = crypto.randomBytes(16).toString('hex');
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: clientId,
  redirect_uri: redirect,
  response_type: 'code',
  scope: 'https://www.googleapis.com/auth/gmail.send',
  access_type: 'offline',
  prompt: 'consent', // makes Google return a refresh token every time
  state,
});

const server = http.createServer(async (req, res) => {
  const params = new URL(req.url, redirect).searchParams;
  if (!params.has('code') && !params.has('error')) { res.writeHead(404).end(); return; }
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  if (params.get('state') !== state) { res.end('State did not match. Start again.'); return; }
  if (params.has('error')) { res.end(`Google said: ${params.get('error')}`); console.error(`Google said: ${params.get('error')}`); server.close(); return; }
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code: params.get('code'), client_id: clientId, client_secret: clientSecret, redirect_uri: redirect, grant_type: 'authorization_code' }),
    });
    const data = await r.json();
    if (!data.refresh_token) throw new Error(data.error_description || data.error || 'Google did not return a refresh token');
    res.end('Done. You can close this tab and go back to the terminal.');
    console.log('\nYour refresh token (keep it secret):\n\n' + data.refresh_token + '\n\nSet it as GMAIL_REFRESH_TOKEN on Render.');
  } catch (err) {
    res.end(`Failed: ${err.message}`);
    console.error(`Failed: ${err.message}`);
  }
  server.close();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Open this link in your browser and approve access:\n\n' + url + '\n');
});
