'use client';

import DocumentModal from './DocumentModal';

export default function QuotationModal({ onClose }: { onClose?: () => void }) {
  return <DocumentModal type="QUOTATION" onClose={onClose} />;
}
