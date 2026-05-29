from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import parse_qs, urlparse


@dataclass(frozen=True)
class VideoMetadata:
    title: str | None = None
    thumbnail_url: str | None = None


def extract_video_metadata(video_url: str) -> VideoMetadata:
    """Best-effort metadata fetch for project naming and previews."""
    url = (video_url or "").strip()
    if not url:
        return VideoMetadata()
    if not _is_supported_platform_url(url):
        return VideoMetadata()

    try:
        import yt_dlp

        options = {
            "quiet": True,
            "skip_download": True,
            "noplaylist": True,
            "socket_timeout": 15,
            "extract_flat": False,
        }
        with yt_dlp.YoutubeDL(options) as downloader:
            info = downloader.extract_info(url, download=False)
        if isinstance(info, dict):
            return VideoMetadata(
                title=_clean_text(info.get("title") or info.get("fulltitle") or info.get("alt_title")),
                thumbnail_url=_clean_text(info.get("thumbnail")),
            )
    except Exception:
        pass

    return VideoMetadata(thumbnail_url=_youtube_thumbnail(url))


def _is_supported_platform_url(value: str) -> bool:
    try:
        parsed = urlparse(value)
    except Exception:
        return False
    host = parsed.hostname.replace("www.", "") if parsed.hostname else ""
    return host in {"youtube.com", "m.youtube.com", "youtu.be", "vimeo.com", "tiktok.com"}


def _clean_text(value: object) -> str | None:
    if not isinstance(value, str):
        return None
    cleaned = " ".join(value.strip().split())
    return cleaned or None


def _youtube_thumbnail(value: str) -> str | None:
    video_id = _youtube_video_id(value)
    if not video_id:
        return None
    return f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"


def _youtube_video_id(value: str) -> str | None:
    try:
        url = urlparse(value)
    except Exception:
        return None

    host = url.hostname.replace("www.", "") if url.hostname else ""
    if host in {"youtube.com", "m.youtube.com"}:
        if url.path == "/watch":
            return parse_qs(url.query).get("v", [None])[0]
        parts = [part for part in url.path.split("/") if part]
        if len(parts) > 1 and parts[0] in {"shorts", "embed", "live"}:
            return parts[1]
    if host == "youtu.be":
        parts = [part for part in url.path.split("/") if part]
        return parts[0] if parts else None
    return None
