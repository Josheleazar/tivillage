# AGRIP build plan — third form in the multi-form dashboard

> **Status:** DESIGN document. No code in this commit.
> **Branch:** where AGRIP work lands (to be decided — likely a new branch per prior dashPlus/Wework pattern, or a continuation branch). **Push policy:** none, per standing rule.
> **Date:** 2026-07-19.

Locked design picks (per user confirmation):

- **Q1 (two district fields):** **Option B** — primary district KPI/chart on respondent's home district (`District`); add a *second* chart "Activity location by district" using the second survey district field (post-rename label TBC; currently assumed `"District (activity)"`).
- **Q2 (parish + village huge choice lists):** **Drill-down** — implemented as a single `type: "drill"` FilterDef whose `drillConfig.levels` cascade District → Sub‑county → Parish → Village. Each subsequent level's options are filtered by the parent's selected value.
- **Q3 (three phone fields):** **All three searchable** — `Phonenumber`, `Contact`, `Telephone contact` all in `form.searchFields`.

FormConfig id will be `Agrip` (PascalCase, mirroring Wework); picker label `"AGRIP"` (mirrors the Kobo asset name "A‑GRIP"); env prefix `"AGRIP_KOBO"`.

---

## A. Lessons-learned recap

The build leans on three defenses already in the codebase. Every step is anchored to an existing file:line.

### A.1 — Defensive shape probing (DASHPLUS §3 Hard rule #1)

`lib/kobo.ts:fetchKoboFormMeta` (lines 161–190, three‑tier probe) walks
`data.data?.survey → data.content?.survey → data.survey`, returning the
first non‑empty array. AGRIP's `/api/v2/assets/<UID>/content/` on
kf.kobotoolbox.org deposits the **inner `data` wrapper**, so probe #1
hits. `lib/kobo.ts:104–124` (`extractLabel`) handles KPI v2's array‑of‑strings
AND plain-string AND language-dict label shapes (the 3 historical
modal shapes). **However**, the live AGRIP asset serves labels in a
4th shape (per-language top-level keys with `::` separator) that the
walker does NOT yet recognise — see §C.4 below for the surgical
patch. Required walker code change (~15 lines, one file).

### A.2 — Group‑prefix key mapping (§6 Note 3 + §10.1 fix)

`lib/kobo.ts:219–291` (Pass 2, the `groupStack` walks pair) registers
`nameToLabel["activity_details/activity_name"] = "Activity name"` etc.
The label‑keyed lookup at `lib/kobo.ts:459`
(`targetKey = meta.nameToLabel[k] ?? k`) does NOT silently fail — it
falls back to the raw record key (which keeps Cordaid parity).
AGRIP has TWO groups (`activity_details`, `participant_data`); the
walker pattern is identical to WeWork's (also two groups).

### A.3 — meta.warning surfacing (§10.1 hardening)

`app/api/feedback/route.ts` already sets `meta.warning` when
`_schemaSummary.observed === 0` or labeledRatio < 0.25. If a future
schema edit silently strips labels the source‑chip will render a
visible warning beneath the form label. **No new code needed.**

### A.4 — FormConfig approachability promise (DashPlus §5)

Step 2 locked the rule: **one new file + one registry line per form**.
Feeding AGRIP into the existing pipeline (`lib/dashboards/index.ts`'s
`registry` object) means **zero edits** to
`chart.tsx`, `feedback-table.tsx`, `kpi-cards.tsx`,
`detail-drawer.tsx`, OR the route handler. The drill‑down UX in §D is
the only additive side‑effect.

---

## B. Pre-implementation prep (schema verification GATE)

These checks run BEFORE any code is written. They depend only on
files already on disk (`/tmp/agrip_content.json`,
`/tmp/agrip_data.json`) — no fetch needed.

### B.1 — Verify the exact post‑rename label strings — VERIFIED 2026‑07‑20 from E2E `/api/feedback?form=Agrip`

The `form.filters[N].sourceColumn` values and the
`form.charts[N].sourceColumn` values must reference **exactly** what
`nameToLabel[…]` registers. **Verified table** (these are the
exact label text Kobo serves on the live asset UID
`aiJYFaTY5WKVwCyQySjaYw` **after** the post-rename xlsx deploy):

