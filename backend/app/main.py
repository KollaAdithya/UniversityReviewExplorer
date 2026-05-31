from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import analytics, courses, reviews, universities

app = FastAPI(title="Campus Course Review Explorer", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(universities.router)
app.include_router(analytics.router)
app.include_router(courses.router)
app.include_router(reviews.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "environment": settings.environment,
        "use_mock_ml": settings.use_mock_ml,
        "multi_university": True,
    }
