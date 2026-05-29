from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from .models import MediaJobStatus, StepStatus, VideoStatus


class JobStepOut(BaseModel):
    id: str
    name: str
    status: StepStatus
    progress: int
    runtime_seconds: int
    logs: str
    sort_order: int

    model_config = {"from_attributes": True}


class JobOut(BaseModel):
    id: str
    video_id: str
    status: VideoStatus
    progress: int
    current_step: str
    error: str | None = None
    created_at: datetime
    updated_at: datetime
    steps: list[JobStepOut] = []

    model_config = {"from_attributes": True}


class VideoOut(BaseModel):
    id: str
    status: VideoStatus
    video_url: str
    thumbnail_url: str | None = None
    content: str
    source_language: str
    target_language: str
    voice: str
    platform: str
    publish_date: str | None = None
    publish_time: str | None = None
    workflow_template: str
    progress: int
    last_updated: datetime
    latest_job: JobOut | None = None

    model_config = {"from_attributes": True}


class BulkVideoCreate(BaseModel):
    urls: list[str] = Field(min_length=1)
    target_language: str = "VI"
    voice: str = "auto"
    platform: str = "YouTube"
    workflow_template: str = "Full Localization"


class VideoPatch(BaseModel):
    status: VideoStatus | None = None
    video_url: str | None = None
    content: str | None = None
    source_language: str | None = None
    target_language: str | None = None
    voice: str | None = None
    platform: str | None = None
    publish_date: str | None = None
    publish_time: str | None = None
    workflow_template: str | None = None


class RunVideosRequest(BaseModel):
    video_ids: list[str] = Field(min_length=1)


class ScheduleRequest(BaseModel):
    video_ids: list[str] = Field(min_length=1)
    publish_date: str
    publish_time: str
    platform: str | None = None


class MediaJobCreate(BaseModel):
    video_url: str = Field(min_length=1, max_length=1024)
    content: str = ""
    source_language: str = "EN"
    target_language: str = "VI"
    voice: str = "auto"
    voice_rate: str = "+0%"
    platform: str = "YouTube"
    publish_date: str | None = None
    publish_time: str | None = None


class MediaJobPatch(BaseModel):
    video_url: str | None = None
    content: str | None = None
    source_language: str | None = None
    target_language: str | None = None
    voice: str | None = None
    voice_rate: str | None = None
    platform: str | None = None
    publish_date: str | None = None
    publish_time: str | None = None
    status: MediaJobStatus | None = None


class MediaJobOut(BaseModel):
    id: str
    video_url: str
    content: str
    source_language: str
    target_language: str
    voice: str
    voice_rate: str
    platform: str
    publish_date: str | None = None
    publish_time: str | None = None
    status: MediaJobStatus
    progress: int
    current_step: str
    output_url: str | None = None
    error_message: str | None = None
    logs: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MediaJobLogsOut(BaseModel):
    job_id: str
    logs: str


class MediaJobOutputOut(BaseModel):
    job_id: str
    status: MediaJobStatus
    output_url: str | None = None
    error_message: str | None = None
