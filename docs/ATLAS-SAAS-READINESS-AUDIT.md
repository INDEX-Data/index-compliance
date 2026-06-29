# ATLAS — SaaS-Readiness Audit

**Product:** ATLAS — Microsoft 365 compliance assessment platform (INDEX)
**Date:** 2026-06-29
**Scope:** Full platform — Next.js web app (`web/`, Vercel), TypeScript engine + Express server (`src/`), Supabase (Postgres + Auth + Realtime)
**Lenses (weighted):** Security & Trust (SOC 2 / OWASP ASVS) · SaaS commercial readiness · UI/UX & design-system
**Method:** Code-level review. Every finding below is verified against source and cited `file:line`. Billing/monetization is **intentionally out of scope** (deferred by direction).

---

## 1. Executive summary

ATLAS sits on a **genuinely sound security foundation** — Row Level Security on every table, AES-256-GCM encryption of customer credentials, authentication on every route, and a strong HTTP security-header set. The product surface is also far more complete than an MVP: onboarding wizard, MSP invite flow, nine third-party integrations, an AI copilot, drift/maturity tracking, and presentation-grade Word/Excel/ZIP exports.

It is **not yet ready to run as a true multi-tenant SaaS**, gated by three things:

1. ~~**Two confirmed CRITICAL cross-tenant data leaks** (IDOR)~~ — **✅ remediated 2026-06-29 (commit `8b1e057`)**. Any authenticated tenant could read another tenant's compliance reports and attestations; both routes now enforce ownership via `getOwnedReport()`. Retained here for the audit trail.
2. **No true org/workspace model** — isolation is per-`user_id`. There is no organization entity, so a customer is a single user and an MSP cannot cleanly hold many client orgs. Team tables exist but are unwired.
3. **Operational immaturity** — scheduled assessments are dormant (no cron trigger deployed), and there is no structured logging, error tracking, rate limiting, app-level audit log, data-retention policy, or MFA.

**Overall readiness: 2.3 / 5 — "Strong foundation, pre-SaaS."** The security architecture is above average for the stage; the gaps are well-contained and mostly additive rather than rewrites. With the P0 leaks fixed and the P1 platform work done, ATLAS is a credible multi-tenant SaaS.

### Scorecard

| Lens | Maturity | Score /5 | One-line |
|---|---|---|---|
| **Security & Trust** | Partial | **2.5 → 3.0** | Excellent isolation primitives (RLS, encryption, headers); the 2 critical IDOR routes are now **remediated** (commit `8b1e057`), leaving only HIGH/MEDIUM gaps (audit log, retention, validation, MFA). |
| **SaaS commercial readiness** | Early–Partial | **2.0 → 2.5** | Rich feature surface; continuous-monitoring automation is now **live** (cron wired, C-2). Remaining gaps: single-tenant data model, observability, rate-limiting. |
| **UI/UX & design-system** | Partial | **2.5** | Mature navigation and reporting; design tokens defined but ignored (192 raw hex on one page), state-handling gaps, and no accessibility layer. |
| **Overall** | — | **2.3** | Sound foundation; not yet multi-tenant-SaaS-ready. |

*Scoring: 0 Missing · 1 Nascent · 2 Early · 3 Functional · 4 Mature · 5 Best-in-class.*

---

## 2. Methodology & benchmarks

Findings are mapped to recognized control sets so the score is traceable, not subjective:

- **SOC 2 Trust Services Criteria** — CC6 (logical access), CC7 (system operations / monitoring), CC8 (change management), A1 (availability), C1 (confidentiality).
- **OWASP ASVS v4 (L1/L2)** — V1 architecture, V4 access control, V7 logging & monitoring, V8 data protection, V14 configuration.
- **SaaS-readiness checklist** — multi-tenancy isolation, tenant lifecycle, observability, rate limiting, MFA/SSO, automation reliability.
- **WCAG 2.2 AA** — referenced for the UI accessibility findings (secondary lens).

Severity = exploitability × blast radius (Critical / High / Medium / Low). Each finding lists evidence, the benchmark it maps to, and a recommendation.

