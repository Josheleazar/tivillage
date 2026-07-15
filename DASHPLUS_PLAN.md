# Multi-form dashboard — build plan (`dashPlus`)

> **Status:** in progress on `dashPlus`. Steps 1–11 complete (Steps 7+10,
> Step 8+9, and Step 11 each shipped in a single bundled commit because
> each pair closes out a FeedbackRecord bridge alias with no remaining
> per-form branching — the only outstanding step before ETE verification
> is Step 12). `pnpm typecheck` PASS at every shipped boundary. Cordaid
> runtime parity verified by inspection (applyFilters predicate order,
> 13 filter widgets, 8 KPI closures, 10 CSV columns, 10 form.charts
> specs all match cordaidDemo.ts field-for-field). Push policy is
> unchanged: no push, branch lives locally. **Branch:** `dashPlus`
> (already created). **Push policy:** none, per standing rule.
> **Date:** 2026-07.

This document locks the design for a multi-form version of the Cordaid
feedback dashboard. The new build sits on the `dashPlus` branch and is
structured around three explicit defensive measures ("the lessons learnt")
that defend against the silent-failure bugs the previous build shipped with.

---

## 1. Goal

Today the dashboard is hard-bound to ONE Cordaid feedback form (`KOBO_ASSET_UID`,
`KOBO_BASE_URL`, `KOBO_API_TOKEN`). The new version adds:

1. A **form picker** in the top-right of the header.
2. Picking a form **rebinds every visible region** of the dashboard — KPIs,
   charts, filters, table, source chip, document title — to the active form's
   schema.
3. A **per-form registry** so adding a third (fourth, fifth…) form is one
   new file plus one entry in the registry, no changes to existing forms.
4. Forms are **hard-coded**, not auto-discovered from the filesystem.

The existing Cordaid path must remain observably identical (no
regressions to the three `lib/kobo.ts` fixes that landed previously).

---

## 2. Locked decisions (do not re-debate)

| # | Decision | Source |
| - | - | - |
| D1 | Picker placement: top-right of header, next to the record-count chip. Compact `[ Layers▾ {formLabel} ]` button. | QN1, X1, X2 |
| D2 | Dropdown label = `cordaidDemo` (Cordaid) and `Wework` (literal — capital W, lowercase rest) for the second form. | QN8 |
| D3 | Default form on first load = `cordaidDemo`. | QN4 |
| D4 | Per-form registry in `lib/dashboards/`, **hard-coded**, no auto-discovery. | QN2, F4 |
| D5 | Charts derive from each form's schema. Spec → match field on schema → render. Spec with no matching field is silently skipped, with a meaningful empty state if EVERY spec misses. | QN3, F3 |
| D6 | Filters reset on form switch. Filter **definitions** per form (different widget set per form). | QN5 |
| D7 | Form switch strips ALL filter params from URL (F5b — clean bookmarkable URLs). | F5b |
| D8 | Source chip rebinds per form. Shows the **real Kobo asset name** underneath the picker label (F2a). Tooltip surface for the picker. | QN7, F2a |
| D9 | Document title reactive: `${formLabel} · Feedback Dashboard`. | X3 |
| D10 | Env naming scheme — `WEWORK_KOBO_ASSET_UID_DEV` (local dev), `WEWORK_KOBO_*` (prod). Resolution chain per form: `<envPrefix>_ASSET_UID_DEV ?? <envPrefix>_ASSET_UID`; `<envPrefix>_BASE_URL ?? KOBO_BASE_URL`; `<envPrefix>_API_TOKEN ?? KOBO_API_TOKEN`. | F1, QN6 |
| D11 | Icon: Lucide `Layers` (already on `lucide-react@0.460.0`). | X1 |
| D12 | Detail drawer auto-discovers every non-meta field from the record (no hard-coded 24-field layout). | F3 applied to drawer |

---

## 3. Lessons-learned guardrails

The previous build committed three silent-failure bugs that compounded into
"everything renders nothing even though we have data." The new build
**must** defend against all three in code structure, not just adherence
hope.

### 3.1 Bug A — `data.content` iterated as if it were a flat list

