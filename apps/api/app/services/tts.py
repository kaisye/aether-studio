from __future__ import annotations

import asyncio
import os
import re
import requests
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

from .storage import ensure_storage
from .subtitle import subtitle_to_plain_text


VOICE_BY_LANGUAGE = {
    "en": "en-US-JennyNeural",
    "es": "es-ES-ElviraNeural",
    "fr": "fr-FR-DeniseNeural",
    "de": "de-DE-KatjaNeural",
    "vi": "vi-VN-HoaiMyNeural",
    "ja": "ja-JP-NanamiNeural",
    "ko": "ko-KR-SunHiNeural",
    "zh": "zh-CN-XiaoxiaoNeural",
}


VOICE_ALIASES = {
    "james deep": "en-US-GuyNeural",
    "sarah adams": "en-US-JennyNeural",
    "robert b.": "en-US-BrianNeural",
}


GENERIC_VOICES = {"", "studio narrator", "default", "auto"}


@dataclass(frozen=True)
class SubtitleCue:
    start: float
    end: float
    text: str


def generate_tts(text_or_subtitle: Path, voice: str, target_language: str = "EN", voice_rate: str = "+0%") -> Path:
    """Generate spoken audio from subtitle text with Microsoft Edge TTS."""
    root = ensure_storage()
    selected_voice = _resolve_voice(voice, target_language)
    selected_rate = _normalize_rate(voice_rate)

    cues = _parse_srt_cues(text_or_subtitle)
    if cues:
        return _generate_aligned_tts(cues, text_or_subtitle, selected_voice, selected_rate)

    text = subtitle_to_plain_text(text_or_subtitle)
    if not text:
        raise ValueError("No subtitle text available for TTS generation.")

    output = root / "audio" / f"{text_or_subtitle.stem}.mp3"
    try:
        asyncio.run(_save_edge_tts(text, selected_voice, output, selected_rate))
    except Exception as exc:
        if os.getenv("AETHER_ALLOW_SYNTHETIC_AUDIO") == "1":
            return _create_synthetic_audio(output)
        raise RuntimeError(f"TTS generation failed for voice '{selected_voice}' at rate '{selected_rate}': {exc}") from exc

    if output.stat().st_size == 0:
        raise RuntimeError("TTS provider returned an empty audio file.")
    return output


def _generate_aligned_tts(cues: list[SubtitleCue], subtitle_path: Path, voice: str, rate: str) -> Path:
    root = ensure_storage()
    output = root / "audio" / f"{subtitle_path.stem}.aligned.mp3"
    if os.getenv("AETHER_ALLOW_SYNTHETIC_AUDIO") == "1":
        return _create_synthetic_audio(output)

    units = _group_cues_for_tts(_normalize_overlapping_cues(cues))
    workdir = root / "audio" / f"{subtitle_path.stem}.segments"
    workdir.mkdir(parents=True, exist_ok=True)

    parts: list[Path] = []
    cursor = 0.0
    for index, cue in enumerate(units, start=1):
        gap = max(0.0, cue.start - cursor)
        if gap >= 0.05:
            silence = workdir / f"{index:04d}_gap.mp3"
            _create_silence(silence, gap)
            parts.append(silence)

        raw_segment = workdir / f"{index:04d}_voice_raw.mp3"
        fitted_segment = workdir / f"{index:04d}_voice_fit.mp3"
        try:
            _save_tts_segment(cue.text, voice, raw_segment, rate, workdir, f"{index:04d}")
        except Exception as exc:
            if os.getenv("AETHER_ALLOW_SYNTHETIC_AUDIO") == "1":
                raw_segment = _create_synthetic_audio(raw_segment)
            else:
                raise RuntimeError(f"TTS generation failed for voice '{voice}' at rate '{rate}' on subtitle cue {index}: {exc}") from exc

        cue_duration = max(0.25, cue.end - cue.start)
        segment = _fit_segment_to_duration(raw_segment, fitted_segment, cue_duration)
        parts.append(segment)

        segment_duration = min(_probe_duration(segment), cue_duration)
        trailing_silence = max(0.0, cue_duration - segment_duration)
        if trailing_silence >= 0.05:
            silence = workdir / f"{index:04d}_tail.mp3"
            _create_silence(silence, trailing_silence)
            parts.append(silence)

        cursor = max(cue.end, cue.start + cue_duration)

    _concat_audio(parts, output, workdir / "concat.txt")
    if not output.exists() or output.stat().st_size == 0:
        raise RuntimeError("TTS provider returned an empty aligned audio file.")
    return output


