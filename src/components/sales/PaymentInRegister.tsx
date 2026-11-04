"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CircleDollarSign, Plus, Search, X } from "lucide-react";
import InvoicePaymentForm from '@/components/invoices/InvoicePaymentForm';
import AccountSelect from "@/components/accounting/AccountSelect";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import RowActions from "@/components/RowActions";
import { toast } from "@/components/ToastProvider";
import { whatsappLink } from "@/lib/messageTemplates";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";
import { invoiceOutstanding } from '@/lib/outstanding';
import { api, getAllPages, getApiError, getCurrentUser } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Invoice, PaymentInRecord } from "@/types";

export default function PaymentInRegister() {
  const [rows, setRows] = useState<PaymentInRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PaymentInRecord | null>(null);
  const [deleting, setDeleting] = useState<PaymentInRecord | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  // Deleting is permanent, so only owners get it.
  const [canDelete, setCanDelete] = useState(false);
  useEffect(() => {
    void getCurrentUser().then((user) => setCanDelete(user?.role === "OWNER" || user?.role === "SUPER_ADMIN")).catch(() => undefined);
  }, []);

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/invoices/payments/${deleting.id}`);
      toast.success("Payment deleted", { description: `${formatCurrency(deleting.amount)} removed from ${deleting.invoice.invoiceNumber}.` });
      setDeleting(null);
      await load();
    } catch (deleteError) {
      toast.error(getApiError(deleteError, "Could not delete payment."));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function printInvoice(invoiceId: string) {
    const tab = window.open("about:blank", "_blank");
    if (!tab) return toast.error("Allow pop-ups to view this PDF.");
    tab.opener = null;
    try {
      const { data } = await api.get<Blob>(`/invoices/${invoiceId}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (pdfError) {
      tab.close();
      toast.error(getApiError(pdfError, "Could not open PDF."));
    }
  }

  const receiptText = (row: PaymentInRecord) =>
    `Payment received for invoice ${row.invoice.invoiceNumber}\nAmount: ${formatCurrency(row.amount)}\nDate: ${formatDateTime(row.paidAt)}${row.reference ? `\nRef: ${row.reference}` : ""}\nThank you!`;

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
            !["PAID", "CANCELLED", "DRAFT"].includes(invoice.status) &&
            invoiceOutstanding(invoice) > 0,
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
        title="Payment-In"
        description="Record and review money received from customers against sale invoices."
        action={
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus size={16} />
            Add Payment-In
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
      <section className="card reference-payment-register overflow-hidden">
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
                  <th className="px-5 py-3">Paid date and time</th>
                  <th className="px-5 py-3">Invoice</th>
                  <th className="px-5 py-3">Party</th>
                  <th className="px-5 py-3">Method</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-3 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const paid =
                    invoiceOutstanding(row.invoice) === 0;
                  return (
                    <tr key={row.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3.5 text-slate-500">
                        {formatDateTime(row.paidAt)}
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
                      <td className="px-3 py-3.5 text-right">
                        <RowActions
                          label={`Actions for payment on ${row.invoice.invoiceNumber}`}
                          actions={[
                            { label: "View invoice", icon: "view", href: `/invoices/${row.invoice.id}` },
                            { label: "Edit payment", icon: "edit", onClick: () => setEditing(row) },
                            { label: "Print invoice", icon: "print", onClick: () => void printInvoice(row.invoice.id) },
                            { label: "Share receipt on WhatsApp", icon: "whatsapp", href: whatsappLink(row.invoice.party.phone, receiptText(row)), external: true },
                            !!row.invoice.party.email && { label: "Email receipt", icon: "email", href: `mailto:${encodeURIComponent(row.invoice.party.email ?? "")}?subject=${encodeURIComponent(`Payment received · ${row.invoice.invoiceNumber}`)}&body=${encodeURIComponent(receiptText(row))}`, external: true },
                            canDelete && { label: "Delete", icon: "delete", danger: true, onClick: () => setDeleting(row) },
                          ]}
                        />
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
      {editing && (
        <EditPaymentModal
          payment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this payment?"
          message={`${formatCurrency(deleting.amount)} received from ${deleting.invoice.party.name} will be removed, and invoice ${deleting.invoice.invoiceNumber} will show that much as due again. This can't be undone.`}
          confirmLabel="Delete payment"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

/** `datetime-local` works in local time, so convert to and from the stored UTC instant. */
const toLocalInput = (value: string) => {
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export function EditPaymentModal({ payment, onClose, onSaved }: { payment: PaymentInRecord; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(Number(payment.amount)));
  const [method, setMethod] = useState(payment.method);
  const [accountId, setAccountId] = useState(payment.accountId ?? "");
  const [reference, setReference] = useState(payment.reference ?? "");
  const [paidAt, setPaidAt] = useState(() => toLocalInput(payment.paidAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const maxAmount = Number(payment.amount) + invoiceOutstanding(payment.invoice);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > maxAmount + 0.005) return setError(`Enter an amount between ₹0.01 and ${formatCurrency(maxAmount)}.`);
    setSaving(true);
    setError("");
    try {
      await api.patch(`/invoices/payments/${payment.id}`, {
        amount: value,
        method,
        accountId: accountId || null,
        reference: reference.trim(),
        paidAt: paidAt ? new Date(paidAt).toISOString() : undefined,
      });
      toast.success("Payment updated", { description: `${formatCurrency(value)} on ${payment.invoice.invoiceNumber}` });
      onSaved();
    } catch (saveError) {
      setError(getApiError(saveError, "Could not update payment."));
      setSaving(false);
    }
  }

  return (
    <Modal title="Edit Payment-In" onClose={onClose} size="md">
      <form onSubmit={submit} className="space-y-3">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <p className="text-xs text-slate-500">
          Invoice <strong className="text-slate-700">{payment.invoice.invoiceNumber}</strong> · {payment.invoice.party.name}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Amount received *</span>
            <input required type="number" min="0.01" max={maxAmount} step="0.01" className="input-field" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Paid date and time *</span>
            <input required type="datetime-local" className="input-field" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Payment method *</span>
            <select className="input-field" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="bank_transfer">Bank transfer</option>
              <option value="cheque">Cheque</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Reference</span>
            <input maxLength={191} className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR or cheque number" />
          </label>
        </div>
        <AccountSelect value={accountId} onChange={setAccountId} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}

function PaymentInModal({ invoices, onClose, onSaved }: { invoices: Invoice[]; onClose: () => void; onSaved: () => void }) {
  const [invoiceId, setInvoiceId] = useState('');
  const [saving, setSaving] = useState(false);
  const selected = invoices.find(({ id }) => id === invoiceId);
  return <Modal title="Payment-In" onClose={() => { if (!saving) onClose(); }} size="lg">
    <div className="space-y-4">
      <label className="block"><span className="label">Sale invoice *</span>
        <select aria-label="Sale invoice" disabled={saving} className="input-field" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
          <option value="">Select unpaid invoice</option>
          {invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.party.name} · Due {formatCurrency(invoiceOutstanding(invoice))}</option>)}
        </select>
      </label>
      {!invoices.length && <p className="text-sm text-slate-500">No outstanding invoices to receive payment against.</p>}
      {selected && <InvoicePaymentForm key={selected.id} invoice={selected} onSavingChange={setSaving} onSaved={onSaved} />}
    </div>
  </Modal>;
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