KPI v2 returns `data.content` as a **dict** with keys `survey`, `choices`,
`settings`, `translated`, `translations`. Values are arrays of row objects
(sheets). The previous `Array.isArray(data?.content) ? data.content : []`
guard returned `false`, so the schema loop was a silent no-op and
`nameToLabel` / `valueNameToLabel` / `integerLabels` / `dateLabels` all
stayed empty. Every raw snake_case key fell through to
`targetKey = meta.nameToLabel[k] ?? k`, the strict `FeedbackRecord`
reader dereferenced PascalCase keys that were never written, every label-
keyed field came back null.

### 3.2 Bug B — `extractLabel` only recognised two shapes

KPI v2's modal shape on kf.kobotoolbox.org is `label: ["Date"]`,
an **array of strings**, not a string and not a language-keyed dict.
`typeof label === "object"` returns `true` for arrays, so the dict branch
dereferenced `label["English (en)"]` returning `undefined` →
`extractLabel` returned `""`, every survey question was skipped by
`if (!lbl) continue;` downstream.

### 3.3 Bug C — valueMap lookups crashed silently when type-suffix was stripped

KPI v2 returns `type: "select_one"` (no suffix) instead of
`type: "select_one gender"`. The `byListName[type-suffix]` lookup always
missed. Only `byListName[survey.name]` (canonical grouping by `list_name`)
returns the right value map. The type-suffix fallback exists for
older deployments that still preserve the suffix.

### 3.4 Hard rules for the new build

1. **One always-defensive shape-probing utility** for every Kobo response
   container. Never `Array.isArray(x) ? x : []` on a response object.
2. **`extractLabel` handles all three documented shapes** — string, array
   of string-or-dict, dict — with the array branch positioned BEFORE the
   object branch (because `typeof [] === "object"`).
3. **Schema walking always checks both `data.content.x` and `data.x`** so
   deployment-version drift doesn't break the walker.
4. **ValueMap lookup order**: `byListName[survey.name]` primary, fallback to
   `byListName[type-suffix]`, fallback to inline `q.choices`. Each fallback
   documented in code.
5. **`yesNo` / `maleFemale` coercion helpers accept lower-case slugs as
   defensive layer** in case valueMap fires too late. They never throw —
   unknown input returns `null` deterministically.
6. **`fetchKoboFormMeta` always returns empty defaults** so downstream
   readers get `null` (never `undefined.foo`).
7. **`koboClient(formKey)` has zero per-form code paths** — adding a third
   form does NOT require touching `lib/kobo.ts`.
8. **Single per-form drawer that reads the active form's discovered fields**
   rather than the 24-key `FeedbackRecord` shape so all forms benefit from
   the lessons.

---

## 4. Pre-implementation prep

These run before any code change.

1. **Rename env var**: `WEWORK_ASSET_UID` → `WEWORK_KOBO_ASSET_UID_DEV` in
   `.env.local` (the implementation reads the new name).
2. **Document prod env names** at the bottom of `.env.local` as comments
   (not active locally):
   ```bash
   # Prod-set names (Vercel env vars). Local dev uses *_DEV fallback.
   # WEWORK_KOBO_ASSET_UID=
   # WEWORK_KOBO_API_TOKEN=
   # WEWORK_KOBO_BASE_URL=
   ```
3. **Move `wework.xlsx` and `wework-data.xlsx`** into
   `lib/dashboards/samples/` (gitignored) once the implementation lands;
   they aren't runtime assets.

---

## 5. Build steps

14 ordered steps. Steps run with `pnpm typecheck` PASS required and a
`code-reviewer-minimax-m3` review at each step boundary.

### Step 1 — Broaden core types [deps: none]

- **Files:** `lib/types.ts`
- **What:** Replace the Cordaid-specific `FeedbackRecord` with `DynamicRecord`;
  introduce `FormConfig` (id, label, envPrefix, dateColumn, searchFields,
  filters, kpis, charts, tableColumns); make per-form `Filters` a generic
  dictionary.
