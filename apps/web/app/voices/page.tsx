"use client";

import { Mic2, Play, Plus, Radio, SlidersHorizontal, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { Panel, PageHeader } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { VOICE_PROFILES } from "@/lib/voices";

export default function VoicesPage() {
  const { t } = useLanguage();
  return (
    <AppShell active="Voices" searchPlaceholder={t.search.voices}>
      <div className="mx-auto max-w-[1400px] space-y-8 p-6 xl:p-10">
        <PageHeader
          title={t.voices.title}
          description={t.voices.description}
          actions={
            <>
              <button className="flex items-center gap-2 rounded-lg border border-[var(--outline)] px-4 py-3 text-sm font-bold text-[var(--muted)]">
                <SlidersHorizontal size={16} />
                {t.voices.voiceFilters}
              </button>
              <button className="flex items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 py-3 text-sm font-bold text-white">
                <Plus size={16} />
                {t.voices.newVoice}
              </button>
            </>
          }
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="grid gap-4 md:grid-cols-2">
            {VOICE_PROFILES.map((voice) => (
              <Panel key={voice.id} className="p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--primary-strong)] font-display font-bold text-white">
                      {voice.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="font-display text-xl font-bold">{voice.name}</h2>
                      <p className="text-sm text-[var(--muted)]">
                        {voice.type} · {voice.locale}
                      </p>
                    </div>
                  </div>
                  <button className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-high)] text-[var(--primary)]">
                    <Play size={18} />
                  </button>
                </div>
                <p className="text-sm text-[var(--muted)]">{voice.description}</p>
                <div className="mt-4 flex items-center justify-between rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] px-3 py-2 text-xs">
                  <span className="font-semibold text-[var(--muted)]">Voice ID</span>
                  <span className="font-mono text-[var(--text)]">{voice.id}</span>
                </div>
                <div className="mt-5 flex h-12 items-end gap-1">
                  {Array.from({ length: 32 }).map((_, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-t bg-[var(--primary)]/40"
                      style={{ height: `${12 + ((index * 13) % 32)}px` }}
                    />
                  ))}
                </div>
              </Panel>
            ))}
          </div>

          <Panel className="p-6">
            <div className="mb-6 flex items-center gap-3 text-[var(--primary)]">
              <Sparkles size={20} />
              <h2 className="font-display text-xl font-bold">{t.voices.voiceStudio}</h2>
            </div>
            <div className="space-y-5">
              <div className="rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-4">
                <div className="flex items-center gap-3">
                  <Mic2 size={18} />
                  <span className="font-bold">{t.voices.cloneReady}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{t.voices.cloneDescription}</p>
              </div>
              <div className="rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] p-4">
                <div className="flex items-center gap-3">
                  <Radio size={18} />
                  <span className="font-bold">{t.voices.previewWorkflow}</span>
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{t.voices.previewDescription}</p>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
