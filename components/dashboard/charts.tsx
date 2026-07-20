"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND, CHART_PALETTE } from "@/lib/constants";
import { useMemo } from "react";
import type { ChartSpec, DynamicRecord, FormConfig } from "@/lib/types";
import {
  ageDistribution,
  countBy,
  parseGps,
  trendByDate,
} from "@/lib/filters";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[300px] items-center justify-center text-xs text-cordaid-muted">
      Loading chart…
    </div>
  ),
});

const MapChart = dynamic(
  () => import("./map-chart").then((m) => m.MapChart),
  { ssr: false },
);

interface ChartsProps {
  records: DynamicRecord[];
  // Step 11: Charts now consumes the form's chart specs declaratively.
  // Each ChartSpec routes records through the right builder based on
  // its `type`, with `sourceColumn` for the data column and `topN` for
  // horizontal-bar caps. Dropping the prop means dropping the whole
  // per-spec dispatcher in this file.
  form: FormConfig;
}

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
  // Step 11: route the trend chart by spec.sourceColumn instead of
  // the hardcoded "Date" key. The match-on-data filter in
  // `renderableSpecs` ensures this option is never built when no
  // record carries a non-null value for the configured date column
  // (WeWork's _submission_time no longer maps to nothing).
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
      splitLine: { lineStyle: { color: BRAND.border, type: "dashed" as const } },
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
  topN = 15
) {
  const data = countBy(records, column).slice(0, topN).reverse();
  return {
    ...ECOMMON,
    color: [BRAND.red],
    grid: { ...ECOMMON.grid, left: 110, right: 30, top: 20, bottom: 30 },
    tooltip: { ...ECOMMON.tooltip, trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "value" as const,
      axisLabel: { color: BRAND.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: BRAND.border, type: "dashed" as const } },
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

function buildDonutOption(
  records: DynamicRecord[],
  column: string
) {
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

function buildMapMarkerContent(
  points: Array<{ lat: number; lng: number }>,
) {
  return <MapChart points={points} />;
}

function buildAgeBarOption(
  records: DynamicRecord[],
  ageColumn: string
) {
  // Step 11: pass the form's age column through. Cordaid points at
  // "Age" (PascalCase), WeWork at "age" (snake_case). Both resolve
  // identically because DynamicRecord is an open index signature.
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
      splitLine: { lineStyle: { color: BRAND.border, type: "dashed" as const } },
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
 * Per-spec dispatcher (Step 11). Switches on ChartSpec.type from the
 * active FormConfig and routes spec.sourceColumn into the right
 * builder. The exhaustive switch guards against future ChartType
 * additions being silently ignored — TypeScript flags a non-handled
 * union member at compile time.
 */
function buildOptionForSpec(
  records: DynamicRecord[],
  spec: ChartSpec
): unknown {
  switch (spec.type) {
    case "trend-line":
      return buildLineOption(records, spec.sourceColumn);
    case "horizontal-bar":
      return buildHorizontalBarOption(
        records,
        spec.sourceColumn,
        spec.topN ?? 15,
      );
    case "donut":
      return buildDonutOption(records, spec.sourceColumn);
    case "age-bar":
      return buildAgeBarOption(records, spec.sourceColumn);
    case "map":
      return buildMapMarkerContent(parseGps(records, spec.sourceColumn));
  }
}

/**
 * Match-on-data predicate (Step 11). A chart spec whose source column
 * has no non-null values in the current record slice is silently
 * skipped rather than rendering an empty chart with no signal.
 *
 * Defends against the silent-failure bug pattern from
 * DASHPLUS_PLAN.md §3 — silently rendering an empty chart is
 * indistinguishable from "the data is sparse" and confuses users.
 * The trend-chart hardcode of "Date" was the original visible
 * symptom: WeWork has no "Date" field, so the chart drew zero bars
 * with no diagnostic. With match-on-data, the spec gets skipped and
 * the user sees the "no specs match" empty state with copy explaining
 * why.
 */
function hasMatchingData(
  records: DynamicRecord[],
  column: string
): boolean {
  for (const r of records) {
    const v = r[column];
    if (v != null && v !== "") return true;
  }
  return false;
}

interface ChartConfig {
  title: string;
  build: () => unknown;
}

/**
 * A map chart doesn't render via ECharts; it returns React elements
 * directly. The render path below detects this by checking if the
 * build() return is an object with a `$$typeof` symbol (React element)
 * vs a plain options object.
 */
function isReactElement(value: unknown): value is React.ReactNode {
  return (
    value != null &&
    typeof value === "object" &&
    "$$typeof" in (value as Record<string, unknown>)
  );
}

export function Charts({ records, form }: ChartsProps) {
  const renderableSpecs = useMemo(
    () => form.charts.filter((spec) => hasMatchingData(records, spec.sourceColumn)),
    [form.charts, records],
  );

  const charts = useMemo<ChartConfig[]>(
    () =>
      renderableSpecs.map((spec) => ({
        title: spec.title,
        build: () => buildOptionForSpec(records, spec),
      })),
    [renderableSpecs, records],
  );

  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-cordaid-border bg-white p-10 text-center text-sm text-cordaid-muted">
        No records match the current filters — adjust the filters above to
        see analytics.
      </div>
    );
  }

  if (!charts.length) {
    // Distinct copy from the records == 0 case above so the user can
    // tell "I filtered too aggressively" apart from "the active form's
    // schema doesn't include any chartable columns in this slice".
    return (
      <div className="rounded-2xl border border-dashed border-cordaid-border bg-white p-10 text-center text-sm text-cordaid-muted">
        No chart specs match the active form's schema — the form's
        registry entry points at columns outside the current record
        slice, or the dataset is sparse for the active filters. Adjust
        the filters, or add chart specs to {form.label}'s
        `lib/dashboards/{form.id}.ts` registry entry.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {charts.map((chart, idx) => {
        const content = chart.build();
        return (
          <Card key={chart.title} className="animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
            <CardHeader>
              <CardTitle>{chart.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="chart-shell">
                {isReactElement(content) ? (
                  content
                ) : (
                  <ReactECharts
                    option={content as object}
                    style={{ height: idx === 0 ? 320 : 280, width: "100%" }}
                    notMerge
                    lazyUpdate
                    opts={{ renderer: "svg" }}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
