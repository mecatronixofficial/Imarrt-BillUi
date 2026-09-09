'use client';

import { Suspense, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import DocumentModal from '@/components/documents/DocumentModal';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import { DOCUMENT_CONFIG, isDocumentType } from '@/lib/documents';

export default function NewDocumentPage() {
  return (
    <Suspense fallback={<DocumentModalFallback />}>
      <NewDocumentModal />
    </Suspense>
  );
}

function NewDocumentModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { embedded, initialType } = useEmbeddedForm();
  const requestedType = searchParams.get('type');
  const type = initialType ?? (isDocumentType(requestedType) ? requestedType : 'QUOTATION');

  useEffect(() => {
    if (!embedded && isDocumentType(requestedType)) {
      router.replace(DOCUMENT_CONFIG[requestedType].createPath);
    }
  }, [embedded, requestedType, router]);

  if (!embedded && isDocumentType(requestedType)) return <DocumentModalFallback />;

  return <DocumentModal type={type} allowTypeSwitch={!initialType && !isDocumentType(requestedType)} />;
}

function DocumentModalFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white" role="status" aria-label="Loading document form">
      <Loader2 className="animate-spin text-blue-600" aria-hidden="true" />
    </div>
  );
}
