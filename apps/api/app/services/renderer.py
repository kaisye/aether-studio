from __future__ import annotations

import subprocess
from pathlib import Path

from .storage import ensure_storage


def render_video(video_path: Path, audio_path: Path, subtitle_path: Path) -> Path:
    """Render a real MP4 output with the generated voice and subtitles."""
    root = ensure_storage()
    output = root / "rendered-outputs" / f"{video_path.stem}.mp4"
    video_duration = _probe_duration(video_path)

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-i",
        str(audio_path),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-vf",
        _subtitle_filter(subtitle_path),
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-t",
        f"{video_duration:.3f}",
        str(output),
    ]

    result = subprocess.run(command, capture_output=True, text=True, timeout=600)
    if result.returncode == 0 and output.exists() and output.stat().st_size > 0:
        return output

    return _render_with_subtitle_track(video_path, audio_path, subtitle_path, output, result.stderr)


def _render_with_subtitle_track(video_path: Path, audio_path: Path, subtitle_path: Path, output: Path, previous_error: str) -> Path:
    video_duration = _probe_duration(video_path)
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-i",
        str(audio_path),
        "-i",
        str(subtitle_path),
        "-map",
        "0:v:0",
        "-map",
        "1:a:0",
        "-map",
        "2:0",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-c:s",
        "mov_text",
        "-t",
        f"{video_duration:.3f}",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=600)
    if result.returncode != 0:
        raise RuntimeError(f"Render failed. Burn-in error: {previous_error[-1000:]}; subtitle-track error: {result.stderr[-1000:]}")
    if not output.exists() or output.stat().st_size == 0:
        raise RuntimeError("Render completed without producing an output video.")
    return output


def _subtitle_filter(subtitle_path: Path) -> str:
    normalized = subtitle_path.resolve().as_posix().replace(":", r"\:").replace("'", r"\\'")
    return f"subtitles='{normalized}':force_style='FontName=Arial,FontSize=24,Outline=2,Shadow=1,MarginV=40'"


def _probe_duration(path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return 3600.0
    try:
        return max(0.1, float(result.stdout.strip()))
    except ValueError:
        return 3600.0
