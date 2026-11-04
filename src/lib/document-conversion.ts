import type { BusinessDocument, BusinessDocumentType, Invoice } from '@/types';

export type ConversionRecord = BusinessDocument | Invoice;
export type ConversionTarget = 'invoice' | 'proforma' | 'estimate' | 'order' | 'challan';
export type ConversionOption = { value: ConversionTarget; label: string };

export function conversionOptions(record: ConversionRecord): ConversionOption[] {
  if ('invoiceNumber' in record || ['CONVERTED', 'CANCELLED', 'REJECTED'].includes(record.status)) return [];
  switch (record.type) {
    case 'QUOTATION': return [{ value: 'invoice', label: 'Sale invoice' }, { value: 'proforma', label: 'Proforma invoice' }, { value: 'order', label: 'Sales order' }];
    case 'PROFORMA_INVOICE': return [{ value: 'invoice', label: 'Sale invoice' }, { value: 'estimate', label: 'Estimate / quotation' }];
    case 'SALES_ORDER': return [{ value: 'invoice', label: 'Sale invoice' }, { value: 'challan', label: 'Delivery challan' }];
    case 'DELIVERY_CHALLAN': return [{ value: 'invoice', label: 'Sale invoice' }];
    default: return [];
  }
}

function restorable(type: BusinessDocumentType) { return type === 'QUOTATION' || type === 'PROFORMA_INVOICE'; }

export function conversionReversal(record: ConversionRecord) {
  if (record.status === 'CANCELLED') return null;
  if (!('invoiceNumber' in record) && record.status === 'CONVERTED' && restorable(record.type)) {
    return { sourceId: record.id, targetId: record.convertedInvoiceId, label: record.type === 'QUOTATION' ? 'Back to estimate' : 'Back to proforma invoice' };
  }
  const source = 'invoiceNumber' in record ? record.conversionSource : record.sourceDocument;
  if (!source || !restorable(source.type)) return null;
  return { sourceId: source.id, targetId: record.id, label: source.type === 'QUOTATION' ? 'Back to estimate' : 'Back to proforma invoice' };
}
