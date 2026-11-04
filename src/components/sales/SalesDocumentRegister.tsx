import ReferenceRegister from '@/components/ReferenceRegister';import type { BusinessDocumentType } from '@/types';
type Props={type:Extract<BusinessDocumentType,'QUOTATION'|'SALES_ORDER'|'PROFORMA_INVOICE'|'DELIVERY_CHALLAN'|'CREDIT_NOTE'>;title:string;description:string;actionLabel:string;emptyTitle:string;emptyDescription:string};
export default function SalesDocumentRegister(p:Props){return <ReferenceRegister title={p.title} type={p.type} actionLabel={p.actionLabel} createPath={'/documents/new?type='+p.type} emptyDescription={p.emptyDescription}/>}
