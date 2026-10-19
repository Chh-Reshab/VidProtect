import { suite, startServer, client, signIn, sleep, PW, ADMIN_EMAIL } from './helpers.js';

const png = (size = 400) => { const b = Buffer.alloc(size, 7); Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b); return b; };
const form = (buffer, name = 'me.png', type = 'image/png') => { const f = new FormData(); f.append('image', new Blob([buffer], { type }), name); return f; };

suite('creator public profile: what a learner sees before enrolling', async ({ ok }) => {
  const srv = await startServer();
  try {
    const api = client(srv.base);
    const sarah = await signIn(api, 'sarah@student.test');
    const creator = await signIn(api, 'creator@vidprotect.test'); // creator-001: five courses, one invite-only, one draft
    const admin = await signIn(api, ADMIN_EMAIL);
    const view = (token, id) => api('GET', `/creators/${id}`, { token });

    // ── who can be viewed, and by whom ──
    ok('a profile needs a signed-in user', (await api('GET', '/creators/creator-001')).status === 401);
    ok('an unknown id is a 404', (await view(sarah, 'nope')).status === 404);
    ok('a learner is not a creator profile', (await view(sarah, 'stu-002')).status === 404);
    ok('a creator who is still waiting for approval has no public profile', (await view(sarah, 'stu-008')).status === 404);

    // ── the public view ──
    const pub = await view(sarah, 'creator-001');
    const c = pub.json.creator;
    ok('a learner sees the creator\'s profile', pub.status === 200 && c.name === 'Reshab Basnet' && c.id === 'creator-001', pub.json);
    ok('only listed courses count (the draft and the invite-only one are left out)', pub.json.courses.length === 3 && !pub.json.courses.some(x => ['course-004', 'course-005'].includes(x.id)) && c.stats.courses === 3, pub.json.courses.map(x => x.id));
    ok('the stats are computed from real data', c.stats.learners >= 3 && c.stats.videos >= 3 && typeof c.stats.hours === 'number', c.stats);
    ok('a verified badge and a course-creator badge are earned automatically', c.badges.some(b => b.id === 'verified') && c.badges.some(b => b.id === 'publisher'), c.badges);
    ok('no email, password or internal data is exposed', !JSON.stringify(pub.json).includes('@vidprotect.test') && !JSON.stringify(pub.json).includes('passwordHash') && !('email' in c));
    ok('creators can view each other, and admins can view', (await view(await signIn(api, 'maya@creator.test'), 'creator-001')).status === 200 && (await view(admin, 'creator-001')).status === 200);

    // ── editing ──
    const put = (token, body) => api('PUT', '/profile', { token, body });
    ok('a learner cannot edit a creator profile', (await put(sarah, { bio: 'x' })).status === 403);
    ok('a bio over 1000 characters is refused', (await put(creator, { bio: 'x'.repeat(1001) })).status === 400);
    ok('a headline over 100 characters is refused', (await put(creator, { headline: 'x'.repeat(101) })).status === 400);
    ok('a bad website link is refused', (await put(creator, { website: 'javascript:alert(1)' })).json.fields?.website !== undefined);
    ok('more than 8 achievements are refused', (await put(creator, { achievements: Array.from({ length: 9 }, (_, i) => `Achievement number ${i}`) })).status === 400);
    ok('a too-short achievement is refused', (await put(creator, { achievements: ['ab'] })).status === 400);
    const saved = await put(creator, { headline: '  Full-stack engineer and teacher ', bio: 'I have taught web development for years.', website: 'example.com/me', achievements: ['10,000 YouTube subscribers', 'Ex-Google engineer', ''], showLinks: true });
    ok('a valid profile is saved and cleaned up', saved.status === 200 && saved.json.profile.headline === 'Full-stack engineer and teacher' && saved.json.profile.website === 'https://example.com/me' && saved.json.profile.achievements.length === 2, saved.json);
    const after = (await view(sarah, 'creator-001')).json.creator;
    ok('learners now see the headline, bio, website and custom achievements', after.headline.startsWith('Full-stack') && after.bio.includes('web development') && after.links.some(l => l.label === 'Website') && after.achievements.includes('Ex-Google engineer'), after);
    ok('the creator\'s own record carries the profile for the editor', (await api('GET', '/data', { token: creator })).json.me.profile.headline.startsWith('Full-stack'));

    // ── the profile picture ──
    ok('a text file renamed .png is refused', (await api('POST', '/profile/avatar', { token: creator, body: form(Buffer.from('not an image at all'), 'x.png') })).status === 415);
    ok('an SVG is refused (it can carry scripts)', (await api('POST', '/profile/avatar', { token: creator, body: form(Buffer.from('<svg/>'), 'x.svg', 'image/svg+xml') })).status === 415);
    ok('a picture over 2 MB is refused', (await api('POST', '/profile/avatar', { token: creator, body: form(png(2 * 1024 * 1024 + 10)) })).status === 413);
    ok('a learner cannot upload one', (await api('POST', '/profile/avatar', { token: sarah, body: form(png()) })).status === 403);
    const up = await api('POST', '/profile/avatar', { token: creator, body: form(png()) });
    ok('a real picture is accepted', up.status === 200 && /^\/api\/avatars\/[0-9a-f-]{36}\.png$/.test(up.json.avatarUrl), up.json);
    const img = await fetch(`${srv.base}${up.json.avatarUrl}`);
    ok('it is served with the right type, no sniffing, and a strict policy', img.status === 200 && img.headers.get('content-type') === 'image/png' && img.headers.get('x-content-type-options') === 'nosniff' && /default-src 'none'/.test(img.headers.get('content-security-policy')) && Buffer.from(await img.arrayBuffer()).equals(png()));
    ok('learners see the picture on the profile', (await view(sarah, 'creator-001')).json.creator.avatarUrl === up.json.avatarUrl);
    const second = await api('POST', '/profile/avatar', { token: creator, body: form(png(500)) });
    await sleep(100);
    ok('a new picture replaces the old one (the old file is deleted)', second.json.avatarUrl !== up.json.avatarUrl && (await fetch(`${srv.base}${up.json.avatarUrl}`)).status === 404 && (await fetch(`${srv.base}${second.json.avatarUrl}`)).status === 200);
    ok('a made-up avatar name is a 404', (await fetch(`${srv.base}/api/avatars/..%2F..%2Fetc%2Fpasswd`)).status === 404 && (await fetch(`${srv.base}/api/avatars/${'a'.repeat(36)}.png`)).status === 404);
    ok('removing the picture works', (await api('DELETE', '/profile/avatar', { token: creator })).status === 200 && (await view(sarah, 'creator-001')).json.creator.avatarUrl === null);

    // ── experience and links come from the reviewed application, and the creator decides what shows ──
    ok('admin approves the waiting creator', (await api('POST', '/admin/creators/stu-008/review', { token: admin, body: { approve: true } })).status === 200);
    const daniel = await signIn(api, 'daniel@student.test', PW, 'creator');
    const d1 = (await view(sarah, 'stu-008')).json.creator;
    ok('experience (years and topics) is shown by default', d1.experience?.years === 3 && /React/.test(d1.experience.topics), d1.experience);
    ok('LinkedIn and other-platform links are hidden until the creator opts in', d1.links.length === 0, d1.links);
    ok('the teaching history written for the admin is never shown', !JSON.stringify(d1).includes('six years of professional'));
    await put(daniel, { showLinks: true, showExperience: false });
    const d2 = (await view(sarah, 'stu-008')).json.creator;
    ok('after opting in the links appear, and experience can be hidden', d2.experience === null && d2.links.some(l => l.label === 'LinkedIn') && d2.links.some(l => l.label === 'YouTube'), d2);

    // ── moderation and cleanup ──
    await api('POST', '/profile/avatar', { token: daniel, body: form(png()) });
    const url = (await view(sarah, 'stu-008')).json.creator.avatarUrl;
    ok('only an admin can clear a profile', (await api('DELETE', '/admin/creators/stu-008/profile', { token: sarah })).status === 403 && (await api('DELETE', '/admin/creators/stu-008/profile', { token: creator })).status === 403);
    ok('an admin clears an inappropriate profile (picture included)', (await api('DELETE', '/admin/creators/stu-008/profile', { token: admin })).status === 200 && (await view(sarah, 'stu-008')).json.creator.bio === '' && (await fetch(`${srv.base}${url}`)).status === 404);
    ok('clearing is in the audit log', (await api('GET', '/data', { token: admin })).json.audit.some(a => a.action === 'creator.profile_clear'));
    await api('POST', '/profile/avatar', { token: daniel, body: form(png()) });
    const before = (await view(sarah, 'stu-008')).json.creator.avatarUrl;
    await api('DELETE', '/auth/account', { token: daniel, body: { password: PW } });
    await sleep(150);
    ok('deleting the account removes the picture and the profile', (await fetch(`${srv.base}${before}`)).status === 404 && (await view(sarah, 'stu-008')).status === 404);
  } finally { await srv.stop(); }
});
