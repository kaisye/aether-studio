from __future__ import annotations

import sys
import time
import os
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, engine
from app.main import app, ensure_schema_compatibility

Base.metadata.create_all(bind=engine)
ensure_schema_compatibility()

client = TestClient(app)
os.environ["AETHER_ALLOW_SYNTHETIC_SOURCE"] = "1"
os.environ["AETHER_ALLOW_SYNTHETIC_AUDIO"] = "1"
os.environ["AETHER_ALLOW_LOCAL_SUBTITLE_GENERATION"] = "1"


def test_create_list_patch_delete_job() -> None:
    created = client.post(
        "/jobs",
        json={
            "video_url": "https://example.com/source.mp4",
            "content": "Launch caption",
            "target_language": "VI",
        },
    )

    assert created.status_code == 200
    job = created.json()
    assert job["status"] == "draft"
    assert job["progress"] == 0

    listed = client.get("/jobs")
    assert listed.status_code == 200
    assert any(item["id"] == job["id"] for item in listed.json())

    patched = client.patch(f"/jobs/{job['id']}", json={"voice": "Sarah Adams", "platform": "TikTok"})
    assert patched.status_code == 200
    assert patched.json()["voice"] == "Sarah Adams"

    deleted = client.delete(f"/jobs/{job['id']}")
    assert deleted.status_code == 200
    assert deleted.json()["status"] == "deleted"


def test_run_job_reaches_ready_with_logs_and_output() -> None:
    job = client.post("/jobs", json={"video_url": "https://example.com/run.mp4", "content": "Run me"}).json()

    queued = client.post(f"/jobs/{job['id']}/run")
    assert queued.status_code == 200
    assert queued.json()["status"] == "queued"

    final = None
    started = time.time()
    while time.time() - started < 20:
        current = client.get(f"/jobs/{job['id']}").json()
        if current["status"] in {"ready", "failed"}:
            final = current
            break
        time.sleep(0.25)

    assert final is not None
    assert final["status"] == "ready"
    assert final["progress"] == 100
    assert final["output_url"]
    assert "Job completed" in final["logs"]

    logs = client.get(f"/jobs/{job['id']}/logs")
    assert logs.status_code == 200
    assert "Downloading source video" in logs.json()["logs"]

    output = client.get(f"/jobs/{job['id']}/output")
    assert output.status_code == 200
    assert output.json()["output_url"] == final["output_url"]

    review = client.get(f"/jobs/{job['id']}/review")
    assert review.status_code == 200
    review_data = review.json()
    assert review_data["job"]["id"] == job["id"]
    assert review_data["review_status"] == "ready"
    assert review_data["localized_video_url"] == final["output_url"]
    assert review_data["subtitle_rows"]

    approved = client.post(f"/jobs/{job['id']}/review/approve")
    assert approved.status_code == 200
    assert approved.json()["review_status"] == "approved"


def test_retry_failed_job_is_allowed() -> None:
    job = client.post("/jobs", json={"video_url": "https://example.com/retry.mp4"}).json()
    failed = client.patch(f"/jobs/{job['id']}", json={"status": "failed"})
    assert failed.status_code == 200

    retried = client.post(f"/jobs/{job['id']}/retry")
    assert retried.status_code == 200
    assert retried.json()["status"] == "queued"
