from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.firebase_admin import init_firebase
from app.config import settings
from app.routers import analytics, auth, courses, data, reviews, universities
from app.services import ml_service

app = FastAPI(title="Campus Course Review Explorer", version="2.0.0")


@app.on_event("startup")
def startup():
    init_firebase()

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(universities.router)
app.include_router(analytics.router)
app.include_router(data.router)
app.include_router(courses.router)
app.include_router(reviews.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "use_mock_ml": settings.use_mock_ml,
        "ml_provider": settings.ml_provider,
        "ollama": ml_service.ollama_status(),
        "summary_providers": ml_service.summary_providers_status(),
        "multi_university": True,
        "auth_required": settings.auth_required,
        "firebase_project_id": settings.firebase_project_id or None,
    }
