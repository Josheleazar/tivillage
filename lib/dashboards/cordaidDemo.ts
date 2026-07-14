import type { DynamicRecord, FormConfig } from "@/lib/types";

// =============================================================================
//  cordaidDemo FormConfig — 1:1 port of the existing Cordaid feedback
//  dashboard (filters.ts / kpi-cards.tsx / charts.tsx / feedback-table.tsx).
//
//  Behavioural contract: every KPI closure returns the same value the
//  existing dashboard renders today, every chart spec targets the same
//  column, every filter widget matches the existing FILTER_DEFS list, and
//  every table column matches the existing COLUMNS array + the trailing
//  Emergency badge column.
//
//  Step 7 reformalises the helpers in lib/filters.ts so closures can
//  delegate them — for Step 2 the predicates are inline so this file is
//  self-contained.
// =============================================================================

const STATUS_OPEN = new Set<string>([
  "New Feedback",
  "Old Feedback Under investigations",
]);
const STATUS_RESOLVED = new Set<string>(["Resolved & Closed"]);

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

function isResolved(r: DynamicRecord): boolean {
  const v = r["Status of this feedback"];
  return typeof v === "string" && STATUS_RESOLVED.has(v);
}

function isOpen(r: DynamicRecord): boolean {
  const v = r["Status of this feedback"];
  return typeof v === "string" && STATUS_OPEN.has(v);
}

function isEmergency(r: DynamicRecord): boolean {
  return r["Emergency Feedback"] === "Yes";
}

function isReferred(r: DynamicRecord): boolean {
  const v = r["Referral Status"];
  return typeof v === "string" && v !== "Not Referred";
}

function isFemale(r: DynamicRecord): boolean {
  return r.Gender === "Female";
}

