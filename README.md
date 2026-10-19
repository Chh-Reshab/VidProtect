# VidProtect AI

**VidProtect AI** is a premium content security platform built for creators to protect their video IP. It prevents unauthorized sharing and piracy using advanced encryption architectures and smart access management. 

This repository contains the frontend web application, built with React and Vite, featuring a sleek, dark-mode 90s Brutalist/Cybersecurity UI design system.

## 🚀 Key Features

- **Secure Access Control**: Robust, simulated JWT authentication and learner verification before video streaming is authorized.
- **Encrypted Storage Architecture**: Built to integrate with AES-256 secure streaming token mechanisms.
- **Real-Time Security Monitoring**: Dashboard for creators to track access logs, token expiries, and anomalous viewer behaviors (like repeated denials or expired token reuse).
- **Responsive & Modern UI**: A premium user interface utilizing custom CSS, micro-animations, and responsive layouts to deliver a seamless experience.

## 👥 Roles & Dashboards

| Role | Area | What they can do |
|---|---|---|
| **Learner** | `/learn` | Browse and enrol in published courses, watch through a secure player (token + watermark), track progress, see watch history. Learners stay learners |
| **Creator** | `/creator/login`, then `/studio` once approved | Own sign-up. Fills in an application (teaching history, CV and/or LinkedIn, other platforms) and stays locked until an admin approves it. Then create/publish courses, upload videos, manage enrollments, view logs and alerts **for their own content only** |
| **Admin** | `/login`, then `/admin` | Review creator applications,  suspend users, change roles, take down courses/videos, audit log |

There are **no built-in accounts or passwords**. The admin account is created at start-up from `ADMIN_EMAIL` and `ADMIN_PASSWORD` (both required in production). On a development machine without them, the first start creates the admin `admin@vidprotect.local` with the password `VidProtect@Admin1` (see `server/bootstrap.js`). That default is never used in production. Everyone else signs up: learners at `/login`, creators at `/creator/login`. Databases created by older versions have their built-in beta accounts (`*.demo`) and sample courses removed automatically on the next start.

Everything is enforced by the **Express API** in `server/`: JWT access tokens (15 min, in memory) plus an httpOnly rotating refresh cookie, role checks and ownership checks on every request, and an enrollment check on every video byte-range request. See [docs/PLAN-roles-auth-dashboards.md](docs/PLAN-roles-auth-dashboards.md) for the full design.

### Real video uploads
Creators upload real video files (MP4, WebM, MOV, MKV, AVI, up to 2 GB) through `POST /api/courses/:id/videos`. The server verifies course ownership *before* accepting the file, checks the real file signature, stores it under a random name in `server/uploads/`, and streams it back with HTTP range requests (seeking works). Learners get a 5-minute playback session that is re-checked on every request, so suspending a learner or removing their enrollment stops playback.

Not yet done: encryption at rest, transcoding to HLS, cloud object storage, email verification, 2FA. The sample videos from the seed data have no media file and play a simulated clock.


## 🛠️ Technology Stack

- **Frontend**: React 19, JavaScript
- **Backend**: Node.js + Express 5 (JWT, bcrypt, multer, helmet). Data: a JSON file in development, **MongoDB** (Atlas free tier) when `MONGODB_URI` is set; encrypted videos in the uploads folder or MongoDB GridFS
- **Styling**: Vanilla CSS (Global Design System with CSS variables)
- **Icons**: Lucide React
- **Build Tool**: Vite

## 📦 Installation & Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Chh-Reshab/VidProtect.git
   cd VidProtect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run the app (web + API together)**
   ```bash
   npm run dev
   ```
   This starts Vite on `http://localhost:5173` and the Express API on `http://localhost:4000` (Vite proxies `/api`). The database (`server/data/db.json`) and uploaded videos (`server/uploads/`) are created on first run and are git-ignored. Delete `server/data` to reset to the seed data.

4. **Open your browser**
   Navigate to `http://localhost:5173`.

