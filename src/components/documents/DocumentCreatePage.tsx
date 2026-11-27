'use client';

import DocumentModal from './DocumentModal';
import type { BusinessDocumentType } from '@/types';

/** Full-page create screen for one document type. Closing returns to the page it was opened from (fallback: that type's list). */
export default function DocumentCreatePage({ type }: { type: BusinessDocumentType }) {
  return <DocumentModal type={type} />;
}
