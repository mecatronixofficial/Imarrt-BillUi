# iMart functional upgrade audit

Audit started 31 October 2026. Preserve all existing routes, styles, branding, responsive layouts and business data.

## Repositories and reference

- Frontend: this repository; Next.js 15 App Router, React 19, strict TypeScript, Tailwind, Axios; cookie sessions, MFA and company/branch headers.
- Backend: `../../Imarrt Bill Server/Imarrt-BillServer`; NestJS 11, Prisma 6, **MySQL**, Puppeteer PDF generation. Keep this stack.
- Reference: `C:/Users/sivak/Downloads/Video Project1.mp4`, duration 6 minutes 13 seconds. 24 sampled frames inspected; implementation comparison and limitations are recorded in the results report.
- Baseline frontend TypeScript and ESLint checks pass. No backend or database files exist inside the frontend repository.
- No production data mutations, seed commands, deployment or live database migration are authorized by the test procedure.

## Feature gaps identified before implementation (baseline; see results for current status)

| Feature | Existing implementation | Missing / incorrect behavior | Files / API work | Status |
| --- | --- | --- | --- | --- |
| Dashboard | Real invoices, production, parties and items | Revenue chart uses fixed SVG data; no purchase totals or date filter; draft invoices affect balances | `src/app/dashboard/page.tsx`, report calculations | Audited |
| Parties | Create/edit/search, ledger, opening balance, credit settings, GSTIN, addresses | Linked records can be deleted; credits absent from ledger; customer/supplier classification and custom fields absent | Frontend `PartyWorkspace.tsx`; backend parties service/DTO/schema | Audited |
| Items | CRUD, SKU, HSN, image, category, sale/purchase/wholesale rates, tax modes | Purchase form uses sale rate; inclusive price setting ignored; limited stock history and no warehouses/transfers | Forms; backend items/inventory/schema | Audited |
| Sales invoice | API creation, number assignment, attachments, payments, PDF and provider sharing | Float calculations; cancellation/deletion does not reverse stock; payment reads outside transaction; cash payment separate from invoice save | Invoice totals/form; backend invoice service/DTO | Critical fixes required |
| Purchase bill | API creation, attachments, payment out, stock inward | Concurrent payment and status races; no warehouse support; incorrect item default pricing | Document form; backend documents service | Critical fixes required |
| Quotations / proforma | Persistent documents, PDF, conversion | Conversion and source closure separate commits; repeat conversion can create duplicate invoices | Backend documents/invoices services | Critical fixes required |
| Sales orders | Existing `/sales/orders` uses garment production orders | General item sales order conversion absent; do not rename route or remove production | Sales order register and backend model | Partial |
| Delivery challan | Persistent document and PDF | Dispatch stock movement / invoice conversion absent | Documents service and existing detail page | Partial |
| Returns | Credit/debit document forms with source links | No stock reversal or outstanding adjustment; cumulative return validation absent | Backend documents / party balance | Incomplete |
| Purchase orders | Persistent order register | Purchase bill conversion absent | Purchase order service/controller/register | Partial |
| Expenses | `/purchases/expenses` uses production cost entries | General expenses tied to cash/bank accounts absent | Accounting backend and existing expense route | Partial |
| Cash / bank | Existing account form, encrypted browser storage | Device-local bank data; no server persistence or payment links | `src/app/cash-banks/page.tsx`, new server endpoints/schema | Incomplete |
| Reports | Real records, CSV, graph | Drafts counted as revenue, future dates not bounded, cancelled production costs counted, hardcoded low stock threshold; no COGS-based profit | `src/app/reports/page.tsx`, report utilities | Incorrect calculations |
| Settings | Company API persistence, local cache and optimistic updates | Pending changes can save to a different company after switch; stale responses overwrite newer changes | `src/lib/preferences.ts` | Critical fix required |
| Printing | Existing regular/thermal preferences and PDF renderer | Verify actual template/width/copies behavior; browser print action incomplete | Backend PDF service and detail pages | Verification required |
| Authentication / scope | Existing guards, MFA, refresh cookies | Shared branch resolver and document company preferences need verification | API scope / backend guards | Retain and test |

## Existing route map

Keep `/dashboard`, `/parties`, `/parties/[id]`, `/customers`, `/items`, `/items/[id]`, `/invoices`, `/invoices/new`, `/invoices/[id]`, `/documents`, `/documents/new`, `/documents/[id]`, `/sales`, `/sales/quotations`, `/sales/proforma`, `/sales/orders`, `/sales/delivery-challans`, `/sales/returns`, `/sales/payment-in`, `/purchases`, `/purchases/bills`, `/purchases/orders`, `/purchases/returns`, `/purchases/payment-out`, `/purchases/expenses`, `/production`, `/production/[id]`, `/cash-banks`, `/reports`, `/settings` and all settings/auth/business/team/security routes. Reuse these module locations.

## Verification boundaries

Use isolated regression tests and generated test data. Never run destructive reset/seed or test workflows against existing records. Schema validation and migration generation are safe; applying migrations requires the deployment database owner to run the reviewed migration with a backup. Browser/database end-to-end verification requires a disposable test database and authenticated test session.

Implementation results and remaining gaps are recorded in `functional-upgrade-results.md` as work completes.
