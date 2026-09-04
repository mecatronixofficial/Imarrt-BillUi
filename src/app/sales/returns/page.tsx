import SalesDocumentRegister from '@/components/sales/SalesDocumentRegister';

export default function SalesReturnsPage() { return <SalesDocumentRegister type="CREDIT_NOTE" title="Sale Return / Credit Note" description="Manage returned goods, discounts, corrections, and customer credit notes." actionLabel="Add credit note" emptyTitle="No sale returns found" emptyDescription="Create a credit note when a sale return or billing adjustment is required." />; }
