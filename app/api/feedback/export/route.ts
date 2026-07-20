import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import type { DynamicRecord } from "@/lib/types";
import { fetchKoboSubmissions, type KoboConfig } from "@/lib/kobo";
import { applyFilters, toCsv } from "@/lib/filters";
import { getForm } from "@/lib/dashboards";

export const runtime = "nodejs";

const DEFAULT_KOBO_BASE_URL = "https://kf.kobotoolbox.org";

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

function collectFilterParams(
  searchParams: URLSearchParams,
): Record<string, string> {
  const SYSTEM_PARAMS = new Set(["form"]);
  const filters: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (!SYSTEM_PARAMS.has(key) && value) {
      filters[key] = value;
    }
  }
  return filters;
}

/**
 * GET /api/feedback/export?form=Agrip[&district=Bududa][&gender=Female]
 *
 * Returns a downloadable CSV of the full filtered record set. Shares the
 * same Kobo cache slot as the main /api/feedback route (unstable_cache
 * keyed by ["kobo-fetch", form.id]) so exports don't trigger extra Kobo
 * fetches.
 *
 * Filter params are forwarded to applyFilters() on the server so the
 * CSV respects the same filter state the dashboard shows.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const form = getForm(searchParams.get("form"));
  const { token, assetUid, baseUrl } = resolveEnv(form.envPrefix);

  let records: DynamicRecord[];

  if (token && assetUid) {
    const taggedFetch = unstable_cache(
      async () =>
        fetchKoboSubmissions({
          token: token!,
          assetUid: assetUid!,
          baseUrl,
        } satisfies KoboConfig),
      ["kobo-fetch", form.id],
      { revalidate: false, tags: [`kobo-${form.id}`] },
    );
    try {
      const result = await taggedFetch();
      records = result.records;
    } catch {
      records = [];
    }
  } else {
    records = [];
  }

  // Apply filters if any filter params are present
  const filterParams = collectFilterParams(searchParams);
  const hasFilters = Object.keys(filterParams).length > 0;
  const filtered = hasFilters ? applyFilters(records, filterParams, form) : records;

  const csv = toCsv(filtered, form);
  const filename = `${form.id}-feedback-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
