'use client';

import { useParams } from 'next/navigation';
import PurchaseOrderForm from '@/components/purchases/PurchaseOrderForm';

export default function EditPurchaseOrderPage() {
  const { id } = useParams<{ id: string }>();
  return <PurchaseOrderForm key={id} orderId={id} />;
}
