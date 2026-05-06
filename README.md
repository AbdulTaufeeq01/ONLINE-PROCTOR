# 🎓 ONLINE PROCTOR — AI-Powered Exam Proctoring

Comprehensive, real-time online exam proctoring and cheating-detection platform built with Next.js, TypeScript, and Supabase. This README explains how to set up, develop, test, deploy, and extend the project.

Table of Contents
- Overview
- Quick start
- Prerequisites
- Installation
- Environment variables
- Models & ML assets
- Running the app (dev & prod)
- Database & Supabase setup
- Project structure & key modules
- Proctoring internals
- Cheating detection & AI features
- API reference
- Testing (unit & e2e)
- Deployment
- Security & privacy
- Troubleshooting
- Contributing
- License & support

Overview
--------

Online Proctor is a web application for administering proctored exams with real-time monitoring, automated behavior logging, and AI-assisted cheating detection. Features include:
- Role-based user flows (teacher, student)
- Exam creation, scheduling, and invites
- Live monitoring dashboard and real-time flags
- Local webcam-based face detection and gaze events
- AI writing detection using Google Gemini (configurable)
- PDF report generation and analytics

Quick start
-----------

1. Clone the repository and install dependencies:

```bash
git clone https://github.com/AbdulTaufeeq01/ONLINE-PROCTOR.git
cd proctor-app
npm install
```

2. Copy the environment file and adapt values:

```bash
cp .env.local.example .env.local
# Edit .env.local with your keys
```

3. Place ML models (see Models & ML assets).

4. Start development server:

```bash
npm run dev
# Open http://localhost:3000
```

Prerequisites
-------------
- Node.js 18+ and npm 9+
- Supabase project (Postgres + Auth)
- Optional: Google Cloud account for Gemini API
- Optional: Daily.co account for optional video rooms

Installation
------------

- Install packages: `npm install`
- Format & lint: `npm run lint` and `npm run format` (if configured)

Environment variables (.env.local)
--------------------------------

Create a `.env.local` file in the repository root with values appropriate for your environment. Example keys and descriptions:

```env
# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase (browser-safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key

# Supabase (server-only - keep secret)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Google Gemini (optional; used for AI-writing detection)
GOOGLE_API_KEY=your_google_cloud_api_key

# Daily.co (optional: video rooms)
NEXT_PUBLIC_DAILY_API_KEY=your_daily_api_key

# Resend (email delivery)
RESEND_API_KEY=your_resend_api_key

# App secrets
NEXTAUTH_SECRET=some_long_random_secret

# Other flags
NEXT_PUBLIC_ENABLE_GEMINI=true
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser.
- Use environment-specific variables for staging/production.

Models & ML assets
-------------------

Face detection and other ML models are stored under `public/models/` (these are the TensorFlow.js / face-api.js model files). The repository includes model manifests under `public/` and `public/models/` already, but if you update them, place the shard and manifest files in that folder.

Key model files (examples):
- `public/models/tiny_face_detector_model-weights_manifest.json`
- `public/models/face_landmark_68_model-weights_manifest.json`

If the detector cannot find models, confirm the files exist in `public/models/` and that the browser can fetch them (CORS served by Next.js public folder).

Running the app
---------------

Development

```bash
npm run dev
# Visit http://localhost:3000
```

Production build

```bash
npm run build
npm start
```

Docker (optional)

```bash
docker build -t online-proctor .
docker run -p 3000:3000 -e NEXT_PUBLIC_SUPABASE_URL=... -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... online-proctor
```

Database & Supabase setup
-------------------------

1. Create a Supabase project and copy your `SUPABASE_URL` and service keys into `.env.local`.
2. Apply the SQL schema and RPC functions. There is an SQL file in the repository: [PART3_RPC_FUNCTIONS.sql](PART3_RPC_FUNCTIONS.sql) — run these SQL commands in your Supabase SQL editor to create needed functions and stored procedures.
3. Create the tables described in the `Database Schema` section of the docs (or run provided migrations if available).
4. Configure Row-Level Security (RLS) and appropriate policies for tables. The app assumes you use server-side RPCs for privileged operations.

Project structure (high level)
------------------------------

Notable folders and files:
- `src/app/` — Next.js App Router routes and pages
- `src/components/` — Reusable UI components (Exam monitor, ExamTaker, etc.)
- `proctoring/frontend/` — Client-side proctoring utilities (webcam capture, trackers)
- `cheating_detection/` — Cheating detection components and docs
- `public/models/` — ML model files used in the browser
- `PART3_RPC_FUNCTIONS.sql` — SQL RPC functions used by the backend
- `middleware.ts` — App middleware (session checks, security)

Proctoring internals
--------------------

Client-side proctoring lives in `proctoring/frontend/`. Key modules:
- `WebcamCapture.ts` — captures frames and exposes them for local analysis
- `AudioVAD.ts` — crude voice activity detection (audio-based events)
- `ProctoringSession.ts` — integrates capture, trackers, and event batching
- `ScreenLockEnforcer.ts` — enforces fullscreen and prevents switching in supported browsers
- `WindowFocusTracker.ts` & `ClipboardTracker.ts` & `KeyboardTracker.ts` — detect off-focus events and copy/paste

Detection flow:
1. Client runs lightweight detectors (face-api.js) locally in the browser for privacy and latency.
2. Detection events are batched and sent to the backend (`/api/flag-event`) to persist in `behavior_logs` and `flags` tables.
3. Teachers' monitoring UI subscribes to realtime updates using Supabase Realtime channels.

Cheating detection & AI features
-------------------------------

AI writing detection:
- The app includes endpoints to submit textual answers to an AI-detection pipeline.
- By default this integrates with Google Gemini API; configure `GOOGLE_API_KEY` and enable Gemini in `.env.local`.
- Detection occurs server-side to avoid exposing API keys.

Collusion & pattern detection:
- The system aggregates behavioral flags, timing patterns, similarity between answers, and network metadata to estimate session-level risk.

API reference
-------------

Main API routes are under `src/app/api/`. See the inline API documentation and the summary in this repository's docs (`API_REFERENCE_CHEATING_DETECTION.md`). Example endpoints:
- `POST /api/flag-event` — receive behavior flags from clients
- `POST /api/detect-ai-writing` — analyze answers for AI-generated text
- `POST /api/student/exams/:id/start` — start a session

Testing
-------

Unit tests:
- The repository may include unit tests (check `package.json` scripts). Typical commands:

```bash
npm run test
npm run test:watch
```

End-to-end tests:
- Use Playwright or Cypress depending on project setup. If not present, add e2e tests under `tests/e2e/`.

Lint & formatting

```bash
npm run lint
npm run format
```

Deployment
----------

Vercel (recommended):
1. Connect the repo to Vercel.
2. Set environment variables in the Vercel dashboard (do NOT include `SUPABASE_SERVICE_ROLE_KEY` in client-only variables).
3. Deploy; Vercel will build using `npm run build`.

Docker:
- Ensure env variables are passed to the container.
- Use process managers like PM2 for long-running servers if running outside Vercel.

Security & privacy
------------------

- Keep the `SUPABASE_SERVICE_ROLE_KEY` server-side only. Use RPC functions for privileged operations.
- All face detection runs in the browser; only events and non-sensitive metadata are sent to servers to reduce privacy exposure.
- Enable HTTPS in production and set up CSP headers in `next.config.ts` or a reverse proxy.

Troubleshooting
---------------

- Face models not loading: verify `public/models/` files and browser fetch path.
- Webcams not detected: check browser permissions and secure context (HTTPS or localhost).
- Emails not sending: confirm `RESEND_API_KEY` and check service dashboard.

Contributing
------------

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Run tests and linters locally.
4. Open a Pull Request with a clear description and screenshots if relevant.

If you plan to add heavy ML models or a new third-party integration, open an issue first to discuss design and boundaries.

Related docs in this repo
-------------------------
- [API_REFERENCE_CHEATING_DETECTION.md](API_REFERENCE_CHEATING_DETECTION.md)
- [CHEATING_DETECTION_INTEGRATION.md](CHEATING_DETECTION_INTEGRATION.md)
- [PART3_RPC_FUNCTIONS.sql](PART3_RPC_FUNCTIONS.sql)
- [proctoring/frontend/README.md](proctoring/frontend/README.md) (if present)

License & support
-----------------

This repository is proprietary. For issues and support, open an issue in the repo or email the maintainers.

Contact
-------

Author: Abdul Taufeeq
Repository: https://github.com/AbdulTaufeeq01/ONLINE-PROCTOR

Last updated: 2026-05-05
