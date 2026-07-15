import { Activity, Database, Loader2, RefreshCw } from "lucide-react";
import type { ApiMeta, DynamicRecord, FormConfig } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SourceChip } from "./source-chip";
import { FormPicker } from "./form-picker";

interface HeaderProps {
  records: DynamicRecord[];
  meta: ApiMeta | null;
  // Form is passed through so the Period chip reads from
  // `form.dateColumn` (Cordaid: "Date", WeWork: "_submission_time")
  // and the top marque displays `form.label`. Without this prop the
  // header would hard-code `r.Date` for every form, leaving
  // WeWork's Period section blank.
  form: FormConfig;
  // All forms avail. for selection (Step 6's form picker). The picker
  // renders one menu item per entry; the dashboard parent owns the
  // router navigation (switchForm via ?form=).
  forms: FormConfig[];
  // Parent's switchForm callback. Invoked when the user picks a
  // different form in the picker; the parent strips all filter params
  // and re-issues the fetch.
  onSwitchForm: (formId: string) => void;
  // Operator-driven refresh. Wired up to dashboard-client.tsx's
  // handleRefresh which POSTs /api/feedback/refresh to
  // revalidateTag(kobo-<formId>) and then re-runs the loader.
  onRefresh: () => void;
  // Cooldown/spinner state for the refresh button. True from the
  // moment the operator clicks until the parent lifts the cooldown
  // (~3 s after the POST + reload completes).
  isRefreshing: boolean;
}

export function DashboardHeader({
  records,
  meta,
  form,
  forms,
  onSwitchForm,
  onRefresh,
  isRefreshing,
}: HeaderProps) {
  const dates = records
    .map((r) => r[form.dateColumn])
    .filter((d): d is string => typeof d === "string" && !!d)
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
              <span>{form.label} · Accountability</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
              {form.label === "cordaidDemo"
                ? "Feedback and Response Dashboard"
                : `${form.label} dashboard`}
            </h1>
            <p className="mt-2 text-sm text-white/90 max-w-2xl">
              Interactive analytics for Kobo feedback records. Use the filters
              below to drill in by project, district, category, gender, status,
              and date — KPIs, charts, and the records table update in real
              time.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <FormPicker
              forms={forms}
              current={form}
              onSelect={onSwitchForm}
            />
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur-sm">
                <Database className="h-4 w-4" />
                <span>
                  {records.length.toLocaleString()} records
                </span>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRefreshing}
                aria-label={
                  isRefreshing ? "Refreshing data" : "Refresh data from Kobo"
                }
                title={
                  isRefreshing
                    ? "Refreshing data…"
                    : "Bypass the 60s cache and pull a fresh Kobo response"
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold backdrop-blur-sm transition-colors",
                  "hover:bg-white/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50",
                  "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white/15",
                )}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                <span className="hidden sm:inline">
                  {isRefreshing ? "Refreshing…" : "Refresh"}
                </span>
              </button>
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
