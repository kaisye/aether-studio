from __future__ import annotations

from pathlib import Path


STORAGE_ROOT = Path(__file__).resolve().parents[4] / "storage"


def ensure_storage() -> Path:
    for name in ("raw-videos", "subtitles", "audio", "rendered-outputs", "logs"):
        (STORAGE_ROOT / name).mkdir(parents=True, exist_ok=True)
    return STORAGE_ROOT

