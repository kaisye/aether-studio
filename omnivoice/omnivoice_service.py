from __future__ import annotations

import argparse
import asyncio
import base64
import logging
import os
import re
import subprocess
import threading
import time
import tempfile
import uuid
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal

import requests
import soundfile as sf
import torch
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field


MODEL_ID = os.getenv("OMNIVOICE_MODEL_ID", "k2-fsa/OmniVoice")
DEVICE_MAP = os.getenv("OMNIVOICE_DEVICE_MAP", "cuda:0" if torch.cuda.is_available() else "cpu")
OUTPUT_DIR = Path(os.getenv("OMNIVOICE_OUTPUT_DIR", "/content/omnivoice_outputs")).resolve()
API_KEY = os.getenv("OMNIVOICE_API_KEY", "").strip()
SAMPLE_RATE = 24000
DEFAULT_HOST = os.getenv("OMNIVOICE_HOST", "0.0.0.0")
DEFAULT_PORT = int(os.getenv("OMNIVOICE_PORT", "8008"))


logging.basicConfig(level=os.getenv("OMNIVOICE_LOG_LEVEL", "INFO"))
logger = logging.getLogger("omnivoice-service")
try:
    SERVICE_DIR = Path(__file__).resolve().parent
except NameError:
    SERVICE_DIR = Path.cwd()
DEFAULT_REF_AUDIO_PATH = Path(os.getenv("OMNIVOICE_DEFAULT_REF_AUDIO_PATH", str(SERVICE_DIR / "Voice_Ref.WAV"))).expanduser()
DEFAULT_REF_TEXT_PATH = Path(os.getenv("OMNIVOICE_DEFAULT_REF_TEXT_PATH", str(SERVICE_DIR / "voice_scripts.txt"))).expanduser()
DEFAULT_INSTRUCTION_PATH = Path(os.getenv("OMNIVOICE_DEFAULT_INSTRUCTION_PATH", str(SERVICE_DIR / "Instruction.txt"))).expanduser()


class SynthesizeRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    mode: Literal["auto", "design", "clone"] = "auto"
    instruct: str | None = Field(default=None, max_length=500)
    ref_text: str | None = Field(default=None, max_length=1000)
    ref_audio_url: str | None = None
    ref_audio_base64: str | None = None
    output_format: Literal["wav"] = "wav"


class SynthesizeResponse(BaseModel):
    audio_url: str
    filename: str
    sample_rate: int = SAMPLE_RATE
    duration_seconds: float
    provider: str = "omnivoice"


_model = None
_model_error: str | None = None
_model_loading = False
_model_lock = threading.Lock()


def load_model() -> None:
    global _model, _model_error, _model_loading
    with _model_lock:
        if _model is not None or _model_loading:
            return
        _model_loading = True
        _model_error = None

    try:
        from omnivoice import OmniVoice

        dtype = torch.float16 if DEVICE_MAP.startswith("cuda") else torch.float32
        load_asr = os.getenv("OMNIVOICE_LOAD_ASR", "0") == "1"
        logger.info("Loading OmniVoice model %s on %s with dtype=%s load_asr=%s", MODEL_ID, DEVICE_MAP, dtype, load_asr)
        model = OmniVoice.from_pretrained(
            MODEL_ID,
            device_map=DEVICE_MAP,
            dtype=dtype,
            load_asr=load_asr,
        )
        with _model_lock:
            _model = model
        logger.info("OmniVoice model loaded.")
    except Exception as exc:
        with _model_lock:
            _model_error = str(exc)
        logger.exception("Failed to load OmniVoice model.")
        raise
    finally:
        with _model_lock:
            _model_loading = False


def start_model_loading() -> threading.Thread:
    thread = threading.Thread(target=load_model, daemon=True, name="omnivoice-model-loader")
    thread.start()
    return thread


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if os.getenv("OMNIVOICE_LOAD_ON_STARTUP", "1") == "1":
        start_model_loading()
    yield