async def _save_edge_tts(text: str, voice: str, output: Path, rate: str) -> None:
    import edge_tts

    communicate = edge_tts.Communicate(text, voice=voice, rate=rate)
    await communicate.save(str(output))


def _save_tts_segment(text: str, voice: str, output: Path, rate: str, workdir: Path, label: str) -> Path:
    cleaned = _sanitize_tts_text(text)
    try:
        _save_tts_with_retries(cleaned, voice, output, rate)
        return output
    except Exception:
        fragments = _split_tts_text(cleaned)
        if len(fragments) <= 1:
            raise

    parts: list[Path] = []
    for index, fragment in enumerate(fragments, start=1):
        part = workdir / f"{label}_split_{index:02d}.mp3"
        _save_tts_with_retries(fragment, voice, part, rate)
        parts.append(part)
    _concat_audio(parts, output, workdir / f"{label}_split_concat.txt")
    return output


def _save_tts_with_retries(text: str, voice: str, output: Path, rate: str) -> None:
    last_error: Exception | None = None
    for attempt in range(3):
        try:
            _save_provider_tts(text, voice, output, rate)
            if output.exists() and output.stat().st_size > 0:
                return
            raise RuntimeError("No audio was received.")
        except Exception as exc:
            last_error = exc
            output.unlink(missing_ok=True)
            time.sleep(0.8 * (attempt + 1))
    raise RuntimeError(str(last_error) if last_error else "TTS provider did not return audio.")


def _save_provider_tts(text: str, voice: str, output: Path, rate: str) -> None:
    provider = _tts_provider()
    if provider == "omnivoice":
        _save_omnivoice_tts(text, voice, output)
        return
    asyncio.run(_save_edge_tts(text, voice, output, rate))


def _save_omnivoice_tts(text: str, voice: str, output: Path) -> None:
    base_url = os.getenv("OMNIVOICE_API_URL", "").strip().rstrip("/")
    if not base_url:
        raise RuntimeError("OMNIVOICE_API_URL is required when AETHER_TTS_PROVIDER=omnivoice.")

    mode = os.getenv("OMNIVOICE_MODE", "auto").strip().lower()
    if mode not in {"auto", "design", "clone"}:
        mode = "auto"

    payload: dict[str, str] = {"text": text, "mode": mode, "output_format": "wav"}
    if mode == "design":
        payload["instruct"] = os.getenv("OMNIVOICE_INSTRUCT", "").strip() or voice
    elif mode == "clone":
        ref_audio_url = os.getenv("OMNIVOICE_REF_AUDIO_URL", "").strip()
        if ref_audio_url:
            payload["ref_audio_url"] = ref_audio_url
        ref_text = os.getenv("OMNIVOICE_REF_TEXT", "").strip()
        if ref_text:
            payload["ref_text"] = ref_text

    headers = {}
    api_key = os.getenv("OMNIVOICE_API_KEY", "").strip()
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    response = requests.post(f"{base_url}/synthesize/file", json=payload, headers=headers, timeout=300)
    if response.status_code >= 400:
        raise RuntimeError(f"OmniVoice request failed: {response.text[:500]}")

    temp_wav = output.with_suffix(".omnivoice.wav")
    temp_wav.write_bytes(response.content)
    if output.suffix.lower() == ".wav":
        temp_wav.replace(output)
        return

    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(temp_wav),
        "-c:a",
        "libmp3lame",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    temp_wav.unlink(missing_ok=True)
    if result.returncode != 0 or not output.exists() or output.stat().st_size == 0:
        raise RuntimeError(f"Unable to convert OmniVoice audio: {result.stderr[-1000:]}")


