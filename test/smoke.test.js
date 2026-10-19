import { suite, startServer, client, signIn, ADMIN_EMAIL } from './helpers.js';

suite('harness smoke test', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const admin = await signIn(api, ADMIN_EMAIL);
    const data = await api('GET', '/data', { token: admin });
    ok('the fixture accounts can sign in and /data works', data.status === 200 && data.json.users.length > 10, data.status);
    ok('health check answers', (await api('GET', '/health')).json.ok === true);
  } finally { await srv.stop(); }
});
