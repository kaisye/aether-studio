"use client";

import { useEffect, useMemo, useState } from "react";
import { RowSelectionState, SortingState } from "@tanstack/react-table";
import { CalendarClock, Columns3, Filter, Loader2, Play, Plus, RotateCcw, Save, Search, Trash2, Upload, X } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { QueueGrid } from "@/components/queue-grid";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { bulkCreateVideos, createJob, deleteJob, getVideos, outputUrl, patchVideo, retryJob, runVideos, scheduleVideos } from "@/lib/api";
import { useLanguage } from "@/lib/i18n";
import type { Video, VideoStatus } from "@/lib/types";
import { VOICE_RATE_OPTIONS } from "@/lib/voice-rates";
import { VOICE_PROFILES } from "@/lib/voices";

const ACTIVE_STATUSES: VideoStatus[] = ["queued", "downloading", "transcribing", "translating", "tts_generating", "rendering"];

function JobDetailDrawer({
  job,
  onClose,
  onRetry,
  onSave,
}: {
  job: Video | null;
  onClose: () => void;
  onRetry: (jobId: string) => Promise<void>;
  onSave: (jobId: string, payload: Partial<Video>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Partial<Video>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!job) return;
    setDraft({
      video_url: job.video_url,
      content: job.content,
      source_language: job.source_language,
      target_language: job.target_language,
      voice: job.voice,
      voice_rate: job.voice_rate || "+0%",
      platform: job.platform,
      publish_date: job.publish_date,
      publish_time: job.publish_time,
    });
  }, [job]);

  if (!job) return null;
  const href = outputUrl(job.output_url);

  async function handleSave() {
    if (!job) return;
    setSaving(true);
    try {
      await onSave(job.id, draft);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l border-[var(--outline)] bg-[var(--surface)] shadow-2xl">
      <div className="flex items-start justify-between border-b border-[var(--outline)] p-5">
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-2">
            <StatusBadge status={job.status} />
            <span className="text-xs text-[var(--muted)]">{job.progress}%</span>
          </div>
          <h2 className="truncate font-display text-xl font-bold">{job.video_url}</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">{job.current_step}</p>
        </div>
        <button className="rounded-md p-2 text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <div className="mb-6">
          <ProgressBar value={job.progress} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["source_language", "Source"],
            ["target_language", "Target"],
            ["platform", "Platform"],
            ["publish_date", "Publish date"],
            ["publish_time", "Publish time"],
          ].map(([field, label]) => (
            <label key={field} className="rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-3">
              <span className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">{label}</span>
              <input
                className="mt-2 h-9 w-full rounded-md border border-[var(--outline)] bg-[var(--background)] px-2 text-sm font-semibold outline-none focus:border-[var(--primary-strong)]"
                value={(draft[field as keyof Video] as string | null | undefined) ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, [field]: event.target.value }))}
              />
            </label>
          ))}
          <label className="rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-3">
            <span className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Voice</span>
            <select
              className="mt-2 h-9 w-full rounded-md border border-[var(--outline)] bg-[var(--background)] px-2 text-sm font-semibold outline-none focus:border-[var(--primary-strong)]"
              value={(draft.voice as string | null | undefined) || "auto"}
              onChange={(event) => setDraft((current) => ({ ...current, voice: event.target.value }))}
            >
              {VOICE_PROFILES.map((voice) => (
                <option key={voice.id} value={voice.id}>
                  {voice.name} · {voice.locale}
                </option>
              ))}
            </select>
          </label>
          <label className="rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-3">
            <span className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Voice speed</span>
            <select
              className="mt-2 h-9 w-full rounded-md border border-[var(--outline)] bg-[var(--background)] px-2 text-sm font-semibold outline-none focus:border-[var(--primary-strong)]"
              value={(draft.voice_rate as string | null | undefined) || "+0%"}
              onChange={(event) => setDraft((current) => ({ ...current, voice_rate: event.target.value }))}
            >
              {VOICE_RATE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-4">
          <label className="block text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Subtitle Brief</label>
          <textarea
            className="mt-2 min-h-32 w-full resize-y rounded-md border border-[var(--outline)] bg-[var(--background)] p-3 text-sm leading-6 text-[var(--text)] outline-none placeholder:text-[var(--muted-2)] focus:border-[var(--primary-strong)]"
            value={draft.content ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder="Nhập brief để LLM generate subtitle nếu video không có subtitle sẵn..."
          />
          <p className="mt-2 text-xs text-[var(--muted)]">Voice được tạo từ subtitle. Hệ thống ưu tiên extract subtitle từ video; ô này chỉ dùng làm brief cho LLM khi cần generate subtitle.</p>
        </div>

        <div className="mt-5 rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-4">
          <label className="block text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Video URL</label>
          <input
            className="mt-2 h-10 w-full rounded-md border border-[var(--outline)] bg-[var(--background)] px-3 font-mono text-xs outline-none focus:border-[var(--primary-strong)]"
            value={draft.video_url ?? ""}
            onChange={(event) => setDraft((current) => ({ ...current, video_url: event.target.value }))}
          />
        </div>

        {job.error_message ? (
          <div className="mt-5 rounded-lg border border-red-900 bg-red-950/30 p-4 text-sm text-red-100">
            <p className="mb-1 font-bold">Error</p>
            {job.error_message}
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-[var(--outline)] bg-black/30 p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.08em] text-[var(--muted)]">Processing logs</p>
            {href ? (
              <a className="text-sm font-semibold text-[var(--primary)] hover:underline" href={href} target="_blank" rel="noreferrer">
                Open output
              </a>
            ) : null}
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-[var(--muted)]">{job.logs || "No logs yet."}</pre>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-[var(--outline)] p-5">
        <button className="flex items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
          Save
        </button>
        <button className="rounded-lg border border-[var(--outline)] px-4 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)]" onClick={() => onRetry(job.id)}>
          Retry
        </button>
        {href ? (
          <a className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary-ink)]" href={href} target="_blank" rel="noreferrer">
            Download Output
          </a>
        ) : null}
      </div>
    </aside>
  );
}

