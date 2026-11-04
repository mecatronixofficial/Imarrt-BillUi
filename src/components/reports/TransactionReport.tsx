'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Eye, FileSpreadsheet, Printer, Search, Share2 } from 'lucide-react';
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

/** All Transactions, Sale, Purchase and Day Book reports: one server-built list, filtered like Vyapar. */
export default function TransactionReport({ preset = 'all' }: { preset?: string }) {
  const config = TRANSACTION_REPORT_PRESETS[preset] ?? TRANSACTION_REPORT_PRESETS.all;
  const [period, setPeriod] = useState<Period>(config.period);
  const [dates, setDates] = useState(() => periodDates(config.period));
  const [firms, setFirms] = useState<Business[]>([]);
  const [firm, setFirm] = useState(() => getActiveBusinessId() ?? 'ALL');
  const [user, setUser] = useState('ALL');
  const [kind, setKind] = useState(config.kind);
  const [godowns, setGodowns] = useState<Array<{ id: string; name: string }>>([]);
  const [godown, setGodown] = useState('ALL');
  const [payment, setPayment] = useState('ALL');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 'date', asc: false });
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState('');

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

  const totals = useMemo(() => {
    const live = visible.filter((row) => !['CANCELLED', 'VOIDED', 'DRAFT', 'REJECTED'].includes(row.status));
    const sum = (list: ReportRow[]) => sumMoney(list.map((row) => row.total));
    return {
      sale: sum(live.filter((row) => row.kind === 'SALE')),
      purchase: sum(live.filter((row) => row.kind === 'PURCHASE')),
      moneyIn: sumMoney(live.filter((row) => MONEY_IN.includes(row.kind) && row.kind !== 'SALE').map((row) => row.paid)),
      moneyOut: sumMoney(live.filter((row) => ['PAYMENT_OUT', 'EXPENSE', 'EMI'].includes(row.kind)).map((row) => row.paid)),
      receivable: sumMoney(live.filter((row) => row.kind === 'SALE').map((row) => row.balance)),
      payable: sumMoney(live.filter((row) => row.kind === 'PURCHASE').map((row) => row.balance)),
    };
  }, [visible]);

  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next !== 'CUSTOM') setDates(periodDates(next));
  }

  function csvRows() {
    return [
      ['#', 'Date', 'Ref No.', 'Party Name', 'Category', 'Type', 'Total', 'Received / Paid', 'Balance', 'Due Date', 'Status', 'Payment Type', ...(firm === 'ALL' ? ['Firm'] : [])],
      ...visible.map((row, index) => [index + 1, formatDate(row.date), row.number, row.partyName, row.category, row.type, row.total, row.paid, row.balance, row.dueDate ? formatDate(row.dueDate) : '', statusOf(row).label, PAYMENTS.find(([key]) => key === row.paymentType)?.[1] ?? row.paymentType, ...(firm === 'ALL' ? [row.firmName ?? ''] : [])]),
    ];
  }
  const fileName = `${config.title} ${dates.from} to ${dates.to}`;

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
    setBusy(row.id);
    try {
      const { data } = await api.get<Blob>(`/${resource}/${row.id}/pdf`, { responseType: 'blob', headers: row.firmId ? { 'X-Business-Id': row.firmId } : undefined });
      const url = URL.createObjectURL(data);
      tab.location.href = url;
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (failure) {
      tab.close();
      toast.error(getApiError(failure, 'Could not open PDF.'));
    } finally {
      setBusy('');
    }
  }

  function rowActions(row: ReportRow): Array<RowAction | false | null | undefined> {
    if (row.record) return [{ label: 'View/Edit', icon: 'view', href: row.href }, ...actionsFor(row.record, { onPrint: () => void openPdf(row), includeView: false })];
    return [{ label: 'View', icon: 'view', href: row.href }];
  }

  const header = (key: SortKey, label: string, align?: 'right') => (
    <th className={align === 'right' ? 'text-right' : undefined}>
      <button type="button" onClick={() => setSort({ key, asc: sort.key === key ? !sort.asc : key !== 'date' })} className={align === 'right' ? 'justify-end' : undefined}>
        <span>{label}</span>
        {sort.key === key && (sort.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );

  return (
    <div className="transaction-report">
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
          <select aria-label="Firm" value={firm} onChange={(e) => setFirm(e.target.value)}>
            <option value="ALL">ALL FIRMS</option>
            {firms.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
          </select>
          <select aria-label="User" value={user} onChange={(e) => setUser(e.target.value)}>
            <option value="ALL">ALL USERS</option>
            {users.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" className="transaction-report-share" onClick={() => void shareWithAccountant()} disabled={!visible.length}>Share With Accountant</button>
          <button type="button" className="transaction-report-icon" onClick={() => downloadCsv(fileName, csvRows())} disabled={!visible.length}><FileSpreadsheet size={22} color="#1d7a46" /><span>Excel Report</span></button>
          <button type="button" className="transaction-report-icon" onClick={() => window.print()}><Printer size={22} /><span>Print</span></button>
        </div>
      </div>

      <div className="transaction-report-filters">
        <select aria-label="Transaction type" value={kind} onChange={(e) => setKind(e.target.value)}>{KINDS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select aria-label="Godown" value={godown} onChange={(e) => setGodown(e.target.value)}>
          <option value="ALL">All Godown</option>
          {godowns.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
        </select>
        <select aria-label="Payment type" value={payment} onChange={(e) => setPayment(e.target.value)}>{PAYMENTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        {(kind !== config.kind || user !== 'ALL' || godown !== 'ALL' || payment !== 'ALL' || query) && (
          <button type="button" className="text-xs font-semibold text-blue-600" onClick={() => { setKind(config.kind); setUser('ALL'); setGodown('ALL'); setPayment('ALL'); setQuery(''); }}>Clear filters</button>
        )}
      </div>

      <section className="reference-register transaction-report-table">
        <label className="transaction-report-search">
          <Search size={16} className="text-slate-400" />
          <input aria-label="Search transactions" placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        {loading ? <LoadingState label="Preparing report..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
          <div className="reference-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: 44 }}>#</th>
                  {header('date', 'DATE')}
                  {header('number', 'REF NO.')}
                  {header('partyName', 'PARTY NAME')}
                  {header('category', 'CATEGORY')}
                  {header('type', 'TYPE')}
                  {header('total', 'TOTAL', 'right')}
                  {header('paid', 'RECEIVED / PAID', 'right')}
                  {header('balance', 'BALANCE', 'right')}
                  {header('dueDate', 'DUE DATE')}
                  {header('status', 'STATUS')}
                  <th style={{ width: 120 }}>PRINT / SHARE</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row, index) => {
                  const status = statusOf(row);
                  return (
                    <tr key={`${row.firmId}-${row.kind}-${row.id}`} data-selected={selected === `${row.kind}-${row.id}` || undefined} onClick={() => setSelected(`${row.kind}-${row.id}`)}>
                      <td>{index + 1}</td>
                      <td>{formatDate(row.date)}</td>
                      <td title={row.number}>{row.number}</td>
                      <td title={row.partyName}><Link href={row.href} className="hover:text-blue-700" onClick={(e) => e.stopPropagation()}>{row.partyName || '—'}</Link>{firm === 'ALL' && row.firmName && <small className="block text-[11px] text-slate-400">{row.firmName}</small>}</td>
                      <td title={row.category}>{row.category}</td>
                      <td>{row.type}</td>
                      <td className="money">{formatCurrency(row.total)}</td>
                      <td className="money">{formatCurrency(row.paid)}</td>
                      <td className="money">{formatCurrency(row.balance)}</td>
                      <td>{row.dueDate && ['SALE', 'PURCHASE'].includes(row.kind) ? formatDate(row.dueDate) : ''}</td>
                      <td className={TONE[status.tone]} title={status.label}>{status.label}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div data-row-actions className="reference-row-actions">
                          {row.record
                            ? <button type="button" aria-label={`Print ${row.number}`} disabled={busy === row.id} onClick={() => void openPdf(row)}><Printer size={17} /></button>
                            : <Link href={row.href} aria-label={`Open ${row.type} ${row.number}`}><Eye size={17} /></Link>}
                          <Link href={row.href} aria-label={`Share ${row.type} ${row.number}`}><Share2 size={17} /></Link>
                          <RowActions label={`Actions for ${row.type} ${row.number}`} actions={rowActions(row)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && <EmptyState icon={FileSpreadsheet} title="No transactions" description={rows.length ? 'Nothing matches these filters. Try another type, user or payment.' : 'Nothing was recorded in this period. Pick another period above.'} />}
          </div>
        )}
        {!loading && !error && visible.length > 0 && (
          <dl className="transaction-report-totals">
            <div><dt>Total Sale</dt><dd className="text-emerald-700">{formatCurrency(totals.sale)}</dd></div>
            <div><dt>Total Purchase</dt><dd className="text-rose-700">{formatCurrency(totals.purchase)}</dd></div>
            <div><dt>Money In</dt><dd className="text-emerald-700">{formatCurrency(totals.moneyIn)}</dd></div>
            <div><dt>Money Out</dt><dd className="text-rose-700">{formatCurrency(totals.moneyOut)}</dd></div>
            <div><dt>Receivable</dt><dd>{formatCurrency(totals.receivable)}</dd></div>
            <div><dt>Payable</dt><dd>{formatCurrency(totals.payable)}</dd></div>
          </dl>
        )}
      </section>
      {dialogs}
    </div>
  );
}
