import type { DynamicRecord, FormConfig } from "@/lib/types";

// =============================================================================
//  Wework FormConfig — beneficiary-selection form for the WeWork
//  entrepreneurship screening programme.
//
//  Survey fields of interest (from wework.xlsx survey sheet):
//    businesstype       select_one:  Start-up | Existing
//    gender             select_one:  Male | Female
//    vuln               select_one:  Teenage mother | PLWD |
//                                   Lactating mother | None
//    status             select_one:  Refugee | Host community
//    enterprise         select_multiple: Tomatoes | Onions | Poultry |
//                                   Apairy | …
//    score_age          integer (calculate)
//    score_gender       integer (calculate)
//    score_vuln         integer (calculate)
//    age                integer (18–35 range validation)
//    district           select_one:  Arua | Terego | Yumbe
//
//  No `Date` field exists — date bounds + trend chart read from
//  `_submission_time`. envPrefix=WEWORK_KOBO so the route's resolution
//  chain reads WEWORK_KOBO_ASSET_UID_DEV (or _ASSET_UID in prod).
// =============================================================================

function countWhere(
  records: DynamicRecord[],
  predicate: (r: DynamicRecord) => boolean,
): number {
  let n = 0;
  for (const r of records) if (predicate(r)) n++;
  return n;
}

function pct(value: number, total: number): string {
  if (!total) return "0";
  return String(Math.round((value / total) * 100));
}

