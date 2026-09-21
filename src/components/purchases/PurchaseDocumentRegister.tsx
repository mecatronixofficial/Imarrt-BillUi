'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FilePlus2, ReceiptText, RotateCcw, Search, Trash2 } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import StatusBadge from '@/components/StatusBadge';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { DOCUMENT_CONFIG } from '@/lib/documents';
import { formatCurrency, formatDate } from '@/lib/format';
import type { BusinessDocument, BusinessDocumentType } from '@/types';

type Props = {
  type: Extract<BusinessDocumentType, 'PURCHASE_INVOICE' | 'DEBIT_NOTE'>;
  title: string;
  description: string;
  actionLabel: string;
  emptyTitle: string;
  emptyDescription: string;
};

export default function PurchaseDocumentRegister(props: Props) {
  const [documents, setDocuments] = useState<BusinessDocument[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BusinessDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await getAllPages<BusinessDocument>('/documents');
      setDocuments(data.filter((document) => document.type === props.type));
    } catch (loadError: unknown) {
      setError(getApiError(loadError, `Could not load ${props.title.toLowerCase()}.`));
    } finally {
      setLoading(false);
    }
  }, [props.title, props.type]);

  useEffect(() => { void loadDocuments(); }, [loadDocuments]);

  async function deleteDocument() {
    if (!deleteTarget) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await api.delete(`/documents/${deleteTarget.id}`);
      setDocuments((current) => current.filter((document) => document.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (deleteFailure: unknown) {
      setDeleteError(getApiError(deleteFailure, 'Could not delete this record.'));
    } finally {
      setDeleting(false);
    }
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return documents;
    return documents.filter((document) => [document.documentNumber, document.supplier?.name, document.party?.name, document.referenceNumber]
      .some((value) => value?.toLowerCase().includes(term)));
  }, [documents, query]);

  const total = documents.reduce((sum, document) => sum + (Number(document.grandTotal) || 0), 0);
  const open = documents.filter((document) => document.status === 'DRAFT' || document.status === 'ISSUED').length;
  const Icon = props.type === 'PURCHASE_INVOICE' ? ReceiptText : RotateCcw;

  return (
    <>
      <PageHeader eyebrow="Purchase Management" title={props.title} description={props.description} action={<Link href={DOCUMENT_CONFIG[props.type].createPath} className="btn-primary inline-flex items-center gap-2"><FilePlus2 aria-hidden="true" size={16} />{props.actionLabel}</Link>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Metric label="Total records" value={documents.length.toLocaleString('en-IN')} />
        <Metric label="Open records" value={open.toLocaleString('en-IN')} />
        <Metric label="Total value" value={formatCurrency(total)} wide />
      </div>
      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-bold text-slate-900">{props.title} register</h2><p className="mt-0.5 text-[10px] text-slate-400">{filtered.length} records shown</p></div>
          <div className="relative w-full sm:w-80"><Search aria-hidden="true" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input aria-label={`Search ${props.title}`} value={query} onChange={(event) => setQuery(event.target.value)} className="input-field pl-9" placeholder="Search number, supplier, or reference..." /></div>
        </div>
        {loading ? <LoadingState label={`Loading ${props.title.toLowerCase()}...`} /> : error ? <ErrorState message={error} onRetry={loadDocuments} /> : filtered.length === 0 ? <EmptyState icon={Icon} title={props.emptyTitle} description={query ? 'Try a different search.' : props.emptyDescription} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[880px] text-sm"><thead className="bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-5 py-3 font-semibold">Number</th><th className="px-5 py-3 font-semibold">Supplier / Party</th><th className="px-5 py-3 font-semibold">Issue date</th><th className="px-5 py-3 font-semibold">Reference</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Total</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">{filtered.map((document) => <tr key={document.id} className="transition hover:bg-slate-50/80"><td className="px-5 py-3.5"><Link href={`/documents/${document.id}`} className="font-bold text-blue-700 hover:underline">{document.documentNumber}</Link></td><td className="px-5 py-3.5 font-semibold text-slate-700">{document.supplier?.name || document.party?.name || 'Not assigned'}</td><td className="whitespace-nowrap px-5 py-3.5 text-slate-500">{formatDate(document.issueDate)}</td><td className="px-5 py-3.5 text-slate-500">{document.referenceNumber || '\u2014'}</td><td className="px-5 py-3.5"><StatusBadge status={document.status} /></td><td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-slate-900">{formatCurrency(document.grandTotal)}</td><td className="px-5 py-3.5 text-right">{['DRAFT', 'CANCELLED'].includes(document.status) ? <button type="button" aria-label={`Delete ${document.documentNumber}`} title="Delete" onClick={() => { setDeleteError(''); setDeleteTarget(document); }} className="inline-flex rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"><Trash2 aria-hidden="true" size={15} /></button> : <span className="text-slate-300" title="Only draft or cancelled records can be deleted">—</span>}</td></tr>)}</tbody></table></div>
        )}
      </section>
      {deleteTarget && <ConfirmDialog title={`Delete ${props.title.toLowerCase()}?`} message={deleteError || `Delete ${deleteTarget.documentNumber}? This cannot be undone.`} busy={deleting} onCancel={() => setDeleteTarget(null)} onConfirm={() => void deleteDocument()} />}
    </>
  );
}

function Metric({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={`card p-4 ${wide ? 'col-span-2 lg:col-span-1' : ''}`}><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1.5 truncate text-xl font-extrabold text-slate-950">{value}</p></div>;
}
