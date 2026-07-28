# Cordaid Uganda: Solutions Architecture & Build Proposal

## Secure, KoboToolbox-Integrated Dashboard Standardisation for Three Applications

> **Submitted in response to:** Cordaid Uganda's Concept Note and Terms of Reference for Project 201576, "Strong Young People, Strong Companies".
> **Submitted by:** Josh Eleazar, Lead Engineer.
> **Engagement type:** Fixed-price design → build → deploy → handover → 30-day warranty per the brief's Deliverable D1–D6 schedule.
> **Proposed engagement duration:** 15 working days build + 30 calendar-day warranty.
> **Date:** 28 July 2026.
> **Version:** v1.1, initial professional draft for review.

---

## 1. Executive Summary

Cordaid Uganda's project performance work currently depends on repeated KoboToolbox HTTP exports and spreadsheet consolidation. Manual reconciliation of submissions slows decisions, produces competing versions of the same indicator, and weakens Cordaid's ability to act quickly enough on delayed activities, weak locations, or quality exceptions.

This proposal sets out the architecture, security model, performance budget, and migration plan for standardising three sibling Next.js applications on a shared, Cordaid-controlled infrastructure:

1. **Cordaid Feedback Dashboard**: feedback-and-response module.
2. **WeWork Dashboard**: partner-reach module.
3. **AGRIP Dashboard**: activities-and-participants module.

The three Next.js 14 applications run as independent Vercel projects under a single Vercel Pro account, importing shared logic from a Cordaid-owned `@cordaid/dashboard-core` library published to a private GitHub Packages namespace. They share a Neon Postgres database (schema-per-tenant isolation), an Auth.js v5 identity provider for the five Cordaid roles, and a GitHub Actions schedule that fetches KoboToolbox data on a configurable 5–15 minute cadence. The frontend query path is database-only: KoboToolbox is never called from a user request, and aggregations are pre-materialised in Postgres.

The brief's six expected benefits (timeliness, consistency, accountability, quality, inclusion-monitoring, and sustainability) are each mapped to a concrete deliverable below. This proposal also commits to the brief's D1–D6 acceptance schedule, the Cordaid-owned hosting and code-control requirements, the role-based access discipline, and the 30-calendar-day warranty with documented handover.

This proposal does not propose to rebuild what already works. The architecture below is de-risked by a working production reference implementation developed for the same domain, with the same technology stack, and with the same multi-tenant pattern Cordaid's three applications require. The 15-day engagement is therefore devoted to adapting a proven foundation to Cordaid's MERL rules, branding, role matrix, and indicator definitions, not to re-engineering the dashboard from scratch.

---

## 2. About the Consultant & Track Record

This is a **single-consultant engagement**. All design, build, integration, documentation, training, and warranty work is delivered by Josh Eleazar; the engagement does not include sub-contractors, partner firms, or external team augmentation. Cordaid ICT engages one named point of contact throughout the 15-day build and the 30-day warranty.

### 2.1 Lead Engineer Profile: Josh Eleazar

The technical delivery is by **Josh Eleazar**, a bilingual (English/French) Tech Engineer specialising in high-reliability cloud infrastructure, robust backend systems, and data-intensive products. Josh's career is anchored in the gap between code that works and software that lasts. That architectural discipline is exactly what Cordaid's brief explicitly demands under §11 *Confidentiality, Data Protection and Intellectual Property* and §13 *Proposal Submission, Evaluation and Contracting*.

Josh's working stack maps directly to the proposed deliverable:

