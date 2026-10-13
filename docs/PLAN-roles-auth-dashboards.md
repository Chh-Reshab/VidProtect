# VidProtect AI — Plan: Learner Dashboard, Creator Studio & Auth

Status: **Phase 1 implemented** (frontend, mock data) · Phases 2–4 pending decisions D1–D3 · Date: 2026-10-13

---

## 0. Where the project is today

Facts taken from the current code. The plan is built on these.

| Area | Current state | Problem |
|---|---|---|
| Roles | `seedData.js` has one hardcoded `creator` and 7 `student`s | No platform-admin role. "Admin dashboard" is really the creator's dashboard |
| Login | `authLogin()` in `mockServices.js` checks against seed data. Students log in with `demo1234` | **A student who logs in gets the full creator dashboard.** `ProtectedRoute` only checks `isAuthenticated`, never the role |
| Register | `authRegister()` returns `id: 'new-creator'` and saves nothing | Every sign-up becomes a creator. Nobody can register as a learner |
| Session | The whole user object goes into `sessionStorage` (`vp_user`) | The creator's **password** gets stored in the browser. Anyone can edit `role` in DevTools |
| Data | Everything lives in `localStorage` | No real ownership. Every creator would see every video |
| Video access | `VideoDetailPage` lets the creator *simulate* a student ("select student → verify") | There's no real player for learners and no real token check |
| Ownership fields | Courses and videos already have `creatorId`, and enrollments link `studentId ↔ courseId` | Good foundation. Nothing reads these fields yet |

**Takeaway:** the UI is solid, but nothing in the app is aware of roles. The work below splits the app into three role-specific areas and puts real auth behind them.

---

## 1. Role model

| Role | Who | Main surface |
|---|---|---|
| `learner` (rename of `student`) | People who enroll in and watch courses | **Learner Dashboard** (new) at `/learn/*` |
| `creator` | People who upload videos and run courses | **Creator Studio** (the existing dashboard, scoped to their own content) at `/studio/*` |
| `admin` | Platform operators (you) | **Admin Console** (new, small) at `/admin/*` |

Rules:
- A user has **one primary role**. A creator can also enroll in other creators' courses as a learner, so creators get the `/learn` area too. This is better than giving users several roles.
- New sign-ups are **learners** by default. A learner becomes a creator through "Become a creator" (onboarding form). An admin approves it, or it's approved automatically (decision D2).
- Account status is one of `active | suspended | pending_verification`. This is separate from role, and suspended accounts are blocked everywhere.

---

## 2. Permission matrix (authorization)

