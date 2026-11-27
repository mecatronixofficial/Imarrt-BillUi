# Bug Report

Each entry records module/page, problem, severity, root cause, affected files, solution, test case, actual result and remaining limitations. Backend paths are in `Imarrt-BillServer`; frontend paths in `Imarrt-BillUi`. "Unit" tests run against mocked persistence (see `TEST_RESULTS.md`).

---

## Fixed

### BUG-01 — Document numbering collision blocks new documents
- **Module / page:** Quotation, Proforma, Sales order, Delivery challan, Credit note, Purchase bill, Debit note (all `BusinessDocument` types) — create screens.
- **Severity:** High
- **Problem:** After a document's issue date was edited into another year (or in other count/number mismatches), the next new document of that type and year was given a number that already existed. The unique constraint `(branchId, documentNumber)` rejected it, and every further attempt produced the same number, so no new document of that type/year could be saved.
- **Root cause:** The next number was "count of this year's documents by issue date + 1", but the stored number never changes when the date is edited.
- **Affected files:** `src/documents/documents.service.ts`
- **Solution:** Next number = highest number already used for that type and year in the branch (soft-deleted included) + 1, under the existing branch row lock.
- **Test case:** `src/documents/document-numbering.spec.ts` — continues after highest number; does not reuse a number when a document was moved to another year or deleted.
- **Actual result:** PASS (2/2). The regression test was also run against the old logic and **failed**, confirming it detects the bug.
- **Limitations:** Not run against a real MySQL database yet (staging DB pending).

### BUG-02 — GST breakup ignores place of supply
- **Module / page:** Sale invoice and document PDFs / print — tax breakup table.
- **Severity:** High
- **Problem:** Inter-state supply was decided only from the buyer's GSTIN. A buyer without a GSTIN in another state (place of supply set to that state) was shown CGST + SGST instead of IGST. A registered buyer whose place of supply was the seller's state was shown IGST.
- **Root cause:** `taxBreakup()` compared seller state with `party.gstin` only; `placeOfSupply` was not part of the print model.
- **Affected files:** `src/pdf/pdf.service.ts`, new `src/common/utils/gst-states.ts`
- **Solution:** New GST state-code table and `isInterStateSupply()` rule: place of supply first, buyer GSTIN as fallback, intra-state when unknown. Print model now carries `placeOfSupply`.
- **Test case:** `src/common/utils/gst-states.spec.ts` (state codes, GSTIN parsing, rule); `src/pdf/pdf.service.spec.ts` "uses the place of supply for an unregistered buyer in another state".
- **Actual result:** PASS.
- **Limitations:** Place of supply is optional on the form; when it is empty and the buyer has no GSTIN the supply is treated as intra-state.

### BUG-03 — Invoice numbering not company-wise and race-prone
- **Module / page:** Sale invoice — create / company switch.
- **Severity:** High
- **Problem:** Numbers were per branch (`BRANCH-INV-YYYY-n`) from `count()+1`; concurrent saves and manual numbers could collide; there was no company-wise sequence or configurable prefix; duplicates were checked per branch only.
- **Root cause:** Count-based numbering; no sequence table.
- **Affected files:** backend `src/invoices/invoice-numbering.ts` (new), `src/invoices/invoices.service.ts`, `src/invoices/invoices.controller.ts`, `src/businesses/business-preferences.ts`, `prisma/schema.prisma`, migration `20261127120000_company_invoice_numbering`; frontend `src/components/invoices/InvoiceForm.tsx`, `src/app/settings/(preferences)/transaction/page.tsx`, `src/lib/invoiceNumbering.ts`.
- **Solution:** `invoice_number_sequences` table (one counter per company + prefix), allocated on save inside the transaction while the company row is locked; configurable prefix with `{YYYY}`, `{YY}`, `{FY}` and digit count; company-wide duplicate check; preview refreshes on company/date change; saved numbers never change.
- **Test case:** `invoice-numbering.spec.ts`, `invoice-lifecycle.spec.ts` ("company-wise invoice numbering", "invoice number digits"), frontend `tests/invoice-numbering.test.ts`.
- **Actual result:** PASS.
- **Limitations:** No database unique constraint on `(businessId, invoiceNumber)` because existing data may already contain cross-branch duplicates; enforced by the lock in code. Concurrency not yet tested on a real database.

