import { CheckCircle2, Clock3, Loader2, XCircle } from "lucide-react";
import clsx from "clsx";

import type { JobStep, StepStatus } from "@/lib/types";
import { ProgressBar } from "../progress-bar";

const statusIcon: Record<StepStatus, React.ReactNode> = {
  completed: <CheckCircle2 size={16} />,
  processing: <Loader2 size={16} className="animate-spin" />,
  pending: <Clock3 size={16} />,
  failed: <XCircle size={16} />,
};

const statusClass: Record<StepStatus, string> = {
  completed: "border-emerald-900 bg-emerald-950/30 text-emerald-200",
  processing: "border-[var(--primary-strong)] bg-[var(--primary-strong)]/20 text-[var(--primary)]",
  pending: "border-[var(--outline)] bg-[var(--surface-high)] text-[var(--muted)]",
  failed: "border-red-900 bg-red-950/30 text-red-200",
};

export function PipelineCard({ step, index }: { step: JobStep; index: number }) {
  return (
    <article
      className={clsx(
        "relative rounded-xl border p-5 transition",
        step.status === "processing"
          ? "border-[var(--primary)] bg-[var(--surface-high)]"
          : "border-[var(--outline)] bg-[var(--surface-container)]",
      )}
    >
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-highest)] font-display text-sm font-bold text-[var(--primary)]">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-base font-semibold">{step.name}</h3>
            <p className="mt-1 truncate text-sm text-[var(--muted)]">{step.logs || "Waiting for the previous step to finish."}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <div className={clsx("flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.06em]", statusClass[step.status])}>
            {statusIcon[step.status]}
            {step.status.replace("_", " ")}
          </div>
          <div className="w-20 text-right text-xs text-[var(--muted)]">{step.runtime_seconds ? `${step.runtime_seconds}s` : "Pending"}</div>
        </div>
      </div>
      <div className="mt-4">
        <ProgressBar value={step.progress} />
      </div>
    </article>
  );
}