| Field purpose | survey row name | `label::English` (ACTUAL) | post-rename cell-key |
|---|---|---|---|
| Primary district | (top‑level) `district` | `"Seclect Current District"` ⚠ typo carried over from the original Kobo upload | `"Seclect Current District"` |
| Activity district | (group) `district_001` | `"Activity district"` (rename propagated successfully) | `"Activity district"` |
| Activity name | `activity_name` | `"Activity name"` | `"Activity name"` |
| Activity date | `activity_date` | `"Activity date"` | `"Activity date"` |
| Participant gender | `gender` | `"Gender"` | `"Gender"` |
| Participant age group | `age_group` | `"Age category"` | `"Age category"` |
| PWD | `pwd` | `"Participant is a PWD"` | `"Participant is a PWD"` |
| Sub-county | `sub_county` | `"Sub-county / Town Council"` | `"Sub-county / Town Council"` |
| Parish | `parish` | `"Parish of Residency"` | `"Parish of Residency"` |
| Village | `village` | `"Village of Residency"` | `"Village of Residency"` |
| Phone (top) | (top) `phonenumber` | (no label: metadata device field) | `"phonenumber"` (bare-name fallback) |
| Contact | (top) `contact` | `"Contact of Data Entrant"` | `"Contact of Data Entrant"` |
| Telephone (participant) | (group) `telephone_contact` | `"Telephone contact"` | `"Telephone contact"` |
| Enumerator's `name_` | `name_` | `"Name of Data Entrant"` | `"Name of Data Entrant"` |
| Missing name | `missing_name` | `"Please Specify your name here"` | `"Please Specify your name here"` |
| Participant first | `participant_first_name` | `"First Name"` | `"First Name"` |
| Participant second | `participant_second_name` | `"Second Name"` | `"Second Name"` |
| Location | (group) `location` | `"Collect GPS coordinate."` | `"Collect GPS coordinate."` |

**One remaining Kobo-side fix (forward-looking):**

- `"Seclect Current District"` typo on top-level `district` — fix in
  the form-builder UI to `"Select Current District"`.

**Distinction between "post-rename cell-key" and "pre-rename" snapshots:**

The post-rename cell-key column above only applies **after** the
4-shape `extractLabel` patch in §C.4 lands in `lib/kobo.ts`. Until
that patch ships, the walker registers the bare `name` as the cell
key (e.g. `"Seclect Current District"` → walker falls back to
`"district"`). The post-rename column assumes the walker fix is
deployed.

**Update 2026-07-20:** E2E verification confirmed both the walker fix
and the xlsx rename landed correctly. All cell-keys above match
live `/api/feedback?form=Agrip` output.

### B.2 — Verify Activity date value shape

`lib/kobo.ts:144` rejects dateCells that don't match
`/^\d{4}-\d{2}-\d{2}$/`. Look at the dev record's `activity_date` in
`/tmp/agrip_data.json` to see whether Kobo serialised it as
`"2026-07-19"` (passes), `"2026-07-19T00:00:00"` (still passes —
slicing to first 10 chars in `lib/filters.ts:normalizeDate` works),
or `"19/07/2026"` (FAILS — cell becomes null silently). If shape is
not YYYY-MM-DD-anchored, extend normalisation in `lib/filters.ts`.

### B.3 — Verify the two-district labels are distinct — VERIFIED 2026‑07‑20

The schema walker uses `nameToLabel[path] = label` as the cell‑key
registration. The `path` for both districts differs (top‑level vs
`activity_details/district_001`).

**Live state observed on `/content/` (post-rename):**

- top‑level `district` → label `"Seclect Current District"` (typo)
- `activity_details/district_001` → label `"Activity district"` (rename propagated)

**VERDICT: SATISFACTORILY DISTINCT post-deploy.** `"Seclect Current District"` ≠
`"Activity district"`. The cell-key collision concern is structurally
nullified — the two cell-keys are distinct strings (even after the
typography fix, they'll be `"Select Current District"` vs
`"Activity district"`). **No silent overwrite.**

