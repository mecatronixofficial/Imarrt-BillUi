'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Printer } from 'lucide-react';
import { ErrorState, LoadingState } from '@/components/ContentState';
import RowActions from '@/components/RowActions';
import StatusBadge from '@/components/StatusBadge';
import { toast } from '@/components/ToastProvider';
import { OPEN_ORDER, printPurchaseOrder, usePurchaseOrderActions } from '@/components/purchases/purchaseOrderActions';
import { api, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type { PurchaseOrder } from '@/types';

export default function PurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const { data } = await api.get<PurchaseOrder>(`/purchase-orders/${id}`);
      setOrder(data);
    } catch (failure) {
      setError(getApiError(failure, 'Could not load this purchase order.'));
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const { actionsFor, dialogs } = usePurchaseOrderActions({ onChanged: () => void load(), onDeleted: () => router.push('/purchases/orders') });

  if (error) return <section className="card"><ErrorState message={error} onRetry={() => void load()} /></section>;
  if (!order) return <section className="card"><LoadingState label="Loading purchase order..." /></section>;
  const editable = OPEN_ORDER.includes(order.status) && !order.convertedDocumentId;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/purchases/orders" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-700"><ArrowLeft size={14} /> Purchase orders</Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-extrabold text-slate-950">{order.orderNumber}</h1>
            <StatusBadge status={order.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{order.supplier.name} · {formatDate(order.orderDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          {editable && <Link href={`/purchases/orders/${order.id}/edit`} className="btn-primary inline-flex items-center gap-2"><Pencil size={15} /> Edit</Link>}
          <button type="button" onClick={() => printPurchaseOrder(order)} className="btn-secondary inline-flex items-center gap-2"><Printer size={15} /> Print</button>
          <RowActions label={`More actions for ${order.orderNumber}`} actions={actionsFor(order, { includeView: false }).filter((action) => !action || (action.label !== 'Edit' && action.label !== 'Print'))} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Item</th>
                  <th className="px-4 py-2.5 text-right">Qty</th>
                  <th className="px-4 py-2.5 text-right">Price/Unit</th>
                  <th className="px-4 py-2.5 text-right">Tax</th>
                  <th className="px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, index) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{item.description}</td>
                    <td className="px-4 py-3 text-right">{Number(item.quantity)} {item.unit}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right">{Number(item.taxRate)}%</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="ml-auto w-full max-w-xs space-y-1.5 border-t border-slate-100 p-4 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{formatCurrency(order.subTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tax</dt><dd>{formatCurrency(order.taxTotal)}</dd></div>
            {Number(order.discount) > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd>- {formatCurrency(order.discount)}</dd></div>}
            <div className="flex justify-between border-t border-slate-100 pt-2 text-base font-extrabold"><dt>Total</dt><dd>{formatCurrency(order.grandTotal)}</dd></div>
          </dl>
        </section>

        <aside className="card space-y-4 p-4 text-sm">
          <Detail label="Supplier" value={<>{order.supplier.name}{order.supplier.phone && <span className="block text-xs text-slate-500">{order.supplier.phone}</span>}</>} />
          <Detail label="Order date" value={formatDate(order.orderDate)} />
          <Detail label="Expected delivery" value={order.expectedDeliveryDate ? formatDate(order.expectedDeliveryDate) : '—'} />
          <Detail label="State of supply" value={order.placeOfSupply || '—'} />
          <Detail label="Payment type" value={`${PAYMENT_LABELS[order.paymentMethod ?? 'credit'] ?? order.paymentMethod}${order.paymentReference ? ` · Ref ${order.paymentReference}` : ''}`} />
          <Detail label="Delivery location" value={order.deliveryLocation || '—'} />
          {(order.transportName || order.lrNumber || order.noOfBags || order.eWayBillNumber) && (
            <Detail label="Transport" value={[order.transportName, order.lrNumber && `LR ${order.lrNumber}`, order.noOfBags && `${order.noOfBags} bags`, order.eWayBillNumber && `E-Way ${order.eWayBillNumber}`].filter(Boolean).join(' · ')} />
          )}
          <Detail label="Terms & conditions" value={order.paymentTerms || '—'} />
          <Detail label="Description" value={order.notes || '—'} />
          {Boolean(order.attachments?.length) && (
            <Detail
              label="Attachments"
              value={order.attachments!.map((attachment) => (
                <button key={attachment.id} type="button" onClick={() => void openAttachment(order.id, attachment.id)} className="block truncate text-left font-semibold text-blue-700 hover:underline">{attachment.fileName}</button>
              ))}
            />
          )}
          {order.convertedDocument && (
            <Detail label="Purchase bill" value={<Link href={`/documents/${order.convertedDocument.id}`} className="font-semibold text-blue-700 hover:underline">{order.convertedDocument.documentNumber}</Link>} />
          )}
        </aside>
      </div>
      {dialogs}
    </>
  );
}

const PAYMENT_LABELS: Record<string, string> = { credit: 'Credit (pay later)', cash: 'Cash', upi: 'UPI', cheque: 'Cheque', bank_transfer: 'Bank transfer', other: 'Other' };

async function openAttachment(orderId: string, attachmentId: string) {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return toast.error('Allow pop-ups to view this file.');
  tab.opener = null;
  try {
    const { data } = await api.get<Blob>(`/purchase-orders/${orderId}/attachments/${attachmentId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    tab.location.href = url;
    window.setTimeout(() => URL.revokeObjectURL(url), 120000);
  } catch (failure) {
    tab.close();
    toast.error(getApiError(failure, 'Could not open the file.'));
  }
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-slate-800">{value}</dd>
    </div>
  );
}
