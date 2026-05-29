"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  RowSelectionState,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowUpDown, Calendar, ExternalLink, FileText, Languages, Workflow } from "lucide-react";

import type { Video } from "@/lib/types";
import { outputUrl } from "@/lib/api";
import { VOICE_RATE_OPTIONS } from "@/lib/voice-rates";
import { VOICE_PROFILES } from "@/lib/voices";
import { ProgressBar } from "./progress-bar";
import { StatusBadge } from "./status-badge";

type EditableField =
  | "video_url"
  | "content"
  | "source_language"
  | "target_language"
  | "voice"
  | "voice_rate"
  | "platform"
  | "publish_date"
  | "publish_time";

function EditableCell({
  row,
  field,
  type = "text",
  placeholder,
  onPatch,
}: {
  row: Video;
  field: EditableField;
  type?: string;
  placeholder?: string;
  onPatch: (videoId: string, payload: Partial<Video>) => Promise<void> | void;
}) {
  const value = row[field] ?? "";
  return (
    <input
      key={`${row.id}-${field}-${value}`}
      type={type}
      defaultValue={value}
      placeholder={placeholder}
      className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--muted-2)] hover:border-[var(--outline)] hover:bg-[var(--surface-high)] focus:border-[var(--primary-strong)] focus:bg-[var(--surface-low)]"
      onBlur={(event) => {
        const next = event.currentTarget.value;
        if (next !== value) {
          void onPatch(row.id, { [field]: next || null } as Partial<Video>);
        }
      }}
    />
  );
}

function VoiceCell({
  row,
  onPatch,
}: {
  row: Video;
  onPatch: (videoId: string, payload: Partial<Video>) => Promise<void> | void;
}) {
  const value = row.voice || "auto";
  return (
    <select
      key={`${row.id}-voice-${value}`}
      defaultValue={value}
      className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--text)] outline-none hover:border-[var(--outline)] hover:bg-[var(--surface-high)] focus:border-[var(--primary-strong)] focus:bg-[var(--surface-low)]"
      onChange={(event) => {
        void onPatch(row.id, { voice: event.currentTarget.value });
      }}
    >
      {VOICE_PROFILES.map((voice) => (
        <option key={voice.id} value={voice.id}>
          {voice.name} · {voice.locale}
        </option>
      ))}
    </select>
  );
}

