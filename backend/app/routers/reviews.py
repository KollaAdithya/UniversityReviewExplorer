from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.models import CourseOffering
from app.db.session import get_db
from app.schemas import ReviewCreateRequest, ReviewResponse
from app.services.course_service import review_service

router = APIRouter(prefix="/api/v1", tags=["reviews"])


@router.get("/courses/{course_id}/reviews", response_model=list[ReviewResponse])
def list_reviews(
    course_id: UUID,
    semester: Optional[str] = Query(default=None),
    professor: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    return review_service.list_reviews(
        db,
        course_id=course_id,
        semester=semester,
        professor=professor,
        sentiment=sentiment,
    )


@router.post("/reviews", response_model=ReviewResponse, status_code=201)
def create_review(payload: ReviewCreateRequest, db: Session = Depends(get_db)):
    try:
        review = review_service.create_review(
            db,
            offering_id=payload.offering_id,
            rating=payload.rating,
            review_text=payload.review_text,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    offering = db.query(CourseOffering).filter(CourseOffering.offering_id == payload.offering_id).first()
    loaded = review_service.list_reviews(db, course_id=offering.course_id)
    created = next(item for item in loaded if item["review_id"] == review.review_id)
    return created
