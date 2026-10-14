// ============================================
// Learning stats — pure functions, no network.
//   courseProgress  : % complete for a course (weighted by video length)
//   activityStats   : days online, streaks, hours watched
//   buildHeatmap    : the GitHub-style year grid
// A day counts as "online" once the learner has watched at least 30 seconds.
// ============================================

export const ACTIVE_DAY_SECONDS = 30;

const pad = (n) => String(n).padStart(2, '0');
export const localDay = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Calendar maths on 'YYYY-MM-DD' strings, done in UTC so daylight saving cannot shift a day
export const addDays = (ymd, n) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
const weekday = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = Sunday
};

export const parseClock = (text) => {
  const parts = String(text || '').split(':').map(Number);
  return parts.length && parts.every(Number.isFinite) ? parts.reduce((t, n) => t * 60 + n, 0) : 0;
};

export const videoSeconds = (video) => video.durationSeconds || parseClock(video.duration) || 0;

// 0..1 of one video watched
export const videoFraction = (video, p) => {
  if (!p) return 0;
  if (p.completed) return 1;
  const total = videoSeconds(video);
  if (!total) return p.positionSeconds > 0 ? 0.01 : 0;
  return Math.min(0.99, Math.max(0, p.positionSeconds / total));
};

export const courseProgress = (videos, progress) => {
  const perVideo = {};
  let watched = 0;
  let total = 0;
  let done = 0;
  let sumFraction = 0;
  for (const v of videos) {
    const f = videoFraction(v, progress[v.id]);
    perVideo[v.id] = f;
    const s = videoSeconds(v);
    watched += f * s;
    total += s;
    sumFraction += f;
    if (progress[v.id]?.completed) done += 1;
  }
  let percent = 0;
  if (videos.length) {
    if (done === videos.length) percent = 100;
    else if (total > 0) percent = Math.min(99, Math.round((watched / total) * 100));
    else percent = Math.min(99, Math.round((sumFraction / videos.length) * 100));
  }
  return { percent, completed: done, total: videos.length, perVideo, watchedSeconds: Math.round(watched), totalSeconds: total };
};

export const formatHours = (seconds) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m`;
  return s ? `${s}s` : '0m';
};

export const activityStats = (activity = {}, today = localDay()) => {
  const active = Object.entries(activity)
    .filter(([, seconds]) => seconds >= ACTIVE_DAY_SECONDS)
    .map(([day]) => day)
    .sort();
  const set = new Set(active);

  let maxStreak = 0;
  let run = 0;
  let previous = null;
  for (const day of active) {
    run = previous && addDays(previous, 1) === day ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    previous = day;
  }

  // Today not watched yet? The streak is still alive until the day ends.
  let currentStreak = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  while (set.has(cursor)) { currentStreak += 1; cursor = addDays(cursor, -1); }

  const yearStart = addDays(today, -364);
  let totalSeconds = 0;
  let yearSeconds = 0;
  for (const [day, seconds] of Object.entries(activity)) {
    totalSeconds += seconds;
    if (day >= yearStart && day <= today) yearSeconds += seconds;
  }
  const yearActiveDays = active.filter(d => d >= yearStart && d <= today).length;

  return { activeDays: active.length, yearActiveDays, maxStreak, currentStreak, totalSeconds, yearSeconds, today: set.has(today) };
};

export const levelFor = (seconds) => {
  if (seconds < ACTIVE_DAY_SECONDS) return 0;
  if (seconds < 600) return 1;
  if (seconds < 1800) return 2;
  if (seconds < 3600) return 3;
  return 4;
};

// 53 week columns (Sunday first) ending with the current week
export const buildHeatmap = (activity = {}, today = localDay()) => {
  const start = addDays(today, -(52 * 7 + weekday(today)));
  const weeks = [];
  const months = [];
  let lastMonth = -1;
  for (let w = 0; w < 53; w += 1) {
    const cells = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, w * 7 + d);
      const future = date > today;
      const seconds = future ? 0 : activity[date] || 0;
      cells.push({ date, seconds, future, level: future ? -1 : levelFor(seconds) });
    }
    const month = Number(cells[0].date.slice(5, 7));
    if (month !== lastMonth) { months.push({ week: w, month }); lastMonth = month; }
    weeks.push(cells);
  }
  return { weeks, months };
};
