// =============================================================================
//  lib/aggregate.ts — server-side aggregation engine (Option D).
//
//  Pre-computes KPIs, ECharts chart options, filter option sets, date
//  bounds, and district GPS bubbles from a record set so the client
//  receives a ~50KB aggregated payload instead of 5–10MB raw records.
//
//  The chart builder functions (buildLineOption, buildHorizontalBarOption,
//  buildDonutOption, buildAgeBarOption) are extracted from
//  components/dashboard/charts.tsx — they produce JSON-serializable
//  ECharts option objects and have zero React/client dependencies, so
//  they run safely on the server.
//
//  Single public entry: buildAggregatedResponse(records, form, filters?)
// =============================================================================

import type {
  AggregatedResponse,
  ApiMeta,
  ChartOptionPayload,
  ChartSpec,
  DistrictBubble,
  DynamicRecord,
  Filters,
  FormConfig,
} from "@/lib/types";
import {
  ageDistribution,
  applyFilters,
  boundsForDateColumn,
  computeKpis,
  countBy,
  drillOptionsForLevel,
  trendByDate,
  uniqueValues,
} from "@/lib/filters";
import { BRAND, CHART_PALETTE } from "@/lib/constants";

// =============================================================================
//  ECharts option builder constants + helpers (extracted from charts.tsx).
//  Identical to the client-side versions — produces the same options.
// =============================================================================

const ECOMMON = {
  textStyle: {
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: BRAND.dark,
  },
  tooltip: {
    trigger: "axis" as const,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderColor: BRAND.border,
    borderWidth: 1,
    textStyle: { color: BRAND.dark, fontSize: 12 },
  },
  grid: {
    left: 50,
    right: 16,
    bottom: 50,
    top: 30,
    containLabel: true,
  },
  legend: {
    textStyle: { color: BRAND.muted, fontSize: 11 },
    bottom: 0,
    icon: "circle",
    itemHeight: 8,
    itemWidth: 8,
  },
};

function buildLineOption(records: DynamicRecord[], dateColumn: string) {
  const data = trendByDate(records, dateColumn);
  return {
    ...ECOMMON,
    color: [BRAND.red],
    grid: { ...ECOMMON.grid, left: 40, right: 24, top: 20, bottom: 40 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.date),
      axisLabel: { color: BRAND.muted, fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: BRAND.border } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: BRAND.muted, fontSize: 11 },
      splitLine: {
        lineStyle: { color: BRAND.border, type: "dashed" as const },
      },
    },
    series: [
      {
        type: "line" as const,
        data: data.map((d) => d.count),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 3, color: BRAND.red },
        itemStyle: { color: BRAND.red, borderColor: "#fff", borderWidth: 2 },
        areaStyle: {
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: "rgba(239,58,79,0.32)" },
              { offset: 1, color: "rgba(239,58,79,0)" },
            ],
          },
        },
      },
    ],
  };
}

function buildHorizontalBarOption(
  records: DynamicRecord[],
  column: string,
  topN = 15,
) {
  const data = countBy(records, column).slice(0, topN).reverse();
  return {
    ...ECOMMON,
    color: [BRAND.red],
    grid: { ...ECOMMON.grid, left: 110, right: 30, top: 20, bottom: 30 },
    tooltip: {
      ...ECOMMON.tooltip,
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "value" as const,
      axisLabel: { color: BRAND.muted, fontSize: 11 },
      splitLine: {
        lineStyle: { color: BRAND.border, type: "dashed" as const },
      },
    },
    yAxis: {
      type: "category" as const,
      data: data.map((d) => d.key),
      axisLabel: { color: BRAND.dark, fontSize: 11 },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar" as const,
        data: data.map((d) => d.count),
        barWidth: 16,
        itemStyle: {
          borderRadius: [0, 6, 6, 0],
          color: {
            type: "linear" as const,
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: BRAND.red },
              { offset: 1, color: BRAND.redDark },
            ],
          },
        },
      },
    ],
  };
}