- **Key shape:**

  ```ts
  export type Cell = string | number | null;
  export type DynamicRecord = Record<string, Cell> & {
    _id: number;
    _uuid: string;
    _submission_time: string | null;
  };

  export interface FilterDef {
    key: string;
    label: string;
    type: "select" | "date" | "search";
    sourceColumn?: string;
    span?: number;
  }

  export interface ChartSpec {
    title: string;
    type: "donut" | "horizontal-bar" | "age-bar" | "trend-line";
    sourceColumn: string;
    topN?: number;
  }

  export interface KpiConfig {
    key: string;
    label: string;
    sub: string;
    iconName: string;       // resolved via lucide-react lookup
    accent: string;
    compute: (records: DynamicRecord[]) => Cell;
  }

  export interface TableColumnDef {
    key: string;
    label: string;
    align?: "left" | "right";
  }

  export interface FormConfig {
    id: string;             // "cordaidDemo" | "Wework" | …
    label: string;
    envPrefix: string;      // "KOBO" | "WEWORK_KOBO" | …
    dateColumn: string;     // field for date bounds + trend chart
    searchFields: string[];
    filters: FilterDef[];
    kpis: KpiConfig[];
    charts: ChartSpec[];
    tableColumns: TableColumnDef[];
  }
  ```

- **Defends:** foundational — `DynamicRecord` plus per-form config make
  downstream code unable to assume Cordaid fields. Future forms cannot
  trigger the "every field came back null" symptom.
- **Acceptance:** `pnpm typecheck` passes; old `FeedbackRecord` callers
  refactored in subsequent steps.

### Step 2 — Per-form registry [deps: 1]

- **Files:** `lib/dashboards/cordaidDemo.ts` (new), `lib/dashboards/Wework.ts`
  (new), `lib/dashboards/index.ts` (new).
- **What:** Move the 10 Cordaid charts, 8 KPI tiles, 12 filter dropdowns,
  9 table columns, 14 search fields out of hardcoded constants into
  `cordaidDemo.ts` as a `FormConfig`. Build `Wework.ts` from the survey
  sheet we already read.
- **`Wework.dateColumn = "_submission_time"`** because there's no `Date`
  field in the form. Date bounds, trend chart, and filter defaults all
  hydrate from there.
- **Hard-coded, not auto-discovered** — adding a future form means adding a
  new file. No filesystem scan, no magic.

  ```ts
  // lib/dashboards/index.ts
  import { cordaidDemo } from "./cordaidDemo";
  import { Wework } from "./Wework";
  export const registry: Record<string, FormConfig> = { cordaidDemo, Wework };
  export const DEFAULT_FORM = "cordaidDemo";
  export function getForm(id: string | null | undefined): FormConfig {
    return id && registry[id] ? registry[id] : registry[DEFAULT_FORM];
  }
  ```

- **Acceptance:** `cordaidDemo` config produces observably the same
  dashboard as today when isolated; `Wework` renders meaningfully even with
  sparse data.

### Step 3 — Refactor `lib/kobo.ts` to emit `DynamicRecord` [deps: 1]

- **Files:** `lib/kobo.ts`
- **What:** `normalizeSubmission` writes to an open dictionary, only stamping
  `_id` / `_uuid` / `_submission_time` at the end.

  ```ts
  function normalizeSubmission(
    raw: Record<string, unknown>,
    meta: KoboFormMeta
  ): DynamicRecord {
    const mapped: Partial<DynamicRecord> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (k === "meta" || k.startsWith("_")) { mapped[k] = v as Cell; continue; }
      const valueMap = meta.valueNameToLabel[k];
      let display: Cell = typeof v === "number" ? v
        : typeof v === "string" ? v
        : null;
      if (typeof v === "string" && valueMap
        && Object.prototype.hasOwnProperty.call(valueMap, v)) {
        display = valueMap[v];
      }
      mapped[k] = display;
    }
    mapped._id              = numOf(raw._id) ?? 0;
    mapped._uuid            = strOf(raw._uuid) ?? "";
    mapped._submission_time = strOf(raw._submission_time) ?? null;
    return mapped as DynamicRecord;
  }
  ```

- **Defends:** Bug A/B/C staying neutered — the only data-shape probing
  happens inside `extractLabel` / `byListName` / survey-content walking,
  which were hardened in the prior round of fixes.
- **New risk:** loss of strict PascalCase typing on the consumer side means
  every downstream reader must be tolerant of unknown keys. Steps 5–12
  enforce that with `Cell`-typed accessors.
- **Acceptance:** real Kobo response still produces 23/25 SET fields for
  the previously-fixed record 0 sample (verified end-to-end post step 4).

