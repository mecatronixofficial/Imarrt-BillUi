'use client';
import {useState} from 'react';
import SalesOrderRegister from './SalesOrderRegister';
import SalesDocumentRegister from './SalesDocumentRegister';
export default function SalesOrdersWorkspace(){const [tab,setTab]=useState<'production'|'items'>('items');return <><div className="mb-4 flex gap-2" role="tablist" aria-label="Sales order workflow"><button type="button" className="btn-secondary" role="tab" aria-selected={tab==='production'} onClick={()=>setTab('production')}>Production orders</button><button type="button" className="btn-secondary" role="tab" aria-selected={tab==='items'} onClick={()=>setTab('items')}>Item sales orders</button></div>{tab==='production'?<SalesOrderRegister/>:<SalesDocumentRegister type="SALES_ORDER" title="Sales orders" description="Confirmed item orders before dispatch or invoicing." actionLabel="Add sales order" emptyTitle="No sales orders yet" emptyDescription="Create an item order or convert an existing quotation."/>}</>;}
