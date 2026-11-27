# Feature Matrix

Status meanings:
- **PASS** — exercised by an automated test that passed in this engagement (`TEST_RESULTS.md`). Unless stated, these tests run service/calculation logic against **mocked persistence**.
- **FAIL** — verified incorrect and not fixed.
- **PARTIAL** — present but incomplete.
- **MISSING** — not present.
- **NOT TESTED** — present in code but not verified by an automated or browser test in this engagement.

Every module has one criterion "End-to-end in browser on a real database". It is NOT TESTED everywhere because the staging database URL had not been provided (see `TEST_CASES.md` → pending E2E suite). **Completion % = PASS criteria ÷ all criteria listed for the module.** It measures verified acceptance, not how much code exists.

| Module | Criterion | Status | Evidence |
|---|---|---|---|
| **Dashboard** | Figures computed from real records (no hard-coded values) | PASS | `tests/dashboard.test.ts`; code scan found no dummy data |
| | Scales to large data (server-side aggregation) | PARTIAL | Downloads all records (OPEN-04) |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Companies & branches** | Company preference validation | PASS | `business-preferences.spec.ts` |
| | Workspace group summary | PASS | `group-summary.service.spec.ts` |
| | Business-level data isolation (membership guard) | NOT TESTED | Code-reviewed (`business.guard.ts`, `branch.guard.ts`); no automated test |
| | Create / edit / deactivate company | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Customers & suppliers** | Unique party / group codes | PASS | `tests/codes.test.ts`, `party-groups.spec.ts` |
| | Party dashboard and balances | PASS | `tests/party-dashboard.test.ts`, `tests/counterparty-dashboard.test.ts` |
| | Customer / supplier CRUD | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Items, categories, units** | Tracking fields (serial, lot, barcode, MRP, brand, count) | PASS | `tracking-fields.spec.ts` |
| | Item CRUD and categories | NOT TESTED | |
| | Units master | MISSING | Fixed unit list in forms |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Inventory** | Stock decremented on sale, restored on edit / rollback | PASS | `invoice-lifecycle.spec.ts`, `billing-integrity.spec.ts` |
| | Negative-stock prevention | PASS | `invoice-lifecycle.spec.ts` |
| | Godown stock and adjustments | PASS | `inventory-integrity.spec.ts` |
| | Stock valuation method | PARTIAL | Current purchase price only (OPEN-09) |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Sale invoice** | Draft / issue / edit lifecycle | PASS | `invoice-lifecycle.spec.ts` |
| | Idempotent retry (no duplicate invoice / stock / audit) | PASS | `invoice-lifecycle.spec.ts` |
| | Company-wise numbering, prefix, digits | PASS | `invoice-numbering.spec.ts`, `invoice-lifecycle.spec.ts`, `tests/invoice-numbering.test.ts` |
| | Totals: qty × price, tax incl./excl., round-off once | PASS | `invoice-calc.util.spec.ts`, `tests/billing.test.ts`, `tests/navigation-roundoff.test.ts` |
| | Tax for every company (typed rate) | PASS | `invoice-lifecycle.spec.ts` |
| | Invoice-level discount reduces taxable value | FAIL | OPEN-01 |
| | Item-level discount | MISSING | |
| | PDF tax breakup and place of supply | PASS | `pdf.service.spec.ts` |
| | Share by WhatsApp / email | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Quotation / estimate** | Numbering (no collisions) | PASS | `document-numbering.spec.ts` |
| | Edit in place | PASS | `document-edit.spec.ts` |
| | Convert and reverse conversion exactly once | PASS | `conversion-reversal.spec.ts` |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Proforma invoice** | Convert / reverse | PASS | `conversion-reversal.spec.ts` |
| | Numbering | PASS | shared numbering code, `document-numbering.spec.ts` |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Sales order** | Allowed conversions | PASS | `tests/document-conversion.test.ts` |
| | Numbering | PASS | shared numbering code |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Delivery challan** | Allowed conversions | PASS | `tests/document-conversion.test.ts` |
| | Stock movement on challan | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Credit note / sales return** | Return limits, stock and invoice adjustments | PASS | `returns-integrity.spec.ts` |
| | Reduces party balance and invoice outstanding | PASS | `invoice-payments.spec.ts`, `returns-integrity.spec.ts` |
| | Refund to customer | MISSING | OPEN-03 |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Purchase bill** | Create / edit | PASS | `document-edit.spec.ts` |
| | Register filters | PASS | `purchase-bill-register.spec.ts` |
| | Payment allocation and void | PASS | `payment-out.service.spec.ts` |
| | Stock increment on bill | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Purchase order** | Create, convert to bill once, round-off stored | PASS | `purchase-orders.service.spec.ts` |
| | Numbering | NOT TESTED | Code-reviewed (highest-number based) |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Debit note / purchase return** | Return limits | PASS | `returns-integrity.spec.ts` |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Payment in** | Partial and full payment, overpayment blocked | PASS | `invoice-payments.spec.ts` |
| | Edit / delete payment | PASS | `payment-edit.spec.ts` |
| | Payment date and time kept | PASS | `tests/payment-date.test.ts`, `invoice-lifecycle.spec.ts` |
| | Customer advance (unallocated receipt) | MISSING | OPEN-02 |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Payment out** | Allocation, receipts, void | PASS | `payment-out.service.spec.ts` |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Cash & bank** | Ledger ordering and running balance | PASS | `ledger-order.spec.ts`, `tests/cash-ledger.test.ts` |
| | Finance entries (income, adjustments, loans) | PASS | `finance-entries.spec.ts`, `finance.service.spec.ts` |
| | Cheques | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Expenses** | Categories rename / delete / move | PASS | `expense-categories.spec.ts` |
| | Expense CRUD | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Party ledger** | Balance = opening + billed − received − credit notes | PASS | `tests/party-dashboard.test.ts` |
| | Party statement report | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **GST & taxation** | Tax-inclusive / exclusive maths | PASS | `invoice-calc.util.spec.ts`, `tests/gst-summary.test.ts` |
| | CGST+SGST vs IGST by place of supply | PASS | `gst-states.spec.ts`, `pdf.service.spec.ts`, `tests/gst-summary.test.ts` |
| | GST summary (output, ITC, net payable) | PASS | `tests/gst-summary.test.ts` |
| | Tax for non-GST companies | PASS | `invoice-lifecycle.spec.ts` |
| | Discount reduces taxable value | FAIL | OPEN-01 |
| | TCS / TDS | MISSING | Marked unavailable in Settings |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Reports & analytics** | Transaction report service | PASS | `reports.service.spec.ts` |
| | GST summary and HSN maths decimal-safe | PASS | `tests/gst-summary.test.ts` |
| | Accrual P&L (cost of goods sold) | PARTIAL | OPEN-09 |
| | Server-side aggregation | PARTIAL | OPEN-04 |
| | CSV / print match selected filters | NOT TESTED | Shared table code-reviewed |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Invoice settings & templates** | Regular PDF builder | PASS | `pdf.service.spec.ts` |
| | Thermal print | PASS | `thermal-print.spec.ts` |
| | Amount in words | PASS | `amount-words.spec.ts` |
| | Invoice prefix setting | PASS | `business-preferences.spec.ts` |
| | Print preview in Settings | NOT TESTED | |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Users & permissions** | Team rules (staff / accountant only, removal) | PASS | `users.service.spec.ts` |
| | Role guard per endpoint | NOT TESTED | No automated test |
| | Roles per company | PARTIAL | OPEN-08 |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Security / auth** | MFA guard, TOTP, password hashing | PASS | `mfa.guard.spec.ts`, `totp.util.spec.ts`, `password.util.spec.ts` |
| | Action passcode | PASS | `action-security.spec.ts`, `tests/action-passcode.test.ts` |
| | Per-account login lockout | MISSING | OPEN-05 |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Global navigation & behaviour** | Origin-aware Back with module fallback | PASS | `tests/navigation-roundoff.test.ts` |
| | Round Off on by default | PASS | `tests/navigation-roundoff.test.ts`, `invoice-lifecycle.spec.ts` |
| | Unsaved-changes dialog | NOT TESTED | Not exercised in a browser |
| | Filters / tab restored on Back | NOT TESTED | |
| **Production** | Pipeline and summary calculations | PASS | `production-pipeline.util.spec.ts`, `production-summary.util.spec.ts` |
| | Production dashboard / master | PASS | `tests/production-dashboard.test.ts`, `tests/production-master.test.ts` |
| | End-to-end in browser on real DB | NOT TESTED | |
| **Notifications** | In-app notifications | MISSING | |
| | Invoice delivery (email / WhatsApp) | NOT TESTED | `invoice-delivery.service.ts` exists |
| **Backup** | Backup / restore tooling or procedure | MISSING | Relies on the database host |
| **Audit logs** | Audit records written | NOT TESTED | Calls present across services |
| | Audit-log viewer | MISSING | |

