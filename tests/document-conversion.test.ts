import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conversionOptions, conversionReversal } from '../src/lib/document-conversion';
import type { BusinessDocument, Invoice } from '../src/types';

const estimate = { id: 'estimate', documentNumber: 'EST-001', type: 'QUOTATION', status: 'ISSUED' } as BusinessDocument;
const proforma = { ...estimate, id: 'proforma', type: 'PROFORMA_INVOICE' } as BusinessDocument;

test('estimates and proforma invoices expose explicit conversion choices', () => {
  assert.deepEqual(conversionOptions(estimate).map((option) => option.value), ['invoice', 'proforma', 'order']);
  assert.deepEqual(conversionOptions(proforma).map((option) => option.value), ['invoice', 'estimate']);
});

test('closed or rejected records and sale invoices cannot be converted again', () => {
  for (const status of ['CONVERTED', 'CANCELLED', 'REJECTED'] as const) assert.deepEqual(conversionOptions({ ...estimate, status }), []);
  assert.deepEqual(conversionOptions({ id: 'sale', invoiceNumber: 'INV-001', status: 'UNPAID' } as Invoice), []);
});

test('an accidentally converted estimate restores its own original identity', () => {
  assert.deepEqual(conversionReversal({ ...estimate, status: 'CONVERTED', convertedInvoiceId: 'sale' }), { sourceId: 'estimate', targetId: 'sale', label: 'Back to estimate' });
});

test('a converted sale offers a return to the correct estimate or proforma source', () => {
  const sale: Invoice = { id: 'sale', invoiceNumber: 'INV-001', status: 'UNPAID', conversionSource: estimate, party: { id: 'party', name: 'Customer' } as Invoice['party'], issueDate: '2026-11-03', subTotal: '100', taxTotal: '0', discount: '0', grandTotal: '100', amountPaid: '0', items: [] };
  assert.deepEqual(conversionReversal(sale), { sourceId: 'estimate', targetId: 'sale', label: 'Back to estimate' });
  assert.equal(conversionReversal({ ...sale, conversionSource: proforma })?.label, 'Back to proforma invoice');
  assert.equal(conversionReversal({ ...sale, status: 'CANCELLED' }), null);
});

test('an estimate converted to proforma can return through its original source', () => {
  assert.deepEqual(conversionReversal({ ...proforma, sourceDocument: estimate }), { sourceId: 'estimate', targetId: 'proforma', label: 'Back to estimate' });
  assert.equal(conversionReversal(proforma), null);
});

test('a multi-step conversion undoes the most recent step first', () => {
  assert.deepEqual(conversionReversal({ ...proforma, status: 'CONVERTED', convertedInvoiceId: 'sale', sourceDocument: estimate }), { sourceId: 'proforma', targetId: 'sale', label: 'Back to proforma invoice' });
});
