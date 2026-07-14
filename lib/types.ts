// =============================================================================
//  Core types for the multi-form feedback dashboard (dashPlus migration).
//
//  Step 1 of 14 (DASHPLUS_PLAN.md). Adds DynamicRecord + FormConfig + per-
//  form registry types alongside the existing strict FeedbackRecord so
//  downstream callers don't break until later steps replace their usage.
// =============================================================================

/**
 * Cell value: any Kobo field projected by lib/kobo.ts. Strings come from
 * select/text questions; numbers come from integer/calculate questions;
 * null means the value is missing or could not be coerced.
 */
export type Cell = string | number | null;

/**
 * Generic record shape. Kobo submissions are projected into this
 * dictionary + the canonical metadata fields below. New forms write
 * directly into this shape; legacy code that targets FeedbackRecord
 * is also assignable here because the valueMap translation in
 * lib/kobo.ts keeps label-keyed outputs stable.
 */
export interface DynamicRecord extends Record<string, Cell> {
  _id: number;
  _uuid: string;
  _submission_time: string | null;
}

// -----------------------------------------------------------------------------
// Legacy Cordaid-specific types. Preserved for backward compatibility;
// Step 3 (lib/kobo.ts refactor) and Step 7 (lib/filters.ts refactor)
// phase them out. New code should target DynamicRecord and the per-form
// FormConfig shapes below.
// -----------------------------------------------------------------------------

/**
 * Strict record shape for the Cordaid feedback form. lib/kobo.ts still
 * returns `FeedbackRecord[]` until Step 3 swaps that out for
 * `DynamicRecord[]` (the structural shape is identical; only the typing
 * loosens). New code should consume DynamicRecord.
 *
 * @deprecated Will be removed in Step 3 of the dashPlus migration.
 */
export interface FeedbackRecord {
  Date: string | null;
  Activity: string | null;
  "Feedback Channel used": string | null;
  "Feedback Category": string | null;
  "Emergency Feedback": "Yes" | "No" | null;
  "Thematic Area": string | null;
  "Project related to feedback": string | null;
  District: string | null;
  Subcounty: string | null;
  Village: string | null;
  "Who is giving feedback?": string | null;
  Gender: "Male" | "Female" | null;
  Age: number | null;
  "Description of feedback, suggestion or complaint": string | null;
  "Description of actions taken": string | null;
  "Referral Status": string | null;
  "Status of this feedback": string | null;
  "Date feedback was resolved": string | null;
  "Days taken to resolved this feedback": number | null;
  "Reported to Integrity Focal Person": string | null;
  "Feedback requires urgent response": string | null;
  "Feedback Categorized as": string | null;
  _submission_time: string | null;
  _id: number;
  _uuid: string;
}

/**
 * Legacy `Filters` shape for the Cordaid dashboard. Step 7 replaces
 * this with `Record<string, string>` keyed by `FilterDef.key`, making
 * the form-picker introduce new filter sets without touching shared
 * types. We keep this shape so `filter-bar.tsx`, `dashboard-client.tsx`,
 * and the API route keep typechecking during the multi-step migration.
 *
 * @deprecated Will be replaced in Step 7 with a generic
 * `Record<string, string>` keyed by `FilterDef.key`.
 */
export interface Filters {
  project: string;
  district: string;
  subcounty: string;
  category: string;
  status: string;
  gender: string;
  channel: string;
  thematic: string;
  referral: string;
  emergency: string;
  startDate: string;
  endDate: string;
  search: string;
}

export const emptyFilters: Filters = {
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
  startDate: "",
  endDate: "",
  search: "",
};

/**
 * Legacy flat-record KPI output. Step 7 replaces this with the
 * `Record<string, Cell>` map that `computeKpis(records, config)` builds
 * by walking each form's `KpiConfig.compute` closure.
 *
 * @deprecated Will be removed in Step 7.
 */
export interface Kpis {
  total: number;
  resolvedPct: number;
  openPct: number;
  emergencyPct: number;
  referredPct: number;
  avgDaysToResolve: number;
  femalePct: number;
  districtsCovered: number;
  resolved: number;
  open: number;
  emergency: number;
  referred: number;
  female: number;
}

// -----------------------------------------------------------------------------
// Per-form configuration shapes. Steps 2 uses these in lib/dashboards/*.ts;
// steps 8–12 use these in the dashboard components to render charts, KPIs,
// filters, table, and detail drawer per the active form's specs.
// -----------------------------------------------------------------------------

/**
 * Chart visualisation kinds. Mirrors what charts.tsx knows how to draw.
 */
export type ChartType = "donut" | "horizontal-bar" | "age-bar" | "trend-line";