function buildDonutOption(records: DynamicRecord[], column: string) {
  const data = countBy(records, column).slice(0, 8);
  return {
    color: CHART_PALETTE,
    tooltip: {
      trigger: "item",
      backgroundColor: "rgba(255,255,255,0.98)",
      borderColor: BRAND.border,
      borderWidth: 1,
      textStyle: { color: BRAND.dark, fontSize: 12 },
    },
    legend: {
      orient: "vertical" as const,
      right: 8,
      top: "middle",
      textStyle: { color: BRAND.muted, fontSize: 11 },
      icon: "circle",
      itemHeight: 8,
      itemWidth: 8,
    },
    series: [
      {
        type: "pie" as const,
        radius: ["48%", "74%"],
        center: ["38%", "50%"],
        avoidLabelOverlap: true,
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 2,
        },
        label: {
          color: BRAND.dark,
          fontSize: 11,
          formatter: "{b}\n{d}%",
        },
        labelLine: { length: 8, length2: 6 },
        data: data.map((d) => ({ name: d.key, value: d.count })),
      },
    ],
  };
}

function buildAgeBarOption(records: DynamicRecord[], ageColumn: string) {
  const data = ageDistribution(records, ageColumn);
  return {
    ...ECOMMON,
    color: [BRAND.red],
    grid: { ...ECOMMON.grid, left: 36, right: 16, top: 20, bottom: 30 },
    xAxis: {
      type: "category" as const,
      data: data.map((d) => d.key),
      axisLabel: { color: BRAND.muted, fontSize: 11 },
      axisLine: { lineStyle: { color: BRAND.border } },
      axisTick: { alignWithLabel: true },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: { color: BRAND.muted, fontSize: 11 },
      splitLine: {
        lineStyle: { color: BRAND.border, type: "dashed" as const },
      },
    },
    series: [
      {
        type: "bar" as const,
        data: data.map((d) => d.count),
        barWidth: 26,
        itemStyle: {
          borderRadius: [6, 6, 0, 0],
          color: BRAND.red,
        },
      },
    ],
  };
}

/**
 * Match-on-data predicate. Returns true when at least one record in the
 * set carries a non-null, non-empty value for the given column. Charts
 * whose source column has no data are silently excluded from the
 * aggregated response.
 */
function hasMatchingData(records: DynamicRecord[], column: string): boolean {
  for (const r of records) {
    const v = r[column];
    if (v != null && v !== "") return true;
  }
  return false;
}

/**
 * Builds district bubbles from GPS coordinates grouped by a district
 * column. For each group of records sharing the same district value:
 *   - lat/lng centroid is the arithmetic mean of all GPS points in that
 *     group (only records with a parseable GPS string are included)
 *   - count is the number of records in the group
 *
 * Returns one DistrictBubble per district with data. District bubbles
 * where no GPS coordinates are available for any member are silently
 * dropped (the entry is absent from the output, so the map renders no
 * circle for a district that has records but no GPS data).
 */
function buildDistrictBubbles(
  records: DynamicRecord[],
  gpsColumn: string,
  districtColumn: string,
): DistrictBubble[] {
  // group data: { district, points: [{lat, lng}], count }
  const groups = new Map<
    string,
    { latSum: number; lngSum: number; count: number }
  >();

  for (const r of records) {
    const district = r[districtColumn];
    if (typeof district !== "string" || !district) continue;

    const gps = r[gpsColumn];
    if (typeof gps !== "string" || !gps) continue;
    const parts = gps.trim().split(/\s+/).map(Number);
    if (parts.length < 2) continue;
    const lat = parts[0];
    const lng = parts[1];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const group = groups.get(district);
    if (group) {
      group.latSum += lat;
      group.lngSum += lng;
      group.count++;
    } else {
      groups.set(district, { latSum: lat, lngSum: lng, count: 1 });
    }
  }

  const bubbles: DistrictBubble[] = [];
  for (const [district, g] of groups) {
    bubbles.push({
      district,
      lat: g.latSum / g.count,
      lng: g.lngSum / g.count,
      count: g.count,
    });
  }
  // Sort by count descending so the largest bubbles render on top.
  return bubbles.sort((a, b) => b.count - a.count);
}

/**
 * Builds one ChartOptionPayload from a ChartSpec. Switches on spec.type
 * and routes records through the right ECharts builder. Map charts
 * produce district bubbles instead of an ECharts option.
 */
