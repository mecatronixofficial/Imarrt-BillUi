import { calculateInvoice, type InvoiceDraftLine, type TotalsOptions } from '../invoices/invoiceTotals';
export type DocumentDraftLine = InvoiceDraftLine & { hsnSac: string; unit: string };
export function calculateDocument(drafts: DocumentDraftLine[] = [], discount = 0, gstRegistered = true, options: TotalsOptions = {}) {
  return calculateInvoice(drafts, discount, gstRegistered, options);
}
