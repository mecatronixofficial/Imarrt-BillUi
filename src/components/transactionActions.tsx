'use client';

import { useEffect, useState } from 'react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/components/ToastProvider';
import type { RowAction } from '@/components/RowActions';
import { api, getApiError, getCurrentUser } from '@/lib/api';
import { DOCUMENT_CONFIG } from '@/lib/documents';
import { formatCurrency, formatDate } from '@/lib/format';
import { whatsappLink } from '@/lib/messageTemplates';
import { invoiceOutstanding, documentOutstanding } from '@/lib/outstanding';
import type { BusinessDocument, Invoice } from '@/types';

export type TransactionRecord = Invoice | BusinessDocument;

const isInvoice = (record: TransactionRecord): record is Invoice => 'invoiceNumber' in record;
const numberOf = (record: TransactionRecord) => (isInvoice(record) ? record.invoiceNumber : record.referenceNumber || record.documentNumber);
const labelOf = (record: TransactionRecord) => (isInvoice(record) ? 'Sale invoice' : DOCUMENT_CONFIG[record.type].label);
const counterparty = (record: TransactionRecord) => (isInvoice(record) ? record.party : record.supplier ?? record.party);

/** Where the editor lives: sale invoices have their own page, documents open their create page. */
export function editPath(record: TransactionRecord, mode: 'editId' | 'duplicateId') {
  const base = isInvoice(record) ? '/invoices/new' : DOCUMENT_CONFIG[record.type].createPath;
  return `${base}?${mode}=${encodeURIComponent(record.id)}`;
}

/** Mirrors the server's edit rules, so Edit only shows where saving would succeed. */
export function canEdit(record: TransactionRecord) {
  if (isInvoice(record)) return record.status !== 'CANCELLED' && !(Number(record.amountPaid) > 0);
  return ['DRAFT', 'ISSUED', 'ACCEPTED'].includes(record.status) && !(Number(record.paidAmount) > 0);
}

function canCancel(record: TransactionRecord) {
  if (isInvoice(record)) return !['DRAFT', 'CANCELLED'].includes(record.status) && !(Number(record.amountPaid) > 0);
  return ['ISSUED', 'ACCEPTED'].includes(record.status) && !(Number(record.paidAmount) > 0);
}

function canDeleteRecord(record: TransactionRecord) {
  return isInvoice(record) ? true : ['DRAFT', 'CANCELLED'].includes(record.status);
}

function shareMessage(record: TransactionRecord) {
  const balance = isInvoice(record) ? invoiceOutstanding(record) : documentOutstanding(record);
  return `${labelOf(record)} ${numberOf(record)} dated ${formatDate(record.issueDate)}\nAmount: ${formatCurrency(record.grandTotal)}${balance > 0 && record.status !== 'DRAFT' ? `\nBalance due: ${formatCurrency(balance)}` : ''}`;
}

type Extra = {
  /** Opens the PDF preview (print). */
  onPrint: () => void;
  onRecordPayment?: () => void;
  onConvert?: () => void;
  convertLabel?: string;
  onReverse?: () => void;
  reverseLabel?: string;
  includeView?: boolean;
};

/**
 * The common ⋮ actions for sale invoices and business documents (View, Edit, Duplicate,
 * Print, Share, Convert, Record payment, Cancel, Delete), with the confirmation dialogs
 * that Cancel and Delete open. `onChanged` reloads the caller's list.
 */