/**
 * One row in the form's filter strip. The FilterShell (filter-bar.tsx
 * Step 8) renders one widget per FilterDef; the dashboard reads
 * `filters[def.key]` and `def.sourceColumn` for each.
 */
export interface FilterDef {
  /** URL query-string key + state map key. */
  key: string;
  /** Renders as the widget's label. */
  label: string;
  type: "select" | "date" | "search";
  /** Record column the filter predicates against (label or snake case). */
  sourceColumn?: string;
  /** Optional grid-span override (1..3). Default 1. */
  span?: number;
}

/**
 * One chart tile in the analytics grid. Records lacking a non-null
 * value for `sourceColumn` cause the chart to be silently skipped
 * (Step 11).
 */
export interface ChartSpec {
  title: string;
  type: ChartType;
  sourceColumn: string;
  /** Optional cap for horizontal-bar charts (default 15). */
  topN?: number;
}

/**
 * Lucide icon names supported by kpi-cards.tsx's ICON_MAP. Adding a new
 * icon here = adding the matching entry in the ICON_MAP in the same PR.
 */
export type KpiIconName =
  | "Inbox"
  | "CheckCircle2"
  | "Clock"
  | "AlertTriangle"
  | "Share2"
  | "CalendarDays"
  | "Users"
  | "Map";

/**
 * One KPI tile. `compute` is a pure function over the filtered records;
 * the kpi-cards renderer calls it once per render to produce the value
 * the tile displays (Step 10).
 */
export interface KpiConfig {
  /** Unique key surfaced in `computeKpis(records, config)` output. */
  key: string;
  label: string;
  sub: string;
  iconName: KpiIconName;
  /** Tailwind utility classes for the icon chip — e.g. "bg-rose-50 text-cordaid-red". */
  accent: string;
  /**
   * Pure function over the filtered records. Returns either a number
   * (counts/percents/averages, rendered via `.toLocaleString()` or
   * `.toFixed(1)`) or a formatted string (e.g. "12.5 avg days").
   * Narrows away from `Cell` on purpose — KPI values should never be
   * `null`; if a closure can't compute a value, return 0 or "—" at the
   * call site, not null here.
   */
  compute: (records: DynamicRecord[]) => string | number;
}

/**
 * One column in the records table.
 */
export interface TableColumnDef {
  /** The DynamicRecord key this column reads. */
  key: string;
  /** Header text. */
  label: string;
  align?: "left" | "right";
}

/**
 * Declarative description of one form's dashboard view. Each form lives
 * in `lib/dashboards/<formId>.ts`; the registry in
 * `lib/dashboards/index.ts` exposes them via the form picker.
 */
export interface FormConfig {
  /** Internal key / URL marker (`?form=…`). */
  id: string;
  /** Picker display label. */
  label: string;
  /**
   * Env-var prefix used by the route's resolution chain. e.g. `"KOBO"`
   * reads `KOBO_*`; `"WEWORK_KOBO"` reads `WEWORK_KOBO_*`. The chain
   * falls back to the bare `KOBO_*` keys for token + base URL wherever
   * the form-specific prefix is unset (dev convenience).
   */
  envPrefix: string;
  /** Field whose values drive date bounds + the trend chart. */
  dateColumn: string;
  /** Free-text search targets. */
  searchFields: string[];
  filters: FilterDef[];
  kpis: KpiConfig[];
  charts: ChartSpec[];
  tableColumns: TableColumnDef[];
}

// -----------------------------------------------------------------------------
// API response shapes (unchanged shape, slightly broadened union).
// -----------------------------------------------------------------------------

/**
 * Source identifier for the API response. Broadened from the prior
 * `"local" | "kobo" | "kobo-fallback"` union to `string` so per-form IDs
 * (`"cordaidDemo"`, `"Wework"`, …) and `<formId>-fallback` variants can
 * flow through `ApiMeta.source` without re-tightening the union every
 * time a new form is added. Consumers (e.g. source-chip.tsx) treat
 * unknown values as opaque.
 */
export type ApiSource = string;

export interface ApiMeta {
  /**
   * Source the records came from:
   *   `"local"`             — bundled JSON fallback, no env configured
   *   `<formId>`            — live KoboToolbox for the active form
   *   `<formId>-fallback`   — Kobo request failed, served bundled JSON
   * Exact consumer behaviour is documented in source-chip.tsx.
   */
  source: ApiSource;
  count: number;
  uid?: string;
  name?: string;
  version?: string;
  baseUrl?: string;
  fetchedAt?: string;
  error?: string;
  /** True when Kobo returned more submissions than we cap (50 pages × 1 000). */
  truncated?: boolean;
  /** Total matching rows reported by Kobo (`count` field on `/data/`). */
  totalCount?: number;
}
