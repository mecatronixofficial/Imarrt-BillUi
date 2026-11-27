import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderedProductionImages, productionColorRows, productionConfirmationMessage, productionTotals } from '../src/lib/production-master';
import type { ProductionOrder } from '../src/types';

const order = (extra: Partial<ProductionOrder>): ProductionOrder => ({
  id: 'test-order', orderNumber: 'PO-TEST', party: { id: 'customer', name: 'Test customer' },
  styleName: 'Polo', orderedQty: 15, saleRate: '10', status: 'DRAFT', createdAt: '2026-11-26', stages: [], costs: [],
  summary: { revenue: 150, processCost: 0, materialCost: 0, totalMakingCost: 0, costPerPiece: 0, profit: 150, marginPercent: 100, packedQty: 0, progressPercent: 0 },
  ...extra,
});

test('color and size totals agree across colors and preserve sizes from existing orders', () => {
  const totals = productionTotals([
    { color: 'White', sizes: { S: '10', M: '20', '4XL': '7', XL: '' } },
    { color: 'Navy', sizes: { S: '5', L: '8', '4XL': '3' } },
  ]);
  assert.deepEqual(totals.colors, [{ color: 'White', total: 37 }, { color: 'Navy', total: 16 }]);
  assert.deepEqual(totals.sizes, { S: 15, M: 20, '4XL': 10, L: 8 });
  assert.equal(totals.total, 53);
  assert.equal(Object.values(totals.sizes).reduce((sum, qty) => sum + qty, 0), totals.total);
});

test('legacy size-only orders retain their color and quantities', () => {
  assert.deepEqual(productionColorRows(order({ color: 'Blue', sizeBreakdown: { M: 12, L: 9 } })), [{ color: 'Blue', sizes: { M: 12, L: 9 } }]);
});

test('new uploads append after existing images even when the API returns newest first', () => {
  const images = [
    { id: 'third', createdAt: '2026-11-26T10:00:02Z' },
    { id: 'second', createdAt: '2026-11-26T10:00:01Z' },
    { id: 'first', createdAt: '2026-11-26T10:00:00Z' },
  ] as NonNullable<ProductionOrder['images']>;
  assert.deepEqual(orderedProductionImages({ images }).map(({ id }) => id), ['first', 'second', 'third']);
  assert.equal(images[0].id, 'third', 'sorting does not mutate cached API data');
  assert.deepEqual(orderedProductionImages({ images: images.filter(({ id }) => id !== 'second') }).map(({ id }) => id), ['first', 'third']);
});

test('confirmation requests contain saved customer quantities and do not claim approval', () => {
  const message = productionConfirmationMessage(order({
    sizeColorBreakdown: { White: { M: 10 }, Navy: { M: 5 } }, dueDate: '2026-12-03',
    supplierRate: '999', notes: 'Test notes',
  }));
  assert.match(message, /White: 10 pcs\nNavy: 5 pcs/);
  assert.match(message, /\*Size-wise total\*\nM: 15 pcs/);
  assert.match(message, /Please review.*confirm/);
  assert.doesNotMatch(message, /999|confirmed/i);
});

test('WhatsApp includes the full order without claiming images are attached', () => {
  const saved = order({
    transport: 'Road transport', invoiceDetails: 'Reference A',
    instructions: { product: [{ item: 'Collar', detail: 'Rib collar' }], accessories: [{ item: 'Tag', detail: 'Blue tag' }], packing: [{ item: 'Fold', detail: 'Single fold' }], printEmbroidery: [{ method: 'Embroidery', placement: 'Left chest', detail: 'White logo' }] },
    notes: 'Please check the artwork',
  });
  const message = productionConfirmationMessage(saved);
  for (const detail of ['Road transport', 'Reference A', 'Rib collar', 'Blue tag', 'Single fold', 'White logo', 'Please check the artwork']) assert.ok(message.includes(detail));
  assert.doesNotMatch(message, /attached/i);
  assert.match(productionConfirmationMessage(saved, true), /attached order images/);
});
