'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, ReceiptText } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice } from '@/types';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <>
      <PageHeader
        title="Sale Invoices"
        description="Review customer sale invoices, payment status, and outstanding balances."
        action={
          <Link href="/invoices/new" className="btn-primary inline-flex items-center gap-2">
            <Plus aria-hidden="true" size={16} /> Add sale invoice
          </Link>
        }
      />

      <section className="card overflow-hidden">
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
                  <th className="px-5 py-3 font-semibold">Issue date</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 text-right font-semibold">Total</th>
                  <th className="px-5 py-3 text-right font-semibold">Balance due</th>
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
                      <td className="whitespace-nowrap px-5 py-3 text-slate-600">{formatDate(invoice.issueDate)}</td>
                      <td className="px-5 py-3"><StatusBadge status={invoice.status} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-right font-semibold text-slate-800">{formatCurrency(invoice.grandTotal)}</td>
                      <td className="whitespace-nowrap px-5 py-3 text-right text-slate-600">{formatCurrency(balance)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
