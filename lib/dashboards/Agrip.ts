import type { DynamicRecord, FormConfig } from "@/lib/types";

// =============================================================================
//  Agrip FormConfig — Agricultural livelihood activities form for the AGRIP
//  programme. Third form in the multi-form dashboard, adding a drill-down
//  location filter (District → Sub‑county → Parish → Village).
//
//  KEY CONVENTION (post-rename → label-shaped keys, verified 2026-07-20):
//  The 4-shape extractLabel patch (lib/kobo.ts:175–188) means the walker now
//  registers Kobo v2 `label::English` values as the cell keys, so every
//  `sourceColumn` below matches exactly what `/api/feedback?form=Agrip`
//  returns. The AGRIP asset's top-level `district` label is `"Seclect Current
//  District"` (typo preserved from xlsx — fix in Kobo UI: `"Select Current
//  District"`), and the activity-group district label is `"Activity district"`
//  (rename propagated successfully). Both cell-keys are distinct, so the
//  two-district collision is structurally nullified.
//
//  FORWARD-LOOKING FORM-BUILDER FIX (no code change needed when done):
//    Fix `"Seclect Current District"` → `"Select Current District"`
//    Only the LBL_PRIMARY_DISTRICT constant needs updating once that lands.
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

function uniqueCount(
  records: DynamicRecord[],
  column: string,
): number {
  const set = new Set<string>();
  for (const r of records) {
    const v = r[column];
    if (typeof v === "string" && v) set.add(v);
  }
  return set.size;
}

// =============================================================================
//  LBL_* constants EXACTLY match what Kobo serves via label::English on the
//  live asset `aiJYFaTY5WKVwCyQySjaYw` (verified 2026-07-20 post-rename). If
//  Kobo's label changes in the form builder, ONLY this block needs updating.
// =============================================================================
const LBL_PRIMARY_DISTRICT   = "Seclect Current District";   // ⚠ typo preserved from xlsx
const LBL_ACTIVITY_DISTRICT  = "Activity district";          // rename propagated successfully
const LBL_ACTIVITY_NAME      = "Activity name";
const LBL_ACTIVITY_DATE      = "Activity date";
const LBL_ACTIVITY_SUBCOUNTY = "Sub-county / Town Council";
const LBL_PARISH             = "Parish of Residency";
const LBL_VILLAGE            = "Village of Residency";
const LBL_GENDER             = "Gender";
const LBL_AGE_GROUP          = "Age category";
const LBL_PWD                = "Participant is a PWD";
const LBL_NAME               = "Name of Data Entrant";
const LBL_MISSING_NAME       = "Please Specify your name here";
const LBL_PARTICIPANT_FIRST  = "First Name";
const LBL_PARTICIPANT_SECOND = "Second Name";
const LBL_PHONE_TOP          = "phonenumber";                // bare-name: no label on metadata field
const LBL_PHONE_CONTACT      = "Contact of Data Entrant";
const LBL_PHONE_PARTICIPANT  = "Telephone contact";
const LBL_GPS                = "Collect GPS coordinate.";

