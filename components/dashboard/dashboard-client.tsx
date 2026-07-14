"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Charts } from "@/components/dashboard/charts";
import { DashboardHeader } from "@/components/dashboard/header";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FeedbackTable } from "@/components/dashboard/feedback-table";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { applyFilters, computeKpis, downloadCsv, toCsv } from "@/lib/filters";
import type { ApiMeta, DynamicRecord, FeedbackRecord, Filters } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getForm } from "@/lib/dashboards";

const DATE_BOUNDS_KEY = "cordaid-date-bounds";

function withDefaultDates(filters: Filters, bounds: { min: string; max: string }) {
  return {
    ...filters,
    startDate: bounds.min,
    endDate: bounds.max,
  };
}

function pickBounds(
  records: DynamicRecord[],
  column: string,
): { min: string; max: string } {
  const dates = records
    .map((r) => r[column])
    .filter((d): d is string => typeof d === "string" && !!d)
    .sort();
  return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
}

function emptyFilters(): Filters {
  return {
    project: "",
    district: "",
    subcounty: "",
    category: "",
    status: "",
    gender: "",
    channel: "",
    thematic: "",
    referral: "",
    emergency: "",
    search: "",
    startDate: "",
    endDate: "",
  };
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // URL is the source of truth for the active form (locked plan). The
  // ?form= value passes through getForm() which falls back to
  // DEFAULT_FORM for unknown ids so a malformed URL never breaks the
  // dashboard layout.
  const form = getForm(searchParams.get("form"));
  const formKey = form.id;

  const [records, setRecords] = useState<DynamicRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filter state retains the legacy `Filters` shape today so the
  // existing lib/filters.ts helpers keep compiling — Step 7 reformats
  // it to `Record<string, string>` keyed by FilterDef.key. The state
  // shape is unchanged at this step.
  const [filters, setFilters] = useState<Filters | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DynamicRecord | null>(null);

  // Reactive document title per D9. SSR renders without this effect
  // (returns the static title in app/layout.tsx); the effect flips the
  // tab title the moment React mounts and again on every form switch.
  useEffect(() => {
    document.title = `${form.label} · Feedback Dashboard`;
  }, [form.label]);

  // Re-fetch on formKey/dateColumn change. The dependency on
  // form.dateColumn ensures a date-column rebuild re-triggers the
  // hooks even within the same form. The cancel flag prevents a stale
  // fetch's resolve from clobbering a fresh records array when the
  // user switches rapidly between forms.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRecords([]);
    setFilters(null);
    setSelected(null);
    async function load() {
      try {
        const res = await fetch(
          `/api/feedback?form=${encodeURIComponent(formKey)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as {
          records: DynamicRecord[];
          meta?: ApiMeta;
        };
        if (cancelled) return;
        setRecords(data.records);
        setMeta(data.meta ?? null);
        const bounds = pickBounds(data.records, form.dateColumn);
        try {
          window.localStorage.setItem(
            `${DATE_BOUNDS_KEY}-${formKey}`,
            JSON.stringify(bounds),
          );
        } catch {
          // ignore storage errors (private mode)
        }
        setFilters(withDefaultDates(emptyFilters(), bounds));
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [formKey, form.dateColumn]);

  // TODAY bridge: lib/filters.ts + downstream components still consume
  // FeedbackRecord[] (Step 7 re-ports them to FormConfig + DynamicRecord).
  // These `as unknown as FeedbackRecord[]` casts allow the existing
  // helpers to compile against the open-dict DynamicRecord[] that
  // lib/kobo.ts now emits. They are expected-runtime-safe because every
  // Cordaid record resolves to the same PascalCase-shape JSON it did
  // pre-refactor (verified at runtime in Step 13's no-regression check);
  // WeWork routes through the same bridge while Step 7 reformats the
  // helper + consumer set to consume DynamicRecord[] directly.
  const filtered = useMemo(() => {
    if (!filters) return [] as unknown as FeedbackRecord[];
    return applyFilters(
      records as unknown as FeedbackRecord[],
      filters,
    );
  }, [records, filters]);

  const kpis = useMemo(
    () => computeKpis(filtered as unknown as FeedbackRecord[]),
    [filtered],
  );

  function updateFilters(partial: Partial<Filters>) {
    setFilters((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function resetFilters() {
    if (!records.length) return;
    const bounds = pickBounds(records, form.dateColumn);
    setFilters(withDefaultDates(emptyFilters(), bounds));
  }

  function exportCsv() {
    if (!filtered.length) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `${formKey}-feedback-${date}.csv`,
      toCsv(filtered as unknown as FeedbackRecord[]),
    );
  }

  // switchForm strips ALL filter params on the URL per F5b — every
  // pick hop lands on `?form=<next>` with no other query, so the URL
  // is bookmarkable and reload-friendly. router.replace avoids pushing
  // history entries; React reconciles without remount because the URL
  // mutation is the only state change.
  const switchForm = useCallback(
    (next: string) => {
      router.replace(`${pathname}?form=${encodeURIComponent(next)}`);
    },
    [pathname, router],
  );

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-cordaid-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading {form.label} dataset…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-12">
        <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5 max-w-xl mx-auto">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h2 className="font-semibold text-destructive">
              Could not load the {form.label} dataset
            </h2>
            <p className="text-sm text-cordaid-muted mt-1 break-all">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!filters) return null;

  return (
    <>
      <DashboardHeader records={records} meta={meta} form={form} />
      <main className="container py-6 space-y-6">
        <FilterBar
          filters={filters}
          records={records as unknown as FeedbackRecord[]}
          onChange={updateFilters}
          onReset={resetFilters}
          onExport={exportCsv}
        />

        <KpiCards kpis={kpis} />

        <Charts records={filtered} />

        <FeedbackTable
          records={filtered as unknown as FeedbackRecord[]}
          onSelect={(record) => {
            setSelected(record as unknown as DynamicRecord);
            setOpen(true);
          }}
        />

        <footer className="text-xs text-cordaid-muted pt-2">
          Built by{" "}
          <a
            href="https://josheleazar.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-cordaid-dark transition-colors"
          >
            Josheleazar
          </a>
        </footer>
      </main>

      <DetailDrawer
        record={selected as unknown as FeedbackRecord | null}
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            window.setTimeout(() => setSelected(null), 250);
          }
        }}
      />
    </>
  );
}
