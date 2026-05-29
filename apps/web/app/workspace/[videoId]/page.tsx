"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  ChevronDown,
  Clapperboard,
  FileDown,
  Gauge,
  Languages,
  Loader2,
  Play,
  RefreshCw,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PipelineCard } from "@/components/workspace/pipeline-card";
import { getVideo, outputUrl, runVideos } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { JobStep, Video, VideoStatus } from "@/lib/types";

const ACTIVE_STATUSES: VideoStatus[] = ["queued", "downloading", "transcribing", "translating", "tts_generating", "rendering"];

const pipelineDefinitions: Array<{ name: string; status?: VideoStatus }> = [
  { name: "Download video", status: "downloading" },
  { name: "Subtitle extraction", status: "transcribing" },
  { name: "Translation", status: "translating" },
  { name: "Voice generation", status: "tts_generating" },
  { name: "Rendering", status: "rendering" },
  { name: "Output ready", status: "ready" },
  { name: "QA validation" },
  { name: "Publishing preparation" },
];

function buildSteps(video: Video | null): JobStep[] {
  if (!video) return [];
  const activeIndex = pipelineDefinitions.findIndex((step) => step.status === video.status);
  const ready = video.status === "ready";
  const failed = video.status === "failed";

  return pipelineDefinitions.map((step, index) => {
    const isComplete = ready || (activeIndex > -1 && index < activeIndex);
    const isActive = activeIndex === index;
    return {
      id: `pipeline-${index}`,
      name: step.name,
      status: failed && isActive ? "failed" : isComplete ? "completed" : isActive ? "processing" : "pending",
      progress: isComplete ? 100 : isActive ? video.progress : 0,
      runtime_seconds: 0,
      logs: isActive ? video.current_step : "",
      sort_order: index,
    };
  });
}

