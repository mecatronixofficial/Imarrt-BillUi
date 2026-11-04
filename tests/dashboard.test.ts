import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardSeries, invoiceBalance } from '../src/lib/dashboard';
import { sumMoney } from '../src/lib/billing';
import type { BusinessDocument, Invoice } from '../src/types';

const invoice = (issueDate: string, amount: string, status = 'UNPAID') => ({ issueDate, grandTotal: amount, amountPaid: '0', status }) as Invoice;
const document = (issueDate: string, amount: string, type: string, status = 'ISSUED') => ({ issueDate, grandTotal: amount, type, status }) as BusinessDocument;

test('all-time chart includes the earliest recorded year and excludes future and cancelled activity', () => {
  const rows = buildDashboardSeries([
    invoice('2021-02-15T00:00:00Z', '125.20'), invoice('2026-11-02', '74.80'),
    invoice('2026-11-03', '1000'), invoice('2020-01-01', '9999', 'CANCELLED'),
  ], [], { to: '2026-11-02' });
  assert.equal(rows[0].from, '2021-02-15');
  assert.equal(rows.at(-1)?.to, '2026-11-02');
  assert.equal(sumMoney(rows.map(row => row.sales)), 200);
  assert.ok(rows.length <= 13);
  for (let index = 1; index < rows.length; index++) {
    const previousEnd = new Date(rows[index - 1].to + 'T00:00:00Z');
    previousEnd.setUTCDate(previousEnd.getUTCDate() + 1);
    assert.equal(rows[index].from, previousEnd.toISOString().slice(0, 10));
  }
});

test('chart buckets reconcile sales and purchases after credit and debit notes, including negative net sales', () => {
  const rows = buildDashboardSeries([invoice('2026-11-01', '100.25'), invoice('2026-11-02', '999', 'DRAFT')], [
    document('2026-11-01', '50.50', 'PURCHASE_INVOICE'), document('2026-11-01', '125.50', 'CREDIT_NOTE'),
    document('2026-11-02', '10.25', 'DEBIT_NOTE'), document('2026-11-02', '900', 'PURCHASE_INVOICE', 'REJECTED'),
  ], { from: '2026-11-01', to: '2026-11-02' });
  assert.equal(sumMoney(rows.map(row => row.sales)), -25.25);
  assert.equal(sumMoney(rows.map(row => row.purchases)), 40.25);
  assert.equal(rows.reduce((count, row) => count + row.invoiceCount, 0), 1);
});

test('custom ranges include both boundaries and empty or inverted ranges are handled', () => {
  const invoices = [invoice('2026-10-31', '1'), invoice('2026-11-01', '2'), invoice('2026-11-02', '3'), invoice('2026-11-03', '4')];
  const rows = buildDashboardSeries(invoices, [], { from: '2026-11-01', to: '2026-11-02' });
  assert.equal(sumMoney(rows.map(row => row.sales)), 5);
  assert.deepEqual(buildDashboardSeries(invoices, [], { from: '2026-11-03', to: '2026-11-02' }), []);
  assert.equal(buildDashboardSeries([], [], { from: '2026-11-02', to: '2026-11-02' })[0].sales, 0);
});

test('overdue amounts honor authoritative balances and credited invoices', () => {
  assert.equal(invoiceBalance({ ...invoice('2026-11-01', '100'), amountPaid: '20', creditTotal: 30 }), 50);
  assert.equal(invoiceBalance({ ...invoice('2026-11-01', '100'), balanceDue: 0 }), 0);
});
