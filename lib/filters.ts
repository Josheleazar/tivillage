import { ageBucket, formatPct } from "./utils";
import type {
  FeedbackRecord,
  Filters,
  Kpis,
} from "./types";

const STATUS_OPEN = new Set(["New Feedback", "Old Feedback Under investigations"]);
const STATUS_RESOLVED = new Set(["Resolved & Closed"]);

// Text-searchable fields shared by `applyFilters` (page-level search) and
// `searchRecords` (table-level quick filter). Keep both in sync via this
// single source of truth.
export const SEARCH_FIELDS: (keyof FeedbackRecord)[] = [
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
];

export function searchRecords(
  records: FeedbackRecord[],
  query: string
): FeedbackRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return records;
  return records.filter((r) => {
    const haystack = SEARCH_FIELDS
      .map((k) => (r[k] == null ? "" : String(r[k])))
      .join(" | ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function applyFilters(
  records: FeedbackRecord[],
  filters: Filters
): FeedbackRecord[] {
  const search = filters.search.trim().toLowerCase();

  return records.filter((r) => {
    if (filters.project && r["Project related to feedback"] !== filters.project)
      return false;
    if (filters.district && r.District !== filters.district) return false;
    if (filters.subcounty && r.Subcounty !== filters.subcounty) return false;
    if (filters.category && r["Feedback Category"] !== filters.category)
      return false;
    if (filters.status && r["Status of this feedback"] !== filters.status)
      return false;
    if (filters.gender && r.Gender !== filters.gender) return false;
    if (
      filters.channel &&
      r["Feedback Channel used"] !== filters.channel
    )
      return false;
    if (filters.thematic && r["Thematic Area"] !== filters.thematic)
      return false;
    if (
      filters.referral &&
      r["Referral Status"] !== filters.referral
    )
      return false;
    if (filters.emergency && r["Emergency Feedback"] !== filters.emergency)
      return false;

    if (filters.startDate && r.Date && r.Date < filters.startDate) return false;
    if (filters.endDate && r.Date && r.Date > filters.endDate) return false;

    if (search) {
      const haystack = SEARCH_FIELDS
        .map((k) => (r[k] == null ? "" : String(r[k])))
        .join(" | ")
        .toLowerCase();
      if (!haystack.includes(search)) return false;
    }

    return true;
  });
}

export function uniqueValues(
  records: FeedbackRecord[],
  column: keyof FeedbackRecord
): string[] {
  const set = new Set<string>();
  for (const r of records) {
    const v = r[column];
    if (v == null || v === "") continue;
    set.add(String(v));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function countWhere(
  records: FeedbackRecord[],
  predicate: (r: FeedbackRecord) => boolean
): number {
  let n = 0;
  for (const r of records) if (predicate(r)) n++;
  return n;
}

export function computeKpis(records: FeedbackRecord[]): Kpis {
  const total = records.length;
  const resolved = countWhere(
    records,
    (r) => r["Status of this feedback"] != null && STATUS_RESOLVED.has(r["Status of this feedback"])
  );
  const open = countWhere(
    records,
    (r) => r["Status of this feedback"] != null && STATUS_OPEN.has(r["Status of this feedback"])
  );
  const emergency = countWhere(
    records,
    (r) => r["Emergency Feedback"] === "Yes"
  );
  const referred = countWhere(
    records,
    (r) => r["Referral Status"] != null && r["Referral Status"] !== "Not Referred"
  );
  const female = countWhere(records, (r) => r.Gender === "Female");
  const districts = new Set(
    records.map((r) => r.District).filter((d): d is string => !!d)
  );

  let daysSum = 0;
  let daysCount = 0;
  for (const r of records) {
    const v = r["Days taken to resolved this feedback"];
    if (typeof v === "number" && !Number.isNaN(v)) {
      daysSum += v;
      daysCount++;
    }
  }
  const avgDaysToResolve = daysCount ? Math.round((daysSum / daysCount) * 10) / 10 : 0;

  return {
    total,
    resolved,
    open,
    emergency,
    referred,
    female,
    districtsCovered: districts.size,
    avgDaysToResolve,
    resolvedPct: parseInt(formatPct(resolved, total)),
    openPct: parseInt(formatPct(open, total)),
    emergencyPct: parseInt(formatPct(emergency, total)),
    referredPct: parseInt(formatPct(referred, total)),
    femalePct: parseInt(formatPct(female, total)),
  };
}

export function countBy(
  records: FeedbackRecord[],
  column: keyof FeedbackRecord
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of records) {
    const v = r[column];
    if (v == null || v === "") continue;
    const k = String(v);
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return Array.from(map, ([key, count]) => ({ key, count })).sort(
    (a, b) => b.count - a.count
  );
}

export function trendByDate(
  records: FeedbackRecord[]
): Array<{ date: string; count: number }> {
  const map = new Map<string, number>();
  for (const r of records) {
    if (!r.Date) continue;
    map.set(r.Date, (map.get(r.Date) ?? 0) + 1);
  }
  return Array.from(map, ([date, count]) => ({ date, count })).sort(
    (a, b) => (a.date < b.date ? -1 : 1)
  );
}

export function ageDistribution(
  records: FeedbackRecord[]
): Array<{ key: string; count: number }> {
  const map = new Map<string, number>();
  const order = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+", "Unknown"];
  for (const r of records) {
    const bucket = ageBucket(r.Age);
    map.set(bucket, (map.get(bucket) ?? 0) + 1);
  }
  return order
    .filter((k) => map.has(k))
    .map((k) => ({ key: k, count: map.get(k) ?? 0 }));
}

export function toCsv(records: FeedbackRecord[]): string {
  if (!records.length) return "";
  const cols: (keyof FeedbackRecord)[] = [
    "Date",
    "Activity",
    "Feedback Channel used",
    "Feedback Category",
    "Emergency Feedback",
    "Thematic Area",
    "Project related to feedback",
    "District",
    "Subcounty",
    "Village",
    "Who is giving feedback?",
    "Gender",
    "Age",
    "Description of feedback, suggestion or complaint",
    "Description of actions taken",
    "Referral Status",
    "Status of this feedback",
    "Date feedback was resolved",
    "Days taken to resolved this feedback",
  ];

  const escape = (val: unknown) => {
    const s = val == null ? "" : String(val);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = records.map((r) => cols.map((c) => escape(r[c])).join(","));
  return [cols.join(","), ...rows].join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
