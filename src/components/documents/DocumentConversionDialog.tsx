'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Modal from '@/components/Modal';
import { LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';
import { api, getApiError } from '@/lib/api';
import { conversionOptions, conversionReversal, type ConversionRecord, type ConversionTarget } from '@/lib/document-conversion';
import type { BusinessDocument } from '@/types';

export default function DocumentConversionDialog({ record, action, onClose, onUpdated }: {
  record: ConversionRecord; action: 'convert' | 'reverse'; onClose: () => void; onUpdated?: () => void;
}) {
  const router = useRouter();
  const options = conversionOptions(record);
  const reversal = conversionReversal(record);
  const sourceId = reversal?.sourceId;
  const expectedTargetId = reversal?.targetId;
  const businessId = 'businessId' in record ? record.businessId : record.business?.id;
  const branchId = record.branchId;
  const headers = { ...(businessId ? { 'X-Business-Id': businessId } : {}), ...(branchId ? { 'X-Branch-Id': branchId } : {}) };
  const [target, setTarget] = useState<ConversionTarget | ''>('');
  const [source, setSource] = useState<BusinessDocument | null>(null);
  const [loading, setLoading] = useState(action === 'reverse');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const number = 'invoiceNumber' in record ? record.invoiceNumber : record.documentNumber;

  useEffect(() => {
    if (action !== 'reverse' || !sourceId) return;
    const controller = new AbortController();
    void api.get<BusinessDocument>(`/documents/${sourceId}`, { signal: controller.signal, headers: { ...(businessId ? { 'X-Business-Id': businessId } : {}), ...(branchId ? { 'X-Branch-Id': branchId } : {}) } }).then(({ data }) => {
      if (controller.signal.aborted) return;
      const currentTarget = data.convertedInvoiceId || data.conversionTarget?.id;
      if (data.status !== 'CONVERTED' || !currentTarget || expectedTargetId && expectedTargetId !== currentTarget) {
        setError('The conversion has changed. Close this dialog and refresh the record.');
        return;
      }
      setSource(data);
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(getApiError(loadError, 'Could not load the original document.'));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [action, sourceId, expectedTargetId, businessId, branchId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || action === 'convert' && !target || action === 'reverse' && !source) return;
    submitting.current = true;
    setSaving(true); setError('');
    try {
      if (action === 'reverse' && source) {
        await api.post(`/documents/${source.id}/reverse-conversion`, { targetId: expectedTargetId || source.convertedInvoiceId || source.conversionTarget?.id }, { headers });
        toast.success(source.type === 'QUOTATION' ? 'Estimate restored' : 'Proforma invoice restored', { description: `${source.documentNumber} is back in draft.` });
        if (record.id === source.id) onUpdated?.();
        onClose();
        router.push(`/documents/${source.id}?companyId=${encodeURIComponent(source.businessId)}`);
      } else {
        const { data } = await api.post<{ id: string }>(`/documents/${record.id}/convert-to-${target}`, undefined, { headers });
        toast.success('Document converted', { description: options.find((option) => option.value === target)?.label });
        onUpdated?.(); onClose();
        router.push(`/${target === 'invoice' ? 'invoices' : 'documents'}/${data.id}${businessId ? '?companyId=' + encodeURIComponent(businessId) : ''}`);
      }
    } catch (saveError) {
      setError(getApiError(saveError, action === 'reverse' ? 'Could not undo this conversion.' : 'Could not convert this document.'));
    } finally { submitting.current = false; setSaving(false); }
  }

  return <Modal title={action === 'reverse' ? reversal?.label || 'Undo conversion' : `Convert ${number}`} onClose={() => { if (!saving) onClose(); }}>
    {loading ? <LoadingState label="Checking the original record..." /> : <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {action === 'convert' ? <>
        <label className="block"><span className="label">Convert to *</span>
          <select aria-label="Convert to" required disabled={saving} className="input-field" value={target} onChange={(event) => setTarget(event.target.value as ConversionTarget | '')}>
            <option value="">Choose document type</option>
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <p className="text-sm text-slate-600">The new record will keep the customer and item details. {target === 'invoice' ? 'A sale invoice posts the sale and reduces stock.' : 'The original record will show as converted.'}</p>
      </> : source && <p className="text-sm leading-6 text-slate-600">Restore <strong>{source.documentNumber}</strong> as a draft. The generated record will leave the active register, and any sale stock movement will be reversed. Payments or later linked transactions must be reversed first.</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={onClose} className="btn-secondary">Cancel</button>
        <button type="submit" disabled={saving || action === 'convert' && !target || action === 'reverse' && !source} className="btn-primary">
          {saving ? 'Saving...' : action === 'reverse' ? 'Restore original' : 'Convert'}
        </button>
      </div>
    </form>}
  </Modal>;
}
