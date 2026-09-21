"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Ban,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  FileText,
  Hourglass,
  IndianRupee,
  PieChart,
  Plus,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Timer,
  Trophy,
  Truck,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ContentState";
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
} from "@/components/workspace/WorkspaceKit";
import { getAllPages, getApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BusinessDocument, Invoice, ProductionOrder } from "@/types";

const DAY = 86_400_000;
const number = (value: unknown) => Number(value) || 0;
const sameMonth = (raw: string | undefined, offset: number) => {
  if (!raw) return false;
  const date = new Date(raw);
  const target = new Date();
  target.setMonth(target.getMonth() - offset, 1);
  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
};

type Register = { href: string; label: string; description: string; icon: LucideIcon; tone: Tone };

const REGISTERS: Record<string, Register> = {
  invoices: { href: "/invoices", label: "Sale Invoices", description: "Final customer invoices and outstanding balances.", icon: ReceiptText, tone: "blue" },
  quotations: { href: "/sales/quotations", label: "Estimate / Quotation", description: "Price estimates and professional proposals.", icon: FileText, tone: "violet" },
  proforma: { href: "/sales/proforma", label: "Proforma Invoice", description: "Preliminary invoices and advance requests.", icon: ShoppingBag, tone: "cyan" },
  payments: { href: "/sales/payment-in", label: "Payment-In", description: "Payments received against sale invoices.", icon: CircleDollarSign, tone: "emerald" },
  orders: { href: "/sales/orders", label: "Sale Order", description: "Customer orders linked to business projects.", icon: ClipboardList, tone: "cyan" },
  challans: { href: "/sales/delivery-challans", label: "Delivery Challan", description: "Goods dispatched for delivery or job work.", icon: Truck, tone: "blue" },
  returns: { href: "/sales/returns", label: "Sale Return / Credit Note", description: "Returns, discounts, and invoice corrections.", icon: RotateCcw, tone: "amber" },
};

