# Cordaid Feedback and Response Dashboard

A modern Next.js rebuild of `Cordaid_Feedback_Response_HTML_Dashboard.html`, with
sortable + paginated records, a row-detail drawer, and ECharts visualisations.

## Stack

- **Next.js 14** (App Router) + **TypeScript**
- **Tailwind CSS** + shadcn-style UI primitives (button, card, input, badge, select, drawer, table)
- **ECharts** via `echarts-for-react` (dynamic-imported so it stays out of the SSR bundle)
- **Radix UI** for the Sheet / Drawer primitive
- **Lucide React** for icons

## Folder layout

```
app/                    # Next.js App Router (route at / and /api/feedback)
components/
  ui/                   # Headless shadcn-style primitives
  dashboard/            # Header, FilterBar, KpiCards, Charts, FeedbackTable, DetailDrawer, DashboardClient
data/
  feedback.json         # 316-record Kobo feedback dataset (extracted from the original HTML)
lib/                    # types, constants, filter/aggregation helpers, cn utility
```

## Local development

```bash
pnpm install
pnpm dev        # http://localhost:3000
pnpm typecheck  # tsc --noEmit
pnpm build      # production build
pnpm start      # serve the built app
```

The dashboard fetches `/api/feedback`, which reads `data/feedback.json` from disk
on first call and serves it for the rest of the server lifetime. No environment
variables are required.

## Deploying to Vercel

Vercel auto-detects the framework, build command (`next build`), and package
manager (`pnpm`) — there is no additional config to ship.

### Option 1 — Git integration (recommended)

1. Push this repository to GitHub / GitLab / Bitbucket.
2. In the [Vercel dashboard](https://vercel.com/new), click **Import Project**
   and select the repo.
3. Accept the detected defaults (no env vars, no overrides needed).
4. Click **Deploy**. Subsequent pushes to `main` will redeploy automatically;
   every PR gets its own preview URL.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-org/your-repo)

### Option 2 — Vercel CLI

```bash
pnpm dlx vercel login
pnpm dlx vercel        # first deploy, picks up auto-detected settings
pnpm dlx vercel --prod # promote to production
```

### What gets deployed

- All routes in `app/` (the `/` dashboard and `/api/feedback`).
- The static dataset in `data/feedback.json` (bundled with the server function).
- Static assets under `.next/static` and any images / fonts under `public/`
  (none today, but safe to add).

`/api/feedback` is statically generated at build time thanks to
`export const dynamic = "force-static"`, so Vercel serves it from its CDN
edge with zero cold-start latency. The response carries
`Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800`
so client and CDN caches stay warm across deploys.

### Optional: connect a custom domain

In the Vercel project → **Settings → Domains**, add your domain and follow the
DNS instructions. No app changes are required.

## Dataset note

The dataset is derived from the original Cordaid HTML dashboard and contains
316 feedback records. To refresh it, replace `data/feedback.json` with an
updated export from Kobo (matching the same column shape) and redeploy.