## Completion by module

| Module | PASS / criteria | Completion |
|---|---|---|
| Dashboard | 1 / 3 | 33% |
| Companies & branches | 2 / 5 | 40% |
| Customers & suppliers | 2 / 4 | 50% |
| Items, categories, units | 1 / 4 | 25% |
| Inventory | 3 / 5 | 60% |
| Sale invoice | 6 / 10 | 60% |
| Quotation / estimate | 3 / 4 | 75% |
| Proforma invoice | 2 / 3 | 67% |
| Sales order | 2 / 3 | 67% |
| Delivery challan | 1 / 3 | 33% |
| Credit note / sales return | 2 / 4 | 50% |
| Purchase bill | 3 / 5 | 60% |
| Purchase order | 1 / 3 | 33% |
| Debit note / purchase return | 1 / 2 | 50% |
| Payment in | 3 / 5 | 60% |
| Payment out | 1 / 2 | 50% |
| Cash & bank | 2 / 4 | 50% |
| Expenses | 1 / 3 | 33% |
| Party ledger | 1 / 3 | 33% |
| GST & taxation | 4 / 7 | 57% |
| Reports & analytics | 2 / 6 | 33% |
| Invoice settings & templates | 4 / 6 | 67% |
| Users & permissions | 1 / 4 | 25% |
| Security / auth | 2 / 4 | 50% |
| Global navigation & behaviour | 2 / 4 | 50% |
| Production | 2 / 3 | 67% |
| Notifications | 0 / 2 | 0% |
| Backup | 0 / 1 | 0% |
| Audit logs | 0 / 2 | 0% |

Most of the gap is the shared "end-to-end on a real database" criterion. Running the pending E2E suite against the staging database is the single largest step towards higher verified completion.