function buildChartPayload(
  records: DynamicRecord[],
  spec: ChartSpec,
): ChartOptionPayload {
  switch (spec.type) {
    case "trend-line":
      return {
        title: spec.title,
        type: spec.type,
        option: buildLineOption(records, spec.sourceColumn) as unknown as Record<
          string,
          unknown
        >,
      };
    case "horizontal-bar":
      return {
        title: spec.title,
        type: spec.type,
        option: buildHorizontalBarOption(
          records,
          spec.sourceColumn,
          spec.topN ?? 15,
        ) as unknown as Record<string, unknown>,
      };
    case "donut":
      return {
        title: spec.title,
        type: spec.type,
        option: buildDonutOption(
          records,
          spec.sourceColumn,
        ) as unknown as Record<string, unknown>,
      };
    case "age-bar":
      return {
        title: spec.title,
        type: spec.type,
        option: buildAgeBarOption(
          records,
          spec.sourceColumn,
        ) as unknown as Record<string, unknown>,
      };
    case "map": {
      const districtColumn = spec.mapLabelColumns?.[0];
      const districtBubbles = districtColumn
        ? buildDistrictBubbles(records, spec.sourceColumn, districtColumn)
        : [];
      return { title: spec.title, type: spec.type, option: null, districtBubbles };
    }
  }
}

/**
 * Builds the per-level drill-down option set. For each level in the
 * filter's drillConfig.levels, computes options constrained by prior
 * levels' selected values. Returns a map of DrillLevel.key → string[].
 */
function buildDrillOptions(
  records: DynamicRecord[],
  form: FormConfig,
  filters: Record<string, string>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const def of form.filters) {
    if (def.type !== "drill" || !def.drillConfig) continue;
    for (let i = 0; i < def.drillConfig.levels.length; i++) {
      const level = def.drillConfig.levels[i];
      result[level.key] = drillOptionsForLevel(
        records,
        def.drillConfig.levels,
        i,
        filters,
      );
    }
  }
  return result;
}

/**
 * Builds filter option sets for every select-type filter in the form.
 * Returns a map of FilterDef.key → string[] (sorted, deduplicated values
 * from the records). Drill-down filter options are NOT included here —
 * they land in `drillOptions` returned separately.
 */
function buildFilterOptions(
  records: DynamicRecord[],
  form: FormConfig,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const def of form.filters) {
    if (def.type === "select" && def.sourceColumn) {
      result[def.key] = uniqueValues(records, def.sourceColumn);
    }
  }
  return result;
}

/**
 * Max records to include in the aggregated payload for the table + drawer.
 * Further pages are fetchable via ?aggregated=true&page=2.
 */
const RECORDS_PAGE_SIZE = 500;

// =============================================================================
//  Public API
// =============================================================================

/**
 * Builds a fully aggregated dashboard response from a record set.
 *
 * When `filters` is provided, all aggregations are scoped to the
 * filtered subset. Filter changes re-fetch this endpoint with the
 * new filter params — the server re-aggregates from its cache of
 * records without re-fetching Kobo.
 *
 * @param records - Full record set (pre-filter cache from Kobo)
 * @param form    - Active form config driving KPIs, charts, filters
 * @param filters - Optional filter overrides (from URL query params)
 * @param meta    - API metadata from the original fetch (source, timing, etc.)
 * @returns AggregatedResponse ready to JSON-serialize to the client
 */
export function buildAggregatedResponse(
  records: DynamicRecord[],
  form: FormConfig,
  filters?: Record<string, string>,
  meta?: ApiMeta,
): AggregatedResponse {
  // Step 1: apply filters if provided
  const filtered = filters ? applyFilters(records, filters, form) : records;

  // Step 2: compute KPIs
  const kpis = computeKpis(filtered, form);

  // Step 3: build chart payloads (skip specs with no matching data)
  const charts: ChartOptionPayload[] = [];
  for (const spec of form.charts) {
    if (hasMatchingData(filtered, spec.sourceColumn)) {
      charts.push(buildChartPayload(filtered, spec));
    }
  }

  // Step 4: compute filter options for select-type filters
  const filterOptions = buildFilterOptions(filtered, form);

  // Step 5: compute drill-down cascade options
  const drillOptions = buildDrillOptions(filtered, form, filters ?? {});

  // Step 6: date bounds
  const dateBounds = boundsForDateColumn(filtered, form.dateColumn);

  // Step 7: slice records for the table + drawer
  const sliced = filtered.slice(0, RECORDS_PAGE_SIZE);

  return {
    aggregated: true,
    totalCount: filtered.length,
    kpis,
    charts,
    filterOptions,
    drillOptions: Object.keys(drillOptions).length ? drillOptions : undefined,
    dateBounds,
    records: sliced,
    meta: meta ?? { source: form.id, count: filtered.length },
  };
}
