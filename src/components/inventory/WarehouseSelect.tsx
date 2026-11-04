'use client';
import {useEffect,useState} from 'react';
import {getAllPages,getApiError} from '@/lib/api';
export default function WarehouseSelect({value,onChange,businessId,className='input-field'}:{value:string;onChange:(id:string)=>void;businessId?:string;className?:string}){
 const [warehouses,setWarehouses]=useState<Array<{id:string;name:string}>>([]),[error,setError]=useState('');
 useEffect(()=>{const controller=new AbortController();void getAllPages<{id:string;name:string}>('/inventory/godowns',{signal:controller.signal,headers:businessId?{'X-Business-Id':businessId}:undefined}).then(({data})=>setWarehouses(data)).catch((error)=>{if(!controller.signal.aborted)setError(getApiError(error,'Could not load godowns'));});return()=>controller.abort();},[businessId]);
 return <><select aria-label="Godown" className={className} value={value} onChange={(event)=>onChange(event.target.value)}><option value="">Unallocated stock</option>{warehouses.map((warehouse)=><option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}</select>{error&&<span role="status" className="text-xs text-red-600">{error}</span>}</>;
}
