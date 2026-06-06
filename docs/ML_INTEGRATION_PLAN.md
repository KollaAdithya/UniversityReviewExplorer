# ML Integration Plan: Llama / Local LLM for Sentiment & Summaries

## Why the repo uses rule-based NLP today (not Llama yet)

| Reason | Detail |
|--------|--------|
| **Zero dependencies** | `mock_ml_service.py` needs no GPU, no API keys, no extra services — demo works on any laptop |
| **Deterministic & fast** | ~1 ms per review at import time; Llama adds seconds per review |
| **Offline import** | `import_public_data.py` processes ~1,000 reviews; calling an LLM per row would take 30–60+ minutes locally |
| **Vertex was the “real ML” path** | `ml_service.py` already switches to Gemini when `USE_MOCK_ML=false` on GCP |

**None of this blocks Llama.** The codebase is already structured as a **provider router** (`ml_service.py` → mock or Vertex). Adding Ollama/Groq is the same pattern.

---

## Recommended strategy: hybrid, not “Llama for everything”

| Task | Best tool | Why |
|------|-----------|-----|
| **Sentiment** (per review) | Small classifier **or** compact LLM | 1,000+ reviews at import; need speed. Options: VADER, `distilbert-base-uncased-finetuned-sst-2-english`, or Llama 3.2 3B with batching |
| **Topics** (per review) | Keyword + RMP tags **or** LLM | Tags already come from dataset; LLM adds value for free-text reviews |
| **Course summary** (per course) | **Llama / Gemini** | Runs once per course (~500 courses max locally), quality matters most here |

**Pragmatic MVP:** Use **Ollama + Llama 3.2 3B** for summaries and live review analysis; keep fast sentiment for bulk import (VADER or batched Llama).

---

## Architecture (target)

```text
                    ┌─────────────────────┐
  Review text ─────►│   ml_service.py     │────► SentimentResult
  Review corpus ───►│   (provider router) │────► topics[]
                    │                     │────► summary string
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         ▼                     ▼                     ▼
  mock_ml_service      ollama_ml_service      vertex_ml_service
  (USE_MOCK_ML=true)   (ML_PROVIDER=ollama)  (ML_PROVIDER=vertex)
         │                     │                     │
         │              Ollama :11434          Vertex Gemini
         │              llama3.2:3b            (Cloud Run)
         └─────────────────────┴─────────────────────┘
                               │
                    fallback to mock on error
```

### Config (proposed `.env`)

```bash
# Provider: mock | ollama | groq | vertex
ML_PROVIDER=ollama

# Ollama (local, free)
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2:3b
OLLAMA_TIMEOUT_SEC=60

# Groq (optional cloud free tier — very fast Llama)
GROQ_API_KEY=
GROQ_MODEL=llama-3.1-8b-instant

# Vertex (existing GCP path)
USE_MOCK_ML=false
GCP_PROJECT=...
VERTEX_MODEL=gemini-2.0-flash
```

Keep `USE_MOCK_ML=true` as shorthand for `ML_PROVIDER=mock` during class demos with no GPU.

---

## Option A — Ollama + Llama (recommended for local / demo)

**Cost:** Free  
**Setup:** `brew install ollama && ollama pull llama3.2:3b`

### How it plugs in

1. Add `backend/app/services/ollama_ml_service.py` with the same three functions as `mock_ml_service`:
   - `analyze_sentiment(text) -> SentimentResult`
   - `extract_topics(text, limit) -> list[str]`
   - `generate_summary(review_texts, ...) -> str`

2. Call Ollama HTTP API:

```http
POST http://127.0.0.1:11434/api/generate
{
  "model": "llama3.2:3b",
  "prompt": "...",
  "stream": false,
  "format": "json"
}
```

3. Use **structured JSON prompts** (same as Vertex today):

**Sentiment prompt:**
```text
You analyze university course reviews. Return ONLY JSON.
Review: "{text}"
{"sentiment":"positive|neutral|negative","confidence":0.0-1.0}
```

**Summary prompt:**
```text
Summarize these course reviews in under 100 words for a student choosing classes.
Focus on workload, grading, lectures, and overall sentiment.
Reviews:
- ...
```

4. Update `ml_service.py` router:

```python
if settings.ml_provider == "ollama":
    return ollama_ml_service.analyze_sentiment(text)
elif settings.ml_provider == "vertex":
    ...
else:
    return mock_ml_service.analyze_sentiment(text)
```

5. Add `scripts/start-ollama.sh` and document in README.

### Performance expectations (M1/M2 Mac, 3B model)

| Operation | Latency | Notes |
|-----------|---------|-------|
| Single review sentiment | 1–4 s | OK for live submit |
| Course summary (20 reviews) | 5–15 s | OK on dashboard load |
| Full re-import 1,000 reviews | 30–90 min | **Do not** run LLM per row; use mock for import, LLM for summaries only |

### Import strategy with Llama

```text
import_public_data.py
  ├─ sentiment/topics: mock OR VADER (fast bulk)
  └─ after import: refresh_course_summary() → Ollama (one call per course)
```

`course_service.refresh_course_summary()` already exists — only summaries need LLM at scale.

