"use client";

import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useMemo } from "react";
import type { ChartSpec, DynamicRecord, FormConfig } from "@/lib/types";
import type { GpsPoint } from "@/lib/filters";
import { parseGps } from "@/lib/filters";
import {
  buildLineOption,
  buildHorizontalBarOption,
  buildDonutOption,
  buildAgeBarOption,
  hasMatchingData,
} from "@/lib/aggregate";

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

function buildMapMarkerContent(
  points: GpsPoint[],
) {
  return <MapChart points={points} />;
}

/**
 * Per-spec dispatcher (Step 11). Switches on ChartSpec.type from the
 * active FormConfig and routes spec.sourceColumn into the right
 * builder. The exhaustive switch guards against future ChartType
 * additions being silently ignored — TypeScript flags a non-handled
 * union member at compile time.
 *
 * The non-map builders are imported from @/lib/aggregate (shared with
 * the server-side aggregation engine). The map builder returns a React
 * element and stays client-side.
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
      return buildMapMarkerContent(
        parseGps(records, spec.sourceColumn, spec.mapLabelColumns),
      );
  }
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