export const Agrip: FormConfig = {
  id: "Agrip",
  label: "AGRIP",
  envPrefix: "AGRIP_KOBO",
  dateColumn: LBL_ACTIVITY_DATE,
  searchFields: [
    LBL_PRIMARY_DISTRICT,
    LBL_ACTIVITY_NAME,
    LBL_NAME,
    LBL_MISSING_NAME,
    LBL_PARTICIPANT_FIRST,
    LBL_PARTICIPANT_SECOND,
    LBL_ACTIVITY_SUBCOUNTY,
    LBL_PARISH,
    LBL_VILLAGE,
    LBL_PHONE_TOP,
    LBL_PHONE_CONTACT,
    LBL_PHONE_PARTICIPANT,
  ],
  filters: [
    {
      key: "location",
      label: "Location",
      type: "drill",
      span: 4,
      drillConfig: {
        levels: [
          { key: "district",   label: "District",   sourceColumn: LBL_PRIMARY_DISTRICT },
          { key: "subcounty",  label: "Sub-county", sourceColumn: LBL_ACTIVITY_SUBCOUNTY },
          { key: "parish",     label: "Parish",     sourceColumn: LBL_PARISH },
          { key: "village",    label: "Village",    sourceColumn: LBL_VILLAGE },
        ],
      },
    },
    { key: "gender",   label: "Gender",    type: "select", sourceColumn: LBL_GENDER },
    { key: "ageGroup", label: "Age group", type: "select", sourceColumn: LBL_AGE_GROUP },
    { key: "pwd",      label: "PWD",       type: "select", sourceColumn: LBL_PWD },
    { key: "startDate", label: "Activity start", type: "date" },
    { key: "endDate",   label: "Activity end",   type: "date" },
    { key: "search",    label: "Search text",    type: "search", span: 2 },
  ],
  kpis: [
    {
      key: "total",
      label: "Activities recorded",
      sub: "Filtered records",
      iconName: "Inbox",
      accent: "bg-rose-50 text-cordaid-red",
      compute: (records) => records.length.toLocaleString(),
    },
    {
      key: "female",
      label: "Female participants",
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
      key: "male",
      label: "Male participants",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => r[LBL_GENDER] === "Male"),
          records.length,
        )}% of respondents`,
      iconName: "Users",
      accent: "bg-sky-50 text-sky-600",
      compute: (records) =>
        countWhere(records, (r) => r[LBL_GENDER] === "Male").toLocaleString(),
    },
    {
      key: "pwd",
      label: "PWD (inclusion metric)",
      sub: (records) =>
        `${pct(
          countWhere(records, (r) => r[LBL_PWD] === "Yes"),
          records.length,
        )}% flagged`,
      iconName: "AlertTriangle",
      accent: "bg-amber-50 text-amber-600",
      compute: (records) =>
        countWhere(records, (r) => r[LBL_PWD] === "Yes").toLocaleString(),
    },
    {
      key: "missingName",
      label: "Missing‑name records",
      sub: "Operational flag",
      iconName: "AlertTriangle",
      accent: "bg-amber-50 text-amber-600",
      compute: (records) =>
        countWhere(
          records,
          (r) => {
            const v = r[LBL_MISSING_NAME];
            return typeof v === "string" && v.trim() !== "";
          },
        ).toLocaleString(),
    },
    {
      key: "districts",
      label: "Districts covered",
      sub: "Unique locations",
      iconName: "Map",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => uniqueCount(records, LBL_PRIMARY_DISTRICT).toLocaleString(),
    },
    {
      key: "subcounties",
      label: "Sub-counties covered",
      sub: "Unique locations",
      iconName: "Map",
      accent: "bg-emerald-50 text-emerald-600",
      compute: (records) => uniqueCount(records, LBL_ACTIVITY_SUBCOUNTY).toLocaleString(),
    },
  ],
  charts: [
    {
      title: "Activities over time",
      type: "trend-line",
      sourceColumn: LBL_ACTIVITY_DATE,
    },
    {
      title: "By district — Top 15",
      type: "horizontal-bar",
      sourceColumn: LBL_PRIMARY_DISTRICT,
      topN: 15,
    },
    {
      title: "By activity location — Top 15",
      type: "horizontal-bar",
      sourceColumn: LBL_ACTIVITY_DISTRICT,
      topN: 15,
    },
    {
      title: "By sub-county — Top 15",
      type: "horizontal-bar",
      sourceColumn: LBL_ACTIVITY_SUBCOUNTY,
      topN: 15,
    },
    {
      title: "Gender mix",
      type: "donut",
      sourceColumn: LBL_GENDER,
    },
    {
      title: "Age group distribution",
      type: "donut",
      sourceColumn: LBL_AGE_GROUP,
    },
    {
      title: "PWD proportion",
      type: "donut",
      sourceColumn: LBL_PWD,
    },
    {
      title: "Activity name — Top 10",
      type: "horizontal-bar",
      sourceColumn: LBL_ACTIVITY_NAME,
      topN: 10,
    },
    {
      title: "Activity locations",
      type: "map",
      sourceColumn: LBL_GPS,
      mapLabelColumns: [LBL_ACTIVITY_NAME, LBL_PRIMARY_DISTRICT],
    },
  ],
  tableColumns: [
    { key: LBL_ACTIVITY_DATE,      label: "Activity date" },
    { key: LBL_PRIMARY_DISTRICT,   label: "District" },
    { key: LBL_ACTIVITY_SUBCOUNTY, label: "Sub-county" },
    { key: LBL_ACTIVITY_NAME,      label: "Activity" },
    { key: LBL_PARTICIPANT_FIRST,  label: "Participant" },
    { key: LBL_GENDER,             label: "Gender" },
    { key: LBL_AGE_GROUP,          label: "Age" },
    { key: LBL_PWD,                label: "PWD", align: "right", chip: "yesNo" },
  ],
  fieldHints: {
    status: [],
    yesNo: [LBL_PWD],
    longText: [],
  },
  drawerHeader: {
    titleField: LBL_ACTIVITY_NAME,
    subtitleFields: [LBL_PRIMARY_DISTRICT, LBL_ACTIVITY_SUBCOUNTY, LBL_ACTIVITY_DATE],
  },
};
