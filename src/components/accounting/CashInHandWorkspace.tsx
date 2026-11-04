'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, Filter, Search, SlidersHorizontal, X } from 'lucide-react';
import Modal from '../Modal';
import Link from 'next/link';
import RowActions from '../RowActions';
import { EmptyState, ErrorState, LoadingState } from '../ContentState';
import { Popover } from '../PopoverMenu';
import { toast } from '../ToastProvider';
import { api, getApiError, getCurrentUser } from '@/lib/api';
import { localDate } from '@/lib/business-report';
import { subtractMoney, sumMoney } from '@/lib/billing';
import { compareCashTransactions } from '@/lib/cash-ledger';
import { formatCurrency, formatDate } from '@/lib/format';
import { LoanEmiFields, transactionDate, transactionType, useBankTransactionActions, useLoanAccounts, type BankTransaction } from './BankTransactionActions';

type Flow = 'ALL' | 'IN' | 'OUT';
type Filters = { types: string[]; name: string; from: string; to: string; flow: Flow };
const NO_FILTERS: Filters = { types: [], name: '', from: '', to: '', flow: 'ALL' };
/** Shown when an adjustment has no typed-in type. */
const DEFAULT_TYPES = ['Add Cash', 'Reduce Cash'];
const SUGGESTED_TYPES = ['Opening Cash', 'Owner Capital', 'Petty Cash', 'Owner Drawings', 'Cash Shortage', 'Cash Excess'];