export default function QueuePage() {
  const { t } = useLanguage();
  const [videos, setVideos] = useState<Video[]>([]);
  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkText, setBulkText] = useState("");
  const [bulkContent, setBulkContent] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedJob, setSelectedJob] = useState<Video | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const next = await getVideos();
    setVideos(next);
    setSelectedJob((current) => (current ? next.find((item) => item.id === current.id) ?? current : current));
  }

  useEffect(() => {
    refresh()
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load queue."))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (!videos.some((video) => ACTIVE_STATUSES.includes(video.status))) return;
    const interval = window.setInterval(() => {
      void refresh().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to refresh queue."));
    }, 2000);
    return () => window.clearInterval(interval);
  }, [videos]);

  const selectedIds = useMemo(() => Object.keys(rowSelection).filter((id) => rowSelection[id]), [rowSelection]);

  async function handleBulkImport() {
    const urls = bulkText
      .split(/\r?\n|,|\t/)
      .map((url) => url.trim())
      .filter(Boolean);
    if (!urls.length) return;
    try {
      const created = bulkContent.trim()
        ? await Promise.all(urls.map((video_url) => createJob({ video_url, content: bulkContent.trim() })))
        : await bulkCreateVideos(urls);
      setVideos((current) => [...created, ...current]);
      setBulkText("");
      setBulkContent("");
      setShowBulkImport(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create jobs.");
    }
  }

  async function handlePatch(videoId: string, payload: Partial<Video>) {
    try {
      const updated = await patchVideo(videoId, payload);
      setVideos((current) => current.map((video) => (video.id === videoId ? updated : video)));
      setSelectedJob((current) => (current?.id === videoId ? updated : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save row.");
    }
  }

  async function handleRunSelected() {
    if (!selectedIds.length) return;
    setIsRunning(true);
    setError(null);
    try {
      const updated = await runVideos(selectedIds);
      setVideos((current) => current.map((video) => updated.find((item) => item.id === video.id) ?? video));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to run selected rows.");
    } finally {
      setIsRunning(false);
    }
  }

  async function handleRetry(jobId: string) {
    setError(null);
    try {
      const updated = await retryJob(jobId);
      setVideos((current) => current.map((video) => (video.id === jobId ? updated : video)));
      setSelectedJob(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to retry job.");
    }
  }

  async function handleRetrySelected() {
    await Promise.all(selectedIds.map((id) => handleRetry(id)));
  }

  async function handleScheduleSelected() {
    if (!selectedIds.length) return;
    const scheduled = await scheduleVideos(selectedIds);
    setVideos((current) => current.map((video) => scheduled.find((item) => item.id === video.id) ?? video));
  }

  async function handleDeleteSelected() {
    if (!selectedIds.length) return;
    const confirmed = window.confirm(`${t.queue.deleteRowsConfirm} (${selectedIds.length})`);
    if (!confirmed) return;

    setError(null);
    try {
      await Promise.all(selectedIds.map((id) => deleteJob(id)));
      setVideos((current) => current.filter((video) => !selectedIds.includes(video.id)));
      setSelectedJob((current) => (current && selectedIds.includes(current.id) ? null : current));
      setRowSelection({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete selected rows.");
    }
  }

  return (
    <AppShell active="Queue Video" searchPlaceholder={t.search.queue}>
      <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden">
        <section className="flex min-h-20 flex-col gap-4 border-b border-[var(--outline)] bg-[var(--surface)] px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold leading-tight">{t.queue.title}</h1>
              <p className="text-sm text-[var(--muted)]">{t.queue.description}</p>
            </div>
            <div className="hidden h-8 w-px bg-[var(--outline)] md:block" />
            <button className="hidden items-center gap-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-high)] px-3 py-2 text-sm font-semibold md:flex" onClick={() => setShowBulkImport(true)}>
              <Plus size={16} />
              {t.queue.newRows}
            </button>
            <button className="hidden items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)] md:flex" onClick={() => setShowBulkImport(true)}>
              <Upload size={16} />
              {t.queue.bulkImport}
            </button>
          </div>

          <div className="flex flex-1 flex-wrap items-center justify-end gap-3">
            <div className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] px-3 xl:max-w-sm">
              <Search size={18} className="text-[var(--muted)]" />
              <input className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-2)]" placeholder={t.search.queue} value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)]">
              <Filter size={16} />
              {t.common.filter}
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)]">
              <Columns3 size={16} />
              {t.common.view}
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)] disabled:cursor-not-allowed disabled:opacity-50" onClick={handleRetrySelected} disabled={!selectedIds.length}>
              <RotateCcw size={16} />
              Retry
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-red-900/70 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-950/40 disabled:cursor-not-allowed disabled:opacity-50" onClick={handleDeleteSelected} disabled={!selectedIds.length}>
              <Trash2 size={16} />
              {t.queue.deleteRows}
            </button>
            <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)]" onClick={handleScheduleSelected} disabled={!selectedIds.length}>
              <CalendarClock size={16} />
              {t.queue.schedule}
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-[var(--primary-ink)] disabled:cursor-not-allowed disabled:opacity-50" onClick={handleRunSelected} disabled={!selectedIds.length || isRunning}>
              {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
              {t.queue.runSelected}
            </button>
          </div>
        </section>

        {error ? <div className="border-b border-red-900 bg-red-950/40 px-5 py-3 text-sm text-red-200">{error}</div> : null}

        {showBulkImport ? (
          <section className="border-b border-[var(--outline)] bg-[var(--surface-low)] p-5">
            <div className="mx-auto max-w-4xl">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">{t.queue.pasteUrls}</h2>
                  <p className="text-sm text-[var(--muted)]">{t.queue.pasteDescription}</p>
                </div>
                <button className="text-sm text-[var(--muted)] hover:text-[var(--text)]" onClick={() => setShowBulkImport(false)}>
                  {t.common.cancel}
                </button>
              </div>
              <textarea className="h-32 w-full resize-none rounded-lg border border-[var(--outline)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--primary-strong)]" value={bulkText} onChange={(event) => setBulkText(event.target.value)} placeholder="https://youtube.com/watch?v=...&#10;https://vimeo.com/..." />
              <textarea className="mt-3 h-24 w-full resize-none rounded-lg border border-[var(--outline)] bg-[var(--background)] p-3 text-sm outline-none focus:border-[var(--primary-strong)]" value={bulkContent} onChange={(event) => setBulkContent(event.target.value)} placeholder="Subtitle brief cho LLM nếu video không có subtitle sẵn..." />
              <div className="mt-3 flex justify-end">
                <button className="rounded-lg bg-[var(--primary-strong)] px-4 py-2 text-sm font-bold text-white" onClick={handleBulkImport}>
                  {t.queue.addToQueue}
                </button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center text-[var(--muted)]">
              <Loader2 className="mr-2 animate-spin" size={18} />
              {t.queue.loading}
            </div>
          ) : (
            <QueueGrid videos={videos} search={search} sorting={sorting} rowSelection={rowSelection} onSortingChange={setSorting} onRowSelectionChange={setRowSelection} onPatch={handlePatch} onOpenDetails={setSelectedJob} />
          )}
        </section>

        <JobDetailDrawer job={selectedJob} onClose={() => setSelectedJob(null)} onRetry={handleRetry} onSave={handlePatch} />
      </div>
    </AppShell>
  );
}