function avgDaysToResolve(records: DynamicRecord[]): string {
  let sum = 0;
  let n = 0;
  for (const r of records) {
    const v = r["Days taken to resolved this feedback"];
    if (typeof v === "number" && !Number.isNaN(v)) {
      sum += v;
      n++;
    }
  }
  return n ? (Math.round((sum / n) * 10) / 10).toFixed(1) : "0.0";
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

export const cordaidDemo: FormConfig = {
  id: "cordaidDemo",
  label: "cordaidDemo",
  envPrefix: "KOBO",
  dateColumn: "Date",
  // Source-of-truth for SEARCH_FIELDS in lib/filters.ts — must match
  // line-for-line so the existing search behaviour carries through once
  // Step 7 swaps lib/filters.ts to consume `config.searchFields`.
  searchFields: [
    "Date",
    "Activity",
    "Feedback Channel used",
    "Feedback Category",
    "Thematic Area",
    "Project related to feedback",
    "District",
    "Subcounty",
    "Village",
    "Who is giving feedback?",
    "Description of feedback, suggestion or complaint",
    "Description of actions taken",
    "Status of this feedback",
    "Referral Status",
  ],
  // 1:1 port of FILTER_DEFS in lib/constants.ts — every entry matches the
  // existing widget set in filter-bar.tsx; the search widget keeps span=2.
  filters: [
    {
      key: "project",
      label: "Project",
      type: "select",
      sourceColumn: "Project related to feedback",
    },
    { key: "district", label: "District", type: "select", sourceColumn: "District" },
    { key: "subcounty", label: "Subcounty", type: "select", sourceColumn: "Subcounty" },
    { key: "category", label: "Feedback category", type: "select", sourceColumn: "Feedback Category" },
    { key: "status", label: "Status", type: "select", sourceColumn: "Status of this feedback" },
    { key: "gender", label: "Gender", type: "select", sourceColumn: "Gender" },
    { key: "channel", label: "Channel", type: "select", sourceColumn: "Feedback Channel used" },
    { key: "thematic", label: "Thematic area", type: "select", sourceColumn: "Thematic Area" },
    { key: "referral", label: "Referral status", type: "select", sourceColumn: "Referral Status" },
    { key: "emergency", label: "Emergency feedback", type: "select", sourceColumn: "Emergency Feedback" },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "search", label: "Search text", type: "search", span: 2 },
  ],
  // 1:1 port of the existing 8 tiles in kpi-cards.tsx — same labels, same
  // accent classes, same icons, same sub-text. Computors return pre-formatted
  // strings (toLocaleString / toFixed(1)) matching today's display exactly.
  kpis: [
    {
      key: "total",
      label: "Total feedback",
      sub: "Filtered records",
      iconName: "Inbox",
      accent: "bg-rose-50 text-cordaid-red",
      compute: (records) => records.length.toLocaleString(),
    },
    {
      key: "resolved",
      label: "Resolved & closed",
      sub: (records) =>
        `${pct(countWhere(records, isResolved), records.length)}% of filtered`,
      iconName: "CheckCircle2",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => countWhere(records, isResolved).toLocaleString(),
    },
    {
      key: "open",
      label: "New / in-progress",
      sub: (records) =>
        `${pct(countWhere(records, isOpen), records.length)}% requires follow-up`,
      iconName: "Clock",
      accent: "bg-amber-50 text-amber-600",
      compute: (records) => countWhere(records, isOpen).toLocaleString(),
    },
    {
      key: "emergency",
      label: "Emergency feedback",
      sub: (records) =>
        `${pct(countWhere(records, isEmergency), records.length)}% marked urgent`,
      iconName: "AlertTriangle",
      accent: "bg-rose-50 text-cordaid-red",
      compute: (records) => countWhere(records, isEmergency).toLocaleString(),
    },
    {
      key: "referred",
      label: "Referred cases",
      sub: (records) =>
        `${pct(countWhere(records, isReferred), records.length)}% referral rate`,
      iconName: "Share2",
      accent: "bg-sky-50 text-sky-600",
      compute: (records) => countWhere(records, isReferred).toLocaleString(),
    },
    {
      key: "avgDays",
      label: "Avg. days to resolve",
      sub: "Across resolved entries",
      iconName: "CalendarDays",
      accent: "bg-violet-50 text-violet-600",
      compute: (records) => avgDaysToResolve(records),
    },
    {
      key: "female",
      label: "Female respondents",
      sub: (records) =>
        `${pct(countWhere(records, isFemale), records.length)}% of respondents`,
      iconName: "Users",
      accent: "bg-pink-50 text-pink-600",
      compute: (records) => countWhere(records, isFemale).toLocaleString(),
    },
    {
      key: "districtsCovered",
      label: "Districts covered",
      sub: "Unique locations",
      iconName: "Map",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => uniqueCount(records, "District").toLocaleString(),
    },
  ],
  // 1:1 port of the 10-entry charts list in charts.tsx — same titles,
  // same chart kinds, same source columns. The horizontal-bar carries
  // topN: 15 to preserve today's "Top 15" cap.
  charts: [
    { title: "Feedback trend by date", type: "trend-line", sourceColumn: "Date" },
    {
      title: "Feedback by district — Top 15",
      type: "horizontal-bar",
      sourceColumn: "District",
      topN: 15,
    },
    {
      title: "Feedback by project",
      type: "donut",
      sourceColumn: "Project related to feedback",
    },
    {
      title: "Feedback category",
      type: "donut",
      sourceColumn: "Feedback Category",
    },
    {
      title: "Status of feedback",
      type: "donut",
      sourceColumn: "Status of this feedback",
    },
    {
      title: "Referral status",
      type: "donut",
      sourceColumn: "Referral Status",
    },
    {
      title: "Gender distribution",
      type: "donut",
      sourceColumn: "Gender",
    },
    {
      title: "Feedback channel used",
      type: "donut",
      sourceColumn: "Feedback Channel used",
    },
    {
      title: "Age group of respondents",
      type: "age-bar",
      sourceColumn: "Age",
    },
    {
      title: "Thematic area",
      type: "donut",
      sourceColumn: "Thematic Area",
    },
  ],
  // 1:1 port of feedback-table.tsx's COLUMNS array + the trailing
  // Emergency badge column. Step 9 reads `config.tableColumns` once and
  // renders each.
  tableColumns: [
    { key: "Date", label: "Date" },
    { key: "Project related to feedback", label: "Project" },
    { key: "District", label: "District" },
    { key: "Feedback Category", label: "Category" },
    { key: "Status of this feedback", label: "Status" },
    { key: "Gender", label: "Gender" },
    { key: "Age", label: "Age", align: "right" },
    { key: "Referral Status", label: "Referral" },
    {
      key: "Days taken to resolved this feedback",
      label: "Days",
      align: "right",
    },
    {
      key: "Emergency Feedback",
      label: "Emergency",
      align: "right",
    },
  ],
};
