# iMart Billing functional upgrade results

Updated 1 November 2026. Changes are in the existing frontend and sibling backend repositories. No deployment, live database migration, seed, restore, or business-record test was performed. The user selected **code checks only; database tests pending**.

## Scope and architecture

Frontend: Next.js 15 / React 19 / TypeScript / existing Tailwind components. Backend: NestJS 11 / Prisma 6 / MySQL / Puppeteer. Existing authentication, MFA, roles, company and branch guards remain in use. Environment variables were preserved; `.env` was not edited. Existing routes, logos, CSS files and style definitions were retained. Necessary controls and inventory pages reuse existing form, card, button and table classes. Production orders remain available under their existing route.

The reference `C:/Users/sivak/Downloads/Video Project1.mp4` was inspected through 24 sampled frames across its 6m13s duration. It demonstrates transaction forms, preferences, regular/thermal printing, messages, party fields, item units/pricing/history, cash sales, quotations and proforma registers. A video cannot establish how its database transactions work; transaction consistency below was implemented from explicit requirements and verified with service tests.

The original gap assessment is in [functional-upgrade-audit.md](functional-upgrade-audit.md). [functional-surface-audit.json](functional-surface-audit.json) inventories source routes, controls, HTTP endpoints and every changed/new repository file. Static handler detection is an inspection aid, not proof that every conditional button has been exercised.

## Comparison and implementation status

| Feature | Before | Implemented behavior | Remaining work / status |
| --- | --- | --- | --- |
| Dashboard | Real invoices but fixed revenue graph; incomplete purchase/expense totals | Actual sales/purchase series; Today/Week/Month/Custom filters; active sales/purchases, returns, expenses, receivable/payable totals; cancelled/draft exclusion; configured low-stock threshold | Improved. Profit remains an estimate based on purchases, not inventory COGS; historical payment allocation snapshots are absent |
| Party management | Customer CRUD, GST, credit limit, address and ledger already present | Save & New; dashboard inline creation; safe linked-record deletion; credit notes in exact outstanding ledger; configured credit-limit enforcement | Partial. Unified Customer/Supplier/Both, arbitrary extra fields, party groups/state/terms and complete supplier statements remain |
| Item master | Existing SKU, HSN, image, rates, units and tax-mode fields | Catalog purchase pricing corrected; inclusive/exclusive tax preserved; purchase-cost stock-value estimate; duplicate-SKU checks; protected linked-item deletion; paginated item sales/purchase history | Partial. Barcode workflow, secondary-unit conversion, batches/lots, MRP/brand, valuation layers and bulk import validation remain |
| Warehouses and inventory | Aggregate item stock only | Persistent godowns; balances; inward/outward/adjustment; transfer preserving aggregate stock; durable movements; negative-stock rules; original stock remains unallocated until explicitly transferred | Implemented core. Real MySQL locking/rollback validation pending; historical movements were not fabricated |
| Sales invoice | Creation, receipts, attachments, PDF; float totals and unsafe reversal | Decimal calculations; initial cash/partial payment atomic with save; drafts; edit unpaid invoices; issue draft; duplicate for review; repeat-safe requests; cancel/unpaid deletion reverses stock once; credit-adjusted due and overpayment guards | Improved. Paid edits/cancellation intentionally blocked until a refund/reversal workflow exists; line discounts, shipping/packing and full historical tax snapshots remain |
| Purchase bills | Bills and stock inward; weak payment/cancellation rules | Correct purchase rates and tax modes; warehouse selection; atomic posting/reversal; serialized payments; debit-adjusted outstanding; linked-return/paid cancellation guards | Improved. Complete reverse-charge accounting, partial goods receipt and full supplier statement workflow remain |
| Quotations and proforma | Persistent registers with non-atomic conversion | Atomic conversion to invoice, source closure and target reference; repeat calls return original target; quotation-to-proforma retained | Implemented core; database E2E pending |
| Sales orders | Garment production orders only | General item sales-order tab under existing `/sales/orders`; new creation page; quotation-to-order; order-to-invoice/challan | Implemented core. Partial fulfillment tracking remains |
| Delivery challans | Stored documents without dispatch stock effect | Dispatch posts stock; conversion to invoice avoids a second deduction; source references preserved | Implemented core; partial delivery allocation remains |
| Credit/debit notes | Documents without complete financial/stock effect | Financial balances adjust; explicit physical-goods-return flag; cumulative value/quantity caps; source party validation; stock reversal and cancellation protection | Implemented core. Cash refunds and retrospective allocation remain |
| Purchase orders | Existing persistent PO register | Exact totals/catalog pricing; atomic purchase-bill conversion; target reference and repeat protection; converted-order reset prevented | Implemented full conversion. Legacy partial receipt conversion is rejected to prevent double inward; partial receipts remain |
| Payment In/Out | Invoice/bill receipt registers | Scoped optional account selection; exact balances; concurrency locks and request retry protection; account ownership checks | Improved. Advances, multi-invoice allocation, reallocation/refunds and full journals remain |
| Cash/bank | Encrypted browser-local accounts | Server account CRUD; encrypted account numbers and blind-index deduplication; scoped linked balances; explicit import of preserved local entries | Implemented bank accounts. Separate cash-account master, bank reconciliation and statement import remain |
| Expenses | Production costs only | General expense create/list/cancel panel alongside production costs; tax, account and duplicate-request validation; dashboard/report inclusion | Implemented core. Full expense edit/attachment/register exports remain |
| Printing | Preferences and regular PDF, incomplete thermal behavior | A4 portrait/landscape; standard/compact/classic selection; real 58mm/80mm/custom PDF widths and 1–5 copies; correct credit/debit net pending; print preview; existing logo/bank/QR/signature fields | Browser/PDF implemented. Hardware cutter, cash drawer and native direct-print bridge are not implemented |
| Settings | Persistent API with optimistic cache race | Changes remain tied to original company; newer edits survive delayed responses; document company controls calculations; print templates/thermal settings affect PDF | Improved. Some existing preference fields still have no operational workflow; comprehensive field-visibility, backup/restore and tax-rule audit remains |
| Reports | Float/date/status errors in real-record reports | Exact sums, active records, returns/general expenses, bounded/historical dates, real chart and existing CSV | Partial. Audited COGS P&L, GST returns, Excel/PDF registers, cash-flow statement and full accounting remain |
| API integration | Existing API with cache/pagination/scope defects | Request-safe cache invalidation, response pagination validation, scoped record mutations, safe creator field projection | Improved. Full live authorization/API E2E and every conditional control exercise remain pending |