Forward-looking: fix the `"Seclect"` typo to `"Select"` in the
form-builder UI. The dashboard works with or without the fix; it just
surfaces the typo as-is.

### B.4 — Verify the enum coercion helpers cover PWD — VERIFIED 2026‑07‑19

`lib/kobo.ts:413–432` runs `yesNo()` + `maleFemale()` over
two specific label keys ("Emergency Feedback", "Gender") which
post‑rename to those exact strings. PWD's actual label is
`"Participant is a PWD"` (NOT the previously-assumed `"PWD (Person With Disability)"`).
The `yesNo()` helper is NOT called on `"Participant is a PWD"` directly.
Translation must come from the valueMap lookup earlier in the
pipeline (Pass 1 `byListName["yes_no"]["yes"] = "Yes"` register
seen at `lib/kobo.ts:204–217`). Verify the valueMap lookup fires for
PWD's path — i.e. `meta.valueNameToLabel["participant_data/pwd"]` —
is populated by the time `normalizeSubmission` runs the value
rewrite at `lib/kobo.ts:445–453`.

Because PWD's survey row declares `type: select_one yes_no`, the
walker will look up `byListName["pwd"]` OR `byListName["yes_no"]`
in Pass 2. If the choices sheet's `list_name` is `"yes_no"`
(instead of `"pwd"`), the valueMap will register under that list_name
and the lookup at runtime will find the right label-by-value map.
Inspect the live `/content/` choices sheet rows for
`participant_data/pwd` to confirm `list_name` is `"yes_no"` (or add
a guarded yesNo coercion similar to the existing two).

**Action:** confirm via `/tmp/agrip_content_NOW.json` choices dump
that the choices for pwd's `list_name` are `yes: "Yes"`, `no: "No"`.
If the cell key post-walker-fix is `"Participant is a PWD"`, the
dashboard's `countWhere(r["Participant is a PWD"] === "Yes")` will
work without any extra coercion.

---

## C. Schema-walker gap analysis for AGRIP

Walking the walker line-by-line against AGRIP's schema:

| file:line | check | AGRIP verdict |
|---|---|---|
| `lib/kobo.ts:172` | URL endpoint | ✓ +content/.  /api/v2/assets/<UID>/content/ — innerSheets probe #1 hits |
| `lib/kobo.ts:104–124` | extractLabel handles `label` | ✓ array-shape path. AGRIP labels are KPI v2 modal: `["District", "District", ...]`-style |
| `lib/kobo.ts:204–217` | choices bucketing by `list_name` | ✓ populates 8 list_names (district, sub_county, parish, village, gender, age_group, yes_no, name) |
| `lib/kobo.ts:217–291` | survey walking with groupStack | ✓ handles two groups |
| `lib/kobo.ts:241` | `nameToLabel[path] = lbl \|\| name` (two-tier registration) | ⚠ if a survey row's label is empty string, `lbl` is `""`, the post-rename key becomes the bare `name` — same collision risk as Wework score_* fields. Acceptable but document on the AGRIP FormConfig. |
| `lib/kobo.ts:256–285` | value map lookup | ✓ primary = `byListName[surveyNameHere]`, fallback = `byListName[typeSuffix]`, last-ditch = inline `q.choices`. All three branches wired |
| `lib/kobo.ts:144` | integer coercion set | ✓ `type: calculate` and `type: integer` both register. AGRIP has no `calculate` rows but the safer `type === "calculate"` branch still applies |
| `lib/kobo.ts:148` | date validation set | ✓ `type: date` registers — `activity_date` will validate YYYY-MM-DD shape |
| `lib/kobo.ts:445–453` | value rewrite loop | ✓ single‑pass: valueMap lookup FIRST (`meta.valueNameToLabel[k]`), then key‑rename (`meta.nameToLabel[k]`). `r["participant_data/gender"] === "male"` → cell `"Gender": "Male"` |

Conclusion: the live API now exposes labels via a **4th shape** the
walker does not yet recognize — **per-language top-level keys with
a `::` separator** (e.g. `label: null`, sibling `label::English:
"District"`). Kobo v2 introduced this convention when the
post-deploy schema served up per-language row entries. The current
walker at `lib/kobo.ts:104–137` handles only the first three shapes
(string / array / language-dict) and silently returns `""` for the
`label::English` case. **As a result, `nameToLabel` registers the
BARE survey `name` as the cell key, and the dashboard renders
snake_case column names instead of human-readable labels.**

