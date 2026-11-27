import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gstStateCode, isInterStateSupply } from '../src/lib/gst';
import { summarizeGst } from '../src/components/reports/gstSummary';
import type { BusinessDocument, Invoice } from '../src/types';

const seller = { stateCode: '33', gstin: '33AAAAA0000A1Z5' };
const line = (quantity: number, unitPrice: number, taxRate: number, taxInclusive = false) => ({ quantity: String(quantity), unitPrice: String(unitPrice), taxRate: String(taxRate), taxInclusive });
const invoice = (status: string, items: ReturnType<typeof line>[], extra: Partial<Invoice> = {}) => ({ status, items, party: { name: 'C' }, ...extra }) as unknown as Invoice;
const doc = (type: string, status: string, items: ReturnType<typeof line>[], extra: Partial<BusinessDocument> = {}) => ({ type, status, items, ...extra }) as unknown as BusinessDocument;

test('place of supply rule matches the printed invoice', () => {
  assert.equal(gstStateCode('Karnataka'), '29');
  assert.equal(gstStateCode('33-Tamil Nadu'), '33');
  assert.equal(isInterStateSupply({ sellerStateCode: '33', placeOfSupply: 'Karnataka' }), true);
  assert.equal(isInterStateSupply({ sellerStateCode: '33', placeOfSupply: 'Tamil Nadu', buyerGstin: '29XXXXX0000X1Z5' }), false);
  assert.equal(isInterStateSupply({ sellerStateCode: '33' }), false);
});

test('splits output tax by rate into CGST/SGST (local) and IGST (inter-state) and skips drafts and cancelled bills', () => {
  const summary = summarizeGst([
    invoice('PAID', [line(2, 100, 18)]), // local: taxable 200, tax 36 → 18 + 18
    invoice('UNPAID', [line(1, 1000, 18)], { placeOfSupply: 'Karnataka' }), // inter-state: tax 180 IGST
    invoice('DRAFT', [line(1, 999, 18)]),
    invoice('CANCELLED', [line(1, 999, 18)]),
  ], [], seller);
  assert.deepEqual(summary.rows, [{ section: 'Outward', rate: 18, taxable: 1200, cgst: 18, sgst: 18, igst: 180 }]);
  assert.deepEqual(summary.net, { taxable: 1200, cgst: 18, sgst: 18, igst: 180 });
});

test('credit notes reduce output tax, purchase bills give input credit and debit notes reduce it', () => {
  const summary = summarizeGst(
    [invoice('PAID', [line(1, 1000, 12)])], // 120 → 60 + 60
    [
      doc('CREDIT_NOTE', 'ISSUED', [line(1, 100, 12)]), // −12 → −6 − 6
      doc('PURCHASE_INVOICE', 'ISSUED', [line(1, 500, 12)], { supplier: { id: 's1', name: 'S', gstin: '33SSSSS0000S1Z5' } }), // local ITC 60 → 30 + 30
      doc('PURCHASE_INVOICE', 'ISSUED', [line(1, 100, 5)], { supplier: { id: 's2', name: 'S2', gstin: '29SSSSS0000S1Z5' } }), // inter-state ITC 5 IGST
      doc('DEBIT_NOTE', 'ISSUED', [line(1, 100, 12)], { supplier: { id: 's1', name: 'S', gstin: '33SSSSS0000S1Z5' } }), // −12 → −6 − 6
      doc('QUOTATION', 'ISSUED', [line(1, 5000, 18)]), // not a tax document
      doc('PURCHASE_INVOICE', 'DRAFT', [line(1, 5000, 18)], { supplier: { id: 's1', name: 'S', gstin: '33SSSSS0000S1Z5' } }),
    ],
    seller,
  );
  assert.deepEqual(summary.output, { taxable: 900, cgst: 54, sgst: 54, igst: 0 });
  assert.deepEqual(summary.input, { taxable: 500, cgst: 24, sgst: 24, igst: 5 });
  assert.deepEqual(summary.net, { taxable: 400, cgst: 30, sgst: 30, igst: -5 });
});

test('tax-inclusive prices are split back to taxable value and odd paise go to SGST', () => {
  const summary = summarizeGst([invoice('PAID', [line(1, 118, 18, true), line(1, 10.01, 5)])], [], seller);
  // 118 incl. 18% → 100 + 18 (9 + 9); 10.01 at 5% → tax 0.50 (0.25 + 0.25)
  assert.deepEqual(summary.rows, [
    { section: 'Outward', rate: 5, taxable: 10.01, cgst: 0.25, sgst: 0.25, igst: 0 },
    { section: 'Outward', rate: 18, taxable: 100, cgst: 9, sgst: 9, igst: 0 },
  ]);
  const odd = summarizeGst([invoice('PAID', [line(1, 0.3, 5)])], [], seller); // tax 0.02 → 0.01 + 0.01
  assert.equal(odd.output.cgst + odd.output.sgst, 0.02);
});