### BUG-04 — Non-GST companies could not charge tax
- **Module / page:** Sale invoice, sale documents, purchase order — Tax column / "Tax for all items".
- **Severity:** High (owner requirement)
- **Problem:** Tax was hidden and forced to 0 for companies not registered for GST; rates limited to a fixed dropdown.
- **Root cause:** `gstRegistered` gate in forms, totals calculator, backend services and PDF.
- **Affected files:** backend `invoices.service.ts`, `documents.service.ts`, `pdf.service.ts`; frontend `InvoiceForm.tsx`, `DocumentForm.tsx`, `PurchaseOrderForm.tsx`, `invoiceTotals.ts`, `documentTotals.ts`, `transactions/EditorParts.tsx` (`TaxPercentInput`).
- **Solution:** Gate removed (composition scheme still removes tax on sales); typed percentage input 0–100 with 2 decimals.
- **Test case:** `invoice-lifecycle.spec.ts` "charges the typed tax rate even when the company is not GST-registered".
- **Actual result:** PASS.
- **Limitations:** Sale documents and purchase orders have only a "Tax for all items" control (no per-line tax column).

### BUG-05 — Round-off not stored; edits could change totals
- **Module / page:** All billing forms.
- **Severity:** Medium
- **Problem:** The Round Off choice of a saved invoice/document was not stored; editing used the company default, so a saved total could change on edit. Default was unchecked.
- **Root cause:** No `roundOff` column on `invoices` / `business_documents`.
- **Affected files:** `prisma/schema.prisma`, migration `20261127150000_round_off_by_default`, `invoices.service.ts`, `documents.service.ts`, `business-preferences.ts`; frontend `InvoiceForm.tsx`, `DocumentForm.tsx`, `invoiceTotals.ts`, `preferences.ts`, `types/index.ts`.
- **Solution:** Stored flag (back-filled from saved totals), default on, edit keeps saved choice, conversions carry it, form always sends the on-screen choice.
- **Test case:** `invoice-lifecycle.spec.ts` "round off" (4 cases); `tests/navigation-roundoff.test.ts`.
- **Actual result:** PASS.
- **Limitations:** The migration switched Round off on for companies that had it saved off (owner-approved).

### BUG-06 — Invoice PDF missing place of supply
- **Module / page:** Sale invoice PDF / print.
- **Severity:** Medium
- **Root cause:** Invoice print model passed an empty details list; `PdfInvoice` type had no `placeOfSupply`.
- **Affected files:** `src/pdf/pdf.service.ts`
- **Solution:** Place of supply row added to the invoice details, as on documents.
- **Test case:** Covered indirectly by `pdf.service.spec.ts` model tests; no HTML assertion for this row.
- **Actual result:** PASS (type-check + existing PDF tests); visual PDF output NOT TESTED.

### BUG-07 — Detail pages totals did not add up
- **Module / page:** `/invoices/[id]`, `/documents/[id]`, `/purchases/orders/[id]`.
- **Severity:** Medium
- **Root cause:** No Round-off row (PDF had one).
- **Affected files:** the three detail pages; `invoiceTotals.ts` (`roundOffAmount`).
- **Solution:** Shared `roundOffAmount()` using the same rule as the PDF.
- **Test case:** `tests/navigation-roundoff.test.ts`.
- **Actual result:** PASS (helper); page rendering NOT TESTED in a browser with real data.

### BUG-08 — HSN summary used floating-point tax maths
- **Module / page:** Reports → GST reports → Sale Summary By HSN.
- **Severity:** Medium
- **Root cause:** Tax computed with `value - value/(1+rate)` and `qty*price*rate/100` floats.
- **Affected files:** `src/components/ReferenceReports.tsx`
- **Solution:** Uses the same decimal-safe `computeBilling` as invoices.
- **Test case:** Same helper is covered by `tests/gst-summary.test.ts` and `tests/billing.test.ts`.
- **Actual result:** PASS (type-check, lint, helper tests).
- **Limitations:** HSN summary does not net off credit notes (OPEN-12).