## New and changed API behavior

Paths below are relative to the existing API prefix. New endpoints retain existing MFA/role/company/branch authorization. Existing endpoint names were not renamed.

| Endpoint | Change |
| --- | --- |
| `GET/POST /accounts`; `PATCH/DELETE /accounts/:id` | New persistent scoped account CRUD, encrypted account numbers, deduplication and linked-record protection |
| `GET/POST /expenses`; `POST /expenses/:id/cancel` | New persistent general expenses and reversal |
| `GET/POST /inventory/godowns`; `PATCH/DELETE /inventory/godowns/:id` | New godown CRUD |
| `GET /inventory/summary`; `GET /inventory/movements`; `POST /inventory/adjustments` | New quantity/location balances, movement register and inward/outward/transfer operations |
| `GET /items/:id/transactions` | New paginated sales/purchase item history |
| `PATCH /invoices/:id` | New atomic unpaid invoice edit / draft issue workflow |
| `POST /invoices`; `POST /invoices/:id/payments` | Atomic initial receipt, decimal totals, request IDs, credit checks, account links and serialized balance checks |
| `POST /invoices/:id/cancel`; `DELETE /invoices/:id` | Atomic stock reversal and safe financial guards; deletion retains history |
| `GET /invoices`; `GET /invoices/:id` | Credit-adjusted balances/status; creator projection excludes authentication fields |
| `POST /documents`; `PATCH /documents/:id/status`; `DELETE /documents/:id` | Decimal/tax mode, warehouses, physical-return semantics, stock/return validation and safe status transitions |
| `POST /documents/:id/payments` | Exact, account-linked, repeat-safe serialized purchase payments |
| `POST /documents/:id/convert-to-invoice` | Atomic reference-preserving conversion; challan dispatch does not double-deduct |
| `POST /documents/:id/convert-to-order`; `POST /documents/:id/convert-to-challan` | New quotation/order conversion targets |
| `POST /documents/:id/convert-to-proforma` | Atomic repeat-safe conversion |
| `POST /purchase-orders/:id/convert-to-bill` | New atomic conversion with stock inward once and preserved target reference |
| `POST /purchase-orders`; `PATCH /purchase-orders/:id/status` | Exact totals and converted-document restrictions |
| `GET /invoices/:id/pdf`; `GET /documents/:id/pdf` | Validated optional `mode=regular` or `mode=thermal`; defaults honor company print settings |
| Existing item/party/supplier mutations and party ledger | Safer validation, linked-record deletion guards, stock movements and exact credit-adjusted balances |