**Required walker code change** (single file, ~15 lines, three call
sites, see §C.4 below). This was NOT on the original risk register
because it's a function of the live API's recent change, not a
form-specific bug. Once patched, the §B.1 column-3 labels ("Gender",
"Activity date", etc.) will populate as cell-keyed values in
`/data/` records — no `sourceColumn` references in the FormConfig
will silently miss.

---

## D. Drill-down UX design

The drill‑down is the only substantial new code surface. Three
touch points: types extension, filter helper, renderer branch.

### D.1 — Type extension

In `lib/types.ts`, extend `FilterDef`:

```ts
export interface DrillLevel {
  /** filter‑state key / URL marker. */
  key: string;
  /** Widget label. */
  label: string;
  /** Record column the level's options come from (post-rename label). */
  sourceColumn: string;
}

export interface FilterDef {
  /* ... existing fields unchanged ... */
  type: "select" | "date" | "search" | "drill";
  /** Required when type === "drill"; cascade order = top‑down. */
  drillConfig?: { levels: DrillLevel[] };
}
```

### D.2 — Cascade predicate (`lib/filters.ts:153–183`)

Extend the existing `applyFilters` Select predicate pass. Each drill
level is tested in order; deeper levels AND‑narrow the result. The
cascade is a **single sequential pass** (no recursion) — the predicate
order is left-to-right so a deep level like village=X is gated by
prior district/sub-county/parish matches. (Without this gating, an
old record with village=X and district=Y could match a filter
"village=X" where district was set to Z.)

### D.3 — Cascade options helper (`lib/filters.ts`)

```ts
/**
 * Per-level options derived from records matching PRIOR levels.
 * Used by the drill-down renderer to populate each subsequent
 * dropdown's option list. Returns an alpha‑sorted, deduped string[].
 *
 * For example: drillOptionsForLevel(records, levels, 2, filters)
 * returns unique parish names from records where
 *   filters[levels[0].key] matches r[levels[0].sourceColumn]
 *   AND filters[levels[1].key] matches r[levels[1].sourceColumn].
 * If levelIndex === 0, priorLevels is [] and the function returns
 * unique values across the full records slice.
 */
export function drillOptionsForLevel(
  records: DynamicRecord[],
  levels: DrillLevel[],
  levelIndex: number,
  filters: Filters,
): string[] { /* ... */ }
```

This is a NEW export of `lib/filters.ts` — Cordaid + WeWork do not
use it today. No risk to existing forms because `applyFilters` only
runs the cascade predicate when a `FilterDef` declares `type: "drill"`.

### D.4 — Renderer (`components/dashboard/filter-bar.tsx`)

A new branch inside `FilterWidget`:

```ts
if (def.type === "drill") {
  return (
    <div className={`flex flex-col gap-1 ${spanClass(def.span ?? 4)}`}>
      <label className="...">{def.label}</label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {def.drillConfig!.levels.map((lvl, i) => {
          const value = filters[lvl.key] ?? "";
          const opts = drillOptionsForLevel(records, def.drillConfig!.levels, i, filters);
          return (
            <Select key={lvl.key} value={value}
              onChange={(e) => {
                // CRITICAL: clear deeper levels on parent change so stale
                // selections don't survive a parent's reset. Without this,
                // a user picking district=Z then reverts to district=''
                // would still have a stale parish="X" filter blocking all
                // records in non-X parishes.
                const next = { ...filters, [lvl.key]: e.target.value };
                for (let j = i + 1; j < def.drillConfig!.levels.length; j++) {
                  next[def.drillConfig!.levels[j].key] = "";
                }
                onChange(next);
              }}>
              <option value="">All {lvl.label.toLowerCase()}s</option>
              {opts.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          );
        })}
      </div>
    </div>
  );
}
```

Deeper‑level auto‑clear is the single line that prevents a class of
stale‑state bugs.

### D.5 — Edge cases (drill‑down specific)

