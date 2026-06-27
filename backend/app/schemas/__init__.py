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
    topic_breakdown: list["TopTopicItem"] = Field(default_factory=list)
    summary: str
    review_count: int = 0
    avg_rating: float = 0.0


class SummaryProviderInfo(BaseModel):
    label: str
    description: str
    available: bool
    model: Optional[str] = None


class CourseSummaryRefreshResponse(BaseModel):
    course_id: UUID
    summary: str
    source: str
    requested_provider: str = "default"
    model: Optional[str] = None
    fallback_error: Optional[str] = None


class SemesterTrendPoint(BaseModel):
    semester_label: str
    semester: str
    year: int
    review_count: int
    avg_rating: float
    positive_pct: float
    sentiment_score: float


class CourseComparisonItem(BaseModel):
    course_id: UUID
    course_code: str
    course_name: str
    review_count: int
    avg_rating: float
    positive_pct: float
    sentiment_score: float


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


class ProfessorListItem(BaseModel):
    professor_id: UUID
    professor_name: str
    review_count: int
    avg_rating: float
    sentiment_score: float
    top_topics: list[TopTopicItem] = Field(default_factory=list)


class ProfessorCourseItem(BaseModel):
    course_code: str
    course_name: str
    review_count: int


class ProfessorDetailResponse(BaseModel):
    professor_id: UUID
    professor_name: str
    email: str
    review_count: int
    avg_rating: float
    positive: int
    neutral: int
    negative: int
    sentiment_score: float
    top_topics: list[TopTopicItem]
    courses: list[ProfessorCourseItem] = Field(default_factory=list)


class DatasetInfo(BaseModel):
    id: str
    name: str
    source_url: str
    license: str
    coverage: str
    local_path: str
    download_command: str
    import_command: str
    file_exists: bool
    file_size_bytes: int
    file_modified_at: Optional[str] = None


class DatabaseStats(BaseModel):
    university_count: int
    course_count: int
    review_count: int


class ImportRunResponse(BaseModel):
    run_id: UUID
    source_file: str
    status: str
    rows_imported: int
    rows_skipped: int
    universities_created: int
    error_message: Optional[str] = None
    triggered_by: Optional[str] = None
    started_at: str
    finished_at: Optional[str] = None


class DataCatalogResponse(BaseModel):
    datasets: list[DatasetInfo]
    database: DatabaseStats
    last_import: Optional[ImportRunResponse] = None


class UniversitySentimentRow(BaseModel):
    university_name: str
    positive: int
    neutral: int
    negative: int
    total: int
    positive_pct: float
    sentiment_score: float


class BigQueryDashboardResponse(BaseModel):
    enabled: bool
    table_id: str
    source: str
    row_count: int
    bq_error: Optional[str] = None
    sentiment_by_university: list[UniversitySentimentRow]
    global_top_topics: list[TopTopicItem]
    sync_trigger: str


class ImportRunCreateRequest(BaseModel):
    source_file: str = "data/rmp_public.csv"
    note: Optional[str] = None
