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
| **Learner** | `/learn` | Browse and enrol in published courses, watch through a secure player (token + watermark), track progress, see watch history, apply to become a creator |
| **Creator** | `/studio` | Create/publish courses, upload videos, manage enrollments, view logs and alerts **for their own content only** |
| **Admin** | `/admin` | Approve creators, suspend users, change roles, take down courses/videos, audit log |

Demo accounts (password `demo1234`): `sarah@student.demo` (learner), `creator@vidprotect.demo` and `maya@creator.demo` (creators), `admin@vidprotect.demo` (admin). New sign-ups are learners. `daniel@student.demo` has a pending creator application for the admin to review.

Everything is enforced by the **Express API** in `server/`: JWT access tokens (15 min, in memory) plus an httpOnly rotating refresh cookie, role checks and ownership checks on every request, and an enrollment check on every video byte-range request. See [docs/PLAN-roles-auth-dashboards.md](docs/PLAN-roles-auth-dashboards.md) for the full design.

### Real video uploads
Creators upload real video files (MP4, WebM, MOV, MKV, AVI, up to 2 GB) through `POST /api/courses/:id/videos`. The server verifies course ownership *before* accepting the file, checks the real file signature, stores it under a random name in `server/uploads/`, and streams it back with HTTP range requests (seeking works). Learners get a 5-minute playback session that is re-checked on every request, so suspending a learner or removing their enrollment stops playback.

Not yet done: encryption at rest, transcoding to HLS, cloud object storage, email verification, 2FA. The sample videos from the seed data have no media file and play a simulated clock.


## 🛠️ Technology Stack

- **Frontend**: React 19, JavaScript
- **Backend**: Node.js + Express 5 (JWT, bcrypt, multer, helmet), JSON-file database
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
Environment variables: `JWT_SECRET` (required in production), `API_PORT` (default 4000), `VP_DATA_DIR`, `VP_UPLOAD_DIR`, `AUTH_RATE_LIMIT` (login attempts per 15 min per IP, default 30).

## 🔐 Demo Accounts
To explore the application locally, you can use the pre-configured demo credentials:
- **Email:** `creator@vidprotect.demo`
- **Password:** `demo1234`

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