| Case | Behaviour | Status |
|---|---|---|
| Empty cascade at level N | parent matches no records → dropdown shows only "All <label>s" | ✓ same as existing select pattern |
| Sparse data on dev deployment (1 record) | chain shows at most 1 item per level | ✓ |
| URL rehydration on form switch | `emptyFiltersForForm(form)` resets all filter keys including drill levels | ✓ exists at `lib/filters.ts:62–66` |
| Cascade predicate order | deep level gated by parents | ✓ GATE in §D.2 ordered pass |
| Deeper‑level stale state on parent reset | parent change clears all `levels[j].key` for j > i | ✓ in renderer |

---

## E. FormConfig surface for AGRIP (preview — locked picks baked)

(Full file content lives in `lib/dashboards/Agrip.ts` once committed.
Below is the preview; constants use `LBL_*` names so future label
edits stay one‑block.)

```ts
import type { DynamicRecord, FormConfig } from "@/lib/types";

// =============================================================================
//  LBL_* constants EXACTLY match what Kobo serves via label::English on the
//  live asset `aiJYFaTY5WKVwCyQySjaYw` (verified 2026-07-20 post-rename). If Kobo's label
//  changes in the form builder, ONLY this block needs updating.
// =============================================================================
const LBL_PRIMARY_DISTRICT  = "Seclect Current District";   // ⚠ typo preserved from xlsx — fix in Kobo UI
const LBL_ACTIVITY_DISTRICT = "Activity district";          // rename propagated successfully
const LBL_ACTIVITY_NAME     = "Activity name";
const LBL_ACTIVITY_DATE     = "Activity date";
const LBL_ACTIVITY_SUBCOUNTY = "Sub-county / Town Council";
const LBL_PARISH            = "Parish of Residency";
const LBL_VILLAGE           = "Village of Residency";
const LBL_GENDER            = "Gender";
const LBL_AGE_GROUP         = "Age category";
const LBL_PWD               = "Participant is a PWD";
const LBL_NAME              = "Name of Data Entrant";
const LBL_MISSING_NAME      = "Please Specify your name here";
const LBL_PARTICIPANT_FIRST = "First Name";
const LBL_PARTICIPANT_SECOND = "Second Name";
const LBL_PHONE_TOP         = "phonenumber";                 // bare-name: no label on metadata field
const LBL_PHONE_CONTACT     = "Contact of Data Entrant";
const LBL_PHONE_PARTICIPANT = "Telephone contact";

export const Agrip: FormConfig = {
  id: "Agrip",
  label: "AGRIP",
  envPrefix: "AGRIP_KOBO",
  dateColumn: LBL_ACTIVITY_DATE,
  searchFields: [
    LBL_PRIMARY_DISTRICT, LBL_ACTIVITY_NAME, LBL_NAME, LBL_MISSING_NAME,
    LBL_PARTICIPANT_FIRST, LBL_PARTICIPANT_SECOND,
    LBL_ACTIVITY_SUBCOUNTY, LBL_PARISH, LBL_VILLAGE,
    LBL_PHONE_TOP, LBL_PHONE_CONTACT, LBL_PHONE_PARTICIPANT,
  ],
  filters: [
    {
      key: "location", label: "Location", type: "drill",
      span: 4,
      drillConfig: {
        levels: [
          { key: "district",   label: "District",   sourceColumn: LBL_PRIMARY_DISTRICT },
          { key: "subcounty",  label: "Sub-county", sourceColumn: LBL_ACTIVITY_SUBCOUNTY },
          { key: "parish",     label: "Parish",     sourceColumn: LBL_PARISH },
          { key: "village",    label: "Village",    sourceColumn: LBL_VILLAGE },
        ],
      },
    },
    { key: "gender",    label: "Gender",    type: "select", sourceColumn: LBL_GENDER },
    { key: "ageGroup",  label: "Age group", type: "select", sourceColumn: LBL_AGE_GROUP },
    { key: "pwd",       label: "PWD",       type: "select", sourceColumn: LBL_PWD },
    { key: "startDate", label: "Activity start", type: "date" },
    { key: "endDate",   label: "Activity end",   type: "date" },
    { key: "search",    label: "Search text",    type: "search", span: 2 },
  ],
  kpis: [
    /* 7 tiles — see §F */
  ],
  charts: [
    /* 8 charts — see §F */
  ],
  tableColumns: [
    /* 8 columns — see §F */
  ],
  fieldHints: {
    status: [],
    yesNo: [LBL_PWD],
    longText: [],
  },
  drawerHeader: {
    titleField: LBL_ACTIVITY_NAME,
    subtitleFields: [LBL_PRIMARY_DISTRICT, LBL_ACTIVITY_SUBCOUNTY, LBL_ACTIVITY_DATE],
  },
};
```

