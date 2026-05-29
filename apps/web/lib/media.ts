import type { Video } from "./types";

export function videoPreviewImage(videoUrl: string | null | undefined) {
  const youtubeId = youtubeVideoId(videoUrl);
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }
  return null;
}

export function projectDisplayTitle(video: Pick<Video, "content" | "source_title" | "video_url" | "workflow_template">) {
  const firstLine = video.content?.split(/\r?\n/).map((line) => line.trim()).find(Boolean);
  if (firstLine) {
    return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
  }

  if (video.source_title) {
    return video.source_title.length > 72 ? `${video.source_title.slice(0, 69)}...` : video.source_title;
  }

  const urlTitle = titleFromUrl(video.video_url);
  return urlTitle || video.workflow_template || "Localization Flow";
}

function youtubeVideoId(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") return url.searchParams.get("v");
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0]) && parts[1]) return parts[1];
    }
    if (host === "youtu.be") {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

function titleFromUrl(value: string | null | undefined) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const path = url.pathname.split("/").filter(Boolean).pop();
    return path ? decodeURIComponent(path).replace(/[-_]/g, " ") : url.hostname;
  } catch {
    return value;
  }
}
