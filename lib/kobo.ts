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
//   - hard cap at 50 pages × 5 000 rows = 250 000 rows, surfaced via
//     `truncated: true` + `totalCount` from the first page so the UI can
//     flag the truncation rather than silently undercount.
//   - page size bumped from 1 000 → 5 000 on 2026-07-15 after the
//     25k-records-scaling discussion in chat: cuts runtime Kobo
//     request count 5× per cache miss (50 → 10 page round-trips for
//     a 25k-record form, ~10 s → ~2 s of upstream cost). Cap rises
//     proportionally — a Wiork or Cordaid workload with > 50k
//     records now gets walked without truncation; anything past
//     250k still surfaces truncated:true.
//   - all upstream fetches bypass Next's data cache (`cache: "no-store"`)
//     so the route's own revalidate controls freshness.

import type { Cell, DynamicRecord } from "./types";

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
  /**
   * Map of raw Kobo record key (group-prefixed path or bare name) →
   * dashboard label heading. Keys are the EXACT field names Kobo
   * persists in the response (`basic_information/current_district`,
   * `gender`, `eligibility/score_age` …) so normalizeSubmission's
   * `meta.nameToLabel[k] ?? k` lookup resolves directly. Pre-fix
   * keys were bare names only — that worked when the form had no
   * `begin_group` markers (Cordaid) but silently broke for grouped
   * forms (Wework) where the raw record carries the group prefix
   * (`basic_information/current_district`) but the survey row was
   * bare (`current_district`). See DASHPLUS_PLAN.md §6 Note 3.
   */
  nameToLabel: Record<string, string>;
  /** Post-rename labels for questions typed as `integer` (so we coerce to number). */
  integerLabels: Set<string>;
  /** Post-rename labels for questions typed as `date` (so we validate YYYY-MM-DD). */
  dateLabels: Set<string>;
  /**
   * Per-question slug → label lookup. Keys are raw record keys
   * (group-prefixed path) so the normalizeSubmission's loop reads
   * `meta.valueNameToLabel[rawRecordKey]` and looks up the
   * survey-row's choice-list map keyed by `list_name` (falling
   * back to the type-suffix and inline `q.choices`).
   */
  valueNameToLabel: Record<string, Record<string, string>>;
  /**
   * How many leaf rows the walker walked in this form's schema.
   * `surveyRowsLabeled` is the subset that carried a non-empty
   * `label` — the ones the dashboard actually uses to rename
   * record keys. When labelled count is zero the walker ran but
   * shipped an empty `nameToLabel`, the route surfaces this as
   * `meta.warning` so operators can distinguish "schema walked"
   * (silent empty result) from "Kobo unreached" (route errors out).
   */
  surveyRowsObserved: number;
  surveyRowsLabeled: number;
}

export interface KoboFetchResult {
  uid: string;
  name: string;
  version: string | undefined;
  records: DynamicRecord[];
  fetchedAt: string;
  truncated: boolean;
  totalCount: number | null;
  /**
   * Diagnostic counters from the schema fetch. Underscore prefix
   * signals "diagnostic only; not consumed by chart/filter/KPI
   * closures". Read by `app/api/feedback/route.ts` to decide whether
   * to surface `meta.warning` when schema fetch silently returned
   * empty labels (DASHPLUS Lesson 3 guardrail).
   */
  _schemaSummary?: { observed: number; labeled: number };
}

const MAX_PAGES = 50;
const PAGE_SIZE = 5000;
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
 * KPI v2 emits `label` in three shapes depending on form-translation
 * configuration:
 *   1. a plain string (older API responses, single-language forms)
 *   2. an array of strings, where `label[0]` is the default language
 *      (THE modal shape on current kf.kobotoolbox.org deployments)
 *   3. a {language: string} dictionary on forms with multiple translations
 *
 * Handle all three. The array shape MUST be detected before the object
 * branch because `typeof === 'object'` returns true for arrays — if we
 * fell through to the dict branch we'd dereference `label["English (en)"]`
 * on an array, get `undefined`, and silently emit an empty label, which
 * then short-circuits `nameToLabel` (every question was being skipped in
 * the previous fix because `extractLabel` returned "" for every label).
 */
