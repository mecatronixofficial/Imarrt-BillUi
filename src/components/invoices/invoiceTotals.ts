import type { TrackingFields } from '@/lib/tracking';
import { computeBilling, scaled, unscaled } from '@/lib/billing';
export type InvoiceDraftLine = TrackingFields & { key: string; itemId?: string; unit?: string; hsnSac?: string; description: string; quantity: number; unitPrice: number; taxRate: number; taxInclusive?: boolean };
export type TotalsOptions = { roundOff?: boolean; roundTax?: boolean; noTax?: boolean };
export function totalsOptionsFor(transaction: { autoRoundOff: boolean }, taxes: { roundOffTax: boolean; compositionScheme: boolean }, sales = true): TotalsOptions {
  return { roundOff: transaction.autoRoundOff, roundTax: taxes.roundOffTax, noTax: sales && taxes.compositionScheme };
}
export function calculateInvoice(drafts: InvoiceDraftLine[] = [], discount = 0, gstRegistered = false, options: TotalsOptions = {}) {
  const safe = (Array.isArray(drafts) ? drafts : []).map((line) => ({ ...line,
    active: Boolean(line.description?.trim() || line.itemId || line.unitPrice),
    quantity: Number.isFinite(line.quantity) ? line.quantity : 0,
    unitPrice: Number.isFinite(line.unitPrice) ? line.unitPrice : 0,
    taxRate: Number.isFinite(line.taxRate) && gstRegistered ? line.taxRate : 0,
  }));
  const result = computeBilling(safe.map((line) => ({ ...line, quantity: line.active ? line.quantity : 0 })), Number.isFinite(discount) ? discount : 0, options);
  return { ...result, subtotal: result.subTotal, tax: result.taxTotal, total: result.grandTotal,
    lines: result.lines.map((line, i) => ({ subtotal: line.lineSubTotal, tax: line.lineTax, total: line.lineTotal, active: safe[i].active })),
    count: safe.filter((line) => line.active).length,
    quantity: unscaled(safe.reduce((sum, line) => sum + (line.active ? scaled(line.quantity, 3) : 0n), 0n), 3),
  };
}
