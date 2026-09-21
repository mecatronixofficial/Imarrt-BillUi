'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, CheckCircle2, CircleDollarSign, ClipboardList, Clock3, Factory, FileEdit, Hourglass, Layers, PieChart, Plus, ReceiptIndianRupee, ReceiptText, RotateCcw, ShoppingCart, Timer, Trophy, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ContentState';
import {
  ColumnChart,
  HeroBanner,
  HeroLink,
  Panel,
  RankedBars,
  RecordList,
  RegisterCard,
  StatCard,
  StatusBreakdown,
  formatCompact,
  monthlySeries,
  percentChange,
  type RecordRow,
  type Tone,
} from '@/components/workspace/WorkspaceKit';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BusinessDocument, ProductionOrder, PurchaseOrder } from '@/types';

const DAY = 86_400_000;
const number = (value: unknown) => Number(value) || 0;
const sameMonth = (raw: string | undefined, offset: number) => {
  if (!raw) return false;
  const date = new Date(raw);
  const target = new Date();
  target.setMonth(target.getMonth() - offset, 1);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
};
const titleCase = (value: string) => value.toLowerCase().replaceAll('_', ' ').replace(/^\w/, (letter) => letter.toUpperCase());

type Register = { href: string; label: string; description: string; icon: LucideIcon; tone: Tone };

const REGISTERS: Record<string, Register> = {
  bills: { href: '/purchases/bills', label: 'Purchase Bills', description: 'Supplier bills, GST input, and incoming stock.', icon: ReceiptText, tone: 'orange' },
  payments: { href: '/purchases/payment-out', label: 'Payment-Out', description: 'Payments already made to suppliers and partners.', icon: CircleDollarSign, tone: 'emerald' },
  expenses: { href: '/purchases/expenses', label: 'Expenses', description: 'Material, labour, transport, and other costs.', icon: ReceiptIndianRupee, tone: 'violet' },
  orders: { href: '/purchases/orders', label: 'Purchase Order', description: 'Supplier-linked orders for active projects.', icon: ClipboardList, tone: 'cyan' },
  returns: { href: '/purchases/returns', label: 'Purchase Return / Dr. Note', description: 'Returns, corrections, and debit-note adjustments.', icon: RotateCcw, tone: 'amber' },
};

const OPEN_PURCHASE_ORDERS = ['DRAFT', 'SENT', 'CONFIRMED', 'PARTIALLY_RECEIVED'];

