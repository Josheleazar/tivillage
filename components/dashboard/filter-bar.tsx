"use client";

import { Search, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { boundsForDateColumn, uniqueValues } from "@/lib/filters";
import type { DynamicRecord, FilterDef, Filters, FormConfig } from "@/lib/types";

interface FilterBarProps {
  filters: Filters;
  /**
   * PRE-FILTER records used to populate dropdown option sets + the
   * date-input min/max bounds. FilterBar is a pure filter-input
   * widget — it does not filter records itself; DashboardClient
   * owns the applyFilters call.
   */
  records: DynamicRecord[];
  /**
   * Per-form spec driving every widget. Step 8 replaces the legacy
   * `FILTER_DEFS` import from lib/constants.ts with this prop
   * so each form declares its own widget set without edits here.
   * Adding a third form is one new lib/dashboards/<id>.ts entry —
   * zero edits to this file.
   */
  form: FormConfig;
  onChange: (next: Filters) => void;
  onReset: () => void;
  onExport: () => void;
}

/**
 * Maps a FilterDef.span to the corresponding Tailwind col-span
 * class. Default 1 (no override) leaves the cell single-width.
 */
function spanClass(span: number | undefined): string {
  if (span === 2) return "lg:col-span-2";
  if (span === 3) return "lg:col-span-3";
  return "";
}

/**
 * Renders one filter widget per FilterDef. Branches on `def.type`
 * so select / date / search widgets dispatch without per-form
 * code paths.
 */
function FilterWidget({
  def,
  filters,
  records,
  bounds,
  onChange,
}: {
  def: FilterDef;
  filters: Filters;
  records: DynamicRecord[];
  bounds: { min: string; max: string };
  onChange: (next: Filters) => void;
}) {
  if (def.type === "date") {
    const value =
      def.key === "startDate"
        ? filters.startDate || bounds.min
        : filters.endDate || bounds.max;
    const min =
      def.key === "startDate"
        ? bounds.min
        : filters.startDate || bounds.min;
    const max =
      def.key === "endDate" ? bounds.max : filters.endDate || bounds.max;
    return (
      <div className={`flex flex-col gap-1 ${spanClass(def.span)}`}>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
          {def.label}
        </label>
        <Input
          type="date"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange({ [def.key]: e.target.value })}
        />
      </div>
    );
  }

  if (def.type === "search") {
    // Cordaid used a wide, custom placeholder ("Search feedback,
    // action taken, respondent, activity, village…") so users know
    // the scope. Step 8 keeps the Cordaid placeholder for parity and
    // falls back to a generic phrasing for other forms' search wid-
    // gets (today only WeWork has a search widget).
    const placeholder =
      def.key === "search"
        ? "Search feedback, action taken, respondent, activity, village…"
        : `Search ${def.label.toLowerCase()}…`;
    return (
      <div className={`flex flex-col gap-1 ${spanClass(def.span ?? 2)}`}>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
          {def.label}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cordaid-muted" />
          <Input
            type="search"
            placeholder={placeholder}
            value={filters[def.key] ?? ""}
            onChange={(e) => onChange({ [def.key]: e.target.value })}
            className="pl-9"
          />
        </div>
      </div>
    );
  }

  // type === "select"
  const column = def.sourceColumn ?? def.key;
  const options = uniqueValues(records, column);
  const value = filters[def.key] ?? "";
  return (
    <div className={`flex flex-col gap-1 ${spanClass(def.span)}`}>
      <label className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
        {def.label}
      </label>
      <Select
        value={value}
        onChange={(e) => onChange({ [def.key]: e.target.value })}
      >
        <option value="">All {def.label.toLowerCase()}s</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function FilterBar({
  filters,
  records,
  form,
  onChange,
  onReset,
  onExport,
}: FilterBarProps) {
  // Bounds derived from the active form's dateColumn. Routed through
  // lib/filters.ts:s boundsForDateColumn so the startDate/endDate
  // defaults DashboardClient writes into filter state use the SAME
  // day-level YYYY-MM-DD normalisation as the per-widget min/max con-
  // straints below — without the shared helper, the two sites could
  // drift (e.g. WeWork's _submission_time storing "2026-07-08T…" in
  // state while the widget computes "2026-07-08" for min).
  const bounds = boundsForDateColumn(records, form.dateColumn);

  return (
    <section className="rounded-2xl border border-cordaid-border bg-cordaid-cream/70 p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {form.filters.map((def) => (
          <FilterWidget
            key={def.key}
            def={def}
            filters={filters}
            records={records}
            bounds={bounds}
            onChange={onChange}
          />
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-cordaid-muted mr-auto">
          Tip: filters apply to all KPIs, charts and records in real time.
        </span>
        <Button variant="ghost" onClick={onReset} className="gap-1.5">
          <RotateCcw className="h-4 w-4" />
          Reset filters
        </Button>
        <Button variant="secondary" onClick={onExport} className="gap-1.5">
          <Download className="h-4 w-4" />
          Export filtered CSV
        </Button>
      </div>
    </section>
  );
}
