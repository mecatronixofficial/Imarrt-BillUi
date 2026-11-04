"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Ban, CircleDollarSign, ExternalLink, Loader2, MoreVertical, Paperclip, Pencil, Plus, RotateCcw, Search, Trash2, X } from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import Modal from "@/components/Modal";
import PageHeader from "@/components/PageHeader";
import { MenuButton, MenuLink, Popover } from "@/components/PopoverMenu";
import { EmptyState, ErrorState, LoadingState } from "@/components/ContentState";
import { toast } from "@/components/ToastProvider";
import PaymentOutForm from "@/components/purchases/PaymentOutForm";
import { api, getAllPages, getApiError, getCurrentUser } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { BusinessDocument, PaymentOutReceipt } from "@/types";

type FormState = { receipt?: PaymentOutReceipt; supplierId?: string; billId?: string } | null;

export default function PaymentOutRegister() {
  const [rows, setRows] = useState<PaymentOutReceipt[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState<FormState>(null);
  const [voiding, setVoiding] = useState<PaymentOutReceipt | null>(null);
  const [deleting, setDeleting] = useState<PaymentOutReceipt | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [restoringId, setRestoringId] = useState("");
  const [showVoided, setShowVoided] = useState(true);
  // Deleting is permanent, so only owners get it; everyone else can void instead.
  const [canDelete, setCanDelete] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError("");
    try {
      const { data } = await getAllPages<PaymentOutReceipt>("/payment-out");
      setRows(data);
    } catch (loadError) {
      setError(getApiError(loadError, "Could not load payment-out records."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void getCurrentUser().then((current) => setCanDelete(current?.role === "OWNER" || current?.role === "SUPER_ADMIN")).catch(() => undefined);
  }, [load]);

  // "Make payment" on Purchase Bills links here with ?billId=<bill>.
  const requestedBillId = useRef(typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("billId") : null);
  useEffect(() => {
    const billId = requestedBillId.current;
    if (!billId) return;
    requestedBillId.current = null;
    api.get<BusinessDocument>(`/documents/${billId}`)
      .then(({ data }) => {
        if (data.supplierId) setForm({ supplierId: data.supplierId, billId });
        else toast.error("This bill has no supplier, so a payment can't be recorded against it.");
      })
      .catch((billError) => toast.error(getApiError(billError, "Could not open that bill.")));
  }, []);

  const activeRows = useMemo(() => rows.filter((row) => !row.voidedAt), [rows]);
  const voidedCount = rows.length - activeRows.length;
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const visible = showVoided ? rows : activeRows;
    if (!term) return visible;
    return visible.filter((row) => [row.receiptNumber, row.supplier?.name, row.reference, ...row.paymentTypes, ...row.bills.flatMap((bill) => [bill.documentNumber, bill.referenceNumber])].some((value) => value?.toLowerCase().includes(term)));
  }, [activeRows, query, rows, showVoided]);
  const totals = useMemo(() => ({
    paid: activeRows.reduce((sum, row) => sum + row.paid, 0),
    discount: activeRows.reduce((sum, row) => sum + row.discount, 0),
  }), [activeRows]);

  const restore = useCallback(async (receipt: PaymentOutReceipt) => {
    setRestoringId(receipt.id);
    try {
      await api.post(`/payment-out/${receipt.id}/restore`);
      toast.success("Payment restored", { description: `${receipt.receiptNumber} is applied to its bills again.` });
      await load({ quiet: true });
    } catch (restoreError) {
      toast.error(getApiError(restoreError, "Could not restore payment."));
    } finally {
      setRestoringId("");
    }
  }, [load]);

  async function remove() {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.delete(`/payment-out/${deleting.id}`);
      toast.success("Payment deleted", { description: `${deleting.receiptNumber} was removed permanently.` });
      setDeleting(null);
      await load({ quiet: true });
    } catch (deleteError) {
      toast.error(getApiError(deleteError, "Could not delete payment."));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Purchase Management"
        title="Payment-Out"
        description="Record money paid to suppliers and settle their purchase bills."
        action={
          <button type="button" onClick={() => setForm({})} className="btn-primary inline-flex items-center gap-2">
            <Plus size={16} />
            Add Payment-Out
          </button>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Payments" value={activeRows.length.toLocaleString("en-IN")} />
        <Metric label="Total paid" value={formatCurrency(totals.paid)} />
        <Metric label="Discount received" value={formatCurrency(totals.discount)} wide />
      </div>
      <section className="card reference-payment-register overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Payment Out register</h2>
            <p className="mt-0.5 text-[10px] text-slate-400">Supplier payments for the active company and branch</p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
            {voidedCount > 0 && (
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                <input type="checkbox" checked={showVoided} onChange={(event) => setShowVoided(event.target.checked)} />
                Show voided ({voidedCount})
              </label>
            )}
            <div className="relative w-full sm:w-80">
              {!query && <Search aria-hidden="true" size={15} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" />}
              <input
                type="text"
                aria-label="Search payment out"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Receipt, party, bill, reference..."
                className={`input-field w-full pr-10 ${query ? "!pl-4" : "!pl-12"}`}
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                  <X aria-hidden="true" size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        {loading ? (
          <LoadingState label="Loading payments..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={CircleDollarSign}
            title="No outgoing payments"
            description={query ? "Try a different search." : "Record a payment to a supplier to settle their purchase bills."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Receipt No</th>
                  <th className="px-4 py-3">Party</th>
                  <th className="px-4 py-3">Payment type</th>
                  <th className="px-4 py-3">Bills settled</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Discount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((row) => {
                  const voided = Boolean(row.voidedAt);
                  return (
                    <tr key={row.id} className={voided ? "bg-slate-50/70 text-slate-400" : "hover:bg-slate-50"}>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{formatDate(row.paidAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <button type="button" onClick={() => setForm({ receipt: row })} className="font-bold text-blue-700 hover:underline">{row.receiptNumber}</button>
                        {row.attachmentCount > 0 && (
                          <span title={`${row.attachmentCount} attachment${row.attachmentCount === 1 ? "" : "s"}`} className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-slate-400">
                            <Paperclip size={11} />{row.attachmentCount}
                          </span>
                        )}
                      </td>
                      <td className="max-w-[200px] truncate px-4 py-3.5 font-semibold text-slate-700" title={row.supplier?.name}>{row.supplier?.name || "Not assigned"}</td>
                      <td className="max-w-[180px] truncate px-4 py-3.5 text-slate-600" title={row.paymentTypes.join(", ")}>{row.paymentTypes.join(", ") || "Discount only"}{row.reference ? <span className="block text-[10px] text-slate-400">Ref: {row.reference}</span> : null}</td>
                      <td className="max-w-[220px] px-4 py-3.5 text-xs text-slate-600">
                        {row.bills.slice(0, 2).map((bill) => (
                          <Link key={bill.id} href={`/documents/${bill.id}`} className="block truncate hover:text-blue-700 hover:underline">
                            {bill.referenceNumber || bill.documentNumber} · {formatCurrency(bill.settled)}
                          </Link>
                        ))}
                        {row.bills.length > 2 && <span className="text-[10px] text-slate-400">+{row.bills.length - 2} more</span>}
                      </td>
                      <td className={`whitespace-nowrap px-4 py-3.5 text-right font-bold ${voided ? "text-slate-400 line-through" : "text-red-600"}`}>{formatCurrency(row.paid)}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-slate-600">{row.discount ? formatCurrency(row.discount) : "—"}</td>
                      <td className="px-4 py-3.5">
                        {voided ? (
                          <span title={row.voidReason ? `Reason: ${row.voidReason}` : undefined} className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">Voided</span>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">Paid</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex justify-end">
                          {restoringId === row.id ? (
                            <span className="flex h-8 w-8 items-center justify-center text-slate-400" role="status" aria-label="Restoring payment">
                              <Loader2 size={16} className="animate-spin" />
                            </span>
                          ) : (
                            <Popover
                              label={`Actions for ${row.receiptNumber}`}
                              align="right"
                              trigger={(menuOpen) => (
                                <span className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-slate-100 hover:text-slate-800 ${menuOpen ? "bg-slate-100 text-slate-800" : "text-slate-500"}`}>
                                  <MoreVertical size={16} />
                                </span>
                              )}
                            >
                              {(close) => (
                                <div role="menu" className="w-56 py-1">
                                  <MenuButton icon={<Pencil size={15} />} onClick={() => { close(); setForm({ receipt: row }); }}>{voided ? "View details" : "View / Edit details"}</MenuButton>
                                  {row.supplierId && !voided && (
                                    <MenuButton icon={<Plus size={15} />} onClick={() => { close(); setForm({ supplierId: row.supplierId ?? undefined }); }}>New payment to this party</MenuButton>
                                  )}
                                  {row.bills.slice(0, 3).map((bill) => (
                                    <MenuLink key={bill.id} icon={<ExternalLink size={15} />} href={`/documents/${bill.id}`} onClick={close}>Open bill {bill.referenceNumber || bill.documentNumber}</MenuLink>
                                  ))}
                                  {voided ? (
                                    <MenuButton icon={<RotateCcw size={15} />} onClick={() => { close(); void restore(row); }}>Restore payment</MenuButton>
                                  ) : (
                                    <MenuButton icon={<Ban size={15} />} danger onClick={() => { close(); setVoiding(row); }}>Void payment</MenuButton>
                                  )}
                                  {canDelete && (
                                    <MenuButton icon={<Trash2 size={15} />} danger onClick={() => { close(); setDeleting(row); }}>Delete permanently</MenuButton>
                                  )}
                                </div>
                              )}
                            </Popover>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {form && (
        <PaymentOutForm
          receipt={form.receipt}
          initialSupplierId={form.supplierId}
          initialBillId={form.billId}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            void load({ quiet: true });
          }}
        />
      )}
      {voiding && (
        <VoidPaymentModal
          receipt={voiding}
          onClose={() => setVoiding(null)}
          onVoided={(receipt) => {
            setVoiding(null);
            toast.warning("Payment voided", {
              description: `${receipt.receiptNumber} no longer counts against its bills.`,
              duration: 10000,
              action: { label: "Undo", onClick: () => void restore(receipt) },
            });
            void load({ quiet: true });
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete payment permanently?"
          message={`${deleting.receiptNumber} (${formatCurrency(deleting.total)}) to ${deleting.supplier?.name || "the supplier"} will be removed${deleting.voidedAt ? "" : " and its amount added back to the bills it settled"}. This can't be undone. Use Void instead if you may need it again.`}
          confirmLabel="Delete permanently"
          busy={deleteBusy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function VoidPaymentModal({ receipt, onClose, onVoided }: { receipt: PaymentOutReceipt; onClose: () => void; onVoided: (receipt: PaymentOutReceipt) => void }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function confirm() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await api.post(`/payment-out/${receipt.id}/void`, { reason: reason.trim() || undefined });
      onVoided(receipt);
    } catch (voidError) {
      setError(getApiError(voidError, "Could not void payment."));
      setSaving(false);
    }
  }
  return (
    <Modal title="Void payment?" onClose={onClose} size="sm">
      <div className="space-y-4">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <p className="text-sm text-slate-600">
          <strong>{receipt.receiptNumber}</strong> ({formatCurrency(receipt.total)}) to {receipt.supplier?.name || "the supplier"} will stop counting against{" "}
          {receipt.bills.length === 1 ? "its bill" : `its ${receipt.bills.length} bills`}. The record is kept and you can restore it at any time.
        </p>
        <label className="block">
          <span className="label">Reason (optional)</span>
          <input autoFocus maxLength={500} className="input-field" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Wrong party, duplicate entry..." />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>Keep payment</button>
          <button type="button" disabled={saving} onClick={() => void confirm()} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
            {saving ? "Voiding..." : "Void payment"}
          </button>
        </div>
      </div>
    </Modal>
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
