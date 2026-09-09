"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  ClipboardList,
  FileText,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { ErrorState, LoadingState } from "@/components/ContentState";
import { getAllPages, getApiError } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { BusinessDocument, Invoice, ProductionOrder } from "@/types";

const SECTIONS: Array<{
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  tone: string;
}> = [
  {
    href: "/invoices",
    label: "Sale Invoices",
    description: "Final customer invoices and outstanding balances.",
    icon: ReceiptText,
    tone: "bg-blue-50 text-blue-700",
  },
  {
    href: "/sales/quotations",
    label: "Estimate / Quotation",
    description: "Price estimates and professional proposals.",
    icon: FileText,
    tone: "bg-indigo-50 text-indigo-700",
  },
  {
    href: "/sales/proforma",
    label: "Proforma Invoice",
    description: "Preliminary invoices and advance requests.",
    icon: ShoppingBag,
    tone: "bg-violet-50 text-violet-700",
  },
  {
    href: "/sales/payment-in",
    label: "Payment-In",
    description: "Payments received against sale invoices.",
    icon: CircleDollarSign,
    tone: "bg-emerald-50 text-emerald-700",
  },
  {
    href: "/sales/orders",
    label: "Sale Order",
    description: "Customer orders linked to business projects.",
    icon: ClipboardList,
    tone: "bg-cyan-50 text-cyan-700",
  },
  {
    href: "/sales/delivery-challans",
    label: "Delivery Challan",
    description: "Goods dispatched for delivery or job work.",
    icon: Truck,
    tone: "bg-sky-50 text-sky-700",
  },
  {
    href: "/sales/returns",
    label: "Sale Return / Credit Note",
    description: "Returns, discounts, and invoice corrections.",
    icon: RotateCcw,
    tone: "bg-amber-50 text-amber-700",
  },
];

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
      const [invoiceResponse, documentResponse, orderResponse] =
        await Promise.all([
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

  const summary = useMemo(
    () => ({
      sales: invoices.reduce(
        (sum, invoice) => sum + Number(invoice.grandTotal),
        0,
      ),
      received: invoices.reduce(
        (sum, invoice) => sum + Number(invoice.amountPaid),
        0,
      ),
      quotations: documents.filter(
        (document) =>
          document.type === "QUOTATION" &&
          !["REJECTED", "CANCELLED"].includes(document.status),
      ).length,
      openOrders: orders.filter(
        (order) => !["COMPLETED", "CANCELLED"].includes(order.status),
      ).length,
    }),
    [documents, invoices, orders],
  );

  return (
    <>
      <PageHeader
        title="Sale"
        description="Manage invoices, estimates, payments, customer orders, delivery challans, and returns."
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
          <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Metric label="Total sales" value={formatCurrency(summary.sales)} />
            <Metric
              label="Payments received"
              value={formatCurrency(summary.received)}
            />
            <Metric
              label="Active quotations"
              value={summary.quotations.toLocaleString("en-IN")}
            />
            <Metric
              label="Open sale orders"
              value={summary.openOrders.toLocaleString("en-IN")}
            />
          </div>
          <section>
            <div className="mb-3">
              <h2 className="text-sm font-bold text-slate-900">
                Sale workspace
              </h2>
              <p className="text-[10px] text-slate-400">
                Choose a register to continue
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {SECTIONS.map(
                ({ href, label, description, icon: Icon, tone }) => (
                  <Link
                    key={href}
                    href={href}
                    className="card group flex min-h-28 items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tone}`}
                    >
                      <Icon aria-hidden="true" size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-slate-900">
                        {label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {description}
                      </span>
                    </span>
                    <ArrowRight
                      aria-hidden="true"
                      size={17}
                      className="shrink-0 text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                    />
                  </Link>
                ),
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card min-w-0 p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 truncate text-lg font-extrabold text-slate-950 sm:text-xl">
        {value}
      </p>
    </div>
  );
}
