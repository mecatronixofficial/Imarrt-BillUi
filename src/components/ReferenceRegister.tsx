'use client';
import { useCallback,useEffect,useMemo,useState } from 'react';import Link from 'next/link';import { useRouter } from 'next/navigation';import { ChevronDown,Download,FileSpreadsheet,Filter,MessageCircle,Pencil,Plus,Printer,Search,Share2,Trash2 } from 'lucide-react';
import RowActions from './RowActions';
import InvoiceRegisterView from './invoices/InvoiceRegisterView';
import { Popover, MenuButton, MenuLink } from './PopoverMenu';
import { useTransactionActions } from './transactionActions';
import DocumentConversionDialog from './documents/DocumentConversionDialog';
import { conversionOptions, conversionReversal, type ConversionRecord } from '@/lib/document-conversion';
import InvoicePaymentsModal from './invoices/InvoicePaymentsModal';
import ConfirmDialog from './ConfirmDialog';import PageHeader from './PageHeader';import { EmptyState,ErrorState,LoadingState } from './ContentState';import { api,getAllPages,getApiError,getActiveBranchId,onWorkspaceChanged } from '@/lib/api';import { askDocumentPasscode } from '@/lib/partyPasscode';import { editPath,canEdit,canDeleteRecord } from './transactionActions';import { formatCurrency,formatDate } from '@/lib/format';import { sumMoney,subtractMoney } from '@/lib/billing';import { localDate } from '@/lib/business-report';import { invoiceOutstanding,documentOutstanding } from '@/lib/outstanding';import { toast } from './ToastProvider';import type { Invoice,BusinessDocument,BusinessDocumentType } from '@/types';
import { usePageState } from '@/lib/navigation';
export type RecordRow={id:string;number:string;party:string;partyId:string;date:string;due?:string;total:string;paid:string;balance:number;status:string;firm:string;branchId:string;user:string;raw:Invoice|BusinessDocument};
type Props={title:string;type:'INVOICE'|BusinessDocumentType;actionLabel:string;createPath:string;emptyDescription?:string};
export default function ReferenceRegister({title,type,actionLabel,createPath,emptyDescription}:Props){
const [paymentInvoiceId,setPaymentInvoiceId]=useState('');
const [workflow,setWorkflow]=useState<{record:ConversionRecord;action:'convert'|'reverse'}|null>(null);
const router=useRouter();const [records,setRecords]=useState<RecordRow[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[query, setQuery]=usePageState('ReferenceRegister.query', ''),[status, setStatus]=usePageState('ReferenceRegister.status', 'ALL'),[from, setFrom]=usePageState('ReferenceRegister.from', ''),[to, setTo]=usePageState('ReferenceRegister.to', ''),[firm, setFirm]=usePageState('ReferenceRegister.firm', 'ALL'),[user, setUser]=usePageState('ReferenceRegister.user', 'ALL'),[customer, setCustomer]=usePageState('ReferenceRegister.customer', 'ALL'),[busy,setBusy]=useState(''),[sort, setSort]=usePageState('ReferenceRegister.sort', {key:'date',asc:false}),[shareMenuId,setShareMenuId]=useState('');const [confirmDeleteRow,setConfirmDeleteRow]=useState<RecordRow|null>(null);const [deleteBusy,setDeleteBusy]=useState(false);const resource=type==='INVOICE'?'invoices':'documents';
const load=useCallback(async()=>{setLoading(true);setError('');try{const {data}=await getAllPages<Invoice|BusinessDocument>('/'+resource);setRecords(data.filter(r=>type==='INVOICE'||('type'in r&&r.type===type)).map(r=>{const invoice='invoiceNumber'in r;return{id:r.id,number:invoice?r.invoiceNumber:r.documentNumber,party:r.party?.name||(!invoice?r.supplier?.name:'')||'—',partyId:r.party?.id||'',date:r.issueDate,due:r.dueDate,total:r.grandTotal,paid:(invoice?r.amountPaid:r.paidAmount)||'0',balance:invoice?invoiceOutstanding(r):documentOutstanding(r),status:r.status,firm:r.business?.name||r.branch?.name||'Current Firm',branchId:r.branchId||'',user:('createdBy'in r?r.createdBy?.name:undefined)||'All Users',raw:r};}));}catch(e){setError(getApiError(e,'Could not load '+title.toLowerCase()));}finally{setLoading(false);}},[resource,type,title]);
useEffect(()=>{if(new URLSearchParams(window.location.search).get('status')==='overdue')setStatus('OVERDUE');},[setStatus]);
useEffect(()=>{void load();},[load]);
useEffect(()=>{
  if(records.length===0)return;
  const bid=getActiveBranchId();
  if(!bid||bid==='all')return;
  const match=records.find(r=>r.branchId===bid);
  if(match)setFirm(current=>current==='ALL'?match.firm:current);
},[records, setFirm]);
useEffect(()=>onWorkspaceChanged(()=>{setFirm('ALL');void load();}),[load, setFirm]);
const {actionsFor,dialogs}=useTransactionActions(()=>void load());
const baseFiltered=useMemo(()=>records.filter(r=>{const q=query.toLowerCase();return (!q||[r.number,r.party,r.status].some(v=>v.toLowerCase().includes(q)))&&(!from||r.date.slice(0,10)>=from)&&(!to||r.date.slice(0,10)<=to)&&(status==='ALL'||(status==='PAID'?r.balance===0&&!['DRAFT','CANCELLED'].includes(r.status):status==='UNPAID'?r.balance>0:status==='OVERDUE'?r.balance>0&&!!r.due&&r.due.slice(0,10)<localDate()&&!['DRAFT','CANCELLED'].includes(r.status):r.status===status))&&(firm==='ALL'||r.firm===firm)&&(user==='ALL'||r.user===user);}),[records,query,from,to,status,firm,user]);
const customerList=useMemo(()=>{const map=new Map<string,{name:string;partyId:string;count:number}>();for(const r of records){if(!r.party||r.party==='—')continue;if(!map.has(r.party))map.set(r.party,{name:r.party,partyId:r.partyId,count:0});map.get(r.party)!.count++;}return [...map.values()].sort((a,b)=>a.name.localeCompare(b.name));},[records]);
const filtered=useMemo(()=>(customer==='ALL'?baseFiltered:baseFiltered.filter(r=>r.party===customer)).sort((a,b)=>{const key=sort.key as 'date'|'party'|'number'|'total'|'balance'|'status';const x=a[key],y=b[key];return (key==='total'||key==='balance'?Number(x)-Number(y):String(x).localeCompare(String(y)))*(sort.asc?1:-1);}),[baseFiltered,customer,sort]);
const active=filtered.filter(r=>!['DRAFT','CANCELLED','REJECTED'].includes(r.status));const total=sumMoney(active.map(r=>r.total));const paid=sumMoney(active.map(r=>r.paid));const balance=sumMoney(active.map(r=>r.balance));const quotations=['QUOTATION','PROFORMA_INVOICE','SALES_ORDER','DELIVERY_CHALLAN'].includes(type);
function exportCsv(){const rows=[['Date','Reference','Party','Total','Received / Paid','Balance','Status'],...filtered.map(r=>[formatDate(r.date),r.number,r.party,r.total,r.paid,r.balance,r.status])];const csv=rows.map(row=>row.map(v=>{let s=String(v);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=title.toLowerCase().replaceAll(' ','-')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function pdf(r:RecordRow){const tab=window.open('about:blank','_blank');if(!tab){toast.error('Allow pop-ups to view this PDF.');return;}tab.opener=null;setBusy(r.id);try{const {data}=await api.get<Blob>('/'+resource+'/'+r.id+'/pdf',{responseType:'blob'});const url=URL.createObjectURL(data);tab.location.href=url;setTimeout(()=>URL.revokeObjectURL(url),120000);}catch(e){tab.close();toast.error(getApiError(e,'Could not open PDF.'));}finally{setBusy('');}}

async function handleEdit(r:RecordRow){const passcode=await askDocumentPasscode('edit');if(!passcode)return;router.push(editPath(r.raw,'editId'));}
async function handleDeleteClick(r:RecordRow){const passcode=await askDocumentPasscode('delete');if(!passcode)return;setConfirmDeleteRow(r);}
async function runDelete(){if(!confirmDeleteRow)return;setDeleteBusy(true);try{await api.delete('/'+resource+'/'+confirmDeleteRow.id);toast.success('Deleted',{description:confirmDeleteRow.number});setConfirmDeleteRow(null);void load();}catch(e){toast.error(getApiError(e,'Could not delete.'));}finally{setDeleteBusy(false);}}
function statusLabel(r:RecordRow){if(r.status==='CANCELLED')return 'Cancelled';if(r.status==='DRAFT')return 'Draft';if(r.status==='CONVERTED')return 'Converted';if(quotations)return 'Open';if(!r.balance)return 'Paid';if(r.due){const days=Math.floor((Date.now()-new Date(r.due.slice(0,10)+'T23:59:59').getTime())/86400000);if(days>=0)return 'Overdue ('+(days+1)+' days)';}return Number(r.paid)>0?'Partial':'Unpaid';}
const registerDialogs=<>{workflow&&<DocumentConversionDialog record={workflow.record} action={workflow.action} onClose={()=>setWorkflow(null)} onUpdated={()=>void load()}/>}{paymentInvoiceId&&<InvoicePaymentsModal key={paymentInvoiceId} invoiceId={paymentInvoiceId} onClose={()=>setPaymentInvoiceId('')} onSaved={()=>void load()}/>}{confirmDeleteRow&&<ConfirmDialog title={'Delete '+confirmDeleteRow.number+'?'} message="This document will be permanently removed from the register." confirmLabel="Delete" busyLabel="Deleting..." busy={deleteBusy} onCancel={()=>setConfirmDeleteRow(null)} onConfirm={()=>void runDelete()}/>}{dialogs}</>;
const columns=[[type==='INVOICE'?'Invoice no':'Reference no','number'],['Party Name','party'],['Transaction','type'],['Amount','total'],['Balance','balance'],['Status','status']];
if(resource==='invoices')return <><InvoiceRegisterView
 title={title} actionLabel={actionLabel} createPath={createPath}
 rows={filtered} recordCount={records.length} customers={customerList}
 firms={[...new Set(records.map(r=>r.firm))]} users={[...new Set(records.map(r=>r.user))]}
 filters={{query,status,from,to,firm,user,customer}}
 onFilterChange={(key,value)=>({query:setQuery,status:setStatus,from:setFrom,to:setTo,firm:setFirm,user:setUser,customer:setCustomer}[key])(value)}
 onClearFilters={()=>{setQuery('');setStatus('ALL');setFrom('');setTo('');setFirm('ALL');setUser('ALL');setCustomer('ALL');}}
 sort={sort} onSort={(key)=>setSort({key,asc:sort.key===key?!sort.asc:true})}
 total={total} paid={paid} balance={balance} loading={loading} error={error}
 onRetry={()=>void load()} onExport={exportCsv} statusLabel={statusLabel}
 renderActions={(r)=><>
  <button type="button" disabled={busy===r.id} aria-label={'Print '+r.number} onClick={()=>void pdf(r)}><Printer size={16} aria-hidden="true"/></button>
  <Popover label={'Share '+r.number} align="right" trigger={()=><Share2 size={16} aria-hidden="true"/>}>{(close)=><div role="menu" className="w-48 py-1">
   <MenuButton icon={<Download size={14}/>} onClick={()=>{close();void pdf(r);}}>Download PDF</MenuButton>
   <MenuLink icon={<MessageCircle size={14}/>} href={'https://wa.me/?text='+encodeURIComponent(r.number+' ? '+r.party)} external onClick={close}>WhatsApp</MenuLink>
  </div>}</Popover>
  <RowActions label={'Actions for '+r.number} actions={actionsFor(r.raw,{onPrint:()=>void pdf(r),onReverse:conversionReversal(r.raw)?()=>setWorkflow({record:r.raw,action:'reverse'}):undefined,reverseLabel:conversionReversal(r.raw)?.label,onRecordPayment:()=>setPaymentInvoiceId(r.id)})}/>
 </>}
/>{registerDialogs}</>;
return <><PageHeader title={title} action={<div className="flex items-center gap-4"><Link className="btn-primary inline-flex items-center gap-2" href={createPath}><Plus size={16}/>{actionLabel}</Link><Link href="/settings/transaction" aria-label="Transaction settings" className="text-slate-500">⚙</Link></div>}/><div className="reference-filters">
  <div className="reference-filter-group">
    <span className="reference-filter-label">Status</span>
    <select aria-label="Filter transaction status" value={status} onChange={e=>setStatus(e.target.value)}><option value="ALL">All {title}</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid</option><option value="OVERDUE">Overdue</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option>{quotations&&<option value="CONVERTED">Converted</option>}</select>
  </div>
  <div className="reference-filter-sep"/>
  <div className="reference-filter-group">
    <span className="reference-filter-label">Date Range</span>
    <div className="reference-filter-dates">
      <input type="date" aria-label="From date" value={from} max={to||undefined} onChange={e=>setFrom(e.target.value)}/>
      <span style={{color:'#94a3b8',fontSize:12}}>→</span>
      <input type="date" aria-label="To date" value={to} min={from||undefined} onChange={e=>setTo(e.target.value)}/>
    </div>
  </div>
  <div className="reference-filter-sep"/>
  <div className="reference-filter-group">
    <span className="reference-filter-label">Firm</span>
    <select aria-label="Filter firms" value={firm} onChange={e=>setFirm(e.target.value)}><option value="ALL">All Firms</option>{[...new Set(records.map(r=>r.firm))].map(v=><option key={v}>{v}</option>)}</select>
  </div>
  <div className="reference-filter-group">
    <span className="reference-filter-label">User</span>
    <select aria-label="Filter users" value={user} onChange={e=>setUser(e.target.value)}><option value="ALL">All Users</option>{[...new Set(records.map(r=>r.user))].map(v=><option key={v}>{v}</option>)}</select>
  </div>
  {(from||to||status!=='ALL'||firm!=='ALL'||user!=='ALL'||customer!=='ALL')&&<button type="button" className="reference-filter-clear" onClick={()=>{setFrom('');setTo('');setStatus('ALL');setFirm('ALL');setUser('ALL');setCustomer('ALL');}}>✕ Clear</button>}
</div><section className="reference-register"><div style={{display:'flex',gap:0,minHeight:400}}>
{/* Customer sidebar */}
<div style={{width:200,flexShrink:0,borderRight:'1px solid #e9eaf0',display:'flex',flexDirection:'column',background:'#f8fafc'}}>
  <div style={{padding:'10px 12px',borderBottom:'1px solid #e9eaf0',fontSize:'11px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'#94a3b8'}}>{['PURCHASE_INVOICE','DEBIT_NOTE','PURCHASE_ORDER','GOODS_RECEIPT_NOTE'].includes(type)?'Suppliers':'Customers'}</div>
  <div style={{overflowY:'auto',flex:1}}>
    <button type="button" onClick={()=>setCustomer('ALL')} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'9px 12px',fontSize:'12px',fontWeight:customer==='ALL'?700:500,background:customer==='ALL'?'#1d4ed8':'transparent',color:customer==='ALL'?'#fff':'#374151',borderBottom:'1px solid #f1f5f9',textAlign:'left',cursor:'pointer',transition:'background .12s'}}>
      <span>All</span><span style={{fontSize:'11px',opacity:.8,background:customer==='ALL'?'rgba(255,255,255,.2)':'#e2e8f0',color:customer==='ALL'?'#fff':'#64748b',borderRadius:10,padding:'1px 6px'}}>{records.length}</span>
    </button>
    {customerList.map(c=><button key={c.name} type="button" onClick={()=>setCustomer(c.name===customer?'ALL':c.name)} style={{display:'flex',justifyContent:'space-between',alignItems:'center',width:'100%',padding:'9px 12px',fontSize:'12px',fontWeight:customer===c.name?700:400,background:customer===c.name?'#1d4ed8':'transparent',color:customer===c.name?'#fff':'#374151',borderBottom:'1px solid #f1f5f9',textAlign:'left',cursor:'pointer',transition:'background .12s'}} title={c.name}>
      <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:6}}>{c.name}</span>
      <span style={{fontSize:'11px',flexShrink:0,background:customer===c.name?'rgba(255,255,255,.2)':'#e2e8f0',color:customer===c.name?'#fff':'#64748b',borderRadius:10,padding:'1px 6px'}}>{c.count}</span>
    </button>)}
  </div>
</div>
{/* Right: title bar + table */}
<div style={{flex:1,minWidth:0,display:'flex',flexDirection:'column'}}>
<div className="reference-register-title"><div><h2>Transactions{customer!=='ALL'&&<span style={{marginLeft:8,fontSize:'13px',fontWeight:500,color:'#1d4ed8'}}>· {customer}</span>}</h2><p style={{margin:'3px 0 0',fontSize:'13px',color:'#777b8e'}}>{type==='INVOICE'?'Sales total':type==='PURCHASE_INVOICE'?'Purchases total':type==='QUOTATION'?'Quotations total':'Total'}: <strong style={{color:'#484b59'}}>{formatCurrency(total)}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;{quotations?'Converted':'Received'}: <strong style={{color:'#39b491'}}>{formatCurrency(paid)}</strong>&nbsp;&nbsp;·&nbsp;&nbsp;{quotations?'Open':'Balance'}: <strong style={{color:'#d6aa32'}}>{formatCurrency(balance)}</strong></p></div><div className="reference-register-tools"><label className="relative"><Search size={17} className="absolute left-2 top-2 text-slate-400"/><input className="!pl-8" aria-label={'Search '+title} value={query} onChange={e=>setQuery(e.target.value)}/></label><button type="button" onClick={exportCsv} title="Export CSV" aria-label="Export transactions"><FileSpreadsheet size={19} color="#278c58"/></button><button type="button" onClick={()=>window.print()} aria-label="Print register"><Printer size={19}/></button></div></div>
{loading?<LoadingState label={'Loading '+title.toLowerCase()+'...'}/>:error?<ErrorState message={error} onRetry={load}/>:!filtered.length?<EmptyState icon={FileSpreadsheet} title="No matching transactions" description={query?'Try another search or clear your filters.':emptyDescription||'Create your first transaction to get started.'}/>:<div className="reference-table-scroll"><table><thead><tr>{columns.map(([label,key])=><th key={key} style={{width:key==='number'?'18%':key==='party'?'20%':key==='type'?'14%':key==='total'?'12%':key==='balance'?'12%':key==='status'?'12%':undefined,whiteSpace:key==='number'?'nowrap':undefined,overflow:key==='number'?'visible':undefined}}><button type="button" onClick={()=>setSort({key,asc:sort.key===key?!sort.asc:true})}>{label}<Filter size={12}/></button></th>)}<th style={{width:quotations?'175px':'115px'}}>Actions</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td style={{whiteSpace:'nowrap',overflow:'visible'}}><Link href={'/'+resource+'/'+r.id}>{r.number}</Link></td><td title={r.party}>{r.partyId?<Link href={'/parties/'+r.partyId}>{r.party}</Link>:r.party}</td><td>{type==='INVOICE'?'Sale':type.replaceAll('_',' ').toLowerCase().replace(/(^| )\w/g,c=>c.toUpperCase())}</td><td className="money">{formatCurrency(r.total)}</td><td className="money">{formatCurrency(r.balance)}</td><td className={r.status==='CANCELLED'?'reference-status-cancelled':!r.balance&&!quotations?'reference-status-paid':'reference-status-open'}>{statusLabel(r)}</td><td><div data-row-actions className="reference-row-actions">{conversionOptions(r.raw).length>0?<button type="button" disabled={busy===r.id} onClick={()=>setWorkflow({record:r.raw,action:'convert'})} className="flex items-center gap-1 text-blue-600 text-xs">Convert<ChevronDown size={14}/></button>:<button type="button" disabled={busy===r.id} aria-label={'Print '+r.number} onClick={()=>void pdf(r)}><Printer size={18}/></button>}<div style={{position:'relative'}} onBlur={(e)=>{if(!e.currentTarget.contains(e.relatedTarget as Node))setShareMenuId('');}}><button type="button" aria-label={'Share '+r.number} aria-expanded={shareMenuId===r.id} onClick={()=>setShareMenuId(shareMenuId===r.id?'':r.id)}><Share2 size={18}/></button>{shareMenuId===r.id&&<div className="reference-row-menu" style={{minWidth:160,right:0,top:'110%'}}><button type="button" role="menuitem" onClick={()=>{void pdf(r);setShareMenuId('');}}><Download size={14}/>&nbsp;Download PDF</button><a role="menuitem" href={'https://wa.me/?text='+encodeURIComponent(r.number+' – '+r.party)} target="_blank" rel="noopener noreferrer" onClick={()=>setShareMenuId('')}><MessageCircle size={14}/>&nbsp;WhatsApp</a></div>}</div>{type!=='INVOICE'&&canEdit(r.raw)&&<button type="button" disabled={busy===r.id} aria-label={'Edit '+r.number} style={{color:'#1d4ed8'}} onClick={()=>void handleEdit(r)}><Pencil size={17}/></button>}{type!=='INVOICE'&&canDeleteRecord(r.raw)&&<button type="button" disabled={busy===r.id} aria-label={'Delete '+r.number} style={{color:'#dc2626'}} onClick={()=>void handleDeleteClick(r)}><Trash2 size={17}/></button>}<RowActions label={'Actions for '+r.number} actions={actionsFor(r.raw,{onPrint:()=>void pdf(r),onConvert:conversionOptions(r.raw).length>0?()=>setWorkflow({record:r.raw,action:'convert'}):undefined,onReverse:conversionReversal(r.raw)?()=>setWorkflow({record:r.raw,action:'reverse'}):undefined,reverseLabel:conversionReversal(r.raw)?.label,onRecordPayment:type==='INVOICE'?()=>setPaymentInvoiceId(r.id):undefined})}/></div></td></tr>)}</tbody></table></div>}
</div></div></section>{registerDialogs}</>}
