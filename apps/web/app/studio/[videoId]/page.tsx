"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCheck, ChevronDown, Expand, Loader2, Pause, RefreshCw, SkipBack, SkipForward, Sparkles, Volume2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/card";
import { getVideo } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Video } from "@/lib/types";

const subtitles = [
  ["00:00:04", "00:00:08", "Welcome to the future of media production with Aether.", "Bienvenidos al futuro de la producción de medios con Aether."],
  ["00:00:08", "00:00:12", "Today we are reviewing automated localization workflows.", "Hoy revisamos flujos de localización automatizados."],
  ["00:00:12", "00:00:16", "This helps creators reach global audiences faster.", "Esto ayuda a los creadores a llegar más rápido a audiencias globales."],
];

export default function VideoStudioPage() {
  const { t } = useLanguage();
  const params = useParams<{ videoId: string }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getVideo(params.videoId)
      .then(setVideo)
      .finally(() => setLoading(false));
  }, [params.videoId]);

  if (loading) {
    return (
      <AppShell active="Projects">
        <div className="flex h-[calc(100vh-64px)] items-center justify-center text-[var(--muted)]"><Loader2 className="mr-2 animate-spin" size={18} />{t.studio.loading}</div>
      </AppShell>
    );
  }

  if (!video) {
    return <AppShell active="Projects"><div className="p-8">{t.studio.notFound}</div></AppShell>;
  }

  return (
    <AppShell active="Projects" searchPlaceholder={t.search.reviewNotes}>
      <div className="grid h-[calc(100vh-64px)] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col border-r border-[var(--outline)]">
          <div className="relative grid flex-1 grid-cols-2 overflow-hidden bg-black">
            <div className="relative overflow-hidden">
              {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover opacity-90" /> : null}
              <span className="absolute left-5 top-5 rounded border border-white/10 bg-black/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">{t.studio.original} ({video.source_language})</span>
            </div>
            <div className="relative overflow-hidden border-l-2 border-[var(--primary-strong)]">
              {video.thumbnail_url ? <img src={video.thumbnail_url} alt="" className="h-full w-full object-cover grayscale-[0.25] hue-rotate-15" /> : null}
              <span className="absolute right-5 top-5 rounded bg-[var(--primary-strong)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">{t.studio.localized} ({video.target_language})</span>
              <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary-strong)]">
                <ChevronDown className="rotate-90" size={18} />
              </div>
            </div>
          </div>

          <div className="border-y border-[var(--outline)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-4">
              <span className="font-mono text-sm text-[var(--muted)]">00:14:22</span>
              <div className="h-1 flex-1 rounded-full bg-[var(--surface-highest)]">
                <div className="h-full w-[45%] rounded-full bg-[var(--primary)]" />
              </div>
              <span className="font-mono text-sm text-[var(--muted)]">01:05:00</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <SkipBack className="text-[var(--muted)]" size={20} />
                <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text)] text-[var(--surface)]"><Pause size={22} /></button>
                <SkipForward className="text-[var(--muted)]" size={20} />
                <Volume2 className="text-[var(--muted)]" size={20} />
              </div>
              <div className="flex items-center gap-3">
                <button className="rounded-lg border border-[var(--outline)] px-3 py-2 text-sm font-bold">{t.studio.subtitles}</button>
                <Expand size={20} className="text-[var(--muted)]" />
              </div>
            </div>
          </div>

          <div className="h-72 overflow-auto bg-[var(--surface-low)]">
            <table className="w-full border-collapse text-left">
              <thead className="sticky top-0 bg-[var(--surface-high)]">
                <tr className="border-b border-[var(--outline)] text-xs font-bold uppercase tracking-[0.08em] text-[var(--muted)]">
                  <th className="p-4">Start</th>
                  <th className="p-4">End</th>
                  <th className="p-4">Original Text ({video.source_language})</th>
                  <th className="p-4">Translated Text ({video.target_language})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--outline)]">
                {subtitles.map((row, index) => (
                  <tr key={row[0]} className={index === 1 ? "bg-[var(--primary-strong)]/10" : "hover:bg-[var(--surface-high)]"}>
                    {row.map((cell, cellIndex) => <td key={cellIndex} className="p-4 align-top text-sm">{cell}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex h-20 items-end gap-1 border-t border-[var(--outline)] bg-[var(--surface)] px-6 pb-5">
            {Array.from({ length: 44 }).map((_, index) => (
              <div key={index} className="flex-1 rounded-t bg-[var(--primary)]/40" style={{ height: `${18 + ((index * 17) % 48)}px` }} />
            ))}
          </div>
        </section>

        <aside className="flex flex-col bg-[var(--surface)] p-6">
          <h1 className="font-display text-2xl font-bold">{t.studio.inspector}</h1>
          <div className="mt-8 space-y-8">
            <div>
              <label className="mb-3 block text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">{t.studio.targetLanguage}</label>
              <button className="flex w-full items-center justify-between rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-4 py-4 font-bold">
                {video.target_language} Localization
                <ChevronDown size={18} />
              </button>
            </div>
            <div className="border-t border-[var(--outline)] pt-8">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-display font-bold">{t.studio.voiceSettings}</h2>
                <span className="rounded border border-[var(--primary-strong)] bg-[var(--primary-strong)]/15 px-2 py-1 text-xs text-[var(--primary)]">Studio Voice</span>
              </div>
              <div className="space-y-6">
                {[t.studio.pitch, t.studio.speechRate].map((label, index) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm"><span className="text-[var(--muted)]">{label}</span><span>{index ? "1.05x" : "0.95x"}</span></div>
                    <input type="range" className="w-full accent-[var(--primary)]" defaultValue={index ? 55 : 45} />
                  </div>
                ))}
                <div>
                  <div className="mb-2 flex justify-between text-sm"><span className="text-[var(--muted)]">{t.studio.emotion}</span><span>High</span></div>
                  <div className="grid grid-cols-3 gap-2">
                    {["Low", "Med", "High"].map((value) => <button key={value} className={`rounded border border-[var(--outline)] py-2 text-sm font-bold ${value === "High" ? "bg-[var(--primary)] text-[var(--primary-ink)]" : ""}`}>{value}</button>)}
                  </div>
                </div>
              </div>
            </div>
            <Panel className="p-5">
              <div className="mb-3 flex items-center gap-3 text-[var(--primary)]"><Sparkles size={19} /><h2 className="font-display font-bold">{t.studio.lipSyncReview}</h2></div>
              <p className="text-sm leading-6 text-[var(--muted)]">{t.studio.lipSyncDescription}</p>
            </Panel>
          </div>
          <div className="mt-auto space-y-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-4 py-4 font-bold"><RefreshCw size={18} />{t.studio.regeneratePreview}</button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-4 font-bold text-[var(--primary-ink)]"><CheckCheck size={18} />{t.studio.approveBake}</button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
