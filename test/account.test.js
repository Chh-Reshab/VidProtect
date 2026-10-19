import { suite, startServer, client, signIn, sleep, PW, ADMIN_EMAIL } from './helpers.js';
import { totpAt } from '../server/totp.js';

suite('deleting an account', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const del = (token, body) => api('DELETE', '/auth/account', { token, body });

    // ── a learner ──
    const sarah = await signIn(api, 'sarah@student.test');
    await api('PUT', '/progress/vid-001', { token: sarah, body: { positionSeconds: 30, durationSeconds: 100, watchedSeconds: 30 } });
    ok('deleting needs the password', (await del(sarah, {})).status === 400 && (await del(sarah, { password: 'wrong' })).status === 400);
    ok('an unauthenticated request is refused', (await api('DELETE', '/auth/account', { body: { password: PW } })).status === 401);
    const gone = await del(sarah, { password: PW });
    ok('with the password the account is deleted', gone.status === 200 && gone.json.success, gone);
    ok('the person can no longer sign in', (await api('POST', '/auth/login', { body: { email: 'sarah@student.test', password: PW } })).status === 401);
    ok('the old session stopped working', (await api('GET', '/data', { token: sarah })).status === 401);
    const admin = await signIn(api, ADMIN_EMAIL);
    const data = (await api('GET', '/data', { token: admin })).json;
    ok('the user, their enrolments and their activity are gone', !data.users.some(u => u.email === 'sarah@student.test') && !data.enrollments.some(e => e.studentId === 'stu-001') && !data.logs.some(l => l.userId === 'stu-001'));
    ok('other people and the courses are untouched', data.users.some(u => u.email === 'marcus@student.test') && data.courses.some(c => c.id === 'course-001'));
    ok('the email can be used to sign up again', (await api('POST', '/auth/register', { body: { acceptTerms: true, name: 'Sarah Again', email: 'sarah@student.test', password: 'Fresh!pass2026' } })).status === 201);

    // ── two-step verification must be confirmed too ──
    const marcus = await signIn(api, 'marcus@student.test');
    const setup = await api('POST', '/auth/mfa/setup', { token: marcus });
    await api('POST', '/auth/mfa/enable', { token: marcus, body: { code: totpAt(setup.json.secret) } });
    ok('with two-step on, the password alone is not enough', (await del(marcus, { password: PW })).status === 400);

    // ── a creator with published courses and learners ──
    const creator = await signIn(api, 'creator@vidprotect.test');
    const blocked = await del(creator, { password: PW });
    ok('a creator whose published courses have learners is stopped', blocked.status === 409 && /learners enrolled/.test(blocked.json.error), blocked);
    ok('the account is still there', (await api('GET', '/data', { token: creator })).status === 200);
    const maya = await signIn(api, 'maya@creator.test');
    const mayaGone = await del(maya, { password: PW });
    ok('a creator with a course that has a learner is stopped too (course-006 has one)', mayaGone.status === 409, mayaGone);
    for (const id of ['course-006']) await api('PATCH', `/courses/${id}`, { token: maya, body: { status: 'draft' } });
    const mayaOk = await del(maya, { password: PW });
    ok('after unpublishing, the creator can delete, and their course goes with them', mayaOk.status === 200 && !(await api('GET', '/data', { token: admin })).json.courses.some(c => c.id === 'course-006'), mayaOk);

    // ── admins ──
    ok('the only admin cannot delete themselves', (await del(admin, { password: PW })).status === 400);
    const lily = await signIn(api, 'lily@student.test');
    const asAdmin = await api('DELETE', '/admin/users/stu-007', { token: admin });
    ok('an admin can delete another account', asAdmin.status === 200 && !(await api('GET', '/data', { token: admin })).json.users.some(u => u.id === 'stu-007'), asAdmin);
    ok('...and that account stops working', (await api('GET', '/data', { token: lily })).status === 401);
    ok('an admin cannot delete themselves through the admin route', (await api('DELETE', '/admin/users/admin-001', { token: admin })).status === 400);
    ok('an admin cannot delete the last admin', (await api('DELETE', '/admin/users/admin-001', { token: admin })).status === 400);
    ok('non-admins cannot use the admin route', (await api('DELETE', '/admin/users/stu-002', { token: marcus })).status === 403);
    ok('deletions are in the audit log without naming the person', (await api('GET', '/data', { token: admin })).json.audit.some(a => a.action === 'user.delete' && a.targetId === 'deleted-user'));
    await sleep(50);
  } finally { await srv.stop(); }
});

suite('payments are kept (anonymously) when a learner deletes their account', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const maya = await signIn(api, 'maya@creator.test');
    const course = (await api('POST', '/courses', { token: maya, body: { title: 'Paid One', price: 300 } })).json.course;
    await api('PATCH', `/courses/${course.id}`, { token: maya, body: { status: 'active' } });
    const lily = await signIn(api, 'lily@student.test');
    const bought = await api('POST', `/courses/${course.id}/checkout`, { token: lily, body: { method: 'upi', upiId: 'lily@okbank' } });
    ok('a learner buys a course (built-in test checkout)', bought.status === 201, bought);
    await api('DELETE', '/auth/account', { token: lily, body: { password: PW } });
    const payments = (await api('GET', '/data', { token: await signIn(api, ADMIN_EMAIL) })).json.payments;
    ok('the payment record stays, without the person', payments.some(p => p.courseId === course.id && p.userId === 'deleted-user' && p.amount === 300), payments);
  } finally { await srv.stop(); }
});