### Step 4 — `/api/feedback` route, per-form cache [deps: 2, 3]

- **Files:** `app/api/feedback/route.ts`
- **What:** Accept `?form=`, plug into `registry`, resolve env keys with
  `_DEV` → production fallback chain. Wrap `fetchKoboSubmissions` in
  `unstable_cache` tagged per `formKey`.

  ```ts
  export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const form = getForm(searchParams.get("form"));
    const env  = form.envPrefix;
    const assetUid =
      process.env[`${env}_ASSET_UID_DEV`] ??
      process.env[`${env}_ASSET_UID`];
    const baseUrl =
      process.env[`${env}_BASE_URL`] ??
      process.env.KOBO_BASE_URL ??
      "https://kf.kobotoolbox.org";
    const token =
      process.env[`${env}_API_TOKEN`] ??
      process.env.KOBO_API_TOKEN;

    const tag = `kobo-${form.id}`;
    const taggedFetch = unstable_cache(
      async () => fetchKoboSubmissions({ token, assetUid: assetUid!, baseUrl }),
      ["kobo-fetch", form.id],
      { revalidate: 60, tags: [tag] }
    );

    if (!token || !assetUid) return fallback(form, "missing-env");
    try {
      const result = await taggedFetch();
      return NextResponse.json(
        { records: result.records,
          meta: { source: form.id, count: result.records.length,
                  uid: result.uid, name: result.name,
                  version: result.version, baseUrl,
                  fetchedAt: result.fetchedAt,
                  truncated: result.truncated,
                  totalCount: result.totalCount ?? undefined } },
        { headers: CACHE_HEADERS }
      );
    } catch (err) {
      return fallback(form, err instanceof Error ? err.message : "unknown");
    }
  }
  ```

- **Why `unstable_cache`:** Next 14's default route-level cache invalidates
  `/api/feedback` regardless of `?form`. `unstable_cache` keyed on
  `form.id` gives each form its own 60-second window. The tag also opens
  the door to `revalidateTag('kobo-Wework')` for operator-driven
  invalidation.
- **Defends:** cache-collision across forms (the latent risk where Cordaid
  data would silently appear as WeWork). Per-form revalidation tags also
  help in prod when one form's data needs an instant refresh.
- **Acceptance:** `curl /api/feedback?form=cordaidDemo` and
  `?form=Wework` return distinct payloads; cache from one form does not
  pollute the other.

### Step 5 — `DashboardClient` URL hydration, doc title, state reset [deps: 4]

- **Files:** `components/dashboard/dashboard-client.tsx`
- **What:** Read `?form=` via `useSearchParams`. Initialize state from
  `getForm(urlForm)`. On form change, replace ALL `?form, ?gender, ?district, …`
  params (D7). Set `document.title` reactively.

  ```ts
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const formKey = sp.get("form") ?? DEFAULT_FORM;
  const form = getForm(formKey);

  useEffect(() => {
    document.title = `${form.label} · Feedback Dashboard`;
  }, [form]);

  function switchForm(next: string) {
    router.replace(`${pathname}?form=${next}`);
  }

  // `filters` is now Record<string, string>
  const [filters, setFilters] = useState<Record<string, string>>({});
  ```

- **Defends:** invalid `?form=garbage` silently falls back to `cordaidDemo`
  (no broken layout mount). `useSearchParams` makes URL the single source
  of truth (no drift between `Filters` state and `?form`).
- **Acceptance:** switching → URL has only `?form=…`; reload preserves;
  `document.title` updates.

### Step 6 — `FormPicker` component in Header [deps: 5]

- **Files:** `components/dashboard/form-picker.tsx` (new),
  `components/dashboard/header.tsx` (updated).
- **What:** Compact icon button `<Layers▾ {form.label}>` next to the
  record-count chip in the header. Click → dropdown of registered forms.
  Selecting invokes `switchForm()` from step 5.

  ```tsx
  import { Layers, ChevronDown } from "lucide-react";

  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button className="inline-flex items-center gap-2 rounded-full
                         bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
        <Layers className="h-4 w-4" />
        {form.label}
        <ChevronDown className="h-3 w-3 opacity-80" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      {Object.values(registry).map((f) => (
        <DropdownMenuItem
          key={f.id}
          disabled={!hasUsableConfig(f)}
          onSelect={() => switchForm(f.id)}
        >
          <span className="font-semibold">{f.label}</span>
          <span className="text-xs text-cordaid-muted">
            · uid …{currentUidFor(f)?.slice(-6) ?? "—"}
          </span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
  ```

