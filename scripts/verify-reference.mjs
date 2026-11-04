import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
const [origin, puppeteerModule, outputDirectory] = process.argv.slice(2);
if (!origin || !puppeteerModule || !outputDirectory) throw new Error('Usage: verify-browser.mjs ORIGIN PUPPETEER_MODULE OUTPUT_DIRECTORY');
const { default: puppeteer } = await import(pathToFileURL(puppeteerModule).href);
const env = await readFile('.env', 'utf8');
const rawApi = env.match(/^NEXT_PUBLIC_API_URL\s*=\s*["']?([^\r\n"']+)/m)?.[1]?.trim() || 'http://localhost:4000/api/v1';
const apiBase = new URL(rawApi, origin);
const prefix = apiBase.pathname.replace(/\/$/, '');
const ids = { user:'10000000-0000-4000-8000-000000000001', business:'10000000-0000-4000-8000-000000000002', branch:'10000000-0000-4000-8000-000000000003', group:'10000000-0000-4000-8000-000000000004', party:'10000000-0000-4000-8000-000000000005', item:'10000000-0000-4000-8000-000000000006', invoice:'10000000-0000-4000-8000-000000000007', supplier:'10000000-0000-4000-8000-000000000008', warehouse:'10000000-0000-4000-8000-000000000009', account:'10000000-0000-4000-8000-000000000010', bill:'10000000-0000-4000-8000-000000000011', quote:'10000000-0000-4000-8000-000000000012' };
const date = new Date().toISOString();
const user = {id:ids.user,name:'QA Owner',email:'qa@example.invalid',role:'OWNER',sessionId:'test-session',mfaEnabled:true,mfaVerified:true,isActive:true,createdAt:date};
const business = {id:ids.business,name:'Synthetic QA Company',legalName:'Synthetic QA Company',gstRegistered:true,gstin:'29AAAAA0000A1Z5',stateCode:'29',address:'Test address',phone:'9999999999',email:'business@example.invalid',isActive:true,createdAt:date,workspaceBranchId:ids.group,preferences:{},_count:{members:1,invoices:1,branches:1}};
const branch = {id:ids.branch,businessId:ids.business,name:'Main branch',code:'MAIN',isActive:true,createdAt:date,_count:{invoices:1,productionOrders:0,documents:2}};
const party = {id:ids.party,name:'Synthetic Test Customer',code:'P-0001',phone:'9999999998',email:'customer@example.invalid',gstType:'UNREGISTERED',gstin:null,openingBalance:0,creditLimit:10000,openingBalanceType:'RECEIVABLE',totalBilled:216,totalReceived:40,balanceDue:176,creditAvailable:9824,invoiceDeliveryMode:'MANUAL',createdAt:date};
const item = {id:ids.item,name:'Test item',sku:'TEST-ITEM',hsnSac:'5208',unit:'pcs',salePrice:'100',purchasePrice:'118',salePriceTaxMode:'WITHOUT_TAX',purchasePriceTaxMode:'WITH_TAX',taxRate:'18',stockQty:'10',category:'Test category'};
const supplier = {id:ids.supplier,name:'Synthetic Test Supplier',phone:'9999999997',email:'supplier@example.invalid'};
const line = {id:'line-1',itemId:ids.item,description:item.name,quantity:'2',unit:'pcs',unitPrice:'100',taxRate:'18',lineTotal:'236',hsnSac:'5208',taxInclusive:false};
const invoice = {id:ids.invoice,businessId:ids.business,branchId:ids.branch,invoiceNumber:'MAIN-TEST-0001',partyId:ids.party,party,status:'PARTIALLY_PAID',issueDate:date,dueDate:date,createdAt:date,subTotal:'200',taxTotal:'36',discount:'0',grandTotal:'236',amountPaid:'40',creditTotal:20,balanceDue:176,items:[line],business,branch,payments:[{id:'receipt-1',invoiceId:ids.invoice,amount:'40',method:'cash',accountId:ids.account,paidAt:date,createdAt:date}],attachments:[],deliveries:[]};
const bill = {id:ids.bill,businessId:ids.business,branchId:ids.branch,type:'PURCHASE_INVOICE',documentNumber:'TEST-PUR-0001',status:'ISSUED',supplierId:ids.supplier,supplier,issueDate:date,dueDate:date,createdAt:date,updatedAt:date,subTotal:'100',taxTotal:'18',discount:'0',grandTotal:'118',paidAmount:'20',balanceDue:98,stockAdjusted:true,returnStock:false,items:[{...line,id:'line-bill',quantity:'1',unitPrice:'118',taxInclusive:true,lineTotal:'118'}],business,branch,payments:[],attachments:[]};
const quote = {...bill,id:ids.quote,type:'QUOTATION',documentNumber:'TEST-QUO-0001',supplierId:undefined,supplier:undefined,partyId:ids.party,party,subTotal:'200',taxTotal:'36',grandTotal:'236',paidAmount:'0',balanceDue:236,stockAdjusted:false,items:[line]};
const account = {id:ids.account,accountHolder:business.name,bankName:'Synthetic Test Bank',accountNumber:'12345678901',ifsc:'TEST0000001',branch:'Test',accountType:'CURRENT',upiId:'',openingBalance:1000,balance:961,primary:true,updatedAt:date};
const expenses = [{id:'expense-1',businessId:ids.business,branchId:ids.branch,description:'Synthetic test expense',category:'General',expenseDate:date,amount:'50',taxAmount:'9',total:'59',method:'bank_transfer',accountId:ids.account,status:'ISSUED'}];
const docs = [bill,quote];
const missing = new Set(), mutations = [], errors = [], requests = [];
function responseFor(endpoint, url) {
  if(endpoint==='/auth/me')return user;
  if(endpoint==='/auth/sessions')return [];
  if(endpoint==='/businesses')return [business];
  if(endpoint===`/businesses/${ids.business}/preferences`)return {};
  if(endpoint===`/businesses/${ids.business}`)return business;
  if(endpoint.endsWith('/members'))return [user];
  if(endpoint==='/branches')return [branch];
  if(endpoint==='/workspace-branches')return [{id:ids.group,name:'Test workspace',code:'TEST',isActive:true,createdAt:date,businesses:[business]}];
  if(endpoint==='/parties')return [party];
  if(endpoint==='/parties/next-code')return {code:'P-0002'};
  if(endpoint===`/parties/${ids.party}`)return party;
  if(endpoint===`/parties/${ids.party}/ledger`)return {party,summary:{openingBalance:0,totalBilled:216,totalReceived:40,balanceDue:176,creditLimit:10000,creditAvailable:9824},transactions:[{id:ids.invoice,type:'SALE_INVOICE',number:invoice.invoiceNumber,date,amount:236,balance:236,status:'PARTIALLY_PAID',invoiceId:ids.invoice},{id:'receipt-1',type:'PAYMENT_IN',number:'Test receipt',date,amount:-40,balance:196,invoiceId:ids.invoice},{id:'credit-test',type:'CREDIT_NOTE',number:'Test credit note',date,amount:-20,balance:176}]};
  if(endpoint==='/items')return [item];
  if(endpoint===`/items/${ids.item}`)return item;
  if(endpoint===`/items/${ids.item}/transactions`)return [{id:'sale-test',type:'SALE',number:invoice.invoiceNumber,date,quantity:-2,rate:100,total:236,status:invoice.status,href:`/invoices/${ids.invoice}`}];
  if(endpoint==='/invoices/next-number')return {invoiceNumber:'MAIN-TEST-0002',manual:false};
  if(endpoint==='/invoices')return [invoice];
  if(endpoint===`/invoices/${ids.invoice}`)return invoice;
  if(endpoint==='/invoices/payments/register')return invoice.payments.map((payment)=>({...payment,invoice:{id:invoice.id,invoiceNumber:invoice.invoiceNumber,grandTotal:invoice.grandTotal,amountPaid:invoice.amountPaid,party}}));
  if(endpoint==='/documents')return docs.filter((entry)=>!url.searchParams.get('type')||entry.type===url.searchParams.get('type'));
  if(endpoint.startsWith('/documents/') && docs.some((entry)=>endpoint===`/documents/${entry.id}`))return docs.find((entry)=>endpoint===`/documents/${entry.id}`);
  if(endpoint==='/documents/payments/register')return [{id:'payment-out-test',documentId:bill.id,amount:'20',method:'bank_transfer',paidAt:date,createdAt:date,document:{id:bill.id,documentNumber:bill.documentNumber,grandTotal:bill.grandTotal,paidAmount:bill.paidAmount,supplier}}];
  if(endpoint==='/production-orders/capabilities')return {masterVersion:2,imageDetails:true};
  if(endpoint==='/production-orders'||endpoint==='/purchase-orders')return [];
  if(endpoint==='/suppliers')return [supplier];
  if(endpoint==='/users')return [user];
  if(endpoint==='/accounts')return [account];
  if(endpoint==='/loans')return [{id:'test-loan',name:'QA Working Capital',principal:'1000',openingDate:date,balance:800,payments:[{id:'loan-payment',principal:'200',interest:'20',total:'220',paidAt:date}]}];
  if(endpoint==='/cheques')return [{id:'test-cheque',name:party.name,reference:'123456',date,amount:'100',accountId:account.id,bankName:account.bankName,history:[]}];
  if(endpoint==='/incomes/categories')return [{id:'income-category',name:'QA Other Income',total:100}];
  if(endpoint==='/incomes')return [{id:'income-entry',name:'QA Other Income',kind:'OTHER_INCOME',amount:'100',entryDate:date,referenceId:'income-category'}];
  if(endpoint==='/cash/transactions'||endpoint==='/accounts/'+ids.account+'/transactions')return {balance:961,rows:[{id:'account-receipt',name:party.name,type:'Payment-In',amount:40,date}]};
  if(endpoint==='/expenses')return expenses;
  if(endpoint==='/inventory/godowns')return [{id:ids.warehouse,name:'Test godown',isActive:true}];
  if(endpoint==='/inventory/summary')return [{id:item.id,name:item.name,unit:item.unit,quantity:item.stockQty,purchasePrice:item.purchasePrice,unallocated:'4',stocks:[{warehouseId:ids.warehouse,name:'Test godown',quantity:'6'}]}];
  if(endpoint==='/inventory/movements')return [{id:'movement-test',kind:'SALE',quantity:'-2',createdAt:date,item:{name:item.name,unit:item.unit},warehouse:{name:'Test godown'}}];
  missing.add(endpoint);return null;
}
await mkdir(outputDirectory,{recursive:true});
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--disable-gpu'],protocolTimeout:60000});
const checks=[];
try {
 async function makePage(viewport){
 const page=await browser.newPage();await page.setViewport(viewport);await page.emulateTimezone('Asia/Kolkata');
 await page.evaluateOnNewDocument((ids)=>{localStorage.setItem('activeBusinessId',ids.business);localStorage.setItem('activeWorkspaceBranchId',ids.group);localStorage.setItem(`activeBranchId:${ids.business}`,ids.branch);},ids);
 await page.setRequestInterception(true);
 page.on('request',async(request)=>{
  try{const url=new URL(request.url());if(url.origin===apiBase.origin && url.pathname.startsWith(prefix)){
   const headers={'access-control-allow-origin':new URL(origin).origin,'access-control-allow-credentials':'true','access-control-allow-methods':'GET,OPTIONS','access-control-allow-headers':'content-type,x-business-id,x-branch-id'};
   if(request.method()==='OPTIONS')return await request.respond({status:204,headers});
   const endpoint=url.pathname.slice(prefix.length)||'/';requests.push(endpoint);
   if(request.method()!=='GET'){mutations.push({method:request.method(),endpoint});return await request.respond({status:405,headers,contentType:'application/json',body:JSON.stringify({message:'Mutations are disabled in browser rendering checks'})});}
   const value=responseFor(endpoint,url);return await request.respond({status:value===null?404:200,headers,contentType:'application/json',body:JSON.stringify(value??{message:'Missing test fixture'})});
  }
  if(url.origin===new URL(origin).origin || ['data:','blob:','about:'].includes(url.protocol))return await request.continue();
  return await request.abort();
  }catch(error){errors.push({kind:'interception',message:String(error)});}
 });
 page.on('pageerror',(error)=>errors.push({kind:'pageerror',message:error.message}));
 page.on('console',(message)=>{if(message.type()==='error')errors.push({kind:'console',message:message.text(),location:message.location()});});
 page.on('response',(response)=>{if(response.status()>=400)errors.push({kind:'http',status:response.status(),url:response.url()});});
 return page;
 }
 if(!process.env.REFERENCE_EDITORS_ONLY) {
 const routes=['/dashboard','/parties',`/parties/${ids.party}`,'/items',`/items/${ids.item}`,'/invoices',`/invoices/${ids.invoice}`,'/invoices/new','/documents',`/documents/${ids.quote}`,'/sales','/sales/quotations','/sales/proforma','/sales/orders','/sales/orders/new','/sales/delivery-challans','/sales/returns','/sales/payment-in','/purchases','/purchases/bills','/purchases/bills/new','/purchases/orders','/purchases/returns','/purchases/returns/new','/purchases/payment-out','/purchases/expenses','/inventory','/inventory/godowns','/inventory/adjustments','/cash-banks','/cash-banks/cash','/cash-banks/loans','/cash-banks/cheques','/sales/other-income','/reports','/profile','/settings','/settings/general','/settings/party','/settings/item','/settings/transaction','/settings/taxes-gst','/settings/transaction-message','/settings/print','/team','/security','/businesses'];
 for(const route of routes){const page=await makePage({width:1440,height:1000});const response=await page.goto(origin+route,{waitUntil:'networkidle0',timeout:30000});assert.ok(response && response.status()<400,`Broken page: ${route}`);const text=await page.evaluate(()=>document.body.innerText);assert.ok(!text.includes('Application error:'),route);checks.push({route,viewport:'desktop',passed:true});if(['/dashboard','/parties','/items','/invoices/new','/invoices','/settings/transaction','/settings/print','/cash-banks','/cash-banks/loans','/profile','/reports'].includes(route))await page.screenshot({path:path.join(outputDirectory,'desktop-'+route.slice(1).replaceAll('/','-').replaceAll('?','-').replaceAll('=','-')+'.png'),fullPage:true});await page.close();if(checks.length%5===0)console.log(`Rendered ${checks.length} desktop routes`);}
 for(const viewport of [{name:'desktop1920',width:1920,height:1080},{name:'desktop1280',width:1280,height:900},{name:'tablet1024',width:1024,height:900},{name:'tablet768',width:768,height:1024},{name:'mobile430',width:430,height:932},{name:'mobile390',width:390,height:844},{name:'mobile360',width:360,height:800}]){
  for(const route of ['/dashboard','/invoices/new','/parties','/items','/reports','/cash-banks/loans','/settings/general']){
   const page=await makePage(viewport);await page.goto(origin+route,{waitUntil:'networkidle0',timeout:30000});const dimensions=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));assert.ok(dimensions.content<=dimensions.width+2,`${viewport.name} global overflow at ${route}: ${dimensions.content}/${dimensions.width}`);checks.push({route,viewport:viewport.name,passed:true});
   if(['/dashboard','/invoices/new'].includes(route))await page.screenshot({path:path.join(outputDirectory,`${viewport.name}-${route.slice(1).replaceAll('/','-')}.png`),fullPage:true});
   await page.close();
  }
  console.log(`Rendered ${viewport.name} layouts`);
 }
 for(const [route,label] of [['/parties','Add Party'],['/items','Add Item'],['/sales/payment-in','Add Payment-In'],['/cash-banks/loans','Add Loan Account'],['/sales/other-income','Add Other Income']]){
 const page=await makePage({width:1440,height:1000});await page.goto(origin+route,{waitUntil:'networkidle0',timeout:30000});const buttons=await page.$$('button');let clicked=false;for(const button of buttons){const labelText=await button.evaluate(el=>el.textContent?.trim());if(labelText===label){await button.click();clicked=true;break;}}assert.ok(clicked,'Create control exists: '+route);await page.waitForSelector('[role=dialog]');const text=await page.$eval('[role=dialog]',el=>el.innerText);assert.ok(text.includes('Save'),route+' save control');await page.screenshot({path:path.join(outputDirectory,'dialog-'+route.slice(1).replaceAll('/','-')+'.png'),fullPage:true});await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('[role=dialog]'));checks.push({route,interaction:'open and close create dialog',passed:true});await page.close();}

 }
 for (const width of [1920,1440,1280,1024,768,430,390,360]) {
  for (const route of ['/invoices/new','/purchases/bills/new','/purchases/returns/new','/sales/quotations/new','/sales/proforma/new','/sales/orders/new','/sales/delivery-challans/new','/sales/returns/new']) {
   console.log('Checking '+route+' '+width);const page=await makePage({width,height:900});
   await page.goto(origin+route,{waitUntil:'networkidle0',timeout:30000});
   const clipped=await page.evaluate(()=>[...document.querySelectorAll('main input,main select,main textarea')].filter(element=>!element.closest('table')&&element.type!=='hidden'&&element.type!=='file').map(element=>({label:element.getAttribute('aria-label')||element.placeholder||element.tagName,left:element.getBoundingClientRect().left,right:element.getBoundingClientRect().right,width:element.getBoundingClientRect().width})).filter(element=>element.width>0&&(element.left < -1 || element.right>innerWidth+1)));
   assert.deepEqual(clipped,[],route+' clipped form controls at '+width+': '+JSON.stringify(clipped));

   const overlaps=await page.evaluate(()=>[...document.querySelectorAll('main [class*="notesGrid"] input,main [class*="notesGrid"] select,main [class*="notesGrid"] textarea,main [class*="notesGrid"] button')].filter(element=>element.type!=='file').filter(element=>{const rect=element.getBoundingClientRect();const section=element.closest('section')?.getBoundingClientRect();return rect.width>0&&section&&(rect.left<section.left-1||rect.right>section.right+1);}).map(element=>element.placeholder||element.textContent||element.tagName));
   assert.deepEqual(overlaps,[],route+' notes overlap totals at '+width);
   const table=await page.$('[role=region][aria-label*="items"]');
   assert.ok(table,route+' accessible item table');
   const scroll=await table.evaluate(element=>{const wide=element.scrollWidth>element.clientWidth+2;element.scrollLeft=element.scrollWidth;return {wide,moved:element.scrollLeft>0};});
   if(scroll.wide)assert.ok(scroll.moved,route+' horizontal item scrolling at '+width);
   let rowAdded=false;const buttons=await page.$$('button');
   for(const button of buttons){if((await button.evaluate(element=>element.textContent?.trim())).toUpperCase()==='ADD ROW'){
    const before=await page.$$eval('table tbody tr',rows=>rows.length);await button.click();const after=await page.$$eval('table tbody tr',rows=>rows.length);assert.ok(after>before,route+' add row');rowAdded=true;break;
   }}
   assert.ok(rowAdded,route+' Add Row exists and works');
   checks.push({route,viewport:width,interaction:'form bounds, table scrolling and add row',passed:true});
   if(route==='/invoices/new'&&[360,768,1440].includes(width))await page.screenshot({path:path.join(outputDirectory,'verified-editor-'+width+'.png'),fullPage:true});
   await page.close();
  }
  console.log('Verified editor controls at '+width+'px');
 }
 assert.equal(mutations.length,0,'Rendering must not submit financial mutations');assert.equal(missing.size,0,'Every requested API needs an isolated fixture');assert.equal(errors.length,0,'Browser errors must be resolved');
 await writeFile(path.join(outputDirectory,'browser-results.json'),JSON.stringify({checks,requestCount:requests.length,missing:[...missing],mutations,errors,databaseAccess:false},null,2));
 console.log(JSON.stringify({passed:checks.length,requestCount:requests.length,databaseAccess:false}));
}catch(error){await writeFile(path.join(outputDirectory,'browser-failure.json'),JSON.stringify({checks,missing:[...missing],mutations,errors,message:String(error)},null,2));throw error;}finally{await browser.close();}
