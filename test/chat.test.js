import { suite, startServer, client, signIn, sleep, ADMIN_EMAIL } from './helpers.js';

suite('community discussion: posting, reading, deleting, reporting and moderation', async ({ ok }) => {
  const srv = await startServer({ env: { CHAT_MIN_GAP_MS: '0', CHAT_PER_MINUTE: '100000' } });
  try {
    const api = client(srv.base);
    const sarah = await signIn(api, 'sarah@student.test');
    const marcus = await signIn(api, 'marcus@student.test');
    const creator = await signIn(api, 'creator@vidprotect.test');
    const admin = await signIn(api, ADMIN_EMAIL);
    const post = (token, text) => api('POST', '/chat', { token, body: { text } });
    const read = (token, v) => api('GET', `/chat${v ? `?v=${v}` : ''}`, { token });

    // ── who can use it ──
    ok('the room needs a signed-in user', (await api('GET', '/chat')).status === 401 && (await api('POST', '/chat', { body: { text: 'hi' } })).status === 401);
    const waiting = await signIn(api, 'daniel@student.test', undefined, 'creator'); // a creator still waiting for approval
    ok('a creator who is not approved yet cannot use it', (await read(waiting)).status === 403);
    ok('the room starts empty', (await read(sarah)).json.messages.length === 0);

    // ── posting ──
    ok('an empty message is refused', (await post(sarah, '   ')).status === 400 && (await post(sarah, '')).status === 400 && (await api('POST', '/chat', { token: sarah, body: {} })).status === 400);
    ok('a message over 500 characters is refused', (await post(sarah, 'x'.repeat(501))).status === 400);
    ok('a non-text message is refused', (await api('POST', '/chat', { token: sarah, body: { text: { a: 1 } } })).status === 400);
    const first = await post(sarah, 'Hello everyone! Has anyone finished the React course?');
    ok('a learner can post', first.status === 201 && first.json.message.text.startsWith('Hello everyone') && first.json.message.mine === true, first.json);
    ok('a creator can post, shown with their role', (await post(creator, 'Welcome! Ask me anything about the course.')).json.message.author.role === 'creator');
    ok('an admin can post', (await post(admin, 'Please keep the discussion friendly.')).status === 201);
    ok('exactly 500 characters is fine', (await post(marcus, 'y'.repeat(500))).status === 201);
    const sanitised = await post(marcus, 'line1\n\n\n\n\nline2\u0000\u0007');
    ok('control characters and long runs of blank lines are cleaned out', sanitised.json.message.text === 'line1\n\nline2', JSON.stringify(sanitised.json.message.text));
    const html = await post(marcus, '<script>alert(1)</script> <b>bold</b>');
    ok('HTML is kept as harmless text (the page shows it as text, never as markup)', html.json.message.text === '<script>alert(1)</script> <b>bold</b>');

    // ── reading ──
    const list = (await read(marcus)).json;
    ok('everyone sees the messages, oldest first, with who wrote them', list.messages.length === 6 && list.messages[0].text.startsWith('Hello everyone') && list.messages[1].author.name === 'Reshab Basnet', list.messages.map(m => m.text.slice(0, 12)));
    ok('authors show only name, role and picture: never an email', !JSON.stringify(list).includes('@student.test') && !JSON.stringify(list).includes('@vidprotect.test') && Object.keys(list.messages[0].author).sort().join() === 'avatarUrl,id,name,role');
    ok('"mine" is true only for the reader\'s own messages', (await read(sarah)).json.messages.filter(m => m.mine).length === 1);
    const v = list.v;
    ok('asking again with the same version answers "unchanged" (tiny)', (await read(marcus, v)).json.unchanged === true);
    await post(sarah, 'A new message');
    const changed = await read(marcus, v);
    ok('a new message changes the version and returns the room', !changed.json.unchanged && changed.json.messages.length === 7 && changed.json.v !== v);

    // ── repeated text, speed ──
    ok('the same text twice in a row is refused', (await post(sarah, 'A new message')).status === 409);
    const slow = await startServer({ env: { CHAT_MIN_GAP_MS: '2000' } });
    try {
      const a2 = client(slow.base);
      const t = await signIn(a2, 'priya@student.test');
      const one = await a2('POST', '/chat', { token: t, body: { text: 'first' } });
      const two = await a2('POST', '/chat', { token: t, body: { text: 'second' } });
      ok('messages sent too quickly one after the other are refused (429)', one.status === 201 && two.status === 429, [one.status, two.status]);
    } finally { await slow.stop(); }
    const limited = await startServer({ env: { CHAT_MIN_GAP_MS: '0', CHAT_PER_MINUTE: '3' } });
    try {
      const a3 = client(limited.base);
      const t = await signIn(a3, 'priya@student.test');
      const codes = [];
      for (let i = 0; i < 5; i += 1) codes.push((await a3('POST', '/chat', { token: t, body: { text: `message ${i}` } })).status);
      ok('more than the per-minute limit is refused', codes.join() === '201,201,201,429,429', codes);
    } finally { await limited.stop(); }

    // ── deleting ──
    const mine = (await read(sarah)).json.messages.find(m => m.mine);
    ok('you cannot delete someone else\'s message', (await api('DELETE', `/chat/${mine.id}`, { token: marcus })).status === 403 && (await api('DELETE', `/chat/${mine.id}`, { token: creator })).status === 403);
    ok('you can delete your own', (await api('DELETE', `/chat/${mine.id}`, { token: sarah })).status === 200 && !(await read(marcus)).json.messages.some(m => m.id === mine.id));
    ok('an unknown message is a 404', (await api('DELETE', '/chat/msg-nope', { token: sarah })).status === 404);

    // ── reporting ──
    const target = (await post(marcus, 'something rude')).json.message;
    ok('you cannot report your own message', (await api('POST', `/chat/${target.id}/report`, { token: marcus })).status === 400);
    ok('a report is accepted and reporting twice does nothing more', (await api('POST', `/chat/${target.id}/report`, { token: sarah })).status === 200 && (await api('POST', `/chat/${target.id}/report`, { token: sarah })).status === 200);
    ok('one reporter\'s message is still visible, and marked as reported for them', (await read(sarah)).json.messages.find(m => m.id === target.id)?.reportedByMe === true);
    await api('POST', `/chat/${target.id}/report`, { token: creator });
    ok('two reports are not enough to hide it', (await read(creator)).json.messages.some(m => m.id === target.id));
    await api('POST', `/chat/${target.id}/report`, { token: admin });
    ok('the third report hides it from everyone until an admin decides', !(await read(sarah)).json.messages.some(m => m.id === target.id) && !(await read(marcus)).json.messages.some(m => m.id === target.id));

    // ── moderation ──
    ok('only an admin sees the report queue', (await api('GET', '/chat/reports', { token: sarah })).status === 403 && (await api('GET', '/chat/reports', { token: creator })).status === 403);
    const queue = (await api('GET', '/chat/reports', { token: admin })).json.reports;
    ok('the queue shows the hidden message, its reports and its author', queue.length === 1 && queue[0].hidden === true && queue[0].reportCount === 3 && queue[0].author.name === 'Marcus Johnson', queue);
    ok('only an admin can review', (await api('POST', `/chat/${target.id}/review`, { token: creator, body: { action: 'delete' } })).status === 403);
    ok('a bad review action is refused', (await api('POST', `/chat/${target.id}/review`, { token: admin, body: { action: 'ban' } })).status === 400);
    ok('dismissing shows the message again and clears the reports', (await api('POST', `/chat/${target.id}/review`, { token: admin, body: { action: 'dismiss' } })).status === 200 && (await read(sarah)).json.messages.some(m => m.id === target.id) && (await api('GET', '/chat/reports', { token: admin })).json.reports.length === 0);
    for (const t of [sarah, creator, admin]) await api('POST', `/chat/${target.id}/report`, { token: t });
    ok('an admin can delete a reported message', (await api('POST', `/chat/${target.id}/review`, { token: admin, body: { action: 'delete' } })).status === 200 && !(await read(admin)).json.messages.some(m => m.id === target.id));
    const other = (await post(marcus, 'another message')).json.message;
    ok('an admin can delete any message directly, and it is in the audit log', (await api('DELETE', `/chat/${other.id}`, { token: admin })).status === 200 && (await api('GET', '/data', { token: admin })).json.audit.some(a => a.action === 'chat.delete' && a.targetId === other.id));

    // ── muting ──
    ok('only an admin can mute', (await api('POST', '/chat/mute/stu-002', { token: creator, body: { hours: 1 } })).status === 403);
    ok('an odd duration is refused', (await api('POST', '/chat/mute/stu-002', { token: admin, body: { hours: 5 } })).status === 400);
    ok('admins cannot mute themselves or other admins', (await api('POST', '/chat/mute/admin-001', { token: admin, body: { hours: 1 } })).status === 400);
    const muted = await api('POST', '/chat/mute/stu-002', { token: admin, body: { hours: 24 } });
    ok('an admin can mute a member', muted.status === 200 && muted.json.mutedUntil > Date.now());
    const blocked = await post(marcus, 'can I still talk?');
    ok('a muted member cannot post, and is told until when', blocked.status === 403 && /muted/.test(blocked.json.error), blocked.json);
    ok('...but can still read, and the room tells them they are muted', (await read(marcus)).json.mutedUntil > Date.now());
    ok('the mute is in the audit log', (await api('GET', '/data', { token: admin })).json.audit.some(a => a.action === 'chat.mute' && a.targetId === 'stu-002'));
    await api('POST', '/chat/mute/stu-002', { token: admin, body: { hours: 0 } });
    ok('unmuting lets them post again', (await post(marcus, 'I am back')).status === 201);

    // ── paging ──
    const many = await startServer({ env: { CHAT_MIN_GAP_MS: '0', CHAT_PER_MINUTE: '100000' } });
    try {
      const a4 = client(many.base);
      const t = await signIn(a4, 'omar@student.test');
      for (let i = 0; i < 130; i += 1) await a4('POST', '/chat', { token: t, body: { text: `msg ${i}` } });
      const page = (await a4('GET', '/chat', { token: t })).json;
      ok('the room returns the latest 100 and says there are more', page.messages.length === 100 && page.hasMore === true && page.messages.at(-1).text === 'msg 129' && page.messages[0].text === 'msg 30');
      const older = (await a4('GET', `/chat/older?before=${page.messages[0].id}`, { token: t })).json;
      ok('"older" returns the earlier ones, oldest first, and no more after that', older.messages.length === 30 && older.messages[0].text === 'msg 0' && older.hasMore === false);
    } finally { await many.stop(); }

    // ── limits and cleanup ──
    const small = await startServer({ env: { CHAT_MIN_GAP_MS: '0', CHAT_PER_MINUTE: '100000', CHAT_LIMIT: '5' } });
    try {
      const a5 = client(small.base);
      const t = await signIn(a5, 'omar@student.test');
      for (let i = 0; i < 9; i += 1) await a5('POST', '/chat', { token: t, body: { text: `keep ${i}` } });
      const kept = (await a5('GET', '/chat', { token: t })).json.messages;
      ok('only the newest CHAT_LIMIT messages are kept', kept.length === 5 && kept[0].text === 'keep 4' && kept.at(-1).text === 'keep 8', kept.map(m => m.text));
    } finally { await small.stop(); }

    const del = await api('DELETE', '/auth/account', { token: marcus, body: { password: (await import('./helpers.js')).PW } });
    ok('deleting an account removes that person\'s messages too', del.status === 200 && !(await read(sarah)).json.messages.some(m => m.author.name === 'Marcus Johnson'), del.json);
    await sleep(20);
  } finally { await srv.stop(); }
});
