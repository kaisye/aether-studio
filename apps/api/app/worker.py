from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import MediaJob, MediaJobStatus
from .services.downloader import download_video
from .services.renderer import render_video
from .services.storage import ensure_storage
from .services.subtitle import extract_subtitle
from .services.translator import translate_subtitle, translation_limit_label
from .services.tts import generate_tts


RUNNING_STATUSES = {
    MediaJobStatus.queued,
    MediaJobStatus.downloading,
    MediaJobStatus.transcribing,
    MediaJobStatus.translating,
    MediaJobStatus.tts_generating,
    MediaJobStatus.rendering,
}


def queue_job(db: Session, job: MediaJob) -> MediaJob:
    if job.status in RUNNING_STATUSES:
        return job

    job.status = MediaJobStatus.queued
    job.progress = 0
    job.current_step = "Queued"
    job.error_message = None
    job.output_url = None
    job.logs = append_log(job.logs, "Job queued.")
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)

    thread = threading.Thread(target=process_job, args=(job.id,), daemon=True)
    thread.start()
    return job


def retry_job(db: Session, job: MediaJob) -> MediaJob:
    job.status = MediaJobStatus.draft
    job.progress = 0
    job.current_step = "Draft"
    job.error_message = None
    job.output_url = None
    job.logs = append_log(job.logs, "Retry requested.")
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return queue_job(db, job)


def process_job(job_id: str) -> None:
    try:
        _run_pipeline(job_id)
    except Exception as exc:  # pragma: no cover - defensive guard for worker threads.
        with SessionLocal() as db:
            job = db.get(MediaJob, job_id)
            if not job:
                return
            _mark_failed(db, job, str(exc))


def _run_pipeline(job_id: str) -> None:
    with SessionLocal() as db:
        job = db.get(MediaJob, job_id)
        if not job:
            return

        _set_step(db, job, MediaJobStatus.downloading, 10, "Downloading source video")
        raw_video_path = download_video(job)
        _log_artifact(job, raw_video_path)

        _set_step(db, job, MediaJobStatus.transcribing, 30, "Extracting subtitle track or generating subtitle with LLM")
        subtitle_path = extract_subtitle(raw_video_path, job.content, job.target_language, job.source_language)
        _log_artifact(job, subtitle_path)

        _set_step(db, job, MediaJobStatus.translating, 50, "Preparing localized subtitle file")
        limit_label = translation_limit_label()
        if limit_label:
            job.logs = append_log(job.logs, limit_label)
            _persist_job_log(job)
            db.commit()
        translated_subtitle_path = translate_subtitle(subtitle_path, job.target_language, job.source_language)
        _log_artifact(job, translated_subtitle_path)

        _set_step(db, job, MediaJobStatus.tts_generating, 70, "Generating voice audio")
        audio_path = generate_tts(translated_subtitle_path, job.voice, job.target_language, job.voice_rate)
        _log_artifact(job, audio_path)

        _set_step(db, job, MediaJobStatus.rendering, 90, "Rendering localized video")
        output_path = render_video(raw_video_path, audio_path, translated_subtitle_path)
        _log_artifact(job, output_path)

        job.status = MediaJobStatus.ready
        job.progress = 100
        job.current_step = "Ready"
        job.output_url = f"/storage/rendered-outputs/{output_path.name}"
        job.error_message = None
        job.logs = append_log(job.logs, "Job completed. Output is ready.")
        job.updated_at = datetime.utcnow()
        _persist_job_log(job)
        db.commit()


def _set_step(db: Session, job: MediaJob, status: MediaJobStatus, progress: int, step: str) -> None:
    job.status = status
    job.progress = progress
    job.current_step = step
    job.error_message = None
    job.logs = append_log(job.logs, step)
    job.updated_at = datetime.utcnow()
    _persist_job_log(job)
    db.commit()
    db.refresh(job)


def _mark_failed(db: Session, job: MediaJob, message: str) -> None:
    job.status = MediaJobStatus.failed
    job.current_step = "Failed"
    job.error_message = message
    job.logs = append_log(job.logs, f"Failed: {message}")
    job.updated_at = datetime.utcnow()
    _persist_job_log(job)
    db.commit()


def _log_artifact(job: MediaJob, artifact_path: Path) -> None:
    job.logs = append_log(job.logs, f"Created artifact: {artifact_path.name}")


def append_log(logs: str | None, message: str) -> str:
    timestamp = datetime.utcnow().isoformat(timespec="seconds")
    current = logs or ""
    return f"{current}\n[{timestamp}Z] {message}".strip()


def _persist_job_log(job: MediaJob) -> None:
    root = ensure_storage()
    (root / "logs" / f"{job.id}.log").write_text(job.logs or "", encoding="utf-8")
