from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import CourseAnalyticsResponse, CourseListItem, OfferingResponse
from app.services.course_service import course_service

router = APIRouter(prefix="/api/v1/courses", tags=["courses"], deprecated=True)


@router.get("", response_model=list[CourseListItem])
def list_courses(q: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    courses = course_service.list_courses(db, query=q)
    return courses


@router.get("/{course_id}/analytics", response_model=CourseAnalyticsResponse)
def get_course_analytics(course_id: UUID, db: Session = Depends(get_db)):
    analytics = course_service.get_analytics(db, course_id)
    if not analytics:
        raise HTTPException(status_code=404, detail="Course not found")
    return analytics


@router.get("/{course_id}/offerings", response_model=list[OfferingResponse])
def get_course_offerings(course_id: UUID, db: Session = Depends(get_db)):
    course = course_service.get_course(db, course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    offerings = course_service.get_offerings(db, course_id)
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
