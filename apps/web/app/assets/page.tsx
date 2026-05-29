"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, FileAudio, FileVideo, ImageIcon, Loader2, Search, Upload } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel, PageHeader } from "@/components/ui/card";
import { getVideos } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Video } from "@/lib/types";

type AssetMetric = {
  label: string;
  value: string | number;
  icon: LucideIcon;
};

export default function AssetsPage() {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVideos().then(setVideos).finally(() => setLoading(false));
  }, []);

  return (
    <AppShell active="Assets" searchPlaceholder={t.search.assets}>
      <div className="mx-auto max-w-[1500px] space-y-8 p-6 xl:p-10">
        <PageHeader
          title={t.assets.title}
          description={t.assets.description}
          actions={
            <>
              <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-4 py-3 text-sm font-bold text-[var(--muted)]"><Search size={16} />{t.common.filter}</button>
              <button className="flex items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 py-3 text-sm font-bold text-white"><Upload size={16} />{t.assets.uploadAsset}</button>
            </>
          }
        />

        <div className="grid gap-4 md:grid-cols-4">
          {([
            { label: t.assets.sourceVideos, value: videos.length, icon: FileVideo },
            { label: t.assets.audioFiles, value: 18, icon: FileAudio },
            { label: t.assets.subtitles, value: 34, icon: ImageIcon },
            { label: t.assets.renderedMedia, value: videos.filter((video) => video.status === "ready").length, icon: Download },
          ] satisfies AssetMetric[]).map(({ label, value, icon: Icon }) => (
            <Panel key={label} className="p-5">
              <Icon className="mb-5 text-[var(--primary)]" size={22} />
              <div className="font-display text-3xl font-bold">{value}</div>
              <div className="mt-1 text-sm text-[var(--muted)]">{label}</div>
            </Panel>
          ))}
        </div>

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--outline)] p-5">
            <h2 className="font-display text-2xl font-bold">{t.assets.mediaLibrary}</h2>
          </div>
          {loading ? (
            <div className="flex h-48 items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={18} />{t.assets.loading}</div>
          ) : (
            <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
              {videos.map((video) => (
                <Link key={video.id} href={`/studio/${video.id}`} className="group rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-3 transition hover:border-[var(--primary-strong)]">
                  <div className="aspect-video overflow-hidden rounded-md bg-[var(--surface-high)]">
                    {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover opacity-80 transition group-hover:opacity-100" /> : null}
                  </div>
                  <div className="mt-3 truncate text-sm font-bold">{video.video_url}</div>
                  <div className="mt-1 text-xs text-[var(--muted)]">{video.platform} · {video.source_language} to {video.target_language}</div>
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}
