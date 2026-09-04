import PurchaseDocumentRegister from '@/components/purchases/PurchaseDocumentRegister';

export default function PurchaseBillsPage() {
  return <PurchaseDocumentRegister type="PURCHASE_INVOICE" title="Purchase Bills" description="Record supplier bills, GST input, incoming stock, and purchase value." actionLabel="Add purchase bill" emptyTitle="No purchase bills yet" emptyDescription="Create a supplier purchase bill to start this register." />;
}
