# OmniVoice Service

This folder turns `My_OmniVoice.ipynb` into a small HTTP service that can run on a GPU machine or Colab.

## Run on Colab

```python
!git clone https://github.com/kaisye/aether-studio.git
%cd /content/aether-studio/omnivoice
!pip install -r requirements.txt
```

Optional API key:

```python
import os
os.environ["OMNIVOICE_API_KEY"] = "change-me"
```

Start the service and expose port `8008` with ngrok in one command:

```python
!python omnivoice_service.py --share
```

If ngrok requires an account/authtoken, the service falls back to Cloudflare Tunnel and prints a `https://*.trycloudflare.com` URL. To force Cloudflare Tunnel:

```python
import os
os.environ["OMNIVOICE_SHARE_PROVIDER"] = "cloudflared"
!python omnivoice_service.py --share
```

If you prefer manual ngrok setup:

```python
from pyngrok import ngrok
public_url = ngrok.connect(8008)
print(public_url)
```

Manual Cloudflare Tunnel fallback:

```python
!wget -q -O /content/cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
!chmod +x /content/cloudflared
!/content/cloudflared tunnel --url http://127.0.0.1:8008
```

Then start the service:

```python
!python omnivoice_service.py
```

If you paste the service code directly into a Colab cell, it starts Uvicorn in a background thread because Colab already has an active asyncio loop.

Use the printed ngrok URL as `OMNIVOICE_API_URL` in Aether Studio.

Inside Colab, test the local service first:

```python
import requests
requests.get("http://127.0.0.1:8008/health", timeout=30).json()
```

While the model is still loading, `/health` returns `status: "loading"`. This is expected.

When the model is ready:

```python
requests.get("http://127.0.0.1:8008/ready", timeout=30).json()
```

Do not open `http://0.0.0.0:8008` in your browser. `0.0.0.0` is only the server bind address. Open the ngrok URL from your laptop, or use `http://127.0.0.1:8008/docs` only from inside the Colab runtime.

## Aether Studio `.env`

```env
AETHER_TTS_PROVIDER=omnivoice
OMNIVOICE_API_URL=https://your-ngrok-url.ngrok-free.app
OMNIVOICE_API_KEY=change-me
OMNIVOICE_MODE=auto
```

For voice design mode:

```env
OMNIVOICE_MODE=design
OMNIVOICE_INSTRUCT=female, warm Vietnamese narrator, natural pace
```

For reference voice cloning:

```env
OMNIVOICE_MODE=clone
OMNIVOICE_REF_AUDIO_URL=https://example.com/reference.wav
OMNIVOICE_REF_TEXT=Reference transcript if available
```

## Default Voice Profile Files

The service automatically looks for these files next to `omnivoice_service.py`:

```text
Voice_Ref.WAV
voice_scripts.txt
Instruction.txt
```

With those files present, clone mode can be called without sending `ref_audio_url` or `ref_text` in every request:

```json
{
  "text": "Noi dung can long tieng.",
  "mode": "clone"
}
```

Design mode can use `Instruction.txt` automatically:

```json
{
  "text": "Noi dung can doc.",
  "mode": "design"
}
```

To override the default paths on Colab:

```python
import os
os.environ["OMNIVOICE_DEFAULT_REF_AUDIO_PATH"] = "/content/aether-studio/omnivoice/Voice_Ref.WAV"
os.environ["OMNIVOICE_DEFAULT_REF_TEXT_PATH"] = "/content/aether-studio/omnivoice/voice_scripts.txt"
os.environ["OMNIVOICE_DEFAULT_INSTRUCTION_PATH"] = "/content/aether-studio/omnivoice/Instruction.txt"
```

## API

Health:

```bash
curl https://your-service/health
```

Return JSON with a hosted WAV URL:

```bash
curl -X POST https://your-service/synthesize \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"Xin chao, day la giong doc thu nghiem.\",\"mode\":\"auto\"}"
```

Return the WAV file directly:

```bash
curl -X POST https://your-service/synthesize/file \
  -H "Authorization: Bearer change-me" \
  -H "Content-Type: application/json" \
  -o output.wav \
  -d "{\"text\":\"Xin chao, day la giong doc thu nghiem.\",\"mode\":\"auto\"}"
```

The service loads `k2-fsa/OmniVoice` by default and writes generated audio to `/content/omnivoice_outputs`.
