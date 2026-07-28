
# CORDAID UGANDA

## CONCEPT NOTE

### Development of a Secure Web-Based Project Performance Monitoring Dashboard

### Integrated with KoboToolbox

*Including Terms of Reference for design, development, deployment, training, handover and warranty support*

| | |
|---|---|
| **Project** | Project 201576 - Strong Young People, Strong Companies. |
| **Commissioning organization** | Cordaid Uganda, responsible for contracting, oversight and acceptance. |
| **Duty station/coverage** | Kampala, with remote development and scheduled consultations, testing, training and handover. |
| **Indicative assignment period** | 15 working days over three weeks, followed by 30 calendar days of defect correction and stabilization. |
| **Document status** | Condensed revised draft for internal approval and procurement planning. |

**28 July 2026**

---

# PART I: CONDENSED CONCEPT NOTE

## 1. Executive Summary

Cordaid Uganda proposes a secure, responsive web dashboard that connects approved KoboToolbox data with the project's results framework, targets, reporting calendar and workplan. The platform will automate data refresh and approved indicator calculations, compare plans with actual performance, flag data-quality concerns and provide role-based analysis by period, location, implementing unit and approved inclusion variables. Aggregate information will be the default; record-level access and exports will be restricted by role.

The minimum viable product will be delivered in 15 working days and followed by a 30-calendar-day warranty. Handover will include the production platform, validated calculations, source code, secure deployment, training, documentation, test evidence and a maintainable change-control arrangement.

## 2. Background and Rationale

The Strong Young People, Strong Companies project uses KoboToolbox and complementary management tools, but repeated exports and spreadsheet consolidation delay analysis, create competing versions and make indicator calculations harder to trace. The proposed platform will convert approved sources into one decision-ready view without replacing KoboToolbox as the authoritative field-data source. The functional reference identified in the original draft may inform interaction patterns only; Cordaid requirements, branding, privacy controls and compatible licensing will govern the solution.

- **Timeliness:** shorten the interval between field submission, verification and management action.
- **Consistency:** apply one approved indicator and disaggregation logic across reports.
- **Accountability:** compare activities and targets with actual progress and responsible units.
- **Quality and inclusion:** expose data gaps and approved gender, age and disability patterns safely.
- **Efficiency and ownership:** reduce manual consolidation and retain documented configurations and procedures.

## 3. Purpose and Objectives

**Purpose:** To provide the strategic and technical basis for procuring and institutionalising a secure project performance dashboard.

**Overall objective:** To design, deploy and hand over a secure, user-friendly and maintainable web platform for near-real-time monitoring of activities, results, data quality and progress against plans.

**The four specific objectives are to:**

1. Automate secure extraction, validation, transformation, refresh and reconciliation of approved data.
2. Provide interactive views of activities, outputs, indicators, targets, trends and disaggregated performance.
3. Strengthen action through quality flags, variance and overdue alerts, controlled drill-downs and audit information.
4. Secure ownership through training, documentation, source-code handover and maintainable support arrangements.

## 4. Intended Users and Decision Needs

Final roles will be confirmed at inception and applied on a least-privilege basis.

| User group | Primary management need | Indicative access profile |
|---|---|---|
| Senior management and project leadership | Reviews overall achievement, trends, delayed activities, major variances and decisions requiring escalation. | Receives read-only aggregate dashboards, approved reports and non-sensitive exports. |
| Project managers and implementation teams | Tracks workplan delivery, milestones, partner or location performance, participant reach and overdue follow-up. | Uses operational views and approved drill-downs, with exports limited to assigned responsibilities. |
| MERL / data-management personnel | Validates indicator calculations, reconciles source records and investigates disaggregation or data-quality exceptions. | Uses detailed analytical and quality views, including controlled record-level access. |
| System administrator / ICT focal person | Administers users and configurations and reviews source health, refresh logs, backups and technical errors. | Uses administrative functions under full audit logging and periodic access review. |
| Approved partners or external viewers | Reviews performance limited to an assigned geography, portfolio or approved non-sensitive information. | Receives scope-limited, read-only access with no unrestricted record export. |

