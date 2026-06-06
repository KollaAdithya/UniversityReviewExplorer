# Multi-University Course Review Explorer

Local-first platform for exploring course reviews across universities with AI-powered sentiment, topics, and summaries.

## Stack

- **Frontend:** React + Vite + Tailwind + Recharts
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **Database:** SQLite locally (Docker Postgres optional)
- **Auth:** Firebase Authentication (local Auth Emulator; production-ready token verification)
- **Data:** Real public RMP research sample ([`data/rmp_public.csv`](data/rmp_public.csv), ~1k reviews / 46 schools)
- **ML:** Mock NLP for bulk import; **Groq (cloud Llama)** for live reviews + summaries; optional local Ollama; Vertex AI Gemini on GCP
- **Analytics:** BigQuery-ready cross-university topic analytics

## Run locally

```bash
chmod +x scripts/dev-local.sh scripts/verify_full.sh scripts/setup-gcp.sh
./scripts/dev-local.sh

# Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8080

# Frontend
cd frontend && npm install && npm run dev -- --port 5174

# Verify
./scripts/verify_full.py
```

Open http://127.0.0.1:5174

### Authentication

- **Browse** universities, courses, analytics, and reviews without signing in.
- **Submit reviews** requires Firebase sign-in (`/login`).
- Local dev uses the [Firebase Auth Emulator](https://firebase.google.com/docs/emulator-suite) on port `9099` (any email/password works).
- Automated checks use `AUTH_DEV_TOKEN` from `.env.example`.

Install the emulator CLI once: `npm install -g firebase-tools`

### AI / Llama (sentiment + summaries)

You do **not** have to run a model locally. Pick a provider in `backend/.env`:

| Provider | Cost | Setup |
|----------|------|-------|
| **`openai`** | Pay-as-you-go (e.g. $10 credits) | [OpenAI API key](https://platform.openai.com/) — GPT summaries |
| **`groq`** (free cloud Llama) | Free tier, rate-limited | [Groq API key](https://console.groq.com/) — no local install |
| **`ollama`** | Free | Install Ollama, runs Llama on your Mac |
| **`vertex`** | GCP billing / credits | `USE_MOCK_ML=false` + `GCP_PROJECT` |
| **`mock`** | Free | Default — keyword rules, no AI |

#### Option A — Groq cloud API (no local model)

```bash
# backend/.env
ML_PROVIDER=groq
GROQ_API_KEY=gsk_...          # https://console.groq.com/keys
GROQ_MODEL=llama-3.1-8b-instant
OLLAMA_LIVE_REVIEWS_ONLY=true # also applies to Groq: mock bulk import, LLM for live reviews
USE_MOCK_ML=true
```

Restart the backend. Dashboard summaries call Groq automatically; no Ollama app needed.

#### Option B — Local Ollama

```bash
./scripts/start-ollama.sh

# backend/.env
ML_PROVIDER=ollama
OLLAMA_MODEL=llama3.2:3b
OLLAMA_LIVE_REVIEWS_ONLY=true
USE_MOCK_ML=true
```

```bash
python scripts/test_ollama_review.py
python scripts/refresh_summaries.py
```

If the LLM provider is offline or missing an API key, the API **falls back to mock** NLP automatically.

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

## GCP deployment (Stage 2)

```bash
export GCP_PROJECT=your-project-id
export VITE_API_BASE_URL=https://your-api-url
./scripts/setup-gcp.sh
./scripts/deploy-backend.sh
./scripts/deploy-frontend.sh
```

Set on Cloud Run: `USE_MOCK_ML=false`, `ENABLE_BIGQUERY=true`, Cloud SQL connection string.

## Environment

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and add your keys locally. Include frontend origins in `CORS_ORIGINS`.

### Secrets & GitHub

**Never commit real API keys.** Local secrets live only in:

- `backend/.env` — `GROQ_API_KEY`, `AUTH_DEV_TOKEN`, GCP credentials path
- `frontend/.env.local` — Firebase config (demo keys OK for emulator)

Tracked templates (safe to push): `backend/.env.example`, `.env.example`, `frontend/.env.example`.

Before pushing:

```bash
./scripts/check-secrets.sh
git status   # backend/.env and frontend/.env.local must NOT appear as staged
```

If a key was ever pushed, **revoke it** in the Groq/Firebase/GCP console and create a new one.
