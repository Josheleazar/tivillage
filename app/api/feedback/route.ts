import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type { ApiMeta, DynamicRecord } from "@/lib/types";
import {
  fetchKoboSubmissions,
  type KoboConfig,
} from "@/lib/kobo";
import { getForm } from "@/lib/dashboards";

// Node runtime so `fs` is available for the JSON fallback; Kobo fetches
// use plain `fetch`, which works on Node and Edge.
export const runtime = "nodejs";

// ISR: serve a cached route response for ~60 s, then revalidate. This
// keeps the dashboard snappy while still letting fresh Kobo data land
// every minute. The fallback path uses a much shorter TTL so a
// transient Kobo failure doesn't pin the dashboard to local JSON
// for a whole minute.
export const revalidate = 60;

const DEFAULT_KOBO_BASE_URL = "https://kf.kobotoolbox.org";

const CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=60, s-maxage=60, stale-while-revalidate=300",
};
const FALLBACK_CACHE_HEADERS = {
  "Cache-Control":
    "public, max-age=5, s-maxage=5, stale-while-revalidate=15",
};

async function readLocalJson(): Promise<DynamicRecord[]> {
  const filePath = path.join(process.cwd(), "data", "feedback.json");
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as DynamicRecord[];
}

/**
 * Resolves env keys for the active form via its envPrefix. Each form's
 * `<envPrefix>_ASSET_UID` is read primarily, with a `_DEV` fallback
 * that lets us flip the live prod value into a sandboxed dev value
 * for testing (without renaming env vars in Vercel). Token + base URL
 * fall back to the bare `KOBO_*` keys for dev convenience so a single
 * shared KOBO_API_TOKEN can serve multiple forms until each gets its
 * own dedicated credentials in prod.
 */
function resolveEnv(envPrefix: string): {
  token: string | undefined;
  assetUid: string | undefined;
  baseUrl: string;
} {
  return {
    assetUid:
      process.env[`${envPrefix}_ASSET_UID_DEV`] ??
      process.env[`${envPrefix}_ASSET_UID`],
    baseUrl:
      process.env[`${envPrefix}_BASE_URL`] ??
      process.env.KOBO_BASE_URL ??
      DEFAULT_KOBO_BASE_URL,
    token:
      process.env[`${envPrefix}_API_TOKEN`] ??
      process.env.KOBO_API_TOKEN,
  };
}

/**
 * Cordaid has a bundled JSON fallback (data/feedback.json is its
 * static export). Other forms have no fallback artefact — they report
 * an empty record set on Kobo error rather than silently serving the
 * wrong form's data labelled as the active form. Step 14's repo
 * housekeeping can drop a Wework.json stub if the team wants a
 * testing fallback for WeWork too.
 */
async function readLocalFallback(formId: string): Promise<DynamicRecord[]> {
  if (formId !== "cordaidDemo") return [];
  return readLocalJson();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const form = getForm(searchParams.get("form"));

  const { token, assetUid, baseUrl } = resolveEnv(form.envPrefix);

  if (token && assetUid) {
    // unstable_cache wraps the Kobo fetch with per-form cache identity.
    // The cache key is ["kobo-fetch", form.id] so Cordaid and WeWork
    // never share a cache slot — even though `revalidate = 60` would
    // route-cache the per-form URLs identically. The tag `kobo-<formId>`
    // enables operator-driven refresh from a future script:
    //   revalidateTag(`kobo-Wework`) from a Vercel cron, for instance.
    const taggedFetch = unstable_cache(
      async () =>
        fetchKoboSubmissions({
          token: token!,
          assetUid: assetUid!,
          baseUrl,
        } satisfies KoboConfig),
      ["kobo-fetch", form.id],
      { revalidate: 60, tags: [`kobo-${form.id}`] }
    );
    try {
      const result = await taggedFetch();
      const meta: ApiMeta = {
        source: form.id,
        count: result.records.length,
        uid: result.uid,
        name: result.name,
        version: result.version,
        baseUrl,
        fetchedAt: result.fetchedAt,
        truncated: result.truncated,
        totalCount: result.totalCount ?? undefined,
      };
      // Lesson 3 guardrail (DASHPLUS_PLAN.md §3): when the schema walker
      // observes rows but registers NONE with a label, the rename is a
      // silent no-op and every record's "District" / "Gender" / etc.
      // cell comes back as the snake_case key with the raw Kobo slug.
      // Surface that as a top-level `meta.warning` so the dashboard's
      // source-chip can render it beneath the source label rather than
      // masquerading as an empty-data state. Also flag when zero rows
      // were observed at all (likely a permission/asset-deletion issue).
      const observed = result._schemaSummary?.observed ?? null;
      const labeled = result._schemaSummary?.labeled ?? null;
      if (observed !== null && labeled !== null) {
        if (observed === 0) {
          meta.warning =
            `Schema fetch returned no survey rows for ${form.label}; ` +
            "records will render with raw Kobo keys and slug values.";
        } else if (labeled === 0) {
          meta.warning =
            `Schema fetch observed ${observed} survey rows but none carried a label; ` +
            "records will render with raw Kobo keys and slug values.";
        } else if (labeled < observed * 0.25) {
          meta.warning =
            `Schema fetch only labelled ${labeled}/${observed} survey rows; ` +
            "many record fields may render as raw Kobo keys.";
        }
      }
      return NextResponse.json(
        {
          count: result.records.length,
          records: result.records,
          meta: result.truncated
            ? {
                ...meta,
                _cacheHint: "truncated" as const,
              }
            : meta,
        },
        { headers: CACHE_HEADERS }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Kobo error";
      const records = await readLocalFallback(form.id);
      const meta: ApiMeta = {
        source: `${form.id}-fallback`,
        count: records.length,
        uid: assetUid,
        baseUrl,
        error: message,
      };
      return NextResponse.json(
        { count: records.length, records, meta },
        { headers: FALLBACK_CACHE_HEADERS }
      );
    }
  }

  // No env keys → local-only path. Cordaid has bundled JSON; other
  // forms return empty records.
  const records = await readLocalFallback(form.id);
  const meta: ApiMeta = { source: "local", count: records.length };
  return NextResponse.json(
    { count: records.length, records, meta },
    { headers: CACHE_HEADERS }
  );
}