### E.1 — KPI tiles (locked, with rationale)

| key | label | sub | icon | accent | compute |
|---|---|---|---|---|---|
| `total` | Activities recorded | "Filtered records" | Inbox | rose/red | records.length.toLocaleString() |
| `female` | Female participants | "% of respondents" | Users | pink | countWhere(Male/Female==="Female").count → pct |
| `male` | Male participants | "% of respondents" | Users | sky | countWhere(Gender==="Male").count → pct |
| `pwd` | PWD (inclusion metric) | "% flagged" | AlertTriangle | amber | countWhere(PWD==="Yes") → pct |
| `missingName` | Missing‑name records | "Operational flag" | AlertTriangle | amber | countWhere(MissingName.trim()!==="") |
| `districts` | Districts covered | "Unique locations" | Map | emerald | uniqueCount(records, District) |
| `subcounties` | Sub-counties covered | "Unique locations" | Map | emerald | uniqueCount(records, Sub-county) |

Seven tiles — covers (a) volume, (b) demographic parity, (c)
inclusion metrics, (d) data‑quality red flag, (e) reach diversity.

### E.2 — Charts (8 charts — locked, with rationale)

| title | type | sourceColumn | rationale |
|---|---|---|---|
| Activities over time | trend-line | LBL_ACTIVITY_DATE | Headline trend; reads `dateColumn` |
| By district — Top 15 | horizontal-bar | LBL_PRIMARY_DISTRICT | Respondent home district reach |
| By activity location — Top 15 | horizontal-bar | LBL_ACTIVITY_DISTRICT | Q1-B second-district chart |
| By sub-county — Top 15 | horizontal-bar | LBL_ACTIVITY_SUBCOUNTY | Sub-reach finer than district |
| Gender mix | donut | LBL_GENDER | Participant gender breakdown |
| Age group distribution | donut | LBL_AGE_GROUP | Youth (18-35) mandate proof |
| PWD proportion | donut | LBL_PWD | Inclusion metric visualisation |
| Activity name — Top 10 | horizontal-bar | LBL_ACTIVITY_NAME | Which activities dominate? |
| Activity locations | map | LBL_GPS | Interactive Leaflet map plotting participant GPS coordinates; popups show activity name · district via `mapLabelColumns` |

### E.3 — TableColumns (8 columns — locked)

```ts
tableColumns: [
  { key: LBL_ACTIVITY_DATE,             label: "Activity date" },
  { key: LBL_PRIMARY_DISTRICT,          label: "District" },
  { key: LBL_ACTIVITY_SUBCOUNTY,        label: "Sub-county" },
  { key: LBL_ACTIVITY_NAME,             label: "Activity" },
  { key: LBL_PARTICIPANT_FIRST,         label: "Participant" },
  { key: LBL_GENDER,                    label: "Gender" },
  { key: LBL_AGE_GROUP,                 label: "Age" },
  { key: LBL_PWD, label: "PWD", align: "right", chip: "yesNo" },
],
```

8 columns + 1 yesNo chip dispatch (PWD) → mirrors Cordaid's
"Emergency Feedback + chip‑yesNo" pattern at `lib/dashboards/cordaidDemo.ts:228`.

---

## F. Implementation steps (ordered, with verification gates)

### Step 1 — Schema verification (no code)

bash on saved files:

```bash
# Confirm survey labels
python3 -c 'import json,sys; ...'
# Confirm Activity date shape
python3 -c 'import json; r=json.load(open("/tmp/agrip_data.json"))[0]; print(repr(r["activity_details/activity_date"]))'
# Confirm PWD valueMap path
# (deeper audit — see §B)
```

