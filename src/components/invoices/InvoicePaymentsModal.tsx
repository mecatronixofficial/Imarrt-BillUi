'use client';

import { useCallback, useEffect, useState } from 'react';
import Modal from '@/components/Modal';
import { ErrorState, LoadingState } from '@/components/ContentState';
import InvoicePaymentForm from './InvoicePaymentForm';
import InvoicePaymentHistory from './InvoicePaymentHistory';
import { api, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { invoiceOutstanding } from '@/lib/outstanding';
import type { Invoice } from '@/types';

export default function InvoicePaymentsModal({ invoiceId, onClose, onSaved }: {
  invoiceId: string; onClose: () => void; onSaved: () => void;
}) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get<Invoice>(`/invoices/${invoiceId}`, { signal });
      if (!signal?.aborted) setInvoice(data);
    } catch (loadError) {
      if (!signal?.aborted) setError(getApiError(loadError, 'Could not load payment details.'));
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [invoiceId]);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  return <Modal title={invoice ? `Record payment · ${invoice.invoiceNumber}` : 'Record payment'} size="lg" onClose={() => { if (!saving) onClose(); }}>
    {loading ? <LoadingState label="Loading payment details..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : invoice && <>
      <p className="mb-4 text-sm font-semibold text-slate-600">{invoice.party.name}</p>
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3" aria-live="polite">
        {[['Invoice total', invoice.grandTotal], ['Amount paid', invoice.amountPaid], ['Balance due', invoiceOutstanding(invoice)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3">
          <p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-900">{formatCurrency(value)}</p>
        </div>)}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <section><h3 className="mb-3 font-bold text-slate-900">Add payment</h3>
          <InvoicePaymentForm key={`${invoice.id}:${invoice.amountPaid}`} invoice={invoice} onSavingChange={setSaving} onSaved={(updated) => { setInvoice(updated); onSaved(); }} />
        </section>
        <section className="min-w-0"><h3 className="mb-3 font-bold text-slate-900">Paid details</h3>
          <div className="overflow-hidden rounded-xl border border-slate-100"><InvoicePaymentHistory payments={invoice.payments} /></div>
        </section>
      </div>
    </>}
  </Modal>;
}
