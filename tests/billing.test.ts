import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeBilling, money, multiplyMoney, subtractMoney, sumMoney } from '../src/lib/billing';
import { buildBusinessReport, reportDates, inDateRange } from '../src/lib/business-report';
import type { Invoice, BusinessDocument, ProductionOrder } from '../src/types';
test('decimal arithmetic handles half-paise values and scientific notation exactly',()=>{
 assert.equal(money(1.005),1.01); assert.equal(money(-1.005),-1.01); assert.equal(money(1e-7),0);
 assert.equal(multiplyMoney(0.1,0.2),0.02); assert.equal(sumMoney([0.1,0.2,0.3]),0.6); assert.equal(subtractMoney(100.1,100),0.1);
});
test('inclusive GST reconciles to the entered gross instead of taxing it twice',()=>{
 const result=computeBilling([{quantity:1,unitPrice:100,taxRate:18,taxInclusive:true}]);
 assert.equal(result.subTotal,84.75); assert.equal(result.taxTotal,15.25); assert.equal(result.grandTotal,100);
});
test('line rounding, composition, discount, tax rounding and round-off remain deterministic',()=>{
 assert.equal(computeBilling([{quantity:3,unitPrice:19.99,taxRate:12}]).grandTotal,67.17);
 assert.equal(computeBilling([{quantity:1,unitPrice:99.5,taxRate:18}],0,{roundTax:true}).grandTotal,117.5);
 assert.equal(computeBilling([{quantity:1,unitPrice:99.5,taxRate:18}],0,{noTax:true,roundOff:true}).grandTotal,100);
 assert.equal(computeBilling([{quantity:1,unitPrice:10,taxRate:0}],25.4,{roundOff:true}).grandTotal,-15.4);
 assert.throws(()=>money(Infinity));
});
test('reports exclude drafts, cancellations and future entries, and include returns',()=>{
 const invoice=(status:Invoice['status'],total:string,date='2026-10-15')=>({id:status,party:{id:'party',name:'Customer'},status,grandTotal:total,amountPaid:'10',issueDate:date} as Invoice);
 const document=(type:BusinessDocument['type'],status:BusinessDocument['status'],total:string)=>({id:type,type,status,grandTotal:total,paidAmount:'0',issueDate:'2026-10-15'} as BusinessDocument);
 const result=buildBusinessReport({invoices:[invoice('UNPAID','100'),invoice('DRAFT','900'),invoice('CANCELLED','800'),invoice('PAID','700','2026-11-01')],documents:[document('PURCHASE_INVOICE','ISSUED','50'),document('PURCHASE_INVOICE','DRAFT','500'),document('CREDIT_NOTE','ISSUED','20'),document('DEBIT_NOTE','ISSUED','5')],orders:[] as ProductionOrder[]},reportDates('MONTH','','',new Date(2026,9,31)),new Date(2026,9,31));
 assert.equal(result.sales,80); assert.equal(result.collected,10); assert.equal(result.outstanding,70); assert.equal(result.purchases,45); assert.equal(result.payable,45);
});
test('week and custom ranges have inclusive dates and stable local day boundaries',()=>{
 assert.deepEqual(reportDates('WEEK','','',new Date(2026,9,31)),{from:'2026-10-26',to:'2026-10-31'});
 assert.equal(inDateRange('2026-10-31T22:30:00.000Z',{from:'2026-10-31',to:'2026-10-31'}),true);
 assert.equal(inDateRange('2026-11-01',{to:'2026-10-31'}),false);
});

test('custom reports chart the selected historical period',()=>{const report=buildBusinessReport({invoices:[],documents:[],orders:[]},{from:'2020-01-01',to:'2020-02-01'},new Date(2026,9,31));assert.equal(report.months.at(-1)?.label,'Feb');});