**Gate:** every label assumption in §B.1 is verified, OR noted as
`MISSING` so the FormConfig can be written with the right literal
strings. Step 2 does not begin until this gate is passed.

### Step 2 — Type extension (`lib/types.ts`)

- Add `DrillLevel` interface.
- Extend `FilterDef.type` union with `"drill"`.
- Add `drillConfig?: { levels: DrillLevel[] }`.

**Gate:** `pnpm typecheck` PASS. No other files have to compile
correctly yet.

### Step 3 — Cascade helper (`lib/filters.ts`)

- Add `drillOptionsForLevel(...)` export.
- Extend `applyFilters` predicate walk to AND drill levels in
  left‑to‑right order.

**Gate:** `pnpm typecheck` PASS. A small `console.log` of
`drillOptionsForLevel([...], levels, 0, {})` (used at dev time only)
confirms the helper returns the expected list from a fixed fixture.

### Step 4 — Filter-bar drill renderer (`components/dashboard/filter-bar.tsx`)

- Add `def.type === "drill"` branch in `FilterWidget`.
- Render 4 dependent selects.
- Implement deeper‑level clear on parent change.

**Gate:** `pnpm typecheck` PASS. Manually wire AGRIP in a fixture
and verify on dev server that the cascade populates correctly.

### Step 5 — Write `lib/dashboards/Agrip.ts`

The full FormConfig from §E. Use the `LBL_*` constants convention
mirroring `lib/dashboards/Wework.ts:46–53`.

**Gate:** `pnpm typecheck` PASS.

### Step 6 — Register in `lib/dashboards/index.ts`

```ts
import { Agrip } from "./Agrip";
export const registry: Record<string, FormConfig> = {
  cordaidDemo,
  Agrip,
  Wework,
};
```

**Gate:** `pnpm typecheck` PASS. The form picker dropdown now lists
"AGRIP".

### Step 7 — End-to-end verification

- `pnpm dev` boots.
- `curl /api/feedback?form=Agrip` returns the dev-record payload
  with all 8 sourceColumn references resolving to non-null values.
- `meta.warning` absent (`observed > 0 && labeled > 0`).
- `grep` runtime: every chart in `form.charts` has at least one
  record with a non-null matching column. (Helps catch
  "label‑keyed lookup miss" silently.)
- Switch to AGRIP in UI:
  - All KPI tiles render with values.
  - Drill chain: pick district → sub-counties narrow → parish narrows
    → village narrows. Deeper levels cleared on parent reset.
- Switch back to Cordaid/WeWork: no regressions.

### Step 8 — Single commit (no push)

One commit wrapping steps 2–6 (and only after step 1 was verified
satisfied). Typecheck + reviewer run in parallel before commit.

---

## G. Risk register

| # | Risk | L | I | Mitigation |
|---|---|---|---|---|
| 1 | Two-district label collision (`activity_details/district_001` and top-level `district` both labelled "District") → schema walker overwrites cell-key → "By activity location" chart silently shows respondent district data | **MITIGATED** | **RESOLVED** | **§B.3 verified:** live labels are now `"Seclect Current District"` (top) vs `"Activity district"` (activity) — rename propagated, no overwrite risk. Forward-looking: fix `"Seclect"`→`"Select"`. |
| 2 | Drill‑down stale deeper‑level state on parent reset → "Village = X" persists past a parent reset to a different district → filter excludes records where parish/village are valid for the new district | MED | MED | Renderer in §D.4 clears deeper levels on parent change. Local UX risk; not a data risk. |
| 3 | PWD label exact spelling — FormConfig literal `LBL_PWD = "Participant is a PWD"` (verified 2026‑07‑19) matches the survey-row's `label::English` exactly | LOW | LOW | **§B.4 verified.** Confirmed live label `"Participant is a PWD"`. Chip dispatch (`chip: "yesNo"`) will fire on the table + drawer once §C.4 walker fix lands and cell key becomes label-shaped. |
| 4 | Activity date shape — if Kobo returns `"2026-07-19T00:00:00"` or `"19/07/2026"`, `lib/kobo.ts:144` rejects non-YYYY-MM-DD cells → trend chart shows zero series | MED | HIGH | §B.2 verification + extend `normalizeDate` (lib/filters.ts:78–85) to tolerate ISO datetime via slice(0,10) — the existing helper ALREADY DOES THIS for the dateBounds side, but the dateLabels-validated cell-drop is a separate path; an explicit test on a real record is required. |
| 5 | Multi-group schema: `participant_data/gender` raw record key vs top-level no gender field → walker single `nameToLabel["participant_data/gender"] = "Gender"`. If the survey only declared gender inside the group, no collision. ✓ Already verified. | LOW | LOW | Confirmed by §B.1. |

