'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  FileText,
  Filter,
  IndianRupee,
  MinusCircle,
  Plus,
  PlusCircle,
  ReceiptText,
  Search,
  ShoppingCart,
  Truck,
  X,
} from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { getAllPages, getApiError } from '@/lib/api';
import { DOCUMENT_CONFIG, DOCUMENT_STATUS_OPTIONS, DOCUMENT_TYPES } from '@/lib/documents';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BusinessDocument, BusinessDocumentStatus, BusinessDocumentType } from '@/types';

const TYPE_ICONS = {
  QUOTATION: FileText,
  PROFORMA_INVOICE: ReceiptText,
  PURCHASE_INVOICE: ShoppingCart,
  DELIVERY_CHALLAN: Truck,
  CREDIT_NOTE: MinusCircle,
  DEBIT_NOTE: PlusCircle,
} as const;

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [type, setType] = useState<'ALL' | BusinessDocumentType>('ALL');
  const [status, setStatus] = useState<'ALL' | BusinessDocumentStatus>('ALL');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<BusinessDocument>('/documents');
      setDocuments(data);
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load business documents.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  useEffect(() => {
    if (!showCreateMenu) return;
    function closeCreateMenu(event: MouseEvent) {
      if (!createMenuRef.current?.contains(event.target as Node)) setShowCreateMenu(false);
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setShowCreateMenu(false);
    }
    document.addEventListener('mousedown', closeCreateMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeCreateMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [showCreateMenu]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return documents.filter((document) => {
      if (type !== 'ALL' && document.type !== type) return false;
      if (status !== 'ALL' && document.status !== status) return false;
      if (!term) return true;
      return [document.documentNumber, document.party?.name, document.supplier?.name, DOCUMENT_CONFIG[document.type].label]
        .some((value) => value?.toLowerCase().includes(term));
    });
  }, [documents, query, status, type]);

  const summary = useMemo(() => ({
    total: documents.length,
    drafts: documents.filter((document) => document.status === 'DRAFT').length,
    active: documents.filter((document) => document.status === 'ISSUED' || document.status === 'ACCEPTED').length,
    value: documents.reduce((total, document) => total + (Number(document.grandTotal) || 0), 0),
  }), [documents]);

  const hasFilters = type !== 'ALL' || status !== 'ALL' || query.trim().length > 0;
  function clearFilters() {
    setType('ALL');
    setStatus('ALL');
    setQuery('');
  }

  return (
    <>
      <PageHeader
        title="Business Documents"
        description="Manage quotations, proforma invoices, purchases, challans, and adjustment notes from one register."
        action={
          <div ref={createMenuRef} className="relative">
            <button type="button" onClick={() => setShowCreateMenu((current) => !current)} className="btn-primary inline-flex items-center gap-2" aria-haspopup="menu" aria-expanded={showCreateMenu}>
              <Plus aria-hidden="true" size={16} /> New document
            </button>
            {showCreateMenu && (
              <div role="menu" className="absolute right-0 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
                <p className="px-2.5 pb-2 pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Choose document type</p>
                {DOCUMENT_TYPES.map((documentType) => {
                  const config = DOCUMENT_CONFIG[documentType];
                  const Icon = TYPE_ICONS[documentType];
                  return (
                    <Link key={documentType} href={`/documents/new?type=${documentType}`} className="flex items-center gap-3 rounded-lg px-2.5 py-2.5 transition hover:bg-slate-50" onClick={() => setShowCreateMenu(false)}>
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${config.soft} ${config.accent}`}><Icon size={17} /></span>
                      <span className="min-w-0"><span className="block text-xs font-bold text-slate-800">{config.label}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{config.description}</span></span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="card flex items-center justify-between gap-3 p-3.5">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total documents</p><p className="mt-1 text-xl font-extrabold text-slate-950">{summary.total}</p></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FileText aria-hidden="true" size={19} /></span>
        </div>
        <button type="button" onClick={() => setStatus(status === 'DRAFT' ? 'ALL' : 'DRAFT')} className={`card flex items-center justify-between gap-3 p-3.5 text-left transition hover:border-amber-200 ${status === 'DRAFT' ? 'ring-2 ring-amber-100' : ''}`}>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Drafts</p><p className="mt-1 text-xl font-extrabold text-slate-950">{summary.drafts}</p></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><ReceiptText aria-hidden="true" size={19} /></span>
        </button>
        <div className="card flex items-center justify-between gap-3 p-3.5">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Issued / accepted</p><p className="mt-1 text-xl font-extrabold text-slate-950">{summary.active}</p></div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><ArrowUpRight aria-hidden="true" size={19} /></span>
        </div>
        <div className="card flex items-center justify-between gap-3 p-3.5">
          <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Document value</p><p className="mt-1 truncate text-xl font-extrabold text-slate-950">{formatCurrency(summary.value)}</p></div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700"><IndianRupee aria-hidden="true" size={19} /></span>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {DOCUMENT_TYPES.map((documentType) => {
          const config = DOCUMENT_CONFIG[documentType];
          const Icon = TYPE_ICONS[documentType];
          const count = documents.filter((document) => document.type === documentType).length;
          return (
            <button type="button" key={documentType} onClick={() => setType(type === documentType ? 'ALL' : documentType)} aria-pressed={type === documentType} className={`card group p-3.5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${type === documentType ? `${config.border} ring-2 ring-slate-100` : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${config.soft} ${config.accent}`}><Icon aria-hidden="true" size={18} /></span>
                <span className="text-xl font-extrabold text-slate-900">{count}</span>
              </div>
              <p className="mt-3 truncate text-xs font-bold text-slate-700">{config.plural}</p>
              <p className="mt-0.5 text-[10px] text-slate-400">Click to filter</p>
            </button>
          );
        })}
      </div>

      <section className="card overflow-hidden">
        <div className="border-b border-slate-100 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Document register</h2>
              <p className="mt-0.5 text-[10px] text-slate-400">Showing {filtered.length} of {documents.length} documents</p>
            </div>
            {type !== 'ALL' && <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${DOCUMENT_CONFIG[type].soft} ${DOCUMENT_CONFIG[type].accent}`}>{DOCUMENT_CONFIG[type].label}</span>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search aria-hidden="true" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search documents" value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-9" placeholder="Search document number, party, or supplier..." />
            </div>
            <div className="relative sm:w-44">
              <Filter aria-hidden="true" size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className="input-field pl-8">
                <option value="ALL">All statuses</option>
                {DOCUMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {hasFilters && <button type="button" onClick={clearFilters} className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"><X aria-hidden="true" size={14} />Clear</button>}
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading documents..." />
        ) : error ? (
          <ErrorState message={error} onRetry={loadDocuments} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={FileText} title="No documents found" description={documents.length ? 'Try changing your filters or search.' : 'Create a quotation, purchase invoice, challan, or adjustment note.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <caption className="sr-only">Business document register</caption>
              <thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-400">
                <tr><th className="px-5 py-3 font-semibold">Document</th><th className="px-5 py-3 font-semibold">Party / Supplier</th><th className="px-5 py-3 font-semibold">Issue date</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Total</th><th className="w-12" /></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((document) => {
                  const config = DOCUMENT_CONFIG[document.type];
                  const Icon = TYPE_ICONS[document.type];
                  return (
                    <tr key={document.id} className="group transition hover:bg-slate-50/80">
                      <td className="px-5 py-3.5"><Link href={`/documents/${document.id}`} className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${config.soft} ${config.accent}`}><Icon size={16} /></span><span><span className="block font-bold text-slate-800 group-hover:text-blue-700">{document.documentNumber}</span><span className="mt-0.5 block text-[10px] font-medium text-slate-400">{config.label}</span></span></Link></td>
                      <td className="px-5 py-3.5"><p className="font-semibold text-slate-700">{document.party?.name || document.supplier?.name || '\u2014'}</p><p className="mt-0.5 text-[10px] text-slate-400">{document.supplier ? 'Supplier' : document.party ? 'Party' : 'Not assigned'}</p></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{formatDate(document.issueDate)}</td>
                      <td className="px-5 py-3.5"><StatusBadge status={document.status} /></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-slate-900">{formatCurrency(document.grandTotal)}</td>
                      <td className="pr-4 text-right"><Link href={`/documents/${document.id}`} aria-label={`Open ${document.documentNumber}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"><ArrowUpRight size={15} /></Link></td>
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
