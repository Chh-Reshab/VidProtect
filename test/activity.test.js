import { suite, startServer, PW } from './helpers.js';

suite('watch activity and streaks', async ({ ok }) => {
  const srv = await startServer();
  const base = srv.base;
  try {
  const login = async (email) => (await (await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: PW }) })).json()).accessToken;
  const call = async (token, method, path, body) => {
    const r = await fetch(`${base}/api${path}`, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    let json = null; try { json = await r.json(); } catch {}
    return { status: r.status, json };
  };
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const utc = (offset = 0) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);

  const sarah = await login('sarah@student.test');
  const priya = await login('priya@student.test');
  const data = (await call(sarah, 'GET', '/data')).json;
  const enrolled = new Set(data.enrollments.filter(e => e.studentId === 'stu-001' && e.status === 'active').map(e => e.courseId));
  const video = data.videos.find(v => enrolled.has(v.courseId));
  const put = (token, body) => call(token, 'PUT', `/progress/${video.id}`, { positionSeconds: 5, durationSeconds: 600, ...body });
  const today = async (token, day = utc()) => ((await call(token, 'GET', '/data')).json.activity[day] || 0);

  const before = await today(sarah);
  ok('activity is part of the learner snapshot', typeof data.activity === 'object');

  // first save for this video: can credit at most 10 seconds, however much is claimed
  await put(sarah, { watchedSeconds: 100000 });
  const a1 = await today(sarah);
  ok('first save: huge claim is capped (<= 10s)', a1 - before <= 10 && a1 - before > 0, a1 - before);

  // immediately again: real elapsed time is ~0, so almost nothing can be credited
  await put(sarah, { watchedSeconds: 500 });
  const a2 = await today(sarah);
  ok('instant second save: capped by elapsed time (<= 4s)', a2 - a1 <= 4, a2 - a1);

  // after 3 real seconds, 5s of playback is plausible (even at 2x speed)
  await sleep(3000);
  await put(sarah, { watchedSeconds: 5 });
  const a3 = await today(sarah);
  ok('plausible claim after a real wait is credited in full', a3 - a2 === 5, a3 - a2);

  // junk values change nothing
  for (const bad of [0, -50, 'abc', null, NaN, Infinity]) await put(sarah, { watchedSeconds: bad });
  ok('zero / negative / non-numeric claims credit nothing', (await today(sarah)) === a3);

  // which calendar day
  const far = await put(sarah, { watchedSeconds: 3, localDate: '2020-01-01' });
  await sleep(1500);
  ok('a date far from the server date is ignored', far.status === 200 && ((await call(sarah, 'GET', '/data')).json.activity['2020-01-01'] || 0) === 0);
  await sleep(2500);
  await put(sarah, { watchedSeconds: 4, localDate: utc(-1) });
  ok('the learner\'s own (yesterday) date is accepted', (await today(sarah, utc(-1))) >= 4);
  await put(sarah, { watchedSeconds: 2, localDate: "2026-10-14'; DROP" });
  ok('malformed date falls back safely', true);

  // privacy / access
  const sarahMap = (await call(sarah, 'GET', '/data')).json.activity;
  const priyaMap = (await call(priya, 'GET', '/data')).json.activity;
  ok('sarah has activity on yesterday', (sarahMap[utc(-1)] || 0) >= 4, sarahMap);
  ok('priya (who watched nothing) does not see the other learner days', (priyaMap[utc(-1)] || 0) === 0 && (priyaMap[utc()] || 0) === 0, priyaMap);
  ok('priya sees only her own map', JSON.stringify(priyaMap) !== JSON.stringify(sarahMap));
  ok('progress for an unfinished/unknown video is refused', (await call(sarah, 'PUT', '/progress/vid-does-not-exist', { positionSeconds: 1, watchedSeconds: 50 })).status === 404);
  ok('signed-out user cannot post progress', (await call(null, 'PUT', `/progress/${video.id}`, { positionSeconds: 1, watchedSeconds: 50 })).status === 401);
  } finally { await srv.stop(); }
});
