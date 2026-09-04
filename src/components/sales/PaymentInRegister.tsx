'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CircleDollarSign, Plus, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Invoice, PaymentRecord } from '@/types';

type PaymentRow = PaymentRecord & { invoiceNumber: string; partyName: string; invoiceId: string };

export default function PaymentInRegister() {
  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPayments = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data: invoices } = await getAllPages<Invoice>('/invoices');
      const results = await Promise.allSettled(invoices.map((invoice) => api.get<Invoice>(`/invoices/${invoice.id}`)));
      setRows(results.flatMap((result) => result.status === 'fulfilled' ? (result.value.data.payments ?? []).map((payment) => ({ ...payment, invoiceNumber: result.value.data.invoiceNumber, partyName: result.value.data.party?.name || 'Unknown party', invoiceId: result.value.data.id })) : []).sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime()));
    } catch (loadError: unknown) { setError(getApiError(loadError, 'Could not load payment-in records.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadPayments(); }, [loadPayments]);
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return term ? rows.filter((row) => [row.invoiceNumber, row.partyName, row.method, row.reference].some((value) => value?.toLowerCase().includes(term))) : rows; }, [query, rows]);
  const total = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const methodCount = new Set(rows.map((row) => row.method)).size;

  return <><PageHeader title="Payment-In" description="Review payments received against sale invoices, including method and reference details." action={<Link href="/invoices" className="btn-primary inline-flex items-center gap-2"><Plus aria-hidden="true" size={16} />Record from invoice</Link>} /><div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3"><Metric label="Payment records" value={rows.length.toLocaleString('en-IN')} /><Metric label="Payment methods" value={methodCount.toLocaleString('en-IN')} /><Metric label="Total received" value={formatCurrency(total)} wide /></div><section className="card overflow-hidden"><div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-bold text-slate-900">Payment-In register</h2><p className="mt-0.5 text-[10px] text-slate-400">Payments recorded from sale invoices</p></div><div className="relative w-full sm:w-80"><Search aria-hidden="true" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label="Search payments" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-9" placeholder="Search invoice, party, method, reference..." /></div></div>{loading ? <LoadingState label="Loading payments..." /> : error ? <ErrorState message={error} onRetry={loadPayments} /> : filtered.length === 0 ? <EmptyState icon={CircleDollarSign} title="No payment-in records found" description={query ? 'Try a different search.' : 'Open a sale invoice and record a payment to show it here.'} /> : <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Receipt date</th><th className="px-5 py-3 font-semibold">Invoice</th><th className="px-5 py-3 font-semibold">Party</th><th className="px-5 py-3 font-semibold">Method</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 text-right font-semibold">Amount</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((row) => <tr key={row.id} className="hover:bg-slate-50/80"><td className="px-5 py-3.5 text-slate-500">{formatDate(row.paidAt)}</td><td className="px-5 py-3.5"><Link href={`/invoices/${row.invoiceId}`} className="font-bold text-blue-700 hover:underline">{row.invoiceNumber}</Link></td><td className="px-5 py-3.5 font-semibold text-slate-700">{row.partyName}</td><td className="px-5 py-3.5 capitalize text-slate-600">{row.method.replaceAll('_', ' ')}</td><td className="px-5 py-3.5 text-slate-500">{row.reference || '\u2014'}</td><td className="px-5 py-3.5 text-right font-bold text-emerald-700">{formatCurrency(row.amount)}</td></tr>)}</tbody></table></div>}</section></>;
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) { return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>; }