## 5. Platform Scope and Architecture

### 5.1 Design and data principles

KoboToolbox will remain authoritative for field submissions; approved documents or controlled configurations will govern targets, workplans and indicator definitions. The platform will be aggregate by default, configurable where practical, traceable from source to result, accessible on common devices and lower-bandwidth connections, and hosted in accounts controlled by Cordaid.

### 5.2 Approved data sources

| Data source | Information supplied to the platform | Required control |
|---|---|---|
| KoboToolbox forms and submissions | Supplies routine activity, participant, service-delivery and monitoring records. | Connect through an authenticated server-side API and maintain versioned field and form mappings. |
| Results framework and indicator reference sheets | Defines each indicator, numerator, denominator, disaggregation, reporting frequency and accountable owner. | Use the formally approved baseline; revise calculations only through documented validation. |
| Targets, reporting calendar and structured workplan | Supplies periodic targets, planned activities, milestones, dates, locations and responsible units. | Load through a controlled import or authorised configuration with version history. |
| Approved geographic boundaries | Supports authorised district, subcounty or other aggregate geographic analysis. | Do not display sensitive participant coordinates or unsafe small geographic groups by default. |
| User and access register | Defines users, roles, assigned scope and approval status. | Apply least privilege, periodic review, audit logging and prompt account deactivation. |

### 5.3 Core functional modules

| Module | Descriptive minimum functionality |
|---|---|
| Executive overview | Shows the selected period, source status, last refresh, headline indicators, target achievement, trends, reporting completeness and delayed or at-risk items. |
| Results and indicator monitoring | Compares actuals with targets, variances and trends and displays the approved definition, numerator, denominator, source and relevant filters. |
| Activity and milestone monitoring | Tracks planned and actual dates, responsible unit, location, completion status, expected deliverable, actual progress, overdue flag and explanatory note. |
| Participation and inclusion analysis | Reports unique and total reach by approved gender, age, disability, geography and service categories while applying duplicate and small-cell safeguards. |
| Data-quality management | Flags missing values, duplicate risks, invalid ranges, inconsistent responses, late submissions and outliers and identifies affected records for authorised follow-up. |
| Record register and drill-down | Provides searchable, sortable and paginated records with role-controlled fields; corrections remain in the authoritative source unless separately approved. |
| Reports and controlled export | Produces filtered reports and CSV, Excel or print-ready outputs while excluding restricted fields and recording authorised exports. |
| Administration and system health | Supports approved user and configuration management and displays refresh status, errors, audit logs, backup status, system version and support information. |

### 5.4 Solution architecture

> **Critical security rule:** API tokens, database credentials and other secrets must remain in an approved server-side secrets mechanism and never appear in browser code, public repositories or logs.

| Architecture layer | Required role in the solution | Primary control |
|---|---|---|
| KoboToolbox and approved source files | Retains authoritative submissions, metadata, targets and structured workplan information. | Use read-only, least-privilege access wherever technically feasible. |
| Server-side integration service | Authenticates, paginates and incrementally synchronises data, including repeats, retries and schema-change detection. | Protect secrets, encrypt transport and record safe refresh and error logs. |
| Transformation and indicator engine | Cleans, recodes and de-duplicates records and applies approved target alignment, calculations and disaggregation. | Version calculation rules, test them and preserve source-to-result traceability. |
| Protected data store or cache | Holds only the processed data required for responsive analysis and reduced source-system calls. | Apply minimisation, retention, access, encryption, backup and restoration controls. |
| Application service and HTML interface | Delivers secure APIs, indicators, charts, maps, filters, record views, exports and administration. | Enforce role-based access, input validation, safe output encoding and accessibility. |
| Hosting, monitoring and recovery | Provides HTTPS deployment, domain, health monitoring, backup, restoration and incident response. | Operate through Cordaid-controlled accounts with documented and tested recovery. |

## 6. Governance, Delivery and Sustainability

The solution must apply privacy by design, strong authentication, role-based access, secure sessions, appropriate encryption, protected logs and tested backup and recovery. KPI totals must reconcile with approved reference calculations. Development should use synthetic or authorised protected data, close all critical and high security findings before go-live, and test the interface towards WCAG 2.2 Level AA.

