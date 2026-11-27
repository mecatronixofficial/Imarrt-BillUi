import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomerSummary, buildSupplierSummary } from '../src/lib/counterparty-dashboard';
import type { BusinessDocument, Invoice, Party, Supplier } from '../src/types';

const now = new Date(2026, 10, 26, 12);
const dates = { from: '2026-11-01', to: '2026-11-26' };

const party = (id: string, balanceDue: number) => ({ id, name: id, balanceDue }) as Party;
const invoice = (partyId: string, grandTotal: string, issueDate: string, status = 'UNPAID') => ({ id: `${partyId}-${issueDate}`, party: { id: partyId, name: partyId }, grandTotal, issueDate, status }) as unknown as Invoice;

test('customer summary ranks by period sales and keeps dues from party balances', () => {
  const summary = buildCustomerSummary(
    [party('a', 150.5), party('b', 0), party('c', -20), party('idle', 0)],
    [invoice('a', '100', '2026-11-05'), invoice('b', '300.25', '2026-11-10'), invoice('b', '50', '2026-10-10'), invoice('a', '999', '2026-11-11', 'CANCELLED')],
    dates, now,
  );
  assert.equal(summary.total, 4);
  assert.equal(summary.withDues, 1);
  assert.equal(summary.outstanding, 150.5);
  assert.equal(summary.periodAmount, 400.25);
  assert.deepEqual(summary.top.map((row) => [row.id, row.periodAmount, row.count]), [['b', 300.25, 1], ['a', 100, 1]]);
});

test('supplier summary uses issued purchase bills only and counts all-time dues', () => {
  const doc = (supplierId: string, grandTotal: string, paidAmount: string, issueDate: string, extra: Partial<BusinessDocument> = {}) =>
    ({ id: `${supplierId}-${issueDate}`, type: 'PURCHASE_INVOICE', status: 'ISSUED', supplierId, supplier: { id: supplierId, name: supplierId }, grandTotal, paidAmount, issueDate, ...extra }) as unknown as BusinessDocument;
  const summary = buildSupplierSummary(
    [{ id: 's1', name: 's1' }, { id: 's2', name: 's2' }] as Supplier[],
    [doc('s1', '500', '200', '2026-11-03'), doc('s1', '100', '0', '2026-09-03'), doc('s2', '80', '80', '2026-11-04'), doc('s2', '999', '0', '2026-11-05', { status: 'DRAFT' } as Partial<BusinessDocument>), doc('s2', '40', '0', '2026-11-06', { type: 'QUOTATION' } as unknown as Partial<BusinessDocument>)],
    dates, now,
  );
  assert.equal(summary.total, 2);
  assert.equal(summary.outstanding, 400);
  assert.equal(summary.withDues, 1);
  assert.equal(summary.periodAmount, 580);
  assert.deepEqual(summary.top.map((row) => [row.id, row.periodAmount, row.outstanding]), [['s1', 500, 400], ['s2', 80, 0]]);
});
