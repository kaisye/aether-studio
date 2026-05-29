"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCheck, ChevronDown, Expand, Loader2, Pause, RefreshCw, SkipBack, SkipForward, Sparkles, Volume2 } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel } from "@/components/ui/card";
import { approveVideoReview, getVideoReview, outputUrl, regenerateVideoReview } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { VideoReview } from "@/lib/types";

export default function VideoStudioPage() {
  const { t } = useLanguage();
  const params = useParams<{ videoId: string }>();
  const [review, setReview] = useState<VideoReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refreshReview() {
    setReview(await getVideoReview(params.videoId));
  }

  useEffect(() => {
    refreshReview()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load review."))
      .finally(() => setLoading(false));
  }, [params.videoId]);

  async function handleApprove() {
    setBusy(true);
    setError(null);
    try {
      setReview(await approveVideoReview(params.videoId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to approve review.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    setError(null);
    try {
      await regenerateVideoReview(params.videoId);
      await refreshReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to regenerate preview.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell active="Projects">
        <div className="flex h-[calc(100vh-64px)] items-center justify-center text-[var(--muted)]">
          <Loader2 className="mr-2 animate-spin" size={18} />
          {t.studio.loading}
        </div>
      </AppShell>
    );
  }

  if (!review) {
    return (
      <AppShell active="Projects">
        <div className="p-8 text-red-200">{error ?? t.studio.notFound}</div>
      </AppShell>
    );
  }

  const video = review.job;
  const sourceVideo = outputUrl(review.source_video_url);
  const localizedVideo = outputUrl(review.localized_video_url);
  const thumbnail = video.thumbnail_url ?? undefined;
  const canApprove = review.review_status === "ready";

  return (
    <AppShell active="Projects" searchPlaceholder={t.search.reviewNotes}>
      <div className="grid h-[calc(100vh-64px)] grid-cols-1 overflow-hidden xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="flex min-w-0 flex-col border-r border-[var(--outline)]">
          <div className="relative grid flex-1 grid-cols-2 overflow-hidden bg-black">
            <div className="relative overflow-hidden">
              {sourceVideo ? (
                <video src={sourceVideo} poster={thumbnail} controls className="h-full w-full object-contain" />
              ) : thumbnail ? (
                <img src={thumbnail} alt="" className="h-full w-full object-cover opacity-90" />
              ) : null}
              <span className="absolute left-5 top-5 rounded border border-white/10 bg-black/70 px-3 py-2 text-xs font-bold uppercase tracking-[0.12em]">
                {t.studio.original} ({video.source_language})
              </span>
            </div>
            <div className="relative overflow-hidden border-l-2 border-[var(--primary-strong)]">
              {localizedVideo ? (
                <video src={localizedVideo} poster={thumbnail} controls className="h-full w-full object-contain" />
              ) : thumbnail ? (
                <img src={thumbnail} alt="" className="h-full w-full object-cover grayscale-[0.25] hue-rotate-15" />
              ) : null}
              <span className="absolute right-5 top-5 rounded bg-[var(--primary-strong)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white">
                {t.studio.localized} ({video.target_language})
              </span>
              <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--primary)] bg-[var(--primary-strong)]">
                <ChevronDown className="rotate-90" size={18} />
              </div>
            </div>
          </div>

          <div className="border-y border-[var(--outline)] bg-[var(--surface)] p-5">
            <div className="mb-4 flex items-center gap-4">
              <span className="font-mono text-sm text-[var(--muted)]">00:00:00</span>
              <div className="h-1 flex-1 rounded-full bg-[var(--surface-highest)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${video.progress}%` }} />
              </div>
              <span className="font-mono text-sm text-[var(--muted)]">{video.progress}%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-5">
                <SkipBack className="text-[var(--muted)]" size={20} />
                <button className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--text)] text-[var(--surface)]">
                  <Pause size={22} />
                </button>
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
                {review.subtitle_rows.map((row, index) => (
                  <tr key={`${row.start}-${index}`} className={index === 1 ? "bg-[var(--primary-strong)]/10" : "hover:bg-[var(--surface-high)]"}>
                    <td className="p-4 align-top font-mono text-xs text-[var(--muted)]">{row.start}</td>
                    <td className="p-4 align-top font-mono text-xs text-[var(--muted)]">{row.end}</td>
                    <td className="p-4 align-top text-sm">{row.original_text}</td>
                    <td className="p-4 align-top text-sm">{row.translated_text}</td>
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
          {error ? <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{error}</div> : null}
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
                <span className="rounded border border-[var(--primary-strong)] bg-[var(--primary-strong)]/15 px-2 py-1 text-xs text-[var(--primary)]">{video.voice}</span>
              </div>
              <div className="space-y-6">
                {[t.studio.pitch, t.studio.speechRate].map((label, index) => (
                  <div key={label}>
                    <div className="mb-2 flex justify-between text-sm">
                      <span className="text-[var(--muted)]">{label}</span>
                      <span>{index ? video.voice_rate : "0.95x"}</span>
                    </div>
                    <input type="range" className="w-full accent-[var(--primary)]" defaultValue={index ? 55 : 45} readOnly />
                  </div>
                ))}
              </div>
            </div>
            <Panel className="p-5">
              <div className="mb-3 flex items-center gap-3 text-[var(--primary)]">
                <Sparkles size={19} />
                <h2 className="font-display font-bold">{t.studio.lipSyncReview}</h2>
              </div>
              <p className="text-sm leading-6 text-[var(--muted)]">{t.studio.lipSyncDescription}</p>
              <div className="mt-4 space-y-2">
                {review.qa_checklist.map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <CheckCheck size={15} className={item.startsWith("Error") || item.includes("missing") || item.includes("not ready") ? "text-red-300" : "text-[var(--primary)]"} />
                    {item}
                  </div>
                ))}
              </div>
            </Panel>
          </div>
          <div className="mt-auto space-y-3">
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-4 py-4 font-bold disabled:opacity-50" onClick={handleRegenerate} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
              {t.studio.regeneratePreview}
            </button>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-4 font-bold text-[var(--primary-ink)] disabled:opacity-50" onClick={handleApprove} disabled={busy || !canApprove}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <CheckCheck size={18} />}
              {review.review_status === "approved" ? "Approved" : t.studio.approveBake}
            </button>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
