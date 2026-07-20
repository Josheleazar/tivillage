"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ChartOptionPayload } from "@/lib/types";

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
  /** Pre-computed chart payloads from the server aggregation endpoint. */
  charts: ChartOptionPayload[];
}

/**
 * Renders charts from pre-built ChartOptionPayload[] received from the
 * aggregated /api/feedback endpoint. ECharts options are JSON-serialized
 * and fed directly to <ReactECharts>. Map chart payloads carry
 * districtBubbles instead and render via <MapChart>.
 *
 * No client-side record iteration occurs — the server pre-computes
 * every chart's options, filter sets, date bounds, and KPIs.
 */
export function Charts({ charts }: ChartsProps) {
  if (!charts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-cordaid-border bg-white p-10 text-center text-sm text-cordaid-muted">
        No charts match the current filters — adjust the filters above or
        check that the form has submissions with data in the mapped columns.
      </div>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {charts.map((chart, idx) => (
        <Card
          key={chart.title}
          className="animate-fade-in"
          style={{ animationDelay: `${idx * 30}ms` }}
        >
          <CardHeader>
            <CardTitle>{chart.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="chart-shell">
              {chart.type === "map" && chart.districtBubbles ? (
                <MapChart points={chart.districtBubbles} />
              ) : (
                <ReactECharts
                  option={chart.option ?? {}}
                  style={{ height: idx === 0 ? 320 : 280, width: "100%" }}
                  notMerge
                  lazyUpdate
                  opts={{ renderer: "svg" }}
                />
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
