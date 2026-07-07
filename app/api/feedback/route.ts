import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import type { FeedbackRecord } from "@/lib/types";

// Run on the Node.js runtime explicitly so `fs` is always available,
// even if Vercel changes its default bucketing for API routes in the
// future. The route is fully static at build time (see `force-static`),
// so Vercel will serve `/api/feedback` straight from the CDN edge.
export const runtime = "nodejs";
export const dynamic = "force-static";

let cache: FeedbackRecord[] | null = null;

async function loadData(): Promise<FeedbackRecord[]> {
  if (cache) return cache;
  const filePath = path.join(process.cwd(), "data", "feedback.json");
  const raw = await fs.readFile(filePath, "utf8");
  cache = JSON.parse(raw) as FeedbackRecord[];
  return cache;
}

export async function GET() {
  try {
    const records = await loadData();
    return NextResponse.json(
      {
        count: records.length,
        records,
      },
      {
        headers: {
          // The dataset is immutable for a given deployment, so it's safe
          // to cache aggressively at the CDN and on the client.
          "Cache-Control":
            "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to load feedback dataset", message },
      { status: 500 }
    );
  }
}
