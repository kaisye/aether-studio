"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart3, CheckCircle2, Clock3, Database, Film, Languages, Loader2, Zap } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel, PageHeader } from "@/components/ui/card";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { getVideos } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Video, VideoStatus } from "@/lib/types";

const ACTIVE_STATUSES: VideoStatus[] = ["queued", "downloading", "transcribing", "translating", "tts_generating", "rendering"];

const metricCards = [
  { label: "Total Videos", icon: Film, tone: "text-[var(--primary)]" },
  { label: "Processing", icon: Clock3, tone: "text-[var(--warning)]" },
  { label: "Scheduled Posts", icon: BarChart3, tone: "text-[var(--muted)]" },
  { label: "Published", icon: CheckCircle2, tone: "text-[var(--success)]" },
  { label: "Storage Usage", icon: Database, tone: "text-[var(--primary)]" },
];

export default function DashboardPage() {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVideos()
      .then(setVideos)
      .finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const processing = videos.filter((video) => ACTIVE_STATUSES.includes(video.status)).length;
    const scheduled = videos.filter((video) => Boolean(video.publish_date)).length;
    const published = videos.filter((video) => video.status === "ready").length;
    return [videos.length, processing, scheduled, published, "1.2 TB"];
  }, [videos]);

  return (
    <AppShell active="Dashboard" searchPlaceholder={t.search.projectsOrAssets}>
      <div className="mx-auto max-w-[1600px] space-y-8 p-6 xl:p-10">
        <PageHeader
          title={t.dashboard.title}
          description={t.dashboard.description}
          actions={
            <>
              <Link href="/projects" className="rounded-lg border border-[var(--outline)] px-5 py-3 text-sm font-bold hover:bg-[var(--surface-high)]">
                {t.dashboard.viewAnalytics}
              </Link>
              <Link href="/queue" className="flex items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-5 py-3 text-sm font-bold text-white">
                <Zap size={17} />
                {t.dashboard.quickRun}
              </Link>
            </>
          }
        />

        {loading ? (
            <div className="flex h-40 items-center justify-center text-[var(--muted)]">
            <Loader2 className="mr-2 animate-spin" size={18} />
            Loading studio metrics
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {metricCards.map((card, index) => {
                const Icon = card.icon;
                const labels = [t.dashboard.totalVideos, t.dashboard.processing, t.dashboard.scheduledPosts, t.dashboard.published, t.dashboard.storageUsage];
                return (
                  <Panel key={card.label} className="p-5">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="text-sm font-semibold text-[var(--muted)]">{labels[index]}</span>
                      <Icon size={19} className={card.tone} />
                    </div>
                    <div className="font-display text-3xl font-bold">{metrics[index]}</div>
                    {card.label === "Storage Usage" ? (
                      <div className="mt-5">
                        <ProgressBar value={85} />
                        <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
                          <span>850 GB left</span>
                          <span>85%</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm text-[var(--muted)]">{t.dashboard.updatedFromQueue}</p>
                    )}
                  </Panel>
                );
              })}
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="space-y-6">
                <section>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-display text-2xl font-bold">{t.dashboard.pinnedProjects}</h2>
                    <Link href="/projects" className="text-sm font-bold text-[var(--primary)]">{t.dashboard.viewAll}</Link>
                  </div>
                  <div className="grid gap-4 md:grid-cols-3">
                    {videos.slice(0, 3).map((video) => (
                      <Link key={video.id} href={`/workspace/${video.id}`} className="group rounded-xl border border-[var(--outline)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary-strong)]">
                        <div className="mb-4 aspect-video overflow-hidden rounded-lg bg-[var(--surface-high)]">
                          {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" /> : null}
                        </div>
                        <h3 className="font-display font-bold">{video.workflow_template ?? "Full Localization"}</h3>
                        <p className="mt-1 text-sm text-[var(--muted)]">{video.source_language} to {video.target_language}</p>
                      </Link>
                    ))}
                  </div>
                </section>

                <Panel className="overflow-hidden">
                  <div className="border-b border-[var(--outline)] p-5">
                    <h2 className="font-display text-2xl font-bold">{t.dashboard.recentJobs}</h2>
                  </div>
                  <div className="divide-y divide-[var(--outline)]">
                    {videos.slice(0, 5).map((video) => (
                      <Link key={video.id} href={`/workspace/${video.id}`} className="grid grid-cols-[minmax(0,1fr)_160px_120px] items-center gap-4 p-5 hover:bg-[var(--surface-low)]">
                        <div className="min-w-0">
                          <div className="truncate font-semibold">{video.video_url}</div>
                          <div className="mt-1 text-sm text-[var(--muted)]">{video.platform} · {video.voice}</div>
                        </div>
                        <StatusBadge status={video.status} />
                        <div className="flex items-center gap-2">
                          <ProgressBar value={video.progress} />
                          <span className="text-xs text-[var(--muted)]">{video.progress}%</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </Panel>
              </div>

              <Panel className="overflow-hidden">
                <div className="border-b border-[var(--outline)] p-6">
                  <h2 className="font-display text-2xl font-bold">{t.dashboard.recentActivity}</h2>
                </div>
                <div className="space-y-6 p-6">
                  {[
                    "Marketing Promo prepared for review",
                    "New voice profile added to library",
                    "Global Campaign scheduled for publishing",
                    "Subtitle review completed",
                    "Render issue resolved and queued again",
                  ].map((item, index) => (
                    <div key={item} className="flex gap-4">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--surface-high)] text-[var(--primary)]">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{item}</p>
                        <p className="mt-1 text-sm text-[var(--muted)]">{index + 1}h ago</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
