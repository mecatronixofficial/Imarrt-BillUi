"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Calculator, Camera, ChevronDown, FileText, Loader2, Mail, MessageCircle, Paperclip, Plus, Settings, X } from "lucide-react";
import Modal from "@/components/Modal";
import QuickCalculator from "@/components/QuickCalculator";
import { MenuButton, Popover } from "@/components/PopoverMenu";
import { toast } from "@/components/ToastProvider";
import { api, getActiveBusinessId, getAllPages, getApiError } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { prepareUploads } from "@/lib/imageCompression";
import { whatsappLink } from "@/lib/messageTemplates";
import type { Business, OpenPurchaseBill, PaymentOutReceipt, Supplier } from "@/types";

const METHODS = [
  ["cash", "Cash"],
  ["upi", "UPI"],
  ["cheque", "Cheque"],
  ["bank_transfer", "Bank transfer"],
  ["other", "Other"],
] as const;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

type Account = { id: string; bankName: string; accountNumber?: string };
/** `source` is a payment method such as "cash", or a bank account id (paid by bank transfer). */
type SplitRow = { key: string; source: string; amount: string; reference: string };
type NewFile = { key: string; file: File; previewUrl?: string };
type ShareTarget = "whatsapp" | "email";

const newKey = () => (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `k${Date.now()}${Math.random()}`);
const toPaise = (value: string | number) => Math.round((Number(value) || 0) * 100);
const fromPaise = (paise: number) => paise / 100;
const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};

/** Mirrors the server: oldest-due bills are settled first. */
function oldestFirst(bills: OpenPurchaseBill[], totalPaise: number) {
  let remaining = totalPaise;
  const settled = new Map<string, number>();
  for (const bill of bills) {
    const take = Math.max(0, Math.min(remaining, toPaise(bill.outstanding)));
    if (take > 0) settled.set(bill.id, take);
    remaining -= take;
  }
  return settled;
}

