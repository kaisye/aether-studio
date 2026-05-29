from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

from app.models import MediaJob, MediaJobStatus

from .storage import ensure_storage


@dataclass(frozen=True)
class ReviewSubtitleRow:
    start: str
    end: str
    original_text: str
    translated_text: str


@dataclass(frozen=True)
class ReviewArtifacts:
    source_video_url: str | None
    localized_video_url: str | None
    original_subtitle_url: str | None
    translated_subtitle_url: str | None
    subtitle_rows: list[ReviewSubtitleRow]


def build_review_artifacts(job: MediaJob) -> ReviewArtifacts:
    root = ensure_storage()
    source_video = _find_first(root / "raw-videos", job.id, {".mp4", ".mov", ".m4v", ".webm", ".mkv"})
    original_subtitle = _find_original_subtitle(root / "subtitles", job.id)
    translated_subtitle = _find_translated_subtitle(root / "subtitles", job.id)

    original_rows = _parse_srt(original_subtitle) if original_subtitle else []
    translated_rows = _parse_srt(translated_subtitle) if translated_subtitle else []
    subtitle_rows = _merge_subtitle_rows(original_rows, translated_rows)

    return ReviewArtifacts(
        source_video_url=_storage_url("raw-videos", source_video),
        localized_video_url=job.output_url,
        original_subtitle_url=_storage_url("subtitles", original_subtitle),
        translated_subtitle_url=_storage_url("subtitles", translated_subtitle),
        subtitle_rows=subtitle_rows,
    )


def review_status(job: MediaJob) -> str:
    if "Review approved." in (job.logs or ""):
        return "approved"
    if job.status == MediaJobStatus.ready and job.output_url:
        return "ready"
    if job.status == MediaJobStatus.failed:
        return "failed"
    return "processing"


def _find_first(directory: Path, stem: str, suffixes: set[str]) -> Path | None:
    matches = sorted(path for path in directory.glob(f"{stem}.*") if path.suffix.lower() in suffixes)
    return matches[0] if matches else None


def _find_original_subtitle(directory: Path, stem: str) -> Path | None:
    candidates = sorted(directory.glob(f"{stem}*.srt"))
    originals = [path for path in candidates if ".render" not in path.name and ".generated" not in path.name]
    return originals[0] if originals else (candidates[0] if candidates else None)


def _find_translated_subtitle(directory: Path, stem: str) -> Path | None:
    candidates = sorted(directory.glob(f"{stem}*.render.srt"))
    return candidates[0] if candidates else None


def _storage_url(folder: str, path: Path | None) -> str | None:
    if not path:
        return None
    return f"/storage/{folder}/{path.name}"


def _parse_srt(path: Path) -> list[ReviewSubtitleRow]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if "-->" in block]
    rows: list[ReviewSubtitleRow] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if timing_index is None:
            continue
        start, end = _parse_timing(lines[timing_index])
        caption = " ".join(line for line in lines[timing_index + 1 :] if not line.isdigit()).strip()
        rows.append(ReviewSubtitleRow(start=start, end=end, original_text=caption, translated_text=caption))
    return rows


def _parse_timing(line: str) -> tuple[str, str]:
    start, end = line.split("-->", 1)
    return _normalize_time(start), _normalize_time(end.split()[0])


def _normalize_time(value: str) -> str:
    return value.strip().replace(",", ".")


def _merge_subtitle_rows(original: list[ReviewSubtitleRow], translated: list[ReviewSubtitleRow]) -> list[ReviewSubtitleRow]:
    total = max(len(original), len(translated))
    rows: list[ReviewSubtitleRow] = []
    for index in range(total):
        source = original[index] if index < len(original) else None
        target = translated[index] if index < len(translated) else None
        rows.append(
            ReviewSubtitleRow(
                start=(target or source).start if (target or source) else "00:00:00.000",
                end=(target or source).end if (target or source) else "00:00:00.000",
                original_text=source.original_text if source else "",
                translated_text=target.translated_text if target else "",
            )
        )
    return rows
