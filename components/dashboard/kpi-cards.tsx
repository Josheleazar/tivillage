import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  CalendarDays,
  Users,
  Map,
  Inbox,
} from "lucide-react";
import type { Kpis } from "@/lib/types";

interface KpiCardsProps {
  kpis: Kpis;
}

interface Tile {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

export function KpiCards({ kpis }: KpiCardsProps) {
  const tiles: Tile[] = [
    {
      label: "Total feedback",
      value: kpis.total.toLocaleString(),
      sub: "Filtered records",
      icon: Inbox,
      accent: "bg-rose-50 text-cordaid-red",
    },
    {
      label: "Resolved & closed",
      value: kpis.resolved.toLocaleString(),
      sub: `${kpis.resolvedPct}% of filtered`,
      icon: CheckCircle2,
      accent: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "New / in-progress",
      value: kpis.open.toLocaleString(),
      sub: `${kpis.openPct}% requires follow-up`,
      icon: Clock,
      accent: "bg-amber-50 text-amber-600",
    },
    {
      label: "Emergency feedback",
      value: kpis.emergency.toLocaleString(),
      sub: `${kpis.emergencyPct}% marked urgent`,
      icon: AlertTriangle,
      accent: "bg-rose-50 text-cordaid-red",
    },
    {
      label: "Referred cases",
      value: kpis.referred.toLocaleString(),
      sub: `${kpis.referredPct}% referral rate`,
      icon: Share2,
      accent: "bg-sky-50 text-sky-600",
    },
    {
      label: "Avg. days to resolve",
      value: kpis.avgDaysToResolve.toFixed(1),
      sub: "Across resolved entries",
      icon: CalendarDays,
      accent: "bg-violet-50 text-violet-600",
    },
    {
      label: "Female respondents",
      value: kpis.female.toLocaleString(),
      sub: `${kpis.femalePct}% of respondents`,
      icon: Users,
      accent: "bg-pink-50 text-pink-600",
    },
    {
      label: "Districts covered",
      value: kpis.districtsCovered.toLocaleString(),
      sub: "Unique locations",
      icon: Map,
      accent: "bg-emerald-50 text-emerald-600",
    },
  ];

  return (
    <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <div
            key={tile.label}
            className="rounded-2xl border border-cordaid-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
                {tile.label}
              </div>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${tile.accent}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-cordaid-dark tabular-nums">
              {tile.value}
            </div>
            <div className="mt-1 text-[11px] text-cordaid-muted">{tile.sub}</div>
          </div>
        );
      })}
    </section>
  );
}