Added frontend paths: `/inventory`, `/inventory/godowns`, `/inventory/adjustments`, `/sales/orders/new`. Existing paths and production workflow remain. Empty favicon metadata avoids the automatic missing-icon request; no icon or branding was introduced.

## Database migrations

All six migration files are in the sibling backend `prisma/migrations`. **None has been applied.** Prisma schema validation and client generation passed. Actual migration execution, data compatibility and rollback rehearsal remain pending on a disposable database. There are no DROP/TRUNCATE/DELETE statements in the added migrations.

| Migration | Schema change |
| --- | --- |
| `20261031000100_preserve_line_tax_mode` | Defaulted inclusive/exclusive tax flags on invoice/document lines |
| `20261031000200_accounts_and_expenses` | CashAccount and Expense tables; nullable receipt/payout account relationships |
| `20261031000300_explicit_goods_returns` | Defaulted physical-return flag on documents |
| `20261031000400_godowns_and_stock_ledger` | Warehouse, WarehouseStock, StockMovement and StockOperation; nullable document/invoice godown; quantity precision widened |
| `20261031000500_document_order_conversions` | Item SALES_ORDER type; converted purchase-bill reference; PO tax mode; invoice line unit/HSN |
| `20261031000600_financial_request_ids` | Nullable scoped request IDs for new financial mutations and invoice edit replay tracking |

Generated Prisma client files in `node_modules` are build artifacts, not source changes. A running backend held the Windows engine DLL; client code was regenerated separately and installed after verifying the retained engine binary matched. No database command was substituted for client generation. The new schema-dependent code requires these migrations before deployment; it must not be treated as ready for the unmigrated remote database.

## Verification

| Check | Result / scope |
| --- | --- |
| Frontend TypeScript | Pass |
| Frontend ESLint | Pass, zero warnings |
| Frontend regression tests | 7 pass across 2 files |
| Frontend production build | Pass in an isolated build directory, preserving the existing development server output |
| Backend TypeScript compilation | Pass in isolated output |
| Backend Vitest | 93 pass across 15 files; service and transaction doubles, not a real database |
| Prisma schema validation / client generation | Pass; no migration execution |
| PDF generation | 5 pass: A4 portrait, A4 landscape, 58mm, 80mm with two copies, custom width; dimensions/page counts checked in generated PDFs |
| Browser rendering | 60 pass: 42 desktop routes, 9 tablet and 9 mobile checks; zero JavaScript/HTTP errors or global overflow. Synthetic API fixtures only, real mutations blocked |
| Live DB, migration execution and concurrency E2E | Pending by user instruction |
| Physical printers, email/WhatsApp delivery and provider integrations | Not exercised |

Financial operations use explicit Read Committed isolation plus row locks; reads after a lock wait must see the preceding committed balance rather than an earlier MySQL snapshot. Actual concurrent MySQL behavior remains untested.

Service regression coverage includes: exact/inclusive GST totals, discount/rounding, invoice create/edit/draft issue, stock once, rollback on insufficient stock, repeat receipt/creation/edit, cancellation once, paid reversal guard, credit ceiling, conversion once, physical-versus-financial returns, cumulative return limits, warehouse transfer conservation and insufficient-location rollback. Report tests cover cancelled/draft/future exclusion, returns and historical date charts. Preference tests cover workspace switching and delayed-response races.

