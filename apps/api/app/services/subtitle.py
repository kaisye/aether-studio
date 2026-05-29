from __future__ import annotations

import json
import math
import os
import re
import subprocess
from pathlib import Path

import httpx

from .storage import ensure_storage


def extract_subtitle(video_path: Path, brief: str | None = None, target_language: str = "EN", source_language: str | None = None) -> Path:
    """Return a subtitle file that becomes the source for TTS.

    Order of operations:
    1. Extract embedded subtitles from the video if present.
    2. Generate subtitles with NVIDIA Integrate from the supplied brief if configured.
    3. Use deterministic local generation only when explicitly enabled for tests/dev.
    """
    extracted = _find_sidecar_subtitle(video_path, target_language, source_language)
    if extracted:
        return extracted

    extracted = _extract_embedded_subtitle(video_path, target_language)
    if extracted:
        return extracted

    normalized_brief = _normalize_text(brief)
    if normalized_brief and os.getenv("AETHER_ALLOW_LOCAL_SUBTITLE_GENERATION") == "1":
        return _generate_subtitle_locally(video_path, normalized_brief, target_language)

    if normalized_brief and _nvidia_configured():
        return _generate_subtitle_with_nvidia(video_path, normalized_brief, target_language)

    raise ValueError(
        "No YouTube caption sidecar or embedded subtitle track was found. Configure NVIDIA_API_KEY to generate subtitles from the brief, "
        "or use a video that already contains subtitles/captions.",
    )


def subtitle_to_plain_text(subtitle_path: Path) -> str:
    lines = subtitle_path.read_text(encoding="utf-8").splitlines()
    text_lines = [
        line.strip()
        for line in lines
        if line.strip() and not line.strip().isdigit() and "-->" not in line
    ]
    return " ".join(text_lines).strip()


def _find_sidecar_subtitle(video_path: Path, target_language: str, source_language: str | None) -> Path | None:
    candidates = list(video_path.parent.glob(f"{video_path.stem}*.srt")) + list(video_path.parent.glob(f"{video_path.stem}*.vtt"))
    candidates = [path for path in candidates if path.is_file() and path.name != video_path.name]
    if not candidates:
        return None

    ordered_languages = _language_candidates(target_language, source_language)
    for language in ordered_languages:
        match = next((path for path in candidates if f".{language.lower()}." in path.name.lower() or path.name.lower().endswith(f".{language.lower()}{path.suffix.lower()}")), None)
        if match:
            return _normalize_sidecar_to_srt(match, target_language)

    return _normalize_sidecar_to_srt(candidates[0], target_language)


def _normalize_sidecar_to_srt(path: Path, target_language: str) -> Path:
    if path.suffix.lower() == ".srt":
        destination = ensure_storage() / "subtitles" / f"{path.stem}.{target_language.lower()}.sidecar.srt"
        destination.write_text(path.read_text(encoding="utf-8", errors="ignore"), encoding="utf-8")
        return destination

    destination = ensure_storage() / "subtitles" / f"{path.stem}.{target_language.lower()}.sidecar.srt"
    command = ["ffmpeg", "-y", "-i", str(path), str(destination)]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode == 0 and destination.exists() and subtitle_to_plain_text(destination):
        return destination

    text = _vtt_to_srt_text(path.read_text(encoding="utf-8", errors="ignore"))
    destination.write_text(text, encoding="utf-8")
    return destination


def _vtt_to_srt_text(text: str) -> str:
    text = re.sub(r"^\ufeff?WEBVTT.*?(\r?\n){2}", "", text, flags=re.DOTALL)
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if "-->" in block]
    normalized: list[str] = []
    for index, block in enumerate(blocks, start=1):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if lines and "-->" not in lines[0]:
            lines = lines[1:]
        if lines:
            lines[0] = re.sub(r"(\d{2}:\d{2}:\d{2})\.(\d{3})", r"\1,\2", lines[0])
            normalized.append(f"{index}\n" + "\n".join(lines))
    return "\n\n".join(normalized)


def _language_candidates(target_language: str | None, source_language: str | None) -> list[str]:
    candidates: list[str] = []
    for value in (target_language, source_language, "en", "vi"):
        language = (value or "").strip().lower()
        if language and language not in candidates:
            candidates.append(language)
    return candidates


