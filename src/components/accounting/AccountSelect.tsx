'use client';
import { useEffect, useState } from 'react';
import { getAllPages, getApiError } from '@/lib/api';
export default function AccountSelect({value,onChange,branchId}:{value:string;onChange:(id:string)=>void;branchId?:string}) {
 const [accounts,setAccounts]=useState<Array<{id:string;bankName:string;accountNumber:string}>>([]);
 const [error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void getAllPages<{id:string;bankName:string;accountNumber:string}>('/accounts',{signal:controller.signal,headers:branchId?{'X-Branch-Id':branchId}:undefined}).then(({data})=>setAccounts(data)).catch((error)=>{if(!controller.signal.aborted)setError(getApiError(error,'Could not load accounts'));});return()=>controller.abort();},[branchId]);
 return <label className="block"><span className="label">Bank account (optional)</span><select className="input-field" value={value} onChange={(event)=>onChange(event.target.value)}><option value="">Cash / unallocated</option>{accounts.map((account)=><option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber.slice(-4)}</option>)}</select>{error && <span role="status" className="text-xs text-red-600">{error}</span>}</label>;
}