function VoiceRateCell({
  row,
  onPatch,
}: {
  row: Video;
  onPatch: (videoId: string, payload: Partial<Video>) => Promise<void> | void;
}) {
  const value = row.voice_rate || "+0%";
  return (
    <select
      key={`${row.id}-voice-rate-${value}`}
      defaultValue={value}
      className="h-9 w-full min-w-0 rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--text)] outline-none hover:border-[var(--outline)] hover:bg-[var(--surface-high)] focus:border-[var(--primary-strong)] focus:bg-[var(--surface-low)]"
      onChange={(event) => {
        void onPatch(row.id, { voice_rate: event.currentTarget.value });
      }}
    >
      {VOICE_RATE_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function QueueGrid({
  videos,
  search,
  sorting,
  rowSelection,
  onSortingChange,
  onRowSelectionChange,
  onPatch,
  onOpenDetails,
}: {
  videos: Video[];
  search: string;
  sorting: SortingState;
  rowSelection: RowSelectionState;
  onSortingChange: (sorting: SortingState) => void;
  onRowSelectionChange: (selection: RowSelectionState) => void;
  onPatch: (videoId: string, payload: Partial<Video>) => Promise<void> | void;
  onOpenDetails: (video: Video) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<Video>[]>(
    () => [
      {
        id: "select",
        size: 48,
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
            className="h-4 w-4 rounded border-[var(--outline)] bg-[var(--surface-low)] accent-[var(--primary-strong)]"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="h-4 w-4 rounded border-[var(--outline)] bg-[var(--surface-low)] accent-[var(--primary-strong)]"
          />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 150,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "video_url",
        header: "Video URL",
        size: 280,
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2">
            <EditableCell row={row.original} field="video_url" placeholder="https://..." onPatch={onPatch} />
          </div>
        ),
      },
      {
        id: "flow",
        header: "Project Flow",
        size: 150,
        cell: ({ row }) => (
          <Link
            href={`/workspace/${row.original.id}`}
            className="flex items-center gap-2 rounded-md border border-[var(--outline)] bg-[var(--surface-low)] px-3 py-2 text-sm font-semibold text-[var(--muted)] hover:border-[var(--primary-strong)] hover:text-[var(--primary)]"
          >
            <Workflow size={15} />
            Open Flow
          </Link>
        ),
      },
      {
        accessorKey: "content",
        header: "Content / Caption",
        size: 340,
        cell: ({ row }) => <EditableCell row={row.original} field="content" placeholder="Caption or publishing copy..." onPatch={onPatch} />,
      },
      {
        id: "language",
        header: "Language",
        size: 220,
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2">
            <Languages size={15} className="shrink-0 text-[var(--muted)]" />
            <EditableCell row={row.original} field="source_language" onPatch={onPatch} />
            <span className="text-[var(--muted-2)]">to</span>
            <EditableCell row={row.original} field="target_language" onPatch={onPatch} />
          </div>
        ),
      },
      {
        accessorKey: "voice",
        header: "Voice",
        size: 230,
        cell: ({ row }) => <VoiceCell row={row.original} onPatch={onPatch} />,
      },
      {
        accessorKey: "voice_rate",
        header: "Voice Speed",
        size: 150,
        cell: ({ row }) => <VoiceRateCell row={row.original} onPatch={onPatch} />,
      },
      {
        accessorKey: "platform",
        header: "Platform",
        size: 150,
        cell: ({ row }) => <EditableCell row={row.original} field="platform" onPatch={onPatch} />,
      },
      {
        id: "publish",
        header: "Publish",
        size: 250,
        cell: ({ row }) => (
          <div className="flex w-full items-center gap-2">
            <Calendar size={15} className="shrink-0 text-[var(--muted)]" />
            <EditableCell row={row.original} field="publish_date" type="date" onPatch={onPatch} />
            <EditableCell row={row.original} field="publish_time" type="time" onPatch={onPatch} />
          </div>
        ),
      },
      {
        accessorKey: "current_step",
        header: "Current Step",
        size: 210,
        cell: ({ row }) => <span className="truncate text-sm text-[var(--muted)]">{row.original.current_step}</span>,
      },
      {
        accessorKey: "progress",
        header: "Progress",
        size: 160,
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <ProgressBar value={row.original.progress} />
            <span className="w-9 text-right text-xs font-semibold text-[var(--muted)]">{row.original.progress}%</span>
          </div>
        ),
      },
      {
        accessorKey: "output_url",
        header: "Output",
        size: 150,
        cell: ({ row }) => {
          const href = outputUrl(row.original.output_url);
          return href ? (
            <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm font-semibold text-[var(--primary)] hover:underline">
              <ExternalLink size={14} />
              Open
            </a>
          ) : (
            <span className="text-sm text-[var(--muted-2)]">Not ready</span>
          );
        },
      },
      {
        accessorKey: "error_message",
        header: "Error",
        size: 220,
        cell: ({ row }) => <span className="truncate text-sm text-red-200">{row.original.error_message ?? ""}</span>,
      },
      {
        accessorKey: "updated_at",
        header: "Last Updated",
        size: 180,
        cell: ({ row }) => <span className="text-xs text-[var(--muted)]">{new Date(row.original.updated_at).toLocaleString()}</span>,
      },
      {
        id: "details",
        header: "Details",
        size: 110,
        cell: ({ row }) => (
          <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-[var(--muted)] hover:bg-[var(--surface-high)] hover:text-[var(--text)]" onClick={() => onOpenDetails(row.original)}>
            <FileText size={15} />
            Logs
          </button>
        ),
      },
    ],
    [onOpenDetails, onPatch],
  );

  const table = useReactTable({
    data: videos,
    columns,
    state: {
      globalFilter: search,
      sorting,
      rowSelection,
    },
    getRowId: (row) => row.id,
    enableRowSelection: true,
    onSortingChange: (updater) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      onSortingChange(next);
    },
    onRowSelectionChange: (updater) => {
      const next = typeof updater === "function" ? updater(rowSelection) : updater;
      onRowSelectionChange(next);
    },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 10,
  });

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div className="min-w-[2908px]">
        <div className="sticky top-0 z-20 grid h-12 border-b border-[var(--outline)] bg-[var(--surface)]" style={{ gridTemplateColumns: columns.map((column) => `${column.size ?? 160}px`).join(" ") }}>
          {table.getHeaderGroups()[0].headers.map((header) => (
            <div key={header.id} className="flex items-center border-r border-[var(--outline)] px-4 text-xs font-bold uppercase tracking-[0.05em] text-[var(--muted)]">
              {header.column.getCanSort() ? (
                <button className="flex items-center gap-2" onClick={header.column.getToggleSortingHandler()}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  <ArrowUpDown size={13} />
                </button>
              ) : (
                flexRender(header.column.columnDef.header, header.getContext())
              )}
            </div>
          ))}
        </div>

        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: "relative" }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const row = rows[virtualRow.index];
            return (
              <div
                key={row.id}
                className="absolute left-0 grid border-b border-[var(--outline)] bg-[var(--background)] transition hover:bg-[var(--surface-low)]"
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                  gridTemplateColumns: columns.map((column) => `${column.size ?? 160}px`).join(" "),
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div key={cell.id} className="flex min-w-0 items-center border-r border-[var(--outline)] px-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