PDFs and screenshots use synthetic data only, under ignored `.work/verification`. Scripts are `scripts/verify-print-output.mjs`, `scripts/verify-browser.mjs`, `scripts/inspect-reference.mjs` and `scripts/audit-functional-surface.mjs`. Browser rendering checks verify route load, JavaScript/resource errors and global responsive overflow; they do not replace interactive database E2E scenarios.

## Requested workflow checks

| Scenario | Verification performed | Pending |
| --- | --- | --- |
| 1. Party + item + sales invoice | Existing CRUD inspected; invoice lifecycle service tests; forms rendered | Real database CRUD journey |
| 2. Sale updates stock/balance once | Creation/replay/stock/receipt regression tests | Real concurrent MySQL transactions and dashboard refresh |
| 3. Purchase increases stock | Purchase posting/conversion service coverage | Database inward/valuation integration |
| 4. Partial payment | Exact credit-adjusted ceilings, account scoping and receipt tests | Live payment/register/ledger journey |
| 5. Quote conversion | Atomic source/target and replay regression tests | Database reference/stock/account reconciliation |
| 6. PDF/printing | Actual local Chrome PDFs and previews, five format cases | Physical printer behavior |
| 7. Settings impact | Calculation tests, company-specific preference loading and race regressions | Every setting on an authenticated database-backed workflow |
| 8. Cancel/reverse | Once-only stock reversal, paid restriction, return validation and rollback service tests | MySQL cancellation reconciliation |
| 9. Reports/filter/export | Decimal/date/status/return report tests, route rendering; existing CSV code inspected | Full exported ledger/GST reconciliation and remaining export formats |
| 10. Desktop/tablet/mobile | Synthetic-data rendering and root overflow checks | Interactive live workflows on devices |
| 11. Code/build/schema | TypeScript, ESLint, frontend build, backend compile/tests, Prisma validation | Migration execution on disposable MySQL |
| 12. Links/buttons/browser/API | Static route/control/endpoint inventory and browser rendering; no real mutations | Every conditional action, external integration and permission combination |

## Outstanding requirements and deployment boundary

This is a substantial implementation of the financial/inventory core, **not completion of every requirement in the master prompt**. Remaining requirements include the gaps in the comparison table: complete party classification/extra fields/statements, barcode/batch/secondary units, partial fulfillment/receipt allocation, advanced invoice charge/discount fields, refunds/advance payments and payment allocation, a double-entry accounting ledger with COGS P&L, comprehensive GST reports/reverse-charge posting, full import/backup/restore and Excel/PDF exports, and comprehensive operational settings coverage. The estimated report profit must not be used as an audited accounting profit.

Real migration/E2E scenarios must be performed on a disposable MySQL database before release, including simultaneous payments/stock updates, company/branch authorization, balances after cancellation and conversion, existing records, account encryption configuration, and migration compatibility. Native printing requires a separately configured bridge/driver; delivery services require the existing provider credentials and integration verification. No fake hardware integration or replacement backend was added.

## Modified and new files

Paths below are relative to each repository. These include application source, migrations, tests and verification documentation; ignored build/runtime/cache artifacts are excluded.

### frontend files

