import type { DynamicRecord, FormConfig } from "@/lib/types";

// =============================================================================
//  Wework FormConfig — beneficiary-selection form for the WeWork
//  entrepreneurship screening programme.
//
//  KEY CONVENTION (post-fix — see DASHPLUS_PLAN.md §6 Note 3 lesson B):
//  Wework's KPI v2 schema carries GROUP-PREFIXED KEYS (e.g.
//  `basic_information/current_district`, `demographics/gender`,
//  `stage/district`) in the raw submission response. After
//  `lib/kobo.ts:fetchKoboFormMeta` walks the schema sheet (URL:
//  `/api/v2/assets/{uid}/content/`) and tracks `begin_group`/
//  `end_group` markers, every leaf registers into `nameToLabel`
//  with a key matching the raw record path mapped to the schema's
//  `label`. So:
//
//    raw record key (`basic_information/current_district`) →
//      post-rename cell key (`District`),
//    raw record key (`demographics/gender`) →
//      post-rename cell key (`Gender of applicant`),
//    raw record key (`eligibility/age`) →
//      post-rename cell key (`What is your age?`),
//    and so on.
//
//  Score / calculate fields (e.g. `score_age`) have NO schema
//  label. The walker falls back to the BARE survey `name` for
//  those, so `r.score_age` continues to resolve (rather than
//  `r["eligibility/score_age"]`). That asymmetry is intentional.
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
  // score_* are calculate fields WITHOUT a schema label, so the
  // walker preserves the bare survey name (no prefix) — see
  // comment block above. These three references stay lowercase.
  const a = typeof r.score_age === "number" ? r.score_age : null;
  const g = typeof r.score_gender === "number" ? r.score_gender : null;
  const v = typeof r.score_vuln === "number" ? r.score_vuln : null;
  if (a === null && g === null && v === null) return null;
  return (a ?? 0) + (g ?? 0) + (v ?? 0);
}

// Schema-resolved label keys (the EXACT strings the walker registers
// into nameToLabel). Pull these out as constants so the rest of the
// file reads naturally even though they're long full-question keys.
// If the Wework form schema ever changes these labels, ONLY this
// block needs an edit; the closures below stay byte-identical.
const LBL_DISTRICT = "District";
const LBL_GENDER = "Gender of applicant";
const LBL_BUSINESS_TYPE = "Are you a start-up or an existing business?";
const LBL_VULNERABILITY =
  "Select vulnerability (Teenage mother, PLWD, Lactating mother)";
const LBL_STATUS = "Are you Refugee or Host community?";
const LBL_ENTERPRISE =
  "If yes, which of the following value chain or enterprises is business focusing on?";
const LBL_AGE = "What is your age?";

