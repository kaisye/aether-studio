# Aether Studio

Aether Studio is a full-stack MVP for an AI media processing SaaS. It lets a creator or media team add source videos into a spreadsheet-like queue, run a deterministic localization pipeline, review the rendered result, and download the final localized video.

The current system focuses on real working media flow:

```text
Video URL
-> Download video
-> Extract subtitles or generate subtitles
-> Translate subtitles
-> Generate voice audio
-> Align audio to subtitle timeline
-> Render final video
-> Review output
```

It is intentionally not a workflow editor and does not expose internal tools such as workers, FFmpeg, LLM calls, or TTS providers in the product UI.

## Repository Structure

```text
apps/
  api/                  FastAPI backend, database models, media pipeline
  web/                  Next.js frontend
omnivoice/              Remote OmniVoice TTS service and Colab notebook
storage/                Local generated media artifacts, ignored by git
start-aether.bat        One-click Windows launcher for local dev
.env.example            Safe example environment file
```

Important generated folders are intentionally ignored:

```text
storage/
aether_studio.db
.env
omnivoice/*.WAV
omnivoice/*.wav
omnivoice/*.mp3
omnivoice/*.flac
```

Do not commit secrets, database files, rendered videos, downloaded videos, or personal voice reference audio.

## Apps

### Web

Path:

```text
apps/web
```

Stack:

- Next.js
- TypeScript
- Tailwind CSS
- TanStack Table
- lucide-react

Main routes:

```text
/queue                 Content Queue
/projects              Project gallery and list view
/workspace/[videoId]   Production workspace
/studio/[videoId]      Video review view
/voices                Voice settings/library UI
/settings              Settings UI
```

### API

Path:

```text
apps/api
```

Stack:

- FastAPI
- SQLAlchemy
- SQLite for local dev
- PostgreSQL-ready model structure
- yt-dlp
- FFmpeg / ffprobe
- NVIDIA Integrate for subtitle or translation generation
- Edge TTS or OmniVoice for voice generation

Main job APIs:

```text
POST   /jobs
GET    /jobs
GET    /jobs/{id}
PATCH  /jobs/{id}
POST   /jobs/{id}/run
POST   /jobs/{id}/retry
DELETE /jobs/{id}
GET    /jobs/{id}/logs
GET    /jobs/{id}/output
GET    /jobs/{id}/review
POST   /jobs/{id}/review/approve
POST   /jobs/{id}/review/regenerate
```

Legacy/prototype APIs for the older video table still exist under:

```text
/api/videos
/api/jobs
```

## Requirements

Install these on the local machine:

- Python 3.11+
- Node.js 20+
- npm
- FFmpeg with `ffmpeg` and `ffprobe` available on PATH
- Git

Recommended Windows checks:

```powershell
python --version
node --version
npm --version
ffmpeg -version
ffprobe -version
```

## First-Time Setup

Install frontend dependencies:

```powershell
npm install
```

Install backend dependencies:

```powershell
pip install -r apps/api/requirements.txt
```

Create local environment file:

```powershell
copy .env.example .env
```

Edit `.env` for your machine. A typical local config:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
DATABASE_URL=sqlite:///./aether_studio.db
WEB_ORIGIN=http://localhost:3000

NVIDIA_API_KEY=
NVIDIA_MODEL=qwen/qwen3.5-397b-a17b

AETHER_TRANSLATION_MAX_BLOCKS=20
AETHER_TRANSLATION_BATCH_SIZE=30

