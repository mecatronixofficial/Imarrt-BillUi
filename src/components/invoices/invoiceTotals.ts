export type InvoiceDraftLine = { key: string; itemId?: string; description: string; quantity: number; unitPrice: number; taxRate: number };

export type TotalsOptions = { roundOff?: boolean; roundTax?: boolean; noTax?: boolean };

/** Company rules that change how totals are worked out; they match the server's computeInvoiceTotals. */
export function totalsOptionsFor(transaction: { autoRoundOff: boolean }, taxes: { roundOffTax: boolean; compositionScheme: boolean }, sales = true): TotalsOptions {
  return { roundOff: transaction.autoRoundOff, roundTax: taxes.roundOffTax, noTax: sales && taxes.compositionScheme };
}

const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

// Match the API's per-line rounding and invoice-level discount calculation.
export function calculateInvoice(drafts: InvoiceDraftLine[] = [], discount: number = 0, gstRegistered: boolean = false, options: TotalsOptions = {}) {
  const safeDrafts = Array.isArray(drafts) ? drafts : [];
  const lines = safeDrafts.map((line) => {
    const active = Boolean((line?.description || '').trim() || line?.itemId || (line?.unitPrice ?? 0) !== 0);
    const quantity = Number.isFinite(line?.quantity) ? (line.quantity ?? 0) : 0;
    const unitPrice = Number.isFinite(line?.unitPrice) ? (line.unitPrice ?? 0) : 0;
    const taxRate = Number.isFinite(line?.taxRate) ? (line.taxRate ?? 0) : 0;
    const subtotal = active ? round2(quantity * unitPrice) : 0;
    const tax = round2(subtotal * (gstRegistered && !options.noTax ? taxRate : 0) / 100);
    return { subtotal, tax, total: round2(subtotal + tax), active };
  });

  const subtotal = round2(lines.reduce((sum, line) => sum + line.subtotal, 0));
  const summedTax = round2(lines.reduce((sum, line) => sum + line.tax, 0));
  const tax = options.roundTax ? Math.round(summedTax) : summedTax;
  const validDiscount = Number.isFinite(discount) && discount > 0 ? discount : 0;

  return {
    lines,
    subtotal,
    tax,
    total: options.roundOff ? Math.round(Math.max(0, round2(subtotal + tax - validDiscount))) : round2(Math.max(0, subtotal + tax - validDiscount)),
    count: lines.filter(({ active }) => active).length,
    quantity: round2(safeDrafts.reduce((sum, line, index) => sum + (lines[index]?.active ? (Number.isFinite(line?.quantity) ? line.quantity : 0) : 0), 0)),
  };
}