export default function SalesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [invoiceResponse, documentResponse, orderResponse] = await Promise.all([
        getAllPages<Invoice>("/invoices"),
        getAllPages<BusinessDocument>("/documents"),
        getAllPages<ProductionOrder>("/production-orders"),
      ]);
      setInvoices(invoiceResponse.data);
      setDocuments(documentResponse.data);
      setOrders(orderResponse.data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, "Could not load sale workspace."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void loadData();
  }, [loadData]);

  const view = useMemo(() => {
    const now = Date.now();
    const live = invoices.filter(({ status }) => status !== "CANCELLED");
    const balanceOf = (invoice: Invoice) => Math.max(0, number(invoice.grandTotal) - number(invoice.amountPaid));
    const sales = live.reduce((sum, invoice) => sum + number(invoice.grandTotal), 0);
    const received = live.reduce((sum, invoice) => sum + number(invoice.amountPaid), 0);
    const outstanding = live.reduce((sum, invoice) => sum + balanceOf(invoice), 0);
    const monthSales = live.filter(({ issueDate }) => sameMonth(issueDate, 0)).reduce((sum, invoice) => sum + number(invoice.grandTotal), 0);
    const lastMonthSales = live.filter(({ issueDate }) => sameMonth(issueDate, 1)).reduce((sum, invoice) => sum + number(invoice.grandTotal), 0);

    const overdue = live
      .filter((invoice) => invoice.dueDate && new Date(invoice.dueDate).getTime() < now && balanceOf(invoice) > 0)
      .sort((a, b) => new Date(a.dueDate ?? 0).getTime() - new Date(b.dueDate ?? 0).getTime());

    const byStatus = (status: Invoice["status"]) => invoices.filter((invoice) => invoice.status === status);
    const amount = (list: Invoice[]) => formatCompact(list.reduce((sum, invoice) => sum + number(invoice.grandTotal), 0));

    const customers = new Map<string, { name: string; billed: number; due: number; count: number }>();
    for (const invoice of live) {
      const key = invoice.party?.id ?? invoice.party?.name ?? "unknown";
      const entry = customers.get(key) ?? { name: invoice.party?.name ?? "Unknown party", billed: 0, due: 0, count: 0 };
      entry.billed += number(invoice.grandTotal);
      entry.due += balanceOf(invoice);
      entry.count += 1;
      customers.set(key, entry);
    }

    const documentsOf = (type: BusinessDocument["type"], hidden: string[] = ["REJECTED", "CANCELLED"]) =>
      documents.filter((document) => document.type === type && !hidden.includes(document.status));
    const value = (list: BusinessDocument[]) => list.reduce((sum, document) => sum + number(document.grandTotal), 0);

    return {
      live,
      sales,
      received,
      outstanding,
      monthSales,
      salesChange: percentChange(monthSales, lastMonthSales),
      collectionRate: sales ? Math.min(100, Math.round((received / sales) * 100)) : 0,
      overdue,
      overdueAmount: overdue.reduce((sum, invoice) => sum + balanceOf(invoice), 0),
      trend: monthlySeries(live, (invoice) => invoice.issueDate, (invoice) => number(invoice.grandTotal)),
      statusSegments: [
        { label: "Paid", count: byStatus("PAID").length, amount: amount(byStatus("PAID")), tone: "emerald" as const, icon: CheckCircle2 },
        { label: "Partially paid", count: byStatus("PARTIALLY_PAID").length, amount: amount(byStatus("PARTIALLY_PAID")), tone: "amber" as const, icon: Hourglass },
        { label: "Unpaid", count: byStatus("UNPAID").length, amount: amount(byStatus("UNPAID")), tone: "red" as const, icon: AlertTriangle },
        { label: "Cancelled", count: byStatus("CANCELLED").length, tone: "slate" as const, icon: Ban },
      ],
      topCustomers: [...customers.values()].sort((a, b) => b.billed - a.billed).slice(0, 5),
      recent: [...invoices].sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()).slice(0, 6),
      quotations: documentsOf("QUOTATION"),
      proforma: documentsOf("PROFORMA_INVOICE"),
      challans: documentsOf("DELIVERY_CHALLAN"),
      creditNotes: documentsOf("CREDIT_NOTE"),
      creditValue: value(documentsOf("CREDIT_NOTE")),
      quotationValue: value(documentsOf("QUOTATION")),
      openOrders: orders.filter(({ status }) => !["COMPLETED", "CANCELLED"].includes(status)).length,
      balanceOf,
    };
  }, [documents, invoices, orders]);

  const recentRows: RecordRow[] = view.recent.map((invoice) => ({
    id: invoice.id,
    href: `/invoices/${invoice.id}`,
    title: invoice.invoiceNumber,
    subtitle: `${invoice.party?.name ?? "Unknown party"} · ${formatDate(invoice.issueDate)}`,
    value: formatCurrency(invoice.grandTotal),
    badge: {
      label: invoice.status === "PAID" ? "Paid" : invoice.status === "PARTIALLY_PAID" ? "Part paid" : invoice.status === "CANCELLED" ? "Cancelled" : "Unpaid",
      tone: invoice.status === "PAID" ? "emerald" : invoice.status === "PARTIALLY_PAID" ? "amber" : invoice.status === "CANCELLED" ? "slate" : "red",
    },
  }));

  const overdueRows: RecordRow[] = view.overdue.slice(0, 6).map((invoice) => {
    const days = Math.max(1, Math.floor((Date.now() - new Date(invoice.dueDate ?? 0).getTime()) / DAY));
    return {
      id: invoice.id,
      href: `/invoices/${invoice.id}`,
      title: invoice.party?.name ?? "Unknown party",
      subtitle: `${invoice.invoiceNumber} · due ${formatDate(invoice.dueDate)}`,
      value: formatCurrency(view.balanceOf(invoice)),
      badge: { label: `${days}d overdue`, tone: "red" },
    };
  });

  const stats: Record<string, { stat: string; label: string }> = {
    invoices: { stat: String(view.live.length), label: "invoices" },
    quotations: { stat: String(view.quotations.length), label: `active · ${formatCompact(view.quotationValue)}` },
    proforma: { stat: String(view.proforma.length), label: "active" },
    payments: { stat: formatCompact(view.received), label: "received" },
    orders: { stat: String(view.openOrders), label: "open" },
    challans: { stat: String(view.challans.length), label: "dispatched" },
    returns: { stat: String(view.creditNotes.length), label: `notes · ${formatCompact(view.creditValue)}` },
  };

  return (
    <>
      <HeroBanner
        eyebrow="Live sales overview"
        title="Sales command centre"
        description="Invoices, estimates, payments received and customer orders at a glance, with what needs your attention today."
        actions={
          <>
            <HeroLink href="/sales/quotations/new" icon={FileText}>Estimate</HeroLink>
            <HeroLink href="/invoices/new" icon={Plus} primary>New invoice</HeroLink>
          </>
        }
      />
      {loading ? (
        <section className="card">
          <LoadingState label="Preparing sale workspace..." />
        </section>
      ) : error ? (
        <section className="card">
          <ErrorState message={error} onRetry={loadData} />
        </section>
      ) : (
        <>
          <section className="mb-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4" aria-label="Sales summary">
            <StatCard icon={IndianRupee} label="Total sales" value={formatCurrency(view.sales)} detail={`${formatCurrency(view.monthSales)} this month`} tone="blue" delta={view.salesChange} />
            <StatCard icon={Wallet} label="Payments received" value={formatCurrency(view.received)} detail={`${view.collectionRate}% collection rate`} tone="emerald" />
            <StatCard icon={Clock3} label="Outstanding" value={formatCurrency(view.outstanding)} detail={`${view.overdue.length} overdue · ${formatCurrency(view.overdueAmount)}`} tone="amber" />
            <StatCard icon={FileText} label="Open estimates" value={String(view.quotations.length)} detail={`${formatCurrency(view.quotationValue)} quoted · ${view.openOrders} open orders`} tone="violet" />
          </section>

          <section className="mb-4 grid min-w-0 items-stretch gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <Panel title="Sales trend" description="Invoiced value, last 6 months" icon={BarChart3} action={{ href: "/invoices", label: "All invoices" }}>
              <ColumnChart points={view.trend} format={formatCurrency} name="Sales" />
            </Panel>
            <Panel title="Invoice status" description="Where your invoices stand" icon={PieChart} tone="violet">
              <StatusBreakdown segments={view.statusSegments} empty="No invoices yet." />
            </Panel>
          </section>

          <section className="mb-4 grid min-w-0 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Panel title="Top customers" description="By billed value" icon={Trophy} tone="amber" action={{ href: "/parties", label: "Parties" }}>
              <RankedBars
                rows={view.topCustomers.map((customer) => ({ label: customer.name, sub: `${customer.count} invoice${customer.count === 1 ? "" : "s"} · ${formatCurrency(customer.due)} due`, value: customer.billed }))}
                format={formatCurrency}
                empty="Customers appear here once you create invoices."
              />
            </Panel>
            <Panel title="Recent invoices" description="Latest activity" icon={ReceiptText} action={{ href: "/invoices", label: "View all" }}>
              <RecordList rows={recentRows} empty="No invoices yet." />
            </Panel>
            <Panel title="Needs attention" description="Overdue payments to chase" icon={Timer} tone="red" className="md:col-span-2 xl:col-span-1">
              <RecordList rows={overdueRows} empty="Nothing is overdue. Nice work." />
            </Panel>
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <Users aria-hidden="true" size={17} className="text-blue-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Sale workspace</h2>
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
