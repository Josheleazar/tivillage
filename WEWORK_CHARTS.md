# WeWork dashboard — high-value chart catalogue

> **Status:** DESIGN ONLY. No code in this commit — recommendations only.
> **Scope:** WeWork form (the entrepreneurship-screening programme) only.
> Cordaid's dashboard is untouched. Adding any of the 11 entries below is
> additive to `lib/dashboards/Wework.ts:charts[]` + the corresponding
> helper in `lib/filters.ts`.
>
> **Branch:** `main`. **Push policy:** none (docs-only commit, follows
> the standing rule). **Date:** 2026-07-15.

This document is the response to the executive-visualisation question:
"what other high-value charts and visualizations would deliver more value
to an executive viewing the WeWork dashboard?" The 11 entries below
are ranked by ★executive impact★. The two Top-3 lists at the end split
the picks by ★exec attention window★ (5-second phone glance vs 60-second
laptop drill-in) because the optimal visual differs materially.

---

## 1. What WeWork already covers (so we don't duplicate)

The current WeWork dashboard ships:

- **7 KPI tiles**: total screened, vulnerable, refugee, female, average
  age, average selection score, districts covered
- **7 charts**: trend-by-submission-date (trend-line), top-15 district
  (horizontal-bar), business-type (donut), vulnerability-profile
  (donut), refugee-vs-host (donut), gender mix (donut), age distribution
  (age-bar)

The 11 entries that follow are **net-new** insight axes the current
set does not surface.

---

## 2. The 11 ranked recommendations

### #1 — Cohort Pipeline Funnel  ★5-second exec pick★

- **Executive rationale:** Instantly visualises pipeline collapse —
  "we screened 8,000 → flagged 1,200 vulnerable → have a written plan
  480 → scored above threshold 92". The conversion drop-off is the
  headline story every exec wants.
- **ChartSpec shape:**

  ```ts
  {
    title: "Milestone Conversion",
    type: "funnel",
    sourceColumn: "synthetic_pipeline",  // synthetic key; spec.events
                                        // drives the actual stages
    events: [
      { label: "Screened",  predicate: "score_age>0" },
      { label: "Vulnerable", predicate: "vuln!=None" },
      { label: "Has plan",  predicate: "score_plan>0" },
      { label: "High score", predicate: "total_score>=80" },
    ],
  }
  ```

- **Aggregation:** NEW helper `cohortFunnel(records, stages)` where
  `stages: Array<{ label: string, predicate: (r) => boolean }>`. Each
  predicate runs as a count against the filtered slice.
- **Data prerequisite:** filtered slice; events stage definitions
  live in `Wework.ts`.
- **Implementation cost:** new helper + new `ChartType` (`"funnel"`)
  in `lib/types.ts` + ECharts funnel option in
  `components/dashboard/charts.tsx:buildOptionForSpec`.
- **Risk:** Last-bucket thinness on low-data periods renders as an
  invisible sliver; minimum-bucket-height fallback needed. Legend
  collision when 5+ stages; keep stages ≤ 4.

### #2 — Selection Score Distribution (Histogram)  ★60-second exec pick★

- **Executive rationale:** Where to draw the cutoff line. A bell
  shows cohort health; bimodal shows scoring polarisation; a single
  pillar shows everyone clumped at the same value (config error).
- **ChartSpec shape:**

  ```ts
  {
    title: "Selection score distribution",
    type: "histogram",
    sourceColumn: "total_score",
    binCount: 10,
  }
  ```

- **Aggregation:** NEW helper `scoreHistogram(records, col, bins=10)`.
  ECharts render as `bar` with `barGap: "-100%"` to overlay a density
  curve.
- **Data prerequisite:** filtered slice; rows where `total_score` is
  parseable as number. Drop NaN.
- **Implementation cost:** new helper + new `ChartType` (`"histogram"`).
- **Risk:** Tight score clustering → degenerate single-bar pillar.
  Min-bin-width fallback of 5% of dataset.