/** Cash In Hand: the running cash balance, every cash movement, and Adjust Cash to add or reduce cash. */
export default function CashInHandWorkspace() {
  const [rows, setRows] = useState<BankTransaction[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [newestFirst, setNewestFirst] = useState(true);
  const [selected, setSelected] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const all: BankTransaction[] = [];
      let total = 0;
      for (let offset = 0; ; offset += 100) {
        const { data } = await api.get<{ rows: BankTransaction[]; balance: number }>('/cash/transactions', { params: { limit: 100, offset } });
        if (!Array.isArray(data.rows)) throw new Error('Invalid cash response');
        all.push(...data.rows);
        total = data.balance;
        if (data.rows.length < 100) break;
      }
      setRows(all); setBalance(total);
    } catch (failure) {
      setError(getApiError(failure, 'Could not load cash in hand.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void getCurrentUser().then((user) => {
      const role = user?.role ?? '';
      setCanWrite(['SUPER_ADMIN', 'OWNER', 'ACCOUNTANT'].includes(role));
      setIsOwner(['SUPER_ADMIN', 'OWNER'].includes(role));
    }).catch(() => undefined);
  }, [load]);
  useEffect(() => { if (searchOpen) searchRef.current?.focus(); }, [searchOpen]);

  const { actionsFor, dialogs } = useBankTransactionActions({ canWrite, isOwner, onChanged: () => void load() });

  const types = useMemo(() => [...new Set(rows.map(transactionType))].sort(), [rows]);
  // Types typed in on earlier adjustments, offered again in Adjust Cash.
  const adjustmentTypes = useMemo(() => [...new Set(rows.filter((row) => row.kind === 'CASH_ADJUSTMENT').map(transactionType))].filter((type) => !DEFAULT_TYPES.includes(type)).sort(), [rows]);
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    const name = filters.name.trim().toLowerCase();
    return rows
      .filter((row) => {
        const day = transactionDate(row).slice(0, 10);
        const amount = Number(row.amount);
        return (!query || [transactionType(row), row.name, row.number, row.reference, formatDate(day), String(Math.abs(amount))].some((value) => value?.toLowerCase().includes(query)))
          && (!filters.types.length || filters.types.includes(transactionType(row)))
          && (!name || row.name.toLowerCase().includes(name))
          && (!filters.from || day >= filters.from)
          && (!filters.to || day <= filters.to)
          && (filters.flow === 'ALL' || (filters.flow === 'IN' ? amount > 0 : amount < 0));
      })
      .sort((a, b) => compareCashTransactions(a, b, newestFirst));
  }, [rows, search, filters, newestFirst]);
  const filtered = visible.length !== rows.length;
  const shownIn = sumMoney(visible.filter((row) => Number(row.amount) > 0).map((row) => Number(row.amount)));
  const shownOut = sumMoney(visible.filter((row) => Number(row.amount) < 0).map((row) => -Number(row.amount)));

  return (
    <>
      <header className="reference-page-header !flex-wrap !gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h1>Cash In Hand</h1>
          <strong className={`text-lg ${balance < 0 ? 'text-rose-600' : 'text-emerald-600'}`} aria-label={`Cash in hand ${formatCurrency(balance)}`}>{formatCurrency(balance)}</strong>
        </div>
        {canWrite && (
          <button type="button" onClick={() => setAdjusting(true)} className="inline-flex items-center gap-2 rounded-full bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600">
            <SlidersHorizontal size={16} /> Adjust Cash
          </button>
        )}
      </header>

      <section className="reference-register min-w-0 max-w-full">
        <div className="reference-register-title">
          <h2>Transactions</h2>
          <div className="reference-register-tools">
            {searchOpen ? (
              <label className="relative">
                <Search size={16} className="absolute left-2 top-2 text-slate-400" />
                <input ref={searchRef} className="!pl-8 !pr-8" placeholder="Search transactions" aria-label="Search cash transactions" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') { setSearch(''); setSearchOpen(false); } }} />
                <button type="button" className="absolute right-2 top-2 text-slate-400 hover:text-slate-600" aria-label="Close search" onClick={() => { setSearch(''); setSearchOpen(false); }}><X size={16} /></button>
              </label>
            ) : (
              <button type="button" aria-label="Search transactions" onClick={() => setSearchOpen(true)}><Search size={20} /></button>
            )}
          </div>
        </div>

        {(filtered && !loading && !error) && (
          <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>{visible.length} of {rows.length} transactions</span>
            <span>In: <b className="text-emerald-600">{formatCurrency(shownIn)}</b></span>
            <span>Out: <b className="text-rose-600">{formatCurrency(shownOut)}</b></span>
            <button type="button" className="font-semibold text-blue-600" onClick={() => { setFilters(NO_FILTERS); setSearch(''); setSearchOpen(false); }}>Clear filters</button>
          </div>
        )}

        {loading ? <LoadingState label="Loading cash transactions..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
          <div className="reference-table-scroll relative max-w-full">
            <table className="cash-ledger">
              <thead>
                <tr>
                  <th style={{ width: '22%' }}>
                    <HeaderCell label="Type" active={filters.types.length > 0}>
                      {(close) => (
                        <FilterPanel onClear={() => { setFilters({ ...filters, types: [] }); close(); }}>
                          <div className="max-h-60 space-y-1 overflow-auto">
                            {types.map((type) => (
                              <label key={type} className="flex items-center gap-2 py-1 text-sm">
                                <input type="checkbox" checked={filters.types.includes(type)} onChange={(e) => setFilters({ ...filters, types: e.target.checked ? [...filters.types, type] : filters.types.filter((t) => t !== type) })} />
                                {type}
                              </label>
                            ))}
                            {!types.length && <p className="text-sm text-slate-500">No transactions yet.</p>}
                          </div>
                        </FilterPanel>
                      )}
                    </HeaderCell>
                  </th>
                  <th style={{ width: '32%' }}>
                    <HeaderCell label="Name" active={Boolean(filters.name.trim())}>
                      {(close) => (
                        <FilterPanel onClear={() => { setFilters({ ...filters, name: '' }); close(); }}>
                          <input className="input-field" placeholder="Name contains" aria-label="Filter by name" value={filters.name} onChange={(e) => setFilters({ ...filters, name: e.target.value })} />
                        </FilterPanel>
                      )}
                    </HeaderCell>
                  </th>
                  <th style={{ width: '18%' }}>
                    <HeaderCell
                      label="Date"
                      active={Boolean(filters.from || filters.to)}
                      sort={<button type="button" aria-label={newestFirst ? 'Sort oldest first' : 'Sort newest first'} title={newestFirst ? 'Newest first' : 'Oldest first'} onClick={() => setNewestFirst(!newestFirst)} className="text-slate-500 hover:text-slate-800">{newestFirst ? <ArrowDown size={13} /> : <ArrowUp size={13} />}</button>}
                    >
                      {(close) => (
                        <FilterPanel onClear={() => { setFilters({ ...filters, from: '', to: '' }); close(); }}>
                          <div className="grid gap-2">
                            <label className="text-xs text-slate-500">From<input type="date" className="input-field mt-1" value={filters.from} max={filters.to || undefined} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label>
                            <label className="text-xs text-slate-500">To<input type="date" className="input-field mt-1" value={filters.to} min={filters.from || undefined} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label>
                          </div>
                        </FilterPanel>
                      )}
                    </HeaderCell>
                  </th>
                  <th style={{ width: '20%' }}>
                    <HeaderCell label="Amount" active={filters.flow !== 'ALL'}>
                      {(close) => (
                        <FilterPanel onClear={() => { setFilters({ ...filters, flow: 'ALL' }); close(); }}>
                          {([['ALL', 'All'], ['IN', 'Money in'], ['OUT', 'Money out']] as const).map(([value, label]) => (
                            <label key={value} className="flex items-center gap-2 py-1 text-sm">
                              <input type="radio" name="cash-flow" checked={filters.flow === value} onChange={() => setFilters({ ...filters, flow: value })} />
                              {label}
                            </label>
                          ))}
                        </FilterPanel>
                      )}
                    </HeaderCell>
                  </th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const amount = Number(row.amount);
                  return (
                    <tr key={`${row.source ?? 'entry'}-${row.id}`} data-selected={selected === row.id || undefined} onClick={() => setSelected(row.id)} className="cursor-pointer">
                      <td>{transactionType(row)}</td>
                      <td title={row.name}>{row.name || '—'}</td>
                      <td>{formatDate(transactionDate(row))}</td>
                      <td className={`money ${amount < 0 ? 'reference-status-cancelled' : 'reference-status-paid'}`}>{formatCurrency(Math.abs(amount))}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <div data-row-actions className="reference-row-actions"><RowActions label={`Actions for ${transactionType(row)} ${row.name}`} actions={actionsFor(row)} /></div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && (
              <EmptyState icon={SlidersHorizontal} title={rows.length ? 'No matching transactions' : 'No cash transactions yet'} description={rows.length ? 'Try another search or clear your filters.' : 'Cash sales, cash payments, EMIs and cash adjustments will show here.'} />
            )}
          </div>
        )}
      </section>

      {adjusting && <AdjustCashModal balance={balance} usedTypes={adjustmentTypes} onClose={() => setAdjusting(false)} onSaved={() => { setAdjusting(false); setNewestFirst(true); void load(); }} />}
      {dialogs}
    </>
  );
}

