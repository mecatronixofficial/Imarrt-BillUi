'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ReceiptText, Trash2 } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/types';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [canDelete, setCanDelete] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<Invoice | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function deleteInvoice() {
    if (!invoiceToDelete || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/invoices/${invoiceToDelete.id}`);
      setInvoices((current) => current.filter((invoice) => invoice.id !== invoiceToDelete.id));
      setInvoiceToDelete(null);
    } catch (deleteError: unknown) {
      setDeleteError(getApiError(deleteError, 'Could not delete invoice.'));
      setInvoiceToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<Invoice>('/invoices');
      setInvoices(data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load invoices.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((user) => {
      if (active) setCanDelete(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN');
    }).catch(() => { if (active) setCanDelete(false); });
    return () => { active = false; };
  }, []);

  return (
    <>
     <div className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
  <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
    {/* Background decoration */}
    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />

    <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-cyan-200/30 blur-3xl" />

    {/* Left */}
    <div className="relative">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-5 w-1 rounded-full bg-blue-600" />

        <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-600">
          Sales Management
        </span>
      </div>

      <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
        Sale Invoices
      </h1>

      <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
        Review customer sale invoices, payment status, and outstanding balances.
      </p>
    </div>

    {/* Button */}
    <div className="relative">
      <Link
        href="/invoices/new"
        className="
          group
          inline-flex
          h-10
          items-center
          gap-2
          rounded-xl
          bg-blue-600
          px-4
          text-[11px]
          font-extrabold
          text-white
          shadow-[0_8px_20px_rgba(37,99,235,0.22)]
          transition-all
          duration-300
          hover:-translate-y-0.5
          hover:bg-blue-700
          hover:shadow-[0_12px_26px_rgba(37,99,235,0.30)]
        "
      >
        <Plus
          size={15}
          className="transition-transform duration-300 group-hover:rotate-90"
        />

        Add Sale Invoice
      </Link>
    </div>
  </div>

  <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
</div>
      

      <section className="card overflow-hidden">
        {deleteError && <div role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-700">{deleteError}</div>}
        {loading ? (
          <LoadingState label="Loading invoices..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadInvoices} />
        ) : invoices.length === 0 ? (
          <EmptyState icon={ReceiptText} title="No invoices yet" description="Create your first invoice to start tracking payments." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50/80 text-left text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-semibold">Invoice</th>
                  <th className="px-5 py-3 font-semibold">Party</th>
                  <th className="px-5 py-3 font-semibold">Company</th>
                  <th className="px-5 py-3 font-semibold">Issue date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 text-right font-semibold">Balance due</th>
                  {canDelete && <th className="px-5 py-3 text-right font-semibold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {invoices.map((invoice) => {
                  const balance = Math.max(0, Number(invoice.grandTotal) - Number(invoice.amountPaid));
                  return (
                    <tr key={invoice.id} className="transition hover:bg-slate-50/80">
                      <td className="px-5 py-3">
                        <Link href={`/invoices/${invoice.id}`} className="font-semibold text-blue-600 hover:text-blue-700 hover:underline">
                          {invoice.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-slate-700">{invoice.party?.name ?? 'Unknown party'}</td>
                      <td className="px-5 py-3 text-slate-600">{invoice.business?.name ?? 'Selected company'}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(invoice.issueDate)}</td>
                      <td className="px-5 py-3"><StatusBadge status={invoice.status} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(invoice.grandTotal)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">{formatCurrency(balance)}</td>
                      {canDelete && <td className="px-5 py-3 text-right"><button type="button" onClick={() => setInvoiceToDelete(invoice)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700" aria-label={`Delete invoice ${invoice.invoiceNumber}`}><Trash2 size={14} aria-hidden="true" /> Delete</button></td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {invoiceToDelete && <ConfirmDialog title="Delete invoice?" message={`Delete invoice ${invoiceToDelete.invoiceNumber}? This cannot be undone.`} busy={deleting} onCancel={() => setInvoiceToDelete(null)} onConfirm={() => void deleteInvoice()} />}
    </>
  );
}