---

## Option B — Groq API (free tier, no local GPU)

**Cost:** Free tier with rate limits  
**Model:** `llama-3.1-8b-instant`  
**Pros:** Faster than local Ollama, no install  
**Cons:** Needs API key, network, not fully offline

Same `ollama_ml_service` interface → rename to `llm_ml_service.py` with pluggable HTTP client (Ollama vs Groq OpenAI-compatible endpoint).

```bash
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant
```

---

## Option C — Hugging Face (sentiment only, not full Llama)

For **sentiment at import speed** without LLM cost:

```bash
pip install transformers torch
```

Use `distilbert-base-uncased-finetuned-sst-2-english` (~250 MB, CPU OK):

- Map POSITIVE/NEGATIVE → positive/negative; low confidence → neutral
- ~50–100 reviews/sec on CPU
- Summaries still from Ollama/Gemini

Good **hybrid**: DistilBERT import + Llama summaries.

---

## Option D — Keep Vertex for production (already built)

`ml_service.py` lines 30–85 already call Gemini when `USE_MOCK_ML=false`.

**Cloud Run demo path:**
```bash
USE_MOCK_ML=false
GCP_PROJECT=your-project
VERTEX_MODEL=gemini-2.0-flash
```

No Llama needed on GCP if course policy allows Gemini billing / free credits.

---

## Implementation phases

### Phase 1 — Ollama summaries only (1–2 days, lowest risk)

- [ ] Add `ML_PROVIDER` to `config.py`
- [ ] Implement `ollama_ml_service.generate_summary()` only
- [ ] Wire `ml_service.generate_summary()` to Ollama when `ML_PROVIDER=ollama`
- [ ] Leave sentiment/topics on mock for bulk import
- [ ] Add script: `python scripts/refresh_summaries.py` — re-run summaries for all courses via Ollama
- [ ] Demo talking point: *“AI-generated summaries powered by Llama 3.2 locally”*

### Phase 2 — Ollama live review analysis (1 day) ✅ Implemented

- [x] Ollama sentiment + topics on `POST /api/v1/reviews` via `ml_service.process_live_review()`
- [x] Single combined Ollama JSON call in `ollama_ml_service.analyze_review()`
- [x] Frontend: "Analyzing with Ollama…" while submitting
- [x] Fallback to mock if Ollama unreachable
- [x] `scripts/test_ollama_review.py`, `scripts/start-ollama.sh`, `/health` ollama status

### Phase 3 — Fast bulk sentiment (optional)

- [ ] Add VADER or DistilBERT provider for `import_public_data.py`
- [ ] Or batch Ollama: 10 reviews per prompt with JSON array response

### Phase 4 — Production

- [ ] Cloud: Vertex Gemini **or** Groq **or** self-hosted Llama on GCE GPU
- [ ] Cache summaries in `CourseSummary` table (already exists)
- [ ] Background job for re-summarization on new reviews (Cloud Tasks / Celery)

---

## Files to touch

| File | Change |
|------|--------|
| `backend/app/config.py` | `ml_provider`, `ollama_base_url`, `ollama_model` |
| `backend/app/services/ollama_ml_service.py` | **New** — HTTP client + prompts |
| `backend/app/services/ml_service.py` | Route by provider |
| `backend/requirements.txt` | `httpx` only (Ollama); optional `transformers` for Phase 3 |
| `scripts/start-ollama.sh` | Pull model + health check |
| `scripts/refresh_summaries.py` | **New** — batch LLM summaries |
| `README.md` | Ollama setup section |
| `.env.example` | New ML vars |

**No frontend changes required** — same API responses.

---

## Demo script updates (after Phase 1)

**Person 4 — ML:**
> “For sentiment we use NLP classification; for course summaries we run **Llama 3.2** locally via Ollama to synthesize hundreds of reviews into a short insight.”

**Person 5 — Roadmap:**
> “Phase 2 cloud deploy can swap Ollama for Vertex Gemini or a hosted Llama endpoint without changing the API.”

---

## Quick start (after implementation)

```bash
# Terminal 1 — Ollama
ollama pull llama3.2:3b
ollama serve

# Terminal 2 — Backend
cd backend && source .venv/bin/activate
export ML_PROVIDER=ollama
export USE_MOCK_ML=false
uvicorn app.main:app --reload --port 8080

# Regenerate summaries with Llama
python scripts/refresh_summaries.py
```

---

## Decision matrix

| Need | Choose |
|------|--------|
| Free, offline, class demo on laptop | **Ollama + llama3.2:3b** |
| Free, no install, has internet | **Groq Llama API** |
| Fast bulk import sentiment | **VADER / DistilBERT** + Llama summaries |
| GCP course project / scalability | **Vertex Gemini** (already wired) |
| Fastest path, no new code | Set `USE_MOCK_ML=false` + GCP credentials |

---

## Summary

**Why not Llama today:** speed and simplicity for MVP import + demo reliability.  
**Why Llama next:** real AI summaries and better sentiment/topics for live reviews — fits the existing `ml_service` router with ~1 new file and config changes.  
**Best first step:** Ollama for **course summaries only**, then expand to live review analysis.
