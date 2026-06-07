# Campus Course Review — Sentiment & Topic Explorer

Local-first platform for exploring course reviews across universities with AI-powered sentiment, topics, and summaries.

## Stack

- **Frontend:** React + Vite + Tailwind + Recharts
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **Database:** SQLite locally (Docker Postgres optional)
- **Auth:** Firebase Authentication (local Auth Emulator; production-ready token verification)
- **Data:** Real public RMP research sample ([`data/rmp_public.csv`](data/rmp_public.csv), ~1k reviews / 46 schools)
- **ML:** Mock NLP for bulk import; live AI summaries/sentiment via **Ollama (local)**, **OpenAI**, or **Groq**
- **Analytics:** BigQuery-ready cross-university topic analytics

---

## Getting started (run locally)

Anyone can run this app on their own machine in a few minutes. Follow the steps below.

### 1. Prerequisites

Install these once:

| Tool | Version | Check | Get it |
|------|---------|-------|--------|
| **Python** | 3.9+ | `python3 --version` | https://www.python.org/downloads/ |
| **Node.js + npm** | 18+ | `node -v` / `npm -v` | https://nodejs.org/ |
| **Git** | any | `git --version` | https://git-scm.com/ |

Optional (only if you want those features):

- **Firebase CLI** — for the login/sign-in feature: `npm install -g firebase-tools`
- **Ollama** — to run a local AI model: https://ollama.com/download

### 2. Get the code

```bash
git clone https://github.com/KollaAdithya/UniversityReviewExplorer.git
cd UniversityReviewExplorer
```

### 3. Start the backend (API)

```bash
cd backend

# Create and activate a virtual environment
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create local config
cp .env.example .env

# Create the database and load ~1,000 real reviews
python ../scripts/init_db.py
python ../scripts/import_public_data.py --file ../data/rmp_public.csv --force

# Run the API (keep this terminal open)
uvicorn app.main:app --reload --port 8080
```

Backend is now at **http://localhost:8080** (docs at http://localhost:8080/docs).

### 4. Start the frontend (in a second terminal)

```bash
cd frontend

# Create local config
cp .env.example .env.local

# Install dependencies and run
npm install
npm run dev -- --port 5174
```

Open **http://localhost:5174** in your browser. 🎉

### 5. (Optional) Enable login to submit reviews

Browsing works without signing in. To **submit** a review you need the Firebase Auth Emulator:

```bash
npm install -g firebase-tools      # once
./scripts/start-firebase-emulator.sh
```

Then sign in at `/login` with any email/password (the emulator accepts anything locally).

### One-command setup (macOS/Linux)

If you have `bash`, this script does steps 3–5 for you:

```bash
chmod +x scripts/dev-local.sh
./scripts/dev-local.sh
# then start backend and frontend as printed at the end
```

### Verify everything works

With the backend, frontend, and emulator running:

```bash
cd backend && source .venv/bin/activate
python ../scripts/verify_full.py
```

You should see all checks pass.

### Troubleshooting

- **`command not found: python`** → use `python3`.
- **Port already in use** → kill it: `lsof -ti tcp:8080 | xargs kill -9` (or `:5174`).
- **Frontend can't reach API** → confirm the backend is running on `:8080` and `frontend/.env.local` has `VITE_API_BASE_URL=http://localhost:8080`.
- **AI summary shows "Default — fast template"** → no AI provider is configured/running; that's fine, it falls back to a template. See the AI section below to enable Ollama/OpenAI/Groq.
- **Login fails** → make sure the Firebase emulator is running (step 5).

### Authentication

- **Browse** universities, courses, analytics, and reviews without signing in.
- **Submit reviews** requires Firebase sign-in (`/login`).
- Local dev uses the [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite) on port `9099` (any email/password works).
- Automated checks use `AUTH_DEV_TOKEN` from `.env.example`.

Install the emulator CLI once: `npm install -g firebase-tools`

### AI summaries (optional)

The app works without any AI — it falls back to a fast keyword template. To get **AI-written summaries**, the course dashboard has a **Summary model** dropdown where you pick a provider at runtime:

| Option | Cost | Setup |
|--------|------|-------|
| **Ollama (local)** — default | Free | Install [Ollama](https://ollama.com/download), runs Llama on your machine |
| **OpenAI** | Pay-as-you-go | [OpenAI API key](https://platform.openai.com/) in `backend/.env` |
| **Groq** | Free tier | [Groq API key](https://console.groq.com/) in `backend/.env` |
| **Default** | Free | Keyword template, no AI |

A provider only appears as available when it's configured/running; otherwise it's disabled and the app uses the template.

#### Use local Ollama (default, free)

```bash
./scripts/start-ollama.sh        # installs/pulls the model and starts Ollama
```

Then choose **Ollama (local)** in the dropdown. No API key needed.

#### Use OpenAI or Groq (cloud)

Add a key to `backend/.env` and restart the backend:

```bash
# backend/.env — for OpenAI
OPENAI_API_KEY=sk-...            # https://platform.openai.com/api-keys
OPENAI_MODEL=gpt-4o-mini

# or for Groq
GROQ_API_KEY=gsk_...             # https://console.groq.com/keys
GROQ_MODEL=llama-3.1-8b-instant
```

The `ML_PROVIDER` value in `backend/.env` controls which provider analyzes **newly submitted** reviews (sentiment + topics). The dashboard dropdown controls **summaries** per-course.

If a provider is offline or missing a key, the API **falls back to the template** automatically.

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/universities` | List/search universities |
| GET | `/api/v1/universities/{id}/courses` | Courses at a university |
| GET | `/api/v1/universities/{id}/courses/{courseId}/analytics` | Dashboard metrics |
| GET | `/api/v1/universities/{id}/courses/{courseId}/reviews` | Filterable reviews |
| GET | `/api/v1/analytics/top-topics` | Cross-university topic comparison |
| GET | `/api/v1/auth/me` | Current user (Bearer token) |
| POST | `/api/v1/reviews` | Submit review + ML pipeline (auth required) |

Legacy `/api/v1/courses` remains for backward compatibility.

## Data source (real, not synthetic)

Imports use **freely available** research datasets only. See [`data/DATA_SOURCES.md`](data/DATA_SOURCES.md).

**Default (~1,000 real reviews):** downloaded from [liumingchun/RateMyProfessor](https://github.com/liumingchun/RateMyProfessor/blob/master/RMP_sample_data.csv) — 46 US colleges, real comments and ratings.

```bash
python scripts/download_public_data.py
python scripts/import_public_data.py --file data/rmp_public.csv --force
```

**Large corpus (optional, CC BY 4.0):** download from [Mendeley — RateMyProfessor Big Data Set](https://data.mendeley.com/datasets/fvtfjyvw7d/2) (~9.5M rows), then:

```bash
python scripts/import_public_data.py --file data/your_mendeley_file.csv --force --max-rows 50000
```

## GCP deployment (teammates)

Each developer deploys to **their own** GCP project. The repo ships templates only — no real project IDs or API keys.

| Guide | When to use |
|-------|-------------|
| [`docs/GCP_README.md`](docs/GCP_README.md) | **Start here** — account, billing, Firebase, step-by-step deploy, common mistakes |
| [`docs/GCP_DEPLOYMENT.md`](docs/GCP_DEPLOYMENT.md) | Technical reference — resources created, updates, troubleshooting |

```bash
git clone https://github.com/KollaAdithya/UniversityReviewExplorer.git
cd UniversityReviewExplorer
```

**Quick start** (billing + Firebase project required):

```bash
chmod +x scripts/*.sh
./scripts/install-gcp-tools.sh            # gcloud + Python deps (local .cache/)
cp infra/gcp.env.example infra/gcp.env   # YOUR project + Firebase keys — never commit
source scripts/use-gcloud.sh             # macOS: ensure gcloud/npm on PATH
set -a && source infra/gcp.env && set +a # GCP deploy env — do NOT source backend/.env
gcloud config set project "$GCP_PROJECT"
./scripts/verify-gcp-prereqs.sh         # fix anything marked ✗
./scripts/deploy-gcp.sh                   # ~15–20 min: SQL, Cloud Run, GCS, seed data
```

After deploy:

1. Add **`storage.googleapis.com`** to Firebase → Authentication → Settings → Authorized domains.
2. (Optional) Add a Groq key to Secret Manager for AI summaries — see [`docs/GCP_README.md`](docs/GCP_README.md).

**Local + GCP in parallel:** use `backend/.env` / `frontend/.env.local` for localhost; use `infra/gcp.env` only when running deploy scripts. See **Common mistakes** in `GCP_README.md`.

**Architecture on GCP:**

| Component | Service |
|-----------|---------|
| Frontend | GCS static hosting |
| Backend | Cloud Run |
| Database | Cloud SQL (PostgreSQL) |
| Auth | Firebase Authentication |
| AI summaries | Groq / OpenAI / Vertex AI (Ollama is local-only) |
| Analytics | BigQuery |

## Environment

| File | When |
|------|------|
| `backend/.env` | Local API (`uvicorn` on `:8080`) — copy from [`backend/.env.example`](backend/.env.example) |
| `frontend/.env.local` | Local UI (`npm run dev` on `:5174`) — copy from [`frontend/.env.example`](frontend/.env.example) |
| `infra/gcp.env` | GCP deploy only — copy from [`infra/gcp.env.example`](infra/gcp.env.example) |

Do not use `backend/.env` for Cloud Run deploys.

### Secrets & GitHub

**Never commit real API keys or GCP config.** Keep secrets only in local files:

| File | Contents | Committed? |
|------|----------|------------|
| `infra/gcp.env` | GCP project ID, Firebase web keys | **No** (gitignored) |
| `backend/.env` | OpenAI/Groq keys, dev tokens | **No** (gitignored) |
| `frontend/.env.local` | Firebase config for local dev | **No** (gitignored) |
| `infra/gcp.env.example` | Placeholders only | Yes (safe) |
| `backend/.env.example`, `frontend/.env.example` | Placeholders only | Yes (safe) |

Before every push:

```bash
./scripts/check-secrets.sh
git status   # infra/gcp.env, backend/.env, frontend/.env.local must NOT be staged
```

On GCP, store production API keys in **Secret Manager** (`groq-api-key`, `openai-api-key`) — not in the repo.

If a key was ever pushed, **revoke it** in the Groq/Firebase/GCP console and create a new one.