### Production
```bash
npm run build
JWT_SECRET=<long random string> NODE_ENV=production npm run server   # serves the API and the built app
```
Environment variables: `JWT_SECRET` (required in production), `API_PORT` (default 4000), `VP_DATA_DIR`, `VP_UPLOAD_DIR`, `AUTH_RATE_LIMIT` (login attempts per 15 min per IP, default 30), `AUDIT_LIMIT` / `LOG_LIMIT` (how many audit-log / access-log entries are kept, default 5,000 / 10,000).

## 🔐 Accounts
There are no demo accounts. Locally, sign in at `/login` as `admin@vidprotect.local` with `VidProtect@Admin1`. In production set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (at least 12 characters).

## 🔒 Account security

- **Passwords** are hashed with bcrypt and must be 8 to 72 bytes with a letter, a number and a special character.
- **Forgot password:** the sign-in page offers a reset link by email (needs the email setup below; on a developer machine the link is printed in the console). Links work once for 1 hour and sign every device out.
- **Two-step verification (TOTP):** on the profile / settings / admin account page anyone can turn on codes from an authenticator app (Google Authenticator, Authy...), with 10 one-time recovery codes. Strongly recommended for creators and admins. Secrets are stored encrypted with the master key (the `npm run rotate:key` script re-encrypts them too).
- **Delete account:** each person can delete their own account and data (password, and a code if two-step is on). A creator whose published courses still have learners must unpublish them first, and the last admin cannot be deleted. Admins can delete accounts from the Users page. Payment records are kept without the person.
- **Legal pages:** `/terms`, `/privacy` and `/refund-policy` are plain HTML pages the server sends (and the same text appears inside the app). Signing up requires ticking that you agree; the date and version are saved on the account (`termsAcceptedAt`, `termsVersion`). The text is in `shared/legal.js` and `shared/privacy.js`; the refund window and watch limit are two constants at the top of `shared/legal.js`. It is a starting point, not legal advice: have a lawyer check it, and the governing-law line.
- **Creator profiles:** before enrolling, a learner can click the creator's name (on a course, in the catalog or at checkout) to open their public profile: picture, headline, about, years of teaching and topics, links, achievements, and published courses. Badges ("Verified creator", number of courses and learners) are computed from real data; creators add their own highlights and choose whether to show their experience and links at `/studio/profile`. The CV and the application text are never shown. Admins can clear an inappropriate profile from the Users page.
- **Creator decisions** (approved / rejected, with the reviewer's note) are emailed to the applicant.
- **Screenshot / recording attempts:** while a video plays, the player watches for Print Screen and screenshot shortcuts (a website cannot see screen recorders, so this is a warning sign, not proof). 1st attempt: the learner is warned on screen and by email. 2nd and later: the creator gets an alert in the studio and an email, with a button to remove the learner from the course. Optional automatic suspension is **off by default**. Settings: `CAPTURE_ALERT_FROM` (default 2), `CAPTURE_BLOCK_AFTER` (default 0 = never; e.g. 5), `CAPTURE_DECAY_DAYS` (default 30), `CAPTURE_DEDUPE_MS` (default 30000). The privacy page tells learners about this.
- A strict **Content Security Policy** is sent with every response (scripts only from this site and Razorpay).

## 🧪 Tests and quality

```bash
npm test        # ~550 checks: starts the real server on a free port per test file, no setup needed
npm run lint
```

The suites cover sign-up and sign-in rules, roles and ownership, creator applications, password reset, two-step verification, account deletion, email verification, encryption and streaming, thumbnails, payments (built-in checkout and Razorpay with a fake Razorpay), the admin bootstrap, and security headers. `test/mongodb.test.js` also needs a real MongoDB: set `MONGODB_TEST_URI=mongodb://127.0.0.1:27017` to run it (it is skipped otherwise). GitHub Actions runs everything, with a MongoDB service, on every push (`.github/workflows/ci.yml`).

## 🗄️ Backups and keys

- `npm run backup` writes the database (accounts, courses, enrolments, payments, logs) to `backups/vidprotect-<date>.json`. It works with the JSON file and with MongoDB. The file holds password hashes: keep it private.
- The encrypted videos live in S3 / MongoDB / the uploads folder: back those up in that service.
- **Keep a copy of `VP_MASTER_KEY` somewhere safe.** Without it no video can be decrypted and two-step secrets cannot be read.
- `npm run rotate:key -- <new 64-hex key>` swaps the master key (see the script header).

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Chh-Reshab/VidProtect/issues).

