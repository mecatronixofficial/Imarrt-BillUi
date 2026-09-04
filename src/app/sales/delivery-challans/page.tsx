import SalesDocumentRegister from '@/components/sales/SalesDocumentRegister';

export default function DeliveryChallansPage() { return <SalesDocumentRegister type="DELIVERY_CHALLAN" title="Delivery Challans" description="Track goods sent for delivery, job work, samples, or stock transfer." actionLabel="Add challan" emptyTitle="No delivery challans found" emptyDescription="Create a delivery challan when goods leave the business." />; }
