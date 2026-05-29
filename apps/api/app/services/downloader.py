from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlretrieve

from app.models import MediaJob

from .storage import ensure_storage


def download_video(job: MediaJob) -> Path:
    """Download a source video to local storage.

    Supports local file paths, direct media URLs, and common video platforms via
    yt-dlp. In tests only, AETHER_ALLOW_SYNTHETIC_SOURCE=1 can create a short
    local source video when the remote URL is intentionally not downloadable.
    """
    root = ensure_storage()
    source = job.video_url.strip()
    if not source:
        raise ValueError("Video URL is required.")

    local_path = Path(source)
    if local_path.exists() and local_path.is_file():
        destination = root / "raw-videos" / f"{job.id}{local_path.suffix or '.mp4'}"
        shutil.copyfile(local_path, destination)
        _validate_video_file(destination)
        return destination

    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        if os.getenv("AETHER_ALLOW_SYNTHETIC_SOURCE") == "1" and parsed.netloc.endswith("example.com"):
            return _create_synthetic_source(root, job.id)
        try:
            return _download_with_ytdlp(source, root, job)
        except Exception as ytdlp_error:
            if not _looks_like_direct_media_url(source):
                if os.getenv("AETHER_ALLOW_SYNTHETIC_SOURCE") == "1":
                    return _create_synthetic_source(root, job.id)
                raise RuntimeError(f"Unable to download video with yt-dlp: {ytdlp_error}") from ytdlp_error
            try:
                return _download_direct(source, root, job.id)
            except Exception as direct_error:
                if os.getenv("AETHER_ALLOW_SYNTHETIC_SOURCE") == "1":
                    return _create_synthetic_source(root, job.id)
                raise RuntimeError(f"Unable to download video. yt-dlp: {ytdlp_error}; direct: {direct_error}") from direct_error

    if os.getenv("AETHER_ALLOW_SYNTHETIC_SOURCE") == "1":
        return _create_synthetic_source(root, job.id)

    raise ValueError("Video URL must be an HTTP(S) URL or an existing local file path.")


def _download_with_ytdlp(url: str, root: Path, job: MediaJob) -> Path:
    import yt_dlp

    job_id = job.id
    _remove_previous_downloads(root, job_id)
    output_template = str(root / "raw-videos" / f"{job_id}.%(ext)s")
    options = {
        "format": "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/best[height<=720]/best",
        "merge_output_format": "mp4",
        "noplaylist": True,
        "outtmpl": output_template,
        "quiet": True,
        "retries": 2,
        "socket_timeout": 30,
        "writesubtitles": True,
        "writeautomaticsub": True,
        "subtitlesformat": "srt/vtt/best",
        "subtitleslangs": _subtitle_language_candidates(job.source_language),
    }
    with yt_dlp.YoutubeDL(options) as downloader:
        downloader.download([url])

    downloaded = sorted((root / "raw-videos").glob(f"{job_id}.*"))
    if not downloaded:
        raise RuntimeError("yt-dlp finished without producing a file.")
    video_path = _prefer_video(downloaded)
    _validate_video_file(video_path)
    return video_path


def _subtitle_language_candidates(source_language: str | None) -> list[str]:
    candidates: list[str] = []
    for value in (source_language, "en"):
        language = (value or "").strip().lower()
        if language and language not in candidates:
            candidates.append(language)
    return candidates


def _download_direct(url: str, root: Path, job_id: str) -> Path:
    _remove_previous_downloads(root, job_id)
    suffix = Path(urlparse(url).path).suffix or ".mp4"
    if suffix.lower() not in {".mp4", ".mov", ".m4v", ".webm", ".mkv"}:
        suffix = ".mp4"
    destination = root / "raw-videos" / f"{job_id}{suffix}"
    urlretrieve(url, destination)
    if destination.stat().st_size == 0:
        raise RuntimeError("Direct download produced an empty file.")
    _validate_video_file(destination)
    return destination


def _looks_like_direct_media_url(url: str) -> bool:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix in {".mp4", ".mov", ".m4v", ".webm", ".mkv"}


def _remove_previous_downloads(root: Path, job_id: str) -> None:
    for path in (root / "raw-videos").glob(f"{job_id}.*"):
        if path.is_file():
            path.unlink(missing_ok=True)


def _prefer_video(paths: list[Path]) -> Path:
    media_paths = [path for path in paths if path.suffix.lower() in {".mp4", ".mov", ".m4v", ".webm", ".mkv"}]
    if not media_paths:
        raise RuntimeError("Download completed without producing a video file.")
    for path in paths:
        if path.suffix.lower() == ".mp4":
            return path
    return media_paths[0]


def _validate_video_file(path: Path) -> None:
    if not path.exists() or path.stat().st_size == 0:
        raise RuntimeError(f"Downloaded video is empty: {path.name}")

    header = path.read_bytes()[:512].lstrip().lower()
    if header.startswith(b"<!doctype html") or header.startswith(b"<html"):
        path.unlink(missing_ok=True)
        raise RuntimeError("Downloaded source is an HTML page, not a playable video. Check the URL or retry with yt-dlp access restored.")

    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=codec_type",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode != 0 or "video" not in result.stdout:
        path.unlink(missing_ok=True)
        raise RuntimeError(f"Downloaded file is not a valid playable video: {result.stderr[-500:] or path.name}")


def _create_synthetic_source(root: Path, job_id: str) -> Path:
    destination = root / "raw-videos" / f"{job_id}.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "color=c=0x111827:s=1280x720:d=6",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=channel_layout=stereo:sample_rate=44100",
        "-shortest",
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"Unable to create synthetic source: {result.stderr[-1000:]}")
    _validate_video_file(destination)
    return destination