export function useTransactionActions(onChanged: () => void) {
  const [isOwner, setIsOwner] = useState(false);
  const [confirm, setConfirm] = useState<{ record: TransactionRecord; action: 'cancel' | 'delete' } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getCurrentUser().then((user) => setIsOwner(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN')).catch(() => undefined);
  }, []);

  function actionsFor(record: TransactionRecord, extra: Extra): Array<RowAction | false | undefined> {
    const resource = isInvoice(record) ? 'invoices' : 'documents';
    const party = counterparty(record);
    const email = party?.email ?? '';
    const balance = isInvoice(record) ? invoiceOutstanding(record) : documentOutstanding(record);
    return [
      extra.includeView !== false && { label: 'View', icon: 'view', href: `/${resource}/${record.id}` },
      canEdit(record) && { label: 'Edit', icon: 'edit', href: editPath(record, 'editId') },
      { label: 'Duplicate', icon: 'duplicate', href: editPath(record, 'duplicateId') },
      { label: 'Print / PDF', icon: 'print', onClick: extra.onPrint },
      { label: 'Share on WhatsApp', icon: 'whatsapp', href: whatsappLink(party?.phone, shareMessage(record)), external: true },
      !!email && { label: 'Email', icon: 'email', href: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(`${labelOf(record)} ${numberOf(record)}`)}&body=${encodeURIComponent(shareMessage(record))}`, external: true },
      extra.onConvert && { label: extra.convertLabel ?? 'Convert…', icon: 'convert', onClick: extra.onConvert },
      extra.onReverse && { label: extra.reverseLabel ?? 'Undo conversion', icon: 'undo', onClick: extra.onReverse },
      extra.onRecordPayment && balance > 0 && !['DRAFT', 'CANCELLED'].includes(record.status) && { label: 'Record payment', icon: 'payment', onClick: extra.onRecordPayment },
      !isInvoice(record) && record.type === 'PURCHASE_INVOICE' && balance > 0 && ['ISSUED', 'ACCEPTED'].includes(record.status) && { label: 'Make payment', icon: 'payment', href: `/purchases/payment-out?billId=${record.id}` },
      canCancel(record) && { label: `Cancel ${isInvoice(record) ? 'invoice' : 'document'}`, icon: 'cancel', danger: true, onClick: () => setConfirm({ record, action: 'cancel' }) },
      isOwner && canDeleteRecord(record) && { label: 'Delete', icon: 'delete', danger: true, onClick: () => setConfirm({ record, action: 'delete' }) },
    ];
  }

  async function run() {
    if (!confirm) return;
    const { record, action } = confirm;
    setBusy(true);
    try {
      if (action === 'cancel') {
        if (isInvoice(record)) await api.post(`/invoices/${record.id}/cancel`);
        else await api.patch(`/documents/${record.id}/status`, { status: 'CANCELLED' });
        toast.success(`${labelOf(record)} cancelled`, { description: numberOf(record) });
      } else {
        await api.delete(`/${isInvoice(record) ? 'invoices' : 'documents'}/${record.id}`);
        toast.success(`${labelOf(record)} deleted`, { description: numberOf(record) });
      }
      setConfirm(null);
      onChanged();
    } catch (failure) {
      toast.error(getApiError(failure, action === 'cancel' ? 'Could not cancel.' : 'Could not delete.'));
    } finally {
      setBusy(false);
    }
  }

  const dialogs = confirm && (
    <ConfirmDialog
      title={confirm.action === 'cancel' ? `Cancel ${numberOf(confirm.record)}?` : `Delete ${numberOf(confirm.record)}?`}
      message={confirm.action === 'cancel'
        ? `This ${labelOf(confirm.record).toLowerCase()} will be cancelled and its stock and balances reversed. It stays in the register.`
        : isInvoice(confirm.record)
          ? 'This sale invoice will be removed. Linked payments and stock are protected by the billing rules, so the server may refuse if it is still in use.'
          : `This ${labelOf(confirm.record).toLowerCase()} will be removed from the register.`}
      confirmLabel={confirm.action === 'cancel' ? 'Cancel it' : 'Delete'}
      busyLabel={confirm.action === 'cancel' ? 'Cancelling...' : 'Deleting...'}
      busy={busy}
      onCancel={() => setConfirm(null)}
      onConfirm={() => void run()}
    />
  );

  return { actionsFor, dialogs };
}
