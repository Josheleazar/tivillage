import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { ApiMeta, DynamicRecord } from "@/lib/types";
import {
  fetchKoboSubmissions,
  type KoboConfig,
} from "@/lib/kobo";

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

export async function GET() {
  const token = process.env.KOBO_API_TOKEN;
  const assetUid = process.env.KOBO_ASSET_UID;
  const baseUrl = process.env.KOBO_BASE_URL || DEFAULT_KOBO_BASE_URL;

  if (token && assetUid) {
    try {
      const result = await fetchKoboSubmissions(
        { token, assetUid, baseUrl } satisfies KoboConfig
      );
      const meta: ApiMeta = {
        source: "kobo",
        count: result.records.length,
        uid: result.uid,
        name: result.name,
        version: result.version,
        baseUrl,
        fetchedAt: result.fetchedAt,
        truncated: result.truncated,
        totalCount: result.totalCount ?? undefined,
      };
      return NextResponse.json(
        {
          count: result.records.length,
          records: result.records,
          meta: result.truncated
            ? // Truncated responses should refresh more aggressively so we
              // pick up newly added pages sooner.
              { ...meta, _cacheHint: "truncated" as const }
            : meta,
        },
        { headers: CACHE_HEADERS }
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown Kobo error";
      const local = await readLocalJson();
      const meta: ApiMeta = {
        source: "kobo-fallback",
        count: local.length,
        uid: assetUid,
        baseUrl,
        error: message,
      };
      return NextResponse.json(
        { count: local.length, records: local, meta },
        { headers: FALLBACK_CACHE_HEADERS }
      );
    }
  }

  const local = await readLocalJson();
  const meta: ApiMeta = { source: "local", count: local.length };
  return NextResponse.json(
    { count: local.length, records: local, meta },
    { headers: CACHE_HEADERS }
  );
}