### #3 — Selection Cohort Hotspot (Heatmap)  ★60-second exec pick★

- **Executive rationale:** Where do the strongest, most investable
  cohorts live? Hover over District × Vulnerability (or × Business-type,
  × Status) cell to see the mean composite score for that cross-cut.
  Tells regional directors where to deploy extra capacity next week.
- **ChartSpec shape:**

  ```ts
  {
    title: "Cohort strength: District × Vulnerability",
    type: "heatmap",
    rowColumn: "District",
    columnColumn:
      "Select vulnerability (Teenage mother, PLWD, Lactating mother)",
    metricColumn: "total_score",
  }
  ```

- **ChartSpec extension:** add optional `rowColumn?`, `columnColumn?`,
  `metricColumn?: string` to `ChartSpec`. Existing entries stay
  source-compatible (they default to `sourceColumn`).
- **Aggregation:** NEW helper `crossTabAvg(records, rowCol, colCol,
  metricCol): Array<{ row, col, value, n }>`.
- **Data prerequisite:** filtered slice.
- **Implementation cost:** new helper + new `ChartType` (`"heatmap"`) +
  small `ChartSpec` type extension.
- **Risk:** Sparsity — empty rows render as zero and can mislead. Add
  a min-cell threshold (n ≥ 5) grey-out before plotting.

### #4 — Demographic Pyramid (Age × Gender)  ★5-second exec pick★

- **Executive rationale:** The "funder-friendly" demographic visual.
  Validates the 18–35 youth outreach mandate AND gender parity in a
  single vertical chart. Vertical layout is mobile-friendly.
- **ChartSpec shape:**

  ```ts
  {
    title: "Youth reach (age × gender)",
    type: "population-pyramid",
    rowColumn: "Gender of applicant",
    columnColumn: "What is your age?",
    buckets: ["18–24", "25–29", "30–35"],
  }
  ```

- **Aggregation:** NEW helper `dualAgeDistribution(records, ageCol,
  genderCol, buckets)`. Male-side counts negated for left-side rendering.
- **Data prerequisite:** filtered slice; out-of-range ages (e.g. `188`)
  clamped or dropped.
- **Implementation cost:** new helper + new `ChartType`
  (`"population-pyramid"`) + ChartSpec extension.
- **Risk:** Data-entry typos (`Age: 188`) blow the Y axis unless
  clamped aggressively.

### #5 — Beneficiary Cohort × Enterprise Heatmap

- **Executive rationale:** Are the programme's enterprise offerings
  aligned with what applicants actually want to do? Cross-tab
  business phase × enterprise picks.
- **ChartSpec shape:** quantum-analogous to #3 with `metricColumn:
  undefined` (count mode) and `columnColumn = "If yes, which of the
  following value chain or enterprises is business focusing on?"`.
- **Aggregation:** REUSES `crossTabAvg` from #3 if you add a
  `mode: "count" | "avg"` discriminator; otherwise a one-line
  `crossTabCount` helper.
- **Cost:** ~0 lines if #3 already shipped (share the helper).
- **Risk:** Enterprise list is long (9 choices). Y-axis labels rotate
  on small screens; consider a horizontal heatmap variant.

### #6 — Score Breakdown Stacked Bar  ★60-second exec pick★

- **Executive rationale:** *Why* is a cohort scoring high or low?
  Strong on `score_idea` but failing on `score_revenue`? Drives
  curriculum and scoring-weight decisions for the next cohort.
- **ChartSpec shape:**

  ```ts
  {
    title: "Score drivers by district",
    type: "stacked-bar",
    rowColumn: "District",
    metricColumns: [
      "score_age",
      "score_gender",
      "score_vuln",
      "score_idea",
      "score_plan",
      "score_revenue",
    ],
  }
  ```

- **ChartSpec extension:** add optional `metricColumns?: string[]`.
- **Aggregation:** NEW helper `stackedScoreAverages(records, groupCol,
  metricCols[]): Array<{ group: string, byMetric: Record<string, number> }>`
