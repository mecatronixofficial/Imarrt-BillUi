import { subtractMoney, sumMoney } from './billing';
import type { BusinessDocument, Expense, Invoice, ProductionOrder } from '../types';
export type ReportDates = { from?: string; to?: string };
export function localDate(date = new Date()): string { return [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-'); }
export function inDateRange(value: string, dates: ReportDates = {}, now = new Date()): boolean {
  const day = value.slice(0,10);
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && (!dates.from || day >= dates.from) && day <= (dates.to || localDate(now));
}
export function reportDates(range: string, from = '', to = '', now = new Date()): ReportDates {
  const start = new Date(now); start.setHours(0,0,0,0);
  if (range === 'ALL') return { to: localDate(now) };
  if (range === 'CUSTOM') return { from: from || undefined, to: to || localDate(now) };
  if (range === 'WEEK') start.setDate(start.getDate() - (start.getDay()+6)%7);
  if (range === 'MONTH') start.setDate(1);
  if (range === 'YEAR') start.setMonth(0,1);
  if (range === '30D' || range === '90D') start.setDate(start.getDate() - (range === '30D' ? 29 : 89));
  return { from: localDate(start), to: localDate(now) };
}
export function buildBusinessReport(data: { invoices: Invoice[]; documents: BusinessDocument[]; orders: ProductionOrder[]; expenses?: Expense[] }, dates: ReportDates = {}, now = new Date()) {
  const activeInvoices = data.invoices.filter((invoice) => !['DRAFT','CANCELLED'].includes(invoice.status) && inDateRange(invoice.issueDate, dates, now));
  const documents = data.documents.filter((document) => !['DRAFT','CANCELLED','REJECTED'].includes(document.status) && inDateRange(document.issueDate, dates, now));
  const purchases = documents.filter((document) => document.type === 'PURCHASE_INVOICE');
  const creditNotes = documents.filter((document) => document.type === 'CREDIT_NOTE');
  const debitNotes = documents.filter((document) => document.type === 'DEBIT_NOTE');
  const salesReturns = sumMoney(creditNotes.map((document) => document.grandTotal));
  const purchaseReturns = sumMoney(debitNotes.map((document) => document.grandTotal));
  const grossSales = sumMoney(activeInvoices.map((invoice) => invoice.grandTotal));
  const sales = subtractMoney(grossSales, salesReturns);
  const collected = sumMoney(activeInvoices.map((invoice) => invoice.amountPaid));
  const purchaseTotal = subtractMoney(sumMoney(purchases.map((document) => document.grandTotal)), purchaseReturns);
  const productionCost = sumMoney(data.orders.filter((order) => !['DRAFT','CANCELLED'].includes(order.status) && inDateRange(order.createdAt, dates, now)).map((order) => order.summary?.totalMakingCost ?? 0));
  const expenses = sumMoney((data.expenses ?? []).filter((expense) => expense.status === 'ISSUED' && inDateRange(expense.expenseDate, dates, now)).map((expense) => expense.total));
  const customerMap = new Map<string, {name:string;total:number;paid:number;count:number}>();
  for (const invoice of activeInvoices) {
    const customer = customerMap.get(invoice.party.id) ?? {name:invoice.party.name,total:0,paid:0,count:0};
    customer.total = sumMoney([customer.total,invoice.grandTotal]); customer.paid = sumMoney([customer.paid,invoice.amountPaid]); customer.count++;
    customerMap.set(invoice.party.id,customer);
  }
  const chartEnd=dates.to&&/^\d{4}-\d{2}-\d{2}$/.test(dates.to)?new Date(dates.to+'T12:00:00'):now;
  const months = Array.from({length:6},(_,index)=>{
    const date = new Date(chartEnd.getFullYear(),chartEnd.getMonth()-5+index,1);
    const month = localDate(date).slice(0,7);
    return { label: date.toLocaleDateString('en-IN',{month:'short'}),
      value: sumMoney(activeInvoices.filter((invoice)=>invoice.issueDate.startsWith(month)).map((invoice)=>invoice.grandTotal)),
      purchases: sumMoney(purchases.filter((document)=>document.issueDate.startsWith(month)).map((document)=>document.grandTotal)),
    };
  });
  return { sales, grossSales, salesReturns, purchaseReturns, collected,
    outstanding: Math.max(0,subtractMoney(sales,collected)), purchases: purchaseTotal,
    payable: Math.max(0,subtractMoney(purchaseTotal,sumMoney(purchases.map((document)=>document.paidAmount ?? 0)))),
    expenses, productionCost, profit: subtractMoney(subtractMoney(subtractMoney(sales,purchaseTotal),productionCost), expenses),
    byStatus: ['PAID','PARTIALLY_PAID','UNPAID','DRAFT'].map((status)=>({status,count:activeInvoices.filter((invoice)=>invoice.status===status).length,total:sumMoney(activeInvoices.filter((invoice)=>invoice.status===status).map((invoice)=>invoice.grandTotal))})),
    topCustomers:[...customerMap.values()].sort((a,b)=>b.total-a.total).slice(0,5), months,
  };
}
