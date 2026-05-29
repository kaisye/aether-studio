# Aether Studio

MVP full-stack implementation for the Aether Studio Content Queue and Project Workspace.

<img width="2555" height="1297" alt="image" src="https://github.com/user-attachments/assets/837bfc01-a7b9-4c58-97f1-1a1eb22e5a00" />

## Apps

- `apps/web`: Next.js, TypeScript, Tailwind, TanStack Table.
- `apps/api`: FastAPI, SQLAlchemy, SQLite dev fallback.

## Local Development

Install frontend dependencies:

```powershell
npm install
```

Install backend dependencies:

```powershell
pip install -r apps/api/requirements.txt
```

Install FFmpeg and make sure `ffmpeg` and `ffprobe` are available on PATH. The media pipeline uses:

- `yt-dlp` to download source videos into `storage/raw-videos/`
- embedded subtitles extracted from the source video, or NVIDIA Integrate generated subtitles from a brief in `storage/subtitles/`
- `edge-tts` to generate narration audio from the subtitle text in `storage/audio/`
- FFmpeg to render final MP4 files in `storage/rendered-outputs/`

Run the API:

```powershell
npm run dev:api
```

Run the web app:

```powershell
npm run dev:web
```

Open `http://localhost:3000/queue`.

## Working Media Flow

For the current production MVP, every runnable row needs:

- `Video URL`: an HTTP(S) video URL supported by `yt-dlp`, a direct media URL, or an existing local file path.
- `Content / Caption`: a brief used only when the source video has no embedded subtitles and NVIDIA LLM subtitle generation is configured.
- `Target Language` and `Voice`: Edge TTS voice selection. You can use voices such as `vi-VN-HoaiMyNeural` or `en-US-JennyNeural`.

When you click Run, the job moves through download, subtitle extraction or LLM subtitle generation, voice generation from the subtitle file, rendering, then exposes an output URL from `/storage/rendered-outputs/...mp4`.

## Environment

Copy `.env.example` into local environment files as needed. Defaults are set for local development:

- API: `http://127.0.0.1:8000`
- Web: `http://localhost:3000`
- Database: SQLite file `aether_studio.db`