- **Cost:** ChatSpec field addition + new helper + new `ChartType`
  (`"stacked-bar"`).
- **Risk:** Legend collision — manually curate `metricColumns` to
  5–6 driver categories; do NOT include all 14 score_* fields.

### #7 — Core Mandate Pipeline Strip (KPI Gauges)  ★5-second exec pick★

- **Executive rationale:** Distills critical donor mandates into a
  single row of red/green progress bars showing point-in-time
  distance-to-target. "Did we hit 50% women this period?"
- **ChartSpec shape:**

  ```ts
  {
    title: "Mandate progress",
    type: "kpi-gauge",
    targets: [
      { label: "Female ≥40%", predicate: "gender=Female", targetPct: 40 },
      { label: "Youth ≤35", predicate: "age<=35", targetPct: 90 },
      { label: "Vulnerable ≥30%", predicate: "vuln!=None", targetPct: 30 },
    ],
  }
  ```

- **ChartSpec extension:** add optional `targets?: Array<{ label,
  predicate, targetPct }>`.
- **Aggregation:** NEW helper `computeTargetProgress(records, targets[])`.
- **Cost:** ChatSpec field addition + new helper + new `ChartType`
  (`"kpi-gauge"`) OR implemented as plain React (probably cleaner — see Risk).
- **Risk:** Hard-coded targets rot fast — put them in a
  `programmeMandates: Array<{label, predicate, targetPct}>` block at the
  top of `Wework.ts` so editors see them in one place.
- **Alternative implementation:** rather than ECharts, render five
  horizontal progress bars in a React component. Faster to ship +
  cleaner with the dashboard's existing Card/CardTitle styling.

### #8 — Cohort-Relative Equity Divergence

- **Executive rationale:** Identifies structural selection-tool bias
  by showing if vulnerable cohorts (PLWD, teenage mothers) score
  significantly below the pool mean. Donor-friendly, ethics-friendly.
- **ChartSpec shape:**

  ```ts
  {
    title: "Equitable selection check",
    type: "diverging-bar",
    rowColumn: "Select vulnerability (Teenage mother, PLWD, Lactating mother)",
    metricColumn: "total_score",
  }
  ```

- **Aggregation:** NEW helper `varianceFromMean(records, groupCol,
  metricCol): Array<{ group, meanDeltaPct, n }>`.
- **Cost:** new helper + new `ChartType` (`"diverging-bar"`) +
  ChartSpec extension.
- **Risk:** Tiny cohorts (PLWD: 4 applicants) display ±50% deltas.
  Add a min-N filter (n ≥ 10) before plotting.

### #9 — Geographic Choropleth / Dot Map

- **Executive rationale:** Hard proof of geographical reach.
  Politicians and regional partners love to "see" the footprint.
- **ChartSpec shape:**

  ```ts
  {
    title: "Reach density",
    type: "choropleth",
    sourceColumn: "gps_location",
  }
  ```

- **Aggregation:** NEW helper `extractGeoPoints(records, col)` that
  parses `"lat lng elev prec"` to `[lng, lat]` and dedues by
  subcounty.
- **Cost:** new helper + new `ChartType` (`"choropleth"`) + Uganda
  GeoJSON asset (~50–200 KB) bundled with the app + scale-clipping
  logic so dirty GPS doesn't dominate the view.
- **Risk:** A respondent clicking GPS in Kampala for a rural entry
  will zoom to the whole country. Pre-filter on `gpsLocation !== null`
  AND verify `subcounty` matches the district tile selected.
- **Defer:** Feature-creep risk. Recommend deferring to v2 once the
  pointed-marker dot map (superimposed on existing horizontal-bar
  district chart) ships as a smaller-scope counterpart.

### #10 — Time-Series with Event Overlay

