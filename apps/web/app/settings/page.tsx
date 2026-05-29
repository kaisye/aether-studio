"use client";

import { Bell, Check, Database, Globe2, KeyRound, Mic2, Shield, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel, PageHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { voiceLabel } from "@/lib/voices";

const settings: Array<{ label: string; value: string; icon: LucideIcon }> = [
  { label: "Workspace", value: "Aether Studio", icon: UserRound },
  { label: "Default Language", value: "English to Vietnamese", icon: Globe2 },
  { label: "Default Voice", value: voiceLabel("auto"), icon: Mic2 },
  { label: "Storage Region", value: "S3-compatible local", icon: Database },
  { label: "Notifications", value: "Review and publish alerts", icon: Bell },
  { label: "Security", value: "Session-based access", icon: Shield },
  { label: "API Access", value: "Provider adapters pending", icon: KeyRound },
];

export default function SettingsPage() {
  const { t } = useLanguage();
  return (
    <AppShell active="Settings" searchPlaceholder={t.search.settings}>
      <div className="mx-auto max-w-[1100px] space-y-8 p-6 xl:p-10">
        <PageHeader title={t.settings.title} description={t.settings.description} />

        <Panel className="overflow-hidden">
          <div className="border-b border-[var(--outline)] p-5">
            <h2 className="font-display text-2xl font-bold">{t.settings.workspaceDefaults}</h2>
          </div>
          <div className="divide-y divide-[var(--outline)]">
            {settings.map(({ label, value, icon: Icon }) => (
              <div key={label} className="flex items-center justify-between gap-5 p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[var(--surface-high)] text-[var(--primary)]"><Icon size={19} /></div>
                  <div>
                    <div className="font-display font-bold">{label}</div>
                    <div className="mt-1 text-sm text-[var(--muted)]">{value}</div>
                  </div>
                </div>
                <button className="rounded-lg border border-[var(--outline)] px-4 py-2 text-sm font-bold text-[var(--muted)] hover:bg-[var(--surface-high)]">{t.common.edit}</button>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="mb-5 flex items-center gap-3 text-[var(--success)]">
            <Check size={20} />
            <h2 className="font-display text-xl font-bold">{t.settings.runtimeReady}</h2>
          </div>
          <p className="text-sm leading-6 text-[var(--muted)]">{t.settings.runtimeDescription}</p>
        </Panel>
      </div>
    </AppShell>
  );
}