AETHER_TTS_PROVIDER=edge
```

Use port `8001` for the API if port `8000` is occupied by another local process.

## Running Locally

Option 1: one-click Windows launcher:

```powershell
.\start-aether.bat
```

Option 2: run services manually.

API:

```powershell
npm run dev:api
```

Web:

```powershell
npm run dev:web
```

Open:

```text
http://localhost:3000/queue
```

Health check:

```text
http://127.0.0.1:8001/health
```

## Content Queue Workflow

Open:

```text
http://localhost:3000/queue
```

A queue row contains:

- Video URL
- Caption/content brief
- Source language
- Target language
- Voice
- Voice speed
- Platform
- Publish date/time
- Status
- Progress
- Output URL
- Error log

Basic flow:

1. Add or paste a YouTube/video URL.
2. Set source language and target language.
3. Choose voice.
4. Click Run.
5. Watch status move through the pipeline.
6. Open the project/workspace or video review.
7. Download or inspect final output.

Current job statuses:

```text
draft
queued
downloading
transcribing
translating
tts_generating
rendering
ready
failed
```

## Media Storage

Local artifacts are written under:

```text
storage/
  raw-videos/
  subtitles/
  audio/
  rendered-outputs/
  thumbnails/
  logs/
```

Examples:

```text
storage/raw-videos/{job_id}.mp4
storage/subtitles/{job_id}.en.vi.sidecar.srt
storage/subtitles/{job_id}.en.vi.sidecar.render.srt
storage/audio/{job_id}.aligned.mp3
storage/rendered-outputs/{job_id}.mp4
storage/logs/{job_id}.log
```

The API serves these files through:

```text
http://127.0.0.1:8001/storage/...
```

## Subtitle and Translation

The pipeline first tries to use subtitles from the source video. For YouTube, this usually means sidecar captions via `yt-dlp`.

If no subtitles exist, the backend can use NVIDIA Integrate to generate subtitles from the caption/content brief.

Configure:

```env
NVIDIA_API_KEY=your_key
NVIDIA_MODEL=qwen/qwen3.5-397b-a17b
```

For cheap testing, limit how many subtitle blocks are translated/rendered:

```env
AETHER_TRANSLATION_MAX_BLOCKS=20
AETHER_TRANSLATION_BATCH_SIZE=30
```

For full output, leave the block limit empty:

```env
AETHER_TRANSLATION_MAX_BLOCKS=
```

## TTS Providers

### Edge TTS

Default local fallback:

```env
AETHER_TTS_PROVIDER=edge
```

Useful for fast local smoke tests. It does not require a GPU, but voice quality and long-form stability are limited.

### OmniVoice

OmniVoice is run as a separate FastAPI service, usually on Colab or another GPU machine.

Local Aether `.env`:

```env
AETHER_TTS_PROVIDER=omnivoice
OMNIVOICE_API_URL=https://xxxxx.trycloudflare.com
OMNIVOICE_API_KEY=
OMNIVOICE_MODE=clone
```

When `OMNIVOICE_MODE=clone`, Aether sends only the text by default. The remote OmniVoice service can use its local default files:

```text
Voice_Ref.WAV
voice_scripts.txt
Instruction.txt
```

This avoids sending reference audio on every request.

## OmniVoice Colab

Notebook:

```text
omnivoice/Aether_OmniVoice_Service_Colab.ipynb
```

Service file:

```text
omnivoice/omnivoice_service.py
```

Colab flow:

1. Open the notebook in Colab with GPU enabled.
2. Clone or pull this repo.
3. Install `omnivoice/requirements.txt`.
4. Upload `Voice_Ref.WAV` if the notebook asks for it.
5. Start the service.
6. Wait for `/health` to report model loaded.
7. Test `/synthesize/file`.
8. Start Cloudflare Tunnel.
9. Copy the `https://*.trycloudflare.com` URL into local `.env`.

Manual Colab commands:

```python
%cd /content
!git clone https://github.com/kaisye/aether-studio.git
%cd /content/aether-studio/omnivoice
!pip install -r requirements.txt
!python omnivoice_service.py --share
```

If ngrok requires an account, use Cloudflare Tunnel:

```python
import os
os.environ["OMNIVOICE_SHARE_PROVIDER"] = "cloudflared"
!python omnivoice_service.py --share
```

Health:

```python
import requests
requests.get("http://127.0.0.1:8008/health", timeout=30).json()
```

Public test:

```python
import requests

public_url = "https://xxxxx.trycloudflare.com"
res = requests.post(
    public_url + "/synthesize/file",
    json={"text": "Xin chao, day la audio test.", "mode": "clone"},
    timeout=300,
)
open("/content/test.wav", "wb").write(res.content)
```

## TTS Chunking

For voice quality, the backend groups subtitle cues before sending text to TTS.

Default Edge TTS grouping is conservative:

```text
max chars:    240
max duration: 11 seconds
max gap:      0.9 seconds
```

Default OmniVoice grouping is larger:

```text
max chars:    900
max duration: 35 seconds
max gap:      2.5 seconds
```

Override in `.env`:

```env
AETHER_TTS_GROUP_MAX_CHARS=1200
AETHER_TTS_GROUP_MAX_DURATION=45
AETHER_TTS_GROUP_MAX_GAP=3
AETHER_TTS_SPLIT_MAX_CHARS=1200
```

Bigger chunks usually sound smoother, but can reduce tight subtitle/audio timing. For a first reliable OmniVoice setting, use:

```env
AETHER_TTS_GROUP_MAX_CHARS=900
AETHER_TTS_GROUP_MAX_DURATION=35
AETHER_TTS_GROUP_MAX_GAP=2.5
```

Restart the backend after changing these values.

## Video Review

After a job is ready:

```text
/studio/{job_id}
```

The review page shows:

- Source video
- Localized video
- Subtitle rows
- QA checklist
- Approve/regenerate actions
- Processing logs

The output video URL is also available from:

```text
GET /jobs/{job_id}/output
```

## Tests

Run backend tests:

```powershell
npm run test:api
```

Build frontend:

```powershell
npm run build:web
```

Expected current baseline:

```text
7 backend tests passing
Next.js production build passing
```

## Troubleshooting

### Frontend is not open

Check:

```text
http://localhost:3000/queue
```

Run:

```powershell
npm run dev:web
```

### API is not open

Check:

```text
http://127.0.0.1:8001/health
```

Run:

```powershell
npm run dev:api
```

### Wrong API port

Make sure `.env` and frontend point to the same API:

```env
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8001
```

### YouTube download creates invalid MP4

Update `yt-dlp`:

```powershell
pip install -U yt-dlp
```

Verify FFmpeg:

```powershell
ffprobe storage/raw-videos/{job_id}.mp4
```

### OmniVoice tunnel fails with ngrok

Ngrok often requires a verified account and authtoken. Use Cloudflare Tunnel instead:

```python
import os
os.environ["OMNIVOICE_SHARE_PROVIDER"] = "cloudflared"
!python omnivoice_service.py --share
```

### OmniVoice `/health` is not reachable from Windows

Inside Colab:

```text
http://127.0.0.1:8008/health
```

From your Windows machine, use the Cloudflare public URL:

```text
https://xxxxx.trycloudflare.com/health
```

`127.0.0.1` on Windows is your Windows machine, not Colab.

### OmniVoice is loading slowly

`Loading weights` means model weights are being loaded into GPU VRAM. This can take time on Colab. Wait until:

```json
{"model_loaded": true}
```

### Job failed after changing `.env`

Restart backend. Environment variables are read by the backend process at startup.

## Production Notes

This is still an MVP. For production hardening, add:

- Real auth and tenants
- PostgreSQL migrations with Alembic
- A real queue such as Celery/RQ/Arq
- Job cancellation tokens
- Durable object storage such as S3/R2/MinIO
- Structured logs and observability
- Rate limits for public OmniVoice service
- Proper secret management
- Signed URLs for media outputs

## GitHub

Repository:

```text
https://github.com/kaisye/aether-studio.git
```

Before pushing, check:

```powershell
git status --short
```

Never commit:

```text
.env
storage/
aether_studio.db
omnivoice/Voice_Ref.WAV
```
