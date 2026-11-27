# Test Cases

Three groups: (A) automated tests added in this engagement, (B) the existing automated suites they run alongside, and (C) database-backed and browser end-to-end cases that are **pending** the staging database.

## A. Automated tests added in this engagement

| ID | Area | Case | Expected | File |
|---|---|---|---|---|
| TC-NUM-01 | Invoice numbering | Preview then two saves in one company | `INV-01`, `INV-02`; preview then `INV-03` | `invoice-lifecycle.spec.ts` |
| TC-NUM-02 | Invoice numbering | Prefix `SV/{FY}/`, date 2027-02-10; edit with another number while auto | `SV/26-27/01`; number unchanged on edit | `invoice-lifecycle.spec.ts` |
| TC-NUM-03 | Invoice numbering | Legacy `MAIN-INV-07` and manual `INV-08` exist | Next is `INV-09` | `invoice-lifecycle.spec.ts` |
| TC-NUM-04 | Invoice numbering | Manual number already used in the company | Rejected, nothing saved | `invoice-lifecycle.spec.ts` |
| TC-NUM-05 | Invoice numbering | 3 digits with `INV-999` existing | `INV-1000` | `invoice-lifecycle.spec.ts` |
| TC-NUM-06 | Invoice numbering | Prefix tokens, padding, validation, legacy parsing | As specified | `invoice-numbering.spec.ts`, `tests/invoice-numbering.test.ts` |
| TC-DOC-01 | Document numbering | Continue after highest number; new year restarts | `QUO-2026-000003`, `QUO-2027-000001` | `document-numbering.spec.ts` |
| TC-DOC-02 | Document numbering | A 2026 document re-dated to 2027 and one deleted | `QUO-2026-000004`, then `…05` (old logic collided) | `document-numbering.spec.ts` |
| TC-TAX-01 | Tax | Non-GST company, 12.5% on ₹100, round-off off | Tax 12.50, total 112.50 | `invoice-lifecycle.spec.ts` |
| TC-RO-01 | Round-off | Default on, ₹112.50 | Total 113, flag stored, subtotal + tax 112.50 | `invoice-lifecycle.spec.ts` |
| TC-RO-02 | Round-off | Turned off | Total 112.50 | `invoice-lifecycle.spec.ts` |
| TC-RO-03 | Round-off | Edit without sending the flag; then edit with it on | Keeps 112.50; then 113 | `invoice-lifecycle.spec.ts` |
| TC-RO-04 | Round-off | Company default off | 112.50 | `invoice-lifecycle.spec.ts` |
| TC-RO-05 | Round-off | Charges + discount, saved-record inference, adjustment sign | 120 with 0.40; −0.40 / 0.50 / 0 | `tests/navigation-roundoff.test.ts` |
| TC-NAV-01 | Navigation | Fallback route per module (12 routes) | Nearest existing parent | `tests/navigation-roundoff.test.ts` |
| TC-GST-01 | GST rule | State names, codes, `29-Karnataka`, GSTIN prefix | Correct codes; unknown → null | `gst-states.spec.ts`, `tests/gst-summary.test.ts` |
| TC-GST-02 | GST rule | Unregistered buyer, place of supply Karnataka, seller 27 | IGST 18% only | `pdf.service.spec.ts` |
| TC-GST-03 | GST rule | Registered buyer from 29, place of supply = seller state | CGST 9% + SGST 9% | `pdf.service.spec.ts` |
| TC-GST-04 | GST summary | Local and inter-state sales; draft and cancelled ignored | Taxable 1200, CGST 18, SGST 18, IGST 180 | `tests/gst-summary.test.ts` |
| TC-GST-05 | GST summary | Credit note, local and inter-state purchase, debit note, quotation, draft bill | Output 900/54/54/0; input 500/24/24/5; net 400/30/30/−5 | `tests/gst-summary.test.ts` |
| TC-GST-06 | GST summary | Tax-inclusive 118 @18%, 10.01 @5%, odd paise 0.30 @5% | 100 + 9 + 9; 10.01 + 0.25 + 0.25; 0.01 + 0.01 | `tests/gst-summary.test.ts` |
| TC-UI-01 | Invoice editor layout | Render at 1280, 1920, 768, 390 px (mocked API) | No inner vertical scroll, no page overflow, footer buttons one line, pinned columns | Screenshot script (scratchpad) |

## B. Existing automated suites (run in full)

Backend (Vitest, 37 files): billing integrity, invoice lifecycle and payments, payment edit, returns integrity, conversion reversal, document edit, purchase bill register, purchase orders, payment out, inventory integrity, finance entries, ledger order, expense categories, reports, users, party groups, workspace group summary, business preferences, PDF (regular, thermal, amount in words, browser executable), MFA guard, TOTP, password, action security, tracking fields, production pipeline and summary, Prisma service, health controller.

Frontend (Bun, 15 files): action passcode, billing maths, cash ledger, codes, counterparty dashboard, dashboard, document conversion, GST summary, invoice numbering, navigation / round-off, party dashboard, payment date, preferences, production dashboard, production master.

## C. Pending — needs the staging database (NOT TESTED)

To run with Playwright (browser) and Supertest (API) against a disposable staging database seeded with synthetic data. None of these may run against production.

| ID | Workflow | Steps | Expected |
|---|---|---|---|
| E2E-01 | Sales flow | Customer → Quotation → Sales order → Delivery challan → Sale invoice → Payment → Party ledger | Each conversion happens once; stock moves once; ledger balance = invoice − payment |
| E2E-02 | Purchase flow | Supplier → Purchase order → Purchase bill → stock → Payment out → Supplier ledger | Stock increases once; supplier balance cleared |
| E2E-03 | Sales return | Sale invoice → partial return → Credit note | Stock restored for returned qty; outstanding reduced; return limited to sold qty |
| E2E-04 | Purchase return | Purchase bill → Debit note | Stock reduced; supplier balance reduced |
| E2E-05 | Expense | Expense paid from bank | Bank balance and P&L updated |
| E2E-06 | Concurrency | 10 parallel invoice saves in two branches of one company | 10 distinct consecutive numbers, no errors |
| E2E-07 | Idempotency | Same `requestId` posted twice | One invoice, one stock movement |
| E2E-08 | Isolation | User of company A requests company B's invoice, party, item, report | 403 / 404, no data |
| E2E-09 | Roles | Staff attempts owner-only delete | 403 |
| E2E-10 | Navigation | Dashboard → New invoice → Back; Sales list (filtered) → New invoice → Back | Returns to origin with filters |
| E2E-11 | Unsaved changes | Edit invoice, click Back | Dialog; Stay keeps data; Discard leaves |
| E2E-12 | Round-off | New invoice → total with paise → toggle → save → reopen | Checked by default; saved total and PDF match |
| E2E-13 | GST PDF | Inter-state unregistered customer | IGST on PDF; place of supply printed |
| E2E-14 | Reports | GST Summary and CSV export for a month | Export matches screen and source invoices |
| E2E-15 | Uploads | Upload renamed `.exe` as `.png` | Rejected once OPEN-06 is fixed (currently accepted) |
| E2E-16 | Migrations | `prisma migrate deploy` on an empty staging DB | All 44 migrations apply cleanly |
