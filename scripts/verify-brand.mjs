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

 const appRoutes=['/purchases/orders',`/parties/${ids.party}`,`/items/${ids.item}`,`/invoices/${ids.invoice}`,`/documents/${ids.quote}`,'/dashboard','/parties','/items','/invoices','/invoices/new','/documents/new','/sales','/sales/payment-in','/sales/proforma/new','/sales/quotations/new','/sales/orders/new','/sales/delivery-challans/new','/sales/returns/new','/purchases','/purchases/bills/new','/purchases/returns/new','/purchases/payment-out','/purchases/expenses','/production','/inventory','/inventory/godowns','/inventory/adjustments','/cash-banks','/cash-banks/cash','/cash-banks/loans','/cash-banks/cheques','/sales/other-income','/reports','/profile','/settings','/settings/general','/settings/party','/settings/item','/settings/transaction','/settings/taxes-gst','/settings/transaction-message','/settings/print','/team','/security','/businesses'];
 for(const route of appRoutes){
  const page=await makePage({width:1440,height:1000});
  await page.goto(origin+route,{waitUntil:'networkidle0'});
  const visible=await page.$$eval('[aria-label="Go back"]',buttons=>buttons.some(button=>{const box=button.getBoundingClientRect();return box.width>0&&box.height>0&&box.left>=0&&box.right<=innerWidth&&(button===document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)||button.contains(document.elementFromPoint(box.left+box.width/2,box.top+box.height/2)));}));
  assert.ok(visible,'Visible Back control on '+route);
  checks.push({route,check:'visible back button',passed:true});
  await page.close();
 }
 console.log('Back controls verified across '+appRoutes.length+' pages');
 for(const width of [1920,1440,1280,1024,768,430,390,360]){
  for(const route of ['/dashboard','/settings/general','/invoices/new','/parties']){
   const page=await makePage({width,height:1000});await page.goto(origin+route,{waitUntil:'networkidle0'});
   const dimensions=await page.evaluate(()=>({width:innerWidth,content:document.documentElement.scrollWidth}));
   assert.ok(dimensions.content<=dimensions.width+2,'No global overflow '+route+' at '+width+': '+JSON.stringify(dimensions));
   if(route==='/dashboard'){
    const cardCount=await page.$$eval('.brand-kpi',cards=>cards.length);assert.equal(cardCount,4);
    await page.select('[aria-label="Dashboard period"]','YEAR');
    await page.click('[aria-label="Bar chart"]');
    assert.equal(await page.$eval('[aria-label="Bar chart"]',el=>el.getAttribute('aria-pressed')),'true');
    await page.select('[aria-label="Dashboard period"]','CUSTOM');
    assert.ok(await page.$('[aria-label="Dashboard from date"]'));assert.ok(await page.$('[aria-label="Dashboard to date"]'));
    await page.select('[aria-label="Dashboard period"]','MONTH');
    await page.click('[aria-label="Area chart"]');
    const metrics=await page.$$('.brand-segments button');await metrics[1].click();
    assert.equal(await metrics[1].evaluate(el=>el.getAttribute('aria-pressed')),'true');
    await metrics[0].click();
    await page.screenshot({path:path.join(outputDirectory,'dashboard-'+width+'.png'),fullPage:true});
    assert.equal(await page.$eval('.reference-sale',el=>getComputedStyle(el).backgroundColor),'rgb(248, 226, 42)');
    const controlsFit=await page.$$eval('.reference-toolbar a,.reference-toolbar button,.brand-period-bar input,.brand-period-bar select',nodes=>nodes.filter(el=>el.getBoundingClientRect().width>0).every(el=>{const r=el.getBoundingClientRect();return r.left>=-1&&r.right<=innerWidth+1;}));assert.ok(controlsFit,'Visible toolbar and date controls fit at '+width);
   }
   if(route==='/settings/general')await page.screenshot({path:path.join(outputDirectory,'settings-'+width+'.png'),fullPage:true});
   checks.push({route,width,check:'responsive layout and chart controls',passed:true});await page.close();
  }
  console.log('Checked brand layouts at '+width+'px');
 }
 // Reproduce the reported bug: open the settings symbol, then navigate back.
 for(const width of [1440,390]){
  const page=await makePage({width,height:1000});await page.goto(origin+'/dashboard',{waitUntil:'networkidle0'});
  await page.click('a[aria-label="Settings"]');await page.waitForFunction(()=>location.pathname==='/settings/general');
  const back=await page.$$('[aria-label="Go back"]');for(const button of back){if(await button.evaluate(el=>el.getBoundingClientRect().width>0)){await button.click();break;}}
  await page.waitForFunction(()=>location.pathname==='/dashboard');
  checks.push({width,check:'settings symbol and return navigation',passed:true});await page.close();
 }
 // A pasted settings URL has no in-app history: Back must still have a useful destination.
 {const page=await makePage({width:1440,height:1000});await page.goto(origin+'/settings/item',{waitUntil:'networkidle0'});await page.click('.brand-settings-heading [aria-label="Go back"]');await page.waitForFunction(()=>location.pathname==='/settings');await page.click('.reference-toolbar [aria-label="Go back"]');await page.waitForFunction(()=>location.pathname==='/dashboard');checks.push({check:'repeated direct-link settings back fallback',passed:true});await page.close();}

 {const page=await makePage({width:1440,height:1000});await page.goto(origin+'/invoices?status=overdue',{waitUntil:'networkidle0'});assert.equal(await page.$eval('[aria-label="Filter transaction status"]',el=>el.value),'OVERDUE');checks.push({check:'overdue dashboard shortcut filter',passed:true});await page.close();}
 {const page=await makePage({width:1440,height:1000});await page.goto(origin+'/dashboard',{waitUntil:'networkidle0'});const targets=await page.$$('.brand-chart-target');if(targets.length>1){await targets[0].evaluate(el=>el.focus());await page.keyboard.press('ArrowRight');assert.ok(await targets[1].evaluate(el=>document.activeElement===el),'Chart dates support arrow-key navigation');}checks.push({check:'keyboard chart exploration',passed:true});await page.close();}
 assert.equal(missing.size,0,'All fixture endpoints handled');assert.equal(mutations.length,0,'No live mutations');assert.equal(errors.length,0,'No browser errors');
 await writeFile(path.join(outputDirectory,'brand-results.json'),JSON.stringify({checks,requestCount:requests.length,missing:[...missing],mutations,errors,databaseAccess:false},null,2));
 console.log(JSON.stringify({passed:checks.length,databaseAccess:false}));
 }catch(error){await writeFile(path.join(outputDirectory,'brand-failure.json'),JSON.stringify({checks,missing:[...missing],mutations,errors,message:String(error)},null,2));throw error;}finally{await browser.close();}
