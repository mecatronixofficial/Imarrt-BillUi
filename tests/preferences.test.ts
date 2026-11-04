import { test } from 'node:test';
import assert from 'node:assert/strict';
test('pending preference saves retain their original company after a workspace switch',async()=>{
 const values=new Map<string,string>();
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value),removeItem:(key:string)=>values.delete(key)};
 const fakeWindow=Object.assign(new EventTarget(),{location:{pathname:'/settings/transaction',search:''}});
 Object.defineProperty(globalThis,'window',{value:fakeWindow,configurable:true});
 Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true});
 const {api}=await import('../src/lib/api');
 const urls:string[]=[];
 const oldPatch=api.patch,oldGet=api.get;
 api.patch=(async(url:string,data:unknown)=>{urls.push(url);return {data};}) as typeof api.patch;
 api.get=(async()=>({data:{}})) as typeof api.get;
 try {
  values.set('activeBusinessId','company-a');
  const preferences=await import('../src/lib/preferences');
  preferences.updatePreferences('transaction',{autoRoundOff:true});
  values.set('activeBusinessId','company-b');fakeWindow.dispatchEvent(new Event('imart:workspace-changed'));
  await new Promise((resolve)=>setTimeout(resolve,180));
  assert.deepEqual(urls,['/businesses/company-a/preferences']);
  assert.equal(preferences.getPreferences('transaction').autoRoundOff,false);
  assert.equal(JSON.parse(values.get('imart:preferences:company-a')!).transaction.autoRoundOff,true);
  values.set('activeBusinessId','company-a');fakeWindow.dispatchEvent(new Event('imart:workspace-changed'));
  await new Promise((resolve)=>setTimeout(resolve,0));
  let releaseFirst!:(value:unknown)=>void,releaseSecond!:(value:unknown)=>void;
  let requests=0;
  api.patch=(async()=>{requests++;return await new Promise<unknown>((resolve)=>{if(requests===1)releaseFirst=resolve;else releaseSecond=resolve;});}) as typeof api.patch;
  preferences.updatePreferences('transaction',{autoRoundOff:true});await new Promise((resolve)=>setTimeout(resolve,140));
  preferences.updatePreferences('transaction',{negativeStock:false});
  releaseFirst({data:{transaction:{autoRoundOff:true,negativeStock:true}}});await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(preferences.getPreferences('transaction').negativeStock,false);
  releaseSecond({data:{transaction:{autoRoundOff:true,negativeStock:false}}});await new Promise((resolve)=>setTimeout(resolve,20));
  assert.equal(preferences.getSaveStatus().state,'saved');

 } finally {api.patch=oldPatch;api.get=oldGet;delete (globalThis as {window?:unknown}).window;delete (globalThis as {localStorage?:unknown}).localStorage;}
});