def _sanitize_tts_text(text: str) -> str:
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = cleaned.replace("&", " và ")
    cleaned = re.sub(r"[`*_#\\[\\]{}|~^]", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned or " "


def _split_tts_text(text: str, max_chars: int = 90) -> list[str]:
    max_chars = _env_int(
        "AETHER_TTS_SPLIT_MAX_CHARS",
        900 if _tts_provider() == "omnivoice" else max_chars,
        minimum=60,
        maximum=3500,
    )
    sentences = re.split(r"(?<=[.!?…])\s+", text)
    fragments: list[str] = []
    current = ""
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        if len(current) + len(sentence) + 1 <= max_chars:
            current = f"{current} {sentence}".strip()
            continue
        if current:
            fragments.append(current)
        current = sentence
    if current:
        fragments.append(current)

    expanded: list[str] = []
    for fragment in fragments or [text]:
        if len(fragment) <= max_chars:
            expanded.append(fragment)
            continue
        words = fragment.split()
        chunk: list[str] = []
        for word in words:
            if len(" ".join([*chunk, word])) > max_chars and chunk:
                expanded.append(" ".join(chunk))
                chunk = [word]
            else:
                chunk.append(word)
        if chunk:
            expanded.append(" ".join(chunk))
    return expanded


def _resolve_voice(voice: str, target_language: str) -> str:
    normalized = (voice or "").strip()
    if normalized.endswith("Neural") and "-" in normalized:
        return normalized
    language_key = (target_language or "en").split("-")[0].lower()
    if normalized.lower() in GENERIC_VOICES:
        return VOICE_BY_LANGUAGE.get(language_key, VOICE_BY_LANGUAGE["en"])
    alias = VOICE_ALIASES.get(normalized.lower())
    if alias:
        return alias
    return VOICE_BY_LANGUAGE.get(language_key, VOICE_BY_LANGUAGE["en"])


def _normalize_rate(rate: str | None) -> str:
    value = (rate or "+0%").strip()
    if value == "0%":
        return "+0%"
    if value.startswith(("+", "-")) and value.endswith("%"):
        try:
            number = int(value[:-1])
        except ValueError:
            return "+0%"
        return f"{max(-50, min(50, number)):+d}%"
    return "+0%"


def _parse_srt_cues(path: Path) -> list[SubtitleCue]:
    text = path.read_text(encoding="utf-8", errors="ignore")
    blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if "-->" in block]
    cues: list[SubtitleCue] = []
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        timing_index = next((index for index, line in enumerate(lines) if "-->" in line), None)
        if timing_index is None:
            continue
        start, end = _parse_timing_line(lines[timing_index])
        cue_text = " ".join(line for line in lines[timing_index + 1 :] if line and not line.isdigit()).strip()
        if cue_text and end > start:
            cues.append(SubtitleCue(start=start, end=end, text=cue_text))
    return cues


def _normalize_overlapping_cues(cues: list[SubtitleCue]) -> list[SubtitleCue]:
    ordered = sorted(cues, key=lambda cue: (cue.start, cue.end))
    normalized: list[SubtitleCue] = []
    for index, cue in enumerate(ordered):
        end = cue.end
        if index + 1 < len(ordered):
            next_start = ordered[index + 1].start
            if cue.start < next_start < cue.end:
                end = next_start
        if end <= cue.start:
            end = cue.start + 0.25
        normalized.append(SubtitleCue(start=cue.start, end=end, text=cue.text))
    return normalized


def _group_cues_for_tts(cues: list[SubtitleCue]) -> list[SubtitleCue]:
    if not cues:
        return []

    provider = _tts_provider()
    max_gap = _env_float("AETHER_TTS_GROUP_MAX_GAP", 2.5 if provider == "omnivoice" else 0.9, minimum=0.0, maximum=10.0)
    max_duration = _env_float("AETHER_TTS_GROUP_MAX_DURATION", 35.0 if provider == "omnivoice" else 11.0, minimum=1.0, maximum=120.0)
    max_chars = _env_int("AETHER_TTS_GROUP_MAX_CHARS", 900 if provider == "omnivoice" else 240, minimum=80, maximum=3500)

    groups: list[SubtitleCue] = []
    start = cues[0].start
    end = cues[0].end
    texts = [_clean_cue_text(cues[0].text)]

    for cue in cues[1:]:
        text = _clean_cue_text(cue.text)
        gap = cue.start - end
        projected_duration = cue.end - start
        projected_chars = len(" ".join([*texts, text]))
        should_merge = gap <= max_gap and projected_duration <= max_duration and projected_chars <= max_chars

        if should_merge:
            end = max(end, cue.end)
            texts.append(text)
            continue

        groups.append(SubtitleCue(start=start, end=end, text=_dedupe_joined_text(texts)))
        start = cue.start
        end = cue.end
        texts = [text]

    groups.append(SubtitleCue(start=start, end=end, text=_dedupe_joined_text(texts)))
    return [group for group in groups if group.text]