export default function PurchasesPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [documentResponse, orderResponse, purchaseOrderResponse] = await Promise.all([
        getAllPages<BusinessDocument>('/documents'),
        getAllPages<ProductionOrder>('/production-orders'),
        getAllPages<PurchaseOrder>('/purchase-orders'),
      ]);
      setDocuments(documentResponse.data);
      setOrders(orderResponse.data);
      setPurchaseOrders(purchaseOrderResponse.data);
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load purchase workspace.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const view = useMemo(() => {
    const now = Date.now();
    const bills = documents.filter(({ type, status }) => type === 'PURCHASE_INVOICE' && status !== 'CANCELLED');
    const issued = bills.filter(({ status }) => status !== 'DRAFT');
    const paidOf = (bill: BusinessDocument) => number(bill.paidAmount);
    const dueOf = (bill: BusinessDocument) => Math.max(0, number(bill.grandTotal) - paidOf(bill));
    const purchaseValue = bills.reduce((sum, bill) => sum + number(bill.grandTotal), 0);
    const monthValue = bills.filter(({ issueDate }) => sameMonth(issueDate, 0)).reduce((sum, bill) => sum + number(bill.grandTotal), 0);
    const lastMonthValue = bills.filter(({ issueDate }) => sameMonth(issueDate, 1)).reduce((sum, bill) => sum + number(bill.grandTotal), 0);
    const payable = issued.reduce((sum, bill) => sum + dueOf(bill), 0);
    const unpaidBills = issued.filter((bill) => dueOf(bill) > 0);

    const costs = orders.flatMap((order) => order.costs);
    const expenses = costs.reduce((sum, cost) => sum + number(cost.amount), 0);
    const expensesPaid = costs.reduce((sum, cost) => sum + number(cost.paidAmount), 0);
    const billsPaid = issued.reduce((sum, bill) => sum + paidOf(bill), 0);

    const categories = new Map<string, number>();
    for (const cost of costs) categories.set(cost.category, (categories.get(cost.category) ?? 0) + number(cost.amount));

    const suppliers = new Map<string, { name: string; billed: number; due: number; count: number }>();
    for (const bill of bills) {
      const key = bill.supplier?.id ?? bill.supplier?.name ?? 'unknown';
      const entry = suppliers.get(key) ?? { name: bill.supplier?.name ?? 'Unknown supplier', billed: 0, due: 0, count: 0 };
      entry.billed += number(bill.grandTotal);
      entry.due += bill.status === 'DRAFT' ? 0 : dueOf(bill);
      entry.count += 1;
      suppliers.set(key, entry);
    }

    const soon = now + 7 * DAY;
    const dueSoon = unpaidBills
      .filter((bill) => bill.dueDate && new Date(bill.dueDate).getTime() <= soon)
      .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime());

    const paid = issued.filter((bill) => dueOf(bill) === 0);
    const partial = issued.filter((bill) => paidOf(bill) > 0 && dueOf(bill) > 0);
    const unpaid = issued.filter((bill) => paidOf(bill) === 0 && dueOf(bill) > 0);
    const drafts = bills.filter(({ status }) => status === 'DRAFT');
    const sum = (list: BusinessDocument[]) => formatCompact(list.reduce((total, bill) => total + number(bill.grandTotal), 0));

    const debitNotes = documents.filter(({ type, status }) => type === 'DEBIT_NOTE' && status !== 'CANCELLED');
    const openPurchaseOrders = purchaseOrders.filter(({ status }) => OPEN_PURCHASE_ORDERS.includes(status));

    return {
      bills,
      purchaseValue,
      monthValue,
      purchaseChange: percentChange(monthValue, lastMonthValue),
      payable,
      unpaidBills,
      expenses,
      expensesPaid,
      paymentsMade: billsPaid + expensesPaid,
      trend: monthlySeries(bills, (bill) => bill.issueDate, (bill) => number(bill.grandTotal)),
      categoryRows: [...categories.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
      statusSegments: [
        { label: 'Paid', count: paid.length, amount: sum(paid), tone: 'emerald' as const, icon: CheckCircle2 },
        { label: 'Partially paid', count: partial.length, amount: sum(partial), tone: 'amber' as const, icon: Hourglass },
        { label: 'Unpaid', count: unpaid.length, amount: sum(unpaid), tone: 'red' as const, icon: AlertTriangle },
        { label: 'Draft', count: drafts.length, tone: 'slate' as const, icon: FileEdit },
      ],
      topSuppliers: [...suppliers.values()].sort((a, b) => b.billed - a.billed).slice(0, 5),
      recent: [...bills].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).slice(0, 6),
      dueSoon,
      dueOf,
      debitNotes,
      debitValue: debitNotes.reduce((total, note) => total + number(note.grandTotal), 0),
      openPurchaseOrders,
      openOrderValue: openPurchaseOrders.reduce((total, order) => total + number(order.grandTotal), 0),
      supplierOrders: orders.filter((order) => Boolean(order.supplier) && !['COMPLETED', 'CANCELLED'].includes(order.status)).length,
    };
  }, [documents, orders, purchaseOrders]);

  const recentRows: RecordRow[] = view.recent.map((bill) => {
    const due = view.dueOf(bill);
    return {
      id: bill.id,
      href: `/documents/${bill.id}`,
      title: bill.documentNumber,
      subtitle: `${bill.supplier?.name ?? 'Unknown supplier'} · ${formatDate(bill.issueDate)}`,
      value: formatCurrency(bill.grandTotal),
      badge: bill.status === 'DRAFT'
        ? { label: 'Draft', tone: 'slate' }
        : due === 0 ? { label: 'Paid', tone: 'emerald' } : number(bill.paidAmount) > 0 ? { label: 'Part paid', tone: 'amber' } : { label: 'Unpaid', tone: 'red' },
    };
  });

  const dueRows: RecordRow[] = view.dueSoon.slice(0, 6).map((bill) => {
    const days = Math.ceil((new Date(bill.dueDate ?? 0).getTime() - Date.now()) / DAY);
    return {
      id: bill.id,
      href: `/documents/${bill.id}`,
      title: bill.supplier?.name ?? 'Unknown supplier',
      subtitle: `${bill.documentNumber} · due ${formatDate(bill.dueDate)}`,
      value: formatCurrency(view.dueOf(bill)),
      badge: days < 0 ? { label: `${Math.abs(days)}d overdue`, tone: 'red' } : { label: days === 0 ? 'Due today' : `In ${days}d`, tone: 'amber' },
    };
  });

  const stats: Record<string, { stat: string; label: string }> = {
    bills: { stat: String(view.bills.length), label: `bills · ${formatCompact(view.purchaseValue)}` },
    payments: { stat: formatCompact(view.paymentsMade), label: 'paid out' },
    expenses: { stat: formatCompact(view.expenses), label: 'recorded' },
    orders: { stat: String(view.openPurchaseOrders.length), label: `open · ${formatCompact(view.openOrderValue)}` },
    returns: { stat: String(view.debitNotes.length), label: `notes · ${formatCompact(view.debitValue)}` },
  };

  return (
    <>
      <HeroBanner
        accent="orange"
        eyebrow="Live purchase overview"
        title="Purchase & expense centre"
        description="Supplier bills, what you owe, project expenses and purchase orders in one view, with the bills that are due next."
        actions={
          <>
            <HeroLink href="/purchases/orders" icon={ClipboardList}>Purchase order</HeroLink>
            <HeroLink href="/purchases/bills/new" icon={Plus} primary>New purchase bill</HeroLink>
          </>
        }
      />
      {loading ? (
        <section className="card"><LoadingState label="Preparing purchase workspace..." /></section>
      ) : error ? (
        <section className="card"><ErrorState message={error} onRetry={loadData} /></section>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4" aria-label="Purchase summary">
            <StatCard icon={ShoppingCart} label="Purchase value" value={formatCurrency(view.purchaseValue)} detail={`${formatCurrency(view.monthValue)} this month`} tone="orange" delta={view.purchaseChange} goodWhenUp={false} />
            <StatCard icon={Clock3} label="Payable to suppliers" value={formatCurrency(view.payable)} detail={`${view.unpaidBills.length} unpaid bills · ${view.dueSoon.length} due within 7 days`} tone="red" />
            <StatCard icon={ReceiptIndianRupee} label="Expense value" value={formatCurrency(view.expenses)} detail={`${formatCurrency(view.expensesPaid)} paid · ${view.supplierOrders} supplier orders open`} tone="violet" />
            <StatCard icon={Wallet} label="Payments made" value={formatCurrency(view.paymentsMade)} detail={`${view.openPurchaseOrders.length} open purchase orders`} tone="emerald" />
          </section>

          <section className="mb-4 grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel title="Purchase trend" description="Billed value, last 6 months" icon={BarChart3} tone="orange" action={{ href: '/purchases/bills', label: 'All bills' }}>
              <ColumnChart points={view.trend} series="orange" format={formatCurrency} name="Purchases" />
            </Panel>
            <Panel title="Bill payment status" description="What is settled and what is not" icon={PieChart} tone="violet">
              <StatusBreakdown segments={view.statusSegments} empty="No purchase bills yet." />
            </Panel>
          </section>

          <section className="mb-4 grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Expenses by category" description="Project costs, biggest first" icon={Layers} tone="violet" action={{ href: '/purchases/expenses', label: 'Expenses' }}>
              <RankedBars
                rows={view.categoryRows.map(([category, total]) => ({ label: titleCase(category), value: total }))}
                series="orange"
                format={formatCurrency}
                empty="Expenses appear here once costs are added to production orders."
              />
            </Panel>
            <Panel title="Top suppliers" description="By billed value" icon={Trophy} tone="amber">
              <RankedBars
                rows={view.topSuppliers.map((supplier) => ({ label: supplier.name, sub: `${supplier.count} bill${supplier.count === 1 ? '' : 's'} · ${formatCurrency(supplier.due)} payable`, value: supplier.billed }))}
                series="orange"
                format={formatCurrency}
                empty="Suppliers appear here once you record purchase bills."
              />
            </Panel>
            <Panel title="Due soon" description="Unpaid bills due within 7 days" icon={Timer} tone="red" className="md:col-span-2 xl:col-span-1">
              <RecordList rows={dueRows} empty="No bills are due in the next 7 days." />
            </Panel>
          </section>

          <section className="mb-4">
            <Panel title="Recent purchase bills" description="Latest activity" icon={ReceiptText} tone="orange" action={{ href: '/purchases/bills', label: 'View all' }}>
              <RecordList rows={recentRows} empty="No purchase bills yet." />
            </Panel>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Factory aria-hidden="true" size={17} className="text-orange-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Purchase workspace</h2>
                <p className="text-[10px] text-slate-400">Choose a register to continue</p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {Object.entries(REGISTERS).map(([key, register]) => (
                <RegisterCard key={key} {...register} stat={stats[key].stat} statLabel={stats[key].label} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
