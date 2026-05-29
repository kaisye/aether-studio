from __future__ import annotations

import os
import re
from pathlib import Path

import httpx

from .storage import ensure_storage


def translate_subtitle(subtitle_path: Path, target_language: str, source_language: str | None = None) -> Path:
    """Return the localized subtitle file used for rendering and TTS.

    TODO: Replace the NVIDIA chat-completion adapter with the final translation
    provider boundary once provider selection and glossary controls are added.
    """
    root = ensure_storage()
    destination = root / "subtitles" / f"{subtitle_path.stem}.render.srt"
    source_text = subtitle_path.read_text(encoding="utf-8", errors="ignore")

    if _same_language(source_language, target_language):
        destination.write_text(source_text, encoding="utf-8")
        return destination

    if os.getenv("AETHER_ALLOW_LOCAL_SUBTITLE_GENERATION") == "1":
        destination.write_text(source_text, encoding="utf-8")
        return destination

    translated = _translate_srt_with_nvidia(source_text, source_language or "auto", target_language)
    destination.write_text(translated, encoding="utf-8")
    return destination


def translation_limit_label() -> str | None:
    max_blocks = _optional_positive_int("AETHER_TRANSLATION_MAX_BLOCKS")
    if not max_blocks:
        return None
    return f"Translation test mode is enabled: first {max_blocks} subtitle blocks only."


def _translate_srt_with_nvidia(srt_text: str, source_language: str, target_language: str) -> str:
    blocks = _split_srt_blocks(srt_text)
    if not blocks:
        raise RuntimeError("Subtitle file does not contain translatable SRT blocks.")

    max_blocks = _optional_positive_int("AETHER_TRANSLATION_MAX_BLOCKS")
    if max_blocks:
        blocks = blocks[:max_blocks]

    translated_batches: list[str] = []
    batch_size = _optional_positive_int("AETHER_TRANSLATION_BATCH_SIZE") or 20
    for batch in _batch_blocks(blocks, size=batch_size):
        translated_batches.append(_translate_srt_batch("\n\n".join(batch), source_language, target_language))
    return "\n\n".join(translated_batches).strip() + "\n"


def _translate_srt_batch(srt_text: str, source_language: str, target_language: str) -> str:
    api_key = _nvidia_api_key()
    if not api_key:
        raise RuntimeError("NVIDIA_API_KEY is required to translate subtitles.")

    model = os.getenv("NVIDIA_MODEL", "qwen/qwen3.5-397b-a17b")
    prompt = (
        "Translate this SRT subtitle file for video dubbing.\n"
        f"Source language: {source_language}\n"
        f"Target language: {target_language}\n"
        "Rules:\n"
        "- Return only valid SRT, no markdown.\n"
        "- Preserve every subtitle index and timestamp exactly.\n"
        "- Translate only spoken text.\n"
        "- Keep lines concise and natural for text-to-speech.\n\n"
        f"SRT:\n{srt_text}"
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
                {"role": "system", "content": "You are a professional subtitle localization engine."},
                {"role": "user", "content": prompt},
            ],
            "max_tokens": 16384,
            "temperature": 0.2,
            "top_p": 0.95,
            "top_k": 20,
            "presence_penalty": 0,
            "repetition_penalty": 1,
            "stream": False,
            "chat_template_kwargs": {"enable_thinking": False},
        },
        timeout=180,
    )
    response.raise_for_status()
    content = response.json()["choices"][0]["message"]["content"]
    translated = _extract_srt_content(content)
    if "-->" not in translated:
        raise RuntimeError("Translation provider did not return valid SRT timing markers.")
    return translated


def _split_srt_blocks(srt_text: str) -> list[str]:
    return [block.strip() for block in re.split(r"\n\s*\n", srt_text.strip()) if "-->" in block]


def _batch_blocks(blocks: list[str], size: int) -> list[list[str]]:
    return [blocks[index : index + size] for index in range(0, len(blocks), size)]


def _same_language(source_language: str | None, target_language: str | None) -> bool:
    source = _language_key(source_language)
    target = _language_key(target_language)
    return bool(source and target and source == target)


def _language_key(language: str | None) -> str:
    return (language or "").strip().lower().split("-")[0]


def _extract_srt_content(text: str) -> str:
    text = re.sub(r"<think>.*?</think>", "", text, flags=re.DOTALL | re.IGNORECASE)
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:srt)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    match = re.search(r"(?:^|\n)(\d+\s*\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}.*)", text, flags=re.DOTALL)
    if match:
        text = match.group(1)
    return re.sub(r"(\d{2}:\d{2}:\d{2})\.(\d{3})", r"\1,\2", text.strip())


def _nvidia_api_key() -> str | None:
    api_key = (os.getenv("NVIDIA_API_KEY") or "").strip().strip('"').strip("'")
    if api_key.lower().startswith("bearer "):
        api_key = api_key[7:].strip()
    return api_key or None


def _optional_positive_int(name: str) -> int | None:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return None
    try:
        value = int(raw)
    except ValueError:
        raise RuntimeError(f"{name} must be a positive integer.")
    if value <= 0:
        raise RuntimeError(f"{name} must be a positive integer.")
    return value