- **Defends:** inactive registry entries (no asset UID configured) show
  in the menu but are **disabled** with an explanatory tooltip. No
  silent "click → nothing happened".
- **Acceptance:** clicking Wework → URL becomes `?form=Wework`, dashboard
  re-mounts with WeWork data.

### Step 7 — Refactor `lib/filters.ts` to be config-driven [deps: 1]

- **Files:** `lib/filters.ts`
- **What:** Rewrite `applyFilters`, `searchRecords`, `uniqueValues`,
  `computeKpis`, `countBy`, `trendByDate`, `ageDistribution`, `toCsv`,
  `downloadCsv` to take the active `FormConfig` as a parameter.

  ```ts
  export function applyFilters(
    records: DynamicRecord[],
    filters: Record<string, string>,
    config: FormConfig
  ): DynamicRecord[] {
    // text search over config.searchFields
    // select matches over config.filters[type="select"]
    // date bounds on config.dateColumn
  }

  export function computeKpis(
    records: DynamicRecord[],
    config: FormConfig
  ): Record<string, Cell> {
    const out: Record<string, Cell> = {};
    for (const kpi of config.kpis) out[kpi.key] = kpi.compute(records);
    return out;
  }

  export function toCsv(
    records: DynamicRecord[],
    config: FormConfig
  ): string {
    const cols = config.tableColumns.length
      ? config.tableColumns.map((c) => c.key)
      : Object.keys(records[0] ?? {}).filter((k) => !k.startsWith("_"));
    /* standard CSV escape */
  }
  ```

- **Defends:**
  - `uniqueValues(records, "Gender")` on WeWork keeps working.
  - `uniqueValues(records, "Channel")` on WeWork returns `[]` (no such
    field) — empty array, dropdown shows only "All channels". No crash.
  - `trendByDate` reads `config.dateColumn` so WeWork's trend chart uses
    `_submission_time` without special-casing.
- **Acceptance:** Cordaid path still produces identical KPI numbers/chart
  data as today.

### Step 8 — `FilterBar` reads config [deps: 7]

- **Files:** `components/dashboard/filter-bar.tsx`
- **What:** Replace the `FILTER_DEFS` constant import with
  `config.filters`. Each `def` produces the matching input. Date inputs
  key off `config.dateColumn`.
- **Acceptance:** switching to Wework flips the filter strip to WeWork's
  fields; switching back flips to Cordaid's.

### Step 9 — `FeedbackTable` reads config [deps: 5, 7]

- **Files:** `components/dashboard/feedback-table.tsx`
- **What:** Replace `COLUMNS` constant with `config.tableColumns`. Sort
  keys are derived from `col.key`. Renders only the columns the active
  form declares.
- **Acceptance:** Wework table has its own column set; Cordaid table has
  its 9 columns as today (with status + emergency badges still wired).

### Step 10 — `KpiCards` reads config [deps: 5, 7]

- **Files:** `components/dashboard/kpi-cards.tsx`
- **What:** Iterate `config.kpis`. Each KPI's `compute` produces its
  value. Icon mapper resolves `iconName` → lucide component.

  ```ts
  const ICON_MAP: Record<string, LucideIcon> = {
    Inbox, CheckCircle2, Clock, AlertTriangle,
    Share2, CalendarDays, Users, Map,
  };
  config.kpis.map((kpi) => {
    const Icon = ICON_MAP[kpi.iconName] ?? Inbox;
    const value = String(kpis[kpi.key] ?? 0);
    /* same tile card markup as today */
  });
  ```

- **Defends:** `config.kpis.length === 0` → render an empty-state tile
  slot, not a broken grid.
- **Acceptance:** 8 tiles for Cordaid (unchanged); WeWork's bespoke tiles
  render meaningfully.

### Step 11 — `Charts` matches spec → schema [deps: 5, 7]