function avgNumeric(
  records: DynamicRecord[],
  key: keyof DynamicRecord,
): number {
  let sum = 0;
  let n = 0;
  for (const r of records) {
    const v = r[key];
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n ? sum / n : 0;
}

function uniqueCount(
  records: DynamicRecord[],
  key: keyof DynamicRecord,
): number {
  const set = new Set<string>();
  for (const r of records) {
    const v = r[key];
    if (typeof v === "string" && v) set.add(v);
  }
  return set.size;
}

function compositeScore(r: DynamicRecord): number | null {
  const a = typeof r.score_age === "number" ? r.score_age : null;
  const g = typeof r.score_gender === "number" ? r.score_gender : null;
  const v = typeof r.score_vuln === "number" ? r.score_vuln : null;
  if (a === null && g === null && v === null) return null;
  return (a ?? 0) + (g ?? 0) + (v ?? 0);
}

export const Wework: FormConfig = {
  id: "Wework",
  label: "Wework",
  envPrefix: "WEWORK_KOBO",
  // No `Date` field in the survey; bound defaults hydrate from
  // `_submission_time` so trend chart + date filters read consistent
  // values.
  dateColumn: "_submission_time",
  // Free-text search spans the pickable, label-shaped columns of the
  // WeWork form. Kobo metadata fields (_id/_uuid/_submission_time)
  // are excluded so search hits feel semantic rather than numeric.
  searchFields: [
    "district",
    "gender",
    "businesstype",
    "vuln",
    "status",
    "enterprise",
  ],
  // 7 widgets — mirrors the Cordaid 13-widget list but pared back to
  // the WeWork-relevant axes. Date inputs read from `_submission_time`
  // (handled by filter-bar.tsx once Step 8 takes over from FILTER_DEFS).
  filters: [
    { key: "district", label: "District", type: "select", sourceColumn: "district" },
    { key: "gender", label: "Gender", type: "select", sourceColumn: "gender" },
    { key: "businesstype", label: "Business type", type: "select", sourceColumn: "businesstype" },
    { key: "vuln", label: "Vulnerability", type: "select", sourceColumn: "vuln" },
    { key: "status", label: "Status", type: "select", sourceColumn: "status" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "search", label: "Search text", type: "search", span: 2 },
  ],
  // 6 tiles aligned with screening outreach reporting. `vulnerable`
  // counts applicants whose vul != 'None', matching the WeWork
  // programme's primary outreach axis.
  kpis: [
    {
      key: "total",
      label: "Total screened",
      sub: "Filtered records",
      iconName: "Inbox",
      accent: "bg-rose-50 text-cordaid-red",
      compute: (records) => records.length.toLocaleString(),
    },
    {
      key: "vulnerable",
      label: "Vulnerable applicants",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => typeof r.vuln === "string" && r.vuln !== "None"),
          records.length,
        )}% flagged`,
      iconName: "AlertTriangle",
      accent: "bg-amber-50 text-amber-600",
      compute: (records) =>
        countWhere(
          records,
          (r) => typeof r.vuln === "string" && r.vuln !== "None",
        ).toLocaleString(),
    },
    {
      key: "refugee",
      label: "Refugee applicants",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => r.status === "Refugee"),
          records.length,
        )}% of filtered`,
      iconName: "Share2",
      accent: "bg-sky-50 text-sky-600",
      compute: (records) =>
        countWhere(records, (r) => r.status === "Refugee").toLocaleString(),
    },
    {
      key: "female",
      label: "Female applicants",
      sub: (records) =>
        `${pct(countWhere(records, (r) => r.gender === "Female"), records.length)}% of respondents`,
      iconName: "Users",
      accent: "bg-pink-50 text-pink-600",
      compute: (records) =>
        countWhere(records, (r) => r.gender === "Female").toLocaleString(),
    },
    {
      key: "avgAge",
      label: "Average age",
      sub: "Across filtered records",
      iconName: "CalendarDays",
      accent: "bg-violet-50 text-violet-600",
      compute: (records) => avgNumeric(records, "age").toFixed(1),
    },
    {
      key: "avgScore",
      label: "Avg. selection score",
      sub: "score_age + score_gender + score_vuln",
      iconName: "CheckCircle2",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => {
        let sum = 0;
        let n = 0;
        for (const r of records) {
          const c = compositeScore(r);
          if (c !== null) {
            sum += c;
            n++;
          }
        }
        return n ? (Math.round((sum / n) * 10) / 10).toFixed(1) : "0.0";
      },
    },
    {
      key: "districtsCovered",
      label: "Districts covered",
      sub: "Unique locations",
      iconName: "Map",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => uniqueCount(records, "district").toLocaleString(),
    },
  ],
  // 7 charts oriented around screening segmentation. Trend chart
  // reads `_submission_time` (dateColumn); horizontal-bar caps at 15
  // for districts to mirror Cordaid style.
  charts: [
    {
      title: "Beneficiaries by date",
      type: "trend-line",
      sourceColumn: "_submission_time",
    },
    {
      title: "By district — Top 15",
      type: "horizontal-bar",
      sourceColumn: "district",
      topN: 15,
    },
    {
      title: "Business type",
      type: "donut",
      sourceColumn: "businesstype",
    },
    {
      title: "Vulnerability profile",
      type: "donut",
      sourceColumn: "vuln",
    },
    {
      title: "Refugee vs host",
      type: "donut",
      sourceColumn: "status",
    },
    { title: "Gender mix", type: "donut", sourceColumn: "gender" },
    {
      title: "Age distribution",
      type: "age-bar",
      sourceColumn: "age",
    },
  ],
  // 10 columns surfaced in the records table — submission time,
  // geography, demographics, business profile, plus the three
  // selection-score calculate fields for triage review.
  tableColumns: [
    { key: "_submission_time", label: "Submission time" },
    { key: "district", label: "District" },
    { key: "gender", label: "Gender" },
    { key: "age", label: "Age", align: "right" },
    { key: "businesstype", label: "Business type" },
    { key: "vuln", label: "Vulnerability" },
    { key: "status", label: "Status" },
    { key: "score_age", label: "Score: Age", align: "right" },
    { key: "score_gender", label: "Score: Gender", align: "right" },
    { key: "score_vuln", label: "Score: Vuln", align: "right" },
  ],
  // Step 12 auto-discover drawer config: WeWork has no description-
  // style long-text fields, no status / yesNo columns, so the
  // auto-discover path renders every grid cell as plain text and the
  // header reads from _submission_time since there's no "Who is
  // giving feedback?"-style respondent-title field. The subtitle
  // composes district + gender + businesstype into a short summary
  // line beneath the title.
  fieldHints: {
    status: [],
    yesNo: [],
    longText: [],
  },
  drawerHeader: {
    titleField: "_submission_time",
    subtitleFields: ["district", "gender", "businesstype"],
  },
};
