'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import GodownsView, {type Godown} from './GodownsView';
import {api,getAllPages,getApiError,onWorkspaceChanged} from '@/lib/api';
import InventoryView, {type InventoryStock as Stock, type InventoryMovement as Movement} from './InventoryView';
export default function InventoryWorkspace({mode='summary'}:{mode?:'summary'|'godowns'|'adjustments'}){
 const [godowns,setGodowns]=useState<Godown[]>([]),[stocks,setStocks]=useState<Stock[]>([]),[movements,setMovements]=useState<Movement[]>([]);
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 const [name,setName]=useState(''),[address,setAddress]=useState(''),[editing,setEditing]=useState('');
 const [itemId,setItemId]=useState(''),[quantity,setQuantity]=useState(''),[kind,setKind]=useState('IN'),[warehouseId,setWarehouseId]=useState(''),[fromWarehouseId,setFromWarehouseId]=useState(''),[notes,setNotes]=useState(''),[query,setQuery]=useState('');
 const requestId=useRef(''),busy=useRef(false);
 const loadController=useRef<AbortController|null>(null);
 const load=useCallback(async()=>{
  loadController.current?.abort();
  const controller=new AbortController();
  loadController.current=controller;
  setLoading(true);setError('');
  // The godown register must not depend on stock summary or movement availability.
  const requests=[getAllPages<Godown>('/inventory/godowns',{signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted)setGodowns(data);})];
  if(mode!=='godowns')requests.push(
   getAllPages<Stock>('/inventory/summary',{signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted)setStocks(data);}),
   getAllPages<Movement>('/inventory/movements',{signal:controller.signal}).then(({data})=>{if(!controller.signal.aborted)setMovements(data);}),
  );
  const results=await Promise.allSettled(requests);
  if(controller.signal.aborted)return;
  const messages=results.flatMap((result)=>result.status==='rejected'?[getApiError(result.reason,mode==='godowns'?'Could not load godowns.':'Could not load inventory.')]:[]);
  setError([...new Set(messages)].join(' '));setLoading(false);
 },[mode]);
 useEffect(()=>{
  requestId.current=crypto.randomUUID();void load();
  const unsubscribe=onWorkspaceChanged(()=>{
   setGodowns([]);setStocks([]);setMovements([]);setEditing('');setName('');setAddress('');
   setWarehouseId('');setFromWarehouseId('');setItemId('');requestId.current=crypto.randomUUID();
   void load();
  });
  return()=>{unsubscribe();loadController.current?.abort();};
 },[load]);
 async function saveGodown(event:React.FormEvent){event.preventDefault();if(busy.current)return;busy.current=true;setSaving(true);setError('');try{await api.request({method:editing?'patch':'post',url:editing?`/inventory/godowns/${editing}`:'/inventory/godowns',data:{name:name.trim(),address:address.trim()||undefined}});setName('');setAddress('');setEditing('');await load();}catch(error){setError(getApiError(error,'Could not save godown.'));}finally{busy.current=false;setSaving(false);}}
 async function removeGodown(id:string){if(busy.current||!window.confirm('Delete this empty godown? Linked stock and transactions prevent deletion.'))return;busy.current=true;setSaving(true);try{await api.delete(`/inventory/godowns/${id}`);await load();}catch(error){setError(getApiError(error,'Could not delete godown.'));}finally{busy.current=false;setSaving(false);}}
 async function saveStock(event:React.FormEvent){event.preventDefault();if(busy.current)return;const amount=Number(quantity);if(!itemId||!Number.isFinite(amount)||amount<=0)return setError('Select an item and positive quantity.');if(kind==='TRANSFER'&&(!warehouseId||warehouseId===fromWarehouseId))return setError('Select a different destination godown.');busy.current=true;setSaving(true);setError('');try{await api.post('/inventory/adjustments',{requestId:requestId.current,itemId,quantity:amount,kind,warehouseId:warehouseId||undefined,fromWarehouseId:kind==='TRANSFER'?fromWarehouseId||undefined:undefined,notes:notes.trim()||undefined});requestId.current=crypto.randomUUID();setQuantity('');setNotes('');await load();}catch(error){setError(getApiError(error,'Could not post stock operation.'));}finally{busy.current=false;setSaving(false);}}
 if(mode==='godowns')return <GodownsView
  godowns={godowns} loading={loading} saving={saving} error={error}
  name={name} address={address} editing={editing} query={query}
  onNameChange={setName} onAddressChange={setAddress} onQueryChange={setQuery}
  onSave={saveGodown} onRefresh={()=>void load()} onDelete={(id)=>void removeGodown(id)}
  onEdit={(godown)=>{setEditing(godown.id);setName(godown.name);setAddress(godown.address||'');}}
  onReset={()=>{setEditing('');setName('');setAddress('');}}
 />;
 return <InventoryView
  mode={mode} stocks={stocks} movements={movements} godowns={godowns}
  loading={loading} saving={saving} error={error} query={query}
  onQueryChange={setQuery} onRefresh={()=>void load()}
  operation={{
   itemId, quantity, kind, warehouseId, fromWarehouseId, notes,
   onItemChange:setItemId, onQuantityChange:setQuantity, onKindChange:setKind,
   onWarehouseChange:setWarehouseId, onFromWarehouseChange:setFromWarehouseId,
   onNotesChange:setNotes, onSave:saveStock,
  }}
 />;
}