---
*Developed by Secure Sphere

## Video encryption and keys

Every uploaded video is encrypted at rest with **AES-256-GCM** (64 KiB authenticated chunks, so tampering or truncation is detected and seeking still works). Each video has its own random key. That key is stored only in encrypted ("wrapped") form, using a master key that is kept outside the database.

- **Master key:** set `VP_MASTER_KEY` (64 hex characters) from your secrets manager. If it is not set, a key file is created at `server/data/master.key` on first run. **Back it up separately: without it, videos cannot be decrypted.**
- **Rotate the master key:** stop the server, run `node server/scripts/rotate-master-key.js <new 64-hex key>`, then start with the new key. Only the small wrapped keys are re-encrypted; video files are untouched.
- **Older videos** (AES-CTR or unencrypted) are re-encrypted automatically at startup and verified by hash before the old file is deleted.
- Payments run in **beta test mode** (test card `4242 4242 4242 4242`); no real money moves until a live payment provider is connected.
- **Upload processing:** after an upload the server verifies, encrypts and integrity-checks the video while the creator watches live progress; the video stays hidden from learners until it is ready. Each stage is shown for at least `VP_MIN_STAGE_MS` (default 1200 ms) so small files still show their progress; set it to `0` to run at full speed.

## Deploying to Render (free, with MongoDB Atlas free tier)

Render's free plan has a temporary disk, so the app keeps **everything in MongoDB Atlas** instead: the data lives in collections and the encrypted videos and thumbnails in GridFS. When `MONGODB_URI` is set the app uses MongoDB; when it is not (local development) it uses `server/data/db.json` and `server/uploads/` exactly as before.

### 1. Create the free database (MongoDB Atlas)
1. Sign up at mongodb.com/atlas and create a **free (M0) cluster**; pick a region close to your Render region.
2. **Database Access → Add New Database User**: choose a username and password (avoid `@ : / ?` in the password, or URL-encode them).
3. **Network Access → Add IP Address → Allow access from anywhere** (`0.0.0.0/0`): Render's free plan has no fixed IP.
4. **Connect → Drivers**: copy the connection string and add the database name, e.g.
   `mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/vidprotect?retryWrites=true&w=majority`

