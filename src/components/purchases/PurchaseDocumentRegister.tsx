import ReferenceRegister from '@/components/ReferenceRegister';import { DOCUMENT_CONFIG } from '@/lib/documents';import type { BusinessDocumentType } from '@/types';
type Props={type:Extract<BusinessDocumentType,'PURCHASE_INVOICE'|'DEBIT_NOTE'>;title:string;description:string;actionLabel:string;emptyTitle:string;emptyDescription:string};
export default function PurchaseDocumentRegister(p:Props){return <ReferenceRegister title={p.title} type={p.type} actionLabel={p.actionLabel} createPath={DOCUMENT_CONFIG[p.type].createPath} emptyDescription={p.emptyDescription}/>}
