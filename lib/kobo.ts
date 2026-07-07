// Server-only KoboToolbox v2 client. Used by `app/api/feedback/route.ts`
// when KOBO_API_TOKEN + KOBO_ASSET_UID are configured. The client pulls
// the form schema first (so we know how to rename snake_case keys back to
// the dashboard's label-shaped keys and which questions are numeric/date),
// then paginates `/api/v2/assets/{uid}/data/` and normalises each
// submission into our `FeedbackRecord` shape.
//
// Run-time contract:
//   - base URL: defaults to https://kf.kobotoolbox.org (Global server).
//   - auth: `Authorization: Token <token>` header.
//   - /data/ pagination: walks the response's `next` URL until exhausted.
//   - hard cap at 50 pages × 1 000 rows = 50 000 rows, surfaced via
//     `truncated: true` + `totalCount` from the first page so the UI can
//     flag the truncation rather than silently undercount.
//   - all upstream fetches bypass Next's data cache (`cache: "no-store"`)
//     so the route's own revalidate controls freshness.

import type { FeedbackRecord } from "./types";

export interface KoboConfig {
  token: string;
  assetUid: string;
  baseUrl: string;
}

export interface KoboFetchOptions {
  signal?: AbortSignal;
}

export interface KoboFormMeta {
  uid: string;
  name: string;
  version: string | undefined;
  /** Map of Kobo `name` attribute → dashboard `label` heading. */
  nameToLabel: Record<string, string>;
  /** Labels for questions typed as `integer` (so we coerce to number). */
  integerLabels: Set<string>;
  /** Labels for questions typed as `date` (so we validate YYYY-MM-DD). */
  dateLabels: Set<string>;
}

export interface KoboFetchResult {
  uid: string;
  name: string;
  version: string | undefined;
  records: FeedbackRecord[];
  fetchedAt: string;
  truncated: boolean;
  totalCount: number | null;
}

const MAX_PAGES = 50;
const PAGE_SIZE = 1000;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

