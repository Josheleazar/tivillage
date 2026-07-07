import { Activity, Database } from "lucide-react";
import type { ApiMeta, FeedbackRecord } from "@/lib/types";
import { SourceChip } from "./source-chip";

interface HeaderProps {
  records: FeedbackRecord[];
  meta: ApiMeta | null;
}

export function DashboardHeader({ records, meta }: HeaderProps) {
  const dates = records
    .map((r) => r.Date)
    .filter((d): d is string => !!d)
    .sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  return (
    <header className="bg-gradient-to-br from-cordaid-red to-cordaid-red-dark text-white">
      <div className="container flex flex-col gap-4 py-7">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 text-white/80 text-xs font-semibold tracking-widest uppercase mb-2">
              <Activity className="h-4 w-4" />
              <span>Cordaid · Accountability</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
              Feedback and Response Dashboard
            </h1>
            <p className="mt-2 text-sm text-white/90 max-w-2xl">
              Interactive analytics for Kobo feedback records. Use the filters
              below to drill in by project, district, category, gender, status,
              and date — KPIs, charts, and the records table update in real
              time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
              <Database className="h-4 w-4" />
              <span>
                {records.length.toLocaleString()} records
              </span>
            </div>
          </div>
        </div>
        {minDate && maxDate && (
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 font-semibold">
              Period&nbsp;:&nbsp;<span className="tabular-nums">{minDate}</span>
              <span className="opacity-70">→</span>
              <span className="tabular-nums">{maxDate}</span>
            </span>
            <SourceChip meta={meta} />
          </div>
        )}
      </div>
    </header>
  );
}