| Capability domain | Concrete skills |
|---|---|
| **Cloud & infrastructure** | Google Cloud Platform, AWS, Kubernetes, Docker, Terraform (IaC), Prometheus, Grafana. |
| **DevOps & CI/CD** | Jenkins (multibranch, blue-green, automated rollbacks), Horizontal Pod Autoscaler & Cluster Autoscaler, full CI/CD pipeline design, and on-call troubleshooting. |
| **Backend & databases** | API development and integration, payment gateway integrations, logistics system integrations, Python, .NET, Java, PostgreSQL, SQL, system architecture, and software engineering. |
| **Frontend** | React (the framework family Cordaid's stack sits on), WordPress (used at Cordaid partner organisations). |
| **Enterprise integrations** | ERP systems, payment gateways, logistics platforms, and identity-provider integrations. |
| **Languages** | English, French. |

Two of these matter disproportionately for Cordaid:

- **Lean engineering rhythm under a tight timeline.** Cordaid's 15-working-day build window is tight. The proposed methodology front-loads reusable boilerplate templates, expands test coverage via a curated fixtures library, keeps dependency evidence in a pinned lockfile, and hardens the schema-walker through a documented catalogue of shape-drift modes. The output is enterprise-grade modular logic with complete documentation, without trading depth for speed.

### 2.2 Production Reference Implementation (de-risked by what already exists)

Rather than presenting Cordaid with a greenfield plan, this proposal rests on a **working production reference implementation developed for the same domain**: a multi-tenant KoboToolbox dashboard built on Next.js 14, TypeScript, Tailwind, React, ECharts, and Leaflet, deployed to Vercel, currently ingesting live data on production assets. The reference implementation already demonstrates, under real-world load rather than in a slide, every architectural primitive this proposal recommends.

The reference platform has demonstrated the following capabilities that this proposal commits to delivering to Cordaid:

| Reference capability | What it proves about the engagement |
|---|---|
| **Server-side aggregation engine** | Reduces 60,000+ raw KoboToolbox records into a ~50 KB decision-ready payload by pre-computing KPIs, ECharts options, filter options, drill-down cascades, and district map bubbles. The reference platform has demonstrated this pipeline on the same domain; observed metrics are valid only on the reference's data volumes and are not extrapolated to Cordaid's data without re-measurement. |
| **Declarative multi-form registry pattern** | Onboards a new monitoring project (Cordaid, WeWork, AGRIP) by adding one configuration file plus one registry entry. No bespoke dashboard code per project. Mirrors the brief's *"Scalable internal capability"* expected result. |
| **KoboToolbox schema walker** | Hardened against four documented KPI v2 shape-drift modes (string label, array-label, language-dict label, per-language top-level key); handles pagination limits, repeat-data, edit-detection, and version-mismatch without silently mis-labelling records. |
| **Performance-tuned visualisation layer** | ECharts and Leaflet are dynamically imported so the SSR bundle stays small. Circle-district map markers replace per-GPS point markers so the map renders district aggregates without per-record geometry. The actual reliability win at AGRIP-scale data is browser stability; render latency on Cordaid data is observed at Day-13 UAT, not asserted here. |
| **Declarative KPI / chart / filter / table config** | Adding an indicator, chart, or filter requires editing a typed config object, not a UI component. MERL-grade updates become a one-PR review. |
| **CSV export and pagination endpoints** | Existing record-register CSV export and table-pagination endpoints already meet the brief's *Reports and controlled export* requirement shape. The engagement work is layering the auth and audit, not building from zero. |
| **WCAG-aware UI patterns** | Visible focus, labelled controls, sufficient contrast, and status cues not solely colour-dependent. All reinforced by the proposal's CI axe-core gate. |

The 15-day build is therefore not a "design then build" exercise. It is "configure, integrate, harden, document, and test", which is the entire D1–D6 schedule in the brief's §6 *Deliverables, Timing and Acceptance*. The reference platform is not part of what is delivered to Cordaid. It is the private knowledge and codebase that makes the schedule feasible.

### 2.3 How the 15-day engagement is structured to honour Cordaid constraints

The brief's §13 demands evidence of methodology realism, handover detail, and cost transparency. The 15 working days follow the schedule in §9.1: Days 1–3 Inception, Days 4–6 data model and access matrix, Days 7–9 sync engine and RBAC, Day 10 staging beta, Days 11–13 UAT and test report, Days 14–15 production cutover and handover, Days 16–45 warranty with Day-45 closure report. The reference platform compresses integration; UAT rigour on Days 11–13 is new work, not skipped.

---

## 3. Architecture & Technical Strategy

### 3.1 Why "the browser only talks to the database"

KoboToolbox's KPI v2 `/data/` endpoint paginates at 1,000 rows per request. A 60,000-row dataset therefore requires 60 requests to walk fully, which Kobo is not designed to serve at user-request rate. Cordaid owns three Kobo assets (one per application), so the load multiplies. Worse, aggregation logic (small-cell suppression, indicator denominators, de-duplication, drill-down cascade computation) belongs in a controlled pipeline, not under transient user control. The brief's *stale-data warning* requirement implies a watermark-based view of data recency, and that watermark only exists if a Cordaid-owned database owns the data.

**Contracted rule:** the browser only talks to the Next.js application; the Next.js application only talks to Neon Postgres; only the scheduled background path talks to KoboToolbox.

**Performance reality.** The first-generation dashboard moved computation from the browser to a server-side API to escape the AGRIP browser crashes, and that move did reduce load times, though not as much as hoped. The reason it plateaued: every user request (filter change, refresh, drill-down) still crossed a slow boundary back to KoboToolbox to re-fetch raw submissions before the server could process them, and that roundtrip sat on the user-perceived latency path. The proposed Neon + GitHub Actions architecture is specifically designed to remove that on-request roundtrip. The sync engine fetches KoboToolbox data on a fixed cadence in the background, normalises and pre-computes aggregates into Postgres rows, and the user request then reads from a direct, indexed path against those pre-built rows. There is no KoboToolbox call on the user request path. The expected outcome on AGRIP-class data is a noticeable further reduction in load times. The exact millisecond or second counts depend on the size of the dataset, on the cardinality of the active filter combination, and on whether the filter hash hits a pre-computed aggregate or requires fresh materialisation. This proposal commits to the architectural direction and the brief's 5-second ceiling, not to a specific latency promise. As datasets grow past AGRIP's current 61k, the additional levers in §7.3 (denormalised aggregate tables, partial aggregations by time window, filter-hash pre-warming, read replicas) come into play and are tuned against measured regressions during the warranty and beyond.

This separation gives Cordaid three independent upgrade paths and four independent failure domains: the user-facing app, the database, the identity provider, and the sync engine. A failure in any one is contained.

### 3.2 Solution architecture (three sibling applications, one infrastructure)

```
┌──────────────────────────────────────────────────────────────────────┐
│                     Cordaid Uganda users (browser)                   │
│                                                                      │
│     Cordaid      WeWork      AGRIP                                   │
│    subdomain    subdomain   subdomain                                │
└──────────────────────────────────────────────────────────────────────┘
                 │ HTTPS · Auth.js session cookie · per-app subdomain
                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│                   Vercel · one Pro account, three projects           │
│                                                                      │
│   ┌──────────────────────┐  ┌──────────────────────┐  ┌────────────┐  │
│   │ Project: cordaid     │  │ Project: wework      │  │ Project:   │  │
│   │ cordaid.client.org   │  │ wework.client.org    │  │ agrip.     │  │
│   │ Next.js 14 deploy    │  │ Next.js 14 deploy    │  │ client.org │  │
│   │ imports dashboard-   │  │ imports dashboard-   │  │ imports    │  │
│   │ core from core-repo   │  │ core from core-repo   │  │ dashboard- │  │
│   │                      │  │                      │  │ core       │  │
│   └──────────┬───────────┘  └──────────┬───────────┘  └─────┬───────┘  │
│              │                         │                      │          │
└──────────────┼─────────────────────────┼──────────────────────┼──────────┘
               │                         │                      │
               ▼                         ▼                      ▼
┌──────────────────────────────────────────────────────────────────────┐
           │ HTTPS · pooled · least-privilege role            │ HTTPS
           ▼                                                  ▼
┌────────────────────────────┐                  ┌──────────────────────────┐
│  Neon Postgres (shared)    │                  │  Auth.js v5 service      │
│   ─────────────────────     │                  │   ──────────────────     │
│  schemas:                  │                  │  - Credentials provider  │
│   • public (auth, audit)   │                  │  - OAuth (Google, MS)    │
│   • cordaid                │                  │  - pg-adapter binds to   │
│   • wework                 │                  │    shared Neon roles     │
│   • agrip                  │                  │  - 5 Cordaid roles       │
│                            │                  │                          │
│  per-tenant tables:        │                  │  - audit logging         │
│   • raw submissions        │                  └────────────┬─────────────┘
│   • clean submissions      │                               │
│   • pre-computed KPIs      │                               │
│   • pre-computed charts    │                               │
│   • district bubbles       │                               │
│   • filter option sets     │                               │
│   • targets & indicators   │                               │
│   • tenant app_config      │                               │
│   • audit_log (public)     │                               │
│   • refresh_log (public)   │                               │
└──────────┬─────────────────┘                               │
           │ scheduled polling / trigger                     │
           ▼                                                 │
┌─────────────────────────────────────────────────────────────┘
│     GitHub Actions scheduled workflow (`.github/workflows/sync.yml`)
│         cron: */10 * * * *    ·   10-minute cadence, fan-out
│
│         One workflow → three tenant webhook POSTs in parallel
│         POST /api/internal/sync   (HMAC + tenant secret, GitHub Secrets)
│           ›
│         1. authenticate with per-tenant Kobo token
│         2. paginate Kobo /data/ to full totalCount
│         3. normalise, recode, de-duplicate
│         4. upsert into per-tenant submissions
│         5. rebuild per-tenant aggregates
│         6. apply small-cell suppression
│         7. write a structured row to audit_log and refresh_log
└──────────┬──────────────────────────────────────────
           │ HTTPS · API token · least-privilege per asset
           ▼
┌──────────────────────────────────────────┐
│  KoboToolbox · authoritative source       │
│    • Cordaid feedback asset               │
│    • WeWork partner-reach asset           │
│    • AGRIP activities-and-participants    │
└──────────────────────────────────────────┘
```

### 3.3 Stack choices and version pins

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript + Tailwind + Radix primitives + Lucide | Already proven in the reference implementation; meets the brief's Compatibility and Maintainability requirements. |
| Hosting | One Vercel Pro account hosting three Vercel projects | Each Cordaid application is its own Vercel project fed by its own GitHub repository, with its own production domain, its own deployment pipeline, and its own env-var scope. Projects stay in lock-step by importing the same `@cordaid/dashboard-core` package from a Cordaid-owned shared core repository that publishes to a private GitHub Packages registry inside the same Cordaid GitHub organisation, with Renovate-driven dependency-update PRs and CI gating on stale pins. |
| Data viz | ECharts (dynamic-imported) + Leaflet (per-tenant bundle split) | Performance-tuned; bundle remains outside the SSR path. |
| Auth | Auth.js v5 (NextAuth) with `@auth/pg-adapter` to Neon Postgres | Server-side sessions; revocable; Cordaid-owned; no third-party identity lock-in. |
| Auth providers | Credentials (email + password) + OAuth (Google + Microsoft) | Covers Cordaid staff with corporate credentials; supports external partners with Google or Microsoft identity without giving them a Cordaid-managed password. |
| Database | Neon Postgres (serverless driver, pooled), Launch plan | Per-tenant schema isolation; 7-day point-in-time recovery; branching for preview and staging. |
| Background sync | GitHub Actions scheduled workflow (5–15 minute cadence, per-tenant fan-out) | Free tier covers ~2,000 min/mo, of which the 10-minute cadence predicts ~4,320 min/mo; a predictable, transparent overage sits the SLA without resorting to external schedulers. |
| Object store | R2-compatible bucket (CSV export payloads only) | Cheap, Cordaid-controlled, 30-day TTL for exports. |
| Search / discovery | Built-in Postgres `ILIKE` for the record register; client-side lucide-react for iconography | Avoids adding a third search dependency for the brief's scope. |

### 3.4 Schema-per-tenant isolation strategy

Neon hosts one database with four Postgres schemas: a `public` schema holding the Auth.js user table, sessions, audit log, refresh log, and shared utilities; plus one schema per Cordaid application (`cordaid`, `wework`, `agrip`). Each application schema contains a uniform set of tables: raw submissions, clean submissions, pre-computed KPIs, pre-computed chart options, district-level geo-aggregations, filter option sets, indicators, targets, and a small per-tenant `app_config` table that records the last successful sync, the schema-version hash, and the stale-data flag. Cross-application analytical queries (for example, MERL comparing Cordaid feedback against AGRIP activity reach) are possible by setting the search path across all four schemas and are gated by a dedicated `app_reader` Postgres role.

Postgres roles enforce least privilege per the brief's *least privilege* clause. The Cordaid application's connection role can read and write only its own schema plus the shared `public` tables. The WeWork role sees only WeWork. The AGRIP role sees only AGRIP. A separate `app_cron` role (used only by the sync handler) writes to all raw and aggregate tables but cannot read user passwords. Migrations run from Cordaid-controlled CI/CD with a rotator-rotated credential.

This consolidated database addresses the brief's *Availability and recovery* requirement through clean tenant boundaries, no per-tenant operational surface, and a single backup and recovery point.

### 3.5 Multi-tenant code pattern (the four-repository model)

The reference implementation's `FormConfig` registry pattern is preserved end-to-end across a **two-tier architecture**: **one Cordaid-owned published library package, plus three Cordaid-owned Next.js 14 applications that consume it.**

1. **`cordaid-dashboard-core` (Cordaid-owned library).** Publishes as `@cordaid/dashboard-core` to a private GitHub Packages registry inside the Cordaid GitHub organisation. It is intentionally not a Next.js app: **no** `next.config`, **no** `app/` directory, **no** page routes, **no** API routes. Its contents are the `FormConfig` registry catalogue, shared React primitives (chart wrappers around ECharts, map wrappers around Leaflet, tables, KPI tiles, RBAC-aware UI guards), Auth.js v5 helpers (session validator, RBAC enforcement, login form, OAuth callback, logout action), sync-engine primitives (Kobo pagination, schema-walker, indicator validator, small-cell suppression), and compliance helpers (`audit_log` / `refresh_log` row shapes).

2. **`cordaid-feedback-dashboard`, `wework-partnerreach-dashboard`, `agrip-activities-dashboard` (Cordaid-owned application repositories) are each a full Next.js 14 application.** The `-dashboard` suffix distinguishes those Next.js *applications* (software) from the Cordaid-owned *KoboToolbox assets* they consume (`'Cordaid feedback asset'`, `'WeWork partner-reach asset'`, `'AGRIP activities-and-participants asset'` referenced in §3.2 and §5). Each application contains its own App Router structure, `next.config.mjs`, `package.json` pinning `@cordaid/dashboard-core` to an agreed minimum, FormConfig object declaring one or more KoboToolbox asset bindings, API routes (including the per-tenant sync-webhook endpoint invoked by §5.1), and Vercel wiring. Each application contains no bespoke dashboard code beyond its FormConfig selection; UI, RBAC, auth, sync engine, and audit logging all come from `@cordaid/dashboard-core`.

**Three apps, not one.** Cordaid ICT retains three independently deployable Vercel projects (`cordaid.client.org`, `wework.client.org`, `agrip.client.org`) with separate env-var scopes, separate GitHub repositories, separate production domains, and separate release cadences. They share library semantics, not a Next.js runtime. A disclosure-rule change to the Cordaid Feedback dashboard cannot accidentally surface WeWork partner-reach data even though both apps import the same library; the library enforces typing discipline and each application enforces scope discipline on top.

Each application repository connects 1:1 to one Vercel project (per §3.3); the core repository is not connected to Vercel and only builds and publishes. Drift discipline: Renovate opens a pull request in each application repository when a new `@cordaid/dashboard-core` version is published; a CI gate fails the build on stale pins below an agreed minimum; a second CI gate runs TypeScript over the consumed core types so a misnamed `FormConfig` registry key fails the build before deploy. Handover transfers Cordaid ICT as owners of all four repositories and the GitHub Packages namespace.

---

## 4. Authentication & Role-Based Access Control

### 4.1 The five Cordaid project roles

The brief's §4 *Intended Users and Decision Needs* defines five role families. This proposal encodes them directly as a Postgres enum (`senior_management`, `project_manager`, `merl_data_management`, `system_admin_ict`, `external_partner_viewer`) and enforces them at three independent layers: the Auth.js session claim (loaded at login, re-validated against `users.role` on every API call); the server middleware (wraps every `/api/*` route and returns HTTP 403 when the role or scope does not match); and SQL row-level predicates on `submissions_clean` so client-only enforcement is not a security boundary. External viewers carry an additional `scope` JSONB column with their assigned geography, portfolio, or partner attribution, used by the per-request scope guard; out-of-scope rows return 403.

### 4.2 Identity lifecycle and password authentication

- **Password policy.** Minimum 14 characters, NIST-compliant (no scheduled forced rotation; rotated upon evidence of compromise). argon2id with 64 MB memory, 3 iterations, parallelism 1, per OWASP guidance.
- **No multi-factor authentication.** Cordaid's chosen posture for this build is email and password only. TOTP, third-party authenticator apps, and recovery codes are intentionally out of scope, to keep the user path lean and to avoid additional vendor dependencies. The compensating controls are the breach-response workflow at the bottom of this section and the rate-limiting plus breach-list checks documented in §11 R4.
- **Session lifecycle.** `httpOnly`, `Secure`, `SameSite=Lax` cookies; 8-hour sliding session for staff roles; 4-hour sliding for external partners; absolute expiry at 30 days regardless of activity. Sessions are server-side (no JWT-stored permissions), so Cordaid ICT can revoke any session at any time.
- **Provider strategy.** Credentials (email + password) is the primary provider, so Cordaid owns identity end-to-end. OAuth via Google Workspace and Microsoft Entra ID is offered for partner organisations with corporate identity.
- **Audit.** Every authentication event (success, failure, role change, password change, password reset, account lockout) writes a structured row to `audit_log`. See §8.1 for the storage policy.

### 4.3 RBAC matrix: Action × Role

| Action | Senior Mgmt | Project Manager | MERL / Data | System Admin | External Viewer |
|---|---|---|---|---|---|
| View dashboard (aggregates only) | ✔ | ✔ (scoped) | ✔ | ✔ | ✔ (scoped) |
| View filters | ✔ | ✔ (scoped) | ✔ | ✔ | ✔ (scoped) |
| View KPI trend chart | ✔ | ✔ (scoped) | ✔ | ✔ | ✔ (scoped) |
| View disaggregation (gender, age, PWD) | ✔ aggregate only | ✔ | ✔ | ✔ | ✔ aggregate only |
| View record register (rows) | ✘ deny | ✔ (scoped) | ✔ | ✔ | ✘ deny |
| View record detail (drawer) | ✘ deny | ✔ (scoped) | ✔ | ✔ | ✘ deny |
| View personal identifying fields | ✘ deny | conditional (assigned activities) | ✔ | ✔ | ✘ deny |
| Export CSV (aggregates only) | ✔ | ✔ (scoped) | ✔ | ✔ | ✔ aggregate only |
| Export CSV (record register) | ✘ deny | ✔ (scoped, audit-logged) | ✔ (audit-logged) | ✔ (audit-logged) | ✘ deny |
| Trigger manual data refresh | ✘ deny | ✘ deny | conditional (per app) | ✔ | ✘ deny |
| Manage users / roles | ✘ deny | ✘ deny | ✘ deny | ✔ | ✘ deny |
| Manage mappings & indicators | ✘ deny | ✘ deny | ✔ | ✔ | ✘ deny |
| Edit targets / workplan | ✘ deny | ✔ (scoped) | ✔ | ✔ | ✘ deny |
| View audit log | ✘ deny | ✘ deny | ✔ (read-only) | ✔ | ✘ deny |
| View refresh / error logs | ✘ deny | ✘ deny | ✔ | ✔ | ✘ deny |

Three enforcement rules attached to this matrix are non-negotiable:

- **"conditional" rows are a per-request scope guard.** If the user's `scope` JSONB does not intersect the record's geographic, portfolio, or partner attribution, the response is 403.
- **"aggregate only" rows for external viewers are enforced at two layers.** Aggregates that have not cleared the small-cell rule are never returned from the SQL layer, and PII columns are not rendered in the React layer. Both layers must agree.
- **Every CSV export is audit-logged before it leaves the server.** The logged payload records actor user, application, filter snapshot, row count, payload hash, timestamp, and format. The export file itself is held in Cordaid's R2-compatible bucket for 30 days, then expired.

### 4.4 Drill-downs and the map

The AGRIP drill-down pattern (District → Sub-county → Parish → Village) is preserved exactly; options are pre-computed in Neon at sync time, not per request. External viewers see only top-level district aggregates (middleware-enforced). The Leaflet map (district bubble markers) is restricted to Project Manager (geographic-scope only) and MERL; Senior Management sees district-level aggregates via the donut and horizontal-bar charts.

---

## 5. Sync Engine (Kobo → Neon)

### 5.1 GitHub Actions scheduled workflow

Sync is triggered by a **GitHub Actions scheduled workflow** (`.github/workflows/sync.yml`) at a strict 10-minute cadence (`*/10 * * * *`) to meet the brief's 5–15 minute freshness SLA. A single workflow fans out to all three Cordaid applications in parallel; each tenant's Next.js API endpoint validates a tenant-specific GitHub Repo Secret. The runner only signals; the heavy lifting happens inside Neon and the Next.js runtime on Cordaid-controlled infrastructure.

**Cost transparency.** Private repo free tier is 2,000 runner minutes per month. A 10-minute cadence is 4,320 invocations × per-invocation billing each capped under 60 seconds, so the 2,320-minute overage is approximately $19 per month, charged transparently by GitHub. Renegotiated at inception if the cadence is later shortened.

Compared with Vercel Cron, GitHub Actions gives a longer per-job budget, richer matrix and fan-out primitives, and an auditable workflow-as-code artefact in the same repository. Compared with Neon HTTP-cron, it avoids a separate auth surface inside the database tier.

### 5.2 What the sync engine does (one paragraph, deliberately not a flow chart)

The idempotent sync engine authenticates with each tenant's Kobo credentials, paginates `/data/` to `totalCount` with retry-with-backoff, applies the schema-walker hardening against the four documented Kobo shape-drift modes, normalises and de-duplicates each submission, upserts on `_uuid` into the per-tenant `submissions` table, rebuilds per-tenant KPI rows, chart options, district geo-aggregations, and filter options, applies the §8.2 small-cell suppression pass, and writes a structured `refresh_log` row with status, duration, source count, clean count, and any error. If the schema hash matches the last good sync, the engine short-circuits to a fast no-op; exact duration depends on schema-walker complexity and is observed, not asserted.

### 5.3 Manual refresh, rate limiting, and out-of-band triggers

Authorised operators (MERL, System Admin) can trigger a refresh from the Administration module, which posts to the same handler with the user's auth session rather than the cron secret. The action is audit-logged. Rate limits defend against abuse: a maximum of five trigger actions per minute per user, twenty per hour per organisation.

The same handler is reachable from a GitHub `workflow_dispatch` event for break-glass sync by a Cordaid operator on a one-off basis.

### 5.4 Failure modes, observability, and recovery

| Failure mode | Response |
|---|---|
| Single page error during sync | Retry-with-backoff; status `retry` in `refresh_log`; GitHub Actions' configured retry-once. |
| Sustained Kobo unavailability | `app_config.stale_data = true`; dashboard banner; ops alert. |
| Kobo schema drift versus last good | Old aggregate tables retained read-only; `app_config.stale_schema = true`; new submissions skip the drift-affected label until MERL re-approves. |
| Postgres advisory lock conflict | Second invocation returns immediately, logged at `info`. |
| Cron secret leak | Quarterly rotation; never logged; never appearing in client traffic. |
| GitHub Actions overage rises unexpectedly | Cadence tightening rule: lengthen the interval until overage falls under budget; alert Cordaid ICT. |

---

## 6. Indicator Engine & Materialised Aggregates

### 6.1 What is materialised at sync time

The reference implementation's server-side aggregation engine generates, per request, KPIs, ECharts options, filter options, drill-down cascades, and district bubbles. With Neon as the persistent store, every value that engine produces becomes a database row written by the sync engine and read by the application at request time:

| What the engine produces today | Where it lives after the migration |
|---|---|
| KPI tile values | `agg_kpis` rows, indexed by `(app_id, filter_hash)`. |
| Chart options (line, bar, donut, age-bar) | `agg_charts` rows, indexed by `(app_id, chart_key)`. |
| District map bubbles | `agg_districts` rows. |
| Filter option lists (select filters) | `agg_filters` rows. |
| Drill-down cascade options | Same `agg_filters` table, keyed by drill-level. |
| Date bounds | `app_config` row keyed `date_bounds`. |

A request for a known filter combination is one indexed SELECT against a pre-computed aggregate row. A novel filter combination is computed once during a sync pass, stored under its filter hash, and served by indexed SELECT from then on. The first computation can take seconds on AGRIP-class data; subsequent requests hit the cache. This proposal commits to architecture and indexing discipline rather than to a specific cold-aggregation latency.

### 6.2 Indicator definitions

Indicators are SQL expressions owned by MERL, stored in a per-tenant `indicators` table with `numerator_fn`, `denominator_fn`, disaggregation list, owner role, and version. The sync pass materialises them into `agg_indicator_values`. SQL expressions are validated at insertion by a parser deny-list that rejects unknown operators, network calls, time-delay constructs, and privileged extensions. Indicator definitions are versioned; any change requires MERL acknowledgement and writes a row to `audit_log`.

### 6.3 Filter hashing

`filter_hash` is a stable short hash of the canonical-JSON of the active filter set. Two filter sets with identical semantics hash identically. The top-N most-recently-used filter combinations plus any administrator-pinned combinations are pre-computed on every sync, so the vast majority of user requests hit a cached row.

---

## 7. Performance Approach

The brief's §4 floor is *"common pages should normally load within about five seconds and cached filters should respond promptly"*. This proposal commits to the 5-second ceiling as the only compliance number, with §3.1 explaining the architectural direction (no on-request KoboToolbox roundtrip; aggregates pre-built in Neon). No commitment is made to millisecond figures below the ceiling. Load times are measured at Day-13 UAT against the device, connection, and data-volume baseline agreed at Day-1 inception (see §7.4), and revisited during the 30-day warranty and the Phase-2 performance programme.

### 7.1 What the architecture optimises for

| Architecture lever | What it actually buys |
|---|---|
| Server-side aggregation instead of in-browser | Avoids browser-memory exhaustion at 61k+ rows; stabilises the application as data grows. |
| Pre-materialised KPIs, chart options, filter options per `filter_hash` | New filter combinations cost CPU once during sync and are served from a single indexed SELECT thereafter. |
| Edge-cache on the static shell and on filter-hash-keyed payloads | Reduces Vercel egress and shortens the request path on subsequent visits. |
| Schema-walker idempotency on sync | A no-op short-circuits the rebuild when nothing has changed; repeated ticks do not compound work. |
| ECharts and Leaflet dynamic-imported with per-tenant bundle split | The SSR bundle stays small; the map only ships when the map view is rendered. |

Each lever has a deliberate cost: pre-materialised aggregates grow storage per distinct `filter_hash` and introduce a sync-to-query staleness window; edge-cache hits reduce egress at the cost of up-to-60-second staleness (consistent with the brief's 5–15 minute cadence and the *visible timestamp* / *stale-data warning* requirements).

### 7.2 Per-application profile

Cordaid Feedback (sub-1k expected) and WeWork (small/medium) will easily clear the brief's 5-second ceiling. AGRIP (currently 61k+ and growing) relies on pre-materialisation, the circle-marker map, and the SQL row-level scope guard and requires iterative performance engineering as data scales.

### 7.3 Scaling readiness

Not in scope for the 15-day build, but the architecture supports denormalised aggregate tables, time-window partial aggregations, read replicas, materialised views, register pagination, and filter-hash pre-warming. These can be added without changing the RBAC, audit, or security guarantees, and they form the basis of a Phase-2 performance programme.

### 7.4 Acceptance criteria

The performance smoke at Day 13 (D4 in §9) measures compliance with the brief's 5-second ceiling on the agreed device, connection, and data-volume baseline. The baseline is documented at Day-1 inception; the smoke runs against a Cordaid-curated synthetic-fixture dataset with record counts representative of current production (Cordaid Feedback sub-1k, WeWork medium, AGRIP 60k+). Cache hits are documented separately because they are governed by the visible-timestamp and stale-data-warning requirements in the brief. If the ceiling is missed on the agreed baseline, it is treated as a defect under the warranty; if the ceiling is missed because the baseline changes (a dataset grows, a different device class is in use), it is treated as a Phase-2 performance programme item, not as a delivery shortfall.

---

## 8. Security & Privacy by Design

### 8.1 Mapping to the brief's *Security* and *Privacy* clauses

| Brief requirement | How this proposal satisfies it |
|---|---|
| HTTPS | Vercel TLS termination; HSTS preload; max-age 1 year. |
| Protected server-side secrets | Vercel env, never exposed via `NEXT_PUBLIC_*`; Kobo tokens rotated quarterly; password hashes argon2id with per-user salt (one-way, no encryptable plaintext at rest); GitHub Repo Secrets for the sync workflow webhook. |
| Least privilege | Per-tenant Postgres roles; per-tenant webhook secret; per-section middleware on `/api/*`. |
| Secure sessions | Auth.js v5 server-side sessions; `httpOnly`, `Secure`, `SameSite=Lax` cookies; sliding 8 h / absolute 30 d. |
| Validation + dependency review | Zod schemas at every API boundary; weekly dependency-review scan; `pnpm audit` in CI. |
| Protected logs | Structured `audit_log` and `refresh_log` with PII redaction by default; secrets never logged; CI log scrubber. |
| **Audit and refresh log storage** | **`audit_log` and `refresh_log` are Postgres tables inside a Neon-hosted `public` schema. They are not exported to Vercel, not piped to external logging services (such as Datadog or Axiom), and not stored on a consultant-controlled filesystem. Cordaid ICT owns these tables along with the rest of the database.** |
| Aggregate-by-default design | Frontend page-level aggregation; small-cell rule at SQL layer; PII columns absent from external-table queries. |
| Data minimisation | Per-tenant FormConfig declares only what is needed; aggregate materialiser omits columns not in any spec. |
| Restricted record access | RBAC middleware on every record-register query, plus SQL-row predicates. |
| Safe small-cell / geographic handling | Small-cell rule with per-tenant configurable floor (default 5); suppression bucket records the suppression count for honest reporting. |
| Approved retention and secure deletion | Tenant-defined retention; automated deletion sweeper runs hourly; deletion events audit-logged. |
| WCAG 2.2 Level AA | axe-core CI gate, keyboard parity, focus-visible styles throughout the reference UI. |
| Backups | Neon point-in-time recovery (7 days on Launch); weekly logical backup to Cordaid-controlled R2-compatible bucket. |
| Recovery test | One restoration drill before handover; documented runbook; second drill during warranty. |
| No critical/high security finding | OWASP ZAP baseline scan per release; Semgrep static analysis in CI; gitleaks secrets scan in CI. |

### 8.2 Small-cell suppression (privacy by construction)

No aggregate cell with fewer than `MIN_CELL_COUNT` (configurable per tenant and per indicator, default 5) is written to `agg_*` or returned to any client. Cells under threshold are written to a per-tenant `agg_suppressed` table with a count of the suppression, so the dashboard can honestly show "data suppressed" rather than silently zero. External-viewer requests honour the same rule. MERL can override suppression per indicator with audit-logged acknowledgement; the default floor is 5.

### 8.3 Out of scope (with explanation)

- **Cordaid-internal DNS, email service, and HRIS.** Out of scope. A `POST /api/users/sync-from-hr` webhook is exposed for Cordaid ICT to wire to a nightly HRIS event; the integrator is Cordaid's responsibility.
- **Network-level isolation VPC peering.** Neon supports PrivateLink and AWS Private Networking. Recommended at handover once traffic justifies the cost; not required for the initial 15-day cutover.
- **Cross-tenant exports outside the brief's RBAC.** Out of scope. MERL can read across the four schemas via the `app_reader` role for analytical queries, but anonymised bulk exports require written approval.

---

## 9. Deliverables, Acceptance & The 15-Day Plan

### 9.1 The six deliverables explicitly required by the brief

| # | Deliverable | Due | What this proposal commits as acceptance |
|---|---|---|---|
| D1 | Inception report and approved delivery baseline | Day 3 | Users, sources, indicators, workplan fields, risks, architecture, data access, and test approach signed off. |
| D2 | Data model, mappings, access matrix, and wireframes | Day 6 | This proposal as architectural appendix; access matrix in §4.3; per-tenant FormConfigs; wireframes (low-fidelity, sign-off with programme). |
| D3 | Integrated beta platform in staging | Day 10 | Three applications behind a single auth and a single sync path; all filters / charts / maps / records / exports functional; staging environment accessible to MERL. |
| D4 | User-acceptance release and test report | Day 13 | KPI reconciliation against Cordaid's reference calculations; one smoke test per RBAC matrix cell; performance smoke against the brief's 5-second ceiling on the agreed baseline (see §7.4); WCAG axe-core pass. |
| D5 | Production deployment, training, complete handover | Day 15 | Three production subdomains live; credentials rotated to Cordaid-controlled accounts; training recorded; documentation delivered; restoration drill complete. |
| D6 | Warranty log and closure report | Day 45 | All critical / high defects resolved or formally carried; change log maintained; known limitations listed; recommendations for next phase. |

Each acceptance is testable. There is no "approved" without evidence.

### 9.2 30-day warranty: what it covers, what it does not

Per the brief §12 *Warranty and Change Control*: the warranty covers non-conformity with approved requirements under agreed operating conditions. Defects are recorded by severity, impact, cause, action, and release; changes are tested in staging before approval. New indicators, integrations, source changes, or features are enhancements, not warranty items, and require documented impact assessment and written approval. Post-warranty support is priced separately at the applicant's option.

A weekly status report is proposed during the warranty period to keep Cordaid informed without requiring meetings.

---

## 10. Cost Model & Commercials

Cost transparency is a brief §13 evaluation criterion. All figures are **indicative as of the proposal date** and would be re-quoted with current vendor pricing at contract signature. Hosting, domains, and licences are absorbed by Cordaid-controlled accounts per the brief §11 *Confidentiality, Data Protection and Intellectual Property* requirement that Cordaid owns the operational footprint. **No domains, hosting licences, or infrastructure services are purchased, owned, or resold by the consultant.**

| Service | Quantity | Subscription fee (USD/month, indicative) | Notes |
|---|---|---|---|
| **Neon Postgres (Launch plan)** | 1 database | ~$19 | Consolidates all four schemas. Included autoscaling compute and storage comfortably exceed the requirement for ~80 k rows, pre-computed aggregates, and the audit/refresh log tables. 7-day point-in-time recovery included; preview and staging via branching. |
| **Vercel Pro account (three projects)** | 3 Vercel projects | ~$20 (per seat) + included usage | One Vercel Pro account hosts three projects (one per Cordaid application). Each project has its own production domain (`cordaid.client.org`, `wework.client.org`, `agrip.client.org`), its own deployment pipeline, and its own env-var scope. All three import the same published `@cordaid/dashboard-core` package from a Cordaid-owned shared core repository that publishes to a private GitHub Packages namespace, so the projects stay in lock-step at the code-pattern level without sharing a runtime. On the brief's expected traffic, the Pro plan's shared bandwidth and function-execution budgets comfortably cover all three. |
| **GitHub Actions overage** | ~2,320 minutes | ~$19 | Above the 2,000-minute free allowance for private repos, derived from a 10-minute cadence (4,320 invocations × per-invocation billing) and capped by short workflow runtime. Renegotiated at inception if the cadence moves. |
| **GitHub Packages (private npm registry)** | 1 namespace | $0 | Hosts `@cordaid/dashboard-core` privately inside the Cordaid-owned GitHub organisation so proprietary shared logic is not exposed to public npm. Authenticates in CI via `GITHUB_TOKEN`. Aligns with brief §11 (Cordaid-controlled accounts) and is listed for brief §13 third-party services disclosure. |
| **Object storage (CSV export payloads)** | ~10 GB/mo | ~$3 | R2-compatible bucket held in Cordaid-controlled account, 30-day TTL. |
| **Backup target (R2-compatible)** | ~20 GB/week | ~$5 | Holds weekly Postgres logical backups for 30 days, cross-region optional. |
| **Auth.js v5 identity provider** | self-hosted | $0 | Open-source, embedded in the Next.js runtime. |
| **Google OAuth (Auth.js v5 identity provider)** | 1 OAuth app per application | $0 | Free Google Cloud Console OAuth-app registration; Auth.js v5 handles the token exchange. No subscription. |
| **Microsoft Entra ID (Auth.js v5 identity provider)** | 1 Entra ID app per application | $0 | Free Microsoft Entra ID app registration; Auth.js v5 handles the token exchange. No subscription. |
| **HIBP k-anonymity API (or Cordaid-held offline breach file)** | 1 (optional) | $0 | Default per §11 R4 is a Cordaid-held offline breach file. The HIBP public k-anonymity API is a free opt-in alternative. |
| **Open-source security tooling (CI release gate)** | per release | $0 | OWASP ZAP baseline scan, Semgrep static analysis, gitleaks secrets scan, axe-core WCAG gate. All free OSS, run inside CI. |
| **KoboToolbox data source** | 3 assets (Cordaid-owned, one per application) | $0 | Cordaid owns the assets; data is fetched via authenticated API tokens at no per-call subscription cost. |
| **Domain and DNS** | root + three subdomains | $0 (see note) | Cordaid already owns the root domain and will point DNS at the Vercel deployment. Subdomains are free of registry charge. For reference: a normally priced new `.org` registration currently runs **$10–$20 per year** at typical registrars, with renewals in the same range. This proposal does not include any domain purchase. |

**Total indicative recurring operational cost: ~$66 per month** for the fully integrated three-application footprint, plus any existing Cordaid domain renewal (outside this proposal).

One-time costs (design, build, handover, training, 30-day warranty) are priced separately per the brief's deliverable- and acceptance-based payment schedule.

**Third-party processors considered in this proposal:** Vercel (hosting and edge cache), Neon Postgres (database), Auth.js pg-adapter (open-source, no separate processor), R2-compatible object-storage provider, Google OAuth, Microsoft OAuth, GitHub Actions (CI/CD and scheduled triggers). No closed-source library processes Cordaid project data on behalf of the consultant. All third-party services, processors, and recurring costs are listed above for the brief's §13 *disclose every third-party service before approval* requirement.

### 10.1 Budget and payment schedule

The total contract value for the design, build, handover, training, and 30-day warranty phase is **5,190,000 UGX (Ugandan Shilling), excluding VAT**. This figure covers one-time engineering services only and is independent of the recurring operational cost above (which Cordaid pays directly to the listed third-party providers on Cordaid-controlled accounts).

The schedule is structured as four discrete milestones, each tied to a specific acceptance gate in §9.1. The first three milestones fall inside the 15-day build window per §2.3; the fourth and final payment is triggered at the close of Day 30 (the 15-day mark of the 30-day warranty period).

| # | Day | Description and tied acceptance gate | Amount (UGX) | Cumulative to date (UGX) |
|---|---|---|---|---|
| M1 | Day 0 | Contract signature + Inception deposit. Acceptance: contract countersigned and Day-1 inception kickoff confirmed. | 1,237,500 | 1,237,500 |
| M2 | Day 10 | D3 *Integrated beta platform in staging* per §9.1. Three applications behind a single auth and a single sync path; all filters, charts, maps, record views, and exports functional; staging accessible to MERL. | 1,287,500 | 2,525,000 |
| M3 | Day 15 | D5 *Production deployment, training, complete handover* per §9.1. Three production subdomains live; credentials rotated to Cordaid-controlled accounts; training recorded; documentation delivered; restoration drill complete. | 1,327,500 | 3,852,500 |
| M4 | Day 30 | D6 interim *Warranty first-half release*. All critical and high defects resolved or formally carried; operations transfer confirmed; renewal cadence and Day-45 closure-paperwork obligations agreed. | 1,337,500 | 5,190,000 |
| **Total** | | | **5,190,000** | |

**Currency and VAT.** All milestone amounts are denominated in UGX and stated exclusive of VAT. Where Uganda tax law requires VAT to be charged on a particular milestone invoice, it is invoiced separately at the prevailing rate and settled by Cordaid within the same payment terms. The 5,190,000 UGX total is the engineering contract value and does not include VAT.

**Payment terms.**

- *Invoice.* The consultant raises each milestone invoice within three working days of Cordaid ICT acceptance of the tied gate in §9.1.
- *Due date.* Net 7 from invoice date.
- *Settlement method.* Bank transfer to a Cordaid-controlled nominated account specified by the consultant at contract signature and held in confidence per the brief §11 (no public disclosure of payment routing is made in this proposal).
- *Late payment.* A 7-day grace window is granted after the due date. Beyond the grace window, a simple 1.5% per-month accrual applies to the overdue amount. If a milestone is unpaid more than 21 days past the due date, work on the next milestone pauses until cleared. The 30-day warranty clock continues to run on Cordaid's side during any pause, so the warranty period is not extended by the consultant's pause.
- *Currency.* UGX only.

This schedule is consistent with §2.3 (*How the 15-day engagement is structured to honour Cordaid constraints*) and §9.1 (*The six deliverables explicitly required by the brief*).

---

## 11. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Kobo schema drift in production breaks sync silently | Medium | High | Retain old aggregates read-only on drift; require MERL manual approval before re-applying schema. |
| R2 | Neon → Vercel egress costs exceed budget at scale | Low | Medium | Edge-cache for 60 s and cluster aggregations by filter_hash to avoid duplicate egress. |
| R3 | GitHub Actions double-tick overlap | Low | Medium | Postgres advisory lock short-circuits the secondary concurrent tick. |
| R4 | Credential-stuffing or leaked-password attack on email/password sign-in | Low | Medium | Argon2id hash throttling, exponential IP backoff after 5 failed attempts, and HIBP k-anonymity registration check (or a Cordaid-held offline breach file if Cordaid prefers no external call). |
| R5 | Three Vercel projects drift apart despite the shared core package | Medium | High | Renovate auto-opens PRs on new `@cordaid/dashboard-core` releases; CI fails build on stale pins and on TypeScript registry-key mismatch. |
| R6 | External viewer inadvertently gets record-level access | Low | High | SQL row-level filtering plus middleware-enforced block on external record-route URLs. |
| R7 | Password reset flow abused as a credential-stuffing or phishing vector | Medium | Medium | HMAC single-use 15-minute reset links; same per-IP backoff; tamper-evident admin-reset audit entry. |
| R8 | HRIS integration slips warranty | Medium | Low | Defer HRIS webhooks to post-warranty; manual CSV provisioning for the MVP. |
| R9 | Indicator definitions unstable across the 15 days | Medium | High | Freeze the indicator manifest contract by Day 6; written MERL approval required for any change. |
| R10 | Indicator SQL expressions pose injection risk | Low | High | Strict SQL parser deny-list blocks `pg_sleep`, network calls, and privileged extensions. |
| R11 | GitHub Actions overage budget over-runs | Low | Medium | Cadence tightening rule per §5.4; transparently renegotiate with Cordaid ICT if cadence is shortened below 10 minutes. |

---

## 13. Open Questions for the Next Round

The following items are pre-decided in this proposal and benefit from explicit Cordaid sign-off before contract signature. Each is stated with its proposed default:

1. **Subdomain scheme.** Default: three subdomains (`cordaid.client.org`, `wework.client.org`, `agrip.client.org`).
2. **HRIS integration timing.** Default: MVP-first (manual provisioning + CSV import; HRIS webhook deferred to post-warranty).
3. **SSO providers.** Default: Google + Microsoft.
4. **Password policy.** Default: NIST-aligned per §4.2.
5. **External partners.** Default: Cordaid supplies scope-mapping list at handover.
6. **Indicator definitions sign-off date.** Required by Day 6 to freeze the indicator manifest.
7. **Targets and workplan sign-off date.** Required by Day 6.
8. **Retention periods.** Default: clean 36 months, audit 5 years, refresh_log 90 days.
9. **Small-cell floor.** Default: 5.
10. **Custom domain / DNS responsibility.** Default: Cordaid ICT.
11. **MERL + ICT contact persons.** Default: assigned by Day 1.
12. **GitHub organisation readiness.** Default: Cordaid-owned, ready by Day 1 (four private repositories plus a GitHub Packages namespace).

A single Q&A session is proposed to lock these items before contract signature.

---

## 14. Sign-off

This proposal is the consultant's recommendation as of the date above. Upon Cordaid sign-off, the engagement proceeds to Day 1 (Inception) and the open questions in §13 are locked. Any change to the RBAC matrix (§4.3), the sync cadence (§5.1), or the retention model (§8.3) after sign-off is treated as a change order per the brief's §12 *Warranty and Change Control*.

The MERL Manager and the technical review panel are welcome to review this proposal at their convenience; the consultant is available for clarification at the contacts in §13.

**Josh Eleazar**, Lead Engineer
