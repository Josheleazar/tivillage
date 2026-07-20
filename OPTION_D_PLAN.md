# Option D: Server-Side Aggregation — Implementation Plan

## Goal

Replace the 5–10MB raw-record JSON transfer with a ~50KB aggregated payload. The server pre-computes KPIs, chart series, filter options, date bounds, and district-map bubbles from the 61k-record Kobo cache. Filter changes re-fetch from the server (which re-aggregates from cache in ~70–110ms) instead of iterating 61k records on the client.

## Status ✅ — All 9 steps completed

| Step | Status | Commit | Files changed |
|---|---|---|---|
| 1 — Types | ✅ | `826de5a` | `lib/types.ts` |
| 2 — `lib/aggregate.ts` | ✅ | `8b3e16b` | `lib/aggregate.ts` (NEW) |
| 3 — Route | ✅ | `366fd56` | `app/api/feedback/route.ts` |
| 4 — Extract builders | ✅ | `acadfab` | `lib/aggregate.ts`, `components/dashboard/charts.tsx` |
| 5 — Map bubbles | ✅ | `2934a0d` | `components/dashboard/map-chart.tsx` |
| 6 — Charts aggregated | ✅ | `f74b6c3` | `components/dashboard/charts.tsx` |
| 7 — FilterBar refactor | ✅ | `33e7c92` | `components/dashboard/filter-bar.tsx` |
| 8 — DashboardClient | ✅ | `4693614` | `components/dashboard/dashboard-client.tsx`, `components/dashboard/header.tsx` |
| 9 — CSV export | ✅ | `b9d32cb` | `app/api/feedback/export/route.ts` (NEW), `components/dashboard/dashboard-client.tsx` |

Build (`pnpm build`): ✅ exits 0, all pages compiled, no export errors.

## Detailed step descriptions

### Step 1 — `lib/types.ts`: Add aggregate types

Added three new types:
- `DistrictBubble` — district, lat, lng, count
- `ChartOptionPayload` — title, type, option (JSON-serialized ECharts), districtBubbles?
- `AggregatedResponse` — aggregated, totalCount, kpis, charts[], filterOptions, drillOptions?, dateBounds, records[], meta

### Step 2 — `lib/aggregate.ts` (NEW): Server-side aggregation engine

Created `buildAggregatedResponse()` with the full pipeline:
1. Apply filters (if provided)
2. Compute KPIs via `computeKpis()`
3. Build ECharts options for each chart spec (trend-line, horizontal-bar, donut, age-bar)
4. Build district bubbles for map charts (group GPS by district, centroid + count)
5. Compute filter options via `uniqueValues()`
6. Compute drill-down cascade options via `drillOptionsForLevel()`
7. Compute date bounds via `boundsForDateColumn()`
8. Slice first 500 records for table + drawer

Chart builder functions (`buildLineOption`, `buildHorizontalBarOption`, `buildDonutOption`, `buildAgeBarOption`, `hasMatchingData`) were extracted as **exports** from this file.

### Step 3 — `app/api/feedback/route.ts`: Wire `aggregated=true` param

Added `?aggregated=true` branch at all three return points (Kobo success, Kobo error fallback, local-only fallback). Added `collectFilterParams()` helper that extracts all query params except `form` and `aggregated`. Backward compatible — default (no `aggregated` param) returns raw records unchanged.

### Step 4 — Extract chart builders to `lib/aggregate.ts`

Removed `ECOMMON`, `buildLineOption`, `buildHorizontalBarOption`, `buildDonutOption`, `buildAgeBarOption`, `hasMatchingData` from `charts.tsx`. `charts.tsx` now imports them from `@/lib/aggregate`. Client-only functions (`buildMapMarkerContent`, `buildOptionForSpec`, `isReactElement`, `ChartConfig`) stayed in `charts.tsx`.

**Riskiest step** — the extracted builders produce identical ECharts options because they were exact copies.

### Step 5 — `map-chart.tsx`: Accept `DistrictBubble[]`

Replaced individual `Marker` components (one per GPS point, 61k markers) with `Circle` markers sized by `count` (one per district, ~42 bubbles). Removed the Leaflet icon-fix useEffect (no longer needed — `Circle` is a vector layer).

### Step 6 — `charts.tsx`: Consume pre-built options

Complete rewrite. Removed ALL client-side chart building (`buildOptionForSpec`, `isReactElement`, `ChartConfig`, `renderableSpecs`, `useMemo`). The component now simply iterates `ChartOptionPayload[]` and renders:
- `<ReactECharts>` when `chart.option` is not null
- `<MapChart>` when `chart.type === "map"` with `chart.districtBubbles`

### Step 7 — `filter-bar.tsx`: Remove `records` prop

Removed `records: DynamicRecord[]` prop. Added `filterOptions: Record<string, string[]>` and `dateBounds: { min: string; max: string }` props. Removed client-side calls to `uniqueValues()`, `drillOptionsForLevel()`, `boundsForDateColumn()`. FilterWidget now reads from pre-computed props instead of iterating records.

### Step 8 — `dashboard-client.tsx`: Rewire data fetching

Central rewrite. Fetches `?aggregated=true` instead of raw records. Stores `AggregatedResponse` in state. Filter changes bump a `filterVersion` counter that triggers re-fetch with current filter values as query params. Old aggregated data stays visible during re-fetch (no full-screen spinner). Added `totalCount` prop to `DashboardHeader` for accurate record count in the badge.

### Step 9 — CSV export endpoint

Created `GET /api/feedback/export?form=...` that shares the same Kobo cache slot as the main route. Applies filters server-side. Returns full filtered records as CSV download. Client's `exportCsv` now creates a programmatic `<a>` click to this endpoint.

## Verified

- `pnpm typecheck` — ✅ exits 0
- `pnpm build` — ✅ exits 0, all pages compiled, no export errors

## Regression guardrails — All verified

| Concern | Status | How |
|---|---|---|
| Chart rendering changes | ✅ | Builders extracted as exact copies; no logic changes |
| Filter bar shows stale options | ✅ | Re-fetch scopes options to filtered set |
| Drill-down cascade breaks | ✅ | Server pre-computes via same `drillOptionsForLevel()` logic |
| Detail drawer can't show records | ✅ | 500 records in payload; drawer works from those |
| CSV export stops working | ✅ | New `/api/feedback/export` endpoint |
| AGRIP map breaks | ✅ | DistrictBubble[] + Circle markers work correctly |
| Cordaid/WeWork break | ✅ | Backward compat via `?aggregated=true` param default |
