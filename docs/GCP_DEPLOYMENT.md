# Deploying to Google Cloud Platform

> **First time on GCP?** See [`GCP_README.md`](GCP_README.md) for a beginner walkthrough (account setup, Firebase, billing, and step-by-step deploy).

This guide is the technical reference for deploying the Campus Course Review app to GCP:

```
Browser → GCS (React static site)
       → Cloud Run (FastAPI API)
            → Cloud SQL (PostgreSQL)
            → Firebase Auth (sign-in)
            → Vertex AI / Groq / OpenAI (AI summaries & sentiment)
            → BigQuery (analytics on new reviews)
```

## Prerequisites

1. **Google Cloud account** with billing enabled
2. **gcloud CLI** installed and authenticated:
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
3. **Node.js 18+** (for frontend build)
4. **Python 3.9+** with backend deps (for data seeding):
   ```bash
   cd backend
   python3 -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt -r requirements-gcp.txt
   ```
5. **Firebase project** linked to your GCP project:
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Create a project (or use existing) — link it to your GCP project
   - **Authentication → Sign-in method → Enable Email/Password**
   - **Project settings → Your apps → Add Web app** — copy the config values

## Quick deploy (one command)

```bash
# 1. Copy and fill in your values
cp infra/gcp.env.example infra/gcp.env
# Edit infra/gcp.env with your project IDs and Firebase keys

# 2. Export variables and deploy everything
set -a && source infra/gcp.env && set +a
chmod +x scripts/*.sh
./scripts/deploy-gcp.sh
```

This runs four steps automatically:

| Step | Script | What it does |
|------|--------|--------------|
| 1 | `setup-gcp.sh` | Enables APIs, creates Cloud SQL, BigQuery, GCS bucket, service account, secrets |
| 2 | `deploy-backend.sh` | Builds Docker image, deploys FastAPI to Cloud Run |
| 3 | `deploy-frontend.sh` | Builds React app, uploads to GCS |
| 4 | `seed-gcp-data.sh` | Imports ~1,000 real reviews via Cloud SQL proxy |

**Expected time:** ~15–20 minutes (Cloud SQL creation takes ~5 min).

## Step-by-step (manual)

If you prefer to run each step individually:

```bash
set -a && source infra/gcp.env && set +a

./scripts/setup-gcp.sh          # Infrastructure only (~5 min)
./scripts/deploy-backend.sh     # API to Cloud Run
./scripts/deploy-frontend.sh    # UI to GCS
./scripts/seed-gcp-data.sh      # Load review data
```

## What gets created

| Resource | Name | Purpose |
|----------|------|---------|
| Cloud SQL | `course-review-db` | PostgreSQL 15 (db-f1-micro) |
| Cloud Run | `course-review-api` | FastAPI backend |
| GCS bucket | `course-review-frontend-{project}` | React static site |
| BigQuery dataset | `course_reviews_dataset` | Analytics table |
| Service account | `course-review-run@...` | Cloud Run identity |
| Secrets | `course-review-database-url`, `course-review-db-password` | DB credentials |

## URLs after deploy

- **Frontend:** `https://storage.googleapis.com/course-review-frontend-{PROJECT}/index.html`
- **Backend:** `https://course-review-api-{hash}-{region}.a.run.app`
- **Health:** `{backend-url}/health`

## AI / ML on Cloud Run

| Feature | Cloud option | Notes |
|---------|-------------|-------|
| **Summaries** | Groq or OpenAI (via Secret Manager) | Ollama does **not** run on Cloud Run |
| **Live review NLP** | Groq or OpenAI | Set `groq-api-key` or `openai-api-key` secret |
| **Fallback** | Vertex AI (Gemini) | Used when `USE_MOCK_ML=false` and no LLM provider |
| **Bulk import** | Keyword rules (fast) | Re-run `reanalyze_all_reviews.py` with `--provider groq` if needed |

Store API keys in Secret Manager (optional but recommended):

```bash
set -a && source infra/gcp.env && set +a

echo -n 'YOUR_GROQ_KEY' | gcloud secrets create groq-api-key \
  --data-file=- --replication-policy=automatic --project "$GCP_PROJECT"

# If the secret already exists, add a new version instead:
# echo -n 'YOUR_GROQ_KEY' | gcloud secrets versions add groq-api-key --data-file=- --project "$GCP_PROJECT"

./scripts/deploy-backend.sh   # picks up groq-api-key / openai-api-key automatically
```

## Firebase production auth

The frontend build **must not** set `VITE_FIREBASE_AUTH_EMULATOR_HOST` in production. The deploy script handles this — only real Firebase config is baked in.

