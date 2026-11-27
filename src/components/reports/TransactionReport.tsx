'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, Eye, FileSpreadsheet, FileText, Loader2, Search, Share2 } from 'lucide-react';
import RowActions, { type RowAction } from '../RowActions';
import { EmptyState, ErrorState, LoadingState } from '../ContentState';
import { toast } from '../ToastProvider';
import { useTransactionActions, type TransactionRecord } from '../transactionActions';
import { api, getActiveBusinessId, getAllPages, getApiError } from '@/lib/api';
import { localDate } from '@/lib/business-report';
import { sumMoney } from '@/lib/billing';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Business } from '@/types';
import styles from './TransactionReport.module.css';
import { usePageState } from '@/lib/navigation';

/** One row of GET /reports/transactions. */
type ReportRow = {
  id: string;
  kind: string;
  type: string;
  date: string;
  number: string;
  partyName: string;
  category: string;
  total: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  status: string;
  paymentType: string;
  warehouseId: string | null;
  createdById: string | null;
  createdByName: string | null;
  href: string;
  record?: TransactionRecord;
  firmId?: string;
  firmName?: string;
};
type Period = 'TODAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'THIS_QUARTER' | 'THIS_YEAR' | 'CUSTOM';
type SortKey = 'date' | 'number' | 'partyName' | 'category' | 'type' | 'total' | 'paid' | 'balance' | 'dueDate' | 'status';

export const TRANSACTION_REPORT_PRESETS: Record<string, { title: string; kind: string; period: Period }> = {
  all: { title: 'All Transactions', kind: 'ALL', period: 'THIS_MONTH' },
  sale: { title: 'Sale Report', kind: 'SALE', period: 'THIS_MONTH' },
  purchase: { title: 'Purchase Report', kind: 'PURCHASE', period: 'THIS_MONTH' },
  daybook: { title: 'Day Book', kind: 'ALL', period: 'TODAY' },
};

const KINDS: Array<[string, string]> = [
  ['ALL', 'All Transaction'], ['SALE', 'Sale'], ['PAYMENT_IN', 'Payment-In'], ['SALE_RETURN', 'Credit Note'], ['ESTIMATE', 'Estimate'], ['PROFORMA', 'Proforma Invoice'],
  ['SALE_ORDER', 'Sale Order'], ['DELIVERY_CHALLAN', 'Delivery Challan'], ['PURCHASE', 'Purchase'], ['PAYMENT_OUT', 'Payment-Out'], ['PURCHASE_RETURN', 'Debit Note'],
  ['PURCHASE_ORDER', 'Purchase Order'], ['EXPENSE', 'Expense'], ['OTHER_INCOME', 'Other Income'], ['EMI', 'EMI Paid'], ['LOAN', 'Loan Received'],
  ['CASH_ADJUSTMENT', 'Cash Adjustment'], ['TRANSFER', 'Bank Transfer'],
];
const PAYMENTS: Array<[string, string]> = [['ALL', 'All Payment'], ['cash', 'Cash'], ['bank_transfer', 'Bank'], ['upi', 'UPI'], ['cheque', 'Cheque'], ['card', 'Card'], ['credit', 'Credit (unpaid)'], ['other', 'Other']];
const PERIODS: Array<[Period, string]> = [['TODAY', 'Today'], ['THIS_WEEK', 'This Week'], ['THIS_MONTH', 'This Month'], ['LAST_MONTH', 'Last Month'], ['THIS_QUARTER', 'This Quarter'], ['THIS_YEAR', 'This Financial Year'], ['CUSTOM', 'Custom']];
/** Money into the business, for the summary. */
const MONEY_IN = ['SALE', 'PAYMENT_IN', 'OTHER_INCOME', 'LOAN'];

