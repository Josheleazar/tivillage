"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Charts } from "@/components/dashboard/charts";
import { DashboardHeader } from "@/components/dashboard/header";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FeedbackTable } from "@/components/dashboard/feedback-table";
import { FilterBar } from "@/components/dashboard/filter-bar";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import {
  applyFilters,
  boundsForDateColumn,
  computeKpis,
  downloadCsv,
  emptyFiltersForForm,
  toCsv,
} from "@/lib/filters";
import type { ApiMeta, DynamicRecord, Filters } from "@/lib/types";
import { AlertTriangle, Loader2 } from "lucide-react";
import { getForm, listForms } from "@/lib/dashboards";

// `Filters` (in lib/types.ts) is `Record<string, string>` keyed by the
// active form's FilterDef.key — no per-form branching in this file, so
// WeWork's 7-field state and any future form's N-field state all flow
// through the same dashboard-client code path.

const DATE_BOUNDS_KEY = "cordaid-date-bounds";

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

  // URL is the source of truth for the active form (locked plan). The
  // ?form= value passes through getForm() which falls back to
  // DEFAULT_FORM for unknown ids so a malformed URL never breaks the
  // dashboard layout.
  const form = getForm(searchParams.get("form"));
  const formKey = form.id;
  // Memoize the registry walk so the `forms` array reference stays
  // stable across renders — without this, FormPicker's effect re-runs
  // on every parent render (listForms() returns Object.values(registry),
  // a fresh array each call). The registry itself is module-scoped, so
  // empty deps are safe.
  const forms = useMemo(() => listForms(), []);

  const [records, setRecords] = useState<DynamicRecord[]>([]);
  const [meta, setMeta] = useState<ApiMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Per-Step-7, `Filters` is now `Record<string, string>` keyed by the
  // active form's FilterDef.key. Couples with emptyFiltersForForm()
  // (lib/filters.ts) and applyFilters(records, filters, form) so adding
  // a third form needs no edits to this file.
  const [filters, setFilters] = useState<Filters | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DynamicRecord | null>(null);
  // Operator-driven refresh state. `isRefreshing` mirrors the
  // POST window + 3-second cooldown. `refreshCounter` appends to
  // the loader effect's dependency array so a manual refresh
  // re-runs the same load() pipeline that form switches /
  // dateColumn changes already trigger.
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  // Refs gate the click race — React batches state updates,
  // so two clicks dispatched in the same animation frame both
  // see the captured `isRefreshing === false` from the
  // useCallback closure and would otherwise both fire POST +
  // both bump the counter. The ref flips synchronously on click
  // and is the actual source of truth, with React state following
  // for the UI spinner. Also tracks the cooldown timer so an
  // unmount mid-cooldown doesn't leak setState into a dead tree.
  const refreshInFlightRef = useRef(false);
  // `window.setTimeout` returns number in browser context; using
  // `number` here (vs. `ReturnType<typeof setTimeout>`) keeps the
  // typecheck happy under the `@types/node` global setTimeout
  // overload that resolves to NodeJS.Timeout.
  const cooldownTimerRef = useRef<number | null>(null);
  // Cleanup the cooldown timer on unmount (route change, page
  // nav away mid-cooldown). React 18 swallows setState-on-
  // unmount warnings but it still leaks the timer; this
  // normalises the cleanup path so route.c stays clean.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
    };
  }, []);
  // Reset the cooldown when the operator switches forms mid-
  // refresh. Without this, clicking Refresh on form A and then
  // switching to form B within the 3 s window would leave B's
  // button disabled with "Refreshing…" text even though B was
  // never refreshed. Functionally harmless, but confusing.
  //
  // GUARDED: if a refresh is still mid-POST (ref-guard is true),
  // the original POST's finally block will queue its own timer +
  // reset state naturally once it resolves. Clobbering here
  // would fire a stale-timer race: refresher A's first setTimeout
  // fires while refresher B's second POST is still in flight,
  // calling setIsRefreshing(false) on B's live state.
  useEffect(() => {
    if (refreshInFlightRef.current) return;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
    setIsRefreshing(false);
  }, [formKey]);

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
        const bounds = boundsForDateColumn(data.records, form.dateColumn);
        try {
          window.localStorage.setItem(
            `${DATE_BOUNDS_KEY}-${formKey}`,
            JSON.stringify(bounds),
          );
        } catch {
          // ignore storage errors (private mode)
        }
        setFilters(withDefaultDates(emptyFiltersForForm(form), bounds));
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
  }, [formKey, form.dateColumn, refreshCounter]);

  // Step-7: lib/filters.ts now consumes DynamicRecord[] natively (no more
  // `as unknown as FeedbackRecord[]` bridge). `applyFilters(records,
  // filters, form)` walks form.filters + form.dateColumn + form.searchFields
  // so the same dashboard mounts Cordaid OR WeWork. `filtered` is the
  // post-filter slice that feeds Charts, FeedbackTable, KpiCards, and
  // the CSV export.
  const filtered = useMemo(() => {
    if (!filters) return [];
    return applyFilters(records, filters, form);
  }, [records, filters, form]);

  const kpis = useMemo(
    () => computeKpis(filtered, form),
    [filtered, form],
  );

  function updateFilters(partial: Filters) {
    setFilters((prev) => (prev ? { ...prev, ...partial } : prev));
  }

  function resetFilters() {
    if (!records.length) return;
    const bounds = boundsForDateColumn(records, form.dateColumn);
    setFilters(withDefaultDates(emptyFiltersForForm(form), bounds));
  }

  function exportCsv() {
    if (!filtered.length) return;
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(
      `${formKey}-feedback-${date}.csv`,
      toCsv(filtered, form),
    );
  }

  // Operator-driven refresh. POSTs /api/feedback/refresh which
  // revalidateTags kobo-<formId>; bumping refreshCounter then re-
  // runs the loader effect's load() so the next /api/feedback hit
  // regenerates from Kobo (the sibling route's cache slot is now
  // cold). The 3-second cooldown gates the button so a single
  // operator click can't hammer Kobo behind the scenes while the
  // first regeneration is still in flight.
  const handleRefresh = useCallback(async () => {
    // Ref-guard the click race. React batches state updates, so a
    // second click dispatched in the same animation frame would
    // still see the captured `isRefreshing === false` from the
    // useCallback closure if we relied on the React state alone.
    if (refreshInFlightRef.current) return;
    refreshInFlightRef.current = true;
    setIsRefreshing(true);
    try {
      await fetch(
        `/api/feedback/refresh?form=${encodeURIComponent(formKey)}`,
        { method: "POST", cache: "no-store" },
      );
      // Always re-run the loader even if POST returned non-2xx —
      // revalidateTag is best-effort, the worst case is a 60 s
      // cache miss which is still cached-at-cooldown.
      setRefreshCounter((c) => c + 1);
    } catch {
      // Network failure: silently swallow so the cooldown still
      // lifts and the operator can retry. Network-tab + cached
      // response on /api/feedback give enough signal to debug.
    } finally {
      cooldownTimerRef.current = window.setTimeout(() => {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
        cooldownTimerRef.current = null;
      }, 3000);
    }
  }, [formKey]);

  // Button disabled while EITHER the POST window is open
  // (isRefreshing) OR the loader effect is mid-regen (loading).
  // Coalescing both avoids a stale 3-second window where the
  // button re-enables but the next /api/feedback fetch hasn't
  // resolved yet at 25k-record latency. While `loading` is
  // true the header is hidden behind the Loader2 overlay, but
  // the disabled state still has to be correct so the button
  // doesn't briefly flicker back to enabled on remount.
  const refreshButtonDisabled = loading || isRefreshing;

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
      <DashboardHeader
        records={records}
        meta={meta}
        form={form}
        forms={forms}
        onSwitchForm={switchForm}
        onRefresh={handleRefresh}
        isRefreshing={refreshButtonDisabled}
      />
      <main className="container py-6 space-y-6">
        <FilterBar
          filters={filters}
          records={records}
          form={form}
          onChange={updateFilters}
          onReset={resetFilters}
          onExport={exportCsv}
        />

        <KpiCards kpis={kpis} form={form} records={filtered} />

        <Charts records={filtered} form={form} />

        <FeedbackTable
          records={filtered}
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