- **Inception:** confirm users, sources, indicators, workplan fields, risks and acceptance tests.
- **Design and build:** approve mappings and wireframes, then configure integration, calculations and modules.
- **Verification and handover:** test accuracy, access, security, performance and usability; train users and transfer all assets.
- **Warranty:** stabilise refreshes, correct delivered-solution defects and submit a 30-day closure report.

Hosting, domain, repository and administrative accounts will be Cordaid-controlled. Cordaid will own the agreed custom code, configurations, data models, designs and documentation, subject to approved third-party licences. Routine settings should be administrator-configurable; structural changes will follow documented approval, testing and release control.

## 7. Benefits, Risks and Procurement Readiness

### 7.1 Expected benefits

| Expected result | How it improves project management |
|---|---|
| Automated, controlled information flow | Reduces repeated downloading, merging and preparation of routine monitoring data. |
| Timely performance visibility | Enables earlier action on delayed activities, implementation gaps and underperforming locations. |
| Consistent indicator calculations | Applies one approved and traceable definition across dashboards and reporting products. |
| Improved data quality | Identifies incomplete, duplicate, inconsistent, late or unusual records before formal reporting. |
| Safer inclusion monitoring | Makes approved gender, age, disability and participant analysis routine without unnecessary disclosure. |
| Stronger accountability and adaptation | Shows actual performance against workplans, targets and reporting commitments for management follow-up. |
| Sustainable internal capability | Enables Cordaid staff to administer users, monitor refreshes, update approved settings and commission enhancements. |

### 7.2 Key risks and mitigation

| Risk or assumption | Likely consequence | Required management response |
|---|---|---|
| Source data are incomplete or inconsistent. | Dashboard totals may be inaccurate or delayed, reducing user confidence. | Profile data early, approve cleaning rules, report exceptions and reconcile source records with displayed results. |
| Indicator definitions or targets are not final. | Calculation disputes and rework may delay acceptance. | Approve the indicator and target baseline before build and manage later changes formally. |
| KoboToolbox forms or fields change. | Mappings may fail or omit records after deployment. | Use versioned mappings, schema checks and alerts, and require approval before source-form changes. |
| Scope expands during the short assignment. | Delivery, testing and handover quality may weaken. | Protect a prioritised minimum viable scope and place enhancements in a separately approved backlog. |
| Credentials or personal data are exposed. | The project may face security, legal and reputational harm. | Use server-side secrets, least privilege, privacy review, security testing and restricted exports. |
| Internal uptake and ownership remain limited. | Use may decline and dependence on the consultant may continue. | Apply co-design, role-based training, administrator practice, full documentation and asset handover. |
| Hosting or recurring costs are unclear. | Deployment may be delayed or operating costs may become unsustainable. | Approve Cordaid-owned hosting, licences, domain, support model and recurrent costs during inception. |

---

# PART II: TERMS OF REFERENCE

## 1. Assignment Summary

| | |
|---|---|
| **Assignment title** | Consultancy to design, develop, deploy and hand over a secure KoboToolbox-integrated project performance dashboard. |
| **Commissioning organization** | Cordaid Uganda MERL Manager, which will provide oversight, technical validation and formal acceptance. |
| **Project** | Project 201576 - Strong Young People, Strong Companies. |
| **Duration** | 45-calendar-day warranty from production go-live. |

## 2. Background and Objectives

Cordaid requires a secure, maintainable dashboard that combines authorised KoboToolbox submissions with approved indicators, targets, reporting periods and workplans. The consultant will replace repetitive manual consolidation with a protected server-side integration and role-based browser interface, while keeping KoboToolbox authoritative for field records and transferring the complete solution to Cordaid.

**Overall objective:** To design, deploy and hand over a secure and maintainable web platform for near-real-time monitoring of activities, results, data quality and performance against approved plans.

**The four specific objectives are to:**

