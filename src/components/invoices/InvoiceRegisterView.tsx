'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, CircleAlert, Clock3, FileSpreadsheet, IndianRupee, Loader2, Plus, Printer, ReceiptText, Search, Settings, Users, Wallet, X } from 'lucide-react';
import type { RecordRow } from '../ReferenceRegister';
import { formatCurrency, formatDate } from '@/lib/format';
import styles from './InvoiceRegisterView.module.css';

export type InvoiceRegisterFilters = { query: string; status: string; from: string; to: string; firm: string; user: string; customer: string };
type Props = {
  title: string; actionLabel: string; createPath: string;
  rows: RecordRow[]; recordCount: number;
  customers: Array<{ name: string; count: number }>;
  firms: string[]; users: string[];
  filters: InvoiceRegisterFilters;
  onFilterChange: (key: keyof InvoiceRegisterFilters, value: string) => void;
  onClearFilters: () => void;
  sort: { key: string; asc: boolean }; onSort: (key: string) => void;
  total: number; paid: number; balance: number;
  loading: boolean; error: string; onRetry: () => void;
  onExport: () => void;
  statusLabel: (row: RecordRow) => string;
  renderActions: (row: RecordRow) => ReactNode;
};

const COLUMNS = [['Invoice no.', 'number'], ['Customer', 'party'], ['Invoice date', 'date'], ['Amount', 'total'], ['Balance', 'balance'], ['Status', 'status']];

