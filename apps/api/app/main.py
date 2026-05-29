from __future__ import annotations

import asyncio
import json
import os
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, selectinload

from .database import Base, engine, get_db
from .job_runner import create_job, start_mock_job
from .models import AuditLog, Job, MediaJob, MediaJobStatus, Schedule, Video, VideoStatus
from .schemas import (
    BulkVideoCreate,
    JobOut,
    MediaJobCreate,
    MediaJobLogsOut,
    MediaJobOut,
    MediaJobOutputOut,
    MediaJobPatch,
    RunVideosRequest,
    ScheduleRequest,
    VideoOut,
    VideoPatch,
    VideoReviewOut,
)
from .seed import seed_database
from .services.metadata import extract_video_metadata
from .services.review import build_review_artifacts, review_status
from .services.storage import ensure_storage
from .worker import queue_job, retry_job


def serialize_video(video: Video) -> VideoOut:
    latest_job = sorted(video.jobs, key=lambda item: item.created_at, reverse=True)[0] if video.jobs else None
    return VideoOut.model_validate({**video.__dict__, "latest_job": latest_job})


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_schema_compatibility()
    with next(get_db()) as db:
        seed_database(db)
    yield


def ensure_schema_compatibility() -> None:
    """Apply lightweight dev migrations until Alembic is introduced."""
    inspector = inspect(engine)
    if "media_jobs" not in inspector.get_table_names():
        return
    columns = {column["name"] for column in inspector.get_columns("media_jobs")}
    if "voice_rate" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE media_jobs ADD COLUMN voice_rate VARCHAR(16) NOT NULL DEFAULT '+0%'"))
    if "source_title" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE media_jobs ADD COLUMN source_title VARCHAR(500)"))
    if "thumbnail_url" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE media_jobs ADD COLUMN thumbnail_url VARCHAR(2048)"))


app = FastAPI(title="Aether Studio API", version="0.1.0", lifespan=lifespan)
app.mount("/storage", StaticFiles(directory=str(ensure_storage())), name="storage")

web_origin = os.getenv("WEB_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[web_origin, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/jobs", response_model=MediaJobOut)
def create_media_job(payload: MediaJobCreate, db: Session = Depends(get_db)) -> MediaJobOut:
    job = MediaJob(**payload.model_dump(), status=MediaJobStatus.draft, progress=0, current_step="Draft")
    apply_video_metadata(job)
    db.add(job)
    db.flush()
    db.add(AuditLog(entity_type="media_job", entity_id=job.id, action="created", message="Job row created."))
    db.commit()
    db.refresh(job)
    return MediaJobOut.model_validate(job)


@app.get("/jobs", response_model=list[MediaJobOut])
def list_media_jobs(db: Session = Depends(get_db)) -> list[MediaJobOut]:
    jobs = db.query(MediaJob).order_by(MediaJob.updated_at.desc()).all()
    hydrate_missing_metadata(db, jobs)
    return [MediaJobOut.model_validate(job) for job in jobs]


@app.get("/jobs/{job_id}", response_model=MediaJobOut)
def get_media_job(job_id: str, db: Session = Depends(get_db)) -> MediaJobOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return MediaJobOut.model_validate(job)


@app.patch("/jobs/{job_id}", response_model=MediaJobOut)
def patch_media_job(job_id: str, payload: MediaJobPatch, db: Session = Depends(get_db)) -> MediaJobOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")

    patch_data = payload.model_dump(exclude_unset=True)
    for key, value in patch_data.items():
        setattr(job, key, value)
    if "video_url" in patch_data:
        apply_video_metadata(job)
    job.updated_at = datetime.utcnow()
    db.add(AuditLog(entity_type="media_job", entity_id=job.id, action="updated", message="Job row updated."))
    db.commit()
    db.refresh(job)
    return MediaJobOut.model_validate(job)


def apply_video_metadata(job: MediaJob) -> None:
    metadata = extract_video_metadata(job.video_url)
    if metadata.title:
        job.source_title = metadata.title
    if metadata.thumbnail_url:
        job.thumbnail_url = metadata.thumbnail_url


