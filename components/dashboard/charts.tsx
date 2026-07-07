"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BRAND, CHART_PALETTE } from "@/lib/constants";
import { useMemo } from "react";
import type {
  FeedbackRecord,
} from "@/lib/types";
import {
  ageDistribution,
  countBy,
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

interface ChartsProps {
  records: FeedbackRecord[];
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

function buildLineOption(records: FeedbackRecord[]) {
  const data = trendByDate(records);
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
  records: FeedbackRecord[],
  column: keyof FeedbackRecord,
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
  records: FeedbackRecord[],
  column: keyof FeedbackRecord
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

function buildAgeBarOption(records: FeedbackRecord[]) {
  const data = ageDistribution(records);
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

interface ChartConfig {
  title: string;
  build: () => unknown;
}

export function Charts({ records }: ChartsProps) {
  const charts = useMemo<ChartConfig[]>(
    () => [
      { title: "Feedback trend by date", build: () => buildLineOption(records) },
      {
        title: "Feedback by district — Top 15",
        build: () => buildHorizontalBarOption(records, "District", 15),
      },
      {
        title: "Feedback by project",
        build: () => buildDonutOption(records, "Project related to feedback"),
      },
      {
        title: "Feedback category",
        build: () => buildDonutOption(records, "Feedback Category"),
      },
      {
        title: "Status of feedback",
        build: () => buildDonutOption(records, "Status of this feedback"),
      },
      {
        title: "Referral status",
        build: () => buildDonutOption(records, "Referral Status"),
      },
      {
        title: "Gender distribution",
        build: () => buildDonutOption(records, "Gender"),
      },
      {
        title: "Feedback channel used",
        build: () => buildDonutOption(records, "Feedback Channel used"),
      },
      {
        title: "Age group of respondents",
        build: () => buildAgeBarOption(records),
      },
      {
        title: "Thematic area",
        build: () => buildDonutOption(records, "Thematic Area"),
      },
    ],
    [records]
  );

  if (!records.length) {
    return (
      <div className="rounded-2xl border border-dashed border-cordaid-border bg-white p-10 text-center text-sm text-cordaid-muted">
        No records match the current filters — adjust the filters above to
        see analytics.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {charts.map((chart, idx) => (
        <Card key={chart.title} className="animate-fade-in" style={{ animationDelay: `${idx * 30}ms` }}>
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-shell">
              <ReactECharts
                option={chart.build() as object}
                style={{ height: idx === 0 ? 320 : 280, width: "100%" }}
                notMerge
                lazyUpdate
                opts={{ renderer: "svg" }}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