1. Automate secure extraction, transformation, validation, refresh and reconciliation of approved data.
2. Provide interactive, disaggregated views of activities, indicators, targets, trends and locations.
3. Support management action through data-quality, variance and overdue flags and controlled drill-downs.
4. Secure ownership through training, documentation, source-code transfer and maintainable support arrangements.

## 3. Scope of Work

### 3.1 Inception, data and design

- Review approved frameworks, forms, sample data, workplans, reports, user roles, branding and hosting constraints; confirm the minimum scope, risks, access plan and acceptance tests.
- Profile data and produce the requirements traceability matrix, data dictionary, logical model, quality rules, indicator mapping, access matrix and responsive wireframes for written approval.

### 3.2 Integration and dashboard development

- Build secure server-side connections with pagination, incremental refresh, repeat-data handling, retries, logging and source-schema change detection.
- Implement approved transformations, duplicate controls, indicator calculations, targets and workplan comparisons, using a protected store or cache where required.
- Deliver the executive, indicator, activity, inclusion, data-quality, record, reporting and administration modules with consistent filters and role-controlled access and exports.

### 3.3 Quality assurance, deployment and warranty

- Execute calculation, reconciliation, permission, security, performance, accessibility, browser and device tests in staging and close all go-live blockers.
- Deploy through Cordaid-controlled HTTPS infrastructure; train users and administrators; transfer code, configurations, credentials, documentation, test evidence and the maintenance plan.
- Provide 30 calendar days of defect correction and stabilisation and submit a support log and closure report.

## 4. Technical and Non-Functional Requirements

The consultant shall meet the following standards and provide evidence through the requirements traceability matrix, demonstrations and test reports.

| Requirement area | Descriptive minimum standard and acceptance evidence |
|---|---|
| Architecture | Use modular server-side integration and application services, with browser presentation separated from credentials, calculation logic and configuration. |
| Accuracy | Ensure every approved priority KPI test case matches Cordaid's reference calculation, except for documented and formally accepted source-data exceptions. |
| Refresh | Provide a configurable 5-15 minute normal refresh interval, visible timestamp and source status, safe retry, authorised manual refresh and stale-data warning. |
| Performance | Under the agreed device, connection and data-volume baseline, common pages should normally load within about five seconds and cached filters should respond promptly. |
| Availability and recovery | Provide health and error notification, documented backup and retention schedules, restoration instructions and at least one successful restoration test before handover. |
| Security | Use HTTPS, protected server-side secrets, least privilege, secure sessions, validation, dependency review and protected logs; no critical or high finding may remain at go-live. |
| Privacy | Apply aggregate-by-default design, data minimisation, restricted record access, safe small-cell and geographic handling, approved retention and secure deletion. |
| Accessibility | Test towards WCAG 2.2 Level AA, including keyboard use, visible focus, labelled controls, sufficient contrast and status cues that do not rely on colour alone. |
| Compatibility | Support current Chrome, Edge and Firefox versions and responsive desktop, tablet and mobile layouts that remain practical on lower-bandwidth connections. |
| Maintainability | Provide modular, readable and version-controlled code, repeatable tests, an environment template without secrets, dependency and licence inventory, and deployment instructions. |
| Observability | Record structured refresh, configuration and error information sufficient for troubleshooting without capturing credentials or unnecessary personal data. |
| Ownership and licensing | Use Cordaid-controlled hosting and repositories, transfer all custom work and disclose every third-party service, component, processor, cost and licence before approval. |

## 5. Methodology and Working Arrangements

Use a user-centred, iterative and time-boxed method with a start-up meeting, at least two build demonstrations, user acceptance, role-based training and final handover. Maintain the requirements traceability matrix, risk and issue log, decision record, progress updates and defect log. Use staging and synthetic or authorised protected data; do not introduce paid services, processors or architectural changes without written approval.

## 6. Deliverables, Timing and Acceptance

Due periods are working days from contract commencement; payment will follow formal acceptance.

