from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.schemas import CourseListItem, UniversityTopicAnalyticsResponse
from app.services.course_service import course_service
from app.services.university_service import university_service

router = APIRouter(prefix="/api/v1/analytics", tags=["analytics"])


@router.get("/top-topics", response_model=list[UniversityTopicAnalyticsResponse])
def get_top_topics_by_university(
    university_id: Optional[UUID] = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
    db: Session = Depends(get_db),
):
    universities = university_service.list_universities(db)
    if university_id:
        universities = [item for item in universities if item["university_id"] == university_id]

    results = []
    for university in universities:
        topics = university_service.get_top_topics(db, university["university_id"], limit=limit)
        results.append(
            {
                "university_id": university["university_id"],
                "university_name": university["name"],
                "topics": topics,
            }
        )
    return results


@router.get("/courses", response_model=list[CourseListItem], deprecated=True)
def list_all_courses(q: Optional[str] = Query(default=None), db: Session = Depends(get_db)):
    return course_service.list_courses(db, query=q)