- **Executive rationale:** *Why* did we spike last Tuesday? Annotate
  the trend line with programme milestones (radio campaign start,
  partner NGO onboarded, etc.) so the audience understands causality.
- **ChartSpec shape:**

  ```ts
  {
    title: "Screening velocity",
    type: "trend-line",
    sourceColumn: "_submission_time",
    events: [
      { date: "2026-03-15", label: "Radio Campaign" },
      { date: "2026-04-22", label: "Partner NGO onboarded" },
    ],
  }
  ```

- **ChartSpec extension:** add optional `events?: Array<{ date: string,
  label: string }>`. Existing trend-line entries default to no events
  so source-compatible.
- **Aggregation:** REUSES `trendByDate` from `lib/filters.ts`.
- **Cost:** ~5 lines. Extend `buildLineOption` in
  `components/dashboard/charts.tsx` with `series[0].markLine.data`
  reading from `spec.events`.
- **Risk:** Events list rots without a maintainer — put them in a
  `programmeMilestones: Array<{date, label}>` block at the top of
  `Wework.ts`.
- **★ Recommended first pick ★** — cheapest, highest ROI, reuses
  existing infrastructure.

### #11 — Score vs Business-Stage Scatter  ★60-second exec pick★

- **Executive rationale:** Outliers. Click a dot that's huge in
  `total_score` but bottomed-out on `score_revenue` — that's a
  Triage review candidate. Auditors love this view.
- **ChartSpec shape:**

  ```ts
  {
    title: "Maturity vs revenue",
    type: "scatter",
    xColumn: "score_years",
    yColumn: "score_revenue",
    sizeColumn: "total_score",
    colorColumn: "Are you a start-up or an existing business?",
  }
  ```

- **ChartSpec extension:** add optional `xColumn?`, `yColumn?`,
  `sizeColumn?: string`, `colorColumn?: string`.
- **Aggregation:** NEW helper `scatterExtract(records, xCol, yCol,
  sizeCol?, colorCol?)`.
- **Cost:** new helper + new `ChartType` (`"scatter"`) + ChartSpec
  extension for 4 new optional fields.
- **Risk:** Discrete integer scores (1/2/3) stack perfectly on top
  of each other. Add 5% jitter on x/y for readability.

---

## 3. Two top-3 picks per executive attention window

### ★ 5 seconds on a phone ★

1. **#7 Mandate Pipeline Strip** — instant red/green quota gauge
2. **#1 Cohort Funnel** — one-screen conversion drop-off story
3. **#4 Demographic Pyramid** — youth mandate + gender parity in
   one tile

### ★ 60 seconds on a laptop drilling in ★

1. **#3 Cohort Hotspot Heatmap** — drill into where to deploy
   capacity next week
2. **#6 Score Breakdown Stacked Bar** — curriculum-tuning narrative
3. **#11 Score × Business-Stage Scatter** — click the outliers

---

## 4. Implementation cost summary

| Effort tier | Charts | Notes |
| - | - | - |
| 1-day, low risk | **#10** | Same `ChartType`, ~5-line `charts.tsx` extension. |
| 1-day, low risk | **#5** | Reuses #3 helper (counts instead of means). |
| 2 days, medium risk | **#2, #4, #6, #8, #11** | Each independent (new helper + new `ChartType`). |
| 3 days, medium risk | **#1, #3, #7** | Funnel + heatmap + gauges touch dashboard UX. **#7** probably cleaner as a plain React component than ECharts. |
| 1 week, deferred | **#9** | Choropleth needs GeoJSON + scale-filtering logic; defer to v2. |

---

## 5. Implementation scoping notes

### 5.1 `ChartSpec` extension surface area

