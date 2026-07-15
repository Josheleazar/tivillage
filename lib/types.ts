// =============================================================================
//  Core types for the multi-form feedback dashboard (dashPlus migration).
//
//  Step 1 of 14 (DASHPLUS_PLAN.md). Adds DynamicRecord + FormConfig + per-
//  form registry types. Step 7 phases out the legacy FeedbackRecord +
// Filters + Kpis shapes — see the historical_memory note on that commit
// for the bridge rationale.
// =============================================================================

/**
 * Cell value: any Kobo field projected by lib/kobo.ts. Strings come from
 * select/text questions; numbers come from integer/calculate questions;
 * null means the value is missing or could not be coerced.
 */
export type Cell = string | number | null;

/**
 * Generic record shape. Kobo submissions are projected into this
 * dictionary + the canonical metadata fields below. Per-form
 * FormConfig entries declare which keys to filter on, count, render in
 * the table, etc. — lib/filters.ts walks those declarations instead
 * of relying on a fixed PascalCase shape.
 */
export interface DynamicRecord extends Record<string, Cell> {
  _id: number;
  _uuid: string;
  _submission_time: string | null;
}

// -----------------------------------------------------------------------------
//  Filter state — the live value bound to `useState` in
//  DashboardClient. Step 7 makes this a generic Record so adding a
//  third form's filter widgets doesn't require widening this type.
// -----------------------------------------------------------------------------

/**
 * Per-form filter values, keyed by `FilterDef.key`. Indexed by string
 * so widgets for forms not yet registered don't trip typecheck.
 * DashboardClient initialises with `emptyFiltersForForm(form)` so
 * every `Keyed<def.key>` exists on first render.
 */
export type Filters = Record<string, string>;

// -----------------------------------------------------------------------------
//  Per-form KPI output — produced by `computeKpis(records, form)`.
//  Keys are `KpiConfig.key` per form. Values are the closed-over
//  compute-closure return (always string | number; never null per the
//  KpiConfig.compute contract which returns 0 or "0.0" at the call
//  site when it can't compute a value).
// -----------------------------------------------------------------------------

/**
 * Map form → KPI value. Lookup `kpis[kpi.key]` to read a tile's value
 * for rendering. kpi-cards.tsx (Step 10) wraps each `KpiConfig` to
 * render via `Map[kpi.key]`.
 */
export type Kpis = Record<string, string | number>;

// -----------------------------------------------------------------------------
//  Legacy types (FEEDBACK_RECORD) removed in Step 7 — see DASHPLUS_PLAN.md
//  §5 step 7. lib/kobo.ts now emits DynamicRecord[]; lib/filters.ts
//  consumes DynamicRecord[]; component consumers in Steps 8/9/11/12
//  reformat to DynamicRecord[] typed props via the staged bridge.
// -----------------------------------------------------------------------------

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
  /**
   * Either a static subtitle string ("Filtered records", "Across
   * resolved entries"), or a function of the filtered records when
   * the sub needs a runtime percentage or relative figure (e.g.
   * "23% of filtered"). Step 10's kpi-cards.tsx checks `typeof sub`
   * at render time.
   */
  sub: string | ((records: DynamicRecord[]) => string);
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
