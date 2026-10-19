import fs from 'node:fs';
import path from 'node:path';
import { suite, startServer, client, signIn, sleep, PW, ADMIN_EMAIL } from './helpers.js';

const mailLine = (log, kind, email) => log().includes(`[mail] (not sent, no mail provider configured) ${kind} link for ${email}`);

suite('possible screen-capture attempts: warnings, creator alerts and optional suspension', async ({ ok }) => {
  const srv = await startServer({ env: { CAPTURE_DEDUPE_MS: '0', CAPTURE_BLOCK_AFTER: '4' } });
  try {
    const api = client(srv.base);
    const report = (token, signal = 'print_screen', video = 'vid-001') => api('POST', `/videos/${video}/capture-signal`, { token, body: { signal } });
    const sarah = await signIn(api, 'sarah@student.test'); // enrolled in course-001 (creator-001)
    const creator = await signIn(api, 'creator@vidprotect.test');
    const admin = await signIn(api, ADMIN_EMAIL);

    ok('a report needs a signed-in user', (await api('POST', '/videos/vid-001/capture-signal', { body: { signal: 'print_screen' } })).status === 401);
    ok('an unknown signal is refused', (await report(sarah, 'devtools_open')).status === 400 && (await report(sarah, null)).status === 400);
    ok('an unknown video is a 404', (await report(sarah, 'print_screen', 'vid-nope')).status === 404);
    ok('someone not enrolled in the course cannot report (or be flagged) on it', (await report(await signIn(api, 'lily@student.test'))).status === 403);

    // 1st attempt: the learner is warned, the creator is not told yet
    const first = await report(sarah);
    ok('the first attempt is counted and warns the learner', first.status === 200 && first.json.counted === true && first.json.strikes === 1 && first.json.creatorNotified === false && /emailed you a warning/.test(first.json.message), first.json);
    await sleep(150);
    ok('the learner gets a warning email', mailLine(srv.log, 'capture warning', 'sarah@student.test'));
    ok('the creator is NOT emailed for a first attempt', !mailLine(srv.log, 'capture alert', 'creator@vidprotect.test'));
    ok('no alert exists for the creator yet', !(await api('GET', '/data', { token: creator })).json.alerts.some(a => a.alertType === 'capture_attempt'));
    const logs1 = (await api('GET', '/data', { token: creator })).json.logs;
    ok('the attempt is in the creator\'s activity log, marked flagged', logs1.some(l => l.eventType === 'capture_attempt' && l.userId === 'stu-001' && l.result === 'flagged'), logs1.slice(0, 2));

    // 2nd attempt: now the creator hears about it
    const second = await report(sarah, 'screenshot_shortcut');
    ok('the second attempt tells the creator', second.json.strikes === 2 && second.json.creatorNotified === true && /creator has been told/.test(second.json.message), second.json);
    await sleep(150);
    ok('the creator gets an alert email naming the learner and the video', mailLine(srv.log, 'capture alert', 'creator@vidprotect.test'));
    const alert = (await api('GET', '/data', { token: creator })).json.alerts.find(a => a.alertType === 'capture_attempt');
    ok('and an alert in the studio, worded as a warning sign and not as proof', !!alert && alert.userName === 'Sarah Chen' && alert.severity === 'medium' && /not proof/.test(alert.explanation) && alert.reviewStatus === 'open', alert);
    ok('another creator does not see it', !(await api('GET', '/data', { token: await signIn(api, 'maya@creator.test') })).json.alerts.some(a => a.alertType === 'capture_attempt'));
    ok('the learner cannot see the alerts', (await api('GET', '/data', { token: sarah })).json.alerts.length === 0);

    // 3rd attempt: higher severity; 4th: automatic suspension (CAPTURE_BLOCK_AFTER=4)
    const third = await report(sarah);
    ok('a third attempt raises the alert to high severity', third.json.strikes === 3 && third.json.blocked === false && (await api('GET', '/data', { token: creator })).json.alerts.filter(a => a.alertType === 'capture_attempt').some(a => a.severity === 'high'));
    const fourth = await report(sarah);
    ok('the fourth attempt suspends the account', fourth.json.blocked === true && /suspended/.test(fourth.json.message), fourth.json);
    ok('the suspended learner is signed out and cannot sign in', (await api('GET', '/data', { token: sarah })).status === 401 && (await api('POST', '/auth/login', { body: { email: 'sarah@student.test', password: PW } })).status === 403);
    const adminView = (await api('GET', '/data', { token: admin })).json;
    ok('the suspension is in the audit log, attributed to the system, and an admin can reverse it', adminView.audit.some(a => a.action === 'user.suspend' && a.actorId === 'system' && a.meta?.reason === 'capture_attempts'));
    ok('an admin reactivates the account', (await api('PATCH', '/admin/users/stu-001', { token: admin, body: { status: 'active' } })).status === 200 && (await api('POST', '/auth/login', { body: { email: 'sarah@student.test', password: PW } })).status === 200);

    // privileged viewers are never flagged
    ok('the creator previewing their own video is never flagged', (await report(creator)).json.counted === false);
    ok('an admin is never flagged', (await report(admin)).json.counted === false);
  } finally { await srv.stop(); }
});

suite('capture attempts: bursts count once, old attempts are forgiven, no auto-suspension by default', async ({ ok }) => {
  const srv = await startServer(); // default settings
  try {
    const api = client(srv.base);
    const marcus = await signIn(api, 'marcus@student.test');
    const report = () => api('POST', '/videos/vid-001/capture-signal', { token: marcus, body: { signal: 'print_screen' } });
    const a = await report();
    const b = await report();
    ok('one key press that fires several signals counts once (30 s window)', a.json.counted === true && b.json.counted === false, [a.json, b.json]);

    // pretend the last attempt was 31 days ago
    await sleep(400);
    const dir = srv.dir;
    await srv.stop();
    const file = path.join(dir, 'data', 'db.json');
    const state = JSON.parse(fs.readFileSync(file, 'utf8'));
    const me = state.users.find(u => u.email === 'marcus@student.test');
    me.captureStrikes = 3; me.captureLastAt = Date.now() - 31 * 86_400_000;
    fs.writeFileSync(file, JSON.stringify(state));
    const again = await startServer({ dir });
    try {
      const api2 = client(again.base);
      const token = await signIn(api2, 'marcus@student.test');
      const r = await api2('POST', '/videos/vid-001/capture-signal', { token, body: { signal: 'print_screen' } });
      ok('attempts older than 30 days are forgiven (the count starts again at 1)', r.json.strikes === 1 && r.json.creatorNotified === false, r.json);
    } finally { await again.stop(); }
  } finally { await srv.stop(); }

  // with the defaults nobody is suspended automatically, however often it happens
  const loose = await startServer({ env: { CAPTURE_DEDUPE_MS: '0' } });
  try {
    const api = client(loose.base);
    const priya = await signIn(api, 'priya@student.test'); // enrolled in course-002 and course-004
    let last;
    for (let i = 0; i < 8; i += 1) last = await api('POST', '/videos/vid-003/capture-signal', { token: priya, body: { signal: 'print_screen' } });
    ok('with the default settings eight attempts never suspend automatically', last.status === 200 && last.json.blocked === false && last.json.strikes === 8 && (await api('GET', '/data', { token: priya })).status === 200, last.json);
  } finally { await loose.stop(); }
});
