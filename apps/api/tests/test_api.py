from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, engine
from app.main import app

Base.metadata.create_all(bind=engine)


client = TestClient(app)


def test_bulk_video_creation() -> None:
    response = client.post(
        "/api/videos/bulk",
        json={"urls": ["https://example.com/source-a.mp4", "https://example.com/source-b.mp4"]},
    )

    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2
    assert data[0]["status"] == "queued"
    assert data[0]["target_language"] == "VI"


def test_run_selected_creates_job_and_steps() -> None:
    created = client.post("/api/videos/bulk", json={"urls": ["https://example.com/run-me.mp4"]}).json()
    video_id = created[0]["id"]

    response = client.post("/api/videos/run", json={"video_ids": [video_id]})

    assert response.status_code == 200
    jobs = response.json()
    assert len(jobs) == 1
    assert jobs[0]["video_id"] == video_id
    assert len(jobs[0]["steps"]) == 9


def test_sse_emits_job_events() -> None:
    created = client.post("/api/videos/bulk", json={"urls": ["https://example.com/events.mp4"]}).json()
    job = client.post("/api/videos/run", json={"video_ids": [created[0]["id"]]}).json()[0]

    with client.stream("GET", f"/api/jobs/{job['id']}/events") as response:
      assert response.status_code == 200
      lines = []
      started = time.time()
      for line in response.iter_lines():
          if line:
              lines.append(line)
          if any("data:" in line for line in lines) or time.time() - started > 5:
              break

    payload_lines = [line for line in lines if line.startswith("data:")]
    assert payload_lines
    payload = json.loads(payload_lines[0].removeprefix("data:").strip())
    assert payload["id"] == job["id"]


def test_schedule_selected_updates_status() -> None:
    created = client.post("/api/videos/bulk", json={"urls": ["https://example.com/schedule.mp4"]}).json()
    video_id = created[0]["id"]

    response = client.post(
        "/api/videos/schedule",
        json={"video_ids": [video_id], "publish_date": "2026-06-10", "publish_time": "09:00"},
    )

    assert response.status_code == 200
    data = response.json()
    assert data[0]["status"] == "scheduled"
    assert data[0]["publish_date"] == "2026-06-10"
