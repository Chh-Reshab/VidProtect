import { suite, startServer, client, signIn, sleep, ADMIN_EMAIL } from './helpers.js';

suite('creators are emailed about the decision', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const admin = await signIn(api, ADMIN_EMAIL);

    // Daniel's seeded application is pending
    const reject = await api('POST', '/admin/creators/stu-008/review', { token: admin, body: { approve: false, note: 'Please add your CV so we can check your experience.' } });
    ok('a rejection is accepted', reject.status === 200, reject);
    await sleep(200);
    ok('the applicant gets a rejection email addressed to them', /creator decision link for daniel@student\.test: \S+\/creator\/login/.test(srv.log()), srv.log().slice(-400));

    const withoutReason = await api('POST', '/admin/creators/stu-008/review', { token: admin, body: { approve: false } });
    ok('the decision is not repeated for an application that is not pending', withoutReason.status === 404, withoutReason);
  } finally { await srv.stop(); }

  const second = await startServer();
  try {
    const api = client(second.base);
    const admin = await signIn(api, ADMIN_EMAIL);
    const approve = await api('POST', '/admin/creators/stu-008/review', { token: admin, body: { approve: true } });
    await sleep(200);
    ok('an approval is accepted and emailed', approve.status === 200 && /creator decision link for daniel@student\.test/.test(second.log()), second.log().slice(-300));
  } finally { await second.stop(); }
});
