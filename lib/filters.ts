import { ageBucket } from "./utils";
import type { Cell, DynamicRecord, FormConfig } from "./types";

// =============================================================================
//  lib/filters.ts — form-aware filter + analytics helpers (Step 7).
//
//  Every helper takes the active FormConfig and walks its declarative
//  shapes (searchFields, filters, dateColumn, kpis, tableColumns) so
//  adding a third form does NOT require editing this file. Pre-Step-7
//  this file hard-coded the 24-key PascalCase FeedbackRecord shape and
//  the 14-entry SEARCH_FIELDS list; Step 7 was the moment where each
//  helper got "form-native" so WeWork's snake_case columns + ISO
//  datetime dateColumn worked without special-casing.
//
//  Lesson-learned guardrails carried into the rewrite (DASHPLUS_PLAN.md §3):
//
//  - Date normalisation: `_submission_time` ISO datetimes and Cordaid
//    "Date" YYYY-MM-DD strings both flow through the same path
//    (slice(0,10) to YYYY-MM-DD prefix) so day-level lex compare stays
//    correct regardless of which column the form points at.
//  - Select predicate walker: every `form.filters[type="select"]` runs
//    only when both the filter is non-empty AND the record's value
//    differs. Records with null/missing sourceColumn values still fall
//    through (so Wework records missing `businesstype` aren't dropped
//    when the businesstype filter is left blank).
//  - Date bounds tolerate missing dates: Kobo data is dirty; aggressive
//    stripping would silently under-count when a filtered date range
//    is applied. Records with null dateColumn pass through date bounds
//    rather than getting dropped on `r.Date && r.Date < start`.
//  - Search haystack: when query is non-empty, joins all non-null values
//    of form.searchFields. If form.searchFields is empty while query
//    is non-empty, the haystack is empty and the predicate always
//    fails — that's a "your query has no fields to match" state, not
//    a crash. Consumers can surface this if they want.
// =============================================================================

/**
 * Builds the empty filter map for a given form, keyed by every
 * `FilterDef.key`. Date inputs default to empty strings so the
 * dashboard-client can layer on `withDefaultDates()` with bound-driven
 * defaults AFTER this call.
 *
 * Pre-Step-7 this was a fixed 13-key interface constant
 * (`emptyFilters`) hard-coded in lib/types.ts. The per-form shape
 * means unknown ids (e.g. future forms) get exactly the keys they
 * declared — no leakage from Cordaid's 13 fields into WeWork's 7.
 */
export function emptyFiltersForForm(form: FormConfig): Record<string, string> {
  const f: Record<string, string> = {};
  for (const def of form.filters) f[def.key] = "";
  return f;
}

/**
 * Normalises a Cell value to a YYYY-MM-DD date prefix for
 * day-level lex compare. Returns null if the value isn't a non-empty
 * string with a parseable year prefix.
 *
 * Both Cordaid's `Date` (already YYYY-MM-DD) and WeWork's
 * `_submission_time` (e.g. `2026-07-08T11:52:16.000Z`) slice cleanly
 * to a 10-char date prefix, so day-level bucket boundaries are
 * correct regardless of which column the form points at. Without
 * this, `r._submission_time < "2026-07-08"` lex-compare fails
 * because `'T' (0x54) > '-' (0x2D)` makes `2026-07-08T...` look
 * bigger than `2026-07-08`, dropping records submitted on the
 * endDate day.
 *
 * Numeric Cells (rare — only if a form's `dateColumn` is an integer
 * epoch) and null Cells return null; the caller treats null as
 * "skip the date predicate for this record".
 */
