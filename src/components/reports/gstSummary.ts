import { computeBilling, subtractMoney, sumMoney } from '@/lib/billing';
import { isInterStateSupply } from '@/lib/gst';
import type { Business, BusinessDocument, Invoice } from '@/types';

/**
 * GST summary (the figures behind GSTR-1 / GSTR-3B): taxable value and CGST / SGST / IGST per tax rate for
 * outward supplies (sale invoices less credit notes) and inward supplies (purchase bills less debit notes),
 * and the net GST payable. Tax per line uses the same decimal-safe calculation as invoices, and the
 * intra/inter-state split uses the place of supply, exactly like the printed invoice.
 */
export type GstSection = 'Outward' | 'Inward';
export type GstAmounts = { taxable: number; cgst: number; sgst: number; igst: number };
export type GstRow = GstAmounts & { section: GstSection; rate: number };
export type GstSummary = { rows: GstRow[]; output: GstAmounts; input: GstAmounts; net: GstAmounts };

type Line = { quantity: unknown; unitPrice: unknown; taxRate: unknown; taxInclusive?: boolean };
type Seller = Pick<Business, 'stateCode' | 'gstin'> | null | undefined;

const ZERO: GstAmounts = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
const POSTED = (status: string) => !['DRAFT', 'CANCELLED', 'REJECTED'].includes(status);
const add = (a: GstAmounts, b: GstAmounts): GstAmounts => ({
  taxable: sumMoney([a.taxable, b.taxable]), cgst: sumMoney([a.cgst, b.cgst]), sgst: sumMoney([a.sgst, b.sgst]), igst: sumMoney([a.igst, b.igst]),
});
const minus = (a: GstAmounts, b: GstAmounts): GstAmounts => ({
  taxable: subtractMoney(a.taxable, b.taxable), cgst: subtractMoney(a.cgst, b.cgst), sgst: subtractMoney(a.sgst, b.sgst), igst: subtractMoney(a.igst, b.igst),
});

/** One line's taxable value and tax, split intra-state (half CGST, rest SGST, like the PDF) or inter-state (IGST). */
function lineAmounts(line: Line, interState: boolean, sign: 1 | -1): { rate: number; amounts: GstAmounts } {
  const rate = Number(line.taxRate) || 0;
  const { subTotal, taxTotal } = computeBilling([{ quantity: Number(line.quantity) || 0, unitPrice: Number(line.unitPrice) || 0, taxRate: rate, taxInclusive: Boolean(line.taxInclusive) }]);
  const cgst = interState ? 0 : Math.round(Math.round(taxTotal * 100) / 2) / 100;
  const amounts = { taxable: subTotal, cgst, sgst: interState ? 0 : subtractMoney(taxTotal, cgst), igst: interState ? taxTotal : 0 };
  return { rate, amounts: sign === 1 ? amounts : minus(ZERO, amounts) };
}

export function summarizeGst(invoices: Invoice[], documents: BusinessDocument[], seller: Seller): GstSummary {
  const buckets = new Map<string, GstRow>();
  const collect = (section: GstSection, lines: Line[] | undefined, interState: boolean, sign: 1 | -1) => {
    for (const line of lines ?? []) {
      const { rate, amounts } = lineAmounts(line, interState, sign);
      const key = `${section}:${rate}`;
      const current = buckets.get(key) ?? { section, rate, ...ZERO };
      buckets.set(key, { section, rate, ...add(current, amounts) });
    }
  };

  for (const invoice of invoices) {
    if (!POSTED(invoice.status)) continue;
    const interState = isInterStateSupply({ sellerStateCode: seller?.stateCode, sellerGstin: seller?.gstin, placeOfSupply: invoice.placeOfSupply, buyerGstin: invoice.party?.gstin });
    collect('Outward', invoice.items, interState, 1);
  }
  for (const document of documents) {
    if (!POSTED(document.status)) continue;
    if (document.type === 'CREDIT_NOTE') {
      // Sales return: reduces output tax on the same basis as the sale.
      const interState = isInterStateSupply({ sellerStateCode: seller?.stateCode, sellerGstin: seller?.gstin, placeOfSupply: document.placeOfSupply, buyerGstin: document.party?.gstin });
      collect('Outward', document.items, interState, -1);
    } else if (document.type === 'PURCHASE_INVOICE' || document.type === 'DEBIT_NOTE') {
      // Inward supply: the supplier sells to us, so their state is compared with ours (or the place of supply).
      const interState = isInterStateSupply({ sellerGstin: document.supplier?.gstin, placeOfSupply: document.placeOfSupply || seller?.stateCode, buyerGstin: seller?.gstin });
      collect('Inward', document.items, interState, document.type === 'DEBIT_NOTE' ? -1 : 1);
    }
  }

  const rows = [...buckets.values()].sort((a, b) => (a.section === b.section ? a.rate - b.rate : a.section === 'Outward' ? -1 : 1));
  const total = (section: GstSection) => rows.filter((row) => row.section === section).reduce<GstAmounts>((sum, row) => add(sum, row), ZERO);
  const output = total('Outward');
  const input = total('Inward');
  return { rows, output, input, net: minus(output, input) };
}