---

## 3. Findings — Security & Trust

### Positives (verified)
- **RLS enabled and comprehensive** — 35 `ENABLE ROW LEVEL SECURITY` / `CREATE POLICY` statements across `supabase/migrations/001_initial_schema.sql`; every tenant table scopes by `auth.uid() = user_id`. *(SOC2 CC6.1 / ASVS V4)*
- **Field-level secret encryption** — customer Azure `tenant_id`/`client_id`/`client_secret` encrypted with AES-256-GCM (random IV + auth tag, versioned `enc:v1:` format) in `web/lib/crypto.ts`. *(SOC2 C1 / ASVS V8)*
- **HTTP security headers** — `web/next.config.ts`: `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, plus X-Content-Type-Options, Referrer-Policy, Permissions-Policy. *(ASVS V14)*
- **Auth on every sensitive route** — all `web/app/api/*` handlers call `supabase.auth.getUser()` and 401 on absence.

### S-1 · CRITICAL · Cross-tenant report export (IDOR) — ✅ REMEDIATED 2026-06-29 (commit `8b1e057`)
**Evidence:** `web/app/api/generate-report/route.ts:34-45` — authenticates the user, then queries `reports` via the **service-role client** (which bypasses RLS) with `.eq('id', reportId)` and **no `user_id` filter**.
**Resolution:** now loads the report via `getOwnedReport()` (`web/lib/authz.ts`), which enforces `.eq('user_id', user.id)`; non-owned/missing → 404.
**Impact:** Any authenticated tenant can download the Word/OPA/ZIP export of *any* report by ID, across tenants. Leaks another customer's full compliance posture.
**Benchmark:** SOC2 CC6.1 · OWASP ASVS V4.1 (broken access control / IDOR).
**Fix:** Verify ownership before fetching — `.eq('id', reportId).eq('user_id', user.id)` and 404/403 if no row. One line.

### S-2 · CRITICAL · Cross-tenant objective/attestation exposure (IDOR) — ✅ REMEDIATED 2026-06-29 (commit `8b1e057`)
**Evidence:** `web/app/api/get-objectives/route.ts:23-33` — same pattern: service-role client, `.eq('report_id', reportId)`, no ownership check.
**Resolution:** an ownership gate via `getOwnedReport()` now runs before any objective/attestation read; non-owned/missing → 404.
**Impact:** Any authenticated tenant can enumerate another tenant's DIBCAC objective statuses and attestation text.
**Benchmark:** SOC2 CC6.1 · OWASP ASVS V4.1.
**Fix:** Resolve the parent `report` with `.eq('user_id', user.id)` first; reject if not owned, then load its objectives.

> **Systemic note:** these two are the only routes that use the service-role key *without* re-adding the `user_id` filter. Every other route applies it as defense-in-depth. Recommend a lint rule / shared helper (`requireOwnedReport(reportId, userId)`) so the service-role + ownership pattern can't be forgotten again.

### S-3 · HIGH · No application-level audit log
**Evidence:** no `audit_log` / `audit_trail` / `activity_log` table anywhere in `supabase/migrations/`. Only row `created_at`/`updated_at` timestamps; no actor, action, or before/after capture.
**Impact:** Cannot answer "who changed these credentials / deleted this report / ran this assessment." A compliance SaaS is itself expected to produce this for SOC 2 Type II.
**Benchmark:** SOC2 CC7.2 · ASVS V7.
**Fix:** Append-only `audit_log` table + a thin write helper invoked on mutating routes (create/update/delete client, run assessment, delete report, approve remediation).

### S-4 · HIGH · No data-retention / deletion policy
**Evidence:** no retention configuration or scheduled cleanup; deletion is manual per-row (cascades exist on FKs, e.g. `clients → reports`).
**Impact:** Cannot satisfy customer-contract data-destruction or GDPR/CCPA deletion obligations.
**Benchmark:** SOC2 C1 / Privacy · ASVS V8.
**Fix:** Document retention windows; add a tenant-initiated "delete my data" path and an optional scheduled purge.

### S-5 · MEDIUM · No input validation on API routes
**Evidence:** handlers read `await request.json()` and destructure raw (e.g. `web/app/api/clients/route.ts`, `web/app/api/schedules/route.ts`); only presence checks. No Zod schema. `cronExpression` in particular is stored unvalidated.
**Impact:** Malformed data persisted (e.g. an un-parseable cron string later throwing in the runner = a self-inflicted DoS for that schedule); no array/size bounds. SQL-injection risk is low (parameterized Supabase queries), so this is Medium not High.
**Benchmark:** ASVS V5 (validation).
**Fix:** Zod `safeParse` per route body (UUIDs, cron syntax, lengths); 400 on failure.

### S-6 · MEDIUM · `ignoreBuildErrors: true`
**Evidence:** `web/next.config.ts:34`. Type errors (including type-level security regressions) pass CI silently. Justified by the monorepo `../src` resolution issue, but blunt.
**Benchmark:** SOC2 CC8.1 (change management).
**Fix:** Run `tsc --noEmit` as a separate CI/pre-commit gate so the build flag doesn't also disable type safety.

### S-7 · MEDIUM · Dual backend, divergent auth
**Evidence:** `src/api-server.ts` is a parallel Express server authenticating via **Clerk** JWTs, while `web/app/api/*` uses **Supabase** sessions. Two doors, two auth models, overlapping responsibilities (client CRUD, graph queries).
**Impact:** Divergence risk — a security rule fixed in one path can be missed in the other. Unclear which is production-facing.
**Benchmark:** ASVS V1 (architecture).
**Fix:** Decide the canonical backend; retire or clearly scope the Express server; if both stay, share auth/validation middleware.

### S-8 · MEDIUM · Weak `CRON_SECRET` floor & no MFA
**Evidence:** `web/lib/env.ts:42` enforces only `min(16)` for `CRON_SECRET`. Supabase MFA is available but not enabled; password policy is client-side `min 8`.
**Benchmark:** SOC2 CC6.1 · ASVS V2 (authentication).
**Fix:** Raise the secret floor (32+ / base64 32 bytes); enable Supabase MFA and server-side password policy before multi-tenant launch.

---

## 4. Findings — SaaS commercial readiness

> *Billing/plans/metering is intentionally deferred and not scored here. See §6.*

### C-1 · HIGH · Single-tenant-per-user; no org/workspace
**Evidence:** all 20+ tables scope by `user_id → auth.users(id)`. `team_memberships` / `team_invitations` tables exist (`supabase/migrations/001_initial_schema.sql`) but have no wiring (no API/UI). A "customer" is therefore one user account.
**Impact:** No shared org workspace, no role-based access within a customer, and no clean MSP→many-clients hierarchy. This is the central SaaS-model gap.
**Benchmark:** SaaS multi-tenancy.
**Recommendation (GTM "both"):** introduce an `organizations`/`workspace` entity with `organization_members(role)`, and an optional `parent_org_id` for MSPs. Migrate scoping from `user_id` to `organization_id` (RLS via membership). This is the single largest piece of platform work and should precede onboarding real customers.

### C-2 · HIGH · Scheduled assessments are dormant — ✅ REMEDIATED 2026-06-29
**Evidence:** full schedule/drift/maturity machinery exists (`web/app/api/cron/run-scheduled-assessments`, `src/operations/schedule.ts`), but there was **no `vercel.json`** and no external scheduler configured — the cron route was never invoked.
**Resolution:** added `web/vercel.json` (hourly cron `0 * * * *`); the route now also accepts Vercel's GET + `Authorization: Bearer <CRON_SECRET>`, and `nextRunAfter`/`isValidCron` use `cron-parser` (full 5-field, UTC) instead of the simplified parser. *Operational note: Vercel Hobby caps cron at daily / 2 jobs — Pro is required for hourly. Ensure `CRON_SECRET` is set in the Vercel project.*
**Impact:** "Continuous monitoring" — a core value prop — does not actually run. The simplified cron parser (`src/operations/schedule.ts`) is also flagged in-code as not production-grade.
**Benchmark:** SOC2 A1 (availability) · SaaS automation reliability.
**Fix:** Add `vercel.json` cron (or a Railway/Fly scheduler) hitting the route on an interval; swap the parser for `cron-parser`.

### C-3 · HIGH · No observability
**Evidence:** only `console.log/error`; no structured logger, no Sentry/error tracking, no analytics, no APM. Health check exists (`/api/health`) but nothing aggregates errors or usage.
**Impact:** In production you'd be blind to failures and usage; incident response and SOC2 CC7.x monitoring are not satisfiable.
**Benchmark:** SOC2 CC7.1–7.2 · ASVS V7.
**Fix:** Structured logging (pino) + Sentry + a minimal product-analytics layer.

### C-4 · MEDIUM · No rate limiting / abuse controls
**Evidence:** no per-user or per-IP limiting on any route; Express CORS auto-allows all `*.vercel.app` previews (`src/api-server.ts`). Assessment and AI-copilot routes are expensive and unbounded.
**Impact:** A single tenant can exhaust Graph throttling budgets, Anthropic spend, and DB capacity for everyone.
**Benchmark:** SOC2 A1 · ASVS V11.
**Fix:** Edge/middleware rate limiting (Upstash/Vercel KV) keyed by user/org; tighten CORS for production origins.

### C-5 · MEDIUM · Onboarding/team flows partially stubbed
**Evidence:** MSP invite/token onboarding (`web/app/onboard/[token]`) and integrations exist, but team membership isn't usable end-to-end, and onboarding lacks a post-signup checklist/activation guide.
**Impact:** Activation and expansion friction; incomplete MSP story.
**Fix:** Finish team wiring as part of C-1's org model; add a first-run checklist.

---

## 5. Findings — UI/UX & design-system

### Positives (verified)
- **Mature navigation/IA** — collapsible sidebar + topbar with MSP/Org dual nav, workspace menu, keyboard hints (`web/components/Sidebar.tsx`, `web/components/TopNavbar.tsx`).
- **Mature reporting/exports** — report view with donut + summary cards + evidence drawer, and Word (Claude-narrated)/Excel-OPA/ZIP exports with proper loading and error states.

### U-1 · HIGH · Design tokens defined but not used
**Evidence:** a tokenized palette exists (`web/tailwind.config.ts`, `web/app/globals.css`), yet components hardcode raw hex — **192 hex literals in `web/app/(app)/dashboard/page.tsx` alone**. Status colors diverge between `web/components/StatusBadge.tsx` and `web/components/RiskBadge.tsx`.
**Impact:** No single source of truth for color/spacing → theming (incl. dark mode and white-label, both relevant for SaaS/MSP) is effectively impossible; visual drift accumulates.
**Fix:** Route all components through semantic Tailwind tokens; centralize status/risk color maps; lint against raw `#hex` in JSX.

### U-2 · MEDIUM · Inconsistent loading/empty/error states
**Evidence:** History page handles all three well; Dashboard, Clients, and Settings silently catch fetch failures with no error UI and no/weak loading and empty states.
**Impact:** Failures look like "empty" — exactly the silent-failure class fixed earlier elsewhere; poor trust signal.
**Fix:** Standard `<LoadingState/> <EmptyState/> <ErrorState/>` primitives applied across data pages.

### U-3 · MEDIUM · Accessibility layer missing (WCAG 2.2)
**Evidence:** no ARIA attributes in app pages; clickable `div`s used as buttons (e.g. framework cards); no modal focus trap/restore; placeholder `#a8a29e` and faint `#78716c` text likely fail AA contrast; no skip-link.
**Impact:** Excludes keyboard/AT users and is frequently a **procurement requirement** for compliance/government buyers — ironic risk for this product.
**Benchmark:** WCAG 2.2 AA.
**Fix:** Semantic elements + ARIA, focus management in modals, contrast remediation, keyboard nav. (Secondary lens — scheduled at P2.)

### U-4 · LOW · Responsive gaps, no dark mode, branding drift
**Evidence:** tables (clients/history) not mobile-optimized; no real dark mode (only a `dark` color token, not a theme); no favicon/OG tags; "Atlas" vs "indexdatasec"/"INDEX-Data" naming inconsistency (also seen earlier in a schema `$id`).
**Fix:** Responsive table treatment; theme support once U-1 tokenization lands; finalize one brand name + favicon/OG.

---

## 6. Prioritized roadmap

| Priority | Item | Findings | Rough effort |
|---|---|---|---|
| ~~**P0 — before any 2nd tenant**~~ ✅ **DONE** | Fixed both cross-tenant IDOR routes + added `getOwnedReport` helper (`web/lib/authz.ts`) | S-1, S-2 | done (`8b1e057`) |
| ✅ **DONE** | Deploy cron trigger (`web/vercel.json`) + production `cron-parser` | C-2 | done |
| **P1 — platform foundation** | Org/workspace data model + RLS migration from `user_id` (+ finish teams) | C-1, C-5 | ~2–3 wks |
| | Observability: structured logs + Sentry + analytics | C-3 | ~3–5 days |
| **P2 — hardening (SOC2 path)** | App-level audit log | S-3 | ~3–4 days |
| | Data-retention/deletion policy + tenant delete | S-4 | ~3–4 days |
| | Rate limiting + CORS tightening | C-4 | ~2–3 days |
| | Zod input validation across routes | S-5 | ~2 days |
| | MFA + password policy + `CRON_SECRET` floor | S-8 | ~2 days |
| | `tsc` CI gate; decide canonical backend | S-6, S-7 | ~2–3 days |
| | Accessibility remediation (WCAG 2.2 AA) | U-3 | ~1 wk |
| **P3 — polish** | Design-token migration + shared state primitives | U-1, U-2 | ~1 wk |
| | Responsive tables, dark mode, branding/favicon | U-4 | ~3–5 days |

**Deferred / future (not scored):** billing & plans (Stripe), usage metering, SSO/SCIM, white-label theming (unlocked by U-1). Revisit once the org model (C-1) lands, since plans attach to organizations.

---

## 7. Appendix

### Architecture (current)
```
Vercel — Next.js web + /app/api/* (Supabase session auth)
   │  fetch
Railway/Fly — Express src/api-server.ts (Clerk JWT auth)   ← parallel backend, S-7
   │
Supabase — Postgres (RLS on all tenant tables) + Auth + Realtime
External cron — NOT configured (C-2)
```

### Tenant tables (per-`user_id`, RLS-scoped)
`clients`, `reports`, `objective_statuses`, `assessment_jobs`, `assessment_schedules`, `drift_events`, `maturity_snapshots`, `remediation_jobs`, `agent_actions`, `client_agents`, `team_memberships`, `team_invitations`, `user_profiles`, `client_integrations`, `client_invitations`, `evidence_files`, `client_scoping`, `ca_exclusion_snapshots`, `ticket_nominations`.

### Key file references
- IDOR: `web/app/api/generate-report/route.ts:34-45`, `web/app/api/get-objectives/route.ts:23-33`
- Isolation/encryption: `supabase/migrations/001_initial_schema.sql`, `web/lib/crypto.ts`
- Config/headers: `web/next.config.ts`, `web/lib/env.ts`
- Automation: `web/app/api/cron/run-scheduled-assessments/route.ts`, `src/operations/schedule.ts` (no `vercel.json`)
- UI: `web/components/Sidebar.tsx`, `web/components/StatusBadge.tsx`, `web/components/RiskBadge.tsx`, `web/app/(app)/dashboard/page.tsx`, `web/tailwind.config.ts`

---

*All findings source-verified as of 2026-06-29. Post-audit remediation completed the same day: the two CRITICAL IDOR leaks (S-1, S-2) and the dormant-cron gap (C-2) are fixed (commit `8b1e057` and the cron wiring). Remaining items are tracked in the roadmap above; the next foundational piece is the org/workspace model (C-1).*
