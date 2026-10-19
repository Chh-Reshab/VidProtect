// ============================================
// Possible screenshot / screen-recording attempts.
// A web page cannot see an OS-level recorder, so this reacts to what a browser CAN see while a video
// plays: the Print Screen key and screenshot shortcuts (reported by the player). That is a warning
// sign, not proof, so the response is graded:
//   1st attempt  -> the learner gets a warning (on screen + email)
//   2nd and more -> the creator gets an alert (in the studio + email); the learner is warned again
//   N-th         -> optional automatic suspension (CAPTURE_BLOCK_AFTER, off by default; admins can reverse it)
// Attempts older than CAPTURE_DECAY_DAYS no longer count, and a burst of signals counts once.
// ============================================

import { db, save, uid } from './db.js';
import { recordLog, audit } from './access.js';
import { revokeAllSessions } from './auth.js';
import { sendCaptureWarningEmail, sendCaptureAlertEmail } from './mail.js';

export const SIGNALS = {
  print_screen: 'the Print Screen key',
  screenshot_shortcut: 'a screenshot shortcut',
};

const num = (name, fallback) => (process.env[name] !== undefined && process.env[name] !== '' ? Number(process.env[name]) : fallback);
const DEDUPE_MS = () => num('CAPTURE_DEDUPE_MS', 30_000);          // one key press can fire several signals
const DECAY_MS = () => num('CAPTURE_DECAY_DAYS', 30) * 86_400_000; // old attempts are forgiven
const ALERT_FROM = () => num('CAPTURE_ALERT_FROM', 2);             // the creator hears about the 2nd attempt on
const BLOCK_AFTER = () => num('CAPTURE_BLOCK_AFTER', 0);           // 0 = never suspend automatically

const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 >> 3) ^ 1 && n % 10 < 4 ? n % 10 : 0]}`;

// Records one attempt by a learner on a video; returns what the player should show.
// `studioLink` is where the creator reviews alerts (used in the email).
export const recordCapture = (user, video, signal, studioLink) => {
  const now = Date.now();
  if (user.captureLastAt && now - user.captureLastAt < DEDUPE_MS()) return { counted: false };
  if (!user.captureLastAt || now - user.captureLastAt > DECAY_MS()) user.captureStrikes = 0;
  user.captureStrikes = (user.captureStrikes || 0) + 1;
  user.captureLastAt = now;
  const strikes = user.captureStrikes;
  const what = SIGNALS[signal];

  recordLog({
    userId: user.id, userName: user.name,
    videoId: video.id, videoTitle: video.title, courseId: video.courseId,
    eventType: 'capture_attempt', result: 'flagged',
    reason: `Possible screenshot or recording attempt (${what}). Attempt ${strikes}.`,
  });

  const creator = db.users.find(u => u.id === video.creatorId);
  const blocked = BLOCK_AFTER() > 0 && strikes >= BLOCK_AFTER();
  const creatorNotified = strikes >= ALERT_FROM() && !!creator;

  if (creatorNotified) {
    db.alerts.unshift({
      id: uid('alert'),
      severity: strikes >= 3 ? 'high' : 'medium',
      alertType: 'capture_attempt',
      timestamp: new Date().toISOString(),
      userId: user.id,
      userName: user.name,
      videoId: video.id,
      videoTitle: video.title,
      explanation: `${user.name} triggered ${what} while watching "${video.title}". This is their ${ordinal(strikes)} possible capture attempt in the last ${Math.round(DECAY_MS() / 86_400_000)} days. This is a warning sign, not proof: it is based on keyboard shortcuts and can be a false alarm.`,
      reviewStatus: 'open',
      recommendedAction: 'Look at the activity log. Warn the learner, or remove them from your course if it keeps happening.',
      resolvedAt: null,
    });
    sendCaptureAlertEmail({ to: creator.email, name: creator.name, link: studioLink, learnerName: user.name, videoTitle: video.title, count: strikes })
      .catch(err => console.error(`[mail] Could not send the capture alert to ${creator.email}: ${err.message}`));
  }

  sendCaptureWarningEmail({ to: user.email, name: user.name, link: studioLink, videoTitle: video.title, count: strikes, blocked })
    .catch(err => console.error(`[mail] Could not send the capture warning to ${user.email}: ${err.message}`));

  if (blocked) {
    user.status = 'suspended';
    revokeAllSessions(user.id);
    audit('system', 'user.suspend', 'user', user.id, { reason: 'capture_attempts', strikes });
  }
  save();

  const message = blocked
    ? 'Your account has been suspended because of repeated screenshot or recording attempts. Contact support if you think this is a mistake.'
    : strikes === 1
      ? 'A possible screenshot or recording attempt was detected. Recording or sharing this video is not allowed. We emailed you a warning. If it happens again the creator is told, and your access can be restricted.'
      : `Another possible screenshot or recording attempt was detected (attempt ${strikes}). The creator has been told. More attempts can lead to removal from the course or a suspended account.`;
  return { counted: true, strikes, blocked, creatorNotified, message };
};
