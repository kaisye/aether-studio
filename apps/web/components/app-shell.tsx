"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CircleHelp,
  Clapperboard,
  FileText,
  Folder,
  LayoutDashboard,
  Mic2,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserCircle,
  Video,
} from "lucide-react";
import clsx from "clsx";
import { useLanguage } from "@/lib/i18n";

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Queue Video", href: "/queue", icon: Clapperboard },
  { label: "Projects", href: "/projects", icon: Folder },
  { label: "Assets", href: "/assets", icon: Video },
  { label: "Voices", href: "/voices", icon: Mic2 },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function AppShell({
  children,
  active = "Projects",
  searchPlaceholder = "Search workspace...",
}: {
  children: React.ReactNode;
  active?: string;
  searchPlaceholder?: string;
}) {
  const pathname = usePathname();
  const { language, toggleLanguage, t } = useLanguage();
  const navLabels: Record<string, string> = {
    Dashboard: t.nav.dashboard,
    "Queue Video": t.nav.queueVideo,
    Projects: t.nav.projects,
    Assets: t.nav.assets,
    Voices: t.nav.voices,
    Settings: t.nav.settings,
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--text)]">
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[280px] flex-col border-r border-[var(--outline)] bg-[var(--surface)] p-6 lg:flex">
        <Link href="/dashboard" className="mb-10 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--primary-strong)] text-white">
            <Sparkles size={20} />
          </div>
          <div>
            <div className="font-display text-xl font-bold leading-tight">Aether Studio</div>
            <div className="text-xs font-medium text-[var(--muted)]">AI Media Engine</div>
          </div>
        </Link>

        <button className="mb-8 flex h-12 items-center justify-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 text-sm font-semibold text-white transition hover:brightness-110">
          <Plus size={18} />
          {t.nav.newProject}
        </button>

        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              active === item.label ||
              pathname === item.href ||
              (item.label === "Queue Video" && pathname.startsWith("/queue")) ||
              (item.label === "Projects" && (pathname.startsWith("/workspace") || pathname.startsWith("/studio")));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={clsx(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold transition",
                  isActive
                    ? "bg-[#404758] text-[#dce2f7]"
                    : "text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]",
                )}
              >
                <Icon size={20} />
                {navLabels[item.label] ?? item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--outline)] pt-6">
          <a className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]">
            <FileText size={20} />
            {t.nav.docs}
          </a>
          <a className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-[var(--muted)] hover:text-[var(--text)]">
            <CircleHelp size={20} />
            {t.nav.support}
          </a>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[var(--outline)] bg-[var(--surface)] px-4 lg:left-[280px] lg:px-8">
        <div className="flex min-w-0 items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2 lg:hidden">
            <Sparkles size={20} className="text-[var(--primary)]" />
            <span className="font-display font-bold">Aether</span>
          </Link>
          <div className="hidden h-10 w-[320px] items-center gap-3 rounded-lg border border-[var(--outline)] bg-[var(--surface-low)] px-3 md:flex">
            <Search size={18} className="text-[var(--muted)]" />
            <input className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted-2)]" placeholder={searchPlaceholder} />
          </div>
          <nav className="hidden items-center gap-6 xl:flex">
            {[
              t.nav.timeline,
              t.nav.review,
              t.nav.collaborate,
              t.nav.export,
            ].map((item) => (
              <a key={item} className="text-sm font-semibold text-[var(--muted)] transition hover:text-[var(--primary)]">
                {item}
              </a>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <button className="hidden items-center gap-2 rounded-lg bg-[var(--primary-strong)] px-4 py-2 text-sm font-semibold text-white md:flex">
            <Clapperboard size={16} />
            {t.nav.publish}
          </button>
          <button
            className="rounded-lg border border-[var(--outline)] px-3 py-2 text-xs font-bold text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]"
            onClick={toggleLanguage}
            aria-label="Toggle language"
          >
            {language === "en" ? "VI" : "EN"}
          </button>
          <button className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]">
            <Bell size={19} />
          </button>
          <button className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]">
            <UserCircle size={21} />
          </button>
        </div>
      </header>

      <main className="min-h-screen pt-16 lg:pl-[280px]">{children}</main>
    </div>
  );
}