export const Wework: FormConfig = {
  id: "Wework",
  label: "Wework",
  envPrefix: "WEWORK_KOBO",
  // No "Date" question in the survey; bound defaults hydrate from
  // `_submission_time` so the trend chart + date filters read
  // consistent values.
  dateColumn: "_submission_time",
  // Free-text search spans the pickable, label-shaped columns of the
  // WeWork form after the post-rename rewrite. Kobo metadata fields
  // (_id/_uuid/_submission_time) are excluded so search hits feel
  // semantic rather than numeric.
  searchFields: [
    LBL_DISTRICT,
    LBL_GENDER,
    LBL_BUSINESS_TYPE,
    LBL_VULNERABILITY,
    LBL_STATUS,
    LBL_ENTERPRISE,
  ],
  // 8 widgets — mirrors the Cordaid 13-widget list but pared back to
  // the WeWork-relevant axes. Date inputs read from `_submission_time`.
  filters: [
    { key: "district", label: "District", type: "select", sourceColumn: LBL_DISTRICT },
    { key: "gender", label: "Gender", type: "select", sourceColumn: LBL_GENDER },
    { key: "businesstype", label: "Business type", type: "select", sourceColumn: LBL_BUSINESS_TYPE },
    { key: "vuln", label: "Vulnerability", type: "select", sourceColumn: LBL_VULNERABILITY },
    { key: "status", label: "Status", type: "select", sourceColumn: LBL_STATUS },
    { key: "startDate", label: "Start date", type: "date" },
    { key: "endDate", label: "End date", type: "date" },
    { key: "search", label: "Search text", type: "search", span: 2 },
  ],
  // 7 tiles aligned with screening outreach reporting. `vulnerable`
  // counts applicants whose vulnerability label != "None" (slug
  // `no_vuln` from `demographics/vulnerability`'s valueMap), matching
  // the WeWork programme's primary outreach axis.
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
          countWhere(
            records,
            (r) =>
              typeof r[LBL_VULNERABILITY] === "string" &&
              r[LBL_VULNERABILITY] !== "None",
          ),
          records.length,
        )}% flagged`,
      iconName: "AlertTriangle",
      accent: "bg-amber-50 text-amber-600",
      compute: (records) =>
        countWhere(
          records,
          (r) =>
            typeof r[LBL_VULNERABILITY] === "string" &&
            r[LBL_VULNERABILITY] !== "None",
        ).toLocaleString(),
    },
    {
      key: "refugee",
      label: "Refugee applicants",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => r[LBL_STATUS] === "Refugee"),
          records.length,
        )}% of filtered`,
      iconName: "Share2",
      accent: "bg-sky-50 text-sky-600",
      compute: (records) =>
        countWhere(records, (r) => r[LBL_STATUS] === "Refugee").toLocaleString(),
    },
    {
      key: "female",
      label: "Female applicants",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => r[LBL_GENDER] === "Female"),
          records.length,
        )}% of respondents`,
      iconName: "Users",
      accent: "bg-pink-50 text-pink-600",
      compute: (records) =>
        countWhere(records, (r) => r[LBL_GENDER] === "Female").toLocaleString(),
    },
    {
      key: "avgAge",
      label: "Average age",
      sub: "Across filtered records",
      iconName: "CalendarDays",
      accent: "bg-violet-50 text-violet-600",
      // `LBL_AGE` is the post-rename cell key (col of integer
      // values after the valueMap + integer coercion pipeline).
      // Walker's integerLabels set includes this label so the
      // underlying cell resolves to a number.
      compute: (records) => avgNumeric(records, LBL_AGE).toFixed(1),
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
      compute: (records) => uniqueCount(records, LBL_DISTRICT).toLocaleString(),
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
      sourceColumn: LBL_DISTRICT,
      topN: 15,
    },
    {
      title: "Business type",
      type: "donut",
      sourceColumn: LBL_BUSINESS_TYPE,
    },
    {
      title: "Vulnerability profile",
      type: "donut",
      sourceColumn: LBL_VULNERABILITY,
    },
    {
      title: "Refugee vs host",
      type: "donut",
      sourceColumn: LBL_STATUS,
    },
    { title: "Gender mix", type: "donut", sourceColumn: LBL_GENDER },
    {
      title: "Age distribution",
      type: "age-bar",
      sourceColumn: LBL_AGE,
    },
  ],
  // 10 columns surfaced in the records table — submission time,
  // geography, demographics, business profile, plus the three
  // selection-score calculate fields (lowercase, no schema label).
  tableColumns: [
    { key: "_submission_time", label: "Submission time" },
    { key: LBL_DISTRICT, label: "District" },
    { key: LBL_GENDER, label: "Gender" },
    { key: LBL_AGE, label: "Age", align: "right" },
    { key: LBL_BUSINESS_TYPE, label: "Business type" },
    { key: LBL_VULNERABILITY, label: "Vulnerability" },
    { key: LBL_STATUS, label: "Status" },
    // score_* calculate fields stay lowercase (no schema label).
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
    subtitleFields: [LBL_DISTRICT, LBL_GENDER, LBL_BUSINESS_TYPE],
  },
};
