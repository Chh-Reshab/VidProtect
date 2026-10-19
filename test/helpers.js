// ============================================
// Test helpers: start the real server on a free port with a throw-away data folder,
// talk to it over HTTP, and report results as node:test subtests.
// ============================================

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFixture } from './fixtures/build.js';

const ROOT = path.resolve(import.meta.dirname, '..');

// A fresh password for every run (meets the app's rules), shared by all fixture accounts
export const PW = `Pw!${crypto.randomBytes(6).toString('hex')}9`;
export const ADMIN_EMAIL = 'admin@vidprotect.test';
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// The server only streams video to requests that look like a <video> element; act like one
const realFetch = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => (String(url).includes('/stream?s=')
  ? realFetch(url, { ...opts, headers: { ...(opts.headers || {}), 'sec-fetch-dest': 'video' } })
  : realFetch(url, opts));

const freePort = () => new Promise((resolve, reject) => {
  const srv = net.createServer();
  srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
  srv.on('error', reject);
});

// options.fixture: load the sample accounts/courses/videos (default true)
// options.env: extra environment for the server; options.dir: reuse a data folder (restarts)
// options.expectExit: the server is expected to refuse to start; resolves { failed: true, log } (a string)
export const startServer = async (options = {}) => {
  const { fixture = true, env = {}, expectExit = false, dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vp-test-')) } = options;
  const dataDir = path.join(dir, 'data');
  if (fixture && !fs.existsSync(path.join(dataDir, 'db.json'))) {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, 'db.json'), JSON.stringify(buildFixture(PW)));
  }
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'test',
      VP_DATA_DIR: dataDir, VP_UPLOAD_DIR: path.join(dir, 'uploads'), API_PORT: String(port),
      VP_MASTER_KEY: 'a'.repeat(64), VP_MIN_STAGE_MS: '0',
      AUTH_RATE_LIMIT: '100000', APPLICATION_RATE_LIMIT: '100000',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', d => { log += d; });
  child.stderr.on('data', d => { log += d; });
  const exited = new Promise(resolve => child.once('exit', resolve));
  for (let i = 0; i < 120; i += 1) {
    try { if ((await realFetch(`${base}/api/health`)).ok) break; } catch { /* not up yet */ }
    if (child.exitCode !== null) {
      if (expectExit) return { failed: true, log };
      throw new Error(`server exited: ${log}`);
    }
    await sleep(100);
  }
  if (expectExit) { child.kill(); await exited; return { failed: false, log }; } // it started although it should not have
  return {
    base, dir, dataDir, port,
    log: () => log,
    stop: async () => { if (child.exitCode === null) { child.kill(); await exited; } },
    // restart on the same data folder (a hard kill: only data already written survives)
    restart: async (more = {}) => { await (async () => { child.kill(); await exited; })(); return startServer({ ...options, dir, env: { ...env, ...more } }); },
  };
};

// Tiny HTTP client: api(base)(method, path, { token, body, headers }) -> { status, json, res }
export const client = (base) => async (method, route, { token, body, headers = {}, raw } = {}) => {
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch(`${base}/api${route}`, {
    method,
    headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined && !isForm && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : (isForm || raw ? body : JSON.stringify(body)),
  });
  const json = await res.clone().json().catch(() => ({}));
  return { status: res.status, json, res };
};

// Signs in and returns the access token
export const signIn = async (api, email, password = PW, portal) => {
  const r = await api('POST', '/auth/login', { body: { email, password, portal } });
  assert.equal(r.status, 200, `sign-in as ${email} failed: ${JSON.stringify(r.json)}`);
  return r.json.accessToken;
};

// A test file is one suite: the body runs top to bottom collecting `ok(name, condition)` results,
// then each result is reported as its own subtest so a failure names exactly what broke.
export const suite = (name, body) => {
  test(name, async (t) => {
    const results = [];
    const ok = (n, condition, detail = '') => { results.push({ n, pass: !!condition, detail }); };
    try { await body({ ok }); } catch (err) { results.push({ n: 'the test script ran to the end', pass: false, detail: err.stack || String(err) }); }
    for (const r of results) {
      await t.test(r.n, () => { assert.ok(r.pass, typeof r.detail === 'string' ? r.detail : JSON.stringify(r.detail)); });
    }
  });
};
