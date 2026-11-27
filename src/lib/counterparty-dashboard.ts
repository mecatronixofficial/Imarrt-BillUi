import { sumMoney } from '@/lib/billing';
import { inDateRange, type ReportDates } from '@/lib/business-report';
import { documentOutstanding } from '@/lib/outstanding';
import type { BusinessDocument, Invoice, Party, Supplier } from '@/types';

export type CounterpartyRow = { id: string; name: string; phone?: string; periodAmount: number; outstanding: number; count: number };

const finite = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function rank(rows: CounterpartyRow[]) {
  return rows
    .filter((row) => row.periodAmount > 0 || row.outstanding > 0)
    .sort((a, b) => b.periodAmount - a.periodAmount || b.outstanding - a.outstanding || a.name.localeCompare(b.name))
    .slice(0, 5);
}

/** Customers: period sales from issued invoices, outstanding from each party's current balance. */
export function buildCustomerSummary(parties: Party[], invoices: Invoice[], dates: ReportDates = {}, now = new Date()) {
  const rows = new Map<string, CounterpartyRow>(parties.map((party) => [party.id, { id: party.id, name: party.name, phone: party.phone, periodAmount: 0, outstanding: Math.max(0, finite(party.balanceDue)), count: 0 }]));
  for (const invoice of invoices) {
    if (['DRAFT', 'CANCELLED'].includes(invoice.status) || !inDateRange(invoice.issueDate, dates, now)) continue;
    const row = rows.get(invoice.party.id) ?? { id: invoice.party.id, name: invoice.party.name, phone: invoice.party.phone, periodAmount: 0, outstanding: 0, count: 0 };
    row.periodAmount = sumMoney([row.periodAmount, invoice.grandTotal]);
    row.count += 1;
    rows.set(row.id, row);
  }
  const all = [...rows.values()];
  return {
    total: parties.length,
    withDues: all.filter((row) => row.outstanding > 0).length,
    outstanding: sumMoney(all.map((row) => row.outstanding)),
    periodAmount: sumMoney(all.map((row) => row.periodAmount)),
    top: rank(all),
  };
}

/** Suppliers: period purchases and all-time unpaid balance from issued purchase bills. */
export function buildSupplierSummary(suppliers: Supplier[], documents: BusinessDocument[], dates: ReportDates = {}, now = new Date()) {
  const rows = new Map<string, CounterpartyRow>(suppliers.map((supplier) => [supplier.id, { id: supplier.id, name: supplier.name, phone: supplier.phone, periodAmount: 0, outstanding: 0, count: 0 }]));
  for (const document of documents) {
    if (document.type !== 'PURCHASE_INVOICE' || ['DRAFT', 'CANCELLED', 'REJECTED'].includes(document.status)) continue;
    const id = document.supplier?.id ?? document.supplierId ?? document.party?.id ?? document.partyId;
    if (!id) continue;
    const row = rows.get(id) ?? { id, name: document.supplier?.name ?? document.party?.name ?? 'Unknown supplier', phone: document.supplier?.phone ?? document.party?.phone, periodAmount: 0, outstanding: 0, count: 0 };
    row.outstanding = sumMoney([row.outstanding, documentOutstanding(document)]);
    if (inDateRange(document.issueDate, dates, now)) {
      row.periodAmount = sumMoney([row.periodAmount, document.grandTotal]);
      row.count += 1;
    }
    rows.set(id, row);
  }
  const all = [...rows.values()];
  return {
    total: suppliers.length,
    withDues: all.filter((row) => row.outstanding > 0).length,
    outstanding: sumMoney(all.map((row) => row.outstanding)),
    periodAmount: sumMoney(all.map((row) => row.periodAmount)),
    top: rank(all),
    /** Every supplier (including ones with no bills), keyed by id, for registers. */
    byId: rows,
  };
}

export type CounterpartySummary = ReturnType<typeof buildCustomerSummary>;
