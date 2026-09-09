'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileSpreadsheet,
  FileText,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  MoreVertical,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  Settings,
  UserRound,
  Users,
} from 'lucide-react';
import Modal from '@/components/Modal';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Party, PartyLedger, PartyTransaction } from '@/types';
import InvoiceModal from '@/components/invoices/InvoiceModal';
import DocumentModal from '@/components/documents/DocumentModal';
import { EmbeddedFormProvider } from '@/components/EmbeddedFormContext';

const GST_TYPE_LABELS: Record<NonNullable<Party['gstType']>, string> = {
  REGISTERED_REGULAR: 'Registered - Regular',
  REGISTERED_COMPOSITION: 'Registered - Composition',
  UNREGISTERED: 'Unregistered business',
  CONSUMER: 'Consumer',
  OVERSEAS: 'Overseas',
  SEZ: 'Special Economic Zone (SEZ)',
};

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function isRegisteredGstType(type: Party['gstType']) {
  return type === 'REGISTERED_REGULAR' || type === 'REGISTERED_COMPOSITION' || type === 'SEZ';
}

export default function PartiesPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [ledger, setLedger] = useState<PartyLedger | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [detailError, setDetailError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [formTab, setFormTab] = useState<'profile' | 'credit'>('profile');
  const [activeForm, setActiveForm] = useState<'sale' | 'expense' | null>(null);

  const loadParties = useCallback(async (preferredId?: string) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<Party>('/parties');
      setParties(data);
      setSelectedPartyId((current) => {
        if (preferredId && data.some((party) => party.id === preferredId)) return preferredId;
        if (current && data.some((party) => party.id === current)) return current;
        return '';
      });
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load parties.'));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLedger = useCallback(async (partyId: string) => {
    setDetailLoading(true);
    setDetailError('');
    try {
      const { data } = await api.get<PartyLedger>(`/parties/${partyId}/ledger`);
      setLedger(data);
    } catch (loadError: unknown) {
      setLedger(null);
      setDetailError(getApiError(loadError, 'Could not load party transactions.'));
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadParties();
  }, [loadParties]);

  useEffect(() => {
    if (!selectedPartyId) {
      setLedger(null);
      return;
    }
    void loadLedger(selectedPartyId);
  }, [loadLedger, selectedPartyId]);

  const filteredParties = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return parties;
    return parties.filter((party) => [party.name, party.phone, party.email, party.gstin]
      .some((value) => value?.toLowerCase().includes(query)));
  }, [parties, search]);

  const selectedSummary = parties.find((party) => party.id === selectedPartyId) ?? null;
  const selectedParty = ledger?.party ?? selectedSummary;

  function openAddParty() {
    setEditingParty(null);
    setFormTab('profile');
    setShowForm(true);
  }

  function openPartySettings(tab: 'profile' | 'credit' = 'profile') {
    if (!selectedParty) return;
    setEditingParty(selectedParty);
    setFormTab(tab);
    setShowForm(true);
  }

  function openWhatsApp(message: string) {
    const number = (selectedParty?.whatsappNumber || selectedParty?.phone || '').replace(/\D/g, '');
    if (!number) return;
    window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  }

  function openSms() {
    if (!selectedParty?.phone) return;
    window.location.href = `sms:${selectedParty.phone}?body=${encodeURIComponent(`Hello ${selectedParty.name},`)}`;
  }

  function openEmail() {
    if (!selectedParty?.email) return;
    window.location.href = `mailto:${selectedParty.email}?subject=${encodeURIComponent(`Message for ${selectedParty.name}`)}&body=${encodeURIComponent(`Hello ${selectedParty.name},`)}`;
  }

  function exportTransactions() {
    if (!selectedParty || !ledger) return;
    const rows = [
      ['Type', 'Number', 'Date', 'Total', 'Balance'],
      ...ledger.transactions.map((transaction) => [
        transaction.type.replaceAll('_', ' '), transaction.number,
        new Date(transaction.date).toLocaleDateString('en-IN'), transaction.amount, transaction.balance,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${selectedParty.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-transactions.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const hasWhatsApp = Boolean(selectedParty?.whatsappNumber || selectedParty?.phone);

  return (
    <>
      <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col bg-[#eef3f8] lg:min-h-dvh">
        <header className="flex min-h-[76px] flex-col justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:px-6">
          <div><div className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md shadow-blue-200"><Users size={18} /></span><div><h1 className="text-xl font-semibold tracking-tight text-slate-950">Parties</h1><p className="text-[11px] text-slate-400">Customers, suppliers and account activity</p></div></div></div>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <button type="button" onClick={() => setActiveForm('sale')} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${activeForm === 'sale' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}><Plus size={15} /> Add Sale</button>
            <button type="button" onClick={() => setActiveForm('expense')} className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-bold transition ${activeForm === 'expense' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}><Plus size={15} /> Add Expense</button>
            <button type="button" onClick={() => { setActiveForm(null); openAddParty(); }} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-blue-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-blue-700"><Plus size={16} /> Add Party</button>
            <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
            <button type="button" disabled={!selectedParty} onClick={() => openPartySettings('credit')} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 disabled:opacity-35" aria-label="Party settings"><Settings size={17} /></button>
            <button type="button" className="flex h-8 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="More options"><MoreVertical size={18} /></button>
          </div>
        </header>

        <section className="flex min-h-0 flex-1 flex-col gap-3 p-3">
          <PartyRegisterTable parties={filteredParties} selectedId={selectedPartyId} search={search} onSearch={setSearch} onSelect={setSelectedPartyId} loading={loading} error={error} onRetry={() => loadParties()} />
          <aside className="hidden">
            <div className="p-3">
              <div className="relative"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full rounded-full border border-slate-300 bg-white pl-10 pr-3 text-xs outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Search Party Name" aria-label="Search parties" /></div>
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_110px] border-y border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600"><span className="px-3 py-2.5">Party Name</span><span className="border-l border-slate-200 px-3 py-2.5 text-right">Amount</span></div>
            <div className="max-h-[330px] flex-1 overflow-y-auto lg:max-h-none">
              {loading ? <LoadingState label="Loading parties..." /> : error ? <ErrorState message={error} onRetry={() => loadParties()} /> : parties.length === 0 ? <EmptyState icon={UserRound} title="No parties yet" description="Add your first party to start billing." /> : filteredParties.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">No party matches your search.</div> : filteredParties.map((party) => {
                const active = party.id === selectedPartyId;
                const balance = Number(party.balanceDue ?? 0);
                return <button key={party.id} type="button" onClick={() => setSelectedPartyId(party.id)} className={`grid w-full grid-cols-[minmax(0,1fr)_110px] border-l-[3px] text-left transition ${active ? 'border-blue-600 bg-blue-50' : 'border-b border-l-transparent border-b-slate-100 hover:bg-slate-50'}`}><span className="truncate px-3 py-3 text-xs font-bold text-slate-900">{party.name}</span><span className={`border-l border-slate-200/70 px-2.5 py-3 text-right text-xs font-semibold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-emerald-600' : 'text-slate-500'}`}>{formatCurrency(Math.abs(balance))}</span></button>;
              })}
            </div>
            <div className="m-2 mt-auto flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[11px] font-bold text-slate-700">{filteredParties.length} parties</p><p className="text-[10px] text-slate-400">Name, phone, email or GSTIN</p></div>
          </aside>

          <main className="flex min-w-0 flex-col gap-3">
            {!selectedParty ? <section className="flex min-h-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-3.5 py-3"><h3 className="text-sm font-bold text-slate-950">Transactions</h3><p className="text-[10px] text-slate-400">Select a party from the register to view its complete account activity</p></div><EmptyState icon={Users} title="Select a party" description="Click a party name above to view all transactions and account details." /></section> : <>
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5"><h2 className="truncate text-base font-extrabold text-slate-950">{selectedParty.name}</h2><button type="button" onClick={() => openPartySettings('profile')} className="text-blue-600 hover:text-blue-800" aria-label="Edit party"><Pencil size={15} /></button></div>
                    <div className="mt-3 grid items-start gap-3 sm:grid-cols-2 xl:grid-cols-[160px_220px_minmax(260px,1fr)]">
                      <PartyField icon={Phone} label="Phone Number" value={selectedParty.phone} />
                      <PartyField icon={Mail} label="Email" value={selectedParty.email} />
                      <PartyField icon={MapPin} label="Billing Address" value={selectedParty.billingAddr} />
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <ContactAction label="Email" disabled={!selectedParty.email} onClick={openEmail} className="text-violet-600 hover:text-violet-800"><Mail size={14} /></ContactAction>
                    <ContactAction label="SMS" disabled={!selectedParty.phone} onClick={openSms} className="text-blue-600 hover:text-blue-800"><MessageSquareText size={14} /></ContactAction>
                    <ContactAction label="WhatsApp" disabled={!hasWhatsApp} onClick={() => openWhatsApp(`Hello ${selectedParty.name},`)} className="text-emerald-600 hover:text-emerald-800"><MessageCircle size={14} /></ContactAction>
                  </div>
                </div>
                {ledger && <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-slate-200 bg-slate-200 sm:grid-cols-4"><MiniTotal label="Receivable" value={ledger.summary.balanceDue} /><MiniTotal label="Total Sales" value={ledger.summary.totalBilled} /><MiniTotal label="Received" value={ledger.summary.totalReceived} /><MiniTotal label="Credit Available" value={ledger.summary.creditAvailable} /></div>}
              </section>

              <section className="flex min-h-[360px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-200 px-3.5 py-3"><div><h3 className="text-sm font-bold text-slate-950">Transactions</h3><p className="text-[10px] text-slate-400">Invoices, payments and running balance</p></div><div className="flex items-center gap-0.5"><button type="button" onClick={() => window.print()} className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100" aria-label="Print transactions"><Printer size={16} /></button><button type="button" disabled={!ledger?.transactions.length} onClick={exportTransactions} className="flex h-8 w-8 items-center justify-center rounded-full text-blue-600 hover:bg-blue-50 disabled:opacity-30" aria-label="Export transactions"><FileSpreadsheet size={16} /></button></div></div>
                {detailLoading && !ledger ? <LoadingState label="Loading party account..." /> : detailError ? <ErrorState message={detailError} onRetry={() => loadLedger(selectedParty.id)} /> : ledger?.transactions.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] table-fixed text-xs"><thead className="bg-slate-50 text-left text-[11px] font-bold text-slate-600"><tr><th className="w-[18%] border-r border-slate-200 px-3 py-2.5">Type</th><th className="w-[24%] border-r border-slate-200 px-3 py-2.5">Number</th><th className="w-[18%] border-r border-slate-200 px-3 py-2.5">Date</th><th className="w-[20%] border-r border-slate-200 px-3 py-2.5 text-right">Total</th><th className="w-[20%] px-3 py-2.5 text-right">Balance</th></tr></thead><tbody>{ledger.transactions.map((transaction) => <TransactionRow key={transaction.id} transaction={transaction} />)}</tbody></table></div> : <div className="flex flex-1 items-center justify-center px-5 py-10 text-center"><div><FileText className="mx-auto text-slate-300" size={26} /><p className="mt-2 text-xs font-bold text-slate-600">No transactions yet</p><p className="mt-1 text-[11px] text-slate-400">Invoices and payments will appear here.</p></div></div>}
              </section>
            </>}
          </main>
        </section>
      </div>

      {activeForm && (
        <EmbeddedFormProvider value={{ initialPartyId: selectedParty?.id }}>
          {activeForm === 'sale' ? (
            <InvoiceModal onClose={() => setActiveForm(null)} />
          ) : (
            <DocumentModal type="PURCHASE_INVOICE" onClose={() => setActiveForm(null)} />
          )}
        </EmbeddedFormProvider>
      )}

      {showForm && (
        <PartyFormModal
          party={editingParty}
          initialTab={formTab}
          onClose={() => setShowForm(false)}
          onSaved={(savedParty) => {
            setShowForm(false);
            void loadParties(savedParty.id);
          }}
        />
      )}
    </>
  );
}

function PartyRegisterTable({ parties, selectedId, search, onSearch, onSelect, loading, error, onRetry }: { parties: Party[]; selectedId: string; search: string; onSearch: (value: string) => void; onSelect: (id: string) => void; loading: boolean; error: string; onRetry: () => void }) {
  return <section className="overflow-hidden rounded-xl border border-slate-300 bg-white shadow-sm">
    <div className="flex flex-col gap-3 border-b border-slate-300 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-sm font-semibold text-slate-900">Party Register</h2><p className="text-[10px] text-slate-500">{parties.length} records shown · select a row to open its account</p></div>
      <div className="relative w-full sm:w-80"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => onSearch(event.target.value)} className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-xs outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Search name, phone, email or GSTIN" /></div>
    </div>
    {loading ? <LoadingState label="Loading parties..." /> : error ? <ErrorState message={error} onRetry={onRetry} /> : parties.length === 0 ? <EmptyState icon={Users} title="No parties found" description={search ? 'Try a different search.' : 'Add your first party to start billing.'} /> : <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-xs">
        <thead className="bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600"><tr><th className="w-11 border-r border-slate-300 px-2 py-3 text-center">#</th><th className="border-r border-slate-300 px-3 py-3">Party Name</th><th className="border-r border-slate-300 px-3 py-3">Phone</th><th className="border-r border-slate-300 px-3 py-3">Email</th><th className="border-r border-slate-300 px-3 py-3">GSTIN</th><th className="border-r border-slate-300 px-3 py-3 text-right">Total Sales</th><th className="border-r border-slate-300 px-3 py-3 text-right">Received</th><th className="px-3 py-3 text-right">Balance</th></tr></thead>
        <tbody>{parties.map((party, index) => { const balance = Number(party.balanceDue ?? 0); return <tr key={party.id} onClick={() => onSelect(party.id)} className={`cursor-pointer border-t border-slate-200 transition ${party.id === selectedId ? 'bg-blue-50 outline outline-1 -outline-offset-1 outline-blue-400' : index % 2 ? 'bg-slate-50/70 hover:bg-blue-50/40' : 'bg-white hover:bg-blue-50/40'}`}><td className="border-r border-slate-200 px-2 py-3 text-center text-slate-400">{index + 1}</td><td className="border-r border-slate-200 px-3 py-3 font-semibold text-slate-900">{party.name}</td><td className="border-r border-slate-200 px-3 py-3 text-slate-600">{party.phone || '—'}</td><td className="border-r border-slate-200 px-3 py-3 text-slate-600">{party.email || '—'}</td><td className="border-r border-slate-200 px-3 py-3 font-mono text-[11px] text-slate-600">{party.gstin || '—'}</td><td className="border-r border-slate-200 px-3 py-3 text-right">{formatCurrency(party.totalBilled ?? 0)}</td><td className="border-r border-slate-200 px-3 py-3 text-right text-emerald-700">{formatCurrency(party.totalReceived ?? 0)}</td><td className={`px-3 py-3 text-right font-semibold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>{formatCurrency(Math.abs(balance))}{balance < 0 ? ' Cr' : balance > 0 ? ' Dr' : ''}</td></tr>; })}</tbody>
      </table>
    </div>}
  </section>;
}

function PartyField({ icon: Icon, label, value }: { icon: typeof Phone; label: string; value?: string | null }) { return <div className="flex min-w-0 items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5"><Icon size={14} className="mt-0.5 shrink-0 text-blue-500" /><div className="min-w-0"><p className="text-[9px] uppercase tracking-wide text-slate-400">{label}</p><p className="mt-0.5 whitespace-pre-line break-words text-xs leading-4 text-slate-800">{value || 'Not provided'}</p></div></div>; }

function ContactAction({ children, label, disabled, onClick, className }: { children: React.ReactNode; label: string; disabled: boolean; onClick: () => void; className: string }) { return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className={`inline-flex h-8 w-8 items-center justify-center transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100 ${className}`}>{children}</button>; }

function MiniTotal({ label, value }: { label: string; value: number }) { return <div className="bg-slate-50 px-2.5 py-2"><p className="text-[9px] font-medium text-slate-400">{label}</p><p className={`text-[11px] font-bold ${label === 'Receivable' && value > 0 ? 'text-red-600' : 'text-slate-800'}`}>{formatCurrency(Math.abs(value))}</p></div>; }

function TransactionRow({ transaction }: { transaction: PartyTransaction }) {
  const isPayment = transaction.type === 'PAYMENT_IN';
  const isOpening = transaction.type === 'OPENING_BALANCE';
  return <tr className="border-b border-slate-100 hover:bg-blue-50/30"><td className="truncate border-r border-slate-100 px-3 py-3 font-medium text-slate-800"><span className="inline-flex items-center gap-1.5">{isPayment ? <ArrowDownLeft size={12} className="text-emerald-500" /> : <ArrowUpRight size={12} className={isOpening ? 'text-violet-500' : 'text-blue-500'} />}{isPayment ? 'Payment In' : isOpening ? 'Opening Balance' : 'Sale'}</span></td><td className="truncate border-r border-slate-100 px-3 py-3">{transaction.invoiceId && transaction.type === 'SALE_INVOICE' ? <Link href={`/invoices/${transaction.invoiceId}`} className="font-bold text-blue-600 hover:underline">{transaction.number}</Link> : <span className="font-medium text-slate-700">{transaction.number}</span>}</td><td className="whitespace-nowrap border-r border-slate-100 px-3 py-3 text-slate-600">{formatDate(transaction.date)}</td><td className={`whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right font-semibold ${isPayment ? 'text-emerald-600' : 'text-slate-900'}`}>{isPayment || transaction.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(transaction.amount))}</td><td className={`whitespace-nowrap px-3 py-3 text-right font-bold ${transaction.balance > 0 ? 'text-red-600' : transaction.balance < 0 ? 'text-emerald-600' : 'text-slate-700'}`}>{formatCurrency(Math.abs(transaction.balance))}{transaction.balance < 0 ? ' Cr' : transaction.balance > 0 ? ' Dr' : ''}</td></tr>;
}

type PartyFormState = {
  name: string; email: string; phone: string; whatsappNumber: string; whatsappOptIn: boolean;
  gstin: string; gstType: NonNullable<Party['gstType']>; billingAddr: string; shippingAddr: string;
  creditLimit: string; openingBalance: string; openingBalanceType: NonNullable<Party['openingBalanceType']>;
  notes: string; invoiceDeliveryMode: NonNullable<Party['invoiceDeliveryMode']>; invoiceDeliveryChannel: NonNullable<Party['invoiceDeliveryChannel']>;
};

function createForm(party: Party | null): PartyFormState {
  return {
    name: party?.name ?? '', email: party?.email ?? '', phone: party?.phone ?? '',
    whatsappNumber: party?.whatsappNumber ?? party?.phone ?? '', whatsappOptIn: party?.whatsappOptIn ?? false,
    gstin: party?.gstin ?? '', gstType: party?.gstType ?? 'UNREGISTERED',
    billingAddr: party?.billingAddr ?? '', shippingAddr: party?.shippingAddr ?? '',
    creditLimit: String(party?.creditLimit ?? 0), openingBalance: String(party?.openingBalance ?? 0),
    openingBalanceType: party?.openingBalanceType ?? 'RECEIVABLE', notes: party?.notes ?? '',
    invoiceDeliveryMode: party?.invoiceDeliveryMode ?? 'MANUAL', invoiceDeliveryChannel: party?.invoiceDeliveryChannel ?? 'BOTH',
  };
}

function PartyFormModal({ party, initialTab, onClose, onSaved }: { party: Party | null; initialTab: 'profile' | 'credit'; onClose: () => void; onSaved: (party: Party) => void }) {
  const [tab, setTab] = useState(initialTab);
  const [form, setForm] = useState<PartyFormState>(() => createForm(party));
  const [hasDifferentWhatsApp, setHasDifferentWhatsApp] = useState(
    () => Boolean(party?.whatsappNumber && party.whatsappNumber.trim() !== (party.phone ?? '').trim()),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const registered = isRegisteredGstType(form.gstType);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (registered && !GSTIN_PATTERN.test(form.gstin.trim().toUpperCase())) {
      setTab('profile');
      setError('Enter a valid 15-character GSTIN in the official alphanumeric format.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        name: form.name.trim(), email: form.email.trim().toLowerCase() || undefined,
        phone: form.phone.trim() || undefined,
        whatsappNumber: (hasDifferentWhatsApp ? form.whatsappNumber : form.phone).trim() || undefined,
        gstin: registered ? form.gstin.trim().toUpperCase() : undefined, billingAddr: form.billingAddr.trim() || undefined,
        shippingAddr: form.shippingAddr.trim() || undefined, notes: form.notes.trim() || undefined,
        creditLimit: Math.max(0, Number(form.creditLimit) || 0), openingBalance: Math.max(0, Number(form.openingBalance) || 0),
      };
      const { data } = party ? await api.patch<Party>(`/parties/${party.id}`, payload) : await api.post<Party>('/parties', payload);
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not save party.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={party ? 'Edit party' : 'Add party'} onClose={onClose} size="lg" className="!max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="mb-4 rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div><label htmlFor="party-name" className="label">Party name *</label><input id="party-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Business or customer name" /></div>
          <div><label htmlFor="party-phone" className="label">Phone number</label><input id="party-phone" type="tel" autoComplete="tel" className="input-field" value={form.phone} onChange={(event) => { const phone = event.target.value; setForm({ ...form, phone, whatsappNumber: hasDifferentWhatsApp ? form.whatsappNumber : phone }); }} /></div>
          <div><label htmlFor="party-whatsapp" className="label">WhatsApp number</label><input id="party-whatsapp" type="tel" autoComplete="tel" disabled={!hasDifferentWhatsApp} className="input-field disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500" value={hasDifferentWhatsApp ? form.whatsappNumber : form.phone} onChange={(event) => setForm({ ...form, whatsappNumber: event.target.value })} placeholder={hasDifferentWhatsApp ? 'Enter WhatsApp number' : 'Same as phone number'} /><label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[10px] font-semibold text-slate-600"><input type="checkbox" checked={hasDifferentWhatsApp} onChange={(event) => { const different = event.target.checked; setHasDifferentWhatsApp(different); setForm({ ...form, whatsappNumber: different ? (form.whatsappNumber === form.phone ? '' : form.whatsappNumber) : form.phone }); }} /><span>WhatsApp number is different</span></label></div>
          <div><label htmlFor="party-email" className="label">Email</label><input id="party-email" type="email" autoComplete="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <label className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-[10px] leading-4 text-emerald-800 md:col-span-2 xl:col-span-4"><input type="checkbox" className="mt-0.5" checked={form.whatsappOptIn} onChange={(event) => setForm({ ...form, whatsappOptIn: event.target.checked })} /><span><strong>WhatsApp consent recorded.</strong> Required for automatic delivery.</span></label>
        </div>

        <div className="mb-4 mt-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button type="button" onClick={() => setTab('profile')} className={`rounded-md px-2 py-2 text-[11px] font-bold transition ${tab === 'profile' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px] text-blue-700">1</span>GST & Address</button>
          <button type="button" onClick={() => setTab('credit')} className={`rounded-md px-2 py-2 text-[11px] font-bold transition ${tab === 'credit' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}><span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-100 text-[9px] text-blue-700">2</span>Credit & Balance</button>
        </div>

        {tab === 'profile' ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="gst-type" className="label">GST type</label><select id="gst-type" className="input-field" value={form.gstType} onChange={(event) => { const gstType = event.target.value as PartyFormState['gstType']; setForm({ ...form, gstType, gstin: isRegisteredGstType(gstType) ? form.gstin : '' }); }}>{Object.entries(GST_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
              {registered ? <div><label htmlFor="party-gstin" className="label">GSTIN *</label><input id="party-gstin" required className="input-field uppercase" minLength={15} maxLength={15} value={form.gstin} onChange={(event) => setForm({ ...form, gstin: event.target.value.replace(/\s/g, '').toUpperCase() })} placeholder="33ABCDE1234F1Z5" /></div> : <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-[11px] text-slate-500">GSTIN is not applicable.</div>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label htmlFor="billing-address" className="label">Billing address</label><textarea id="billing-address" rows={2} className="input-field resize-none" value={form.billingAddr} onChange={(event) => setForm({ ...form, billingAddr: event.target.value })} /></div>
              <div><div className="flex items-center justify-between"><label htmlFor="shipping-address" className="label">Shipping address</label><button type="button" onClick={() => setForm({ ...form, shippingAddr: form.billingAddr })} className="mb-1 text-[10px] font-bold text-blue-600 hover:underline">Same as billing</button></div><textarea id="shipping-address" rows={2} className="input-field resize-none" value={form.shippingAddr} onChange={(event) => setForm({ ...form, shippingAddr: event.target.value })} /></div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-3">
                <label htmlFor="opening-balance" className="label">Opening balance</label>
                <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white transition hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500">INR</span>
                  <input id="opening-balance" type="number" min="0" step="0.01" inputMode="decimal" aria-describedby="opening-balance-help" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" value={form.openingBalance} onChange={(event) => setForm({ ...form, openingBalance: event.target.value })} placeholder="0.00" />
                </div>
                <p className="mb-2 mt-2 text-[10px] font-bold uppercase tracking-wide text-slate-400">Balance type</p>
                <div className="grid grid-cols-2 gap-2" role="group" aria-label="Opening balance type">
                  <button type="button" aria-pressed={form.openingBalanceType === 'RECEIVABLE'} onClick={() => setForm({ ...form, openingBalanceType: 'RECEIVABLE' })} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition ${form.openingBalanceType === 'RECEIVABLE' ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-slate-50 text-slate-500 hover:text-slate-700'}`}><ArrowDownLeft aria-hidden="true" size={14} />To receive</button>
                  <button type="button" aria-pressed={form.openingBalanceType === 'PAYABLE'} onClick={() => setForm({ ...form, openingBalanceType: 'PAYABLE' })} className={`flex h-9 items-center justify-center gap-1.5 rounded-lg text-[11px] font-bold transition ${form.openingBalanceType === 'PAYABLE' ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200' : 'bg-slate-50 text-slate-500 hover:text-slate-700'}`}><ArrowUpRight aria-hidden="true" size={14} />To pay</button>
                </div>
                <p id="opening-balance-help" className="mt-2 text-[10px] leading-4 text-slate-400">The balance carried forward when this party is created.</p>
              </div>
              <div className="rounded-xl border border-slate-200 p-3">
                <label htmlFor="credit-limit" className="label">Credit limit</label>
                <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white transition hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500">INR</span>
                  <input id="credit-limit" type="number" min="0" step="0.01" inputMode="decimal" aria-describedby="credit-limit-help" className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" value={form.creditLimit} onChange={(event) => setForm({ ...form, creditLimit: event.target.value })} placeholder="0.00" />
                </div>
                <div id="credit-limit-help" className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[10px] leading-4 text-blue-700">
                  Set the maximum unpaid balance allowed for this party. Enter 0 for no credit.
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold text-slate-800">Invoice delivery</p><p className="mt-1 text-[10px] leading-4 text-slate-500">Choose manual sharing or send automatically after invoice creation.</p></div><select className="input-field min-h-8 w-32 py-1 text-xs" value={form.invoiceDeliveryMode} onChange={(event) => setForm({ ...form, invoiceDeliveryMode: event.target.value as PartyFormState['invoiceDeliveryMode'] })}><option value="MANUAL">Manual</option><option value="AUTOMATIC">Automatic</option></select></div>{form.invoiceDeliveryMode === 'AUTOMATIC' && <div className="mt-3 border-t border-slate-200 pt-3"><label htmlFor="delivery-channel" className="label">Automatic channel</label><select id="delivery-channel" className="input-field" value={form.invoiceDeliveryChannel} onChange={(event) => setForm({ ...form, invoiceDeliveryChannel: event.target.value as PartyFormState['invoiceDeliveryChannel'] })}><option value="BOTH">Email and WhatsApp</option><option value="EMAIL">Email only</option><option value="WHATSAPP">WhatsApp only</option></select></div>}</div>
            <div><label htmlFor="party-notes" className="label">Credit terms / notes</label><textarea id="party-notes" rows={3} className="input-field resize-none" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Example: Net 30 days, preferred payment method, internal notes..." /></div>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-28">{saving ? 'Saving...' : party ? 'Update party' : 'Save party'}</button></div>
      </form>
    </Modal>
  );
}
