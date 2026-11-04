"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardList, Plus, Search, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import RowActions from "@/components/RowActions";
import StatusBadge from "@/components/StatusBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ContentState";
import { usePurchaseOrderActions } from "@/components/purchases/purchaseOrderActions";
import { getAllPages, getApiError } from "@/lib/api";
import { localDate } from "@/lib/business-report";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PurchaseOrder, PurchaseOrderStatus } from "@/types";

type Filter = "ALL" | "OPEN" | "OVERDUE" | PurchaseOrderStatus;
const openStatuses: PurchaseOrderStatus[] = ["DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED"];
const FILTERS: Filter[] = ["ALL", "OPEN", "OVERDUE", "DRAFT", "SENT", "CONFIRMED", "PARTIALLY_RECEIVED", "RECEIVED", "CLOSED", "CANCELLED"];

export default function PurchaseOrderRegister() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const { data } = await getAllPages<PurchaseOrder>("/purchase-orders");
      setOrders(data);
    } catch (failure) {
      setError(getApiError(failure, "Could not load purchase orders."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const { actionsFor, dialogs, busyId } = usePurchaseOrderActions({ onChanged: () => void load({ quiet: true }) });

  const today = localDate();
  const isOverdue = useCallback(
    (order: PurchaseOrder) => Boolean(order.expectedDeliveryDate && order.expectedDeliveryDate.slice(0, 10) < today && openStatuses.includes(order.status)),
    [today],
  );
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => {
      const matches = filter === "ALL" || (filter === "OPEN" && openStatuses.includes(order.status)) || (filter === "OVERDUE" && isOverdue(order)) || order.status === filter;
      return matches && (!term || [order.orderNumber, order.supplier.name, ...order.items.map((item) => item.description)].some((value) => value.toLowerCase().includes(term)));
    });
  }, [filter, isOverdue, orders, query]);
  const live = orders.filter((order) => order.status !== "CANCELLED");
  const total = live.reduce((sum, order) => sum + Number(order.grandTotal), 0);
  const openCount = orders.filter((order) => openStatuses.includes(order.status)).length;

  return (
    <>
      <PageHeader
        eyebrow="Purchase Management"
        title="Purchase Orders"
        description="Order materials and products from suppliers independently of customer production orders."
        action={
          <Link href="/purchases/orders/new" className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Create purchase order
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Purchase orders" value={orders.length.toLocaleString("en-IN")} />
        <Metric label="Open orders" value={openCount.toLocaleString("en-IN")} />
        <Metric label="Ordered value" value={formatCurrency(total)} wide />
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Purchase order register</h2>
              <p className="text-[10px] text-slate-400">Supplier procurement orders</p>
            </div>
            <div className="relative w-full sm:w-80">
              {!query && <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" />}
              <input
                type="text"
                aria-label="Search purchase orders"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PO, supplier, material..."
                className={`input-field w-full pr-10 ${query ? "!pl-4" : "!pl-12"}`}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {FILTERS.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${filter === value ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {value.replaceAll("_", " ")}
              </button>
            ))}
          </div>
        </div>
        {loading ? (
          <LoadingState label="Loading purchase orders..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No purchase orders found"
            description={query || filter !== "ALL" ? "Try changing the filters." : "Create your first supplier purchase order."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">PO date</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <tr key={order.id} className={`hover:bg-blue-50/30 ${busyId === order.id ? "opacity-60" : ""}`}>
                    <td className="px-4 py-3.5">
                      <Link href={`/purchases/orders/${order.id}`} className="font-bold text-blue-700 hover:underline">{order.orderNumber}</Link>
                    </td>
                    <td className="px-4 py-3.5 font-semibold">{order.supplier.name}</td>
                    <td className="px-4 py-3.5">
                      <p className="max-w-72 truncate font-semibold">{order.items.map((item) => item.description).join(", ")}</p>
                      <p className="text-[10px] text-slate-400">{order.items.length} line{order.items.length === 1 ? "" : "s"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">{formatDate(order.orderDate)}</td>
                    <td className={`px-4 py-3.5 ${isOverdue(order) ? "font-semibold text-red-600" : "text-slate-500"}`}>
                      {order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : "—"}
                      {isOverdue(order) && <span className="block text-[10px]">Overdue</span>}
                    </td>
                    <td className="px-4 py-3.5"><StatusBadge status={order.status} /></td>
                    <td className="px-4 py-3.5 text-right font-bold">{formatCurrency(order.grandTotal)}</td>
                    <td className="px-4 py-3.5 text-right">
                      <RowActions label={`Actions for ${order.orderNumber}`} actions={actionsFor(order)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {dialogs}
    </>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`card p-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
