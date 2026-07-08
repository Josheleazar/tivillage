"use client";

import { useEffect, useMemo, useState } from "react";
import { Charts } from "@/components/dashboard/charts";
import { DashboardHeader } from "@/components/dashboard/header";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FeedbackTable } from "@/components/dashboard/feedback-table";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { computeKpis, applyFilters, downloadCsv, toCsv } from "@/lib/filters";
import type { ApiMeta, FeedbackRecord, Filters } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";

const DATE_BOUNDS_KEY = "cordaid-date-bounds";

function withDefaultDates(filters: Filters, bounds: { min: string; max: string }) {
  return {
    ...filters,
    startDate: bounds.min,
    endDate: bounds.max,
  };
}

export function DashboardClient() {
  const [records, setRecords] = useState<FeedbackRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<FeedbackRecord | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/feedback", { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as {
          records: FeedbackRecord[];
          meta?: ApiMeta;
        };
        if (cancelled) return;
        setRecords(data.records);
        setMeta(data.meta ?? null);
        const dates = data.records
          .map((r) => r.Date)
          .filter((d): d is string => !!d)
          .sort();
        const bounds = { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
        try {
          window.localStorage.setItem(
            DATE_BOUNDS_KEY,
            JSON.stringify(bounds)
          );
        } catch {
          // ignore storage errors (private mode)
        }
        setFilters(
          withDefaultDates(
            {
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
            } satisfies Filters,
            bounds
          )
        );
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
  }, []);

  const filtered = useMemo(() => {
    if (!filters) return [] as FeedbackRecord[];
    return applyFilters(records, filters);
  }, [records, filters]);

  const kpis = useMemo(() => computeKpis(filtered), [filtered]);

  function updateFilters(partial: Partial<Filters>) {
    setFilters((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function resetFilters() {
    if (!records.length) return;
    const dates = records
      .map((r) => r.Date)
      .filter((d): d is string => !!d)
      .sort();
    setFilters(
      withDefaultDates(
        {
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
        } satisfies Filters,
        { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" }
      )
    );
  }

  function exportCsv() {
    if (!filtered.length) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`cordaid-feedback-${date}.csv`, toCsv(filtered));
  }

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-cordaid-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading feedback dataset…</span>
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
              Could not load the feedback dataset
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
      <DashboardHeader records={records} meta={meta} />
      <main className="container py-6 space-y-6">
        <FilterBar
          filters={filters}
          records={records}
          onChange={updateFilters}
          onReset={resetFilters}
          onExport={exportCsv}
        />

        <KpiCards kpis={kpis} />

        <Charts records={filtered} />

        <FeedbackTable
          records={filtered}
          onSelect={(record) => {
            setSelected(record);
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
        record={selected}
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
