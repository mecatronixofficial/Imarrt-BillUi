'use client';

import DocumentModal from './DocumentModal';

export default function ProformaInvoiceModal({ onClose }: { onClose?: () => void }) {
  return <DocumentModal type="PROFORMA_INVOICE" onClose={onClose} />;
}
