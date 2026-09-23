"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipboardList, Plus, Search, Trash2, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatusBadge from "@/components/StatusBadge";
import Modal from "@/components/Modal";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";
import { api, getAllPages, getApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PurchaseOrder, PurchaseOrderStatus, Supplier } from "@/types";

type Filter = "ALL" | "OPEN" | "OVERDUE" | PurchaseOrderStatus;
type Line = {
  key: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
};
const newLine = (): Line => ({
  key: crypto.randomUUID(),
  description: "",
  quantity: "1",
  unit: "pcs",
  unitPrice: "",
  taxRate: "0",
});
const openStatuses: PurchaseOrderStatus[] = [
  "DRAFT",
  "SENT",
  "CONFIRMED",
  "PARTIALLY_RECEIVED",
];

export default function PurchaseOrderRegister() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [orderRes, supplierRes] = await Promise.all([
        getAllPages<PurchaseOrder>("/purchase-orders"),
        getAllPages<Supplier>("/suppliers"),
      ]);
      setOrders(orderRes.data);
      setSuppliers(supplierRes.data);
    } catch (failure) {
      setError(getApiError(failure, "Could not load purchase orders."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const today = new Date().toISOString().slice(0, 10);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return orders.filter((order) => {
      const overdue = Boolean(
        order.expectedDeliveryDate &&
        order.expectedDeliveryDate.slice(0, 10) < today &&
        openStatuses.includes(order.status),
      );
      const matches =
        filter === "ALL" ||
        (filter === "OPEN" && openStatuses.includes(order.status)) ||
        (filter === "OVERDUE" && overdue) ||
        order.status === filter;
      return (
        matches &&
        (!term ||
          [
            order.orderNumber,
            order.supplier.name,
            ...order.items.map((item) => item.description),
          ].some((value) => value.toLowerCase().includes(term)))
      );
    });
  }, [filter, orders, query, today]);
  const total = orders.reduce(
    (sum, order) => sum + Number(order.grandTotal),
    0,
  );
  return (
    <>
      <PageHeader
        eyebrow="Purchase Management"
        title="Purchase Orders"
        description="Order materials and products from suppliers independently of customer production orders."
        action={
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Create purchase order
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric
          label="Purchase orders"
          value={orders.length.toLocaleString("en-IN")}
        />
        <Metric
          label="Open orders"
          value={orders
            .filter((order) => openStatuses.includes(order.status))
            .length.toLocaleString("en-IN")}
        />
        <Metric label="Ordered value" value={formatCurrency(total)} wide />
      </div>
      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Purchase order register
              </h2>

              <p className="text-[10px] text-slate-400">
                Supplier procurement orders
              </p>
            </div>

            <div className="relative w-full sm:w-80">
              {!query && (
                <Search
                  aria-hidden="true"
                  size={15}
                  className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                />
              )}

              <input
                type="text"
                aria-label="Search purchase orders"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="PO, supplier, material..."
                className={`input-field w-full pr-10 ${query ? "!pl-4" : "!pl-12"
                  }`}
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto">
            {(
              [
                "ALL",
                "OPEN",
                "OVERDUE",
                "DRAFT",
                "SENT",
                "CONFIRMED",
                "PARTIALLY_RECEIVED",
                "RECEIVED",
                "CLOSED",
                "CANCELLED",
              ] as Filter[]
            ).map((value) => (
              <button
                key={value}
                type="button"
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
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No purchase orders found"
            description={
              query || filter !== "ALL"
                ? "Try changing the filters."
                : "Create your first supplier purchase order."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">PO number</th>
                  <th className="px-4 py-3">Supplier</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">PO date</th>
                  <th className="px-4 py-3">Expected</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-blue-50/30">
                    <td className="px-4 py-3.5 font-bold text-blue-700">
                      {order.orderNumber}
                    </td>
                    <td className="px-4 py-3.5 font-semibold">
                      {order.supplier.name}
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="max-w-72 truncate font-semibold">
                        {order.items.map((item) => item.description).join(", ")}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {order.items.length} line
                        {order.items.length === 1 ? "" : "s"}
                      </p>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {formatDate(order.orderDate)}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {order.expectedDeliveryDate
                        ? formatDate(order.expectedDeliveryDate)
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold">
                      {formatCurrency(order.grandTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {showCreate && (
        <CreateModal
          suppliers={suppliers}
          onClose={() => setShowCreate(false)}
          onSaved={(order) => {
            setOrders((current) => [order, ...current]);
            setShowCreate(false);
          }}
        />
      )}
    </>
  );
}

function CreateModal({
  suppliers,
  onClose,
  onSaved,
}: {
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: (order: PurchaseOrder) => void;
}) {
  const now = new Date();
  const [form, setForm] = useState({
    orderNumber: `PO-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${String(now.getTime()).slice(-4)}`,
    supplierId: "",
    orderDate: now.toISOString().slice(0, 10),
    expectedDeliveryDate: "",
    deliveryLocation: "",
    paymentTerms: "",
    notes: "",
    discount: "0",
  });
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const subtotal = lines.reduce(
    (sum, line) => sum + Number(line.quantity) * Number(line.unitPrice),
    0,
  );
  const tax = lines.reduce(
    (sum, line) =>
      sum +
      (Number(line.quantity) * Number(line.unitPrice) * Number(line.taxRate)) /
      100,
    0,
  );
  const total = subtotal + tax - Number(form.discount || 0);
  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines((current) =>
      current.map((line) => (line.key === key ? { ...line, ...patch } : line)),
    );
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const items = lines
      .filter((line) => line.description.trim())
      .map(({ key: _key, ...line }) => ({
        ...line,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unitPrice: Number(line.unitPrice),
        taxRate: Number(line.taxRate),
      }));
    if (!items.length || total < 0)
      return setError("Add at least one valid item and check the discount.");
    setSaving(true);
    setError("");
    try {
      const { data } = await api.post<PurchaseOrder>("/purchase-orders", {
        ...form,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        deliveryLocation: form.deliveryLocation.trim() || undefined,
        paymentTerms: form.paymentTerms.trim() || undefined,
        notes: form.notes.trim() || undefined,
        discount: Number(form.discount),
        items,
      });
      onSaved(data);
    } catch (failure) {
      setError(getApiError(failure, "Could not create the purchase order."));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Create purchase order" onClose={onClose} size="xl">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Purchase order no. *">
            <input
              required
              maxLength={60}
              className="input-field"
              value={form.orderNumber}
              onChange={(event) =>
                setForm({ ...form, orderNumber: event.target.value })
              }
            />
          </Field>
          <Field label="Supplier *">
            <select
              required
              className="input-field"
              value={form.supplierId}
              onChange={(event) =>
                setForm({ ...form, supplierId: event.target.value })
              }
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="PO date *">
            <input
              required
              type="date"
              className="input-field"
              value={form.orderDate}
              onChange={(event) =>
                setForm({ ...form, orderDate: event.target.value })
              }
            />
          </Field>
          <Field label="Expected delivery">
            <input
              type="date"
              min={form.orderDate}
              className="input-field"
              value={form.expectedDeliveryDate}
              onChange={(event) =>
                setForm({ ...form, expectedDeliveryDate: event.target.value })
              }
            />
          </Field>
          <Field label="Delivery location">
            <input
              className="input-field"
              value={form.deliveryLocation}
              onChange={(event) =>
                setForm({ ...form, deliveryLocation: event.target.value })
              }
            />
          </Field>
          <Field label="Payment terms">
            <input
              className="input-field"
              value={form.paymentTerms}
              onChange={(event) =>
                setForm({ ...form, paymentTerms: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th>Material / product</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Rate</th>
                <th>Tax %</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.key}>
                  <td>
                    <input
                      required
                      className="input-field"
                      value={line.description}
                      onChange={(event) =>
                        updateLine(line.key, {
                          description: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td>
                    <input
                      required
                      type="number"
                      min="0.001"
                      step="any"
                      className="input-field"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(line.key, { quantity: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      required
                      className="input-field"
                      value={line.unit}
                      onChange={(event) =>
                        updateLine(line.key, { unit: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-field"
                      value={line.unitPrice}
                      onChange={(event) =>
                        updateLine(line.key, { unitPrice: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      className="input-field"
                      value={line.taxRate}
                      onChange={(event) =>
                        updateLine(line.key, { taxRate: event.target.value })
                      }
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      aria-label="Remove line"
                      disabled={lines.length === 1}
                      onClick={() =>
                        setLines((current) =>
                          current.filter(({ key }) => key !== line.key),
                        )
                      }
                      className="p-2 text-red-600"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setLines((current) => [...current, newLine()])}
        >
          <Plus size={14} /> Add line
        </button>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Discount">
            <input
              type="number"
              min="0"
              step="0.01"
              className="input-field"
              value={form.discount}
              onChange={(event) =>
                setForm({ ...form, discount: event.target.value })
              }
            />
          </Field>
          <Field label="Notes">
            <textarea
              rows={2}
              className="input-field resize-none"
              value={form.notes}
              onChange={(event) =>
                setForm({ ...form, notes: event.target.value })
              }
            />
          </Field>
        </div>
        <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          Subtotal {formatCurrency(subtotal)} · Tax {formatCurrency(tax)}{" "}
          <strong className="float-right">Total {formatCurrency(total)}</strong>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={saving || !suppliers.length}
            className="btn-primary"
          >
            {saving ? "Creating..." : "Create purchase order"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
function Metric({
  label,
  value,
  wide = false,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={`card p-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">
        {value}
      </p>
    </div>
  );
}