app = FastAPI(title="OmniVoice TTS Service", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/audio", StaticFiles(directory=str(OUTPUT_DIR)), name="audio")


@app.get("/")
def root() -> dict[str, str]:
    return {
        "service": "OmniVoice TTS Service",
        "health": "/health",
        "docs": "/docs",
        "synthesize": "/synthesize",
        "synthesize_file": "/synthesize/file",
    }


@app.get("/health")
def health() -> dict[str, str | bool | None]:
    if _model_error:
        status = "error"
    elif _model is not None:
        status = "ready"
    elif _model_loading:
        status = "loading"
    else:
        status = "not_loaded"
    return {
        "status": status,
        "model_loaded": _model is not None,
        "model_loading": _model_loading,
        "model_error": _model_error,
        "model": MODEL_ID,
        "device": DEVICE_MAP,
    }


@app.get("/ready")
def ready() -> dict[str, str | bool]:
    if _model_error:
        raise HTTPException(status_code=503, detail=f"OmniVoice model failed to load: {_model_error}")
    if _model is None:
        raise HTTPException(status_code=503, detail="OmniVoice model is still loading.")
    return {"status": "ready", "model_loaded": True}


@app.post("/synthesize", response_model=SynthesizeResponse)
def synthesize(payload: SynthesizeRequest, request: Request, authorization: str | None = Header(default=None)) -> SynthesizeResponse:
    _verify_api_key(authorization)
    output_path, duration = _synthesize_to_path(payload)
    filename = output_path.name
    return SynthesizeResponse(
        audio_url=str(request.base_url).rstrip("/") + f"/audio/{filename}",
        filename=filename,
        duration_seconds=duration,
    )


@app.post("/synthesize/file")
def synthesize_file(payload: SynthesizeRequest, authorization: str | None = Header(default=None)) -> FileResponse:
    """Convenience endpoint for clients that prefer a direct WAV response."""
    _verify_api_key(authorization)
    output_path, _duration = _synthesize_to_path(payload)
    return FileResponse(output_path, media_type="audio/wav", filename=output_path.name)


def _synthesize_to_path(payload: SynthesizeRequest) -> tuple[Path, float]:
    if _model_error:
        raise HTTPException(status_code=503, detail=f"OmniVoice model failed to load: {_model_error}")
    if _model is None:
        raise HTTPException(status_code=503, detail="OmniVoice model is not loaded yet.")

    ref_audio_path: Path | None = None
    should_cleanup_ref_audio = False
    try:
        ref_audio_path, should_cleanup_ref_audio = _prepare_reference_audio(payload)
        generate_kwargs: dict[str, str] = {"text": payload.text}
        if payload.mode == "design":
            instruction = payload.instruct or _read_optional_text(DEFAULT_INSTRUCTION_PATH)
            if not instruction:
                raise HTTPException(status_code=400, detail="instruct is required when mode='design'.")
            generate_kwargs["instruct"] = instruction
        elif payload.mode == "clone":
            if not ref_audio_path:
                raise HTTPException(status_code=400, detail="ref_audio_url or ref_audio_base64 is required when mode='clone'.")
            generate_kwargs["ref_audio"] = str(ref_audio_path)
            ref_text = payload.ref_text or _read_optional_text(DEFAULT_REF_TEXT_PATH)
            if ref_text:
                generate_kwargs["ref_text"] = ref_text

        audio = _model.generate(**generate_kwargs)
        samples = audio[0]
        filename = f"{uuid.uuid4()}.wav"
        output_path = OUTPUT_DIR / filename
        sf.write(output_path, samples, SAMPLE_RATE)

        duration = len(samples) / SAMPLE_RATE
        return output_path, duration
    finally:
        if ref_audio_path and should_cleanup_ref_audio and ref_audio_path.exists():
            ref_audio_path.unlink(missing_ok=True)


def _verify_api_key(authorization: str | None) -> None:
    if not API_KEY:
        return
    expected = f"Bearer {API_KEY}"
    if authorization != expected:
        raise HTTPException(status_code=401, detail="Invalid OmniVoice API key.")


def _prepare_reference_audio(payload: SynthesizeRequest) -> tuple[Path | None, bool]:
    if payload.ref_audio_base64:
        suffix = ".wav"
        if "," in payload.ref_audio_base64:
            header, data = payload.ref_audio_base64.split(",", 1)
            if "mpeg" in header or "mp3" in header:
                suffix = ".mp3"
            elif "flac" in header:
                suffix = ".flac"
        else:
            data = payload.ref_audio_base64
        path = Path(tempfile.gettempdir()) / f"omnivoice_ref_{uuid.uuid4()}{suffix}"
        path.write_bytes(base64.b64decode(data))
        return path, True

    if payload.ref_audio_url:
        suffix = Path(payload.ref_audio_url.split("?")[0]).suffix or ".wav"
        path = Path(tempfile.gettempdir()) / f"omnivoice_ref_{uuid.uuid4()}{suffix}"
        with requests.get(payload.ref_audio_url, stream=True, timeout=60) as response:
            response.raise_for_status()
            with path.open("wb") as file:
                for chunk in response.iter_content(chunk_size=1024 * 512):
                    if chunk:
                        file.write(chunk)
        return path, True

    if DEFAULT_REF_AUDIO_PATH.exists():
        return DEFAULT_REF_AUDIO_PATH.resolve(), False

    return None, False


def _read_optional_text(path: Path) -> str | None:
    if not path.exists():
        return None
    text = path.read_text(encoding="utf-8", errors="ignore").strip()
    return text or None


def start_service(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT, share: bool = False) -> threading.Thread | None:
    import uvicorn

    if os.getenv("OMNIVOICE_LOAD_ON_STARTUP", "1") == "1":
        start_model_loading()

    if share:
        public_url = _start_public_tunnel(port)
        if public_url:
            print(f"Public OmniVoice URL: {public_url}")
            print(f"Set Aether .env: OMNIVOICE_API_URL={public_url}")
        else:
            print("No public tunnel was started. The service is still available inside Colab at 127.0.0.1.")

    print(f"Starting OmniVoice service on http://{host}:{port}")
    print(f"Inside Colab, test: http://127.0.0.1:{port}/health")

    try:
        asyncio.get_running_loop()
    except RuntimeError:
        uvicorn.run(app, host=host, port=port, log_level="info")
        return None

    thread = threading.Thread(
        target=lambda: uvicorn.run(app, host=host, port=port, log_level="info"),
        daemon=False,
        name="omnivoice-uvicorn",
    )
    thread.start()
    time.sleep(2)
    print(f"OmniVoice service thread started. Local runtime URL: http://127.0.0.1:{port}")
    print("If this is Colab, open the ngrok/cloudflared public URL from your laptop.")
    return thread


def _start_public_tunnel(port: int) -> str | None:
    provider = os.getenv("OMNIVOICE_SHARE_PROVIDER", "auto").strip().lower()
    if provider in {"auto", "ngrok"}:
        public_url = _start_ngrok(port)
        if public_url or provider == "ngrok":
            return public_url
    if provider in {"auto", "cloudflare", "cloudflared"}:
        return _start_cloudflared(port)
    return None


def _start_ngrok(port: int) -> str | None:
    try:
        from pyngrok import ngrok
    except Exception as exc:
        print(f"pyngrok is not installed or failed to import: {exc}")
        print("Install it with: pip install pyngrok")
        return None

    auth_token = os.getenv("NGROK_AUTHTOKEN", "").strip()
    if auth_token:
        ngrok.set_auth_token(auth_token)

    try:
        tunnel = ngrok.connect(port, "http")
        return str(tunnel.public_url)
    except Exception as exc:
        print(f"ngrok failed: {exc}")
        print("Tip: set NGROK_AUTHTOKEN, or use Cloudflare Tunnel fallback.")
        return None


def _start_cloudflared(port: int) -> str | None:
    binary = _ensure_cloudflared()
    if not binary:
        return None

    command = [str(binary), "tunnel", "--url", f"http://127.0.0.1:{port}"]
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    deadline = time.time() + 45
    while time.time() < deadline:
        line = process.stdout.readline() if process.stdout else ""
        if not line:
            time.sleep(0.2)
            continue
        print(line.rstrip())
        match = re.search(r"https://[a-zA-Z0-9.-]+\.trycloudflare\.com", line)
        if match:
            return match.group(0)

    print("cloudflared started, but no public URL was detected yet.")
    print("Look for a https://*.trycloudflare.com URL in the Colab output.")
    return None


def _ensure_cloudflared() -> Path | None:
    configured = os.getenv("CLOUDFLARED_BIN", "").strip()
    candidates = [Path(configured)] if configured else []
    candidates.extend([Path("cloudflared"), Path("/content/cloudflared"), Path("./cloudflared")])
    for candidate in candidates:
        if candidate and candidate.exists():
            return candidate.resolve()

    destination = Path("/content/cloudflared")
    url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    try:
        print("Downloading cloudflared tunnel binary...")
        response = requests.get(url, timeout=120)
        response.raise_for_status()
        destination.write_bytes(response.content)
        destination.chmod(0o755)
        return destination
    except Exception as exc:
        print(f"Unable to install cloudflared automatically: {exc}")
        print("Manual Colab fallback:")
        print("!wget -q -O /content/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64")
        print("!chmod +x /content/cloudflared")
        print("!/content/cloudflared tunnel --url http://127.0.0.1:8008")
        return None



if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run the OmniVoice FastAPI service.")
    parser.add_argument("--host", default=DEFAULT_HOST)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--share", action="store_true", default=os.getenv("OMNIVOICE_SHARE", "0") == "1")
    args, _unknown_args = parser.parse_known_args()

    start_service(host=args.host, port=args.port, share=args.share)
