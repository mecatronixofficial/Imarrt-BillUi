import PurchaseDocumentRegister from '@/components/purchases/PurchaseDocumentRegister';

export default function PurchaseReturnsPage() {
  return <PurchaseDocumentRegister type="DEBIT_NOTE" title="Purchase Return / Dr. Note" description="Track debit notes and return adjustments with their invoice references." actionLabel="Add debit note" emptyTitle="No purchase returns found" emptyDescription="Create a debit note when goods are returned or a purchase adjustment is required." />;
}
