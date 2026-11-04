import { localDate, type ReportDates } from './business-report';
import { sumMoney } from './billing';
import type { BusinessDocument, Invoice } from '../types';

export type DashboardPoint = {
  key: string;
  from: string;
  to: string;
  label: string;
  sales: number;
  purchases: number;
  invoiceCount: number;
};

const DAY = 86_400_000;
const dateOnly = (value: string) => value.slice(0, 10);
const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
const isoDay = (value: Date) => value.toISOString().slice(0, 10);

/** Date-only UTC arithmetic prevents daylight saving or locale gaps in financial buckets. */
export function buildDashboardSeries(
  invoices: Invoice[],
  documents: BusinessDocument[],
  dates: ReportDates,
  now = new Date(),
): DashboardPoint[] {
  const end = dates.to || localDate(now);
  if (!validDate(end)) return [];
  const activeInvoices = invoices.filter(invoice => !['DRAFT', 'CANCELLED'].includes(invoice.status));
  const activeDocuments = documents.filter(document =>
    ['PURCHASE_INVOICE', 'CREDIT_NOTE', 'DEBIT_NOTE'].includes(document.type) &&
    !['DRAFT', 'CANCELLED', 'REJECTED'].includes(document.status),
  );
  const available = [...activeInvoices, ...activeDocuments].map(row => dateOnly(row.issueDate))
    .filter(day => validDate(day) && day <= end).sort();
  const start = dates.from || available[0] || end;
  if (!validDate(start) || start > end) return [];
  const first = new Date(start + 'T00:00:00Z');
  const last = new Date(end + 'T00:00:00Z');
  const days = Math.round((last.getTime() - first.getTime()) / DAY) + 1;
  const monthSpan = (last.getUTCFullYear() - first.getUTCFullYear()) * 12 + last.getUTCMonth() - first.getUTCMonth() + 1;
  const monthly = days > 120;
  const step = monthly ? Math.max(1, Math.ceil(monthSpan / 12)) : days <= 31 ? 1 : 7;
  const points: DashboardPoint[] = [];
  let cursor = new Date(first);

  while (cursor <= last) {
    const next = new Date(cursor);
    if (monthly) next.setUTCFullYear(cursor.getUTCFullYear(), cursor.getUTCMonth() + step, 1);
    else next.setUTCDate(cursor.getUTCDate() + step);
    const bucketEnd = new Date(Math.min(last.getTime(), next.getTime() - DAY));
    const from = isoDay(cursor);
    const to = isoDay(bucketEnd);
    const inBucket = (value: string) => dateOnly(value) >= from && dateOnly(value) <= to;
    const sales = activeInvoices.filter(invoice => inBucket(invoice.issueDate));
    const docs = activeDocuments.filter(document => inBucket(document.issueDate));
    points.push({
      key: from,
      from,
      to,
      label: cursor.toLocaleDateString('en-IN', { ...(monthly ? {} : { day: 'numeric' }), month: 'short', ...(monthSpan > 12 ? { year: '2-digit' } : {}), timeZone: 'UTC' }),
      sales: sumMoney([...sales.map(invoice => invoice.grandTotal), ...docs.filter(document => document.type === 'CREDIT_NOTE').map(document => -Number(document.grandTotal))]),
      purchases: sumMoney(docs.filter(document => document.type !== 'CREDIT_NOTE').map(document => (document.type === 'DEBIT_NOTE' ? -1 : 1) * Number(document.grandTotal))),
      invoiceCount: sales.length,
    });
    cursor = next;
  }
  return points;
}

export function invoiceBalance(invoice: Invoice): number {
  return Math.max(0, sumMoney([invoice.balanceDue ?? sumMoney([invoice.grandTotal, -Number(invoice.amountPaid), -(invoice.creditTotal ?? 0)])]));
}