export default function WorkspacePage() {
  const { t } = useLanguage();
  const params = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await getVideo(params.videoId);
    setVideo(next);
  }

  useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load workspace."))
      .finally(() => setIsLoading(false));
  }, [params.videoId]);

  useEffect(() => {
    if (!video || !ACTIVE_STATUSES.includes(video.status)) return;
    const interval = window.setInterval(() => {
      void refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to refresh workspace."));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [video?.id, video?.status]);

  async function handleRun() {
    if (!video) return;
    setIsRunning(true);
    try {
      const jobs = await runVideos([video.id]);
      setVideo(jobs[0]);
      await refresh();
    } finally {
      setIsRunning(false);
    }
  }

  const steps = useMemo(() => buildSteps(video), [video]);
  const completedCount = steps.filter((step) => step.status === "completed").length;
  const href = outputUrl(video?.output_url);

  if (isLoading) {
    return (
      <AppShell active="Projects">
        <div className="flex h-[calc(100vh-64px)] items-center justify-center text-[var(--muted)]">
          <Loader2 className="mr-2 animate-spin" size={18} />
          {t.workspace.loading}
        </div>
      </AppShell>
    );
  }

  if (error || !video) {
    return (
      <AppShell active="Projects">
        <div className="p-8 text-red-200">{error ?? t.workspace.notFound}</div>
      </AppShell>
    );
  }

  return (
    <AppShell active="Projects" searchPlaceholder={t.search.workspace}>
      <div className="grid min-h-[calc(100vh-64px)] grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 border-r border-[var(--outline)] p-6 xl:p-10">
          <div className="mb-10 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--muted)]">
                <span>{t.workspace.breadcrumbProjects}</span>
                <span>/</span>
                <span>{t.workspace.breadcrumbWorkspace}</span>
              </div>
              <h1 className="font-display text-4xl font-bold tracking-normal">Global Product Launch 2024</h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[var(--muted)]">
                <span className="flex items-center gap-2 text-[var(--primary)]">
                  <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
                  {video.current_step ?? t.workspace.ready}
                </span>
                <span>{video.source_language} to {video.target_language}</span>
                <span>{video.platform}</span>
                <span>{video.progress}% complete</span>
              </div>
            </div>
            <button className="flex h-14 items-center justify-center gap-3 rounded-xl bg-[var(--primary-strong)] px-8 font-display text-base font-semibold text-white shadow-lg shadow-black/20 disabled:opacity-60" onClick={handleRun} disabled={isRunning}>
              {isRunning ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} />}
              {t.workspace.runLocalization}
            </button>
            <Link href={`/studio/${video.id}`} className="flex h-14 items-center justify-center rounded-xl border border-[var(--outline)] px-8 font-display text-base font-semibold text-[var(--text)] hover:bg-[var(--surface-high)]">
              {t.workspace.openReview}
            </Link>
          </div>

          <div className="mb-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-container)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                <Languages size={17} />
                {t.common.language}
              </div>
              <div className="font-display text-2xl font-bold">{video.source_language} to {video.target_language}</div>
            </div>
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-container)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                <Gauge size={17} />
                {t.common.progress}
              </div>
              <div className="font-display text-2xl font-bold">{completedCount}/{steps.length} {t.workspace.steps}</div>
            </div>
            <div className="rounded-xl border border-[var(--outline)] bg-[var(--surface-container)] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                <Clapperboard size={17} />
                {t.workspace.destination}
              </div>
              <div className="font-display text-2xl font-bold">{video.platform}</div>
            </div>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <PipelineCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </section>

        <aside className="flex min-h-full flex-col bg-[var(--surface)]">
          <div className="border-b border-[var(--outline)] p-6">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold uppercase tracking-[0.16em]">{t.workspace.inspector}</h2>
              <Settings2 size={18} className="text-[var(--muted)]" />
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{t.workspace.outputResolution}</span>
                <button className="flex w-full items-center justify-between rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-4 py-3 text-left">
                  4K Ultra HD
                  <ChevronDown size={17} />
                </button>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className="mb-2 block text-xs font-bold text-[var(--muted)]">{t.workspace.format}</span>
                  <button className="flex w-full items-center justify-between rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-3 py-2 text-sm">
                    MP4
                    <ChevronDown size={15} />
                  </button>
                </label>
                <label>
                  <span className="mb-2 block text-xs font-bold text-[var(--muted)]">{t.workspace.bitrate}</span>
                  <button className="flex w-full items-center justify-between rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-3 py-2 text-sm">
                    Adaptive
                    <ChevronDown size={15} />
                  </button>
                </label>
              </div>
            </div>
          </div>

          <div className="border-b border-[var(--outline)] p-6">
            <div className="mb-4 flex items-center gap-2 text-[var(--primary)]">
              <ShieldCheck size={18} />
              <h3 className="font-display font-bold">{t.workspace.qaChecklist}</h3>
            </div>
            <div className="space-y-3">
              {["Brand guidelines reviewed", "Captions fit the frame", "Audio timing checked", "Ready for publishing review"].map((item, index) => (
                <label key={item} className="flex items-center gap-3 rounded-lg p-2 text-sm text-[var(--muted)] hover:bg-[var(--surface-low)]">
                  <span className={`flex h-5 w-5 items-center justify-center rounded border ${index < 2 ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-ink)]" : "border-[var(--outline)]"}`}>
                    {index < 2 ? <Check size={14} /> : null}
                  </span>
                  {item}
                </label>
              ))}
            </div>
          </div>

          <div className="flex-1 p-6">
            <div className="mb-4 flex items-center gap-2 text-[var(--primary)]">
              <FileDown size={18} />
              <h3 className="font-display font-bold">{t.workspace.runtimeLogs}</h3>
            </div>
            <div className="space-y-3">
              {video.logs ? (
                <pre className="max-h-80 overflow-auto rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-3 font-mono text-xs leading-5 text-[var(--muted)]">{video.logs}</pre>
              ) : (
                <p className="text-sm text-[var(--muted)]">No logs yet.</p>
              )}
              {href ? (
                <a className="block rounded-lg border border-[var(--primary-strong)] bg-[var(--primary-strong)]/10 px-4 py-3 text-center text-sm font-bold text-[var(--primary)]" href={href} target="_blank" rel="noreferrer">
                  Open output
                </a>
              ) : null}
            </div>
          </div>

          <div className="space-y-3 border-t border-[var(--outline)] p-6">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-4 py-3 font-semibold">
              <RefreshCw size={18} />
              {t.workspace.refreshReview}
            </button>
            <button className="w-full rounded-lg bg-[var(--primary)] px-4 py-3 font-bold text-[var(--primary-ink)]">{t.workspace.approvePublishing}</button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