Users sign in with Email/Password on the deployed site. The backend verifies tokens via Firebase Admin SDK using the Cloud Run service account (no JSON key file needed on GCP).

## Updating after code changes

```bash
set -a && source infra/gcp.env && set +a

./scripts/deploy-backend.sh     # API only
./scripts/deploy-frontend.sh    # UI only (needs VITE_* from gcp.env)
./scripts/seed-gcp-data.sh      # Re-seed data (destructive)
```

## Cost estimate (demo / low traffic)

| Service | Tier | ~Monthly |
|---------|------|----------|
| Cloud SQL | db-f1-micro | ~$10 |
| Cloud Run | Pay per request | ~$0–5 |
| GCS | Static hosting | ~$0.10 |
| BigQuery | Minimal writes | ~$0 |
| Vertex / Groq | Per API call | Variable |

Use `db-f1-micro` for demos; scale up for production traffic.

## Troubleshooting

**Cloud Run returns 500 on startup**
- Check logs: `gcloud run services logs read course-review-api --region $GCP_REGION`
- Usually a migration or Cloud SQL connection issue

**CORS errors / "Failed to fetch" in browser**
- GCS-hosted pages send `Origin: https://storage.googleapis.com` (not the full `index.html` path)
- Set `CORS_ORIGINS=https://storage.googleapis.com` on Cloud Run (default in `deploy-gcp.sh`)
- Redeploy backend: `set -a && source infra/gcp.env && set +a && ./scripts/deploy-backend.sh`

**Login fails on deployed site**
- Confirm Firebase Email/Password auth is enabled
- Confirm `FIREBASE_PROJECT_ID` matches your Firebase project
- Do not set `FIREBASE_AUTH_EMULATOR_HOST` in Cloud Run env vars

**AI summary shows "Default template"**
- Ollama is local-only; use Groq or OpenAI on Cloud Run
- Add `groq-api-key` secret and redeploy

**Seed script fails**
- Run `gcloud auth application-default login`
- Ensure `pip install -r requirements-gcp.txt` (needs `psycopg2-binary`)

## Teammate onboarding (quick)

Each person uses **their own** GCP/Firebase project — no shared secrets in the repo.

**First time on GCP?** Follow every step in [`GCP_README.md`](GCP_README.md) (account, billing, Firebase).

```bash
git clone https://github.com/KollaAdithya/UniversityReviewExplorer.git
cd UniversityReviewExplorer
chmod +x scripts/*.sh
cp infra/gcp.env.example infra/gcp.env    # fill in YOUR project + Firebase keys
./scripts/install-gcp-tools.sh
source scripts/use-gcloud.sh              # macOS: gcloud/npm on PATH
set -a && source infra/gcp.env && set +a
gcloud config set project "$GCP_PROJECT"
./scripts/verify-gcp-prereqs.sh
./scripts/deploy-gcp.sh
```

After deploy: Firebase → Authentication → Settings → **Authorized domains** → add `storage.googleapis.com`.

Before `git push`, run `./scripts/check-secrets.sh`. Never commit `infra/gcp.env`, `backend/.env`, or `frontend/.env.local`.

### Config files (do not mix them up)

| File | Purpose |
|------|---------|
| `infra/gcp.env` | GCP deploy scripts only |
| `backend/.env` | Local uvicorn only — **never source before `./scripts/deploy-*.sh`** |
| `frontend/.env.local` | Local Vite dev server only |

All GCP deploy/update commands must start with:

```bash
set -a && source infra/gcp.env && set +a
```

### Common mistakes

- **`backend/.env` sourced before deploy** — can set empty `GCP_PROJECT` or localhost-only CORS. Use `infra/gcp.env` only.
- **Missing `storage.googleapis.com`** in Firebase — sign-in fails on the GCS frontend URL.
- **Ollama on GCP** — not supported on Cloud Run; use Groq/OpenAI via Secret Manager.
- **Pushing secrets** — run `./scripts/check-secrets.sh` before every `git push`.

## Security checklist

- [ ] `infra/gcp.env` created locally only (gitignored)
- [ ] API keys stored in Secret Manager on GCP, not in repo or plain Cloud Run env vars
- [ ] `backend/.env` and `frontend/.env.local` not committed (run `./scripts/check-secrets.sh`)
- [ ] Firebase auth enabled (no open review submission without sign-in)
- [ ] `storage.googleapis.com` added to Firebase authorized domains (for GCS frontend)
- [ ] Cloud SQL not publicly accessible (proxy-only)
