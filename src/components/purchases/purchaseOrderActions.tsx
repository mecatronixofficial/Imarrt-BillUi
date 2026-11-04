'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/ToastProvider';
import type { RowAction } from '@/components/RowActions';
import { api, getApiError, getCurrentUser } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { whatsappLink } from '@/lib/messageTemplates';
import type { BusinessDocument, PurchaseOrder, PurchaseOrderStatus } from '@/types';

/** Orders that can still be edited, sent, converted or cancelled. */
export const OPEN_ORDER: PurchaseOrderStatus[] = ['DRAFT', 'SENT', 'CONFIRMED'];

const escape = (value: string | number) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

function orderMessage(order: PurchaseOrder) {
  return `Purchase order ${order.orderNumber} dated ${formatDate(order.orderDate)}\n${order.items.map((item) => `• ${item.description} × ${Number(item.quantity)} ${item.unit}`).join('\n')}\nTotal: ${formatCurrency(order.grandTotal)}${order.expectedDeliveryDate ? `\nDeliver by: ${formatDate(order.expectedDeliveryDate)}` : ''}`;
}

/** Prints the order through a hidden frame, so the page itself is untouched. */
export function printPurchaseOrder(order: PurchaseOrder) {
  const rows = order.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escape(item.description)}</td><td class="n">${escape(Number(item.quantity))} ${escape(item.unit)}</td><td class="n">${escape(Number(item.unitPrice).toFixed(2))}</td><td class="n">${escape(Number(item.taxRate))}%</td><td class="n">${escape(Number(item.lineTotal).toFixed(2))}</td></tr>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escape(order.orderNumber)}</title><style>body{font-family:Arial,sans-serif;color:#172033;font-size:12px;margin:24px}h1{font-size:20px;margin:0}.muted{color:#55607a}.grid{display:flex;justify-content:space-between;gap:24px;margin:16px 0}table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #ccd3dc;padding:6px 8px;text-align:left}th{background:#eef3f8}.n{text-align:right}.totals{margin-left:auto;width:260px;margin-top:12px}.totals div{display:flex;justify-content:space-between;padding:3px 0}.grand{font-weight:700;font-size:14px;border-top:1px solid #ccd3dc}</style></head><body>
<h1>Purchase Order</h1><p class="muted">${escape(order.orderNumber)} · ${escape(order.status.replaceAll('_', ' '))}</p>
<div class="grid"><div><strong>Supplier</strong><br>${escape(order.supplier.name)}${order.supplier.phone ? `<br>${escape(order.supplier.phone)}` : ''}${order.supplier.gstin ? `<br>GSTIN: ${escape(order.supplier.gstin)}` : ''}</div>
<div><strong>Order date:</strong> ${escape(formatDate(order.orderDate))}${order.expectedDeliveryDate ? `<br><strong>Expected delivery:</strong> ${escape(formatDate(order.expectedDeliveryDate))}` : ''}${order.paymentTerms ? `<br><strong>Payment terms:</strong> ${escape(order.paymentTerms)}` : ''}</div></div>
<table><thead><tr><th>#</th><th>Item</th><th class="n">Qty</th><th class="n">Price</th><th class="n">Tax</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="totals"><div><span>Subtotal</span><span>${escape(formatCurrency(order.subTotal))}</span></div><div><span>Tax</span><span>${escape(formatCurrency(order.taxTotal))}</span></div>${Number(order.discount) ? `<div><span>Discount</span><span>- ${escape(formatCurrency(order.discount))}</span></div>` : ''}<div class="grand"><span>Total</span><span>${escape(formatCurrency(order.grandTotal))}</span></div></div>
${order.deliveryLocation ? `<p><strong>Deliver to:</strong> ${escape(order.deliveryLocation)}</p>` : ''}${order.notes ? `<p><strong>Notes:</strong> ${escape(order.notes)}</p>` : ''}</body></html>`;
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;right:0;bottom:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc || !frame.contentWindow) return frame.remove();
  doc.open();
  doc.write(html);
  doc.close();
  frame.contentWindow.focus();
  frame.contentWindow.print();
  window.setTimeout(() => frame.remove(), 1000);
}

/**
 * The ⋮ actions for a purchase order, plus the confirmation dialogs they open.
 * `onChanged` reloads the caller's data; `onDeleted` runs instead after a delete.
 */
export function usePurchaseOrderActions({ onChanged, onDeleted }: { onChanged: () => void; onDeleted?: () => void }) {
  const router = useRouter();
  const [canDelete, setCanDelete] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [confirm, setConfirm] = useState<{ order: PurchaseOrder; action: 'cancel' | 'delete' } | null>(null);

  useEffect(() => {
    void getCurrentUser().then((user) => setCanDelete(Boolean(user && user.role !== 'STAFF'))).catch(() => undefined);
  }, []);

  async function setStatus(order: PurchaseOrder, status: PurchaseOrderStatus, done: string) {
    setBusyId(order.id);
    try {
      await api.patch(`/purchase-orders/${order.id}/status`, { status });
      toast.success(done, { description: order.orderNumber });
      onChanged();
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not update the order.'));
    } finally {
      setBusyId('');
    }
  }

  async function convert(order: PurchaseOrder) {
    setBusyId(order.id);
    try {
      const { data } = await api.post<BusinessDocument>(`/purchase-orders/${order.id}/convert-to-bill`, undefined, { headers: order.branchId ? { 'X-Branch-Id': order.branchId } : undefined });
      toast.success('Purchase bill created', { description: `${order.orderNumber} → ${data.documentNumber}` });
      router.push(`/documents/${data.id}`);
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not convert the purchase order.'));
      setBusyId('');
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    const { order, action } = confirm;
    setBusyId(order.id);
    try {
      if (action === 'cancel') {
        await api.patch(`/purchase-orders/${order.id}/status`, { status: 'CANCELLED' });
        toast.success('Purchase order cancelled', { description: order.orderNumber });
        onChanged();
      } else {
        await api.delete(`/purchase-orders/${order.id}`);
        toast.success('Purchase order deleted', { description: order.orderNumber });
        if (onDeleted) onDeleted();
        else onChanged();
      }
      setConfirm(null);
    } catch (failure) {
      toast.error(getApiError(failure, action === 'cancel' ? 'Could not cancel the order.' : 'Could not delete the order.'));
    } finally {
      setBusyId('');
    }
  }

  function actionsFor(order: PurchaseOrder, { includeView = true }: { includeView?: boolean } = {}): Array<RowAction | false> {
    const open = OPEN_ORDER.includes(order.status) && !order.convertedDocumentId;
    return [
      includeView && { label: 'View', icon: 'view', href: `/purchases/orders/${order.id}` },
      open && { label: 'Edit', icon: 'edit', href: `/purchases/orders/${order.id}/edit` },
      { label: 'Duplicate', icon: 'duplicate', href: `/purchases/orders/new?duplicateId=${order.id}` },
      { label: 'Print', icon: 'print', onClick: () => printPurchaseOrder(order) },
      { label: 'Send on WhatsApp', icon: 'whatsapp', href: whatsappLink(order.supplier.phone, orderMessage(order)), external: true },
      { label: 'Email supplier', icon: 'email', href: `mailto:${encodeURIComponent(order.supplier.email ?? '')}?subject=${encodeURIComponent(`Purchase order ${order.orderNumber}`)}&body=${encodeURIComponent(orderMessage(order))}`, external: true },
      open && order.status === 'DRAFT' && { label: 'Mark as sent', icon: 'send', onClick: () => void setStatus(order, 'SENT', 'Marked as sent') },
      open && order.status !== 'CONFIRMED' && { label: 'Mark as confirmed', icon: 'send', onClick: () => void setStatus(order, 'CONFIRMED', 'Marked as confirmed') },
      open && { label: 'Convert to purchase bill', icon: 'convert', onClick: () => void convert(order) },
      Boolean(order.convertedDocumentId) && { label: 'Open purchase bill', icon: 'view', href: `/documents/${order.convertedDocumentId}` },
      open && { label: 'Cancel order', icon: 'cancel', danger: true, onClick: () => setConfirm({ order, action: 'cancel' }) },
      canDelete && !order.convertedDocumentId && { label: 'Delete', icon: 'delete', danger: true, onClick: () => setConfirm({ order, action: 'delete' }) },
    ];
  }

  const dialogs = confirm && (
    <ConfirmDialog
      title={confirm.action === 'cancel' ? 'Cancel this purchase order?' : 'Delete this purchase order?'}
      message={confirm.action === 'cancel'
        ? `${confirm.order.orderNumber} to ${confirm.order.supplier.name} will be marked cancelled. It stays in the register and can't be reopened.`
        : `${confirm.order.orderNumber} to ${confirm.order.supplier.name} will be removed permanently. Orders don't affect stock or accounts, so nothing else changes.`}
      confirmLabel={confirm.action === 'cancel' ? 'Cancel order' : 'Delete'}
      busyLabel={confirm.action === 'cancel' ? 'Cancelling...' : 'Deleting...'}
      busy={busyId === confirm.order.id}
      onCancel={() => setConfirm(null)}
      onConfirm={() => void runConfirm()}
    />
  );

  return { actionsFor, dialogs, busyId };
}