Of the 11 charts, 6 (#3, #4, #5, #6, #7, #8, #11) need fields beyond the
current `{ title, type, sourceColumn, topN? }` shape. The optional
fields to add:

```ts
export interface ChartSpec {
  title: string;
  type: ChartType;
  sourceColumn: string;
  topN?: number;
  // —— new optional fields below ——
  crossColumn?: string;          // #4, #5
  rowColumn?: string;            // #3, #4, #5, #6, #8
  columnColumn?: string;         // #3, #5, #8
  metricColumn?: string;         // #5, #8, #11
  metricColumns?: string[];      // #6
  sizeColumn?: string;           // #11
  colorColumn?: string;          // #11
  binCount?: number;             // #2
  buckets?: string[];            // #4
  events?: Array<{ date: string; label: string }>; // #10
  targets?: Array<{              // #7
    label: string;
    predicate: string;
    targetPct: number;
  }>;
}
```

All fields optional, so Cordaid's existing 10 charts stay
source-compatible.

### 5.2 `ChartType` union extension

`components/dashboard/charts.tsx:buildOptionForSpec` does an
**exhaustive** switch on `ChartType`. Adding a new value to the union
WITHOUT handling it causes a TypeScript error (good — guards against
silent skips). New types to add:

```ts
export type ChartType =
  | "donut"
  | "horizontal-bar"
  | "age-bar"
  | "trend-line"
  | "funnel"        // #1
  | "histogram"     // #2
  | "heatmap"       // #3 (and #5)
  | "population-pyramid" // #4
  | "stacked-bar"   // #6
  | "kpi-gauge"     // #7
  | "diverging-bar" // #8
  | "choropleth"    // #9 (deferred)
  | "scatter";      // #11
```

Each `case` is a `build<X>Option(records, spec): unknown` function call,
typically 20–40 lines per new chart type (ECharts option builders).

### 5.3 Suggested pick order

For a 1-PR-per-chart cadence, recommend the order:

1. **#10 events overlay** — cheapest, librates existing infrastructure
2. **#1 funnel** — high exec impact, well-defined ECharts type
3. **#3 heatmap** — requires ChartSpec extension, but unlocks #5 for
   free
4. **#6 stacked bar** — curriculum-driven pitch
5. **#4 demographic pyramid** — funder PR-friendly
6. **#2 histogram** — pairwise with #11 for screening-health story

Defer #7 (KPI gauges) until decision: ECharts vs plain React. Defer #9
(choropleth) entirely to v2.

---

## 6. Cross-form impact

Each chart in this catalogue is **additive to `lib/dashboards/Wework.ts`
ONLY**. Cordaid's FormConfig (`lib/dashboards/cordaidDemo.ts`) stays
untouched. The chart-spreading pipeline (FormConfig → `components/dashboard/charts.tsx:Charts`) iterates `form.charts`, so each new entry in `Wework.charts[]` only affects the Wework render branch.

If Cordaid ever wants its own stacked-bar or heatmap, the same helper +
same `ChartSpec` extension serves — no dashboard-component fork needed.
That's the post-dashPlus promise: per-form additive, zero
table-component edits.

---

## 7. Open questions for stakeholders

1. **#7 mandate targets** — what are the actual donor-mandate numbers?
   Need input from programme lead / M&E before designing.
2. **#10 events catalogue** — what programme milestones are worth
   annotating (radio campaigns, partner onboardings, election
   cycles)? Need campaign history.
3. **#11 outlier handling** — when an exec clicks an outlier dot,
   should it auto-open the detail drawer with that record? UX
   decision needed.

---

## 8. References

- `lib/dashboards/Wework.ts` — current FormConfig; this file is the
  only one to modify for any of the 11 entries.
- `lib/types.ts` — `ChartType` + `ChartSpec` definitions.
- `lib/filters.ts` — analytics helpers; new helpers go here.
- `components/dashboard/charts.tsx` — `buildOptionForSpec` dispatcher;
  one `case` per new `ChartType`.
- `DASHPLUS_PLAN.md` §6 Note 3 — the schema-walker fix that ensures
  every record's `sourceColumn` key here resolves to a label post-rename
  (so `District` / `Gender of applicant` / etc. are populated, not raw
  snake_case).
