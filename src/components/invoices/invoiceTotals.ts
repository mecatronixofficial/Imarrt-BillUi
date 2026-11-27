import type { TrackingFields } from '@/lib/tracking';
import { computeBilling, scaled, unscaled } from '@/lib/billing';
export type InvoiceDraftLine = TrackingFields & { key: string; itemId?: string; unit?: string; hsnSac?: string; description: string; quantity: number; unitPrice: number; taxRate: number; taxInclusive?: boolean };
export type TotalsOptions = { roundOff?: boolean; roundTax?: boolean; noTax?: boolean };
export function totalsOptionsFor(transaction: { autoRoundOff: boolean }, taxes: { roundOffTax: boolean; compositionScheme: boolean }, sales = true): TotalsOptions {
  return { roundOff: transaction.autoRoundOff, roundTax: taxes.roundOffTax, noTax: sales && taxes.compositionScheme };
}
/** `taxAllowed` defaults to true: every company (GST-registered or not) can charge the typed tax rate. */
export function calculateInvoice(drafts: InvoiceDraftLine[] = [], discount = 0, taxAllowed = true, options: TotalsOptions = {}) {
  const safe = (Array.isArray(drafts) ? drafts : []).map((line) => ({ ...line,
    active: Boolean(line.description?.trim() || line.itemId || line.unitPrice),
    quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
    taxRate: Number.isFinite(line.taxRate) && taxAllowed ? line.taxRate : 0,
  }));
  const result = computeBilling(safe.map((line) => ({ ...line, quantity: line.active ? line.quantity : 0 })), Number.isFinite(discount) ? discount : 0, options);
  return { ...result, subtotal: result.subTotal, tax: result.taxTotal, total: result.grandTotal,
    lines: result.lines.map((line, i) => ({ subtotal: line.lineSubTotal, tax: line.lineTax, total: line.lineTotal, active: safe[i].active })),
    count: safe.filter((line) => line.active).length,
    quantity: unscaled(safe.reduce((sum, line) => sum + (line.active ? scaled(line.quantity, 3) : 0n), 0n), 3),
  };
}

/**
 * Whether a saved invoice or document was rounded off. Uses the stored flag; for records saved before it
 * existed, a grand total that differs from subtotal + tax − discount means it was rounded (as on the PDF).
 */
export function savedRoundOff(record: { roundOff?: boolean | null; subTotal: string | number; taxTotal: string | number; discount: string | number; grandTotal: string | number }) {
  if (typeof record.roundOff === 'boolean') return record.roundOff;
  const exact = Number(record.subTotal) + Number(record.taxTotal) - Number(record.discount);
  return Math.abs(Number(record.grandTotal) - exact) >= 0.005;
}

/** The saved round-off adjustment (grand total − (subtotal + tax − discount)), 0 when the total was not rounded. Same rule as the PDF. */
export function roundOffAmount(record: { subTotal: string | number; taxTotal: string | number; discount: string | number; grandTotal: string | number }) {
  const amount = Math.round((Number(record.grandTotal) - (Number(record.subTotal) + Number(record.taxTotal) - Number(record.discount))) * 100) / 100;
  return Math.abs(amount) >= 0.005 ? amount : 0;
}
