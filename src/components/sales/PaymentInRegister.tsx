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
import { usePageState } from '@/lib/navigation';

export default function PaymentInRegister() {
  const [rows, setRows] = useState<PaymentInRecord[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [query, setQuery] = usePageState('PaymentInRegister.query', "");
  const [customer, setCustomer] = usePageState('PaymentInRegister.customer', "ALL");
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

  const customerList = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) { const n = r.invoice.party.name; map.set(n, (map.get(n) ?? 0) + 1); }
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter(({ invoice, method, reference }) => {
      const matchQuery = !term || [invoice.invoiceNumber, invoice.party.name, method, reference].some((v) => v?.toLowerCase().includes(term));
      const matchCustomer = customer === "ALL" || invoice.party.name === customer;
      return matchQuery && matchCustomer;
    });
  }, [query, rows, customer]);
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
      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Metric label="Receipts" value={rows.length.toLocaleString("en-IN")} />
        <Metric label="Payment methods" value={methods.toLocaleString("en-IN")} />
        <Metric label="Total received" value={formatCurrency(total)} />
      </div>
      <section className="card reference-payment-register overflow-hidden">
        <div style={{display:'flex',gap:0,minHeight:400}}>
          {/* Customer sidebar */}
          <div style={{width:200,flexShrink:0,borderRight:'1px solid #e9eaf0',display:'flex',flexDirection:'column',background:'#f8fafc'}}>
            <div style={{padding:'10px 12px',borderBottom:'1px solid #e9eaf0',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#94a3b8'}}>Customers</div>
            <div style={{overflowY:'auto',flex:1}}>
              <button type="button" onClick={()=>setCustomer('ALL')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'9px 12px',fontSize:'12px',fontWeight:customer==='ALL'?700:500,background:customer==='ALL'?'#1d4ed8':'transparent',color:customer==='ALL'?'#fff':'#374151',borderBottom:'1px solid #f1f5f9',textAlign:'left',cursor:'pointer',transition:'background .12s'}}>
                <span>All</span><span style={{fontSize:'11px',opacity:.8,background:customer==='ALL'?'rgba(255,255,255,.2)':'#e2e8f0',color:customer==='ALL'?'#fff':'#64748b',borderRadius:10,padding:'1px 6px'}}>{rows.length}</span>
              </button>
              {customerList.map(c=><button key={c.name} type="button" onClick={()=>setCustomer(c.name===customer?'ALL':c.name)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'9px 12px',fontSize:'12px',fontWeight:customer===c.name?700:400,background:customer===c.name?'#1d4ed8':'transparent',color:customer===c.name?'#fff':'#374151',borderBottom:'1px solid #f1f5f9',textAlign:'left',cursor:'pointer',transition:'background .12s'}} title={c.name}>
                <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:6}}>{c.name}</span>
                <span style={{fontSize:'11px',flexShrink:0,background:customer===c.name?'rgba(255,255,255,.2)':'#e2e8f0',color:customer===c.name?'#fff':'#64748b',borderRadius:10,padding:'1px 6px'}}>{c.count}</span>
              </button>)}
            </div>
          </div>
          {/* Right: header + table */}
          <div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
            <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-sm font-bold text-slate-900">
                Payment In register{customer!=='ALL'&&<span style={{marginLeft:8,fontSize:'12px',fontWeight:500,color:'#1d4ed8'}}>· {customer}</span>}
              </h2>
              <div className="relative w-full sm:w-80">
                {!query&&<Search aria-hidden="true" size={15} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400"/>}
                <input type="text" aria-label="Search payment in" value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Invoice, party, method, reference..." className={`input-field w-full pr-10 ${query?"!pl-4":"!pl-12"}`}/>
                {query&&<button type="button" onClick={()=>setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"><X aria-hidden="true" size={14}/></button>}
              </div>
            </div>
            {loading?<LoadingState label="Loading payments..."/>:error?<ErrorState message={error} onRetry={load}/>:filtered.length===0?<EmptyState icon={CircleDollarSign} title="No payments received" description={query?"Try a different search.":"Record a customer payment to begin this register."}/>:(
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-sm">
                  <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400">
                    <tr>
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
                    {filtered.map((row)=>{
                      const paid=invoiceOutstanding(row.invoice)===0;
                      return <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3.5"><Link href={`/invoices/${row.invoice.id}`} className="font-bold text-blue-700 hover:underline">{row.invoice.invoiceNumber}</Link></td>
                        <td className="px-5 py-3.5 font-semibold text-slate-700">{row.invoice.party.name}</td>
                        <td className="px-5 py-3.5 capitalize text-slate-600">{row.method.replaceAll("_"," ")}</td>
                        <td className="px-5 py-3.5 text-slate-500">{row.reference||"—"}</td>
                        <td className="px-5 py-3.5"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${paid?"bg-emerald-50 text-emerald-700":"bg-amber-50 text-amber-700"}`}>{paid?"Paid":"Partially paid"}</span></td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-700">{formatCurrency(row.amount)}</td>
                        <td className="px-3 py-3.5 text-right">
                          <RowActions label={`Actions for payment on ${row.invoice.invoiceNumber}`} actions={[
                            {label:"View invoice",icon:"view",href:`/invoices/${row.invoice.id}`},
                            {label:"Edit payment",icon:"edit",onClick:()=>setEditing(row)},
                            {label:"Print invoice",icon:"print",onClick:()=>void printInvoice(row.invoice.id)},
                            {label:"Share receipt on WhatsApp",icon:"whatsapp",href:whatsappLink(row.invoice.party.phone,receiptText(row)),external:true},
                            !!row.invoice.party.email&&{label:"Email receipt",icon:"email",href:`mailto:${encodeURIComponent(row.invoice.party.email??"")}?subject=${encodeURIComponent(`Payment received · ${row.invoice.invoiceNumber}`)}&body=${encodeURIComponent(receiptText(row))}`,external:true},
                            canDelete&&{label:"Delete",icon:"delete",danger:true,onClick:()=>setDeleting(row)},
                          ]}/>
                        </td>
                      </tr>;
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
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
  const [partyId, setPartyId] = useState('');
  const [saving, setSaving] = useState(false);

  const parties = useMemo(() => {
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    for (const inv of invoices) {
      const key = inv.party.id;
      if (!seen.has(key)) { seen.add(key); result.push({ id: key, name: inv.party.name }); }
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [invoices]);

  const filteredInvoices = partyId ? invoices.filter((inv) => inv.party.id === partyId) : invoices;
  const selected = filteredInvoices.find(({ id }) => id === invoiceId);

  return <Modal title="Payment-In" onClose={() => { if (!saving) onClose(); }} size="lg">
    <div className="space-y-4">
      <div className="-mx-5 -mt-5 mb-1 flex items-center gap-3 border-b border-emerald-100 bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20">
          <CircleDollarSign size={22} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white">Record Payment Received</p>
          <p className="text-[11px] text-emerald-100">Select customer and invoice to record payment</p>
        </div>
      </div>
      <label className="block">
        <span className="label">Select Customer</span>
        <select className="input-field" value={partyId} onChange={(e) => { setPartyId(e.target.value); setInvoiceId(''); }}>
          <option value="">All customers</option>
          {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="label">Sale invoice *</span>
        <select aria-label="Sale invoice" disabled={saving} className="input-field" value={invoiceId} onChange={(event) => setInvoiceId(event.target.value)}>
          <option value="">{partyId ? 'Select invoice' : 'Select unpaid invoice'}</option>
          {filteredInvoices.map((invoice) => (
            <option key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {invoice.party.name} · Due {formatCurrency(invoiceOutstanding(invoice))}</option>
          ))}
        </select>
        {partyId && !filteredInvoices.length && <p className="mt-1 text-xs text-slate-500">No outstanding invoices for this customer.</p>}
      </label>
      {!invoices.length && <p className="text-sm text-slate-500">No outstanding invoices to receive payment against.</p>}
      {partyId && !filteredInvoices.length && <p className="text-sm text-slate-500">No outstanding invoices for this customer.</p>}
      {selected && <InvoicePaymentForm key={selected.id} invoice={selected} onSavingChange={setSaving} onSaved={onSaved} />}
    </div>
  </Modal>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      <p className="mt-1.5 text-xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
