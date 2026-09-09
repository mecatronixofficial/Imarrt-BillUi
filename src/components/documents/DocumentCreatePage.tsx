'use client';

import { useRouter } from 'next/navigation';
import DocumentModal from './DocumentModal';
import { DOCUMENT_CONFIG } from '@/lib/documents';
import type { BusinessDocumentType } from '@/types';

export default function DocumentCreatePage({ type }: { type: BusinessDocumentType }) {
  const router = useRouter();
  return <DocumentModal type={type} onClose={() => router.push(DOCUMENT_CONFIG[type].registerPath)} />;
}
