"use client";

import { Search, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { FilterDef, Filters, FormConfig } from "@/lib/types";

interface FilterBarProps {
  filters: Filters;
  /**
   * Pre-computed filter option sets from the server aggregation.
   * Keyed by FilterDef.key (for select filters) and by DrillLevel.key
   * (for drill-down cascade levels).
   */
  filterOptions: Record<string, string[]>;
  /** Pre-computed date bounds from the server aggregation. */
  dateBounds: { min: string; max: string };
  /** Per-form spec driving every widget. */
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
  if (span === 4) return "lg:col-span-4";
  return "";
}

/**
 * Renders one filter widget per FilterDef. Branches on `def.type`
 * so select / date / search / drill widgets dispatch without per-form
 * code paths. Receives pre-computed `filterOptions` and `dateBounds`
 * instead of raw records — no client-side record iteration.
 */
function FilterWidget({
  def,
  filters,
  filterOptions,
  dateBounds,
  onChange,
}: {
  def: FilterDef;
  filters: Filters;
  filterOptions: Record<string, string[]>;
  dateBounds: { min: string; max: string };
  onChange: (next: Filters) => void;
}) {
  if (def.type === "date") {
    const value =
      def.key === "startDate"
        ? filters.startDate || dateBounds.min
        : filters.endDate || dateBounds.max;
    const min =
      def.key === "startDate"
        ? dateBounds.min
        : filters.startDate || dateBounds.min;
    const max =
      def.key === "endDate" ? dateBounds.max : filters.endDate || dateBounds.max;
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

  // type === "drill" — cascading dependent selects. Options come from
  // the pre-computed filterOptions keyed by DrillLevel.key.
  if (def.type === "drill") {
    const levels = def.drillConfig!.levels;
    return (
      <div className={`flex flex-col gap-1 ${spanClass(def.span ?? 4)}`}>
        <label className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
          {def.label}
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {levels.map((lvl, i) => {
            const value = filters[lvl.key] ?? "";
            const opts = filterOptions[lvl.key] ?? [];
            return (
              <Select
                key={lvl.key}
                value={value}
                onChange={(e) => {
                  // Clear deeper levels on parent change so stale
                  // selections don't survive a parent's reset.
                  const next: Filters = {
                    ...filters,
                    [lvl.key]: e.target.value,
                  };
                  for (let j = i + 1; j < levels.length; j++) {
                    next[levels[j].key] = "";
                  }
                  onChange(next);
                }}
              >
                <option value="">All {lvl.label.toLowerCase()}s</option>
                {opts.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </Select>
            );
          })}
        </div>
      </div>
    );
  }

  // type === "select"
  const options = filterOptions[def.key] ?? [];
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
  filterOptions,
  dateBounds,
  form,
  onChange,
  onReset,
  onExport,
}: FilterBarProps) {
  return (
    <section className="rounded-2xl border border-cordaid-border bg-cordaid-cream/70 p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {form.filters.map((def) => (
          <FilterWidget
            key={def.key}
            def={def}
            filters={filters}
            filterOptions={filterOptions}
            dateBounds={dateBounds}
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
