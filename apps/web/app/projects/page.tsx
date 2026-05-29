"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Calendar, Filter, Grid2X2, List, Loader2, Mic2, Plus, SortAsc } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { Panel, PageHeader } from "@/components/ui/card";
import { getVideos } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import { projectDisplayTitle, videoPreviewImage } from "@/lib/media";
import type { Video, VideoStatus } from "@/lib/types";

const ACTIVE_STATUSES: VideoStatus[] = ["queued", "downloading", "transcribing", "translating", "tts_generating", "rendering"];

export default function ProjectsPage() {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    getVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  return (
    <AppShell active="Projects" searchPlaceholder={t.search.projects}>
      <div className="mx-auto max-w-[1600px] space-y-8 p-6 xl:p-10">
        <PageHeader
          title={t.projects.title}
          description={t.projects.description}
          actions={
            <>
              <div className="flex rounded-lg border border-[var(--outline)] bg-[var(--surface)] p-1">
                <button
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${view === "grid" ? "bg-[var(--surface-high)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={16} />
                  {t.common.grid}
                </button>
                <button
                  className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm font-bold ${view === "list" ? "bg-[var(--surface-high)] text-[var(--text)]" : "text-[var(--muted)] hover:text-[var(--text)]"}`}
                  onClick={() => setView("list")}
                >
                  <List size={16} />
                  {t.common.list}
                </button>
              </div>
              <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-4 py-2 text-sm font-bold text-[var(--muted)]"><Filter size={16} />{t.common.filter}</button>
              <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-4 py-2 text-sm font-bold text-[var(--muted)]"><SortAsc size={16} />{t.common.sort}</button>
              <Link href="/queue" className="flex items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 py-2 text-sm font-bold text-white"><Plus size={16} />{t.projects.queueVideos}</Link>
            </>
          }
        />

        {loading ? (
          <div className="flex h-64 items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={18} />Loading projects</div>
        ) : (
          <>
            {view === "grid" ? <ProjectGrid videos={videos} /> : <ProjectList videos={videos} />}

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <Panel className="p-8">
                <h2 className="font-display text-xl font-bold text-[var(--primary)]">{t.projects.storageInsights}</h2>
                <div className="mt-6 flex items-end gap-3">
                  <span className="font-display text-6xl font-bold">84.2</span>
                  <span className="mb-2 text-2xl font-bold text-[var(--muted)]">GB Used</span>
                </div>
                <div className="mt-6"><ProgressBar value={42} /></div>
                <p className="mt-3 text-sm text-[var(--muted)]">You have used 42% of your 200GB workspace storage limit.</p>
              </Panel>
              <Panel className="flex flex-col justify-between p-8">
                <h2 className="font-display text-xl font-bold text-[var(--warning)]">{t.projects.queueStatus}</h2>
                <div>
                  <p className="font-display text-4xl font-bold">{t.projects.priorityLane}</p>
                  <p className="mt-5 text-sm text-[var(--muted)]">{videos.filter((video) => ACTIVE_STATUSES.includes(video.status)).length} {t.projects.tasksRunning}</p>
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ProjectGrid({ videos }: { videos: Video[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
      {videos.map((video, index) => (
        <Link key={video.id} href={`/workspace/${video.id}`} className="group overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)] transition hover:border-[var(--primary-strong)]">
          <ProjectPreview video={video} badge={index % 2 ? "9:16" : "4K"} />
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate font-display text-lg font-bold">{projectDisplayTitle(video)}</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">{video.workflow_template ?? "Full Localization"}</p>
              </div>
              <StatusBadge status={video.status} />
            </div>
            <div className="flex flex-wrap gap-2">
              {[video.source_language, video.target_language, video.platform].map((tag) => (
                <span key={tag} className="rounded bg-[var(--surface-high)] px-2 py-1 text-xs font-bold text-[var(--muted)]">{tag}</span>
              ))}
            </div>
            <div className="border-t border-[var(--outline)] pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[var(--muted)]"><Mic2 size={16} />Voice Profile</span>
                <span className="truncate font-semibold">{video.voice}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-[var(--muted)]"><Calendar size={16} />Publish</span>
                <span className="font-semibold">{video.publish_date ?? "Unscheduled"}</span>
              </div>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

function ProjectList({ videos }: { videos: Video[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--outline)] bg-[var(--surface)]">
      <div className="grid min-w-[1180px] grid-cols-[96px_minmax(260px,1fr)_140px_150px_170px_170px_120px] border-b border-[var(--outline)] bg-[var(--surface-low)] px-4 py-3 text-xs font-bold uppercase tracking-[0.06em] text-[var(--muted)]">
        <span>Preview</span>
        <span>Project Flow</span>
        <span>Status</span>
        <span>Language</span>
        <span>Voice</span>
        <span>Updated</span>
        <span>Open</span>
      </div>
      <div className="max-h-[620px] min-w-[1180px] overflow-y-auto">
        {videos.map((video) => (
          <div key={video.id} className="grid grid-cols-[96px_minmax(260px,1fr)_140px_150px_170px_170px_120px] items-center border-b border-[var(--outline)] px-4 py-3 last:border-b-0 hover:bg-[var(--surface-low)]">
            <Link href={`/workspace/${video.id}`} className="relative h-14 w-20 overflow-hidden rounded-md border border-[var(--outline)] bg-[var(--surface-high)]">
              <ProjectPreviewImage video={video} />
            </Link>
            <div className="min-w-0 pr-5">
              <Link href={`/workspace/${video.id}`} className="truncate font-display text-base font-bold hover:text-[var(--primary)]">
                {projectDisplayTitle(video)}
              </Link>
              <p className="mt-1 truncate text-sm text-[var(--muted)]">{video.video_url}</p>
            </div>
            <StatusBadge status={video.status} />
            <span className="text-sm font-semibold text-[var(--muted)]">{video.source_language} to {video.target_language}</span>
            <span className="truncate text-sm text-[var(--muted)]">{video.voice}</span>
            <span className="text-xs text-[var(--muted)]">{new Date(video.updated_at).toLocaleString()}</span>
            <Link href={`/workspace/${video.id}`} className="rounded-lg border border-[var(--outline)] px-3 py-2 text-center text-sm font-bold text-[var(--muted)] hover:border-[var(--primary-strong)] hover:text-[var(--primary)]">
              Open Flow
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectPreview({ video, badge }: { video: Video; badge: string }) {
  return (
    <div className="relative aspect-video overflow-hidden bg-[var(--surface-high)]">
      <ProjectPreviewImage video={video} />
      {ACTIVE_STATUSES.includes(video.status) ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 p-8">
          <div className="w-full max-w-xs"><ProgressBar value={video.progress} /></div>
          <span className="mt-3 text-sm font-bold">Preparing - {video.progress}%</span>
        </div>
      ) : null}
      {video.status === "failed" ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-[var(--danger)]">
          <AlertTriangle size={34} />
          <span className="mt-2 text-sm font-bold">Needs attention</span>
        </div>
      ) : null}
      <div className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs font-bold">{badge}</div>
    </div>
  );
}

function ProjectPreviewImage({ video }: { video: Video }) {
  const preview = video.thumbnail_url || videoPreviewImage(video.video_url);
  if (preview) {
    return <img src={preview} alt="" className="h-full w-full object-cover opacity-80 transition duration-500 group-hover:scale-105 group-hover:opacity-100" />;
  }
  return (
    <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,#161822,#26202f)] text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
      No Preview
    </div>
  );
}
