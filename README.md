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
| `data/feedback.jsonl` | One JSON submission per line, field names match the XLSForm `name` attributes exactly. Used by the API-based bulk-seed path below when the UI does not expose Replace data. |

### Step 1 — create the form (≈ 30 s)

1. In KoboToolbox, click **New → Upload XLSForm**.
2. Drop `data/form-template.xlsx` (or `data/form-template.csv` if you prefer the CSV variant).
3. Kobo validates and creates the form titled **Cordaid Feedback Dashboard Test** (form id `cordaid_feedback_dashboard_test`).
4. Note the new asset **UID** in the URL — `…/forms/<UID>/summary`.

### Step 2 — upload the 316 records

Pick **A** if your Kobo deployment exposes **Data → Replace data**. Pick **B** if the UI does not (EU humanitarian server, locked-down projects, older versions, or any environment where `Replace data` is hidden behind project-level restrictions).

**A · UI bulk import**

1. From the form summary, click **Data → Replace data** (or **Import → Records**).
2. Drop `data/feedback.xlsx` (or `data/feedback.csv`).
3. Kobo ingests all 316 rows; the row count on the Reports tab should match.

**B · API bulk seed (works on every Kobo version)**

The KoboToolbox KPI v2 API accepts `POST /api/v2/assets/{asset_uid}/submissions/` for new submissions — no UI required. Each line of `data/feedback.jsonl` is one ready-to-POST submission (the XLSForm `name` attributes, with `select_one` values already normalised to the choice `name`s).

Load the env vars, then loop through the file:

```bash
# 1. Pick up KOBO_API_TOKEN / KOBO_ASSET_UID / KOBO_BASE_URL from .env.local
#    (Vercel injects them on the dashboard side; locally we source them.)
set -a; source .env.local; set +a

# 2. POST every record — one HTTP request per line, 200 ms apart to stay
#    well under Kobo's throttle.
while IFS= read -r line; do
  curl -sS -o /dev/null -w "%{http_code}\n" \
    -X POST \
    -H "Authorization: Token ${KOBO_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${line}" \
    "${KOBO_BASE_URL}/api/v2/assets/${KOBO_ASSET_UID}/submissions/"
  sleep 0.2
done < data/feedback.jsonl
```

Verify the count before reloading the dashboard:

```bash
curl -s -H "Authorization: Token ${KOBO_API_TOKEN}" \
  "${KOBO_BASE_URL}/api/v2/assets/${KOBO_ASSET_UID}/data/?limit=1" \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print("Kobo totalCount =",d.get("count"))'
```

You want `Kobo totalCount = 316`. If still 0, the asset UID is wrong (or you uploaded to a different form) — re-check the URL of the form you're seeding.

> Note on `_id` / `_uuid`: Kobo assigns those server-side, so they're not included in the JSONL payload — Kobo is the source of truth for those fields. `_submission_time` **is** included so historical dates round-trip faithfully.

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