def _extract_embedded_subtitle(video_path: Path, target_language: str) -> Path | None:
    subtitle_stream = _first_subtitle_stream(video_path)
    if subtitle_stream is None:
        return None

    root = ensure_storage()
    path = root / "subtitles" / f"{video_path.stem}.{target_language.lower()}.extracted.srt"
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-map",
        f"0:{subtitle_stream}",
        str(path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if result.returncode != 0 or not path.exists() or not subtitle_to_plain_text(path):
        return None
    return path


def _first_subtitle_stream(video_path: Path) -> int | None:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-select_streams",
        "s",
        "-show_entries",
        "stream=index,codec_name",
        "-of",
        "json",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return None
    try:
        streams = json.loads(result.stdout).get("streams", [])
    except json.JSONDecodeError:
        return None
    if not streams:
        return None
    return int(streams[0]["index"])


def _generate_subtitle_with_nvidia(video_path: Path, brief: str, target_language: str) -> Path:
    root = ensure_storage()
    duration = max(_probe_duration(video_path), 6.0)
    model = os.getenv("NVIDIA_MODEL", "qwen/qwen3.5-397b-a17b")
    api_key = _nvidia_api_key()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is required for LLM subtitle generation.")

    prompt = (
        "Create production-ready SRT subtitles for a localized video.\n"
        f"Target language: {target_language}\n"
        f"Video duration: {duration:.1f} seconds\n"
        "Return only valid SRT. Do not include markdown.\n"
        "Use the brief below as source material, but write natural subtitle lines rather than copying it verbatim.\n\n"
        f"Brief:\n{brief}"
    )
    response = httpx.post(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": [
                {"role": "system", "content": "You generate concise, valid SRT subtitle files for media localization."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 16384,
            "temperature": 0.3,
            "top_p": 0.95,
            "top_k": 20,
            "presence_penalty": 0,
            "repetition_penalty": 1,
            "stream": False,
            "chat_template_kwargs": {"enable_thinking": True},
        },
        timeout=60,
    )
    response.raise_for_status()
    content = _extract_srt_content(response.json()["choices"][0]["message"]["content"].strip())
    if "-->" not in content:
        raise RuntimeError("LLM response did not contain valid SRT timing markers.")

    path = root / "subtitles" / f"{video_path.stem}.{target_language.lower()}.generated.srt"
    path.write_text(content, encoding="utf-8")
    return path


def _generate_subtitle_locally(video_path: Path, brief: str, target_language: str) -> Path:
    root = ensure_storage()
    duration = max(_probe_duration(video_path), 6.0)
    chunks = _chunk_text(brief)
    segment_duration = max(duration / max(len(chunks), 1), 2.0)

    path = root / "subtitles" / f"{video_path.stem}.{target_language.lower()}.generated.srt"
    entries: list[str] = []
    cursor = 0.0
    for index, chunk in enumerate(chunks, start=1):
        start = cursor
        end = min(duration, cursor + segment_duration)
        if index == len(chunks):
            end = max(end, duration)
        entries.append(f"{index}\n{_format_srt_time(start)} --> {_format_srt_time(end)}\n{chunk}\n")
        cursor = end

    path.write_text("\n".join(entries), encoding="utf-8")
    return path


def _nvidia_configured() -> bool:
    return bool(_nvidia_api_key())


def _nvidia_api_key() -> str | None:
    api_key = (os.getenv("NVIDIA_API_KEY") or "").strip().strip('"').strip("'")
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    return api_key or None


def _strip_markdown_fence(text: str) -> str:
    if text.startswith("```"):
        text = re.sub(r"^```(?:srt)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _extract_srt_content(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = _strip_markdown_fence(text)
    match = re.search(r"(?:^|\n)(\d+\s*\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}.*)", text, flags=re.DOTALL)
    if match:
        text = match.group(1)
    return re.sub(r"(\d{2}:\d{2}:\d{2})\.(\d{3})", r"\1,\2", text.strip())


def _normalize_text(text: str | None) -> str:
    return re.sub(r"\s+", " ", (text or "").strip())


def _chunk_text(text: str, max_chars: int = 84) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", text)
    chunks: list[str] = []
    current = ""
    for sentence in sentences:
        if not sentence:
            continue
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip()
        else:
            if current:
                chunks.append(current)
            current = sentence
    if current:
        chunks.append(current)

    if not chunks:
        return [text]

    expanded: list[str] = []
    for chunk in chunks:
        if len(chunk) <= max_chars:
            expanded.append(chunk)
            continue
        words = chunk.split()
        group_size = max(6, math.ceil(len(words) / math.ceil(len(chunk) / max_chars)))
        for index in range(0, len(words), group_size):
            expanded.append(" ".join(words[index : index + group_size]))
    return expanded


def _probe_duration(video_path: Path) -> float:
    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        return 6.0
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 6.0


def _format_srt_time(seconds: float) -> str:
    milliseconds = int(round(seconds * 1000))
    hours, remainder = divmod(milliseconds, 3_600_000)
    minutes, remainder = divmod(remainder, 60_000)
    secs, millis = divmod(remainder, 1000)
    return f"{hours:02}:{minutes:02}:{secs:02},{millis:03}"
