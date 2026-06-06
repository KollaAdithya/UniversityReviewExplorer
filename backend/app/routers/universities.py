from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import (
    CourseAnalyticsResponse,
    CourseComparisonItem,
    CourseListItem,
    OfferingResponse,
    ReviewResponse,
    SemesterTrendPoint,
    UniversityDetailResponse,
    UniversityListItem,
    UniversityTopicAnalyticsResponse,
)
from app.services.course_service import course_service, review_service
from app.services.university_service import university_service

router = APIRouter(prefix="/api/v1/universities", tags=["universities"])


@router.get("", response_model=list[UniversityListItem])
def list_universities(q: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    return university_service.list_universities(db, query=q)


@router.get("/{university_id}", response_model=UniversityDetailResponse)
def get_university(university_id: UUID, db: Session = Depends(get_db)):
    university = university_service.get_university(db, university_id)
    if not university:
        raise HTTPException(status_code=404, detail="University not found")
    return university


@router.get("/{university_id}/courses", response_model=list[CourseListItem])
def list_university_courses(
    university_id: UUID,
    q: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if not university_service.get_university(db, university_id):
        raise HTTPException(status_code=404, detail="University not found")
    return course_service.list_courses(db, university_id=university_id, query=q)


@router.get("/{university_id}/courses/{course_id}/analytics", response_model=CourseAnalyticsResponse)
def get_university_course_analytics(
    university_id: UUID,
    course_id: UUID,
    db: Session = Depends(get_db),
):
    analytics = course_service.get_analytics(db, course_id, university_id=university_id)
    if not analytics:
        raise HTTPException(status_code=404, detail="Course not found")
    return analytics


@router.get("/{university_id}/courses/{course_id}/reviews", response_model=list[ReviewResponse])
def list_university_course_reviews(
    university_id: UUID,
    course_id: UUID,
    semester: Optional[str] = Query(default=None),
    professor: Optional[str] = Query(default=None),
    sentiment: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    if not course_service.get_course(db, course_id, university_id=university_id):
        raise HTTPException(status_code=404, detail="Course not found")
    return review_service.list_reviews(
        db,
        course_id=course_id,
        university_id=university_id,
        semester=semester,
        professor=professor,
        sentiment=sentiment,
    )


@router.get("/{university_id}/courses/{course_id}/offerings", response_model=list[OfferingResponse])
def list_university_course_offerings(
    university_id: UUID,
    course_id: UUID,
    db: Session = Depends(get_db),
):
    if not course_service.get_course(db, course_id, university_id=university_id):
        raise HTTPException(status_code=404, detail="University or course not found")

    offerings = course_service.get_offerings(db, course_id, university_id=university_id)
    return [
        OfferingResponse(
            offering_id=offering.offering_id,
            course_id=offering.course_id,
            professor_id=offering.professor_id,
            professor_name=offering.professor.professor_name,
            semester=offering.semester,
            year=offering.year,
        )
        for offering in offerings
    ]


@router.get(
    "/{university_id}/courses/{course_id}/trends",
    response_model=list[SemesterTrendPoint],
)
def get_course_semester_trends(
    university_id: UUID,
    course_id: UUID,
    db: Session = Depends(get_db),
):
    if not course_service.get_course(db, course_id, university_id=university_id):
        raise HTTPException(status_code=404, detail="Course not found")
    return course_service.get_semester_trends(db, course_id, university_id=university_id)


@router.get(
    "/{university_id}/analytics/course-comparison",
    response_model=list[CourseComparisonItem],
)
def get_university_course_comparison(university_id: UUID, db: Session = Depends(get_db)):
    if not university_service.get_university(db, university_id):
        raise HTTPException(status_code=404, detail="University not found")
    return course_service.get_university_course_comparison(db, university_id)


@router.get("/{university_id}/analytics/top-topics", response_model=UniversityTopicAnalyticsResponse)
def get_university_top_topics(
    university_id: UUID,
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    university = university_service.get_university(db, university_id)
    if not university:
        raise HTTPException(status_code=404, detail="University not found")
    topics = university_service.get_top_topics(db, university_id, limit=limit)
    return {
        "university_id": university_id,
        "university_name": university["name"],
        "topics": topics,
    }