### BUG-09 — Hard-coded Back navigation; no unsaved-changes guard
- **Module / page:** Whole app (toolbar, editors, detail pages, settings).
- **Severity:** Medium
- **Root cause:** Fixed `router.push('/…')` destinations; no history model; no dirty tracking.
- **Affected files:** new `src/lib/navigation.tsx`; `BackButton.tsx`, `AppFrame.tsx`, `ConfirmDialog.tsx`, `InvoiceModal.tsx`, `DocumentModal.tsx`, `DocumentCreatePage.tsx`, the three editors, detail pages, item/party/production workspaces, 19 list components (`usePageState`).
- **Solution:** History-aware Back with module fallbacks, scroll restore, per-entry filter state, unsaved-changes dialog, replace-on-save.
- **Test case:** `tests/navigation-roundoff.test.ts` (fallback routes).
- **Actual result:** PASS (unit); interactive navigation NOT TESTED in a browser end-to-end.
- **Limitations:** OPEN-11; filters are not restored after a full page refresh.

### BUG-10 — Sale invoice item table layout
- **Module / page:** `/invoices/new`.
- **Severity:** Medium
- **Root cause:** Table `min-width: 1480px`, widths by column position, footer buttons wrapping, inner vertical scrollbar.
- **Affected files:** `InvoiceForm.tsx`, `transactions/TransactionEditor.module.css`.
- **Solution:** Explicit column widths, pinned #/Item/Amount, single-line footer, no inner scrollbar.
- **Test case:** Browser screenshots at 1280, 1920, 768 and 390 px with mocked API.
- **Actual result:** PASS (measured: no inner vertical scroll, no page overflow, footer buttons 30 px).

---

## Open

| ID | Module | Severity | Problem | Root cause | Recommended solution |
|---|---|---|---|---|---|
| OPEN-01 | All billing forms | High | Invoice-level discount is applied after tax, so taxable value and GST are not reduced by the discount. | `computeBilling`: total = subtotal + tax − discount. | Product decision: treat bill discount as pre-tax (pro-rate to lines before tax) and/or add item-level discount; needs a versioned calculation so saved invoices keep their totals. |
| OPEN-02 | Payment in | Medium | No customer advance / on-account receipt. | `PaymentRecord.invoiceId` is required. | Add unallocated receipts + allocation table. |
| OPEN-03 | Credit note | Medium | Refund to customer cannot be recorded as money out. | No refund flow. | Refund payment linked to credit note and cash account. |
| OPEN-04 | Dashboard, Reports | Medium | All records are downloaded and aggregated in the browser. | Client-side reporting. | Server-side aggregate endpoints with date filters. |
| OPEN-05 | Auth | Medium | No per-account lockout after failed logins (IP rate limit 5/min only). | Not implemented. | Failed-attempt counter + temporary lock per user. |
| OPEN-06 | Attachments | Medium | Upload type is trusted from the declared MIME type. | No content signature check. | Validate magic bytes for images/PDF/Office files. |
| OPEN-07 | Several | Medium | Missing: audit-log viewer, backup/restore tooling, units master, item-level discount, TCS/TDS. | Not built. | See `FEATURE_MATRIX.md`. |
| OPEN-08 | Team | Low | Role is global per user, not per company. | `User.role`; `BusinessMember` has no role. | Move role to membership if users will hold different roles per company. |
| OPEN-09 | Reports | Low | P&L is cash-basis; stock valued at current purchase price. | Report design. | COGS from stock movements; weighted-average valuation. |
| OPEN-10 | PDF | Low | Breakup sums unrounded line tax while stored tax total may be rounded. | `roundOffTax` applies to total only. | Show a rounding line or distribute rounding. |
| OPEN-11 | Navigation | Low | Browser Back button not guarded for unsaved changes. | App Router cannot block popstate reliably. | Accept, or add a history guard entry while dirty. |
| OPEN-12 | Reports | Low | HSN summary excludes credit notes. | Report design. | Net returns per HSN. |
