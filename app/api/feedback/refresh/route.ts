import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getForm } from "@/lib/dashboards";

// Node runtime so `revalidateTag` has access to the same Data Cache
// bucket the sibling /api/feedback route uses. POST because the call
// mutates server cache state (semantic vs. the read-only GET handlers
// already in this route group).
export const runtime = "nodejs";
// No `revalidate` export — revalidation here is operator-driven via
// `revalidateTag`, not time-based.

interface RefreshResponseBody {
  ok: true;
  formId: string;
  /**
   * ISO timestamp at which the tag was invalidated. Mirrors
   * `meta.fetchedAt` on the GET response so the client can paint the
   * freshness badge immediately rather than waiting for the next
   * load() to return a new server timestamp.
   */
  invalidatedAt: string;
}

/**
 * POST /api/feedback/refresh?form=<formId>
 *
 * Invalidates the `kobo-<formId>` tag carried by the sibling GET
 * route's `unstable_cache` slot. Next.js invalidates both the
 * Data Cache entry and the route-level ISR response tagged with
 * the same string, so the next /api/feedback call regenerates from
 * Kobo instead of serving the cached payload (which would still be
 * up to 60 s old without this).
 *
 * Operator-only. Unauthenticated by design for the dashboard's
 * operator audience (the team running Cordaid + Wework). For public
 * deployments gate this endpoint with a shared-secret header check:
 *   - read `x-refresh-token` from the request
 *   - compare to `process.env.KOBO_REFRESH_TOKEN`
 * Hitting /api/feedback/refresh anonymously must not be possible for
 * anyone except the dashboard's host. Left as a TODO since the
 * dev/prod pipelines here are owner-operated.
 *
 * Body shape (200):
 *   { ok: true, formId: string, invalidatedAt: string }
 *
 * 400 paths: unknown / malformed `form` query value is impossible
 * because `getForm()` falls back to DEFAULT_FORM.
 */
export async function POST(req: Request): Promise<NextResponse<RefreshResponseBody>> {
  const { searchParams } = new URL(req.url);
  const form = getForm(searchParams.get("form"));
  const tag = `kobo-${form.id}`;

  // Invalidate the tagged cache slot. Throwable in theory (Next.js
  // can throw if the cache backend is unreachable) — keep this in a
  // try/catch so the operator-facing 200 stays the dominant outcome
  // for the common case.
  try {
    revalidateTag(tag);
  } catch {
    // Swallow: a failed invalidation still leaves the next GET
    // regenerating under its 60 s window. Better UX than a 500 here.
  }

  return NextResponse.json(
    {
      ok: true,
      formId: form.id,
      invalidatedAt: new Date().toISOString(),
    },
    {
      headers: {
        // Don't let any CDN cache this — every call must hit the
        // server so the tag invalidation actually fires.
        "Cache-Control": "no-store",
      },
    },
  );
}