function periodDates(period: Period, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const day = (date: Date) => localDate(date);
  switch (period) {
    case 'TODAY': return { from: day(now), to: day(now) };
    case 'THIS_WEEK': { const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { from: day(start), to: day(now) }; }
    case 'LAST_MONTH': return { from: day(new Date(y, m - 1, 1)), to: day(new Date(y, m, 0)) };
    case 'THIS_QUARTER': { const q = Math.floor(m / 3) * 3; return { from: day(new Date(y, q, 1)), to: day(new Date(y, q + 3, 0)) }; }
    case 'THIS_YEAR': { const start = m >= 3 ? y : y - 1; return { from: day(new Date(start, 3, 1)), to: day(new Date(start + 1, 2, 31)) }; }
    default: return { from: day(new Date(y, m, 1)), to: day(new Date(y, m + 1, 0)) };
  }
}

/** The status words the registers use: Paid / Partial / Unpaid / Overdue (n days), and so on. */
function statusOf(row: ReportRow, today = localDate()): { label: string; tone: 'paid' | 'open' | 'late' | 'muted' } {
  if (['CANCELLED', 'VOIDED', 'REJECTED'].includes(row.status)) return { label: row.status === 'VOIDED' ? 'Voided' : 'Cancelled', tone: 'muted' };
  if (row.status === 'DRAFT') return { label: 'Draft', tone: 'muted' };
  if (['SALE', 'PURCHASE'].includes(row.kind)) {
    if (row.balance <= 0) return { label: 'Paid', tone: 'paid' };
    if (row.dueDate && row.dueDate.slice(0, 10) < today) {
      const days = Math.round((new Date(`${today}T00:00:00`).getTime() - new Date(`${row.dueDate.slice(0, 10)}T00:00:00`).getTime()) / 86400000);
      return { label: `Overdue (${days} day${days === 1 ? '' : 's'})`, tone: 'late' };
    }
    return { label: row.paid > 0 ? 'Partial' : 'Unpaid', tone: 'open' };
  }
  if (['ESTIMATE', 'PROFORMA', 'SALE_ORDER', 'DELIVERY_CHALLAN', 'PURCHASE_ORDER'].includes(row.kind)) return { label: row.status === 'CONVERTED' || row.status === 'RECEIVED' ? 'Closed' : 'Open', tone: row.status === 'CONVERTED' || row.status === 'RECEIVED' ? 'paid' : 'open' };
  if (row.kind === 'PAYMENT_IN') return { label: 'Used', tone: 'paid' };
  return { label: 'Paid', tone: 'paid' };
}
const TONE = { paid: 'text-emerald-600', open: 'text-amber-600', late: 'text-rose-600', muted: 'text-slate-400' };

function invoiceDetailHref(row: ReportRow) {
  if (!['SALE', 'PURCHASE'].includes(row.kind) || !row.firmId || row.firmId === 'ALL') return row.href;
  const url = new URL(row.href, window.location.origin);
  url.searchParams.set('companyId', row.firmId);
  return `${url.pathname}${url.search}${url.hash}`;
}

