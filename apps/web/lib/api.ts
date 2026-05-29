import type { Job, JobCreateInput, Video } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function normalizeJob(job: Job): Video {
  return {
    ...job,
    last_updated: job.updated_at,
    workflow_template: "Full Localization",
    latest_job: job,
  };
}

export async function getVideos() {
  const jobs = await request<Job[]>("/jobs", { cache: "no-store" });
  return jobs.map(normalizeJob);
}

export async function getVideo(videoId: string) {
  const job = await request<Job>(`/jobs/${videoId}`, { cache: "no-store" });
  return normalizeJob(job);
}

export async function createJob(payload: Partial<JobCreateInput> & { video_url: string }) {
  const job = await request<Job>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      content: "",
      source_language: "EN",
      target_language: "VI",
      voice: "auto",
      voice_rate: "+0%",
      platform: "YouTube",
      ...payload,
    }),
  });
  return normalizeJob(job);
}

export async function bulkCreateVideos(urls: string[]) {
  const created = await Promise.all(urls.map((video_url) => createJob({ video_url })));
  return created;
}

export async function patchVideo(videoId: string, payload: Partial<Video>) {
  const job = await request<Job>(`/jobs/${videoId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return normalizeJob(job);
}

export async function runVideos(videoIds: string[]) {
  const jobs = await Promise.all(
    videoIds.map((id) =>
      request<Job>(`/jobs/${id}/run`, {
        method: "POST",
      }),
    ),
  );
  return jobs.map(normalizeJob);
}

export async function retryJob(videoId: string) {
  const job = await request<Job>(`/jobs/${videoId}/retry`, {
    method: "POST",
  });
  return normalizeJob(job);
}

export async function deleteJob(videoId: string) {
  return request<{ status: string }>(`/jobs/${videoId}`, {
    method: "DELETE",
  });
}

export async function scheduleVideos(videoIds: string[]) {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const updated = await Promise.all(
    videoIds.map((id) =>
      patchVideo(id, {
        publish_date: date.toISOString().slice(0, 10),
        publish_time: "09:00",
      }),
    ),
  );
  return updated;
}

export function outputUrl(path?: string | null) {
  if (!path) return null;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE_URL}${path}`;
}
