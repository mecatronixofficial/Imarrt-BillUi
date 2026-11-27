# Production Checklist

Status: ✅ done and verified · ⚠️ done with caveat · ❌ not done · ⏳ pending the staging environment.

## Before the next deploy

| # | Item | Status | Notes |
|---|---|---|---|
| 1 | Backend type-check, unit tests, compile | ✅ | 265 tests pass (`TEST_RESULTS.md`). |
| 2 | Frontend type-check, lint, unit tests, production build | ✅ | 54 tests pass; 62 pages built. |
| 3 | Backend full build with `prisma generate` | ⚠️ | Blocked locally by the running dev server's file lock; rerun with the server stopped, and in CI. |
| 4 | Migrations applied to production database | ✅ | Both new migrations applied with owner approval (`DATABASE_AUDIT.md`). |
| 5 | Migrations rehearsed on a separate database | ⏳ | Run `prisma migrate deploy` on staging (E2E-16). |
| 6 | Restart backend after deploy so the new Prisma client loads | ❌ | Required: new columns (`roundOff`) and table (`invoice_number_sequences`). |
| 7 | Browser E2E and API integration suites | ⏳ | `TEST_CASES.md` section C. |
| 8 | Cross-tenant isolation test | ⏳ | E2E-08. |

## Environment and configuration

| # | Item | Status | Notes |
|---|---|---|---|
| 9 | `DATABASE_URL`, `JWT_*`, `FIELD_ENCRYPTION_KEY`, `CORS_ORIGIN`, `RESEND_*` set in production | ⚠️ | Present in the local `.env`; confirm in the hosting dashboard. Never commit `.env`. |
| 10 | `NEXT_PUBLIC_API_URL` points at the production API over HTTPS | ⚠️ | Confirm in Vercel project settings. |
| 11 | `CORS_ORIGIN` lists only the production (and staging) frontend origins | ⚠️ | Confirm the exact list. |
| 12 | `NODE_ENV=production` on the backend | ⚠️ | Enables secure cookies, `SameSite=None` and CSP. |
| 13 | HTTPS everywhere | ⚠️ | Vercel serves HTTPS; confirm the API host does too (required for secure cookies). |

## Operations

| # | Item | Status | Notes |
|---|---|---|---|
| 14 | Health checks | ✅ | `GET /api/v1/health` (liveness), `GET /api/v1/health/ready` (database). Wire them to uptime monitoring. |
| 15 | Logging | ⚠️ | Nest logger with request ids; no external log aggregation configured. |
| 16 | Error monitoring | ❌ | No Sentry or equivalent. |
| 17 | Database backups and restore drill | ❌ | Confirm point-in-time recovery on Aiven and perform one restore into staging. |
| 18 | Rate limits | ✅ | Global 100/min; auth 3–5/min. |
| 19 | PDF rendering (Puppeteer) available on the backend host | ⚠️ | Covered by `browser-executable.spec.ts`; confirm Chrome is present on the production host. |

## Performance

| # | Item | Status | Notes |
|---|---|---|---|
| 20 | List pagination capped | ✅ | 100 per page. |
| 21 | Dashboard / reports scale | ❌ | Fetch all records client-side (OPEN-04). Plan server aggregates before data grows large. |
| 22 | Bundle size reviewed | ⚠️ | Build succeeds; no bundle analysis done in this engagement. |

## Product decisions needed

| # | Item | Notes |
|---|---|---|
| 23 | Bill discount before or after tax | OPEN-01 — affects GST valuation and all totals. |
| 24 | Customer advances and refunds | OPEN-02, OPEN-03. |
| 25 | Per-company roles | OPEN-08. |
