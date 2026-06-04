from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AppUser(Base):
    __tablename__ = "app_user"

    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    firebase_uid: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False, default="Student")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    reviews: Mapped[list["Review"]] = relationship(back_populates="author")


class University(Base):
    __tablename__ = "university"

    university_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    slug: Mapped[str] = mapped_column(String(80), nullable=False, unique=True, index=True)
    country: Mapped[str] = mapped_column(String(50), nullable=False, default="USA")

    courses: Mapped[list["Course"]] = relationship(back_populates="university")
    professors: Mapped[list["Professor"]] = relationship(back_populates="university")


class Course(Base):
    __tablename__ = "course"
    __table_args__ = (UniqueConstraint("university_id", "course_code", name="uq_course_university_code"),)

    course_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    university_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("university.university_id"), nullable=False)
    course_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    course_name: Mapped[str] = mapped_column(String(100), nullable=False)
    department: Mapped[str] = mapped_column(String(50), nullable=False)
    credits: Mapped[int] = mapped_column(Integer, nullable=False, default=3)

    university: Mapped["University"] = relationship(back_populates="courses")
    offerings: Mapped[list["CourseOffering"]] = relationship(back_populates="course")
    summary: Mapped["CourseSummary | None"] = relationship(back_populates="course", uselist=False)


class Professor(Base):
    __tablename__ = "professor"
    __table_args__ = (UniqueConstraint("university_id", "professor_name", name="uq_professor_university_name"),)

    professor_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    university_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("university.university_id"), nullable=False)
    professor_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(100), nullable=False)

    university: Mapped["University"] = relationship(back_populates="professors")
    offerings: Mapped[list["CourseOffering"]] = relationship(back_populates="professor")


class CourseOffering(Base):
    __tablename__ = "course_offering"

    offering_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("course.course_id"), nullable=False)
    professor_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("professor.professor_id"), nullable=False)
    semester: Mapped[str] = mapped_column(String(20), nullable=False)
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    course: Mapped["Course"] = relationship(back_populates="offerings")
    professor: Mapped["Professor"] = relationship(back_populates="offerings")
    reviews: Mapped[list["Review"]] = relationship(back_populates="offering")


class Review(Base):
    __tablename__ = "review"

    review_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    offering_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("course_offering.offering_id"), nullable=False)
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid, ForeignKey("app_user.user_id"), nullable=True)
    review_text: Mapped[str] = mapped_column(Text, nullable=False)
    rating: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    offering: Mapped["CourseOffering"] = relationship(back_populates="reviews")
    author: Mapped["AppUser | None"] = relationship(back_populates="reviews")
    sentiment: Mapped["SentimentAnalysis | None"] = relationship(back_populates="review", uselist=False)
    topics: Mapped[list["TopicAnalysis"]] = relationship(back_populates="review")


class SentimentAnalysis(Base):
    __tablename__ = "sentiment_analysis"

    review_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("review.review_id"), primary_key=True)
    sentiment: Mapped[str] = mapped_column(String(20), nullable=False)
    confidence_score: Mapped[float] = mapped_column(Numeric(5, 2), nullable=False)

    review: Mapped["Review"] = relationship(back_populates="sentiment")


class TopicAnalysis(Base):
    __tablename__ = "topic_analysis"

    topic_id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    review_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("review.review_id"), nullable=False)
    topic_name: Mapped[str] = mapped_column(String(50), nullable=False)

    review: Mapped["Review"] = relationship(back_populates="topics")


class CourseSummary(Base):
    __tablename__ = "course_summary"

    course_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("course.course_id"), primary_key=True)
    positive_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    neutral_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    negative_reviews: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    overall_score: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    generated_summary: Mapped[str] = mapped_column(Text, default="", nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    course: Mapped["Course"] = relationship(back_populates="summary")
