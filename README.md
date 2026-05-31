# Multi-University Course Review Explorer

Local-first platform for exploring course reviews across universities with AI-powered sentiment, topics, and summaries.

## Stack

- **Frontend:** React + Vite + Tailwind + Recharts
- **Backend:** FastAPI + SQLAlchemy + Alembic
- **Database:** SQLite locally (Docker Postgres optional)
- **Data:** Public RMP-style research subset in [`data/rmp_subset.csv`](data/rmp_subset.csv)
- **ML:** Mock NLP locally; Vertex AI Gemini on GCP
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

## API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/universities` | List/search universities |
| GET | `/api/v1/universities/{id}/courses` | Courses at a university |
| GET | `/api/v1/universities/{id}/courses/{courseId}/analytics` | Dashboard metrics |
| GET | `/api/v1/universities/{id}/courses/{courseId}/reviews` | Filterable reviews |
| GET | `/api/v1/analytics/top-topics` | Cross-university topic comparison |
| POST | `/api/v1/reviews` | Submit review + ML pipeline |

Legacy `/api/v1/courses` remains for backward compatibility.

## Data source

The demo subset in `data/rmp_subset.csv` is modeled after public Rate My Professors research datasets ([Mendeley corpus](https://data.mendeley.com/datasets/fvtfjyvw7d/2)). It covers MIT, Stanford, Berkeley, CMU, Harvard, Georgia Tech, Michigan, and UIUC.

To load the full public dataset, replace `data/rmp_subset.csv` and rerun:

```bash
python scripts/import_rmp_subset.py
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

Copy [`.env.example`](.env.example) to `backend/.env`. Include frontend origins in `CORS_ORIGINS`.
