import { sumMoney } from '@/lib/billing';
import type { ProductionOrder, ProductionOrderStatus, ProductionStage, ProductionStageType } from '@/types';

export const PRODUCTION_PIPELINE: ProductionStageType[] = ['MASTER', 'FABRIC_PURCHASE', 'WASHING_COMPACTING', 'CUTTING', 'PRINT_EMBROIDERY', 'STITCHING', 'PACKING', 'FINAL'];

export type OrderProcess = ProductionStageType | 'DRAFT' | 'DELIVERED' | 'CANCELLED';
export type ProcessColumn = Exclude<OrderProcess, 'CANCELLED'>;

/** Every column an order can sit in, in workflow order. Cancelled orders stay out of the pipeline. */
export const PROCESS_COLUMNS: ProcessColumn[] = ['DRAFT', ...PRODUCTION_PIPELINE, 'DELIVERED'];

export const ORDER_STATUSES: ProductionOrderStatus[] = ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'DISPATCHED', 'COMPLETED', 'CANCELLED'];

const CLOSED_STATUSES: ProductionOrderStatus[] = ['DISPATCHED', 'COMPLETED', 'CANCELLED'];
const DAY_MS = 86_400_000;

export function sortProductionStages(stages: ProductionStage[]) {
  return [...stages].sort((left, right) => left.sequence - right.sequence);
}

export function currentProcess(order: ProductionOrder): OrderProcess {
  if (order.status === 'DRAFT') return 'DRAFT';
  if (order.status === 'COMPLETED' || order.status === 'DISPATCHED') return 'DELIVERED';
  if (order.status === 'CANCELLED') return 'CANCELLED';
  const ordered = sortProductionStages(order.stages);
  return ordered.find((stage) => stage.status === 'IN_PROGRESS')?.type
    ?? ordered.find((stage) => stage.status === 'PENDING')?.type
    ?? 'FINAL';
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days until the due date (negative when overdue); undefined for closed orders or orders without a due date. */
export function daysUntilDue(order: ProductionOrder, now = new Date()) {
  if (!order.dueDate || CLOSED_STATUSES.includes(order.status)) return undefined;
  const due = new Date(order.dueDate);
  if (Number.isNaN(due.getTime())) return undefined;
  return Math.round((startOfDay(due).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

function finite(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function buildProductionInsights(orders: ProductionOrder[], now = new Date()) {
  const live = orders.filter((order) => order.status !== 'CANCELLED');
  const confirmed = live.filter((order) => order.status !== 'DRAFT');
  const active = confirmed.filter((order) => !CLOSED_STATUSES.includes(order.status));

  const revenue = sumMoney(confirmed.map((order) => finite(order.summary.revenue)));
  const profit = sumMoney(confirmed.map((order) => finite(order.summary.profit)));
  const processCost = sumMoney(live.map((order) => finite(order.summary.processCost)));
  const materialCost = sumMoney(live.map((order) => finite(order.summary.materialCost)));

  const pipeline = PROCESS_COLUMNS.map((process) => {
    const inProcess = live.filter((order) => currentProcess(order) === process);
    return { process, orders: inProcess.length, pieces: inProcess.reduce((total, order) => total + finite(order.orderedQty), 0) };
  });

  const statusCounts = ORDER_STATUSES.map((status) => ({ status, count: orders.filter((order) => order.status === status).length })).filter(({ count }) => count > 0);

  const dueTracked = live
    .map((order) => ({ order, days: daysUntilDue(order, now) }))
    .filter((entry): entry is { order: ProductionOrder; days: number } => entry.days !== undefined);
  const overdue = dueTracked.filter(({ days }) => days < 0).sort((a, b) => a.days - b.days);
  const dueSoon = dueTracked.filter(({ days }) => days >= 0 && days <= 7).sort((a, b) => a.days - b.days);

  const customers = new Map<string, { id: string; name: string; orders: number; pieces: number; revenue: number }>();
  for (const order of live) {
    const key = order.party?.id ?? 'unknown';
    const entry = customers.get(key) ?? { id: key, name: order.party?.name ?? 'Unknown customer', orders: 0, pieces: 0, revenue: 0 };
    entry.orders += 1;
    entry.pieces += finite(order.orderedQty);
    entry.revenue = sumMoney([entry.revenue, finite(order.summary.revenue)]);
    customers.set(key, entry);
  }
  const topCustomers = [...customers.values()].sort((a, b) => b.pieces - a.pieces || a.name.localeCompare(b.name)).slice(0, 5);

  const stageYield = PRODUCTION_PIPELINE.filter((type) => type !== 'MASTER' && type !== 'FINAL').map((type) => {
    const stages = confirmed.flatMap((order) => order.stages.filter((stage) => stage.type === type));
    const planned = stages.reduce((total, stage) => total + finite(stage.plannedQty), 0);
    const completed = stages.reduce((total, stage) => total + finite(stage.completedQty), 0);
    const rejected = stages.reduce((total, stage) => total + finite(stage.rejectedQty), 0);
    return { type, planned, completed, rejected, percent: planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0 };
  }).filter(({ planned }) => planned > 0);

  const recent = [...live].sort((a, b) => new Date(b.orderDate ?? b.createdAt).getTime() - new Date(a.orderDate ?? a.createdAt).getTime()).slice(0, 5);

  return {
    totalOrders: orders.length,
    activeOrders: active.length,
    draftOrders: live.length - confirmed.length,
    deliveredOrders: confirmed.filter((order) => order.status === 'DISPATCHED' || order.status === 'COMPLETED').length,
    activePieces: active.reduce((total, order) => total + finite(order.orderedQty), 0),
    revenue,
    profit,
    marginPercent: revenue > 0 ? Math.round((profit / revenue) * 1000) / 10 : 0,
    makingCost: sumMoney([processCost, materialCost]),
    processCost,
    materialCost,
    pipeline,
    statusCounts,
    overdue,
    dueSoon,
    topCustomers,
    stageYield,
    recent,
  };
}

export type ProductionInsights = ReturnType<typeof buildProductionInsights>;