### 2. Deploy on Render
1. Push the repo to GitHub, then in Render: **New → Blueprint** (uses `render.yaml`) or **New → Web Service** with build `npm ci --include=dev && npm run build` and start `node server/index.js`.
2. In the service's **Environment** tab set:
   - `NODE_ENV` = `production`, `NODE_VERSION` = `22`
   - `JWT_SECRET`: any long random value (Render can generate it)
   - `ADMIN_EMAIL`: the email address of the admin account (the server creates it on first start).
   - `ADMIN_PASSWORD`: at least 12 characters, the admin's password. The server will not start in production without these two. Sign in at `/login`.
   - `VP_MASTER_KEY`: 64 hex characters (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`). Keep a copy: videos cannot be decrypted without it.
   - `MONGODB_URI`: the connection string from step 1.
3. Open the Render URL. Health check: `/api/health`. The first start creates the collections and the admin account.

### What to expect
- Accounts, courses, progress, purchases **and uploaded videos survive restarts and redeploys.**
- The Atlas free tier has **512 MB of storage, shared by data and videos**, so keep demo videos short. Atlas may pause a free cluster after a long period of inactivity; resume it from the Atlas dashboard.
- Render's free service sleeps after about 15 minutes idle and takes roughly a minute to wake.
- The app assumes **one server instance** (Render's free plan is one). Changes are written to MongoDB in small batches a fraction of a second after they happen, and flushed when the host stops the app.
- Test uploads first with small videos; large uploads depend on Render's request and memory limits.

### Moving existing local data into MongoDB
Your local accounts, courses and videos can be copied once (local files are left untouched):

```bash
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/vidprotect" npm run migrate:mongo
```

Use the **same `VP_MASTER_KEY`** you had locally (it is in `server/data/master.key` if you never set one), or the copied videos cannot be decrypted. The script refuses to run if the database already has data.

Locally nothing changes: `npm run dev` still uses ports 5173 (site) and 4000 (API). The `PORT` variable that Render provides is only used when `NODE_ENV=production`.

### Email verification (optional, free)

When a mail provider is configured, new accounts must confirm their email before they can sign in. Mail goes over HTTPS, so it works on Render's free plan, which blocks SMTP.

**Gmail (recommended, no domain needed):** emails are sent from your own Gmail address, signed by Google, so they are not marked as spam. About 500 a day.

1. Go to console.cloud.google.com, create a project, then open **APIs & Services → Library**, search "Gmail API" and **Enable** it.
2. **APIs & Services → OAuth consent screen**: choose **External**, fill in the app name and your email, and add your Gmail address under **Test users**. Then **Publish app** (set it to "In production"), or the refresh token expires after 7 days. You will see an "unverified app" warning for yourself; that is fine for personal use.
3. **Credentials → Create credentials → OAuth client ID → Desktop app**. Copy the client ID and client secret.
4. On your computer run `GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... npm run gmail:token`, open the printed link, approve, and copy the refresh token it prints.
5. On Render add `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` and `MAIL_FROM` (your Gmail address). Optionally `MAIL_FROM_NAME` and `APP_URL`.

**Brevo (alternative):** set `BREVO_API_KEY` and `MAIL_FROM` (an address verified in Brevo). Using a Gmail address there may land in spam; a domain you own works best. Gmail takes priority when both are set.

Without any of these variables nothing is sent and sign-up needs no verification (the logs warn about this in production). To try the flow locally without email, set `REQUIRE_EMAIL_VERIFICATION=true`: the verification link is printed in the server log.

### Google OAuth verification (only if you publish the Gmail app)

Google's reviewers open your home page and privacy page without signing in. The site now serves both as plain HTML: the home page explains what VidProtect AI is and links to the privacy policy, and `/privacy` is a full policy that includes the Gmail "Limited Use" statement. Set these on Render:

- `CONTACT_EMAIL`: the address shown on the privacy page (defaults to `MAIL_FROM`).
- `GOOGLE_SITE_VERIFICATION`: the token from Google Search Console's "HTML tag" method; the site adds the tag to the home page for you.

Keep the service awake while Google checks it (a sleeping Render service looks "unresponsive").

### Payments with Razorpay (optional)

Paid courses can be bought through Razorpay. **Test mode is free and needs no KYC**: no real money moves, and you pay with Razorpay's test cards.

1. Create an account at razorpay.com and switch the dashboard to **Test Mode**. Under **Account & Settings → API Keys**, generate a key and copy the **Key Id** (`rzp_test_...`) and **Key Secret**.
2. On Render add `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`. The checkout page then opens Razorpay's payment window.
3. Recommended: under **Account & Settings → Webhooks** add `https://YOUR-SITE/api/webhooks/razorpay`, choose the event **payment.captured**, type a secret of your own, and put the same value in `RAZORPAY_WEBHOOK_SECRET`. This completes the purchase even if the buyer closes the tab right after paying.
4. Pay in test mode with card `4111 1111 1111 1111` (any future expiry, any CVV, any OTP), or UPI `success@razorpay`.

How it is protected: the server creates the order and fixes the price from the course record. A purchase counts only after the payment signature is valid **and** Razorpay itself confirms the order and amount. A buyer cannot change the price, reuse another person's payment or pay for one course and get another.

To go live later, finish Razorpay's KYC, then replace the two keys with the `rzp_live_...` pair and add a live webhook. Without these variables the app keeps its built-in beta test checkout.

### Storing the encrypted videos in Amazon S3 (optional)

By default the encrypted videos live in MongoDB. To keep them in S3 instead:

1. In S3, create a private bucket (keep "Block all public access" on).
2. In IAM, create a user with an inline policy allowing `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::YOUR-BUCKET/*` and `s3:ListBucket` on `arn:aws:s3:::YOUR-BUCKET`, then create an access key for it.
3. On Render, add `S3_BUCKET`, `AWS_REGION`, `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. The logs then show `videos: s3`.

Videos are encrypted before they reach S3, so the bucket only ever holds ciphertext. MongoDB still stores accounts, courses and progress. Thumbnails go to S3 too.