export default function InvoiceRegisterView({ title, actionLabel, createPath, rows, recordCount, customers, firms, users, filters, onFilterChange, onClearFilters, sort, onSort, total, paid, balance, loading, error, onRetry, onExport, statusLabel, renderActions }: Props) {
  const [customerQuery, setCustomerQuery] = useState('');
  const visibleCustomers = customers.filter(({ name }) => name.toLowerCase().includes(customerQuery.trim().toLowerCase()));
  const activeFilters = Object.entries(filters).filter(([key, value]) => key === 'query' || key === 'from' || key === 'to' ? Boolean(value) : value !== 'ALL').length;
  return <div className={styles.page}>
    <header className={styles.header}><div className={styles.heading}><span className={styles.heroIcon}><ReceiptText size={27} strokeWidth={1.7} aria-hidden="true" /></span><div><p className={styles.eyebrow}>SALES / INVOICE REGISTER</p><h1>{title}</h1><p className={styles.subtitle}>Track customer invoices, payments and outstanding balances.</p></div></div><div className={styles.headerActions}><Link href="/settings/transaction" className={styles.iconButton} aria-label="Transaction settings" title="Transaction settings"><Settings size={18} aria-hidden="true" /></Link><Link href={createPath} className={styles.primaryButton}><Plus size={17} aria-hidden="true" />{actionLabel}</Link></div></header>

    <section className={styles.filterPanel} aria-label="Invoice filters">
      <div className={styles.filterHeading}><span>Filter invoices{activeFilters > 0 && <b>{activeFilters}</b>}</span>{activeFilters > 0 && <button type="button" onClick={onClearFilters}><X size={13} aria-hidden="true" /> Clear filters</button>}</div>
      <div className={styles.filterGrid}>
        <label>Status<select aria-label="Filter transaction status" value={filters.status} onChange={(event) => onFilterChange('status', event.target.value)}><option value="ALL">All invoices</option><option value="PAID">Paid</option><option value="UNPAID">Unpaid / partial</option><option value="OVERDUE">Overdue</option><option value="DRAFT">Draft</option><option value="CANCELLED">Cancelled</option></select></label>
        <label>From date<input type="date" aria-label="From date" value={filters.from} max={filters.to || undefined} onChange={(event) => onFilterChange('from', event.target.value)} /></label>
        <label>To date<input type="date" aria-label="To date" value={filters.to} min={filters.from || undefined} onChange={(event) => onFilterChange('to', event.target.value)} /></label>
        <label>Firm<select aria-label="Filter firms" value={filters.firm} onChange={(event) => onFilterChange('firm', event.target.value)}><option value="ALL">All firms</option>{firms.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>User<select aria-label="Filter users" value={filters.user} onChange={(event) => onFilterChange('user', event.target.value)}><option value="ALL">All users</option>{users.filter((value) => value !== 'All Users').map((value) => <option key={value}>{value}</option>)}</select></label>
        <label className={styles.mobileCustomers}>Customer<select aria-label="Filter customers" value={filters.customer} onChange={(event) => onFilterChange('customer', event.target.value)}><option value="ALL">All customers</option>{customers.map(({ name }) => <option key={name}>{name}</option>)}</select></label>
      </div>
    </section>

    <section className={styles.metrics} aria-label="Invoice totals">
      <article><span className={styles.metricIcon}><IndianRupee size={21} aria-hidden="true" /></span><div><span>Sales total</span><strong data-invoice-total="sales">{loading ? '—' : formatCurrency(total)}</strong></div></article>
      <article><span className={`${styles.metricIcon} ${styles.greenIcon}`}><Wallet size={21} aria-hidden="true" /></span><div><span>Received</span><strong data-invoice-total="paid">{loading ? '—' : formatCurrency(paid)}</strong></div></article>
      <article><span className={`${styles.metricIcon} ${styles.amberIcon}`}><Clock3 size={21} aria-hidden="true" /></span><div><span>Balance due</span><strong data-invoice-total="balance">{loading ? '—' : formatCurrency(balance)}</strong></div></article>
    </section>

    <section className={styles.workspace} aria-label="Sale invoice register">
      <aside className={styles.customers} aria-labelledby="invoice-customers-heading"><header><span><Users size={15} aria-hidden="true" /><h2 id="invoice-customers-heading">Customers</h2></span><b>{customers.length}</b></header><div className={styles.customerSearch}><Search size={14} aria-hidden="true" /><input aria-label="Search invoice customers" placeholder="Find a customer..." value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} /></div><div className={styles.customerList}><button type="button" aria-pressed={filters.customer === 'ALL'} onClick={() => onFilterChange('customer', 'ALL')}><span>All customers</span><b>{recordCount}</b></button>{visibleCustomers.map(({ name, count }) => <button type="button" key={name} aria-pressed={filters.customer === name} onClick={() => onFilterChange('customer', filters.customer === name ? 'ALL' : name)} title={name}><span>{name}</span><b>{count}</b></button>)}{visibleCustomers.length === 0 && customerQuery && <p>No customers found.</p>}</div></aside>
      <div className={styles.register}>
        <div className={styles.registerHeading}><div><div className={styles.titleRow}><h2>Transactions</h2><span>{loading ? '—' : rows.length}</span></div><p>{filters.customer === 'ALL' ? 'All customer invoices' : filters.customer} · Totals reflect the selected filters</p></div></div>
        <div className={styles.toolbar}><div className={styles.search}><Search size={17} aria-hidden="true" /><input aria-label={'Search ' + title} placeholder="Search invoice or customer..." value={filters.query} onChange={(event) => onFilterChange('query', event.target.value)} />{filters.query && <button type="button" aria-label="Clear invoice search" onClick={() => onFilterChange('query', '')}><X size={14} aria-hidden="true" /></button>}</div><div className={styles.tools}><button type="button" className={styles.secondaryButton} disabled={loading || Boolean(error) || rows.length === 0} onClick={onExport} aria-label="Export transactions"><FileSpreadsheet size={16} aria-hidden="true" /><span>Export CSV</span></button><button type="button" className={styles.secondaryButton} onClick={() => window.print()} aria-label="Print register"><Printer size={16} aria-hidden="true" /><span>Print</span></button></div></div>

        {loading ? <div className={styles.state} role="status"><Loader2 size={25} className={styles.spin} aria-hidden="true" /><p>Loading sale invoices...</p></div> : error ? <div className={styles.state} role="alert"><CircleAlert size={26} aria-hidden="true" /><h3>Could not load invoices</h3><p>{error}</p><button type="button" className={styles.secondaryButton} onClick={onRetry}>Retry</button></div> : rows.length === 0 ? <div className={styles.state} role="status"><ReceiptText size={32} strokeWidth={1.5} aria-hidden="true" /><h3>{activeFilters ? 'No matching invoices' : 'Your first sale starts here'}</h3><p>{activeFilters ? 'Try another search or clear your filters.' : 'Create a sale invoice to record a customer transaction.'}</p>{activeFilters ? <button type="button" className={styles.secondaryButton} onClick={onClearFilters}>Clear filters</button> : <Link className={styles.primaryButton} href={createPath}><Plus size={16} aria-hidden="true" />{actionLabel}</Link>}</div> : <>
          <p className={styles.scrollHint}><ArrowRight size={13} aria-hidden="true" /> Scroll to see all columns and actions</p>
          <div className={styles.tableScroll} tabIndex={0} role="region" aria-label="Sale invoices table"><table className={styles.table}><caption className={styles.srOnly}>Sale invoices matching the selected filters</caption><colgroup>{[15, 18, 12, 13.5, 13.5, 13, 15].map((width, index) => <col key={index} style={{ width: `${width}%` }} />)}</colgroup><thead><tr>{COLUMNS.map(([label, key]) => <th key={key} scope="col" aria-sort={sort.key === key ? sort.asc ? 'ascending' : 'descending' : 'none'} className={key === 'total' || key === 'balance' ? styles.numeric : undefined}><button type="button" onClick={() => onSort(key)}>{label}{sort.key === key ? sort.asc ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" /> : <ArrowUpDown size={12} aria-hidden="true" />}</button></th>)}<th scope="col" className={styles.actionsHeading}>Actions</th></tr></thead><tbody>{rows.map((row) => {
            const label = statusLabel(row);
            const tone = row.status === 'CANCELLED' || row.status === 'DRAFT' ? 'muted' : !row.balance ? 'paid' : label.startsWith('Overdue') ? 'overdue' : Number(row.paid) > 0 ? 'partial' : 'unpaid';
            return <tr key={row.id}><td><Link className={styles.invoiceLink} href={`/invoices/${row.id}`}>{row.number}</Link><small className={styles.invoiceType}>Sale invoice</small></td><td>{row.partyId ? <Link className={styles.partyLink} href={`/parties/${row.partyId}`} title={row.party}>{row.party}</Link> : <span className={styles.partyLink}>{row.party}</span>}</td><td className={styles.date}>{formatDate(row.date)}</td><td className={styles.numeric}>{formatCurrency(row.total)}</td><td className={`${styles.numeric} ${row.balance > 0 ? styles.balance : styles.zeroBalance}`}>{formatCurrency(row.balance)}</td><td><span className={styles.badge} data-tone={tone}><i aria-hidden="true" />{label}</span></td><td><div className={styles.rowActions} data-row-actions>{renderActions(row)}</div></td></tr>;
          })}</tbody></table></div>
          <footer className={styles.footer}><span>Showing <strong>{rows.length}</strong> of <strong>{recordCount}</strong> invoices</span><span>Filtered balance <strong>{formatCurrency(balance)}</strong></span></footer>
        </>}
      </div>
    </section>
  </div>;
}
