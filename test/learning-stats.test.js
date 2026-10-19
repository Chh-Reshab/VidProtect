import { suite } from './helpers.js';
import * as st from '../src/services/learningStats.js';

suite('learning statistics: days, streaks, hours (unit)', async ({ ok }) => {
  const T = '2026-10-14';

  // ── days
  ok('addDays forward across month end', st.addDays('2026-10-31', 1) === '2026-11-01');
  ok('addDays back across year', st.addDays('2026-01-01', -1) === '2025-12-31');
  ok('addDays leap day', st.addDays('2028-02-28', 1) === '2028-02-29');

  // ── streaks
  const act = { '2026-10-14': 600, '2026-10-13': 100, '2026-10-12': 31, '2026-10-10': 5000, '2026-10-09': 60, '2026-10-08': 60, '2026-10-07': 60, '2026-10-06': 60 };
  let s = st.activityStats(act, T);
  ok('current streak counts back from today', s.currentStreak === 3, s);
  ok('max streak finds the longest run (5 days)', s.maxStreak === 5, s);
  ok('active days', s.activeDays === 8, s);
  ok('hours watched total', s.totalSeconds === 600 + 100 + 31 + 5000 + 240);

  s = st.activityStats({ '2026-10-13': 100, '2026-10-12': 100 }, T);
  ok('streak stays alive if you have not watched yet today', s.currentStreak === 2, s);
  s = st.activityStats({ '2026-10-11': 100 }, T);
  ok('streak resets after a missed day', s.currentStreak === 0 && s.maxStreak === 1, s);
  s = st.activityStats({ '2026-10-14': 29 }, T);
  ok('under 30 seconds does not make a day active', s.activeDays === 0 && s.currentStreak === 0, s);
  ok('empty activity is all zeros', JSON.stringify(st.activityStats({}, T)) === JSON.stringify({ activeDays: 0, yearActiveDays: 0, maxStreak: 0, currentStreak: 0, totalSeconds: 0, yearSeconds: 0, today: false }));
  s = st.activityStats({ '2025-10-01': 1000, '2026-10-14': 500 }, T);
  ok('past-year hours exclude older days', s.yearSeconds === 500 && s.totalSeconds === 1500, s);
  ok('month-end streak is continuous', st.activityStats({ '2026-09-30': 100, '2026-10-01': 100 }, '2026-10-01').currentStreak === 2);

  // ── course progress
  const vids = [{ id: 'a', durationSeconds: 600 }, { id: 'b', duration: '10:00' }, { id: 'c', durationSeconds: 1200 }];
  let c = st.courseProgress(vids, {});
  ok('nothing watched = 0%', c.percent === 0 && c.completed === 0 && c.total === 3, c);
  c = st.courseProgress(vids, { a: { completed: true, positionSeconds: 600 } });
  ok('one 10-min video of 40 min = 25%', c.percent === 25 && c.completed === 1, c);
  c = st.courseProgress(vids, { a: { completed: true, positionSeconds: 600 }, b: { positionSeconds: 300 }, c: { positionSeconds: 0 } });
  ok('partial watch counts (600+300)/2400 = 38%', c.percent === 38, c);
  ok('per-video fraction exposed', c.perVideo.b === 0.5 && c.perVideo.a === 1, c.perVideo);
  c = st.courseProgress(vids, { a: { completed: true }, b: { completed: true }, c: { completed: true } });
  ok('all completed = 100%', c.percent === 100 && c.completed === 3);
  c = st.courseProgress([{ id: 'x', durationSeconds: 1000 }], { x: { positionSeconds: 990 } });
  ok('99% watched but not completed never shows 100%', c.percent === 99, c);
  ok('course with no videos = 0%', st.courseProgress([], {}).percent === 0);
  c = st.courseProgress([{ id: 'x' }, { id: 'y' }], { x: { completed: true } });
  ok('videos with unknown length fall back to counting videos (50%)', c.percent === 50, c);

  // ── heatmap
  const hm = st.buildHeatmap({ [T]: 4000, '2026-10-13': 700 }, T);
  const flat = hm.weeks.flat();
  ok('53 weeks of 7 days', hm.weeks.length === 53 && hm.weeks.every(w => w.length === 7));
  ok('grid starts on a Sunday', new Date(hm.weeks[0][0].date + 'T00:00:00Z').getUTCDay() === 0);
  ok('today is in the last column', hm.weeks[52].some(d => d.date === T));
  ok('days after today are marked future', flat.filter(d => d.future).every(d => d.date > T) && flat.filter(d => d.date > T).every(d => d.future));
  ok('levels: 4000s=4, 700s=2', flat.find(d => d.date === T).level === 4 && flat.find(d => d.date === '2026-10-13').level === 2);
  ok('covers a full year back', flat.some(d => d.date === st.addDays(T, -364)));
  ok('month labels are increasing weeks', hm.months.every((m, i) => i === 0 || m.week > hm.months[i - 1].week) && hm.months.length >= 12);
  ok('formatHours', st.formatHours(0) === '0m' && st.formatHours(125) === '2m' && st.formatHours(3 * 3600 + 25 * 60) === '3h 25m' && st.formatHours(20) === '20s');
});
