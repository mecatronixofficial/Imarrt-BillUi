import SalesDocumentRegister from '@/components/sales/SalesDocumentRegister';

export default function ProformaPage() { return <SalesDocumentRegister type="PROFORMA_INVOICE" title="Proforma Invoices" description="Send preliminary invoices for approval or advance payment before final billing." actionLabel="Add proforma" emptyTitle="No proforma invoices found" emptyDescription="Create a proforma invoice to begin this register." />; }
