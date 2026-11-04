'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PurchaseOrderForm from '@/components/purchases/PurchaseOrderForm';

export default function NewPurchaseOrderPage() {
  return <Suspense><NewPurchaseOrder /></Suspense>;
}

function NewPurchaseOrder() {
  const duplicateId = useSearchParams().get('duplicateId') ?? undefined;
  return <PurchaseOrderForm key={duplicateId ?? 'new'} duplicateId={duplicateId} />;
}