def _tts_provider() -> str:
    return os.getenv("AETHER_TTS_PROVIDER", "edge").strip().lower()


def _env_int(name: str, default: int, minimum: int, maximum: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def _env_float(name: str, default: float, minimum: float, maximum: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        value = default
    return max(minimum, min(maximum, value))


def _clean_cue_text(text: str) -> str:
    return re.sub(r"\s+", " ", text.replace(">>", "")).strip()


def _dedupe_joined_text(parts: list[str]) -> str:
    result: list[str] = []
    for part in parts:
        if not part:
            continue
        if result and (part == result[-1] or part in result[-1]):
            continue
        result.append(part)
    return " ".join(result)


def _parse_timing_line(line: str) -> tuple[float, float]:
    start_text, end_text = line.split("-->", 1)
    end_text = end_text.split()[0]
    return _srt_time_to_seconds(start_text.strip()), _srt_time_to_seconds(end_text.strip())


def _srt_time_to_seconds(value: str) -> float:
    match = re.match(r"(?P<h>\d{2}):(?P<m>\d{2}):(?P<s>\d{2})[,.](?P<ms>\d{3})", value)
    if not match:
        return 0.0
    return (
        int(match.group("h")) * 3600
        + int(match.group("m")) * 60
        + int(match.group("s"))
        + int(match.group("ms")) / 1000
    )


def _fit_segment_to_duration(source: Path, destination: Path, max_duration: float) -> Path:
    duration = _probe_duration(source)
    if duration <= 0:
        return source
    if duration <= max_duration:
        return source

    tempo = min(4.0, duration / max_duration)
    command = [
        "ffmpeg",
        "-y",
        "-i",
        str(source),
        "-filter:a",
        _atempo_filter(tempo),
        "-c:a",
        "libmp3lame",
        str(destination),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=120)
    if result.returncode != 0 or not destination.exists() or destination.stat().st_size == 0:
        raise RuntimeError(f"Unable to fit TTS segment to subtitle timing: {result.stderr[-1000:]}")
    return destination


def _atempo_filter(tempo: float) -> str:
    factors: list[float] = []
    remaining = max(0.5, tempo)
    while remaining > 2.0:
        factors.append(2.0)
        remaining /= 2.0
    factors.append(remaining)
    return ",".join(f"atempo={factor:.4f}" for factor in factors)


def _create_silence(output: Path, duration: float) -> Path:
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "anullsrc=r=24000:cl=mono",
        "-t",
        f"{duration:.3f}",
        "-c:a",
        "libmp3lame",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode != 0 or not output.exists() or output.stat().st_size == 0:
        raise RuntimeError(f"Unable to create silence for TTS alignment: {result.stderr[-1000:]}")
    return output


def _concat_audio(parts: list[Path], output: Path, list_file: Path) -> None:
    if not parts:
        raise RuntimeError("No audio segments were generated for TTS alignment.")
    list_file.write_text("".join(f"file '{part.resolve().as_posix()}'\n" for part in parts), encoding="utf-8")
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c:a",
        "libmp3lame",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        raise RuntimeError(f"Unable to concatenate aligned TTS audio: {result.stderr[-1000:]}")


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
        return 0.0
    try:
        return float(result.stdout.strip())
    except ValueError:
        return 0.0


def _create_synthetic_audio(output: Path) -> Path:
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "lavfi",
        "-i",
        "sine=frequency=440:duration=6",
        "-c:a",
        "libmp3lame",
        str(output),
    ]
    result = subprocess.run(command, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise RuntimeError(f"Unable to create fallback audio: {result.stderr[-1000:]}")
    return output