| # | Deliverable | Due | Descriptive minimum acceptance criteria |
|---|---|---|---|
| 1 | Inception report and approved delivery baseline | Day 3 | Confirms scope, users, sources, requirements, workplan, risks, architecture, data access and test approach, with decision owners identified. |
| 2 | Data model, mappings, access matrix and wireframes | Day 6 | Maps priority indicators and activities; completes the dictionary and quality rules; and obtains approval of roles, navigation and core user journeys. |
| 3 | Integrated beta platform in staging | Day 10 | Demonstrates authenticated KoboToolbox integration, scheduled refresh, core modules, filters, workplan views, data-quality flags and the initial role model. |
| 4 | User-acceptance release and test report | Day 13 | Reconciles KPI and record counts, executes agreed functional and non-functional tests, documents exceptions and closes all blocking defects. |
| 5 | Production deployment, training and complete handover | Day 15 | Secures go-live approval; trains users and administrators; and transfers code, configuration, manuals, evidence, backup and recovery proof, credentials and maintenance plan. |
| 6 | Warranty log and closure report | 30 calendar days after go-live | Resolves delivered-solution defects or records agreed treatment and provides the final change log, known limitations, system status and maintenance recommendations. |

## 7. Acceptance and Management Arrangements

The consultant will report to the designated Cordaid Project Manager, with technical review by MERL/data-management and ICT focal persons. Acceptance requires reconciled priority calculations, tested permissions, no unresolved go-live blocker or critical/high security finding, operational production and recovery arrangements, complete Cordaid-held administrative access and written user-acceptance and go-live approval. Material security, data or delivery risks must be escalated immediately.

## 8. Inputs and Responsibilities of Cordaid

- Provide approved indicators, targets, reporting calendar, workplan, branding and user-role decisions.
- Provide authorised forms, scoped API access and representative synthetic, anonymised or protected data.
- Approve boundaries, hosting, domain, repository, identity-management and retention arrangements.
- Nominate management, project, MERL/data and ICT participants for decisions, testing and training.
- Provide consolidated feedback within the response periods agreed at inception.

## 9. Required Qualifications and Experience

An individual consultant or firm may apply, provided the proposed team collectively demonstrates:

- A relevant bachelor's degree or higher for the technical lead and at least five years of relevant dashboard, integration or monitoring-system experience.
- Proven KoboToolbox API work covering pagination, repeat data, edits, form versions and secure credentials.
- Strong web, server-side, database or cache, testing, visualisation and Git-based development capability.
- Experience translating results frameworks, targets and disaggregation rules into tested calculations.
- Experience with authentication, privacy, security testing, accessibility, responsive design, deployment, logging and recovery.
- Strong English-language facilitation, documentation and training skills; development-sector experience is desirable.

## 10. Duration and Duty Station

The assignment will run for 15 working days over three weeks, followed by a 30-calendar-day warranty from production go-live. The duty station is Kampala; remote development is permitted, but the consultant must attend agreed consultations, demonstrations, testing, training and handover sessions in person or online as directed.

## 11. Confidentiality, Data Protection and Intellectual Property

- Use project data, credentials and system information only for this assignment and comply with Cordaid confidentiality, data-processing, safeguarding and security requirements.
- Do not copy project data to unapproved devices, cloud or AI services, repositories or collaboration platforms; report suspected incidents immediately.
- Return or securely delete Cordaid data at completion and confirm deletion unless authorised legal retention applies.
- Transfer all paid custom code, configurations, models, designs and documentation to Cordaid, subject only to approved third-party licences and accounts.

## 12. Warranty and Change Control

The 30-day warranty covers non-conformity with approved requirements under agreed operating conditions. Record each issue by severity, impact, cause, action and release; test changes in staging before approval and production release. New indicators, integrations, source changes or features are enhancements and require documented impact assessment and written approval. Applicants may price optional post-warranty support separately.

## 13. Proposal Submission, Evaluation and Contracting

Applicants shall submit a concise technical proposal, 45-day workplan and warranty approach, team roles and CVs, at least three relevant assignments and references, specific evidence of secure KoboToolbox integration, and a fixed-price financial proposal separating taxes, one-time costs, recurring hosting or licences and optional maintenance. Evaluation will consider compliance, methodology, security, experience, team capability, workplan realism, handover, cost transparency and value for money. The contract and payment schedule will be deliverable- and acceptance-based.