- `.gitignore`
- `docs/functional-surface-audit.json`
- `docs/functional-upgrade-audit.md`
- `docs/functional-upgrade-results.md`
- `docs/verification-results.json`
- `package.json`
- `scripts/audit-functional-surface.mjs`
- `scripts/inspect-reference.mjs`
- `scripts/verify-browser.mjs`
- `scripts/verify-print-output.mjs`
- `src/app/cash-banks/page.tsx`
- `src/app/dashboard/page.tsx`
- `src/app/documents/[id]/page.tsx`
- `src/app/documents/page.tsx`
- `src/app/inventory/adjustments/page.tsx`
- `src/app/inventory/godowns/page.tsx`
- `src/app/inventory/page.tsx`
- `src/app/invoices/[id]/page.tsx`
- `src/app/items/ItemWorkspace.tsx`
- `src/app/layout.tsx`
- `src/app/parties/PartyWorkspace.tsx`
- `src/app/purchases/expenses/page.tsx`
- `src/app/reports/page.tsx`
- `src/app/sales/orders/new/page.tsx`
- `src/app/sales/orders/page.tsx`
- `src/app/settings/(preferences)/print/page.tsx`
- `src/components/Sidebar.tsx`
- `src/components/accounting/AccountSelect.tsx`
- `src/components/accounting/GeneralExpenseRegister.tsx`
- `src/components/documents/DocumentActions.tsx`
- `src/components/documents/DocumentForm.tsx`
- `src/components/documents/documentTotals.ts`
- `src/components/inventory/InventoryWorkspace.tsx`
- `src/components/inventory/WarehouseSelect.tsx`
- `src/components/invoices/InvoiceForm.tsx`
- `src/components/invoices/invoiceTotals.ts`
- `src/components/purchases/PaymentOutRegister.tsx`
- `src/components/purchases/PurchaseOrderRegister.tsx`
- `src/components/sales/PaymentInRegister.tsx`
- `src/components/sales/SalesDocumentRegister.tsx`
- `src/components/sales/SalesOrdersWorkspace.tsx`
- `src/components/settings/PrintPreview.tsx`
- `src/components/settings/printSettingsTypes.ts`
- `src/lib/api.ts`
- `src/lib/billing.ts`
- `src/lib/business-report.ts`
- `src/lib/documents.ts`
- `src/lib/outstanding.ts`
- `src/lib/preferences.ts`
- `src/types/index.ts`
- `tests/billing.test.ts`
- `tests/preferences.test.ts`
- `tsconfig.json`

### backend files

- `prisma/migrations/20261031000100_preserve_line_tax_mode/migration.sql`
- `prisma/migrations/20261031000200_accounts_and_expenses/migration.sql`
- `prisma/migrations/20261031000300_explicit_goods_returns/migration.sql`
- `prisma/migrations/20261031000400_godowns_and_stock_ledger/migration.sql`
- `prisma/migrations/20261031000500_document_order_conversions/migration.sql`
- `prisma/migrations/20261031000600_financial_request_ids/migration.sql`
- `prisma/schema.prisma`
- `src/accounting/accounting.controller.ts`
- `src/accounting/accounting.dto.ts`
- `src/accounting/accounting.module.ts`
- `src/accounting/accounting.service.ts`
- `src/app.module.ts`
- `src/businesses/business-preferences.ts`
- `src/common/utils/billing-transaction.util.ts`
- `src/common/utils/billing.util.ts`
- `src/common/utils/party-balance.util.ts`
- `src/documents/documents.controller.ts`
- `src/documents/documents.module.ts`
- `src/documents/documents.service.ts`
- `src/documents/dto/create-document.dto.ts`
- `src/documents/dto/document-item.dto.ts`
- `src/documents/dto/record-purchase-payment.dto.ts`
- `src/documents/returns-integrity.spec.ts`
- `src/inventory/inventory-integrity.spec.ts`
- `src/inventory/inventory.controller.ts`
- `src/inventory/inventory.dto.ts`
- `src/inventory/inventory.module.ts`
- `src/inventory/inventory.service.ts`
- `src/invoices/billing-integrity.spec.ts`
- `src/invoices/dto/create-invoice.dto.ts`
- `src/invoices/dto/invoice-item.dto.ts`
- `src/invoices/dto/record-payment.dto.ts`
- `src/invoices/invoice-calc.util.ts`
- `src/invoices/invoice-lifecycle.spec.ts`
- `src/invoices/invoices.controller.ts`
- `src/invoices/invoices.service.ts`
- `src/items/dto/create-item.dto.ts`
- `src/items/items.controller.ts`
- `src/items/items.service.ts`
- `src/parties/dto/create-party.dto.ts`
- `src/parties/parties.service.ts`
- `src/pdf/pdf.service.spec.ts`
- `src/pdf/pdf.service.ts`
- `src/pdf/thermal-print.spec.ts`
- `src/purchase-orders/dto/create-purchase-order.dto.ts`
- `src/purchase-orders/purchase-orders.controller.ts`
- `src/purchase-orders/purchase-orders.module.ts`
- `src/purchase-orders/purchase-orders.service.ts`
- `src/suppliers/dto/create-supplier.dto.ts`
- `src/suppliers/suppliers.service.ts`
