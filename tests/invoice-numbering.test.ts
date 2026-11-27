import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidInvoicePrefix, previewInvoiceNumber, resolveInvoicePrefix } from '../src/lib/invoiceNumbering';

test('invoice prefix fills date tokens like the server', () => {
  assert.equal(resolveInvoicePrefix('INV-{YYYY}-', new Date(2026, 10, 27)), 'INV-2026-');
  assert.equal(resolveInvoicePrefix('SV/{FY}/', new Date(2027, 1, 10)), 'SV/26-27/');
  assert.equal(resolveInvoicePrefix('{YY}A', new Date(2026, 0, 1)), '26A');
  assert.equal(previewInvoiceNumber('INV-', new Date(2026, 10, 27)), 'INV-01');
  assert.equal(previewInvoiceNumber('INV-{YYYY}-', new Date(2026, 10, 27), 4), 'INV-2026-0001');
});

test('invoice prefix accepts only prefixes the server accepts', () => {
  for (const ok of ['', 'INV-', 'INV/{FY}/', 'B_1.']) assert.equal(isValidInvoicePrefix(ok), true, ok);
  for (const bad of ['-INV', 'INV {YYYY}', 'INV-{MM}', 'A'.repeat(25), 'INV"']) assert.equal(isValidInvoicePrefix(bad), false, bad);
});