def hydrate_missing_metadata(db: Session, jobs: list[MediaJob]) -> None:
    changed = False
    for job in jobs[:12]:
        if job.source_title and job.thumbnail_url:
            continue
        before = (job.source_title, job.thumbnail_url)
        apply_video_metadata(job)
        if before != (job.source_title, job.thumbnail_url):
            changed = True
    if changed:
        db.commit()


@app.post("/jobs/{job_id}/run", response_model=MediaJobOut)
def run_media_job(job_id: str, db: Session = Depends(get_db)) -> MediaJobOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = queue_job(db, job)
    return MediaJobOut.model_validate(job)


@app.post("/jobs/{job_id}/retry", response_model=MediaJobOut)
def retry_media_job(job_id: str, db: Session = Depends(get_db)) -> MediaJobOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job = retry_job(db, job)
    return MediaJobOut.model_validate(job)


@app.delete("/jobs/{job_id}")
def delete_media_job(job_id: str, db: Session = Depends(get_db)) -> dict[str, str]:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    db.delete(job)
    db.add(AuditLog(entity_type="media_job", entity_id=job_id, action="deleted", message="Job row deleted."))
    db.commit()
    return {"status": "deleted"}


@app.get("/jobs/{job_id}/logs", response_model=MediaJobLogsOut)
def get_media_job_logs(job_id: str, db: Session = Depends(get_db)) -> MediaJobLogsOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return MediaJobLogsOut(job_id=job.id, logs=job.logs or "")


@app.get("/jobs/{job_id}/output", response_model=MediaJobOutputOut)
def get_media_job_output(job_id: str, db: Session = Depends(get_db)) -> MediaJobOutputOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    return MediaJobOutputOut(
        job_id=job.id,
        status=job.status,
        output_url=job.output_url,
        error_message=job.error_message,
    )


@app.get("/jobs/{job_id}/review", response_model=VideoReviewOut)
def get_video_review(job_id: str, db: Session = Depends(get_db)) -> VideoReviewOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    artifacts = build_review_artifacts(job)
    return VideoReviewOut(
        job=MediaJobOut.model_validate(job),
        review_status=review_status(job),
        source_video_url=artifacts.source_video_url,
        localized_video_url=artifacts.localized_video_url,
        original_subtitle_url=artifacts.original_subtitle_url,
        translated_subtitle_url=artifacts.translated_subtitle_url,
        subtitle_rows=[asdict(row) for row in artifacts.subtitle_rows],
        qa_checklist=_review_checklist(job, artifacts.subtitle_rows),
    )


@app.post("/jobs/{job_id}/review/approve", response_model=VideoReviewOut)
def approve_video_review(job_id: str, db: Session = Depends(get_db)) -> VideoReviewOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    if job.status != MediaJobStatus.ready or not job.output_url:
        raise HTTPException(status_code=409, detail="Only ready jobs with output video can be approved.")
    job.current_step = "Review approved"
    job.logs = f"{job.logs}\n[{datetime.utcnow().isoformat(timespec='seconds')}Z] Review approved.".strip()
    job.updated_at = datetime.utcnow()
    db.add(AuditLog(entity_type="media_job", entity_id=job.id, action="review_approved", message="Video review approved."))
    db.commit()
    db.refresh(job)
    return get_video_review(job_id, db)