- **Files:** `components/dashboard/charts.tsx`
- **What:** Each `ChartSpec` declares the field it needs. Renderer
  filters specs that don't have data in the current records.

  ```ts
  const renderable = config.charts.filter((spec) =>
    records.some((r) => r[spec.sourceColumn] != null
      && r[spec.sourceColumn] !== "")
  );
  if (renderable.length === 0) {
    return (
      <EmptyState>
        No chart specs match the current form's schema. Either wait for more
        data, or add chart specs to the form's registry entry.
      </EmptyState>
    );
  }
  ```

- **Defends:**
  - A spec that the form doesn't have data for is **silently skipped** —
    no broken ECharts instance with an empty dataset.
  - "No records currently match the form's filter set" vs "no chart specs
    match the form's schema" are two distinct empty states.

### Step 12 — `DetailDrawer` auto-discovers fields [deps: 1, 3]

- **Files:** `components/dashboard/detail-drawer.tsx`
- **What:** Iterate every non-meta key from the record. Render every
  value. `valueMap` translation is already applied upstream in
  `lib/kobo.ts`, so the drawer renders human-readable labels directly.

  ```ts
  const FIELDS_TO_HIDE = new Set(["_id", "_uuid", "_submission_time", "meta"]);
  const displayFields = Object.entries(record)
    .filter(([k]) => !FIELDS_TO_HIDE.has(k));

  // Heuristic + per-form config for long-text fields.
  const longTextKeys = new Set([
    "Description", "Comments", "Notes", "Feedback", /* etc */
  ]);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {displayFields.map(([key, value]) => (
        <Field key={key} label={key}
               value={value}
               full={isLongText(key, value)} />
      ))}
    </section>
  );
  ```

- **Defends:** Hardcoded 24 Cordaid fields → drawer would render 24 boxes of
  `—` for WeWork. Auto-discovery means WeWork's fields all show meaningful
  content. Long-text heuristic can be promoted to per-form config if
  WeWork misclassification surfaces.
- **Acceptance:** click any Wework row → drawer shows all relevant fields
  populated; click any Cordaid row → equivalent to today's drawer
  (verify visually).

### Step 13 — End-to-end verification [deps: 1..12]

- `pnpm typecheck` PASS at every step boundary.
- Local `pnpm dev` against real Kobo: `curl /api/feedback?form=cordaidDemo`
  returns the previously-correct payload (record 0: 23/25 SET).
- `curl /api/feedback?form=Wework` returns whatever WeWork has — no
  crash, no all-null (the sparse sample data is fine).
- Browser smoke (user-side since Chrome is not in the sandbox):
  - `/?form=cordaidDemo` renders as today.
  - Click picker → Wework. URL → `?form=Wework`. Layout rebinds.
  - Switch back. Filters blank. URL `?form=cordaidDemo`.
  - Reload preserves active form.
  - Numeric KPI values match pre-change Cordaid values.
- A `code-reviewer-minimax-m3` review runs in parallel with each step's
  typecheck.

### Step 14 — Commit on `dashPlus`, no push

One commit per step (granular rollback) OR a single squashed multi-file
commit at the end. **No push**, per standing rule.

---

## 6. Expected files touched

### New files

- `lib/dashboards/cordaidDemo.ts`
- `lib/dashboards/Wework.ts`
- `lib/dashboards/index.ts`
- `components/dashboard/form-picker.tsx`
- `DASHPLUS_PLAN.md` (this document)

### Modified files

- `lib/types.ts`
- `lib/kobo.ts`
- `lib/filters.ts`
- `app/api/feedback/route.ts`
- `app/layout.tsx` (default title)
- `components/dashboard/dashboard-client.tsx`
- `components/dashboard/header.tsx`
- `components/dashboard/filter-bar.tsx`
- `components/dashboard/feedback-table.tsx`
- `components/dashboard/kpi-cards.tsx`
- `components/dashboard/charts.tsx`
- `components/dashboard/detail-drawer.tsx`

### Repo housekeeping (last step)

- Move `wework.xlsx` and `wework-data.xlsx` into
  `lib/dashboards/samples/` (gitignored).
- Document the prod env names in a comment block at the bottom of
  `.env.local`.

---

## 7. Open decisions

None as of latest user confirmation. All questions QN1–QN8 and F1–F5 plus
the three UX nitpicks X1–X3 are resolved.

