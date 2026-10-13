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

> **Demo only:** auth and authorization run in the browser with `localStorage`, so they can be bypassed with DevTools. The rules (role guards, ownership checks, enrollment check before any stream token) are written the way a backend must enforce them. See [docs/PLAN-roles-auth-dashboards.md](docs/PLAN-roles-auth-dashboards.md) for the backend plan.

## 🛠️ Technology Stack

- **Core**: React 19, JavaScript
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

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:5173` to view the application.

## 🔐 Demo Accounts
To explore the application locally, you can use the pre-configured demo credentials:
- **Email:** `creator@vidprotect.demo`
- **Password:** `demo1234`

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/Chh-Reshab/VidProtect/issues).

---
*Developed by Secure Sphere