@app.post("/jobs/{job_id}/review/regenerate", response_model=MediaJobOut)
def regenerate_video_review(job_id: str, db: Session = Depends(get_db)) -> MediaJobOut:
    job = db.get(MediaJob, job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.logs = f"{job.logs}\n[{datetime.utcnow().isoformat(timespec='seconds')}Z] Review regeneration requested.".strip()
    job = retry_job(db, job)
    return MediaJobOut.model_validate(job)


def _review_checklist(job: MediaJob, subtitle_rows: list[object]) -> list[str]:
    checklist: list[str] = []
    checklist.append("Source video available" if job.video_url else "Source video missing")
    checklist.append("Localized output ready" if job.output_url else "Localized output not ready")
    checklist.append("Subtitle rows available" if subtitle_rows else "Subtitle rows missing")
    checklist.append("No processing error" if not job.error_message else f"Error: {job.error_message}")
    return checklist


@app.get("/api/videos", response_model=list[VideoOut])
def list_videos(db: Session = Depends(get_db)) -> list[VideoOut]:
    videos = (
        db.query(Video)
        .options(selectinload(Video.jobs).selectinload(Job.steps))
        .order_by(Video.last_updated.desc())
        .all()
    )
    return [serialize_video(video) for video in videos]


@app.post("/api/videos/bulk", response_model=list[VideoOut])
def create_videos(payload: BulkVideoCreate, db: Session = Depends(get_db)) -> list[VideoOut]:
    videos: list[Video] = []
    for raw_url in payload.urls:
        url = raw_url.strip()
        if not url:
            continue
        video = Video(
            status=VideoStatus.queued,
            video_url=url,
            content="",
            source_language="EN",
            target_language=payload.target_language,
            voice=payload.voice,
            platform=payload.platform,
            workflow_template=payload.workflow_template,
            progress=0,
        )
        db.add(video)
        videos.append(video)

    if not videos:
        raise HTTPException(status_code=400, detail="No valid URLs were provided.")

    db.flush()
    for video in videos:
        db.add(AuditLog(entity_type="video", entity_id=video.id, action="created", message="Video row created."))
    db.commit()

    for video in videos:
        db.refresh(video)
    return [serialize_video(video) for video in videos]


@app.get("/api/videos/{video_id}", response_model=VideoOut)
def get_video(video_id: str, db: Session = Depends(get_db)) -> VideoOut:
    video = (
        db.query(Video)
        .options(selectinload(Video.jobs).selectinload(Job.steps))
        .filter(Video.id == video_id)
        .first()
    )
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")
    return serialize_video(video)


@app.patch("/api/videos/{video_id}", response_model=VideoOut)
def patch_video(video_id: str, payload: VideoPatch, db: Session = Depends(get_db)) -> VideoOut:
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found.")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(video, key, value)
    video.last_updated = datetime.utcnow()
    db.add(AuditLog(entity_type="video", entity_id=video.id, action="updated", message="Video row updated."))
    db.commit()
    db.refresh(video)
    return serialize_video(video)


@app.post("/api/videos/run", response_model=list[JobOut])
def run_videos(payload: RunVideosRequest, db: Session = Depends(get_db)) -> list[JobOut]:
    jobs: list[Job] = []
    for video_id in payload.video_ids:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
        job = create_job(db, video)
        jobs.append(job)
        db.add(AuditLog(entity_type="job", entity_id=job.id, action="started", message="Localization run started."))
        start_mock_job(job.id)

    return [JobOut.model_validate(job) for job in jobs]


@app.post("/api/videos/schedule", response_model=list[VideoOut])
def schedule_videos(payload: ScheduleRequest, db: Session = Depends(get_db)) -> list[VideoOut]:
    videos: list[Video] = []
    for video_id in payload.video_ids:
        video = db.query(Video).filter(Video.id == video_id).first()
        if not video:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_id}")
        video.status = VideoStatus.scheduled
        video.publish_date = payload.publish_date
        video.publish_time = payload.publish_time
        if payload.platform:
            video.platform = payload.platform
        video.last_updated = datetime.utcnow()
        db.add(Schedule(video_id=video.id, platform=video.platform, publish_date=payload.publish_date, publish_time=payload.publish_time))
        videos.append(video)

    db.commit()
    return [serialize_video(video) for video in videos]


@app.get("/api/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobOut:
    job = db.query(Job).options(selectinload(Job.steps)).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found.")
    job.steps = sorted(job.steps, key=lambda step: step.sort_order)
    return JobOut.model_validate(job)


@app.get("/api/jobs/{job_id}/events")
async def job_events(job_id: str):
    async def event_stream():
        last_payload = ""
        while True:
            with next(get_db()) as db:
                job = db.query(Job).options(selectinload(Job.steps)).filter(Job.id == job_id).first()
                if not job:
                    yield "event: error\ndata: {\"detail\":\"Job not found\"}\n\n"
                    return
                job.steps = sorted(job.steps, key=lambda step: step.sort_order)
                payload = JobOut.model_validate(job).model_dump(mode="json")
                text = json.dumps(payload)
                if text != last_payload:
                    yield f"event: job\ndata: {text}\n\n"
                    last_payload = text
                if job.status in {VideoStatus.needs_review, VideoStatus.published, VideoStatus.failed}:
                    return
            await asyncio.sleep(0.7)

    return StreamingResponse(event_stream(), media_type="text/event-stream")
