"use client";

import { Search, RotateCcw, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { uniqueValues } from "@/lib/filters";
import { FILTER_DEFS } from "@/lib/constants";
import type { DynamicRecord, Filters } from "@/lib/types";

// Bridge alias — Step 8 reformats filter-bar.tsx to read form.filters +
// form.dateColumn from FormConfig instead of the hardcoded FILTER_DEFS.
// Until then this alias keeps the pre-Step-7 prop signature compileable.
type FeedbackRecord = DynamicRecord;

interface FilterBarProps {
  filters: Filters;
  records: FeedbackRecord[];
  /**
   * Accepts a partial Filters update keyed by FilterDef.key. The
   * signature uses Filters (Record<string,string>) rather than
   * Partial<Filters> because every widget in this component emits
   * non-empty string values; widening to string|undefined would force
   * upstream runtime guards for a value shape we never produce.
   */
  onChange: (next: Filters) => void;
  onReset: () => void;
  onExport: () => void;
}

function dateBounds(records: FeedbackRecord[]): { min: string; max: string } {
  const dates = records
    .map((r) => r.Date)
    .filter((d): d is string => !!d)
    .sort();
  return { min: dates[0] ?? "", max: dates[dates.length - 1] ?? "" };
}

export function FilterBar({
  filters,
  records,
  onChange,
  onReset,
  onExport,
}: FilterBarProps) {
  const bounds = dateBounds(records);

  return (
    <section className="rounded-2xl border border-cordaid-border bg-cordaid-cream/70 p-4 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {FILTER_DEFS.map((def) => {
          if (def.type === "date") {
            const value =
              def.key === "startDate"
                ? filters.startDate || bounds.min
                : filters.endDate || bounds.max;
            const min = def.key === "startDate" ? bounds.min : filters.startDate || bounds.min;
            const max = def.key === "endDate" ? bounds.max : filters.endDate || bounds.max;
            return (
              <div key={def.key} className="flex flex-col gap-1">
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
            return (
              <div
                key={def.key}
                className="flex flex-col gap-1 lg:col-span-2"
              >
                <label className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
                  {def.label}
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-cordaid-muted" />
                  <Input
                    type="search"
                    placeholder="Search feedback, action taken, respondent, activity, village…"
                    value={filters.search}
                    onChange={(e) => onChange({ search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>
            );
          }

          // `def.sourceColumn` is a string column name; coerce to a
          // string type so Step 7's widened `uniqueValues(records,
          // column: string)` signature accepts it. Step 8 will replace
          // this with a direct form.filters walk.
          const column: string = def.sourceColumn ?? def.key;
          const options = uniqueValues(records, column);
          const value = filters[def.key] as string;
          return (
            <div key={def.key} className="flex flex-col gap-1">
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
        })}
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
