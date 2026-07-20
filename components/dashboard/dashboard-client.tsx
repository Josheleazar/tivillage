"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Charts } from "@/components/dashboard/charts";
import { DashboardHeader } from "@/components/dashboard/header";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FeedbackTable } from "@/components/dashboard/feedback-table";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import {
  emptyFiltersForForm,
} from "@/lib/filters";
import type { AggregatedResponse, DynamicRecord, Filters } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getForm, listForms } from "@/lib/dashboards";

// =============================================================================
//  Option D: Server-side aggregation. All chart options, KPIs, filter
//  options, drill-down cascades, and date bounds are pre-computed on the
//  server. The client receives a ~50KB aggregated payload (~500 records
//  for table + drawer) instead of 5–10MB raw records.
//
//  Filter changes trigger a re-fetch with current filter values as query
//  params. The server re-aggregates from its cache (~70ms) without
//  re-fetching Kobo.
// =============================================================================

function withDefaultDates(
  filters: Filters,
  bounds: { min: string; max: string },
) {
  return {
    ...filters,
    startDate: bounds.min,
    endDate: bounds.max,
  };
}

export function DashboardClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const form = getForm(searchParams.get("form"));
  const formKey = form.id;
  // Stable forms array — listForms() returns Object.values(registry) which
  // is a fresh array each call. Memoize once at mount.
  const [forms] = useState(() => listForms());

  // Aggregated payload from server. Null on initial mount, set after first
  // successful fetch. Persisted through filter re-fetches so old data stays
  // visible while new data loads.
  const [aggregated, setAggregated] = useState<AggregatedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Filter state. Initialised from the aggregated response's dateBounds.
  // Changes to filters trigger a re-fetch via filterVersion.
  const [filters, setFilters] = useState<Filters | null>(null);
  // Counter bumped on every user-initiated filter change. Added to the
  // main effect's dependency array so the effect re-fires with the new
  // filter values appended to the fetch URL.
  const [filterVersion, setFilterVersion] = useState(0);
  // Separate loading flag for filter re-fetches — keeps old aggregated data
  // visible (no full-screen spinner) while the server re-aggregates.
  const [reFetching, setReFetching] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DynamicRecord | null>(null);

  // Operator-driven refresh state.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const refreshInFlightRef = useRef(false);
  const cooldownTimerRef = useRef<number | null>(null);

  // Ref that mirrors the current filter state so the fetch effect can read
  // the latest values without depending on `filters` directly (avoiding a
  // double-fetch on initial load where filters changes from null → value).
  const filtersRef = useRef<Filters>({});
  useEffect(() => {
    if (filters) filtersRef.current = filters;
  }, [filters]);

  // Cleanup cooldown timer on unmount.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);

  // Reset the cooldown when the operator switches forms mid-refresh.
  useEffect(() => {
    if (refreshInFlightRef.current) return;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setIsRefreshing(false);
  }, [formKey]);

  // Reactive document title.
  useEffect(() => {
    document.title = `${form.label} · Feedback Dashboard`;
  }, [form.label]);

  // Main fetch effect. Depends on formKey, form.dateColumn, refreshCounter
  // (manual refresh), and filterVersion (filter change). Reads the current
  // filter values from the ref so the closure captures the latest state.
  useEffect(() => {
    let cancelled = false;
    const isInitial = !aggregated;
    if (isInitial) {
      setLoading(true);
      setAggregated(null);
    } else {
      setReFetching(true);
    }
    setError(null);
    setSelected(null);

    async function load() {
      try {
        // Build URL: form + aggregated=true + current filter values
        const params = new URLSearchParams();
        params.set("form", formKey);
        params.set("aggregated", "true");
        let hasFilters = false;
        for (const [k, v] of Object.entries(filtersRef.current)) {
          if (v) {
            params.set(k, v);
            hasFilters = true;
          }
        }

        const res = await fetch(`/api/feedback?${params}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const data = (await res.json()) as AggregatedResponse;
        if (cancelled) return;

        setAggregated(data);

        // On initial load, initialise filter state from the response's
        // dateBounds. On subsequent fetches (filter changes, refresh),
        // the existing filter state is preserved.
        if (isInitial) {
          setFilters(
            withDefaultDates(
              emptyFiltersForForm(form),
              data.dateBounds,
            ),
          );
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (!cancelled) setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReFetching(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [formKey, form.dateColumn, refreshCounter, filterVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateFilters(partial: Filters) {
    setFilters((prev) => {
      if (!prev) return prev;
      return { ...prev, ...partial };
    });
    // Bump filter version to trigger re-fetch on the next render cycle.
    // Using a microtask ensures the filter state update settles first.
    setFilterVersion((v) => v + 1);
  }

  function resetFilters() {
    if (!aggregated) return;
    setFilters(
      withDefaultDates(
        emptyFiltersForForm(form),
        aggregated.dateBounds,
      ),
    );
    setFilterVersion((v) => v + 1);
  }

  function exportCsv() {
    if (!aggregated) return;
    const params = new URLSearchParams({ form: formKey });
    for (const [k, v] of Object.entries(filtersRef.current)) {
      if (v) params.set(k, v);
    }
    // Programmatic <a> click avoids popup blockers and triggers an
    // immediate CSV download from the server.
    const a = document.createElement("a");
    a.href = `/api/feedback/export?${params}`;
    a.click();
  }

  // Operator-driven refresh.
  const handleRefresh = useCallback(async () => {
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await fetch(
        `/api/feedback/refresh?form=${encodeURIComponent(formKey)}`,
        { method: "POST", cache: "no-store" },
      );
      setRefreshCounter((c) => c + 1);
    } catch {
      // Network failure: silently swallow so the cooldown still lifts.
    } finally {
      cooldownTimerRef.current = window.setTimeout(() => {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
        cooldownTimerRef.current = null;
      }, 3000);
    }
  }, [formKey]);

  const refreshButtonDisabled = loading || isRefreshing;

  const switchForm = useCallback(
    (next: string) => {
      router.replace(`${pathname}?form=${encodeURIComponent(next)}`);
    },
    [pathname, router],
  );

  // ===========================================================================
  //  Render
  // ===========================================================================

  if (error && !aggregated) {
    // Full-screen error only on initial load failure. If we have cached
    // aggregated data, show it below the error.
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

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center gap-2 text-cordaid-muted">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Loading {form.label} dataset…</span>
      </div>
    );
  }

  if (!aggregated || !filters) return null;

  return (
    <>
      <DashboardHeader
        records={aggregated.records}
        meta={aggregated.meta}
        totalCount={aggregated.totalCount}
        form={form}
        forms={forms}
        onSwitchForm={switchForm}
        onRefresh={handleRefresh}
        isRefreshing={refreshButtonDisabled}
      />
      <main className="container py-6 space-y-6">
        <FilterBar
          filters={filters}
          filterOptions={{
            ...aggregated.filterOptions,
            ...aggregated.drillOptions,
          }}
          dateBounds={aggregated.dateBounds}
          form={form}
          onChange={updateFilters}
          onReset={resetFilters}
          onExport={exportCsv}
        />

        <KpiCards kpis={aggregated.kpis} form={form} records={aggregated.records} />

        <Charts charts={aggregated.charts} />

        {reFetching && (
          <div className="flex items-center justify-center gap-2 text-xs text-cordaid-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Re-aggregating…</span>
          </div>
        )}

        <FeedbackTable
          records={aggregated.records}
          form={form}
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
        form={form}
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
