# API Audit (backend `Imarrt-BillServer`)

Base path `/api/v1`. 20 controllers, 175 HTTP routes. Method: code review of every controller's decorators and guard chain, targeted review of services for business scoping, plus the automated suite (`TEST_RESULTS.md`). No requests were sent to the production API.

## Request pipeline (applies to every route)

| Order | Layer | Behaviour |
|---|---|---|
| 1 | `ThrottlerGuard` | 100 requests/min default; auth routes 3–30/min. |
| 2 | `OriginGuard` | Non-GET requests with an `Origin` header must match `CORS_ORIGIN` (CSRF protection for cookie auth). |
| 3 | `JwtAuthGuard` | Access token from httpOnly cookie; `@Public` routes exempt (health, login, refresh, password reset). |
| 4 | `RolesGuard` | `@Roles(...)` against the user's role. |
| 5 | `BusinessGuard` | `@BusinessScoped`: `X-Business-Id` must be an active company where the user is an active member (super-admin exempt). |
| 6 | `BranchGuard` | `@BranchScoped`: `X-Branch-Id` must be an active branch of that company (`all` allowed for GET only). |
| 7 | `MfaGuard` | MFA-enabled users must have verified the session. |
| 8 | `ActionSecurityGuard` | Sensitive actions require the action passcode when enabled. |
| — | `ValidationPipe` | `whitelist`, `forbidNonWhitelisted`, `transform`: unknown fields rejected, types coerced. JSON body limit 1 MB. |

## Controllers

| Controller | Routes | Scope | Notes |
|---|---|---|---|
| `health` | 2 | Public | `/health` liveness, `/health/ready` runs `SELECT 1`. |
| `auth` | 14 | Public + MFA | Rate-limited; refresh rotation; MFA setup/verify. |
| `businesses` | 7 | Membership checked in service | Preferences validated field-by-field. |
| `branches` | 4 | Business | |
| `workspace-branches` | 5 | User | Company groups. |
| `users` | 6 | Business | Only staff/accountant can be added. |
| `action-security` | 2 | User | Passcode set/verify. |
| `parties`, `party-groups`, `suppliers`, `items` | 7 / 6 / 4 / 9 | Business + Branch | Master data shared across a company's logical branches. |
| `invoices` | 17 | Business + Branch | Create/edit/payments/attachments/PDF/delivery; `next-number`. |
| `documents` | 17 | Business + Branch | All document types, conversions, reversal, attachments, PDF. |
| `purchase-orders` | 11 | Business + Branch | Convert to bill. |
| `payment-out` | 11 | Business + Branch | Receipts, allocation, void. |
| `accounting`, `finance` | 11 / 17 | Business + Branch | Accounts, expenses, categories, cheques, loans, income, ledgers. |
| `inventory` | 7 | Business + Branch | Godowns, adjustments, stock ledger. |
| `production-orders` | 17 | Business + Branch | Stages, costs, images, payments. |
| `reports` | 1 | Business + Branch | Transaction report rows. |

## Checks

| Check | Result | Notes |
|---|---|---|
| Every operational query filtered by company/branch | PASS (code review) | By-id writes are preceded by a `findFirst({ id, businessId, branchId })`; sampled: warehouses, cash accounts, expense categories, payments, documents, invoices. No automated cross-tenant test (pending E2E). |
| Server recalculates money | PASS | Totals derived from lines with `computeBilling`; client totals ignored. |
| Idempotency | PASS | `requestId` unique per branch on invoices, documents, payments, receipts; replays return the original record (tested). |
| Unique numbering | PASS (after fixes) | Invoices: company sequence under row lock (BUG-03). Documents: highest-used + 1 (BUG-01). Purchase orders / payment-out: highest-used + 1. |
| Pagination | PASS | `limit` ≤ 100, `offset` ≤ 1,000,000. |
| Error responses | PASS (code review) | Nest exceptions with messages; global filter adds `requestId`, `path`, `timestamp`. |
| Attachment download | PASS | Always `Content-Disposition: attachment`, filename URL-encoded. |
| Upload validation | PARTIAL | Size and count limits; MIME type trusted from the client (OPEN-06). |
| Response shape consistency | PARTIAL | Lists return bare arrays (no total count), so the UI pages through with `getAllPages`. |

## API changes made in this engagement

| Route | Change | Compatibility |
|---|---|---|
| `GET /invoices/next-number` | Company-wise preview; optional `?date=YYYY-MM-DD`; returns `{ invoiceNumber, prefix, manual }`. Branch no longer used. | Additive. |
| `POST/PATCH /invoices`, `/documents` | `roundOff` stored; when omitted, create uses the company default and edit keeps the saved value. | Backwards compatible. |
| `POST/PATCH /invoices`, `/documents` | `taxRate` honoured for every company (GST registration no longer zeroes it). | Behaviour change requested by owner. |
| `GET/PATCH /businesses/:id/preferences` | New `transaction.invoicePrefix`, `transaction.invoiceNumberDigits`; `autoRoundOff` default true. | Additive. |
