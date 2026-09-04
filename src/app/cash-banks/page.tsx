'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, Landmark, ReceiptIndianRupee, WalletCards } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Invoice, Party } from '@/types';

export default function CashBanksPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [invoiceResponse, partyResponse] = await Promise.all([getAllPages<Invoice>('/invoices'), getAllPages<Party>('/parties')]);
      setInvoices(invoiceResponse.data);
      setParties(partyResponse.data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load cash and bank information.'));
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const summary = useMemo(() => ({
    collected: invoices.reduce((sum, invoice) => sum + Number(invoice.amountPaid), 0),
    receivable: parties.reduce((sum, party) => sum + Math.max(0, Number(party.balanceDue ?? 0)), 0),
    invoiced: invoices.filter(({ status }) => status !== 'CANCELLED').reduce((sum, invoice) => sum + Number(invoice.grandTotal), 0),
  }), [invoices, parties]);
  const outstanding = [...parties].filter((party) => Number(party.balanceDue ?? 0) > 0).sort((a, b) => Number(b.balanceDue) - Number(a.balanceDue)).slice(0, 8);

  return <><PageHeader title="Cash & Banks" description="A simple view of collections, receivables, and cash-flow records." />{loading ? <section className="card"><LoadingState label="Preparing account summary..." /></section> : error ? <section className="card"><ErrorState message={error} onRetry={loadData} /></section> : <><div className="mb-4 grid gap-3 sm:grid-cols-3"><AccountCard icon={ArrowDownLeft} label="Recorded collections" value={summary.collected} tone="emerald" /><AccountCard icon={ReceiptIndianRupee} label="Party receivables" value={summary.receivable} tone="amber" /><AccountCard icon={WalletCards} label="Total invoiced" value={summary.invoiced} tone="blue" /></div><section className="card overflow-hidden"><div className="flex items-center justify-between border-b border-slate-100 px-5 py-4"><div><h2 className="text-sm font-extrabold text-slate-900">Outstanding accounts</h2><p className="mt-0.5 text-xs text-slate-400">Parties with money to receive</p></div><Landmark size={18} className="text-blue-500" /></div>{outstanding.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">No outstanding party balances.</div> : <div className="divide-y divide-slate-100">{outstanding.map((party) => <Link key={party.id} href="/parties" className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-800">{party.name}</p><p className="mt-0.5 text-[11px] text-slate-400">{party.phone || party.email || 'No contact details'}</p></div><p className="font-extrabold text-red-600">{formatCurrency(Number(party.balanceDue))}</p></Link>)}</div>}</section><p className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">Recorded collections are calculated from invoice payments. Dedicated bank accounts, transfers, deposits, and expense vouchers can be connected to this workspace when their ledger module is enabled.</p></>}</>;
}

function AccountCard({ icon: Icon, label, value, tone }: { icon: typeof Landmark; label: string; value: number; tone: 'emerald' | 'amber' | 'blue' }) {
  const colors = { emerald: 'bg-emerald-50 text-emerald-600', amber: 'bg-amber-50 text-amber-600', blue: 'bg-blue-50 text-blue-600' };
  return <div className="card flex items-center gap-3 p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={18} /></span><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-lg font-extrabold text-slate-950">{formatCurrency(value)}</p></div></div>;
}
