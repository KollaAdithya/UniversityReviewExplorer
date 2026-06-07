# GCP Setup Guide (Beginner)

Step-by-step guide for deploying the Campus Course Review app to Google Cloud Platform — written for first-time GCP users with no existing account.

**Each teammate deploys to their own GCP project.** Nothing in this repo contains real project IDs or API keys. Copy `infra/gcp.env.example` → `infra/gcp.env`, fill in your values locally, and keep that file out of git (it is listed in `.gitignore`).

```bash
git clone https://github.com/KollaAdithya/UniversityReviewExplorer.git
cd UniversityReviewExplorer
```

For technical reference after deploy, see [`GCP_DEPLOYMENT.md`](GCP_DEPLOYMENT.md).

### Which config file is for what?

| File | Use for | Commit to git? |
|------|---------|----------------|
| `infra/gcp.env` | **GCP deploy** (`deploy-gcp.sh`, `deploy-backend.sh`, …) | **Never** |
| `backend/.env` | **Local dev only** (uvicorn on `:8080`) | **Never** |
| `frontend/.env.local` | **Local dev only** (Vite on `:5174`) | **Never** |

**Do not `source backend/.env` before GCP deploys.** It has localhost CORS and a demo Firebase project that can clash with `infra/gcp.env`.

---

## Your app → GCP services

| What you have locally | GCP service | What it does |
|----------------------|-------------|--------------|
| **Frontend** (React) | **Cloud Storage (GCS)** | Hosts the built website (HTML/JS/CSS) |
| **Backend** (FastAPI) | **Cloud Run** | Runs your API in the cloud (auto-scales, pay per use) |
| **Database** (SQLite/Postgres) | **Cloud SQL** | Managed PostgreSQL database |
| **Auth** (Firebase emulator) | **Firebase Authentication** | Real sign-in (email/password) in production |

Optional extras the deploy scripts also set up:

| Feature | GCP service |
|---------|-------------|
| Analytics on new reviews | BigQuery |
| Safe storage for passwords/keys | Secret Manager |
| AI summaries (cloud) | Groq / OpenAI / Vertex AI |

> **Note:** Ollama runs only on your laptop. On GCP, use Groq (free tier) or OpenAI for AI summaries.

```
Browser
  → GCS (React static site)
  → Cloud Run (FastAPI API)
       → Cloud SQL (PostgreSQL)
       → Firebase Auth (sign-in)
       → Groq / OpenAI / Vertex AI (AI)
       → BigQuery (analytics)
```

---

## Step 0: Create a Google Cloud account

