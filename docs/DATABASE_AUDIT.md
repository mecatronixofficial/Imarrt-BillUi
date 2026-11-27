# Database Audit

MySQL via Prisma 6. 45 models, 16 enums, 44 migrations, 101 indexes/unique constraints (`prisma/schema.prisma` in `Imarrt-BillServer`). Method: schema and migration review, service transaction review, mocked-persistence tests. No query was run against production data except applying two owner-approved migrations.

## Findings

| Area | Status | Notes |
|---|---|---|
| Money precision | PASS | All amounts `DECIMAL(12,2)`; quantities `DECIMAL` with 3 places; calculations use scaled BigInt (`billing.util.ts`), never floats. |
| Atomic posting | PASS | Invoice/document save, stock, payments and conversions run in one transaction (`billingTransaction`, READ COMMITTED, retried on deadlock `P2034`). |
| Concurrency | PASS (design) / NOT TESTED (live) | `SELECT … FOR UPDATE` on branch, invoice, party, account and (new) company numbering rows. Lock order: branch → document/invoice → party → company. Not load-tested on MySQL. |
| Idempotency keys | PASS | `@@unique([branchId, requestId])` on invoices, documents, receipts; `@@unique([invoiceId, requestId])` on payments. |
| Number uniqueness | PASS (after fixes) | `@@unique([branchId, invoiceNumber])`, `@@unique([branchId, documentNumber])`; company-wide invoice uniqueness enforced in code under lock (see limitation below). |
| Soft delete | PASS | Financial records use `deletedAt`; numbers are never reused (deleted ones are counted). |
| Business isolation | PASS (design) | `businessId` (+ `branchId`) on every operational table; indexes lead with `businessId`. |
| Foreign keys | PASS | `onDelete: Restrict` on financial links (accounts, warehouses); cascades limited to child rows (items of a document, sequences of a company). |
| Indexes | PASS | Composite indexes for register queries (`businessId, branchId, createdAt`), party ledgers (`partyId, issueDate`), stock (`itemId, warehouseId`); new `invoices(businessId, invoiceNumber)`. |
| Audit history | PARTIAL | `audit_logs` written for create/update/delete/payment events; no viewer (OPEN-07). |
| Backups | MISSING (app) | No backup/restore tooling or documented procedure in the repos; rely on the database host's backups (verify on Aiven). |

## Migrations added in this engagement

| Migration | Change | Data impact | Applied to configured DB |
|---|---|---|---|
| `20261127120000_company_invoice_numbering` | New table `invoice_number_sequences`; index `invoices(businessId, invoiceNumber)`. | None. | Yes (owner-approved). |
| `20261127150000_round_off_by_default` | Columns `invoices.roundOff`, `business_documents.roundOff`; back-fill `true` where saved grand total ≠ subtotal + tax − discount; set `transaction.autoRoundOff = true` in company preferences that had it `false`. | No amounts or numbers changed; company Round-off setting switched on. | Yes (owner-approved). |

Both migrations are additive and safe to re-run on a fresh database (`prisma migrate deploy`). They have **not yet been run on a separate staging database**; do so before the next production deploy.

## Limitations / recommendations

1. **Company-wide invoice-number uniqueness** is not a database constraint because existing rows may already contain the same number in two branches of one company. Run this check on production; if it returns no rows, add `@@unique([businessId, invoiceNumber])`:
   ```sql
   SELECT businessId, invoiceNumber, COUNT(*) FROM invoices GROUP BY businessId, invoiceNumber HAVING COUNT(*) > 1;
   ```
2. **Backups:** confirm point-in-time recovery on the Aiven service and document a restore drill (see `PRODUCTION_CHECKLIST.md`).
3. **Large tables:** list endpoints return arrays without totals; reporting reads everything into the browser (OPEN-04). Add server aggregates before data grows.
