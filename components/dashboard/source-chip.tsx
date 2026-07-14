"use client";

import { AlertTriangle, Cloud, CloudOff, Database } from "lucide-react";
import type { ApiMeta } from "@/lib/types";
import { cn } from "@/lib/utils";

interface SourceChipProps {
  meta: ApiMeta | null;
  className?: string;
}

function pickFreshness(iso: string | undefined): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  const s = Math.floor(ms / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function SourceChip({ meta, className }: SourceChipProps) {
  if (!meta) return null;

  // Post-Step-4, ApiMeta.source can be:
  //   "local"             — bundled JSON fallback (no env keys)
  //   "<formId>"          — live KoboToolbox for the active form,
  //                         e.g. "cordaidDemo", "Wework"
  //   "<formId>-fallback" — Kobo request failed, served fallback
  //
  // These predicates dispatch by suffix / exact-match so the legacy
  // "kobo" / "kobo-fallback" / "local" triple (and post-Step-4
  // per-form variants) all hit the same branch without per-form
  // hardcoding in this component.
  const isFallback =
    typeof meta.source === "string" && meta.source.endsWith("-fallback");
  const isLocal = meta.source === "local";

  let label: string;
  let title: string;
  let Icon: typeof Cloud = Database;
  let tone: "default" | "live" | "warning" = "default";

  if (!isFallback && !isLocal) {
    Icon = Cloud;
    const fresh = pickFreshness(meta.fetchedAt);
    const truncatedNote =
      meta.truncated && meta.totalCount
        ? ` · first ${meta.count.toLocaleString()} of ${meta.totalCount.toLocaleString()}`
        : meta.truncated
          ? " · truncated to 50 000 rows"
          : "";
    label = `${meta.count.toLocaleString()} records · Kobo live${
      fresh ? ` · ${fresh}` : ""
    }${truncatedNote}`;
    title = meta.uid
      ? `Kobo asset · ${meta.uid}${meta.name ? ` (${meta.name})` : ""}`
      : "Live KoboToolbox feed";
    tone = "live";
  } else if (isFallback) {
    Icon = AlertTriangle;
    label = `${meta.count.toLocaleString()} records · Kobo error, using local JSON`;
    title = meta.error
      ? `Kobo pull failed · ${meta.error.slice(0, 240)}`
      : "Kobo pull failed; serving the bundled JSON fallback.";
    tone = "warning";
  } else {
    Icon = Database;
    label = `${meta.count.toLocaleString()} records · Local JSON`;
    title =
      "Using bundled data/feedback.json (no KOBO_API_TOKEN configured).";
    tone = "default";
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold",
        tone === "default" && "bg-white/15",
        tone === "live" &&
          (meta.truncated
            ? "bg-amber-400/30 ring-1 ring-amber-300/40"
            : "bg-emerald-400/30 ring-1 ring-emerald-300/40"),
        tone === "warning" && "bg-amber-400/30 ring-1 ring-amber-300/40",
        className
      )}
      title={title}
      aria-live="polite"
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </span>
  );
}
