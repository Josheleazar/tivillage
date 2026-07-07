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

## Seeding a Kobo test asset

For end-to-end testing without touching a real Cordaid project, you can upload
the placeholder data to a fresh Kobo form on your own account using two
files committed alongside this repo — no scripts, no API tokens.

### Files

Use the **`.xlsx` files** (Kobo's canonical format) for the actual upload; the
**`.csv` files** are sibling deliverables that are handy if you want to diff in
git or fall back when an XLSForm upload fails for some reason.

| Path | What it is |
| --- | --- |
| `data/form-template.xlsx` | Canonical Kobo **XLSForm** — `survey`, `choices`, `settings` sheets. Drop into Kobo's **Upload XLSForm**. |
| `data/feedback.xlsx` | 316 submission rows (frozen header, widths tuned, dark Cordaid-red header fill). Drop into **Data → Replace data**. |
| `data/form-template.csv` | Same XLSForm as a single CSV with `survey` / `choices` / `settings` marker rows — git-diff-friendly. |
| `data/feedback.csv` | Same submissions as `feedback.xlsx` in flat CSV form — git-diff-friendly. |

### Step 1 — create the form (≈ 30 s)

1. In KoboToolbox, click **New → Upload XLSForm**.
2. Drop `data/form-template.xlsx` (or `data/form-template.csv` if you prefer the CSV variant).
3. Kobo validates and creates the form titled **Cordaid Feedback Dashboard Test** (form id `cordaid_feedback_dashboard_test`).
4. Note the new asset **UID** in the URL — `…/forms/<UID>/summary`.

### Step 2 — upload the 316 records

1. From the form summary, click **Data → Replace data** (or **Import → Records**).
2. Drop `data/feedback.xlsx` (or `data/feedback.csv`).
3. Kobo ingests all 316 rows; the row count on the Reports tab should match.

### Step 3 — point the dashboard at it

Add three values to `.env.local` (or Vercel **Settings → Environment Variables**; mark `KOBO_API_TOKEN` as **Sensitive**, never `NEXT_PUBLIC_*`):

```ini
KOBO_API_TOKEN=…
KOBO_ASSET_UID=<uid from Step 1>
KOBO_BASE_URL=https://kf.kobotoolbox.org     # or https://eu.kobotoolbox.org
```

Redeploy. The dashboard pulls the live 316 records from your Kobo test asset
(and falls back to local `data/feedback.json` whenever the env vars are
missing, so local dev keeps working without secrets).

### Column-to-XLSForm map

| Dashboard label | `name` | `type` |
| --- | --- | --- |
| Date | `date` | `date` |
| Activity | `activity` | `text` |
| Feedback Channel used | `feedback_channel` | `select_one feedback_channel` |
| Feedback Category | `feedback_category` | `select_one feedback_category` |
| Emergency Feedback | `is_emergency` | `select_one yes_no` |
| Thematic Area | `thematic_area` | `select_one thematic_area` |
| Project related to feedback | `project_code` | `text` |
| District | `district` | `text` |
| Subcounty | `subcounty` | `text` |
| Village | `village` | `text` |
| Who is giving feedback? | `respondent_name` | `text` |
| Gender | `gender` | `select_one gender` |
| Age | `age` | `integer` |
| Description of feedback, suggestion or complaint | `feedback_text` | `text` |
| Description of actions taken | `actions_taken` | `text` |
| Referral Status | `referral_status` | `text` |
| Status of this feedback | `feedback_status` | `select_one feedback_status` |
| Date feedback was resolved | `date_resolved` | `date` |
| Days taken to resolved this feedback | `days_to_resolve` | `integer` |
| Reported to Integrity Focal Person | `reported_to_integrity` | `select_one yes_no` |
| Feedback requires urgent response | `requires_urgent_response` | `select_one yes_no` |
| Feedback Categorized as | `categorized_as` | `text` |

## Dataset note

The dataset is derived from the original Cordaid HTML dashboard and contains
316 feedback records. To refresh it, replace `data/feedback.json` with an
updated export from Kobo (matching the same column shape) and redeploy.