function HeaderCell({ label, active, sort, children }: { label: string; active: boolean; sort?: ReactNode; children: (close: () => void) => ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5">{label}{sort ?? null}</span>
      <Popover label={`Filter ${label}`} align="right" trigger={() => <Filter size={13} className={active ? 'fill-blue-600 text-blue-600' : 'text-slate-500'} />}>
        {(close) => children(close)}
      </Popover>
    </div>
  );
}

function FilterPanel({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  return (
    <div className="w-60 p-3">
      {children}
      <div className="mt-3 flex justify-end border-t border-slate-100 pt-2">
        <button type="button" className="text-xs font-semibold text-blue-600" onClick={onClear}>Clear</button>
      </div>
    </div>
  );
}

/** Add cash brought in, or reduce cash taken out. Cash in hand can't go below zero. */
function AdjustCashModal({ balance, usedTypes, onClose, onSaved }: { balance: number; usedTypes: string[]; onClose: () => void; onSaved: () => void }) {
  const [direction, setDirection] = useState<'IN' | 'OUT'>('IN');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState('');
  const [loanId, setLoanId] = useState('');
  const [interest, setInterest] = useState('');
  const { loans, loaded: loansLoaded, error: loanLoadError, reload: reloadLoans } = useLoanAccounts();
  const loan = direction === 'OUT' ? loans.find((entry) => entry.id === loanId) : undefined;
  const suggestions = [...new Set([...usedTypes, ...SUGGESTED_TYPES])];
  const shownType = loan ? 'EMI Paid' : type.trim() || DEFAULT_TYPES[direction === 'IN' ? 0 : 1];
  const [date, setDate] = useState(localDate());
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const enteredAmount = Number(amount);
  const validAmount = Number.isFinite(enteredAmount) && enteredAmount >= 0.01 && enteredAmount <= 9999999999.99;
  const value = validAmount ? enteredAmount : 0;
  const interestAmount = Number(interest) || 0;
  const validInterest = Number.isFinite(interestAmount) && interestAmount >= 0 && interestAmount <= value;
  const principal = validInterest ? subtractMoney(value, interestAmount) : 0;
  const invalidLoan = direction === 'OUT' && Boolean(loanId) && (!loan || Boolean(loanLoadError) || !loansLoaded || !validInterest || principal > loan.balance || date < loan.openingDate.slice(0, 10));
  const after = sumMoney([balance, direction === 'IN' ? value : -value]);
  const tooMuch = direction === 'OUT' && after < 0;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || tooMuch || !validAmount || invalidLoan) return;
    submitting.current = true;
    setSaving(true); setError('');
    try {
      await api.post('/cash/adjustments', { requestId: requestId.current, direction, amount: value, date, type: loan ? undefined : type.trim() || undefined, reason: description.trim() || undefined, loanId: loan?.id, interest: loan ? interestAmount : undefined });
      toast.success(loan ? 'Loan repayment saved' : `${shownType} saved`, { description: loan ? `Cash reduced by ${formatCurrency(value)}. ${loan.name} loan balance reduced by ${formatCurrency(principal)}.` : `${direction === 'IN' ? 'Added' : 'Reduced'} ${formatCurrency(value)} · Cash in hand is now ${formatCurrency(after)}` });
      onSaved();
    } catch (failure) {
      setError(getApiError(failure, 'Could not adjust cash.'));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal title="Adjust Cash" onClose={() => { if (!saving) onClose(); }} size="md">
      <form onSubmit={submit} className="space-y-5">
        <fieldset disabled={saving} className="space-y-5">
          <div role="radiogroup" aria-label="Adjustment" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {([['IN', 'Add Cash', ArrowDown], ['OUT', 'Reduce Cash', ArrowUp]] as const).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={direction === value}
                onClick={() => { setDirection(value); setLoanId(''); setInterest(''); }}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${direction === value ? (value === 'IN' ? 'bg-white text-emerald-700 shadow-sm' : 'bg-white text-rose-700 shadow-sm') : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Icon size={15} /> {label}
              </button>
            ))}
          </div>
          {!loan && <label className="block">
            <span className="label">Type</span>
            <input className="input-field" list="adjust-cash-types" maxLength={60} placeholder={DEFAULT_TYPES[direction === 'IN' ? 0 : 1]} value={type} onChange={(e) => setType(e.target.value)} />
            <datalist id="adjust-cash-types">{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>
            <span className="mt-1 block text-xs text-slate-500">Type your own or pick one. Shown in Transactions as <b className="text-slate-700">{shownType}</b>.</span>
          </label>}
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="block"><span className="label">Enter Amount *</span><input aria-label="Cash adjustment amount" className="input-field" type="number" inputMode="decimal" required min={0.01} max={9999999999.99} step="0.01" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
            <label className="block"><span className="label">Adjustment Date *</span><input className="input-field" type="date" required value={date} onChange={(e) => setDate(e.target.value)} /></label>
          </div>
          {direction === 'OUT' && (
            <section className="space-y-3 rounded-xl border border-slate-200 p-3">
              <h3 className="text-sm font-semibold text-slate-800">Loan repayment (optional)</h3>
              {!loansLoaded ? <p className="text-xs text-slate-500">Loading loan accounts...</p> : loanLoadError ? <p role="alert" className="text-sm text-red-600">{loanLoadError} <button type="button" className="font-semibold underline" onClick={reloadLoans}>Retry</button></p> : loans.length ? <LoanEmiFields loans={loans} loanId={loanId} onLoanChange={setLoanId} interest={interest} onInterestChange={setInterest} amount={value} /> : <p className="text-xs text-slate-500">Add a loan in <Link href="/cash-banks/loans" className="font-semibold text-blue-700">Loan Accounts</Link> to record a repayment here.</p>}
              {loan && <p className="text-xs text-slate-500">Saving records one EMI in both Cash In Hand and Loan Accounts. Interest is included in the cash amount; only principal reduces the loan balance.</p>}
              {invalidLoan && loan && <p role="alert" className="text-sm text-red-600">{!validInterest ? 'Interest must be between zero and the total cash amount.' : principal > loan.balance ? 'The principal cannot exceed the loan balance.' : 'The payment date cannot be before the loan opening date.'}</p>}
            </section>
          )}
          <label className="block"><span className="label">Description</span><input className="input-field" maxLength={500} placeholder={direction === 'IN' ? 'e.g. Cash brought from home' : 'e.g. Tea and courier charges'} value={description} onChange={(e) => setDescription(e.target.value)} /></label>
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <div><dt className="text-xs text-slate-500">Cash in hand now</dt><dd className="mt-0.5 font-semibold text-slate-800">{formatCurrency(balance)}</dd></div>
            <div><dt className="text-xs text-slate-500">After this adjustment</dt><dd className={`mt-0.5 font-semibold ${after < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(after)}</dd></div>
          </dl>
          {tooMuch && <p role="alert" className="text-sm text-rose-600">You can reduce at most {formatCurrency(Math.max(balance, 0))}. Cash in hand can&apos;t go below zero.</p>}
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <footer className="reference-form-footer">
          <button type="button" disabled={saving} className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || tooMuch || !validAmount || invalidLoan} className="btn-primary">{saving ? 'Saving...' : loan ? 'Save loan repayment' : 'Save'}</button>
        </footer>
      </form>
    </Modal>
  );
}