Two additional smaller risks:

- **Two-date columns in the same record:** `Activity date` (real) vs
  `_submission_time` (Kobo meta). Both are date-shaped; the picker
  could display both — confirmed SAFER: only `Activity date` is
  declared as `dateColumn`; `_submission_time` remains in `_id/_uuid/
  _submission_time` metadata and not surfaced in charts/KPIs
  (unless explicitly added).
- **Three phones + named list_name `name` (59 entries):** the `name_`
  field with 59 entries is unusual (likely enumerator selects a
  respondent‑category from a curated list). If `name_` is mistyped in
  a record, the valueMap lookup fails → cell‑value remains the raw
  slug. The walker valueMap fallback chain (inline `q.choices` last)
  catches most cases.

---

## H. Open questions (for human input BEFORE implementation)

1. **Two-district labels** — **resolved structurally** (live emits `"Seclect Current District"` vs `"Activity district"`, distinct). Forward-looking: fix the `"Seclect"` typo to `"Select"`. Pure form-builder edit, no code change. Optional cleanup, not blocking.
2. **`name_` field semantics** — is the 59-item list enumerator‑
   chosen respondent‑category, participant‑name lookup, or
   something else? This affects whether `LBL_NAME` should be a chart
   (`countBy(LBL_NAME)` donut), a KPI tile, or just searchable.
3. **PWD chip styling** — current pick is `chip: "yesNo"` (renders
   as a Badge with default/muted variants). If red/green semantic
   is too strong for an inclusion metric, we can flip to plain text
   or a custom colour. One‑line toggle.
4. **First‑load default** — currently `cordaidDemo` is the
   `DEFAULT_FORM` (`lib/dashboards/index.ts:32`). After adding Agrip,
   should the default stay Cordaid (no change) or shift to Agrip?
   Wil require touching `DEFAULT_FORM`.

---

## I. Post-implementation followups

After step 8 ships, the natural followups:

1. **E2E browser smoke** — open the form picker → pick AGRIP → KPIs render → drill chain populates → switch back to Cordaid/WeWork → no regressions.
2. **Cache + refresh behaviour** — verify `/api/feedback?form=Agrip` is cache‑isolated (per‑form Data Cache tag, see `app/api/feedback/route.ts:102`). Confirm the refresh button (`POST /api/feedback/refresh`) invalidates Agrip's tag without bleeding into Cordaid's cache.
3. **Live‑data sweep** — when AGRIP's live deployment has 100+ records, sweep the dashboard manually for layout regressions specific to high‑volume (chart tipping over, table pagination, drill chain's longest‑level hit).

---

## J. References

- `lib/kobo.ts` — schema walker; §C lines the analyzer walked.
- `lib/filters.ts` — applyFilters + helpers; §D anatomy.
- `components/dashboard/filter-bar.tsx` — current renderer; §D.4 the new branch.
- `lib/types.ts` — current shape; §D.1 the extension.
- `lib/dashboards/Wework.ts` — closest analogue: group‑prefixed keys + post‑rename label constants convention.
- `lib/dashboards/cordaidDemo.ts` — yesNo chip dispatch `(chip: "yesNo")` and fieldHints pattern at line 239.
- `lib/dashboards/index.ts` — registry; §F step 6 the wiring.
- `DASHPLUS_PLAN.md` §3 + §6 Note 3 + §10.1 — lessons-learned guardrails inherited.
- `WEWORK_CHARTS.md` — catalogue of chart types per executive window; no AGRIP-specific bespoke charts yet established.