function extractLabel(label: unknown): string {
  // Array shape: walk to the first non-empty string. Defensive against
  // mixed-type arrays ([0] could in theory be a localised dict placeholder).
  if (Array.isArray(label)) {
    for (const entry of label) {
      if (typeof entry === "string" && entry) return entry;
      if (entry && typeof entry === "object") {
        const dict = entry as Record<string, string>;
        if (typeof dict["English (en)"] === "string" && dict["English (en)"]) {
          return dict["English (en)"];
        }
        if (typeof dict.English === "string" && dict.English) return dict.English;
        if (typeof dict.en === "string" && dict.en) return dict.en;
      }
    }
    return "";
  }
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

// Type guard: `Cell = string | number | null`. Used by
// normalizeSubmission's final-pass filter (Step 5) to strip non-Cell
// Kobo metadata fields — `_geolocation` (a `{type, coordinates}` dict),
// `_attachments` (a list-of-dicts), `_validation_status` (a dict),
// `_notes` (a string-list), `_tags` (a dict-list) and friends that the
// pre-Step-3 strict 24-field projection silently dropped. Without this
// filter the open-dict DynamicRecord cast would let them through and
// the dashboard's detail-drawer auto-discovery (Step 12) would render
// "[object Object]" on them. Restoring today's silent-drop posture
// explicitly here keeps Step 3 a strict non-regression for Cordaid.
function isCell(v: unknown): v is Cell {
  if (v === null) return true;
  if (typeof v === "string") return true;
  if (typeof v === "number") return Number.isFinite(v);
  return false;
}

export async function fetchKoboFormMeta(
  config: KoboConfig,
  options: KoboFetchOptions = {}
): Promise<KoboFormMeta> {
  // Kobo's structured-schema endpoint. Pre-fix we hit the asset-
  // metadata endpoint `${baseUrl}/api/v2/assets/${uid}/` which only
  // advertises `data.content = ["schema","survey","choices",...]`
  // (an ARRAY of export-format strings, not a dict of sheets) — so
  // EVERY walker fallback returned `[]` and `nameToLabel`/`valueNameToLabel`
  // silently came back empty. Switching to `/content/` returns the
  // sheets under top-level `data.survey` + `data.choices`. See
  // DASHPLUS_PLAN.md §6 Note 3 lesson B.
  const url = `${normalizeBaseUrl(config.baseUrl)}/api/v2/assets/${config.assetUid}/content/`;
  const res = await authedFetch(url, config.token, options.signal);
  const data = await res.json();

  const nameToLabel: Record<string, string> = {};
  const integerLabels = new Set<string>();
  const dateLabels = new Set<string>();
  const valueNameToLabel: Record<string, Record<string, string>> = {};
  const byListName: Record<string, Record<string, string>> = {};
  let surveyRowsObserved = 0;
  let surveyRowsLabeled = 0;

  // Three probe paths so the walker survives both endpoint shapes
  // AND a bracket-character that LOOKS LIKE the same shape but
  // isn't (the local var `data` shadows the JSON key `data` — the
  // survey sheets live at res.data.survey which is positional 2):
  //   1. /api/v2/assets/{uid}/content/ → the inner `data` wrapper
  //      holds survey/choices/settings sheets (res.data.survey).
  //      This is the working path on kf.kobotoolbox.org today.
  //   2. Old KPI v2 deployments exposed sheets via `content` dict
  //      (res.content.survey).
  //   3. Last-ditch fallback for any unexpected top-level survey
  //      (res.survey) so older bugs don't regress.
  // The pre-fix walker only used paths 2 + 3, both of which miss
  // on the /content/ endpoint — the walker ran but `surveyList`
  // resolved to `[]`, no rows registered into `nameToLabel`, and
  // every record cell came back as the raw snake_case path. This
  // three-tier probe mirrors DASHPLUS_PLAN.md §3 Hard rule #3
  // (always check both shapes) extended with the inner wrapper.
  const content =
    data && typeof data === "object"
      ? ((data as Record<string, unknown>).content as
          | Record<string, unknown>
          | null)
      : null;
  const innerSheets =
    data && typeof data === "object"
      ? ((data as Record<string, unknown>).data as
          | Record<string, unknown>
          | null)
      : null;
  const surveyList: Array<Record<string, unknown>> = Array.isArray(
    innerSheets?.survey
  )
    ? (innerSheets!.survey as Array<Record<string, unknown>>)
    : Array.isArray(content?.survey)
    ? (content!.survey as Array<Record<string, unknown>>)
    : Array.isArray(data?.survey)
    ? (data.survey as Array<Record<string, unknown>>)
    : [];
  const choicesList: Array<Record<string, unknown>> = Array.isArray(
    innerSheets?.choices
  )
    ? (innerSheets!.choices as Array<Record<string, unknown>>)
    : Array.isArray(content?.choices)
    ? (content!.choices as Array<Record<string, unknown>>)
    : Array.isArray(data?.choices)
    ? (data.choices as Array<Record<string, unknown>>)
    : [];

  // Pass 1: walk the choices sheet to build a per-list_name slug→label map.
  // `list_name` ties each choice row to a question's `type` suffix — e.g.
  // a survey row of `type: select_one district` corresponds to choices with
  // `list_name: 'district'`.
  for (const c of choicesList) {
    if (!c || typeof c !== "object") continue;
    const listName = (c as Record<string, unknown>).list_name;
    const slug = (c as Record<string, unknown>).name;
    const cLabel = extractLabel((c as Record<string, unknown>).label);
    if (typeof listName !== "string" || !listName) continue;
    if (typeof slug !== "string" || !slug || !cLabel) continue;
    (byListName[listName] ??= {})[slug] = cLabel;
  }

  // Pass 2: walk the survey sheet to build name→label plus integer/date
  // tags, then wire each select_* question to the value-map we just built.
  // KPI v2 emits groups as FLAT SIBLING MARKERS (`begin_group` row with a
  // `name: "demographics"`, then leaf rows underneath, then `end_group`),
  // not as a `children[]` nested tree. We stack group names as we walk and
  // prepend the joined path to each leaf's `name` so the key in
  // `nameToLabel` matches the GROUP-PREFIXED KEY Kobo persists in the
  // response (e.g. `basic_information/current_district`). Without this,
  // lookup `meta.nameToLabel["basic_information/current_district"]` misses
  // because walker registered `meta.nameToLabel["current_district"]`.
  const groupStack: string[] = [];
  for (const q of surveyList) {
    if (!q || typeof q !== "object") continue;
    const rawType = (q as Record<string, unknown>).type;
    const t = typeof rawType === "string" ? rawType.split(" ", 1)[0] : "";
    const name = (q as Record<string, unknown>).name;
    const isGroupMarker =
      typeof rawType === "string" &&
      (rawType === "begin_group" ||
        rawType === "end_group" ||
        rawType.startsWith("begin ") ||
        rawType.startsWith("end "));
    if (isGroupMarker) {
      if (rawType === "end_group" || rawType.startsWith("end ")) {
        if (groupStack.length) groupStack.pop();
      } else if (typeof name === "string" && name) {
        groupStack.push(name);
      }
      continue;
    }
    if (typeof name !== "string" || !name) continue;
    surveyRowsObserved++;
    const path = groupStack.length ? `${groupStack.join("/")}/${name}` : name;
    const lbl = extractLabel((q as Record<string, unknown>).label);
    // Two-tier registration:
    //   - labelled leaves → register the raw group-prefixed path mapped
    //     to the dashboard label (so a record's "District" cell comes
    //     from `r["basic_information/current_district"] === "arua"`).
    //   - unlabelled leaves (typically `score_*` calculate fields and
    //     Kobo metadata rows) → keep the bare survey `name` so Wework
    //     consumers can keep referencing `r.score_age` cleanly without
    //     dragging the `eligibility/` prefix into every accessor.
    //
    // Then a SINGLE post-registration block applies the integer /
    // calculate / date coercion so calculate fields (Wework's
    // `score_age`, `score_gender`, `score_vuln`) get coerced to
    // numbers — previously the walker only coerced `type: integer`,
    // and Kobo serialises calculate results as numeric strings
    // (`"5"`) so `typeof r.score_age === "number"` returned false
    // and `compositeScore` returned null, regressing Wework's
    // headline KPI to 0.0.
    const registeredKey = lbl || name;
    nameToLabel[path] = registeredKey;
    if (lbl) surveyRowsLabeled++;
    if (t === "integer" || t === "calculate") {
      integerLabels.add(registeredKey);
    } else if (t === "date") {
      dateLabels.add(registeredKey);
    }
    // select_one / select_multiple: the value-map comes from the choices
    // sheet via `list_name` matching the question type suffix. Some
    // deployments also inline `q.choices` per question — honour it as a
    // secondary source if the choices sheet didn't provide one.
    if (t === "select_one" || t === "select_multiple") {
      const after =
        typeof rawType === "string" ? rawType.slice(t.length).trim() : "";
      // Primary cross-reference: KPI v2 groups choices by `list_name`
      // whose value most forms keep in sync with the survey row's `name`
      // (e.g. survey `name: gender` ↔ choices with `list_name: gender`).
      // The modal KPI v2 response strips the `select_one <listname>`
      // suffix from `type`, so `after` is unreliable — using the survey
      // row's `name` is the authoritative way to find the valueMap.
      // Fall back to `after` for forms that still preserve the suffix
      // (older deployments, including the one this code was originally
      // written against).
      let map = byListName[name];
      if (!map && after) map = byListName[after];
      if (map && Object.keys(map).length) valueNameToLabel[path] = map;
      if (!valueNameToLabel[path]) {
        const inline = (q as Record<string, unknown>).choices;
        if (Array.isArray(inline)) {
          const inlineMap: Record<string, string> = {};
          for (const c of inline) {
            if (!c || typeof c !== "object") continue;
            const cName = (c as Record<string, unknown>).name;
            const cLabel = extractLabel((c as Record<string, unknown>).label);
            if (typeof cName === "string" && cName && cLabel) {
              inlineMap[cName] = cLabel;
            }
          }
          if (Object.keys(inlineMap).length)
            valueNameToLabel[path] = inlineMap;
        }
      }
    }
  }

  return {
    uid: typeof data?.uid === "string" ? data.uid : config.assetUid,
    name: typeof data?.name === "string" ? data.name : "Kobo form",
    version: typeof data?.version === "string" ? data.version : undefined,
    nameToLabel,
    integerLabels,
    dateLabels,
    valueNameToLabel,
    surveyRowsObserved,
    surveyRowsLabeled,
  };
}

function normalizeSubmission(
  raw: Record<string, unknown>,
  meta: KoboFormMeta
): DynamicRecord {
  // Step 1: copy, rewrite select_one slug values to display labels, then
  // rename snake_case keys via the schema-derived map. Doing value-translate
  // BEFORE key-rename keeps the loop single-pass and matches the shape
  // `data/feedback.json` already ships (label-keyed, label-valued), so
  // filters / KPIs / charts work uniformly across the live and fallback
  // paths.
  const mapped: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (k === "meta" || k.startsWith("_")) {
      mapped[k] = v;
      continue;
    }
    const valueMap = meta.valueNameToLabel[k];
    let displayValue: unknown = v;
    if (
      valueMap &&
      typeof v === "string" &&
      Object.prototype.hasOwnProperty.call(valueMap, v)
    ) {
      displayValue = valueMap[v];
    }
    const targetKey = meta.nameToLabel[k] ?? k;
    mapped[targetKey] = displayValue;
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

  // Step 4 (refactored): in-place dynamic-record stamp.
  //
  // The strict PascalCase projection above is replaced by an in-place
  // mutation of `mapped`. Every label-keyed field Kobo returned stays
  // in `mapped` under its label name (Steps 1–3 above have already
  // done the snake_case→label rename, valueMap translation, integer
  // coercion, and date-shape validation). The 3 metadata fields get
  // tightened to DynamicRecord's contract (`_id: number`,
  // `_uuid: string`, `_submission_time: string | null`).
  //
  // Beyond the literal "Yes"/"No" / "Male"/"Female" labels that the
  // valueMap translation produces, Kobo sometimes persists the
  // operator-typed value verbatim BEFORE the valueMap lookup fires —
  // e.g. if the survey row's `list_name` differs from its `name`
  // (the `is_emergency`, `reported_to_integrity`,
  // `requires_urgent_response` rows all point at `list_name: yes_no`),
  // or for any select_* whose valueMap wasn't captured. Accept the
  // bare-slug forms below so the simplest bug class doesn't propagate
  // as nulls — without this, the Gender chart shows zero bars even
  // when raw submissions have `gender: "male"` (the prior Bug C fix
  // preserved this defensive layer; Step 3 keeps it).
  const yesNo = (v: unknown): "Yes" | "No" | null => {
    if (v === "Yes" || v === "No") return v as "Yes" | "No";
    if (v === "yes" || v === "Y") return "Yes";
    if (v === "no" || v === "N") return "No";
    return null;
  };
  const maleFemale = (v: unknown): "Male" | "Female" | null => {
    if (v === "Male" || v === "Female") return v as "Male" | "Female";
    if (v === "male" || v === "M" || v === "m") return "Male";
    if (v === "female" || v === "F" || v === "f") return "Female";
    return null;
  };

  mapped["Emergency Feedback"] = yesNo(mapped["Emergency Feedback"]);
  mapped.Gender = maleFemale(mapped.Gender);
  mapped._id = numOf(mapped._id) ?? 0;
  mapped._uuid = strOf(mapped._uuid) ?? "";
  mapped._submission_time = strOf(mapped._submission_time) ?? null;

  // Step 5 (defensive): drop non-Cell values from `mapped` before the
  // open-dict cast. Kobo metadata dicts list-shaped (_geolocation,
  // _attachments, _validation_status, _notes, _tags) are not
  // string|number|null and would crash consumers that call
  // `String(value)` (e.g. Step 12's detail-drawer auto-discovery).
  // Today's strict 24-field projection dropped them implicitly; this
  // explicit filter reproduces today's silent-drop behaviour so
  // Step 3 preserves the Cordaid runtime characteristics exactly.
  for (const k of Object.keys(mapped)) {
    if (!isCell(mapped[k])) delete mapped[k];
  }

  return mapped as DynamicRecord;
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
    // Carry the schema counters via a private annotation so the route
    // can decide whether to surface meta.warning without lifting them
    // into KoboFetchResult's public surface (which would itself need
    // to widen consumers' types). See app/api/feedback/route.ts.
    _schemaSummary: {
      observed: meta.surveyRowsObserved,
      labeled: meta.surveyRowsLabeled,
    },
  };
}
