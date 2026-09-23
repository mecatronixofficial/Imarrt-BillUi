"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, Plus, Search, WalletCards, X } from "lucide-react";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";
import { toast } from "@/components/ToastProvider";
import { api, getAllPages, getApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Invoice, PaymentInRecord } from "@/types";

const METHODS = [
  ["cash", "Cash"],
  ["bank_transfer", "Bank transfer"],
  ["upi", "UPI"],
  ["cheque", "Cheque"],
  ["other", "Other"],
] as const;
const today = () => new Date().toISOString().slice(0, 10);

export default function PaymentInRegister() {
  const [rows, setRows] = useState<PaymentInRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [paymentRes, invoiceRes] = await Promise.all([
        getAllPages<PaymentInRecord>("/invoices/payments/register"),
        getAllPages<Invoice>("/invoices"),
      ]);
      setRows(paymentRes.data);
      setInvoices(
        invoiceRes.data.filter(
          (invoice) =>
            !["PAID", "CANCELLED"].includes(invoice.status) &&
            Number(invoice.grandTotal) > Number(invoice.amountPaid),
        ),
      );
    } catch (loadError) {
      setError(getApiError(loadError, "Could not load payment-in records."));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return term
      ? rows.filter(({ invoice, method, reference }) =>
        [invoice.invoiceNumber, invoice.party.name, method, reference].some(
          (value) => value?.toLowerCase().includes(term),
        ),
      )
      : rows;
  }, [query, rows]);
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const methods = new Set(rows.map(({ method }) => method)).size;

  return (
    <>
      <PageHeader
        title="Payment In"
        description="Record and review money received from customers against sale invoices."
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Record payment
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Receipts" value={rows.length.toLocaleString("en-IN")} />
        <Metric
          label="Payment methods"
          value={methods.toLocaleString("en-IN")}
        />
        <Metric label="Total received" value={formatCurrency(total)} wide />
      </div>
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Payment In register
            </h2>

            <p className="mt-0.5 text-[10px] text-slate-400">
              Company and branch-specific customer receipts
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
              aria-label="Search payment in"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Invoice, party, method, reference..."
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
        {loading ? (
          <LoadingState label="Loading payments..." />
        ) : error ? (
          <ErrorState message={error} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="No payments received"
            description={
              query
                ? "Try a different search."
                : "Record a customer payment to begin this register."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Party</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const paid =
                    Number(row.invoice.amountPaid) >=
                    Number(row.invoice.grandTotal);
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 text-slate-500">
                        {formatDate(row.paidAt)}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/invoices/${row.invoice.id}`}
                          className="font-bold text-blue-700 hover:underline"
                        >
                          {row.invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-slate-700">
                        {row.invoice.party.name}
                      </td>
                      <td className="px-5 py-3.5 capitalize text-slate-600">
                        {row.method.replaceAll("_", " ")}
                      </td>
                      <td className="px-5 py-3.5 text-slate-500">
                        {row.reference || "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-bold ${paid ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
                        >
                          {paid ? "Paid" : "Partially paid"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-bold text-emerald-700">
                        {formatCurrency(row.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {open && (
        <PaymentInModal
          invoices={invoices}
          onClose={() => setOpen(false)}
          onSaved={() => {
            setOpen(false);
            void load();
          }}
        />
      )}
    </>
  );
}

function PaymentInModal({
  invoices,
  onClose,
  onSaved,
}: {
  invoices: Invoice[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [invoiceId, setInvoiceId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selected = invoices.find(({ id }) => id === invoiceId);
  const outstanding = selected
    ? Number(selected.grandTotal) - Number(selected.amountPaid)
    : 0;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/invoices/${invoiceId}/payments`, {
        amount: Number(amount),
        method,
        reference: reference.trim() || undefined,
        paidAt,
      });
      toast.success("Payment received", {
        description: `${formatCurrency(Number(amount))} recorded against ${selected.invoiceNumber}.`,
      });
      onSaved();
    } catch (saveError) {
      const message = getApiError(saveError, "Could not record payment.");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal title="Record Payment In" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700"
          >
            {error}
          </div>
        )}
        <div>
          <label className="label">Sale invoice *</label>
          <select
            required
            className="input-field"
            value={invoiceId}
            onChange={(event) => {
              const id = event.target.value;
              const invoice = invoices.find((entry) => entry.id === id);
              setInvoiceId(id);
              setAmount(
                invoice
                  ? String(
                    Number(invoice.grandTotal) - Number(invoice.amountPaid),
                  )
                  : "",
              );
            }}
          >
            <option value="">Select unpaid invoice</option>
            {invoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoiceNumber} · {invoice.party.name} · Due{" "}
                {formatCurrency(
                  Number(invoice.grandTotal) - Number(invoice.amountPaid),
                )}
              </option>
            ))}
          </select>
        </div>
        {selected && (
          <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">
            <WalletCards size={16} className="mb-1" />
            Previous balance: <strong>{formatCurrency(outstanding)}</strong>
            <span className="float-right">
              Remaining:{" "}
              <strong>
                {formatCurrency(
                  Math.max(0, outstanding - (Number(amount) || 0)),
                )}
              </strong>
            </span>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount received *">
            <input
              required
              type="number"
              min="0.01"
              max={outstanding || undefined}
              step="0.01"
              className="input-field"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Receipt date *">
            <input
              required
              type="date"
              className="input-field"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </Field>
          <Field label="Payment method *">
            <select
              className="input-field"
              value={method}
              onChange={(e) => setMethod(e.target.value)}
            >
              {METHODS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Reference / transaction ID">
            <input
              className="input-field"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="UTR or cheque number"
            />
          </Field>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={saving || !selected} className="btn-primary">
            {saving ? "Saving..." : "Save receipt"}
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
      <p className="mt-1.5 text-xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
