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
export type ChartType = "donut" | "horizontal-bar" | "age-bar" | "trend-line" | "map";

/**
 * One row in the form's filter strip. The FilterShell (filter-bar.tsx
 * Step 8) renders one widget per FilterDef; the dashboard reads
 * `filters[def.key]` and `def.sourceColumn` for each.
 */
/**
 * One level in a drill-down cascade. Each level is a dependent select
 * whose options are derived from records matching PRIOR levels' selected
 * values. Cascade order: index 0 → N (e.g. District → Sub‑county →
 * Parish → Village).
 */
export interface DrillLevel {
  /** filter‑state key / URL marker. */
  key: string;
  /** Widget label. */
  label: string;
  /** Record column the level's options come from (post-rename label). */
  sourceColumn: string;
}

export interface FilterDef {
  /** URL query-string key + state map key. */
  key: string;
  /** Renders as the widget's label. */
  label: string;
  type: "select" | "date" | "search" | "drill";
  /** Record column the filter predicates against (label or snake case). */
  sourceColumn?: string;
  /** Optional grid-span override (1..4). Default 1. */
  span?: number;
  /** Required when type === "drill"; cascade order = top‑down. */
  drillConfig?: { levels: DrillLevel[] };
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
  /**
   * Optional label columns for map chart markers. When set, each marker's
   * popup displays the concatenated values of these columns from the same
   * record alongside the lat/lng coordinates.
   */
  mapLabelColumns?: string[];
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
 * Per-form rendering hints used by feedback-table.tsx and detail-drawer.tsx.
 * Drives both chip rendering (Badge variants in the table + the drawer's
 * header summary badges) and long-text section placement (drawer-only).
 *
 * Cordaid wires up `status` for `Status of this feedback`,
 * `yesNo` for `Emergency Feedback` + `Feedback requires urgent
 * response` + `Reported to Integrity Focal Person` + `Feedback
 * Categorized as`, and `longText` for the two description columns
 * so the drawer renders them as the original labelled sections
 * ("The feedback" / "Actions taken") rather than as grid entries.
 *
 * WeWork currently declares none of these — every cell renders as
 * plain text and the drawer has no dedicated text sections.
 */
export interface FieldHints {
  /**
   * Field keys whose values trigger the Status badge variant.
   * Drives both the table's Badge cell (feedback-table.tsx) and
   * the drawer's header summary badge.
   */
  status?: string[];
  /**
   * Field keys whose values trigger the Yes/No badge variant.
   * Same dual-role as `status` — surfaced in the table + the
   * drawer's header emergency-style badge.
   */
  yesNo?: string[];
  /**
   * Field keys whose values render as full-width long-text sections
   * inside the detail drawer (one section per entry). `title`
   * overrides the auto-derived label so Cordaid's "The feedback" /
   * "Actions taken" section headers stay verbatim.
   */
  longText?: Array<{ field: string; title?: string }>;
}

/**
 * Header content source for the detail drawer. The drawer walks
 * `titleField` to read the title text (falling back to a global
 * "Anonymous respondent" if the field's value is null/empty) and
 * joins `subtitleFields` with " · " for the DrawerDescription.
 *
 * Cordaid declares titleField: "Who is giving feedback?" +
 * subtitleFields: ["Activity", "Project related to feedback"].
 * WeWork declares titleField: "_submission_time" + subtitleFields:
 * ["district", "gender", "businesstype"].
 */
export interface DrawerHeaderSpec {
  titleField?: string;
  subtitleFields?: string[];
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
  /**
   * Optional chip decoration for cell rendering. Step 9's
   * feedback-table.tsx dispatches on this field to wrap the cell
   * in a colour-coded Badge rather than rendering plain text.
   *
   * - `"status"` — for any select_one column with values like
   *   "New / Under investigation / Resolved & closed". The renderer
   *   derives a Badge variant from `.includes()` matches against
   *   the resolved/under-investigation substrings.
   * - `"yesNo"` — for boolean-style yes/no columns (e.g.
   *   `Emergency Feedback`). The renderer picks the red-yes
   *   default variant for "Yes" and muted otherwise.
   *
   * Undefined renders the cell as plain text. New forms can leave
   * `chip` off any column that doesn't want badge styling; WeWork
   * currently declares none, so the table renders plain text for
   * all 10 of its columns.
   */
  chip?: "yesNo" | "status";
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
  /** Per-form render hints (chip dispatch + long-text sections). */
  fieldHints?: FieldHints;
  /** Drawer header content source for the detail-drawer auto-discover path. */
  drawerHeader?: DrawerHeaderSpec;
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
  /**
   * Non-fatal schema-fetch warnings surfaced by lib/kobo.ts. Currently
   * emitted when the schema walker saw survey rows but none carried a
   * label (silent-failure mode the raw record-key rename doesn't fire,
   * leaving every record's passthrough key as the snake_case form). The
   * dashboard's `<source-chip>` can render this string beneath the
   * source label so operators can tell live-Kobo schema drift from
   * genuine empty data.
   */
  warning?: string;
  /** True when Kobo returned more submissions than we cap (50 pages × 1 000). */
  truncated?: boolean;
  /** Total matching rows reported by Kobo (`count` field on `/data/`). */
  totalCount?: number;
}