async function authedFetch(
  url: string,
  token: string,
  signal?: AbortSignal
): Promise<Response> {
  const res = await fetch(url, {
    headers: { Authorization: `Token ${token}`, Accept: "application/json" },
    signal,
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Kobo API ${res.status} ${res.statusText}: ${text.slice(0, 200)}`
    );
  }
  return res;
}

/**
 * KPI v2 `label` may be a plain string or a localised dictionary.
 * Deterministic English first; never pick an arbitrary fallback.
 */
function extractLabel(label: unknown): string {
  if (typeof label === "string" && label) return label;
  if (label && typeof label === "object") {
    const dict = label as Record<string, string>;
    if (typeof dict["English (en)"] === "string") return dict["English (en)"];
    if (typeof dict.English === "string") return dict.English;
    if (typeof dict.en === "string") return dict.en;
  }
  return "";
}

function strOf(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function numOf(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function fetchKoboFormMeta(
  config: KoboConfig,
  options: KoboFetchOptions = {}
): Promise<KoboFormMeta> {
  const url = `${normalizeBaseUrl(config.baseUrl)}/api/v2/assets/${config.assetUid}/`;
  const res = await authedFetch(url, config.token, options.signal);
  const data = await res.json();

  const nameToLabel: Record<string, string> = {};
  const integerLabels = new Set<string>();
  const dateLabels = new Set<string>();

  for (const q of Array.isArray(data?.content) ? data.content : []) {
    if (!q || typeof q !== "object") continue;
    const name = (q as Record<string, unknown>).name;
    if (typeof name !== "string" || !name) continue;
    const lbl = extractLabel((q as Record<string, unknown>).label);
    if (!lbl) continue;
    nameToLabel[name] = lbl;
    const rawType = (q as Record<string, unknown>).type;
    if (typeof rawType === "string") {
      const t = rawType.split(" ", 1)[0]; // strip `select_one foo` to `select_one`
      if (t === "integer") integerLabels.add(lbl);
      else if (t === "date") dateLabels.add(lbl);
    }
  }

  return {
    uid: typeof data?.uid === "string" ? data.uid : config.assetUid,
    name: typeof data?.name === "string" ? data.name : "Kobo form",
    version: typeof data?.version === "string" ? data.version : undefined,
    nameToLabel,
    integerLabels,
    dateLabels,
  };
}

function normalizeSubmission(
  raw: Record<string, unknown>,
  meta: KoboFormMeta
): FeedbackRecord {
  // Step 1: copy and rename snake_case keys via the schema-derived map.
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "meta" || k.startsWith("_")) {
      mapped[k] = v;
      continue;
    }
    const targetKey = meta.nameToLabel[k] ?? k;
    mapped[targetKey] = v;
  }

  // Step 2: numeric coercion for every integer question in the form.
  for (const label of meta.integerLabels) {
    mapped[label] = numOf(mapped[label]);
  }

  // Step 3: date-shape validation — Kobo dates are YYYY-MM-DD; reject
  // anything else so applyFilters' lexicographic comparisons stay sane.
  for (const label of meta.dateLabels) {
    const v = mapped[label];
    if (typeof v === "string" && v !== "" && !DATE_REGEX.test(v)) {
      mapped[label] = null;
    }
  }

  // Step 4: defensive typed construction. All 24 keys are guaranteed.
  const yesNo = (v: unknown): "Yes" | "No" | null =>
    v === "Yes" || v === "No" ? (v as "Yes" | "No") : null;
  const maleFemale = (v: unknown): "Male" | "Female" | null =>
    v === "Male" || v === "Female" ? (v as "Male" | "Female") : null;

  return {
    Date: strOf(mapped.Date),
    Activity: strOf(mapped.Activity),
    "Feedback Channel used": strOf(mapped["Feedback Channel used"]),
    "Feedback Category": strOf(mapped["Feedback Category"]),
    "Emergency Feedback": yesNo(mapped["Emergency Feedback"]),
    "Thematic Area": strOf(mapped["Thematic Area"]),
    "Project related to feedback": strOf(mapped["Project related to feedback"]),
    District: strOf(mapped.District),
    Subcounty: strOf(mapped.Subcounty),
    Village: strOf(mapped.Village),
    "Who is giving feedback?": strOf(mapped["Who is giving feedback?"]),
    Gender: maleFemale(mapped.Gender),
    Age: numOf(mapped.Age),
    "Description of feedback, suggestion or complaint": strOf(
      mapped["Description of feedback, suggestion or complaint"]
    ),
    "Description of actions taken": strOf(mapped["Description of actions taken"]),
    "Referral Status": strOf(mapped["Referral Status"]),
    "Status of this feedback": strOf(mapped["Status of this feedback"]),
    "Date feedback was resolved": strOf(mapped["Date feedback was resolved"]),
    "Days taken to resolved this feedback": numOf(
      mapped["Days taken to resolved this feedback"]
    ),
    "Reported to Integrity Focal Person": strOf(
      mapped["Reported to Integrity Focal Person"]
    ),
    "Feedback requires urgent response": strOf(
      mapped["Feedback requires urgent response"]
    ),
    "Feedback Categorized as": strOf(mapped["Feedback Categorized as"]),
    _submission_time: strOf(mapped._submission_time),
    _id: numOf(mapped._id) ?? 0,
    _uuid: strOf(mapped._uuid) ?? "",
  };
}

export async function fetchKoboSubmissions(
  config: KoboConfig,
  options: KoboFetchOptions = {}
): Promise<KoboFetchResult> {
  const meta = await fetchKoboFormMeta(config, options);
  const origin = normalizeBaseUrl(config.baseUrl);

  const all: Array<Record<string, unknown>> = [];
  let totalCount: number | null = null;
  let next: string | null = `${origin}/api/v2/assets/${config.assetUid}/data/?limit=${PAGE_SIZE}`;
  let pages = 0;
  let truncated = false;

  while (next && pages < MAX_PAGES) {
    pages++;
    const res = await authedFetch(next, config.token, options.signal);
    const page = (await res.json()) as {
      count?: number;
      results?: Array<Record<string, unknown>>;
      next?: string | null;
    };
    if (typeof page.count === "number" && totalCount === null) {
      totalCount = page.count;
    }
    if (Array.isArray(page.results)) all.push(...page.results);

    const pageNext =
      typeof page.next === "string" && page.next ? page.next : null;
    if (pageNext && pages >= MAX_PAGES) truncated = true;
    next = pageNext;
  }

  const records = all.map((r) => normalizeSubmission(r, meta));
  return {
    uid: meta.uid,
    name: meta.name,
    version: meta.version,
    records,
    fetchedAt: new Date().toISOString(),
    truncated,
    totalCount,
  };
}
