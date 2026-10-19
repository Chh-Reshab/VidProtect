import { suite, startServer, client, signIn, ADMIN_EMAIL } from './helpers.js';

suite('how much history is kept can be configured', async ({ ok }) => {
  const srv = await startServer({ env: { AUDIT_LIMIT: '3' } });
  try {
    const api = client(srv.base);
    const admin = await signIn(api, ADMIN_EMAIL);
    for (const status of ['suspended', 'active', 'suspended', 'active', 'suspended']) {
      await api('PATCH', '/admin/users/stu-006', { token: admin, body: { status } });
    }
    const data = (await api('GET', '/data', { token: admin })).json;
    ok('only the newest AUDIT_LIMIT audit entries are kept', data.audit.length === 3, data.audit.length);
    ok('they are the newest ones, newest first', data.audit[0].action === 'user.suspend' && data.audit[1].action === 'user.reactivate', data.audit.map(a => a.action));
  } finally { await srv.stop(); }

  const roomy = await startServer();
  try {
    const api = client(roomy.base);
    const admin = await signIn(api, ADMIN_EMAIL);
    for (let i = 0; i < 12; i += 1) await api('PATCH', '/admin/users/stu-006', { token: admin, body: { status: i % 2 ? 'active' : 'suspended' } });
    ok('by default far more than the old 1,000-entry limit is kept (nothing is cut after 12 actions)', (await api('GET', '/data', { token: admin })).json.audit.length === 12);
  } finally { await roomy.stop(); }
});
