export interface FeedbackRecord {
  Date: string | null;
  Activity: string | null;
  "Feedback Channel used": string | null;
  "Feedback Category": string | null;
  "Emergency Feedback": "Yes" | "No" | null;
  "Thematic Area": string | null;
  "Project related to feedback": string | null;
  District: string | null;
  Subcounty: string | null;
  Village: string | null;
  "Who is giving feedback?": string | null;
  Gender: "Male" | "Female" | null;
  Age: number | null;
  "Description of feedback, suggestion or complaint": string | null;
  "Description of actions taken": string | null;
  "Referral Status": string | null;
  "Status of this feedback": string | null;
  "Date feedback was resolved": string | null;
  "Days taken to resolved this feedback": number | null;
  "Reported to Integrity Focal Person": string | null;
  "Feedback requires urgent response": string | null;
  "Feedback Categorized as": string | null;
  _submission_time: string | null;
  _id: number;
  _uuid: string;
}

export interface Filters {
  project: string;
  district: string;
  subcounty: string;
  category: string;
  status: string;
  gender: string;
  channel: string;
  thematic: string;
  referral: string;
  emergency: string;
  startDate: string;
  endDate: string;
  search: string;
}

export const emptyFilters: Filters = {
  project: "",
  district: "",
  subcounty: "",
  category: "",
  status: "",
  gender: "",
  channel: "",
  thematic: "",
  referral: "",
  emergency: "",
  startDate: "",
  endDate: "",
  search: "",
};

export interface Kpis {
  total: number;
  resolvedPct: number;
  openPct: number;
  emergencyPct: number;
  referredPct: number;
  avgDaysToResolve: number;
  femalePct: number;
  districtsCovered: number;
  resolved: number;
  open: number;
  emergency: number;
  referred: number;
  female: number;
}

export type ApiSource = "local" | "kobo" | "kobo-fallback";

export interface ApiMeta {
  source: ApiSource;
  count: number;
  uid?: string;
  name?: string;
  version?: string;
  baseUrl?: string;
  fetchedAt?: string;
  error?: string;
  /** True when Kobo returned more submissions than we cap (50 pages × 1 000). */
  truncated?: boolean;
  /** Total matching rows reported by Kobo (`count` field on `/data/`). */
  totalCount?: number;
}
