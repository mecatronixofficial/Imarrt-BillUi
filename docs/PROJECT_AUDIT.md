# Project Audit — iMarrt Billing

Audit date: 2026-11-27. Scope: the frontend repository (`Imarrt-BillUi`, this repo) and the backend repository (`Imarrt-BillServer`). The production site (`billui-omega.vercel.app`) and the production database were **not** used for any testing (see "Test environment" below).

## 1. Technology stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15.5 (App Router), React 19, TypeScript, Tailwind CSS + CSS modules, axios, jsPDF (client exports), lucide-react |
| Backend | NestJS 11 (ESM), TypeScript, Prisma 6, class-validator DTOs, Passport/JWT, helmet, @nestjs/throttler, Puppeteer (PDF rendering) |
| Database | MySQL (Aiven-hosted for the configured environment), Prisma migrations |
| Auth | JWT access + refresh tokens in httpOnly cookies, optional TOTP MFA, action passcode for sensitive actions |
| Tests | Backend: Vitest (37 spec files). Frontend: Bun test runner with `node:test` style tests (15 files). Browser rendering scripts under `scripts/verify-*.mjs` (mocked API). No Playwright suite. |
| Deploy | Frontend on Vercel; backend has `vercel.json` and `api/` entry. |

## 2. Architecture

- **Multi-company, multi-branch.** Every operational record carries `businessId` and (mostly) `branchId`. Requests select the company with the `X-Business-Id` header and the branch with `X-Branch-Id`.
- **Global guard chain** (in order): Throttler → Origin (CSRF) → JWT → Roles → Business membership → Branch → MFA → Action passcode.
- **Money** is stored as `DECIMAL(12,2)`. Totals are calculated with a scaled-integer (BigInt) helper on both sides (`computeBilling`), and the backend recalculates every total from the line items. It never trusts client totals.
- **Posting** (invoice save, stock, payments, conversions) runs inside one database transaction with `SELECT … FOR UPDATE` row locks (branch, invoice, party, account, company numbering) and `requestId` idempotency keys.
- **Frontend data** is fetched per page through axios with an interceptor that injects company/branch headers. The dashboard and reports compute figures in the browser from full record lists.

## 3. Size

| Item | Count |
|---|---|
| Backend controllers / HTTP routes | 20 / 175 |
| Prisma models / enums / migrations / indexes+unique constraints | 45 / 16 / 44 / 101 |
| Frontend page routes (`src/app/**/page.tsx`) | 66 |
| Backend source (excluding specs) | ≈ 11,200 lines |

## 4. Modules found

Dashboard; Companies & branches (workspace groups); Parties (customers), party groups, suppliers; Items (with category, HSN, tracking fields: serial, lot, barcode, MRP, brand, count); Inventory (godowns, stock adjustments, stock ledger); Sale invoice; Quotation/estimate; Proforma; Sales order; Delivery challan; Credit note / sales return; Purchase bill; Purchase order; Debit note / purchase return; Payment in; Payment out; Cash & bank accounts, cheques, loans, other income; Expenses with categories; Production (orders, stages, costs, payments); Reports (transactions, day book, P&L, bill-wise profit, sale aging, balance sheet, party statement, party groups, sale/purchase by party, GST summary, HSN summary, stock summary, low stock); Settings (general, transaction, print regular/thermal, taxes & GST, transaction messages, party, item, passcode); Team (staff/accountant); Security (MFA, sessions, password reset).

Hidden/secondary routes: `/customers` (legacy), `/invoices/new` and the `*/new` editors, detail pages `/invoices/[id]`, `/documents/[id]`, `/purchases/orders/[id]`, `/parties/[id]`, `/items/[id]`, `/production/[id]`.

## 5. Findings summary

Detailed entries are in `BUG_REPORT.md`; feature status is in `FEATURE_MATRIX.md`.

### Fixed during this engagement

| ID | Severity | Summary |
|---|---|---|
| BUG-01 | High | Document numbers (quotation, bill, notes…) collided after a document's date was edited into another year; every new document of that type/year then failed to save. |
| BUG-02 | High | Printed GST breakup ignored place of supply: an unregistered buyer in another state was billed CGST+SGST instead of IGST. |
| BUG-03 | High | Invoice numbers were per-branch and count-based (race-prone, not company-wise). Replaced by a locked company-wise sequence. |
| BUG-04 | High | Companies not registered for GST could not charge tax (tax silently forced to 0); tax entry was a fixed dropdown. |
| BUG-05 | Medium | Round-off choice was not stored; editing a transaction could change its total. |
| BUG-06 | Medium | Invoice PDF did not print the place of supply. |
| BUG-07 | Medium | Detail pages had no Round-off row, so the on-screen totals did not add up as on the PDF. |
| BUG-08 | Medium | HSN summary report used floating-point tax maths. |
| BUG-09 | Medium | Back navigation was hard-coded; editors closed to fixed routes; no unsaved-changes protection. |
| BUG-10 | Medium | Sale invoice item table overflowed (Price/Tax/Amount off screen, wrapped footer buttons, double scrollbar). |
| FEAT-01 | — | Added GST Summary (GSTR-3B style) report: output tax, input tax credit, net payable by rate with CGST/SGST/IGST. |

### Open (not fixed)

| ID | Severity | Summary |
|---|---|---|
| OPEN-01 | High | Invoice-level discount is subtracted after tax; the taxable value is not reduced (GST valuation issue). Needs a product decision because it changes totals. |
| OPEN-02 | Medium | No customer advance / on-account receipt (every payment-in must belong to an invoice). |
| OPEN-03 | Medium | No refund recording against credit notes (money paid back to a customer). |
| OPEN-04 | Medium | Dashboard and reports download every record to the browser and compute there; will degrade with large data. |
| OPEN-05 | Medium | Login is rate-limited per IP but there is no per-account lockout. |
| OPEN-06 | Medium | Uploaded files are accepted by declared MIME type only (no content signature check). |
| OPEN-07 | Medium | Missing modules: audit-log viewer, backup/restore tooling, units master, item-level discount, TCS/TDS. |
| OPEN-08 | Low | Roles are global per user, not per company membership. |
| OPEN-09 | Low | P&L is cash-basis (purchases as cost), not cost of goods sold; stock is valued at current purchase price. |
| OPEN-10 | Low | PDF tax breakup sums unrounded line tax while the stored tax total can be rounded ("Round off tax amount"). |
| OPEN-11 | Low | The browser's own Back button is not intercepted for unsaved changes (in-app Back, ✕, Esc, refresh and tab close are). |

## 6. Test environment

- No isolated database was available on the audit machine (no Docker, MySQL or WSL). The user chose to provide a **staging database URL**; it had not been provided when these documents were written.
- Therefore all automated tests in this report run against **mocked persistence** (service logic, calculations, guards). Database-level integration, concurrency and browser end-to-end workflows are recorded as **NOT TESTED** and listed in `TEST_CASES.md` as pending.
- Two schema migrations from this engagement were applied to the configured (Aiven) database **with the owner's explicit approval**: `20261127120000_company_invoice_numbering` (new table + index) and `20261127150000_round_off_by_default` (new columns, a back-fill inferred from saved totals, and Round-off switched on in company settings). Neither changed any saved amount or number.
