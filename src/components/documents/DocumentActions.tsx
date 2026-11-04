'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, getApiError } from '@/lib/api';
export default function DocumentActions({id,resource,companyId,onUpdated,onRecordPayment,onReverseConversion,reverseConversionLabel,canCancel=false,canEdit=false,branchId,editHref,duplicateHref}:{id:string;resource:'invoices'|'documents';editHref?:string;duplicateHref?:string;companyId?:string;onUpdated?:()=>void;onRecordPayment?:()=>void;onReverseConversion?:()=>void;reverseConversionLabel?:string;canCancel?:boolean;canEdit?:boolean;branchId?:string}) {
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function preview(mode:'regular'|'thermal') {
  if(busy)return;
  const tab=window.open('about:blank','_blank');
  if(!tab){setError('Allow pop-ups to open the print preview.');return;}
  tab.opener=null;setBusy(true);setError('');
  try{const {data}=await api.get<Blob>(`/${resource}/${id}/pdf`,{params:{mode},responseType:'blob'});const url=URL.createObjectURL(data);tab.location.href=url;window.setTimeout(()=>URL.revokeObjectURL(url),120000);}
  catch(error){tab.close();setError(getApiError(error,'Could not open the print preview.'));}
  finally{setBusy(false);}
 }
 async function cancel(){if(busy||!window.confirm('Cancel this invoice and restore its item stock?'))return;setBusy(true);setError('');try{await api.post(`/invoices/${id}/cancel`);onUpdated?.();}catch(error){setError(getApiError(error,'Could not cancel invoice.'));}finally{setBusy(false);}}
 return <section className="card mt-4 p-4"><h2 className="mb-3 text-xs font-bold text-slate-700">Document actions</h2><div className="flex flex-wrap gap-2">{onReverseConversion&&<button type="button" className="btn-secondary" disabled={busy} onClick={onReverseConversion}>{reverseConversionLabel || 'Undo conversion'}</button>}{resource==='invoices'&&onRecordPayment&&<button type="button" className="btn-secondary" disabled={busy} onClick={onRecordPayment}>Record payment</button>}<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void preview('regular')}>Regular print preview</button><button type="button" className="btn-secondary" disabled={busy} onClick={()=>void preview('thermal')}>Thermal print preview</button>{resource==='invoices'&&canEdit&&<Link className="btn-secondary" href={`/invoices/new?editId=${encodeURIComponent(id)}${companyId?'&companyId='+encodeURIComponent(companyId):''}${branchId?'&branchId='+encodeURIComponent(branchId):''}`}>Edit invoice</Link>}{resource==='invoices'&&<Link className="btn-secondary" href={`/invoices/new?duplicateId=${encodeURIComponent(id)}${companyId?'&companyId='+encodeURIComponent(companyId):''}${branchId?'&branchId='+encodeURIComponent(branchId):''}`}>Duplicate invoice</Link>}{resource==='documents'&&editHref&&<Link className="btn-secondary" href={editHref}>Edit</Link>}{resource==='documents'&&duplicateHref&&<Link className="btn-secondary" href={duplicateHref}>Duplicate</Link>}{canCancel&&<button type="button" className="btn-secondary" disabled={busy} onClick={()=>void cancel()}>Cancel invoice</button>}</div>{error&&<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}</section>;
}