function normalizeDate(v: Cell): string | null {
  if (typeof v !== "string" || !v) return null;
  if (!/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  return v.slice(0, 10);
}

/**
 * Page-level + table-level free-text search. Caller passes the
 * form-specific searchFields so the haystack adapts to whichever
 * form is active (Cordaid's PascalCase keys vs. WeWork's snake_case
 * keys). Empty query short-circuits to identity.
 */
export function searchRecords(
  records: DynamicRecord[],
  query: string,
  searchFields: string[]
): DynamicRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  return records.filter((r) => {
    const haystack = searchFields
      .map((k) => (r[k] == null ? "" : String(r[k])))
      .join(" | ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/**
 * Generic predicate walker for the form's filter strip. Three passes:
 *
 * 1. Date-bounds predicate against form.dateColumn (records with
 *    null dateColumn pass through — see the lesson-learned note).
 * 2. Per-FilterDef select equality walk: drops the record when
 *    `filters[def.key]` is non-empty AND `r[def.sourceColumn] !==
 *    selected`. Records whose column is null/missing still pass
 *    (select filter only filters out, never drops everything).
 * 3. Free-text search over form.searchFields. Empty query
 *    short-circuits.
 *
 * Unknown filter keys (e.g. a stale URL frag) are silently ignored
 * so switchForm's URL refresh can't crash the dashboard mid-flight.
 */
export function applyFilters(
  records: DynamicRecord[],
  filters: Record<string, string>,
  form: FormConfig
): DynamicRecord[] {
  const startDate = filters.startDate ?? "";
  const endDate = filters.endDate ?? "";
  const search = (filters.search ?? "").trim().toLowerCase();

  return records.filter((r) => {
    // Pass 1: date bounds.
    if (startDate || endDate) {
      const v = normalizeDate(r[form.dateColumn]);
      if (v !== null) {
        if (startDate && v < startDate) return false;
        if (endDate && v > endDate) return false;
      }
    }

    // Pass 2: select predicates.
    for (const def of form.filters) {
      if (def.type !== "select") continue;
      if (!def.sourceColumn) continue;
      const selected = filters[def.key];
      if (!selected) continue;
      if (r[def.sourceColumn] !== selected) return false;
    }

    // Pass 3: free-text search (over form.searchFields only — no
    // meta-field leakage).
    if (search) {
      const haystack = form.searchFields
        .map((k) => (r[k] == null ? "" : String(r[k])))
        .join(" | ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

/**
 * Builds the per-select option set for a column. Tolerates any Cell
 * value (string | number | null) by coercing via String() so numeric
 * columns still get a sensible dropdown. Records whose cell is
 * null/empty are skipped; the result is sorted alpha for stable
 * menu order.
 */
export function uniqueValues(
  records: DynamicRecord[],
  column: string
): string[] {
  const set = new Set<string>();
  for (const r of records) {
    const v = r[column];
    if (v == null || v === "") continue;
    set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Walks `form.kpis`; each closure produces its tile's value.
 * Pure function — does NOT memoize; callers wrap with useMemo so
 * React renders stay cheap.
 *
 * Per the KpiConfig contract, compute closures return
 * `string | number` (never null). They return 0 or "0.0" at the call
 * site if they can't compute a value (e.g. `avgDaysToResolve(records)`
 * when no resolved records exist).
 */
export function computeKpis(
  records: DynamicRecord[],
  form: FormConfig
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const kpi of form.kpis) {
    out[kpi.key] = kpi.compute(records);
  }
  return out;
}

/**
 * Frequency count for any column. Numeric Cells stringified via
 * String() so even if a future form has an integer column with a
 * small range of values, the donut chart still works.
 */
export function countBy(
  records: DynamicRecord[],
  column: string
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of records) {
    const v = r[column];
    if (v == null || v === "") continue;
    const k = String(v);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count
  );
}

/**
 * Trend chart series over `dateColumn`. Slices the YYYY-MM-DD prefix
 * from each value so the X axis reads naturally (day-level buckets
 * render better than minute-level). Caller is responsible for the
 * chart's column choice — Step 11 will route `form.charts[0]` to
 * this helper with `form.dateColumn`.
 */
export function trendByDate(
  records: DynamicRecord[],
  dateColumn: string
): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of records) {
    const v = r[dateColumn];
    const d = normalizeDate(v);
    if (d === null) continue;
    map.set(d, (map.get(d) ?? 0) + 1);
  }
  return Array.from(map, ([date, count]) => ({ date, count })).sort(
    (a, b) => (a.date < b.date ? -1 : 1)
  );
}

/**
 * Stacked age buckets from `r[ageColumn]`. Defaults to "Age" for
 * backward compatibility with pre-Step-11 callers (charts.tsx
 * pre-Step-11 was the only caller and didn't supply a column);
 * Step 11's charts dispatcher passes spec.sourceColumn so WeWork
 * can route via "age" while Cordaid keeps "Age" as the column key.
 *
 * Coerces numeric strings defensively — older Kobo deployments
 * persisted integer questions as strings, and lib/kobo.ts's numOf
 * coercion is best-effort. Records with genuinely missing or
 * garbage ages land in the "Unknown" bucket via ageBucket(null).
 */
export function ageDistribution(
  records: DynamicRecord[],
  ageColumn: string = "Age"
): Array<{ key: string; count: number }> {
  const order = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+", "Unknown"];
  const map = new Map<string, number>();
  for (const r of records) {
    const raw = r[ageColumn];
    let age: number | null = null;
    if (typeof raw === "number") {
      age = raw;
    } else if (typeof raw === "string" && raw !== "") {
      const n = Number(raw);
      if (Number.isFinite(n)) age = n;
    }
    const bucket = ageBucket(age);
    map.set(bucket, (map.get(bucket) ?? 0) + 1);
  }
  return order
    .filter((k) => map.has(k))
    .map((k) => ({ key: k, count: map.get(k) ?? 0 }));
}

/**
 * CSV projection per `form.tableColumns`. Header labels drive the
 * CSV header line; column keys drive row projection order.
 * Records with null cells render as empty strings; commas/quotes/
 * newlines in values are RFC-4180 escaped.
 */
export function toCsv(
  records: DynamicRecord[],
  form: FormConfig
): string {
  if (!records.length) return "";
  const cols = form.tableColumns.map((c) => c.key);

  const escape = (val: unknown) => {
    const s = val == null ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const header = form.tableColumns.map((c) => escape(c.label)).join(",");
  const rows = records.map((r) =>
    cols.map((c) => escape(r[c])).join(",")
  );
  return [header, ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