/** All Transactions, Sale, Purchase and Day Book reports: one server-built list, filtered like Vyapar. */
export default function TransactionReport({ preset = 'all' }: { preset?: string }) {
  const router = useRouter();
  const config = TRANSACTION_REPORT_PRESETS[preset] ?? TRANSACTION_REPORT_PRESETS.all;
  const [period, setPeriod] = usePageState<Period>('TransactionReport.period', config.period);
  const [dates, setDates] = useState(() => periodDates(config.period));
  const [firms, setFirms] = useState<Business[]>([]);
  const [firm, setFirm] = useState(() => getActiveBusinessId() ?? 'ALL');
  const [user, setUser] = useState('ALL');
  const [kind, setKind] = useState(config.kind);
  const [godowns, setGodowns] = useState<Array<{ id: string; name: string }>>([]);
  const [godown, setGodown] = useState('ALL');
  const [payment, setPayment] = useState('ALL');
  const [query, setQuery] = usePageState('TransactionReport.query', '');
  const [sort, setSort] = usePageState<{ key: SortKey; asc: boolean }>('TransactionReport.sort', { key: 'date', asc: false });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [selectedParty, setSelectedParty] = useState('ALL');
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  useEffect(() => {
    void getAllPages<Business>('/businesses').then(({ data }) => setFirms(data)).catch(() => undefined);
    void getAllPages<{ id: string; name: string }>('/inventory/godowns').then(({ data }) => setGodowns(data)).catch(() => undefined);
  }, []);

  const load = useCallback(async () => {
    if (!dates.from || !dates.to || dates.from > dates.to) return;
    setLoading(true); setError('');
    try {
      const targets = firm === 'ALL' ? firms.map(({ id, name }) => ({ id, name })) : [{ id: firm, name: firms.find(({ id }) => id === firm)?.name }];
      const results = await Promise.all((targets.length ? targets : [{ id: firm, name: undefined }]).map(async (target) => {
        const { data } = await api.get<ReportRow[]>('/reports/transactions', { params: { from: dates.from, to: dates.to }, headers: target.id && target.id !== 'ALL' ? { 'X-Business-Id': target.id } : undefined });
        return data.map((row) => ({ ...row, firmId: target.id, firmName: target.name }));
      }));
      setRows(results.flat());
    } catch (failure) {
      setError(getApiError(failure, 'Could not load the transaction report.'));
    } finally {
      setLoading(false);
    }
  }, [dates, firm, firms]);
  useEffect(() => { void load(); }, [load]);

  const { actionsFor, dialogs } = useTransactionActions(() => void load());

  const users = useMemo(() => [...new Map(rows.filter((row) => row.createdById).map((row) => [row.createdById!, row.createdByName ?? 'Unknown'])).entries()], [rows]);
  const partyList = useMemo(() => { const map = new Map<string, number>(); for (const r of rows) { if (r.partyName) map.set(r.partyName, (map.get(r.partyName) ?? 0) + 1); } return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)); }, [rows]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (row: ReportRow, key: SortKey) => (key === 'total' || key === 'paid' || key === 'balance' ? row[key] : key === 'status' ? statusOf(row).label : (row[key] ?? '').toString().toLowerCase());
    return rows
      .filter((row) => (kind === 'ALL' || row.kind === kind)
        && (user === 'ALL' || row.createdById === user)
        && (godown === 'ALL' || row.warehouseId === godown)
        && (payment === 'ALL' || row.paymentType === payment)
        && (!q || [row.number, row.partyName, row.category, row.type, row.firmName, String(row.total)].some((v) => v?.toLowerCase().includes(q))))
      .sort((a, b) => {
        const x = value(a, sort.key), y = value(b, sort.key);
        return (x < y ? -1 : x > y ? 1 : 0) * (sort.asc ? 1 : -1) || (b.date < a.date ? -1 : 1);
      });
  }, [rows, kind, user, godown, payment, query, sort]);
  const displayRows = useMemo(() => selectedParty === 'ALL' ? visible : visible.filter((r) => r.partyName === selectedParty), [visible, selectedParty]);

  const totals = useMemo(() => {
    const live = displayRows.filter((row) => !['CANCELLED', 'VOIDED', 'DRAFT', 'REJECTED'].includes(row.status));
    const sum = (list: ReportRow[]) => sumMoney(list.map((row) => row.total));
    return {
      sale: sum(live.filter((row) => row.kind === 'SALE')),
      purchase: sum(live.filter((row) => row.kind === 'PURCHASE')),
      moneyIn: sumMoney(live.filter((row) => MONEY_IN.includes(row.kind) && row.kind !== 'SALE').map((row) => row.paid)),
      moneyOut: sumMoney(live.filter((row) => ['PAYMENT_OUT', 'EXPENSE', 'EMI'].includes(row.kind)).map((row) => row.paid)),
      receivable: sumMoney(live.filter((row) => row.kind === 'SALE').map((row) => row.balance)),
      payable: sumMoney(live.filter((row) => row.kind === 'PURCHASE').map((row) => row.balance)),
    };
  }, [displayRows]);

  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next !== 'CUSTOM') setDates(periodDates(next));
  }

  function csvRows() {
    return [
      ['#', 'Date', 'Ref No.', 'Party Name', 'Category', 'Type', 'Total', 'Received / Paid', 'Balance', 'Due Date', 'Status', 'Payment Type', ...(firm === 'ALL' ? ['Firm'] : [])],
      ...displayRows.map((row, index) => [index + 1, formatDate(row.date), row.number, row.partyName, row.category, row.type, row.total, row.paid, row.balance, row.dueDate ? formatDate(row.dueDate) : '', statusOf(row).label, PAYMENTS.find(([key]) => key === row.paymentType)?.[1] ?? row.paymentType, ...(firm === 'ALL' ? [row.firmName ?? ''] : [])]),
    ];
  }
  const fileName = `${config.title}${selectedParty === 'ALL' ? '' : ` - ${selectedParty}`} - ${dates.from} to ${dates.to}`.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');

  async function exportPdf() {
    if (downloadingPdf || loading || error || !displayRows.length || !dates.from || !dates.to || dates.from > dates.to) return;
    const [headers, ...data] = csvRows();
    const options = {
      title: config.title,
      customer: selectedParty === 'ALL' ? 'All customers' : selectedParty,
      company: firm === 'ALL' ? 'All firms' : firms.find(({ id }) => id === firm)?.name,
      period: `${formatDate(dates.from)} to ${formatDate(dates.to)}`,
      headers: headers.map(String),
      rows: data.map((row) => row.map((value, index) => [6, 7, 8].includes(index) ? formatCurrency(Number(value)) : value)),
      summary: [
        ['Total Sale', formatCurrency(totals.sale)],
        ['Total Purchase', formatCurrency(totals.purchase)],
        ['Money In', formatCurrency(totals.moneyIn)],
        ['Money Out', formatCurrency(totals.moneyOut)],
        ['Receivable', formatCurrency(totals.receivable)],
        ['Payable', formatCurrency(totals.payable)],
      ] as Array<[string, string]>,
    };
    setDownloadingPdf(true);
    try {
      const { downloadReportPdf } = await import('@/lib/report-pdf');
      await downloadReportPdf(fileName, options);
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not download the PDF report. Please try again.'));
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function shareWithAccountant() {
    const csv = csvRows().map((row) => row.map((cell) => `"${String(cell ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const file = new File(['﻿' + csv], `${fileName}.csv`, { type: 'text/csv' });
    const summary = `${config.title} (${formatDate(dates.from)} – ${formatDate(dates.to)})\nSale: ${formatCurrency(totals.sale)}\nPurchase: ${formatCurrency(totals.purchase)}\nReceivable: ${formatCurrency(totals.receivable)}\nPayable: ${formatCurrency(totals.payable)}`;
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: config.title, text: summary, files: [file] });
        return;
      }
    } catch (failure) {
      if ((failure as Error).name === 'AbortError') return;
    }
    downloadCsv(fileName, csvRows());
    window.location.href = `mailto:?subject=${encodeURIComponent(config.title)}&body=${encodeURIComponent(`${summary}\n\nThe report is attached as ${fileName}.csv (downloaded to your computer).`)}`;
    toast.success('Report downloaded', { description: 'Attach the CSV file to the email for your accountant.' });
  }

  async function openPdf(row: ReportRow) {
    const resource = row.kind === 'SALE' ? 'invoices' : 'documents';
    const tab = window.open('about:blank', '_blank');
    if (!tab) return toast.error('Allow pop-ups to view this PDF.');
    tab.opener = null;
    try {
      const { data } = await api.get<Blob>(`/${resource}/${row.id}/pdf`, { responseType: 'blob', headers: row.firmId ? { 'X-Business-Id': row.firmId } : undefined });
      const url = URL.createObjectURL(data);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (failure) {
      tab.close();
      toast.error(getApiError(failure, 'Could not open PDF.'));
    }
  }

  function rowActions(row: ReportRow): Array<RowAction | false | null | undefined> {
    const href = invoiceDetailHref(row);
    if (row.record) return [{ label: 'View/Edit', icon: 'view', href }, ...actionsFor(row.record, { onPrint: () => void openPdf(row), includeView: false })];
    return [{ label: 'View', icon: 'view', href }];
  }

  const header = (key: SortKey, label: string, align?: 'right') => (
    <th scope="col" aria-label={label} className={align === 'right' ? styles.money : undefined}>
      <button type="button" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : key !== 'date' })} className={align === 'right' ? 'justify-end' : undefined}>
        <span>{label}</span>
        {sort.key === key && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div className={`transaction-report ${styles.report}`}>
      <div className="transaction-report-bar">
        <div className="flex flex-wrap items-center gap-3">
          <select aria-label="Report period" className="transaction-report-period" value={period} onChange={(e) => choosePeriod(e.target.value as Period)}>
            {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <div className="transaction-report-range">
            <span>Between</span>
            <input type="date" aria-label="From date" value={dates.from} max={dates.to} onChange={(e) => { setPeriod('CUSTOM'); setDates({ ...dates, from: e.target.value }); }} />
            <small>To</small>
            <input type="date" aria-label="To date" value={dates.to} min={dates.from} onChange={(e) => { setPeriod('CUSTOM'); setDates({ ...dates, to: e.target.value }); }} />
          </div>
          <label style={{display:'flex',alignItems:'center',gap:6,height:28,border:'1px solid #cfd6de',borderRadius:20,padding:'0 10px',background:'#fff',flex:1,minWidth:120,maxWidth:200}}>
            <Search size={13} className="text-slate-400" style={{flexShrink:0}}/>
            <input aria-label="Search transactions" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} style={{border:0,outline:0,background:'transparent',fontSize:12,width:'100%'}}/>
          </label>
          <button
            type="button"
            className={styles.download}
            aria-label={`Download PDF report for ${selectedParty === 'ALL' ? 'all customers' : selectedParty}`}
            disabled={downloadingPdf || loading || Boolean(error) || !displayRows.length || !dates.from || !dates.to || dates.from > dates.to}
            onClick={() => void exportPdf()}
          >
            {downloadingPdf ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
            {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
          </button>
          <button
            type="button"
            className={styles.download}
            aria-label={`Download report for ${selectedParty === 'ALL' ? 'all customers' : selectedParty}`}
            title="Download all matching transactions as a CSV spreadsheet"
            disabled={loading || Boolean(error) || !displayRows.length || !dates.from || !dates.to || dates.from > dates.to}
            onClick={() => downloadCsv(fileName, csvRows())}
          >
            <FileSpreadsheet size={16} aria-hidden="true" />
            {selectedParty === 'ALL' ? 'Download report' : 'Download customer report'}
          </button>
        </div>
      </div>

      <div className={styles.layout}>
        <div className={styles.customers}>
          <div className={styles.customersHeading}>Customers</div>
          <button className={styles.customerButton} type="button" onClick={()=>setSelectedParty('ALL')} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'9px 12px',fontSize:12,fontWeight:selectedParty==='ALL'?700:500,background:selectedParty==='ALL'?'#1d4ed8':'transparent',color:selectedParty==='ALL'?'#fff':'#334155',border:'none',cursor:'pointer',textAlign:'left'}}>
            <span>All</span><span style={{fontSize:10,fontWeight:700,background:selectedParty==='ALL'?'rgba(255,255,255,0.25)':'#e2e8f0',color:selectedParty==='ALL'?'#fff':'#64748b',borderRadius:999,padding:'1px 6px'}}>{rows.length}</span>
          </button>
          {partyList.map((p)=>(
            <button className={styles.customerButton} key={p.name} type="button" onClick={()=>setSelectedParty(p.name===selectedParty?'ALL':p.name)} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',fontSize:12,fontWeight:selectedParty===p.name?700:400,background:selectedParty===p.name?'#1d4ed8':'transparent',color:selectedParty===p.name?'#fff':'#475569',border:'none',cursor:'pointer',textAlign:'left'}}>
              <span style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',flex:1,marginRight:6}}>{p.name}</span>
              <span style={{fontSize:10,fontWeight:700,background:selectedParty===p.name?'rgba(255,255,255,0.25)':'#e2e8f0',color:selectedParty===p.name?'#fff':'#64748b',borderRadius:999,padding:'1px 6px',flexShrink:0}}>{p.count}</span>
            </button>
          ))}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <section className="reference-register transaction-report-table">
            {loading ? <LoadingState label="Preparing report..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
              <div className={styles.scroll} role="region" aria-label={`${config.title} transactions`} tabIndex={0}>
                <table className={styles.table} aria-label={config.title}>
                  <colgroup>
                    <col className={styles.invoiceColumn} />
                    <col className={styles.partyColumn} />
                    <col className={styles.typeColumn} />
                    <col className={styles.moneyColumn} span={3} />
                    <col className={styles.statusColumn} />
                    <col className={styles.actionsColumn} />
                  </colgroup>
                  <thead>
                    <tr>
                      {header('number', 'INV NO.')}
                      {header('partyName', 'PARTY')}
                      {header('type', 'TYPE')}
                      {header('total', 'TOTAL', 'right')}
                      {header('paid', 'PAID', 'right')}
                      {header('balance', 'BAL', 'right')}
                      {header('status', 'STATUS')}
                      <th scope="col" className={styles.actions}>ACT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayRows.map((row) => {
                      const status = statusOf(row);
                      const isInvoice = ['SALE', 'PURCHASE'].includes(row.kind);
                      const href = invoiceDetailHref(row);
                      return (
                        <tr key={`${row.firmId}-${row.kind}-${row.id}`} data-selected={selected === `${row.kind}-${row.id}` || undefined} onClick={() => { setSelected(`${row.kind}-${row.id}`); if (isInvoice) router.push(href); }}>
                          <td data-label="INV NO.">{isInvoice ? <Link href={href} aria-label={`View full details for ${row.number}`} className="font-semibold text-blue-700 hover:underline" onClick={(e) => e.stopPropagation()}>{row.number}</Link> : row.number}</td>
                          <td data-label="PARTY"><Link href={href} className="hover:text-blue-700" onClick={(e) => e.stopPropagation()}>{row.partyName || '—'}</Link></td>
                          <td data-label="TYPE">{row.type}</td>
                          <td data-label="TOTAL" className={styles.money}>{formatCurrency(row.total)}</td>
                          <td data-label="PAID" className={styles.money}>{formatCurrency(row.paid)}</td>
                          <td data-label="BAL" className={styles.money}>{formatCurrency(row.balance)}</td>
                          <td data-label="STATUS" className={TONE[status.tone]}>{status.label}</td>
                          <td data-label="ACTIONS" className={styles.actions} onClick={(e) => e.stopPropagation()}>
                            <div data-row-actions className="reference-row-actions">
                              {!row.record && <Link href={href} aria-label={`Open ${row.type} ${row.number}`}><Eye size={14} /></Link>}
                              <RowActions label={`Actions for ${row.type} ${row.number}`} actions={rowActions(row)} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!displayRows.length && <EmptyState icon={FileSpreadsheet} title="No transactions" description={rows.length ? 'No transactions for this customer in the selected period.' : 'Nothing was recorded in this period. Pick another period above.'} />}
              </div>
            )}
            {!loading && !error && displayRows.length > 0 && (
              <div className={`transaction-report-totals ${styles.totals}`}>
                <div className="tr-total-card tr-total-sale"><span>Total Sale</span><strong>{formatCurrency(totals.sale)}</strong></div>
                <div className="tr-total-card tr-total-purchase"><span>Total Purchase</span><strong>{formatCurrency(totals.purchase)}</strong></div>
                <div className="tr-total-card tr-total-moneyin"><span>Money In</span><strong>{formatCurrency(totals.moneyIn)}</strong></div>
                <div className="tr-total-card tr-total-moneyout"><span>Money Out</span><strong>{formatCurrency(totals.moneyOut)}</strong></div>
                <div className="tr-total-card tr-total-receivable"><span>Receivable</span><strong>{formatCurrency(totals.receivable)}</strong></div>
                <div className="tr-total-card tr-total-payable"><span>Payable</span><strong>{formatCurrency(totals.payable)}</strong></div>
              </div>
            )}
          </section>
        </div>
      </div>
      {dialogs}
    </div>
  );
}
