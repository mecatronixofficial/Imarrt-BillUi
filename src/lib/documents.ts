import type { BusinessDocumentStatus, BusinessDocumentType } from '@/types';

export type DocumentConfig = {
  type: BusinessDocumentType;
  label: string;
  plural: string;
  shortLabel: string;
  description: string;
  accent: string;
  soft: string;
  border: string;
};

export const DOCUMENT_CONFIG: Record<BusinessDocumentType, DocumentConfig> = {
  QUOTATION: {
    type: 'QUOTATION', label: 'Quotation', plural: 'Quotations', shortLabel: 'Quote',
    description: 'Send a professional price proposal before the sale is confirmed.',
    accent: 'text-blue-700', soft: 'bg-blue-50', border: 'border-blue-200',
  },
  PROFORMA_INVOICE: {
    type: 'PROFORMA_INVOICE', label: 'Proforma invoice', plural: 'Proforma invoices', shortLabel: 'Proforma',
    description: 'Request approval or advance payment before issuing the final invoice.',
    accent: 'text-indigo-700', soft: 'bg-indigo-50', border: 'border-indigo-200',
  },
  PURCHASE_INVOICE: {
    type: 'PURCHASE_INVOICE', label: 'Purchase invoice', plural: 'Purchase invoices', shortLabel: 'Purchase',
    description: 'Record supplier bills, input tax, purchase cost, and incoming stock.',
    accent: 'text-violet-700', soft: 'bg-violet-50', border: 'border-violet-200',
  },
  DELIVERY_CHALLAN: {
    type: 'DELIVERY_CHALLAN', label: 'Delivery challan', plural: 'Delivery challans', shortLabel: 'Challan',
    description: 'Track goods dispatched for delivery, job work, samples, or transfer.',
    accent: 'text-cyan-700', soft: 'bg-cyan-50', border: 'border-cyan-200',
  },
  CREDIT_NOTE: {
    type: 'CREDIT_NOTE', label: 'Credit note', plural: 'Credit notes', shortLabel: 'Credit note',
    description: 'Reduce an invoice for returns, discounts, or billing corrections.',
    accent: 'text-emerald-700', soft: 'bg-emerald-50', border: 'border-emerald-200',
  },
  DEBIT_NOTE: {
    type: 'DEBIT_NOTE', label: 'Debit note', plural: 'Debit notes', shortLabel: 'Debit note',
    description: 'Record an additional charge or adjustment against an invoice.',
    accent: 'text-amber-700', soft: 'bg-amber-50', border: 'border-amber-200',
  },
};

export const DOCUMENT_TYPES = Object.keys(DOCUMENT_CONFIG) as BusinessDocumentType[];

export const DOCUMENT_STATUS_OPTIONS: Array<{ value: BusinessDocumentStatus; label: string }> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'ISSUED', label: 'Issued' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CONVERTED', label: 'Converted' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

export function isDocumentType(value: string | null): value is BusinessDocumentType {
  return Boolean(value && value in DOCUMENT_CONFIG);
}
