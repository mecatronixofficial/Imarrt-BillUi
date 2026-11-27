import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionInsights, currentProcess, daysUntilDue } from '../src/lib/production-dashboard';
import type { ProductionOrder, ProductionStage } from '../src/types';

const now = new Date(2026, 10, 26, 15, 0);

const stage = (type: ProductionStage['type'], sequence: number, status: ProductionStage['status'], extra: Partial<ProductionStage> = {}) =>
  ({ id: `${type}-${sequence}`, type, sequence, status, plannedQty: 0, issuedQty: 0, completedQty: 0, rejectedQty: 0, rate: '0', otherCost: '0', ...extra }) as ProductionStage;

const order = (id: string, extra: Partial<ProductionOrder> = {}) => ({
  id,
  orderNumber: id,
  party: { id: 'p1', name: 'Alpha' },
  styleName: 'Polo',
  orderedQty: 100,
  saleRate: '10',
  status: 'IN_PRODUCTION',
  createdAt: '2026-11-01T00:00:00.000Z',
  orderDate: '2026-11-01',
  stages: [],
  costs: [],
  summary: { revenue: 1000, processCost: 200, materialCost: 300, totalMakingCost: 500, costPerPiece: 5, profit: 500, marginPercent: 50, packedQty: 0, progressPercent: 0 },
  ...extra,
}) as ProductionOrder;

test('current process follows the first in-progress or pending stage in sequence order', () => {
  const stages = [stage('STITCHING', 3, 'PENDING'), stage('CUTTING', 2, 'COMPLETED'), stage('MASTER', 1, 'COMPLETED')];
  assert.equal(currentProcess(order('a', { stages })), 'STITCHING');
  assert.equal(currentProcess(order('b', { stages: [stage('CUTTING', 2, 'IN_PROGRESS'), stage('STITCHING', 3, 'PENDING')] })), 'CUTTING');
  assert.equal(currentProcess(order('c', { status: 'DRAFT' })), 'DRAFT');
  assert.equal(currentProcess(order('d', { status: 'DISPATCHED' })), 'DELIVERED');
  assert.equal(currentProcess(order('e', { stages: [stage('FINAL', 8, 'COMPLETED')] })), 'FINAL');
});

test('due dates are compared by calendar day and ignored for closed orders', () => {
  assert.equal(daysUntilDue(order('a', { dueDate: '2026-11-26' }), now), 0);
  assert.equal(daysUntilDue(order('b', { dueDate: '2026-11-24' }), now), -2);
  assert.equal(daysUntilDue(order('c', { dueDate: '2026-11-24', status: 'COMPLETED' }), now), undefined);
  assert.equal(daysUntilDue(order('d'), now), undefined);
});

test('insights exclude drafts from revenue and cancelled orders from everything', () => {
  const insights = buildProductionInsights([
    order('active', { dueDate: '2026-11-20' }),
    order('draft', { status: 'DRAFT', dueDate: '2026-11-28' }),
    order('cancelled', { status: 'CANCELLED', dueDate: '2026-11-01' }),
    order('done', { status: 'COMPLETED', party: { id: 'p2', name: 'Beta' }, orderedQty: 300 }),
  ], now);
  assert.equal(insights.activeOrders, 1);
  assert.equal(insights.draftOrders, 1);
  assert.equal(insights.deliveredOrders, 1);
  assert.equal(insights.activePieces, 100);
  assert.equal(insights.revenue, 2000);
  assert.equal(insights.profit, 1000);
  assert.equal(insights.marginPercent, 50);
  assert.equal(insights.makingCost, 1500);
  assert.deepEqual(insights.overdue.map(({ order: entry }) => entry.id), ['active']);
  assert.deepEqual(insights.dueSoon.map(({ order: entry }) => entry.id), ['draft']);
  assert.deepEqual(insights.topCustomers.map(({ name, pieces }) => [name, pieces]), [['Beta', 300], ['Alpha', 200]]);
  assert.equal(insights.pipeline.find(({ process }) => process === 'DELIVERED')?.orders, 1);
});