export default function PaymentOutForm({
  receipt,
  initialSupplierId = "",
  initialBillId = "",
  onClose,
  onSaved,
}: {
  /** When set, the form edits this receipt's date, reference, description and attachments. */
  receipt?: PaymentOutReceipt;
  initialSupplierId?: string;
  /** Settles only this bill by default (from "Make payment" on a bill). */
  initialBillId?: string;
  onClose: () => void;
  onSaved: (receipt: PaymentOutReceipt) => void;
}) {
  const editing = Boolean(receipt);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [businessId, setBusinessId] = useState(() => getActiveBusinessId() ?? "");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bills, setBills] = useState<OpenPurchaseBill[]>([]);
  const [loadingBills, setLoadingBills] = useState(false);
  const [supplierId, setSupplierId] = useState(receipt?.supplierId ?? initialSupplierId);
  const [splits, setSplits] = useState<SplitRow[]>(() => [{ key: newKey(), source: "cash", amount: "", reference: "" }]);
  const [paid, setPaid] = useState("");
  const [discount, setDiscount] = useState("");
  const [paidAt, setPaidAt] = useState(() => receipt?.paidAt.slice(0, 10) ?? today());
  const [reference, setReference] = useState(receipt?.reference ?? "");
  const [description, setDescription] = useState(receipt?.description ?? "");
  const [showDescription, setShowDescription] = useState(Boolean(receipt?.description));
  const [autoAllocate, setAutoAllocate] = useState(!initialBillId);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<NewFile[]>([]);
  const [existingFiles, setExistingFiles] = useState<NonNullable<PaymentOutReceipt["attachments"]>>([]);
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [saving, setSaving] = useState<"" | "save" | ShareTarget>("");
  const [error, setError] = useState("");
  const requestId = useRef(newKey());
  const fileInput = useRef<HTMLInputElement>(null);
  const filesRef = useRef<NewFile[]>([]);
  const presetApplied = useRef(false);
  const companyHeaders = useMemo(() => (businessId ? { "X-Business-Id": businessId } : undefined), [businessId]);

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach(({ previewUrl }) => previewUrl && URL.revokeObjectURL(previewUrl)), []);

  useEffect(() => {
    void getAllPages<Business>("/businesses").then(({ data }) => setBusinesses(data)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (editing) return;
    const controller = new AbortController();
    const config = { signal: controller.signal, headers: companyHeaders };
    void getAllPages<Supplier>("/suppliers", config).then(({ data }) => setSuppliers(data)).catch((loadError) => {
      if (!controller.signal.aborted) setError(getApiError(loadError, "Could not load suppliers."));
    });
    void getAllPages<Account>("/accounts", config).then(({ data }) => setAccounts(data)).catch(() => undefined);
    return () => controller.abort();
  }, [companyHeaders, editing]);

  useEffect(() => {
    if (!editing || !receipt) return;
    void api.get<PaymentOutReceipt>(`/payment-out/${receipt.id}`).then(({ data }) => setExistingFiles(data.attachments ?? [])).catch(() => undefined);
  }, [editing, receipt]);

  useEffect(() => {
    if (editing || !supplierId) {
      setBills([]);
      return;
    }
    const controller = new AbortController();
    setLoadingBills(true);
    api.get<OpenPurchaseBill[]>(`/payment-out/suppliers/${supplierId}/bills`, { signal: controller.signal, headers: companyHeaders })
      .then(({ data }) => {
        setBills(data);
        // "Make payment" on one bill: pay that bill's balance, settled against that bill only.
        if (!presetApplied.current && initialBillId) {
          presetApplied.current = true;
          const bill = data.find(({ id }) => id === initialBillId);
          if (bill) {
            setPaid(String(bill.outstanding));
            setManual({ [bill.id]: String(bill.outstanding) });
          } else {
            setAutoAllocate(true);
          }
        }
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(getApiError(loadError, "Could not load this supplier's bills."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingBills(false);
      });
    return () => controller.abort();
  }, [supplierId, companyHeaders, editing, initialBillId]);

  const split = splits.length > 1;
  const paidPaise = split ? splits.reduce((sum, row) => sum + toPaise(row.amount), 0) : toPaise(paid);
  const discountPaise = toPaise(discount);
  const totalPaise = paidPaise + discountPaise;
  const payablePaise = bills.reduce((sum, bill) => sum + toPaise(bill.outstanding), 0);
  const allocation = useMemo(() => {
    if (autoAllocate) return oldestFirst(bills, totalPaise);
    return new Map(Object.entries(manual).filter(([, value]) => toPaise(value) > 0).map(([id, value]) => [id, toPaise(value)]));
  }, [autoAllocate, bills, manual, totalPaise]);
  const allocatedPaise = [...allocation.values()].reduce((sum, value) => sum + value, 0);
  const selectedSupplier = suppliers.find(({ id }) => id === supplierId);
  const supplierName = selectedSupplier?.name ?? receipt?.supplier?.name ?? "";

  function problem() {
    if (editing) return "";
    if (!supplierId) return "Select a party.";
    if (!loadingBills && !bills.length) return `${supplierName || "This party"} has no unpaid purchase bills.`;
    if (totalPaise <= 0) return "Enter the amount paid or a discount.";
    if (split && splits.some((row) => toPaise(row.amount) <= 0)) return "Enter an amount for each payment type, or remove the empty one.";
    if (totalPaise > payablePaise) return `Paid plus discount (${formatCurrency(fromPaise(totalPaise))}) is more than the ${formatCurrency(fromPaise(payablePaise))} owed on open bills.`;
    if (!autoAllocate) {
      const over = bills.find((bill) => (allocation.get(bill.id) ?? 0) > toPaise(bill.outstanding));
      if (over) return `Bill ${over.referenceNumber || over.documentNumber} only has ${formatCurrency(over.outstanding)} outstanding.`;
      if (allocatedPaise !== totalPaise) return `Bills settled (${formatCurrency(fromPaise(allocatedPaise))}) must equal paid plus discount (${formatCurrency(fromPaise(totalPaise))}).`;
    }
    return "";
  }

  function updateSplit(key: string, patch: Partial<SplitRow>) {
    setSplits((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function addSplit() {
    setSplits((current) => {
      const rows = current.length === 1 ? [{ ...current[0], amount: current[0].amount || paid }] : current;
      return [...rows, { key: newKey(), source: "cash", amount: "", reference: "" }];
    });
  }

  function removeSplit(key: string) {
    setSplits((current) => {
      const rows = current.filter((row) => row.key !== key);
      if (rows.length === 1) setPaid(rows[0].amount);
      return rows;
    });
  }

  function addFiles(list: FileList | null) {
    const picked = Array.from(list ?? []);
    const count = files.length + existingFiles.length;
    const used = files.reduce((sum, { file }) => sum + file.size, 0) + existingFiles.reduce((sum, { size }) => sum + size, 0);
    const room = Math.max(0, MAX_FILES - count);
    let bytes = used;
    const accepted = picked.filter((file) => {
      if (file.size <= 0 || file.size > MAX_FILE_BYTES || bytes + file.size > MAX_TOTAL_BYTES) return false;
      bytes += file.size;
      return true;
    }).slice(0, room);
    if (accepted.length < picked.length) toast.error("Attach up to 10 files, 25 MB in total, each 10 MB or smaller.");
    setFiles((current) => [...current, ...accepted.map((file) => ({ key: newKey(), file, previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined }))]);
  }

  function removeFile(key: string) {
    setFiles((current) => {
      const target = current.find((entry) => entry.key === key);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.key !== key);
    });
  }

  async function openExisting(attachmentId: string) {
    if (!receipt) return;
    const tab = window.open("about:blank", "_blank");
    if (!tab) return toast.error("Allow pop-ups to view this file.");
    tab.opener = null;
    try {
      const { data } = await api.get<Blob>(`/payment-out/${receipt.id}/attachments/${attachmentId}`, { responseType: "blob" });
      const url = URL.createObjectURL(data);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (openError) {
      tab.close();
      toast.error(getApiError(openError, "Could not open file."));
    }
  }

  async function removeExisting(attachmentId: string) {
    if (!receipt) return;
    try {
      await api.delete(`/payment-out/${receipt.id}/attachments/${attachmentId}`);
      setExistingFiles((current) => current.filter(({ id }) => id !== attachmentId));
    } catch (removeError) {
      toast.error(getApiError(removeError, "Could not remove file."));
    }
  }

  function share(target: ShareTarget, saved: PaymentOutReceipt) {
    const message = `Payment ${saved.receiptNumber} dated ${formatDate(saved.paidAt)}\nPaid: ${formatCurrency(saved.paid)}${saved.discount ? `\nDiscount: ${formatCurrency(saved.discount)}` : ""}\nBills: ${saved.bills.map((bill) => bill.referenceNumber || bill.documentNumber).join(", ")}`;
    if (target === "whatsapp") window.open(whatsappLink(selectedSupplier?.phone ?? saved.supplier?.phone, message), "_blank", "noopener,noreferrer");
    else window.open(`mailto:${encodeURIComponent(selectedSupplier?.email ?? saved.supplier?.email ?? "")}?subject=${encodeURIComponent(`Payment ${saved.receiptNumber}`)}&body=${encodeURIComponent(message)}`, "_blank");
  }

  async function save(shareTarget?: ShareTarget) {
    if (saving) return;
    const issue = problem();
    if (issue) return setError(issue);
    setError("");
    setSaving(shareTarget ?? "save");
    let saved: PaymentOutReceipt | null = null;
    try {
      if (receipt) {
        ({ data: saved } = await api.patch<PaymentOutReceipt>(`/payment-out/${receipt.id}`, { paidAt, reference: reference.trim(), description: description.trim() }));
      } else {
        const rows = split ? splits : [{ ...splits[0], amount: paid, reference: "" }];
        ({ data: saved } = await api.post<PaymentOutReceipt>("/payment-out", {
          requestId: requestId.current,
          supplierId,
          paidAt,
          reference: reference.trim() || undefined,
          description: description.trim() || undefined,
          discount: fromPaise(discountPaise),
          splits: rows.filter((row) => toPaise(row.amount) > 0).map((row) => {
            const account = accounts.find(({ id }) => id === row.source);
            return { method: account ? "bank_transfer" : row.source, accountId: account?.id, amount: fromPaise(toPaise(row.amount)), reference: row.reference.trim() || undefined };
          }),
          allocations: autoAllocate ? undefined : [...allocation.entries()].map(([documentId, paise]) => ({ documentId, amount: fromPaise(paise) })),
        }, { headers: companyHeaders }));
      }
      if (files.length) {
        const formData = new FormData();
        (await prepareUploads(files.map(({ file }) => file))).forEach((file) => formData.append("files", file, file.name));
        await api.post(`/payment-out/${saved.id}/attachments`, formData, { headers: { ...companyHeaders, "Content-Type": "multipart/form-data" }, timeout: 120000 });
      }
      toast.success(receipt ? "Payment updated" : "Payment saved", { description: `${saved.receiptNumber} · ${formatCurrency(saved.total)}` });
      if (shareTarget) share(shareTarget, saved);
      onSaved(saved);
    } catch (saveError) {
      const message = saved
        ? `${saved.receiptNumber} was saved, but the attachments could not be uploaded. Open it from the register to try again.`
        : getApiError(saveError, "Could not save payment.");
      setError(message);
      toast.error(message);
      if (saved) onSaved(saved);
    } finally {
      setSaving("");
    }
  }

  const sourceOptions = (
    <>
      {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}{account.accountNumber ? ` ••${account.accountNumber.slice(-4)}` : ""}</option>)}
    </>
  );
  const floatingLabel = "pointer-events-none absolute -top-2 left-3 bg-white px-1 text-[11px] font-semibold text-slate-500";
  const fieldClass = "h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";
  const company = businesses.find(({ id }) => id === businessId);

  return (
    <Modal title={editing ? "Edit Payment-Out" : "Payment-Out"} onClose={onClose} size="xl" className="!max-w-[1080px]">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          {businesses.length > 1 && !editing ? (
            <label className="relative inline-flex items-center gap-2">
              <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">{(company?.name ?? "C").charAt(0).toUpperCase()}</span>
              <select
                aria-label="Company for this payment"
                value={businessId}
                onChange={(event) => { setBusinessId(event.target.value); setSupplierId(""); setSplits([{ key: newKey(), source: "cash", amount: "", reference: "" }]); setManual({}); }}
                className="appearance-none bg-transparent pr-6 text-sm font-semibold text-slate-800 outline-none"
              >
                {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-0 text-slate-500" />
            </label>
          ) : (
            <span className="text-sm font-semibold text-slate-700">{company?.name ?? ""}</span>
          )}
          <div className="relative flex items-center gap-1">
            <button type="button" aria-label="Calculator" title="Calculator" onClick={() => setCalculatorOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <Calculator size={18} />
            </button>
            <Link href="/settings/transaction" aria-label="Transaction settings" title="Transaction settings" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              <Settings size={18} />
            </Link>
            {calculatorOpen && <div className="absolute right-0 top-full z-20 mt-2"><QuickCalculator onClose={() => setCalculatorOpen(false)} /></div>}
          </div>
        </div>

        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</div>}

        <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="relative max-w-sm">
              <select aria-label="Party" required disabled={editing} value={supplierId} onChange={(event) => { setSupplierId(event.target.value); setManual({}); setAutoAllocate(true); }} className={`${fieldClass} appearance-none pr-9 ${supplierId ? "" : "border-blue-500"}`}>
                {editing ? <option value={supplierId}>{supplierName || "Supplier"}</option> : <option value="">Select party</option>}
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}{supplier.phone ? ` · ${supplier.phone}` : ""}</option>)}
              </select>
              <span className={floatingLabel}>Party <b className="text-red-500">*</b></span>
              <ChevronDown size={18} aria-hidden="true" className="pointer-events-none absolute right-3 top-3 text-slate-500" />
              {supplierId && !editing && (
                <p className="mt-1.5 text-xs text-slate-500">
                  {loadingBills ? "Loading bills..." : <>Payable: <strong className="text-red-600">{formatCurrency(fromPaise(payablePaise))}</strong> on {bills.length} open {bills.length === 1 ? "bill" : "bills"}</>}
                </p>
              )}
            </div>

            {editing ? (
              <div className="max-w-sm rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Paid by <strong>{receipt?.paymentTypes.join(", ") || "Discount only"}</strong>. To change amounts or payment types, void this payment and record a new one.
              </div>
            ) : (
              <div className="space-y-3">
                {splits.map((row, index) => (
                  <div key={row.key} className="flex flex-wrap items-start gap-2">
                    <div className="relative w-48">
                      <select aria-label={`Payment type ${index + 1}`} value={row.source} onChange={(event) => updateSplit(row.key, { source: event.target.value })} className={`${fieldClass} appearance-none pr-8`}>
                        {sourceOptions}
                      </select>
                      <span className={floatingLabel}>Payment Type</span>
                      <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-3.5 text-slate-500" />
                    </div>
                    {split && (
                      <>
                        <input aria-label={`Amount for payment type ${index + 1}`} type="number" min="0" step="0.01" placeholder="Amount" value={row.amount} onChange={(event) => updateSplit(row.key, { amount: event.target.value })} className={`${fieldClass} w-32`} />
                        <input aria-label={`Reference for payment type ${index + 1}`} maxLength={191} placeholder="Reference No." value={row.reference} onChange={(event) => updateSplit(row.key, { reference: event.target.value })} className={`${fieldClass} w-40`} />
                        <button type="button" aria-label={`Remove payment type ${index + 1}`} onClick={() => removeSplit(row.key)} className="flex h-11 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={16} /></button>
                      </>
                    )}
                  </div>
                ))}
                {split && <p className="text-xs text-slate-500">Paid across payment types: <strong>{formatCurrency(fromPaise(paidPaise))}</strong></p>}
                <button type="button" onClick={addSplit} disabled={splits.length >= 10} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline disabled:opacity-40">
                  <Plus size={14} /> Add Payment type
                </button>
              </div>
            )}

            {(!split || editing) && (
              <input aria-label="Reference number" maxLength={191} placeholder="Reference No." value={reference} onChange={(event) => setReference(event.target.value)} className={`${fieldClass} max-w-[12rem] bg-slate-50`} />
            )}

            {showDescription ? (
              <label className="block max-w-md">
                <span className="mb-1 block text-xs font-semibold text-slate-500">Description</span>
                <textarea rows={3} maxLength={5000} autoFocus={!description} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What this payment was for..." className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </label>
            ) : (
              <button type="button" onClick={() => setShowDescription(true)} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 text-xs font-bold uppercase tracking-wide text-slate-500 hover:bg-slate-50">
                <FileText size={16} /> Add Description
              </button>
            )}

            <div>
              <input ref={fileInput} type="file" multiple accept="image/png,image/jpeg,image/webp,application/pdf" className="hidden" onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => fileInput.current?.click()} aria-label="Attach image or PDF" title="Attach image or PDF" className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                  <Camera size={22} />
                </button>
                {existingFiles.map((attachment) => (
                  <span key={attachment.id} className="group relative flex h-14 max-w-[11rem] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2">
                    <button type="button" onClick={() => void openExisting(attachment.id)} className="flex min-w-0 items-center gap-2 text-left" title={`Open ${attachment.fileName}`}>
                      <Paperclip size={16} className="shrink-0 text-slate-400" />
                      <span className="truncate text-xs font-semibold text-slate-700">{attachment.fileName}</span>
                    </button>
                    <button type="button" aria-label={`Remove ${attachment.fileName}`} onClick={() => void removeExisting(attachment.id)} className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={13} /></button>
                  </span>
                ))}
                {files.map((entry) => (
                  <span key={entry.key} className="relative flex h-14 max-w-[11rem] items-center gap-2 rounded-lg border border-slate-200 bg-white px-2">
                    {entry.previewUrl ? <Image src={entry.previewUrl} alt="" width={40} height={40} unoptimized className="h-10 w-10 rounded object-cover" /> : <FileText size={18} className="shrink-0 text-slate-400" />}
                    <span className="truncate text-xs font-semibold text-slate-700">{entry.file.name}</span>
                    <button type="button" aria-label={`Remove ${entry.file.name}`} onClick={() => removeFile(entry.key)} className="rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><X size={13} /></button>
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Photo of the payment slip or cheque, or a PDF. Up to 10 files.</p>
            </div>
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-[96px_1fr] items-center gap-2">
              <span className="text-slate-500">Receipt No</span>
              <span className="border-b border-slate-200 pb-1 font-semibold text-slate-700">{receipt?.receiptNumber ?? "Auto"}</span>
              <label htmlFor="payment-out-date" className="text-slate-500">Date</label>
              <input id="payment-out-date" type="date" required value={paidAt} onChange={(event) => setPaidAt(event.target.value)} className="h-9 rounded-lg border border-slate-200 px-2 text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
            </div>
            <div className="space-y-3 pt-8">
              <label className="grid grid-cols-[96px_1fr] items-center gap-2">
                <span className="text-slate-500">Paid</span>
                <input type="number" min="0" step="0.01" disabled={editing || split} value={editing ? String(receipt?.paid ?? "") : split ? fromPaise(paidPaise).toFixed(2) : paid} onChange={(event) => setPaid(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-right text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
              </label>
              <label className="grid grid-cols-[96px_1fr] items-center gap-2">
                <span className="text-slate-500">Discount</span>
                <input type="number" min="0" step="0.01" disabled={editing} value={editing ? String(receipt?.discount ?? "") : discount} onChange={(event) => setDiscount(event.target.value)} className="h-10 rounded-lg border border-slate-300 px-3 text-right text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50" />
              </label>
              <div className="grid grid-cols-[96px_1fr] items-center gap-2 border-t border-slate-100 pt-3">
                <span className="font-bold text-slate-800">Total</span>
                <span className="text-right text-lg font-extrabold text-blue-600">{formatCurrency(editing ? receipt?.total ?? 0 : fromPaise(totalPaise))}</span>
              </div>
            </div>
          </div>
        </div>

        {editing ? (
          receipt && receipt.bills.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-3 text-xs text-slate-600">
              Settled: {receipt.bills.map((bill) => `${bill.referenceNumber || bill.documentNumber} (${formatCurrency(bill.settled)})`).join(" · ")}
            </div>
          )
        ) : supplierId && bills.length > 0 && (
          <section className="rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Bills to settle</h3>
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="checkbox"
                  checked={autoAllocate}
                  onChange={(event) => {
                    setAutoAllocate(event.target.checked);
                    if (!event.target.checked) setManual(Object.fromEntries([...oldestFirst(bills, totalPaise)].map(([id, paise]) => [id, String(fromPaise(paise))])));
                  }}
                />
                Settle oldest bills first
              </label>
            </div>
            <div className="max-h-60 overflow-auto">
              <table className="w-full min-w-[620px] text-xs">
                <thead className="sticky top-0 bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Bill</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Due</th>
                    <th className="px-4 py-2 text-right">Outstanding</th>
                    <th className="px-4 py-2 text-right">Settling now</th>
                    <th className="px-4 py-2 text-right">Left after</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bills.map((bill) => {
                    const settling = allocation.get(bill.id) ?? 0;
                    const overdue = bill.dueDate && bill.dueDate.slice(0, 10) < today();
                    return (
                      <tr key={bill.id} className={settling ? "bg-blue-50/40" : ""}>
                        <td className="px-4 py-2 font-semibold text-slate-800">{bill.referenceNumber || bill.documentNumber}</td>
                        <td className="px-4 py-2 text-slate-500">{formatDate(bill.issueDate)}</td>
                        <td className={`px-4 py-2 ${overdue ? "font-semibold text-red-600" : "text-slate-500"}`}>{bill.dueDate ? formatDate(bill.dueDate) : "—"}</td>
                        <td className="px-4 py-2 text-right text-slate-700">{formatCurrency(bill.outstanding)}</td>
                        <td className="px-4 py-2 text-right">
                          {autoAllocate ? (
                            <span className="font-semibold text-blue-700">{settling ? formatCurrency(fromPaise(settling)) : "—"}</span>
                          ) : (
                            <input aria-label={`Amount to settle on ${bill.referenceNumber || bill.documentNumber}`} type="number" min="0" max={bill.outstanding} step="0.01" value={manual[bill.id] ?? ""} onChange={(event) => setManual((current) => ({ ...current, [bill.id]: event.target.value }))} className="h-8 w-28 rounded-md border border-slate-300 px-2 text-right outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-slate-500">{formatCurrency(Math.max(0, fromPaise(toPaise(bill.outstanding) - settling)))}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!autoAllocate && allocatedPaise !== totalPaise && (
              <p className="border-t border-slate-100 px-4 py-2 text-xs font-semibold text-amber-700">
                {allocatedPaise < totalPaise ? `${formatCurrency(fromPaise(totalPaise - allocatedPaise))} still to place on bills.` : `${formatCurrency(fromPaise(allocatedPaise - totalPaise))} more than paid plus discount.`}
              </p>
            )}
          </section>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-4">
          <div className="inline-flex h-10 overflow-hidden rounded-lg border border-blue-300 text-blue-700">
            <button type="button" disabled={Boolean(saving)} onClick={() => void save("whatsapp")} className="inline-flex items-center gap-2 px-4 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50">
              {saving === "whatsapp" || saving === "email" ? <Loader2 size={15} className="animate-spin" /> : null}
              Share
            </button>
            <Popover label="More share options" align="right" trigger={() => <span className="flex h-full items-center border-l border-blue-200 px-2 hover:bg-blue-50"><ChevronDown size={16} /></span>}>
              {(close) => (
                <div role="menu" className="w-56 py-1">
                  <MenuButton icon={<MessageCircle size={15} />} onClick={() => { close(); void save("whatsapp"); }}>Save &amp; share on WhatsApp</MenuButton>
                  <MenuButton icon={<Mail size={15} />} onClick={() => { close(); void save("email"); }}>Save &amp; email supplier</MenuButton>
                </div>
              )}
            </Popover>
          </div>
          <button type="button" disabled={Boolean(saving)} onClick={() => void save()} className="inline-flex h-10 min-w-28 items-center justify-center gap-2 rounded-lg bg-blue-600 px-6 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60">
            {saving === "save" && <Loader2 size={16} className="animate-spin" />}
            {saving === "save" ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
