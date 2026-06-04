from __future__ import annotations

from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class UniversityListItem(BaseModel):
    university_id: UUID
    name: str
    slug: str
    country: str
    course_count: int = 0
    review_count: int = 0

    model_config = {"from_attributes": True}


class UniversityDetailResponse(BaseModel):
    university_id: UUID
    name: str
    slug: str
    country: str
    course_count: int
    review_count: int


class CourseResponse(BaseModel):
    course_id: UUID
    course_code: str
    course_name: str
    department: str
    credits: int

    model_config = {"from_attributes": True}


class CourseListItem(BaseModel):
    course_id: UUID
    course_code: str
    course_name: str

    model_config = {"from_attributes": True}


class CourseAnalyticsResponse(BaseModel):
    course_id: UUID
    course_code: str
    course_name: str
    positive: int
    neutral: int
    negative: int
    topics: list[str]
    summary: str


class ReviewResponse(BaseModel):
    review_id: UUID
    offering_id: UUID
    rating: int
    review_text: str
    created_at: datetime
    sentiment: Optional[str] = None
    professor_name: Optional[str] = None
    semester: Optional[str] = None
    year: Optional[int] = None
    topics: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class ReviewCreateRequest(BaseModel):
    offering_id: UUID
    rating: int = Field(ge=1, le=5)
    review_text: str = Field(min_length=1)


class OfferingResponse(BaseModel):
    offering_id: UUID
    course_id: UUID
    professor_id: UUID
    professor_name: str
    semester: str
    year: int

    model_config = {"from_attributes": True}


class TopTopicItem(BaseModel):
    topic: str
    count: int


class UniversityTopicAnalyticsResponse(BaseModel):
    university_id: UUID
    university_name: str
    topics: list[TopTopicItem]


class SentimentResult(BaseModel):
    sentiment: str
    confidence: float


class UserResponse(BaseModel):
    authenticated: bool
    user_id: Optional[UUID] = None
    email: Optional[str] = None
    display_name: Optional[str] = None
