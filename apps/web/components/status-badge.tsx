import clsx from "clsx";

import type { VideoStatus } from "@/lib/types";
import { useLanguage } from "@/lib/i18n";

const tones: Record<VideoStatus, string> = {
  draft: "border-[var(--outline)] bg-[var(--surface-high)] text-[var(--muted)]",
  queued: "border-[var(--outline)] bg-[var(--surface-container)] text-[var(--text)]",
  downloading: "border-blue-800 bg-blue-950/50 text-blue-200",
  transcribing: "border-cyan-800 bg-cyan-950/40 text-cyan-200",
  translating: "border-violet-800 bg-violet-950/40 text-violet-200",
  tts_generating: "border-fuchsia-800 bg-fuchsia-950/40 text-fuchsia-200",
  rendering: "border-amber-800 bg-amber-950/40 text-amber-200",
  ready: "border-emerald-800 bg-emerald-950/40 text-emerald-200",
  failed: "border-red-800 bg-red-950/40 text-red-200",
};

const fallbackLabels: Record<VideoStatus, string> = {
  draft: "Draft",
  queued: "Queued",
  downloading: "Downloading",
  transcribing: "Transcribing",
  translating: "Translating",
  tts_generating: "Voice",
  rendering: "Rendering",
  ready: "Ready",
  failed: "Failed",
};

export function StatusBadge({ status }: { status: VideoStatus }) {
  const { t } = useLanguage();
  const translated = t.status[status as keyof typeof t.status];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
        tones[status],
      )}
    >
      {translated ?? fallbackLabels[status]}
    </span>
  );
}