1. Go to [cloud.google.com](https://cloud.google.com) and click **Get started for free**.
2. Sign in with a Google account.
3. Add a **credit card** for verification — new accounts usually get **~$300 free credits for 90 days**.
4. You won't be charged much for a demo; the database is the main cost (~$10/month).

---

## Step 1: Create a GCP project

1. Open the [Google Cloud Console](https://console.cloud.google.com).
2. Top bar → **Select a project** → **New Project**.
3. Name it something like `course-review-demo`.
4. Copy the **Project ID** (e.g. `course-review-demo-123456`) — you'll need this later.

---

## Step 2: Enable billing

1. In the Console, go to **Billing**.
2. Link your project to a billing account.
3. Required even when using free credits.

---

## Step 3: Set up Firebase (Auth)

Firebase is Google's auth product. It links to your GCP project.

1. Go to the [Firebase Console](https://console.firebase.google.com).
2. Click **Add project** → choose **Use an existing Google Cloud project** → pick the project you created in Step 1.
3. Go to **Build → Authentication → Get started**.
4. Open **Sign-in method → Email/Password → Enable → Save**.
5. Go to **Project settings** (gear icon) → **Your apps** → click the **Web** icon (`</>`).
6. Register the app (any nickname is fine).
7. Copy these values — you'll put them in `infra/gcp.env`:

| Firebase field | Goes in `infra/gcp.env` as |
|----------------|---------------------------|
| `apiKey` | `VITE_FIREBASE_API_KEY` |
| `authDomain` | `VITE_FIREBASE_AUTH_DOMAIN` |
| `projectId` | `VITE_FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_ID` |

8. After deploy, go to **Authentication → Settings → Authorized domains** and add **`storage.googleapis.com`** so sign-in works on the GCS-hosted frontend.

---

## Step 4: Install tools on your Mac

**One command** (installs gcloud into `.cache/`, Python deps, checks npm):

```bash
chmod +x scripts/*.sh
./scripts/install-gcp-tools.sh
```

Or install manually:

| Tool | Install |
|------|---------|
| **gcloud** | `brew install --cask google-cloud-sdk` or [official installer](https://cloud.google.com/sdk/docs/install) |
| **Node.js 18+** | [nodejs.org/download](https://nodejs.org/en/download) (needed for frontend build) |
| **Python deps** | `cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt -r requirements-gcp.txt` |

Then log in and set your project (use the **Project ID** from Step 1):

```bash
# Optional helper — puts project-local gcloud/npm on PATH (macOS)
source scripts/use-gcloud.sh

gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_GCP_PROJECT_ID
```

> **Linux / Windows:** Install [gcloud](https://cloud.google.com/sdk/docs/install) and [Node.js 18+](https://nodejs.org/) yourself if `install-gcp-tools.sh` does not apply. The deploy commands are the same.

---

## Step 5: Fill in your config file

Create your local config from the template — **one file per developer, never committed**:

```bash
cp infra/gcp.env.example infra/gcp.env
```

Edit `infra/gcp.env` with your project ID and Firebase web app values:

```bash
GCP_PROJECT=your-gcp-project-id
GCP_REGION=us-central1

FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_PROJECT_ID=your-firebase-project-id
VITE_FIREBASE_API_KEY=your-firebase-web-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
```

`GCP_PROJECT` is usually the same as `FIREBASE_PROJECT_ID` when you linked Firebase to your GCP project in Step 3.

Do **not** commit `infra/gcp.env` — it is in `.gitignore`. Before pushing to GitHub, run `./scripts/check-secrets.sh`.

---

## Step 5b: Verify before deploy

```bash
set -a && source infra/gcp.env && set +a
./scripts/verify-gcp-prereqs.sh
```

Fix anything marked ✗, then continue.

---

## Step 6: Deploy (one command)

```bash
set -a && source infra/gcp.env && set +a
./scripts/deploy-gcp.sh
```

(`deploy-gcp.sh` runs the prerequisite check automatically.)

This takes **~15–20 minutes** and runs four steps:

| Step | Script | What it does |
|------|--------|--------------|
| 1 | `setup-gcp.sh` | Creates database, storage bucket, secrets, service account |
| 2 | `deploy-backend.sh` | Builds and deploys FastAPI to Cloud Run |
| 3 | `deploy-frontend.sh` | Builds React and uploads to GCS |
| 4 | `seed-gcp-data.sh` | Loads ~1,000 real reviews into Cloud SQL |

When it finishes, you'll see two URLs:

- **Frontend:** `https://storage.googleapis.com/course-review-frontend-.../index.html`
- **Backend:** `https://course-review-api-....a.run.app`

Open the frontend URL in your browser. Sign in with any email/password — Firebase creates the account on first use.

### After deploy (do not skip)

1. **Firebase authorized domain** — Authentication → Settings → Authorized domains → add `storage.googleapis.com` (required for sign-in on the GCS URL).
2. **Hard-refresh** the frontend (Cmd+Shift+R / Ctrl+Shift+R) if you redeployed.
3. **Optional AI summaries** — add a Groq key to Secret Manager (see below); Ollama is local-only and will stay disabled on GCP.

---

## Local dev and GCP in parallel

You can run both at the same time — they do not conflict:

| | Local | GCP |
|---|-------|-----|
| Frontend | http://localhost:5174 | GCS URL from deploy output |
| API | http://localhost:8080 | Cloud Run URL |
| Config | `backend/.env` + `frontend/.env.local` | `infra/gcp.env` (deploy only) |

---

## What costs money (demo estimate)

| Service | Approx. monthly cost |
|---------|---------------------|
| Cloud SQL (database) | ~$10 |
| Cloud Run (API) | ~$0–5 (low traffic) |
| GCS (frontend hosting) | ~$0.10 |
| Firebase Auth | Free tier |
| **Total for a class demo** | **~$10–15/month** |

Free credits usually cover the first few months.

---

## Local vs GCP — what changes

| Local dev | On GCP |
|-----------|--------|
| Ollama (local AI) | Groq (free) or OpenAI |
| Firebase emulator | Real Firebase Auth |
| SQLite file | Cloud SQL PostgreSQL |
| `localhost:5174` | GCS public URL |

### Enable AI summaries on Cloud Run (optional)

Ollama does not run in the cloud. Add a free Groq key:

1. Get a key at [console.groq.com](https://console.groq.com).
2. Store it in Secret Manager:

```bash
echo -n 'gsk_YOUR_GROQ_KEY' | gcloud secrets create groq-api-key \
  --data-file=- --project $GCP_PROJECT
```

3. Redeploy the backend:

```bash
set -a && source infra/gcp.env && set +a
./scripts/deploy-backend.sh
```

On the course dashboard, pick **Groq** in the Summary model dropdown and click **Generate summary**.

---

## Common mistakes

| Mistake | What goes wrong | Fix |
|---------|-----------------|-----|
| Sourcing `backend/.env` before GCP deploy | Wrong `GCP_PROJECT`, demo Firebase ID, or broken CORS | Use **only** `set -a && source infra/gcp.env && set +a` |
| Skipping Firebase authorized domain | Sign-in works locally but fails on GCS URL | Add `storage.googleapis.com` in Firebase Console |
| Committing `infra/gcp.env` | Leaks project ID + Firebase keys to GitHub | Run `./scripts/check-secrets.sh` before every push |
| Expecting Ollama on GCP | Summary dropdown shows Ollama greyed out | Use **Groq** or **OpenAI** on Cloud Run (see optional AI section) |
| Forgetting to export env vars | `GCP_PROJECT: Set GCP_PROJECT` errors | Always `set -a && source infra/gcp.env && set +a` in the same shell |

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `GCP_PROJECT: Set GCP_PROJECT` | Run `set -a && source infra/gcp.env && set +a` first |
| Permission denied | Run `gcloud auth login` and `gcloud auth application-default login` |
| `gcloud` not found after install | Run `source scripts/use-gcloud.sh` |
| Login fails on deployed site | Enable Email/Password (Step 3); add `storage.googleapis.com` to Firebase authorized domains |
| "Failed to fetch" / CORS error | Redeploy with `infra/gcp.env` only: `set -a && source infra/gcp.env && set +a && ./scripts/deploy-backend.sh` (script auto-includes `https://storage.googleapis.com`) |
| Blank page (no styles) | Re-run `./scripts/deploy-frontend.sh` |
| No reviews showing | Re-run `./scripts/seed-gcp-data.sh` |
| AI summary shows "Default template" | Add `groq-api-key` secret and redeploy backend |
| Groq/OpenAI greyed out in dropdown | Create secret in Secret Manager, then `./scripts/deploy-backend.sh` |

View backend logs:

```bash
gcloud run services logs read course-review-api --region us-central1
```

---

## Updating after you change code

```bash
set -a && source infra/gcp.env && set +a

./scripts/deploy-backend.sh    # API changes only
./scripts/deploy-frontend.sh   # UI changes only
./scripts/seed-gcp-data.sh     # Re-import review data (destructive)
```

---

## Checklist (copy and track)

- [ ] GCP account created with billing enabled
- [ ] GCP project created; Project ID copied
- [ ] Firebase project linked to GCP project
- [ ] Firebase Email/Password auth enabled
- [ ] Firebase web app config copied to `infra/gcp.env`
- [ ] `gcloud` CLI installed and authenticated
- [ ] Python deps installed (`requirements-gcp.txt`)
- [ ] `./scripts/deploy-gcp.sh` completed successfully
- [ ] Frontend URL opens in browser
- [ ] Sign-in works
- [ ] Course data and reviews visible
- [ ] `storage.googleapis.com` added to Firebase authorized domains
- [ ] (Optional) Groq key in Secret Manager + AI summary works

---

## Recommended order (summary)

1. Create GCP account + project + billing
2. Set up Firebase Auth and copy web app keys
3. Install `gcloud` and log in
4. Fill in `infra/gcp.env`
5. Run `./scripts/deploy-gcp.sh`
6. Open the frontend URL and test

You don't need to understand every GCP service first — the scripts handle Cloud SQL, Cloud Run, GCS, and secrets. Your main jobs are: **account → project → Firebase keys → run deploy**.
