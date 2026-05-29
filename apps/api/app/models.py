from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def new_id() -> str:
    return str(uuid.uuid4())


class VideoStatus(str, enum.Enum):
    draft = "draft"
    queued = "queued"
    processing = "processing"
    needs_review = "needs_review"
    scheduled = "scheduled"
    published = "published"
    failed = "failed"


class MediaJobStatus(str, enum.Enum):
    draft = "draft"
    queued = "queued"
    downloading = "downloading"
    transcribing = "transcribing"
    translating = "translating"
    tts_generating = "tts_generating"
    rendering = "rendering"
    ready = "ready"
    failed = "failed"


class StepStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Video(Base):
    __tablename__ = "videos"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.queued)
    video_url: Mapped[str] = mapped_column(String(1024))
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    content: Mapped[str] = mapped_column(Text, default="")
    source_language: Mapped[str] = mapped_column(String(16), default="EN")
    target_language: Mapped[str] = mapped_column(String(16), default="DE")
    voice: Mapped[str] = mapped_column(String(120), default="auto")
    platform: Mapped[str] = mapped_column(String(80), default="YouTube")
    publish_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    publish_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    workflow_template: Mapped[str] = mapped_column(String(120), default="Full Localization")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    jobs: Mapped[list["Job"]] = relationship(back_populates="video", cascade="all, delete-orphan")
    schedules: Mapped[list["Schedule"]] = relationship(back_populates="video", cascade="all, delete-orphan")


class MediaJob(Base):
    __tablename__ = "media_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    video_url: Mapped[str] = mapped_column(String(1024))
    source_title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    content: Mapped[str] = mapped_column(Text, default="")
    source_language: Mapped[str] = mapped_column(String(16), default="EN")
    target_language: Mapped[str] = mapped_column(String(16), default="VI")
    voice: Mapped[str] = mapped_column(String(120), default="auto")
    voice_rate: Mapped[str] = mapped_column(String(16), default="+0%")
    platform: Mapped[str] = mapped_column(String(80), default="YouTube")
    publish_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    publish_time: Mapped[str | None] = mapped_column(String(20), nullable=True)
    status: Mapped[MediaJobStatus] = mapped_column(Enum(MediaJobStatus), default=MediaJobStatus.draft)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[str] = mapped_column(String(120), default="Draft")
    output_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    logs: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id"))
    status: Mapped[VideoStatus] = mapped_column(Enum(VideoStatus), default=VideoStatus.queued)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    current_step: Mapped[str] = mapped_column(String(120), default="Queued")
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    video: Mapped[Video] = relationship(back_populates="jobs")
    steps: Mapped[list["JobStep"]] = relationship(back_populates="job", cascade="all, delete-orphan")


class JobStep(Base):
    __tablename__ = "job_steps"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    job_id: Mapped[str] = mapped_column(ForeignKey("jobs.id"))
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[StepStatus] = mapped_column(Enum(StepStatus), default=StepStatus.pending)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    runtime_seconds: Mapped[int] = mapped_column(Integer, default=0)
    logs: Mapped[str] = mapped_column(Text, default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    job: Mapped[Job] = relationship(back_populates="steps")


class Voice(Base):
    __tablename__ = "voices"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120))
    locale: Mapped[str] = mapped_column(String(16), default="en-US")
    style: Mapped[str] = mapped_column(String(80), default="Narration")


class WorkflowTemplate(Base):
    __tablename__ = "workflow_templates"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    name: Mapped[str] = mapped_column(String(120), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")


class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    video_id: Mapped[str] = mapped_column(ForeignKey("videos.id"))
    platform: Mapped[str] = mapped_column(String(80))
    publish_date: Mapped[str] = mapped_column(String(20))
    publish_time: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(40), default="scheduled")

    video: Mapped[Video] = relationship(back_populates="schedules")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)
    entity_type: Mapped[str] = mapped_column(String(80))
    entity_id: Mapped[str] = mapped_column(String(36))
    action: Mapped[str] = mapped_column(String(120))
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