---

## 8. Risks and mitigations

| Risk | Mitigation |
| - | - |
| Cache collision across forms (Cordaid data rendered as WeWork) | `unstable_cache` keyed by `form.id` plus per-form tag for targeted revalidation. |
| Unknown `?form=` URL value breaks layout | `getForm()` falls back to `cordaidDemo` deterministically. |
| Auto-discovery drift (forgetting to add a form to the menu) | Hard-coded registry; explicit `disabled` state on menu items without a usable asset UID. |
| Chart spec for a field that no row has | Per-spec match-on-data filter, plus a distinct empty-state copy. |
| Detail drawer losing semantic ordering across forms | Heuristic long-text detector promotes long fields to `full={true}`; per-form `longTextFields` in `FormConfig` if needed. |
| `lib/kobo.ts` regressing on the prior three fixes | Type definitions enforce `KoboFormMeta` shape; defensive shape-probing utilities are unchanged; same data-pass smoke checks at the ETE gate. |
| WeWork sparse test data making charts render empty | Empty-state copy distinguishes "no data" from "no specs match" so the user can tell the failure mode apart. |

---

## 9. Acceptance summary

- **No regressions** to the existing Cordaid dashboard's output (record
  counts, KPI numbers, chart shapes all identical).
- **Form switching round-trips cleanly**: `cordaidDemo → Wework →
  cordaidDemo` in < 1s with a single `?form=…` URL param change.
- **Filters reset, source chip rebinds, document title rebinds, KPIs
  rebind, charts rebind, table rebinds, drawer rebinds**.
- **Adding a third form is one new file + one registry entry**, with no
  edits to `lib/kobo.ts`, `lib/filters.ts`, or the dashboard components.
- **Type-checks clean**, **code-reviewed** at each step boundary.

---

### Step progress on `dashPlus`

- Step 1 — core types — DONE (commit `a3Fs5PQv…`).
- Step 2 — per-form registry — DONE (cordaidDemo.ts + Wework.ts +
  index.ts).
- Step 3 — `lib/kobo.ts` emits `DynamicRecord` — DONE.
- Step 4 — `/api/feedback` per-form cache + env resolution — DONE.
- Step 5 — `DashboardClient` URL hydration, doc title, state reset —
  DONE.
- Step 6 — FormPicker with a11y polish — DONE (commit `bf1b3fc`).
- **Step 7 + 10 — FormConfig-aware `lib/filters.ts` + KPI tile
  iteration — DONE (commit `ca2bde8`).**
- **Step 8 + 9 — `filter-bar.tsx` reads form.filters +
  `feedback-table.tsx` reads form.tableColumns — DONE (commit
  `7cd0d3d`).** Both bridge aliases dropped; FILTER_DEFS removed from
  lib/constants.ts; TableColumnDef.chip drives Badge rendering
  (Cordaid keeps Status + Emergency badges, WeWork renders plain
  text on all 10 columns). Bundles the new shared
  `boundsForDateColumn(records, column)` helper in lib/filters.ts so
  DashboardClient's filter-state hydration AND filter-bar's per-
  widget min/max normalisation draw from identical YYYY-MM-DD
  bounds — without the shared helper, WeWork's `_submission_time`
  could store full ISO datetime strings in state while filter-bar's
  bounds computed "2026-07-08" for min.
- **Step 11 — `charts.tsx` per-spec data routing — DONE (commit
  `28e5a59`).** Full rewrite: form: FormConfig prop, renderableSpecs
  match-on-data filter, exhaustive `buildOptionForSpec` dispatcher,
  two distinct empty states (records-empty vs specs-empty). Bundles
  `lib/filters.ts` `ageDistribution` parameterization so WeWork routes
  through its snake_case `age` and Cordaid keeps `Age`.
- Step 12 — `detail-drawer.tsx` auto-discovers fields —
  pending. The Cell-coerced Field/StatusBadge signatures are the
  final bridge step that gets cleaned up here.
- Step 13 — End-to-end verification — pending (final typecheck +
  browser smoke).
- Step 14 — Final housekeeping, no push — pending.

_Effective for `dashPlus`. Once #1–14 land and the ETE gate passes,
this branch is ready to merge into `main` and ship._
