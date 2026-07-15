import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Inbox,
  Map,
  Share2,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { DynamicRecord, FormConfig } from "@/lib/types";

interface KpiCardsProps {
  form: FormConfig;
  /** Map of KpiConfig.key → value, produced by computeKpis(records, form). */
  kpis: Record<string, string | number>;
  /**
   * The filtered records — passed in so KpiConfig.sub closures
   * (which can be `string | ((records) => string)`) can compute
   * relative sub-titles like "23% of filtered".
   */
  records: DynamicRecord[];
}

// Lucide icon registry keyed by KpiConfig.iconName. Adding a new
// icon = a matching KpiIconName entry in lib/types.ts AND this map.
// The defensive `?? Inbox` fallback keeps the dashboard from crashing
// if a form imports an iconName that hasn't been registered here.
const ICON_MAP: Record<string, LucideIcon> = {
  Inbox,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Share2,
  CalendarDays,
  Users,
  Map,
};

/**
 * Format a KPI value for display. Strings pass through
 * (cordaidDemo's closures pre-format: "1,234", "12.5"). Numbers use
 * toLocaleString() for integers and toFixed(1) for fractional values
 * (WeWork's avgScore / avgAge return raw numbers from `(sum/n)`).
 * `Number.isFinite` guards against NaN from a divide-by-zero closure
 * bug — currently none of the registered closures can produce NaN,
 * but the guard surfaces the failure mode as "—" rather than "NaN".
 */
function formatValue(v: string | number | undefined | null): string {
  if (v == null) return "—";
  if (typeof v === "string") return v;
  if (!Number.isFinite(v)) return "—";
  return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(1);
}

export function KpiCards({ form, kpis, records }: KpiCardsProps) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
      {form.kpis.map((spec) => {
        const Icon = ICON_MAP[spec.iconName] ?? Inbox;
        const value = kpis[spec.key];
        const sub =
          typeof spec.sub === "function" ? spec.sub(records) : spec.sub;
        return (
          <div
            key={spec.key}
            className="rounded-2xl border border-cordaid-border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-cordaid-muted">
                {spec.label}
              </div>
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-full ${spec.accent}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <div className="mt-2 text-2xl font-extrabold tracking-tight text-cordaid-dark tabular-nums">
              {formatValue(value)}
            </div>
            <div className="mt-1 text-[11px] text-cordaid-muted">{sub}</div>
          </div>
        );
      })}
    </section>
  );
}
