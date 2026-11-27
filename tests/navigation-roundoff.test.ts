import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fallbackRoute } from '../src/lib/navigation';
import { calculateInvoice, roundOffAmount, savedRoundOff } from '../src/components/invoices/invoiceTotals';
import { PREFERENCE_DEFAULTS } from '../src/lib/preferences';

test('Back falls back to the nearest existing parent page of the module', () => {
  assert.equal(fallbackRoute('/invoices/new'), '/invoices');
  assert.equal(fallbackRoute('/invoices/abc-123'), '/invoices');
  assert.equal(fallbackRoute('/sales/quotations/new'), '/sales/quotations');
  assert.equal(fallbackRoute('/purchases/bills/new'), '/purchases/bills');
  assert.equal(fallbackRoute('/purchases/orders/abc/edit'), '/purchases/orders/abc');
  assert.equal(fallbackRoute('/purchases/orders/abc'), '/purchases/orders');
  assert.equal(fallbackRoute('/parties/p1'), '/parties');
  assert.equal(fallbackRoute('/items/i1'), '/items');
  assert.equal(fallbackRoute('/settings/taxes-gst'), '/settings');
  assert.equal(fallbackRoute('/reports'), '/dashboard');
  assert.equal(fallbackRoute('/dashboard'), '/businesses');
  assert.equal(fallbackRoute('/reset-password'), '/login');
});

test('Round Off is on by default and rounds the grand total once', () => {
  assert.equal(PREFERENCE_DEFAULTS.transaction.autoRoundOff, true);
  const lines = [{ key: 'a', description: 'Item', quantity: 1, unitPrice: 100, taxRate: 12.5 }];
  const rounded = calculateInvoice(lines, 0, true, { roundOff: true });
  assert.equal(rounded.total, 113);
  assert.equal(rounded.roundOff, 0.5);
  const exact = calculateInvoice(lines, 0, true, { roundOff: false });
  assert.equal(exact.total, 112.5);
  assert.equal(exact.roundOff, 0);
  // Shipping / packing are extra lines and a discount is applied before rounding, never after.
  const withCharges = calculateInvoice([...lines, { key: 'b', description: 'Shipping charges', quantity: 1, unitPrice: 10.2, taxRate: 0 }], 3.1, true, { roundOff: true });
  assert.equal(withCharges.total, 120);
  assert.equal(withCharges.roundOff, 0.4);
});

test('a saved record keeps its round-off choice and shows the same adjustment as the PDF', () => {
  assert.equal(savedRoundOff({ roundOff: false, subTotal: '100', taxTotal: '12.5', discount: '0', grandTotal: '112.5' }), false);
  assert.equal(savedRoundOff({ subTotal: '100', taxTotal: '12.5', discount: '0', grandTotal: '113' }), true);
  assert.equal(savedRoundOff({ subTotal: '100', taxTotal: '12.5', discount: '0', grandTotal: '112.50' }), false);
  assert.equal(roundOffAmount({ subTotal: '100', taxTotal: '12.5', discount: '0', grandTotal: '113' }), 0.5);
  assert.equal(roundOffAmount({ subTotal: '100', taxTotal: '12.4', discount: '0', grandTotal: '112' }), -0.4);
  assert.equal(roundOffAmount({ subTotal: '100', taxTotal: '12', discount: '0', grandTotal: '112' }), 0);
});