Two layers: **RBAC** (what a role may do at all) plus **ownership checks** (whether this specific resource belongs to you or you're enrolled in it).

| Action | Learner | Creator | Admin |
|---|---|---|---|
| Browse published course catalog | ✅ | ✅ | ✅ |
| Enroll in a course | ✅ | ✅ (others' courses) | — |
| Watch a video | ✅ **if enrolled + course published + account active** | ✅ own videos (preview) or if enrolled | ✅ (audit only) |
| See own progress / history / certificates | ✅ own | ✅ own | ✅ all |
| Create / edit / delete course | ❌ | ✅ **own only** | ✅ any (moderation) |
| Upload / replace / delete video | ❌ | ✅ **into own courses only** | ✅ remove only |
| Manage enrollments (add/remove/suspend learner) | ❌ | ✅ **own courses only** | ✅ any |
| View access logs & security alerts | ❌ (own login history only) | ✅ **for own content only** | ✅ all |
| Approve creators, suspend users, change roles | ❌ | ❌ | ✅ |
| Platform settings | ❌ | own studio settings | ✅ |

Permission names (used in code on both frontend and backend):

```
course:read            course:create         course:update:own     course:delete:own
video:stream           video:upload:own      video:update:own      video:delete:own
enrollment:self        enrollment:manage:own
logs:read:own          alerts:read:own       alerts:update:own
user:manage            creator:approve       content:moderate      (admin only)
```

The frontend uses these only to **hide UI**. The **backend must re-check every one**, because anything in the browser can be edited.

---

## 3. Learner Dashboard (new) — `/learn/*`

### Pages

| Route | Page | Contents |
|---|---|---|
| `/learn` | **Home** | "Continue watching" row (last video + progress bar), enrolled-course cards with % complete, recent activity, announcements from creators |
| `/learn/courses` | **My Courses** | Grid of enrolled courses with filters (In progress / Completed / All) and progress per course |
| `/learn/catalog` | **Browse** | Published courses from all creators, search, "Enroll" / "Request access" button |
| `/learn/course/:courseId` | **Course page** | Ordered video list with lock/complete status, description, creator info |
| `/learn/watch/:videoId` | **Secure Player** | The real playback screen. Requests a stream token, plays, saves progress every ~10s, shows a watermark overlay with the learner's email and session id |
| `/learn/history` | **Watch history** | Videos watched, timestamps, devices |
| `/learn/account` | **Account** | Profile, change password, active sessions/devices (with "sign out other devices"), email verification status |

### Learner-specific security UX
- If access is denied, show the reason: not enrolled, enrollment suspended, token expired, or device limit reached. The `AccessDenied` component in `VideoDetailPage.jsx` (currently unused) can be reused for this.
- Show a **dynamic watermark** (email + timestamp + session id moving over the video). This is the main deterrent against screen-recording leaks.
- Show a concurrent-session warning: "You are watching on another device."

### New data the learner dashboard needs
- `progress` → `{ userId, videoId, positionSeconds, completed, updatedAt }`
- `course.published` / `course.visibility` (`public | invite_only`)
- An ordering field: `video.position` inside a course

---

## 4. Creator Studio (the existing dashboard, made role-aware) — `/studio/*`

The current `/app/*` pages move here, filtered to `creatorId === currentUser.id`.

| Current page | Changes |
|---|---|
| `OverviewPage` | Stats are computed **only from this creator's courses and videos**. Add an earnings/enrollments trend later |
| `LibraryPage` | Filter by `creatorId` |
| `UploadPage` | Course dropdown lists only own courses. Upload goes through a real pipeline (see below) |
| `CoursesPage` | Add Create/Edit course, publish/unpublish toggle, invite-by-email, reorder videos |
| `VideoDetailPage` | Remove the "simulate a student" demo. Keep a **creator preview** player plus per-video analytics and logs |
| `AccessLogsPage` / `SecurityAlertsPage` | Show only events tied to own content |
| `SettingsPage` | Studio settings: token expiry, max devices per learner, watermark on/off, download protection |

### Creator onboarding
1. A learner clicks **Become a creator**.
2. They fill a form: display name, bio, payout info (later), and accept the content policy.
3. Their status becomes `creator_pending`. An admin approves it, or it's approved automatically (D2).
4. Their role becomes `creator` and `/studio` unlocks.

### Upload pipeline (the real version)
```
Creator browser ──(1) POST /videos  {courseId, title}──▶ API
                  checks: role=creator, course.creatorId == me
                ◀─(2) presigned upload URL (S3/R2), videoId, status=uploading
Creator browser ──(3) PUT file directly to object storage (resumable / multipart)
Storage event  ──(4) Transcode job (FFmpeg / MediaConvert / Mux)
                  → HLS renditions, AES-128 encrypted segments, thumbnail
                  status: uploading → processing → ready | failed
API            ──(5) Marks video ready, notifies creator
```
- Validate file type and size **on the server**, not just in the browser.
- The raw upload bucket is **private**. Learners only ever get short-lived signed URLs for the HLS playlist.

---

## 5. Admin Console (small, new) — `/admin/*`

Keep it minimal at first:
- `/admin` — platform stats (users by role, uploads/day, open alerts)
- `/admin/users` — search users, change role, suspend/reactivate, force sign-out
- `/admin/creators` — approve or reject creator applications
- `/admin/content` — take down a course or video (moderation)
- `/admin/audit` — audit log of admin actions

---

## 6. Authentication design

### 6.1 Phase 1 — role-aware mock (frontend only, no backend yet)
Gets the UX right and closes the obvious holes in the demo:
- Stop storing passwords in seed users that get sent to `sessionStorage`. Store only `{ id, name, email, role, status }`.
- `authRegister` creates a **learner** and saves it to `localStorage` (`vp_users`).
- Add `role` to the redirect after login: learner → `/learn`, creator → `/studio`, admin → `/admin`.
- Add `RequireRole` / `RequirePermission` route guards (see §7).
- **Be clear in the README that this is still a demo.** Browser-side auth can always be bypassed.

### 6.2 Phase 2 — real backend auth
**Recommendation:** Node.js (Fastify or Express) + PostgreSQL + Prisma/Drizzle, with auth built in-house using the standard pattern below.
Alternative that ships faster: **Supabase** (Auth + Postgres + Row Level Security + Storage) or **Clerk** + your own API. Decision D1.

If built in-house:

| Concern | Choice |
|---|---|
| Password hashing | **argon2id** (or bcrypt cost 12) |
| Access token | JWT, **15 min** lifetime, signed with RS256/EdDSA. Kept **in memory** in React (not localStorage). Claims: `sub, role, status, sid` |
| Refresh token | Random opaque token in an **httpOnly, Secure, SameSite=Strict cookie**, stored *hashed* in DB, **rotated on every use**. Reuse of an old token revokes the whole session family |
| Sessions table | One row per device. Powers "active devices", "sign out everywhere" and the max-devices policy |
| Email verification | Required before enrolling or uploading |
| Password reset | One-time token, 30-min lifetime, hashed in DB, all sessions revoked after reset |
| Brute force | Rate limit `/auth/*` per IP and per account. Progressive delay or lockout after N failures. Log to `security_alerts` |
| OAuth (optional) | Google sign-in for learners |
| 2FA | TOTP, **required for admins**, optional for creators (they own valuable content) |
| CSRF | SameSite=Strict cookie plus refresh only via POST with a custom header |
| Logout | Delete the session row and clear the cookie |

Auth endpoints:
```
POST /auth/register          { name, email, password }        → learner, sends verification email
POST /auth/verify-email      { token }
POST /auth/login             { email, password, totp? }       → { accessToken } + refresh cookie
POST /auth/refresh                                            → new access + rotated cookie
POST /auth/logout
POST /auth/forgot-password   { email }
POST /auth/reset-password    { token, password }
GET  /auth/me
GET  /auth/sessions          DELETE /auth/sessions/:id
POST /creator/apply          (learner → creator_pending)
```

### 6.3 Protecting the video stream
This is the product's core promise.
1. The player calls `POST /videos/:id/stream-token`.
2. The server checks:
   - user is active and email verified
   - **enrolled and active** in the video's course (or is the owner or an admin)
   - course is published
   - session count is under the creator's device limit
3. The server returns a token valid for **1–5 min**, bound to `userId + videoId + sessionId` (optionally IP or user agent too).
4. HLS playlist and segment URLs are **signed CDN URLs**. The AES **key endpoint** re-checks the token on every key request.
5. Every grant and denial is written to `access_logs`. Anomaly rules raise `security_alerts`:
   - the same account on more than N IPs per hour
   - an expired token reused
   - rapid segment scraping
6. The player shows a dynamic watermark.

Be honest in the README and marketing: AES-128 HLS with signed URLs stops casual link sharing and hot-linking, not a determined pirate. Real DRM (Widevine/FairPlay through Mux, Bitmovin, VdoCipher, etc.) is the upgrade path (decision D3).

---

## 7. Authorization implementation

### Backend (the part that actually enforces access)
```js
// middleware
requireAuth          // verify JWT, load user, reject if status != active
requireRole('creator', 'admin')
requirePermission('video:upload:own')

// ownership checks — inside handlers / a policy module
const policies = {
  'course:update': (user, course) => user.role === 'admin' || course.creatorId === user.id,
  'video:stream':  (user, video, ctx) =>
      user.role === 'admin' || video.creatorId === user.id ||
      (ctx.enrollment?.status === 'active' && ctx.course.published),
};
```
- Every list query is scoped in SQL (`WHERE creator_id = $me`), not filtered after fetching.
- Optional extra safety layer: Postgres Row-Level Security (this comes built in with Supabase).
- Return **404, not 403**, for resources the user doesn't own, so IDs can't be probed.

### Frontend (UX only)
- New `src/auth/` folder:
  - `permissions.js`: role → permission map, the same table as §2
  - `AuthContext.jsx`: replaces the auth part of `AppContext`. Holds `user` and `accessToken` in memory, refreshes silently on load and on 401
  - `RequireAuth`, `RequireRole`, `Can` (`<Can do="video:upload:own">…</Can>`)
  - `api.js`: fetch wrapper. Attaches the bearer token, retries once after refresh on a 401
- Each layout builds its own `NAV_ITEMS` from the user's permissions.

### New route tree
```
/                         Landing (public)
/login /register /forgot-password /reset-password /verify-email
/learn/*                  RequireRole(learner, creator)   → LearnerLayout
/studio/*                 RequireRole(creator)            → StudioLayout   (current AppLayout)
/admin/*                  RequireRole(admin)              → AdminLayout
/app/*                    → redirect to the user's home by role (keeps old links working)
```

---

## 8. Data model (Phase 2 — Postgres)

```
users            id, email (unique), password_hash, name, role [learner|creator|admin],
                 status [pending_verification|active|suspended], email_verified_at,
                 totp_secret?, created_at
creator_profiles user_id PK, display_name, bio, approval_status [pending|approved|rejected],
                 approved_by, approved_at
sessions         id, user_id, refresh_hash, family_id, user_agent, ip, created_at,
                 last_used_at, revoked_at
courses          id, creator_id → users, title, description, visibility [public|invite_only],
                 status [draft|published|archived], thumbnail_url, created_at
videos           id, course_id, creator_id, title, description, position, duration_s,
                 status [uploading|processing|ready|failed], storage_key, hls_key_id,
                 size_bytes, created_at
enrollments      id, user_id, course_id, status [active|suspended|revoked], source
                 [self|invite|admin], created_at        UNIQUE(user_id, course_id)
progress         user_id, video_id, position_s, completed, updated_at   PK(user_id, video_id)
stream_tokens    id, user_id, video_id, session_id, expires_at, revoked_at
access_logs      id, user_id, video_id, course_id, creator_id, event, result, reason, ip,
                 user_agent, created_at
security_alerts  id, creator_id, user_id, type, severity, details jsonb, review_status, created_at
audit_log        id, actor_id, action, target_type, target_id, meta jsonb, created_at
```

`creator_id` is duplicated onto videos, logs and alerts on purpose. Every creator-scoped query then uses a single indexed `WHERE`.

---

## 9. Delivery phases

### Phase 1 — Role-aware frontend on mock data (≈1–1.5 weeks)
1. Move auth into `src/auth/` (`AuthContext`, `permissions.js`, guards). Remove passwords from the session payload.
2. Fix `authLogin` and `authRegister`: register creates a learner and saves users to `vp_users`. Add a demo admin.
3. Split `AppLayout` into `StudioLayout` / `LearnerLayout` / `AdminLayout`, with nav built from permissions.
4. Move existing pages under `/studio`, filter all mock-service reads by `creatorId`, and add `/app/*` redirects.
5. Build the learner pages: Home, My Courses, Catalog (with enroll), Course page, Secure Player (mock token + watermark + progress saved to `vp_progress`), Account.
6. Add a "Become a creator" flow and the admin page that approves it.
7. Update the login page: tabs or role hints, demo buttons for learner, creator and admin.
8. Fix the existing lint warnings in the files being touched.

### Phase 2 — Backend & real auth (≈2–3 weeks)
1. Scaffold the API (`/server` or a separate repo), Postgres, migrations from §8, seed script.
2. Auth endpoints from §6.2: argon2, JWT access token, rotating refresh cookie, email verification, reset, rate limiting.
3. Policy module and middleware from §7, plus integration tests for **every row of the §2 matrix**: allowed and denied cases, learner A vs. learner B, creator A vs. creator B.
4. Replace `mockServices.js` calls with `api.js` one page at a time (same function names, so pages barely change).

### Phase 3 — Secure upload & streaming (≈2 weeks)
1. Presigned multipart uploads, transcode worker to HLS (AES-128), status webhooks.
2. Stream-token endpoint, key server, signed CDN URLs, hls.js player in `/learn/watch/:id`.
3. Access logging and anomaly rules that feed `security_alerts`.

### Phase 4 — Hardening
TOTP 2FA (admins required), device limits, admin audit log, CSP and security headers, dependency scanning, an outside pentest of the stream-token flow, optional DRM provider.

---

## 10. Decisions needed from you

| # | Question | Recommendation |
|---|---|---|
| D1 | Backend: build our own (Node + Postgres) or use Supabase/Firebase/Clerk? | **Supabase** if speed matters (Auth + RLS + Storage included). **Node + Postgres** if you want full control and to learn the stack |
| D2 | Creator accounts: approved by an admin, or anyone can become a creator immediately? | Admin approval (stops abusive uploads) |
| D3 | Video protection level: HLS AES-128 + watermark, or a paid DRM provider? | Start with HLS + watermark. Add DRM when paying customers ask for it |
| D4 | Paid courses (Stripe) now or later? | Later. Keep `enrollments.source` so `purchase` can be added |
| D5 | Can creators also be learners in other creators' courses? | Yes (assumed above) |

---

## 11. Acceptance checklist

- [ ] A learner who opens `/studio/*` or `/admin/*` is redirected, and a direct API call gets 401/403/404.
- [ ] Creator A cannot see, edit, stream-manage or view logs for Creator B's content, either in the UI or through the API.
- [ ] A learner cannot get a stream token for a course they aren't actively enrolled in, a draft course, or while suspended.
- [ ] Stream tokens expire in ≤ 5 min. Reusing an expired token is denied and logged.
- [ ] No password, hash or long-lived token is ever in `localStorage` or `sessionStorage`.
- [ ] Refresh-token reuse revokes the session family.
- [ ] Login is rate limited, and failed-login bursts raise a security alert.
- [ ] Every row of the permission matrix has an automated test.
