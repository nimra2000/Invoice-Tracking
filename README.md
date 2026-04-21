# Lesson Tracking

Invoice-and-lesson tracker for coaches. React + Vite client, Express + PostgreSQL server. Deployed on Vercel.

## Architecture at a glance

- **`client/`** — React + Vite SPA. Tailwind + minimal shadcn-style primitives.
- **`server/`** — Express app. PostgreSQL via `pg` (single JSONB document per install). Session auth with `express-session` + `connect-pg-simple`. Gmail send via `googleapis`.
- **`api/server.js`** — Vercel serverless entry that wraps the Express app.
- **`vercel.json`** — rewrites `/api/*` and `/auth/*` to the serverless function and serves `client/dist` for everything else.

User signs in with Google, which simultaneously grants `gmail.send` scope — tokens are stored in the session so the server can send invoice PDFs from the coach's own Gmail account.

## Running locally

You need two terminals — one for the API server on port `3002`, one for the Vite dev server on port `5173`. Vite proxies `/auth` and `/api` to the Express server.

### 1. Prerequisites

- Node 18+ (check `node -v`).
- PostgreSQL reachable from your machine (local Docker container, cloud DB, etc.).
- A Google Cloud project with an OAuth 2.0 Client ID configured (details below).

### 2. Google Cloud OAuth setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and select (or create) a project.
2. **Enable the Gmail API**: APIs & Services → Library → search "Gmail API" → Enable.
3. **OAuth consent screen** (left nav under APIs & Services):
   - User type: External (unless you're in a Workspace org).
   - Fill in app name, support email, developer contact.
   - **Authorized domains**: add your production domain (e.g. your Vercel subdomain's parent domain — `vercel.app` is on Google's public-suffix list so use your app's full subdomain like `lesson-tracking-foo.vercel.app` instead).
   - **Scopes**: add `userinfo.email`, `userinfo.profile`, `https://www.googleapis.com/auth/gmail.send`.
   - While in testing mode, add your own Google account to **Test users**.
4. **Credentials** → Create Credentials → OAuth client ID:
   - Application type: Web application.
   - **Authorized redirect URIs** — add BOTH:
     - `http://localhost:5173/auth/google/callback` (for local dev)
     - `https://<your-vercel-domain>/auth/google/callback` (for production)
   - Save. Copy the **Client ID** and **Client secret**.

### 3. PostgreSQL

Any reachable Postgres works. The server creates its own table on first run (`connect-pg-simple` with `createTableIfMissing: true` + a single-row `store` table for app data).

Quickest option — local Docker:

```bash
docker run -d --name lesson-pg -p 5432:5432 -e POSTGRES_PASSWORD=dev postgres:16
```

Connection string: `postgresql://postgres:dev@localhost:5432/postgres`

**Don't reuse your production `DATABASE_URL` locally** unless you're okay mutating production data.

### 4. Environment variables

Create `server/.env` from `server/.env.example`:

```
NODE_ENV=development
APP_URL=http://localhost:5173

DATABASE_URL=postgresql://postgres:dev@localhost:5432/postgres
SESSION_SECRET=<any random string — e.g. openssl rand -base64 32>

GOOGLE_CLIENT_ID=<from Google Cloud credentials>
GOOGLE_CLIENT_SECRET=<from Google Cloud credentials>
```

Notes:
- `NODE_ENV=development` enables CORS for `localhost:5173` and lets the session cookie work over plain HTTP.
- `APP_URL` is the base URL the server redirects to after OAuth. For local dev it must be `http://localhost:5173` (Vite).
- `SESSION_SECRET` signs the session cookie — any string works locally.

### 5. Install + run

```bash
# install server deps
cd server
npm install

# install client deps
cd ../client
npm install
```

Then in **two separate terminals**:

```bash
# terminal 1 — API server on :3002
cd server
npm run dev    # nodemon; auto-restarts on changes

# terminal 2 — Vite dev server on :5173
cd client
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and sign in with Google. First sign-in shows the `gmail.send` consent screen — approve it. You'll land on the Dashboard.

## Smoke test checklist

1. Sign in with Google.
2. Settings → fill in your coach profile; save.
3. Skaters → add a skater with a billing email.
4. Lessons → log a lesson for this month.
5. Invoices → pick the skater + month → Preview (opens PDF in new tab) → Send. Check the billing email inbox.
6. Settings → Data Backup → export skaters/lessons CSV, re-import the same file, confirm no duplicates or errors.

## Production (Vercel)

The root `package.json` has a `build` script that installs both folders and builds the client. `vercel.json` routes:

- `/api/*` and `/auth/*` → `api/server.js` (serverless)
- everything else → `client/dist/*`

Vercel environment variables (set in the project dashboard):

- `NODE_ENV=production`
- `APP_URL=https://<your-vercel-domain>`
- `DATABASE_URL` — production Postgres
- `SESSION_SECRET` — production secret
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

Make sure the production `APP_URL`'s `/auth/google/callback` is also added to the OAuth client's Authorized redirect URIs in Google Cloud.

## Troubleshooting

- **`http proxy error: /auth/google ECONNREFUSED`** in the Vite terminal — the Express server isn't running. Start it with `npm run dev` in `server/`.
- **`Cannot find module 'dotenv'`** — run `npm install` in `server/`.
- **`redirect_uri_mismatch`** from Google — the redirect URI doesn't match any entry in your OAuth client's Authorized redirect URIs. Add `http://localhost:5173/auth/google/callback` in Google Cloud Credentials.
- **Google shows "App isn't verified"** — in testing mode, the Google account you're signing in with must be listed under **Test users** on the OAuth consent screen.
- **Session cookie lost on refresh** — check that `NODE_ENV=development` locally so `secure: true` isn't set on the cookie (browsers reject secure cookies over plain HTTP).

## Project structure

```
.
├── api/server.js                       Vercel serverless entry (wraps Express)
├── client/                             Vite + React SPA
│   ├── src/
│   │   ├── App.jsx                     Sidebar shell + auth gate + routes
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Skaters.jsx
│   │   │   ├── Lessons.jsx
│   │   │   ├── Invoices.jsx
│   │   │   └── Settings.jsx            Profile + DataBackup
│   │   ├── components/
│   │   │   ├── DataBackup.jsx          CSV import/export
│   │   │   └── ui/                     Button, Input, Checkbox
│   │   └── lib/
│   │       ├── api.js                  fetch wrapper
│   │       └── csv.js                  CSV stringify/parse/download
│   └── tailwind.config.js
├── server/
│   ├── src/
│   │   ├── index.js                    Express app + session middleware
│   │   ├── db.js                       Single-JSONB-document store helpers
│   │   └── routes/
│   │       ├── auth.js                 Google OAuth flow
│   │       ├── students.js             CRUD + balance entries
│   │       ├── lessons.js              CRUD
│   │       ├── invoices.js             PDF build + Gmail send + history
│   │       └── profile.js              Coach profile GET/PUT
│   └── .env.example
├── COACH_GUIDE.md                      End-user how-to
├── vercel.json                         Vercel rewrites
└── package.json                        Root build/start for Vercel
```
