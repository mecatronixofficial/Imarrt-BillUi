'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, Copy, Eye, EyeOff } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import Modal from '../Modal';
import RowActions, { type RowAction } from '../RowActions';
import { toast } from '../ToastProvider';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { subtractMoney } from '@/lib/billing';

/** A row of /accounts/:id/transactions, /cash/transactions or /incomes. */
export type BankTransaction = {
  id: string;
  source?: 'PAYMENT_IN' | 'PAYMENT_OUT' | 'EXPENSE' | 'ENTRY';
  kind?: string;
  type?: string;
  name: string;
  date?: string;
  entryDate?: string;
  createdAt?: string;
  amount: string | number;
  reference?: string | null;
  notes?: string | null;
  method?: string;
  sourceId?: string | null;
  referenceId?: string | null;
  receiptId?: string | null;
  number?: string;
  category?: string;
  editable?: boolean;
  loanId?: string;
  paymentId?: string;
  principal?: string | number;
  interest?: string | number;
};

export type BankAccountSummaryData = {
  id: string;
  bankName: string;
  accountHolder: string;
  accountNumber: string;
  ifsc: string;
  upiId?: string;
  branch?: string;
  accountType?: string;
  primary?: boolean;
};

const EDITABLE_ENTRIES = ['TRANSFER_IN', 'TRANSFER_OUT', 'OTHER_INCOME', 'CASH_ADJUSTMENT'];
const ACCOUNT_TYPES: Record<string, string> = { CURRENT: 'Current account', SAVINGS: 'Savings account', CASH_CREDIT: 'Cash credit', OVERDRAFT: 'Overdraft' };
const METHODS: Record<string, string> = { cash: 'Cash', upi: 'UPI', cheque: 'Cheque', bank_transfer: 'Bank transfer', card: 'Card', other: 'Other' };

function sourceOf(row: BankTransaction) { return row.source ?? (row.kind ? 'ENTRY' : undefined); }
function editableEntry(row: BankTransaction) { return sourceOf(row) === 'ENTRY' && (row.editable ?? EDITABLE_ENTRIES.includes(row.kind ?? '')); }
export function transactionDate(row: BankTransaction) { return row.date || row.entryDate || ''; }
export function transactionType(row: BankTransaction) { return row.type || row.kind?.replaceAll('_', ' ') || 'Other Income'; }

type Confirm = { title: string; message: string; confirmLabel: string; busyLabel: string; run: () => Promise<void> };

/** The ⋮ menu for a bank or cash transaction: view, open the source, edit, void or delete. */
export function useBankTransactionActions({ canWrite, isOwner, onChanged, onMakeLoanPayment }: { canWrite: boolean; isOwner: boolean; onChanged: () => void; onMakeLoanPayment?: (loanId: string) => void }) {
  const [detail, setDetail] = useState<BankTransaction | null>(null);
  const [editing, setEditing] = useState<BankTransaction | null>(null);
  const [form, setForm] = useState({ amount: '', date: '', name: '', notes: '', direction: 'IN' as 'IN' | 'OUT' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState<BankTransaction | null>(null);

  function openEdit(row: BankTransaction) {
    setForm({ amount: String(Math.abs(Number(row.amount))), date: transactionDate(row).slice(0, 10), name: row.kind === 'CASH_ADJUSTMENT' && row.type && !['Add Cash', 'Reduce Cash'].includes(row.type) ? row.type : '', notes: row.notes ?? '', direction: Number(row.amount) < 0 ? 'OUT' : 'IN' });
    setFormError('');
    setEditing(row);
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true); setFormError('');
    try {
      await api.patch(`/finance-entries/${editing.id}`, {
        amount: Number(form.amount),
        date: form.date,
        notes: form.notes.trim() || undefined,
        ...(editing.kind === 'CASH_ADJUSTMENT' ? { name: form.name.trim(), direction: form.direction } : {}),
      });
      toast.success('Transaction updated', { description: editing.kind?.startsWith('TRANSFER') ? 'Both accounts of this transfer were updated.' : undefined });
      setEditing(null);
      onChanged();
    } catch (failure) {
      setFormError(getApiError(failure, 'Could not update this transaction.'));
    } finally {
      setSaving(false);
    }
  }

  function ask(next: Confirm) { setConfirm(next); }

  async function runConfirm() {
    if (!confirm || busy) return;
    setBusy(true);
    try {
      await confirm.run();
      setConfirm(null);
      onChanged();
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not complete this action.'));
    } finally {
      setBusy(false);
    }
  }

  function voidPaymentOut(row: BankTransaction) {
    const receiptId = row.receiptId!;
    ask({
      title: 'Void this payment?',
      message: `${formatCurrency(Math.abs(Number(row.amount)))} paid to ${row.name || 'the supplier'} will stop counting toward the bill and this account. You can undo it.`,
      confirmLabel: 'Void payment', busyLabel: 'Voiding...',
      run: async () => {
        await api.post(`/payment-out/${receiptId}/void`, {});
        toast.success('Payment voided', {
          duration: 8000,
          action: { label: 'Undo', onClick: () => void api.post(`/payment-out/${receiptId}/restore`).then(() => { toast.success('Payment restored'); onChanged(); }).catch((failure) => toast.error(getApiError(failure, 'Could not restore the payment.'))) },
        });
      },
    });
  }

  function actionsFor(row: BankTransaction): Array<RowAction | false | null | undefined> {
    const source = sourceOf(row);
    const entry = editableEntry(row);
    const amount = formatCurrency(Math.abs(Number(row.amount)));
    return [
      { label: 'View details', icon: 'view', onClick: () => setDetail(row) },
      source === 'PAYMENT_IN' && !!row.sourceId && { label: 'Open invoice', icon: 'view', href: `/invoices/${row.sourceId}` },
      source === 'PAYMENT_OUT' && !!row.sourceId && { label: 'Open purchase bill', icon: 'view', href: `/documents/${row.sourceId}` },
      source === 'PAYMENT_OUT' && { label: 'Open in Payment-Out', icon: 'payment', href: '/purchases/payment-out' },
      source === 'EXPENSE' && { label: 'Open in Expenses', icon: 'view', href: '/purchases/expenses' },
      source === 'ENTRY' && row.kind?.startsWith('LOAN') && !row.loanId && { label: 'Open loan account', icon: 'view', href: '/cash-banks/loans' },
      canWrite && row.kind === 'LOAN_OPENING' && Boolean(row.loanId) && Boolean(onMakeLoanPayment) && { label: 'Make payment', icon: 'payment', onClick: () => onMakeLoanPayment?.(row.loanId!) },
      canWrite && entry && { label: 'Edit', icon: 'edit', onClick: () => openEdit(row) },
      canWrite && source === 'PAYMENT_OUT' && !!row.receiptId && { label: 'Void payment', icon: 'cancel', danger: true, onClick: () => voidPaymentOut(row) },
      canWrite && source === 'EXPENSE' && {
        label: 'Cancel expense', icon: 'cancel', danger: true,
        onClick: () => ask({ title: 'Cancel this expense?', message: `${row.name} (${amount}) will be marked cancelled and removed from this account's balance. This cannot be undone.`, confirmLabel: 'Cancel expense', busyLabel: 'Cancelling...', run: async () => { await api.post(`/expenses/${row.id}/cancel`); toast.success('Expense cancelled'); } }),
      },
      isOwner && source === 'PAYMENT_IN' && {
        label: 'Delete payment', icon: 'delete', danger: true,
        onClick: () => ask({ title: 'Delete this payment?', message: `${amount} received from ${row.name}${row.number ? ` on ${row.number}` : ''} will be removed and the invoice balance goes back up. This cannot be undone.`, confirmLabel: 'Delete payment', busyLabel: 'Deleting...', run: async () => { await api.delete(`/invoices/payments/${row.id}`); toast.success('Payment deleted'); } }),
      },
      isOwner && source === 'PAYMENT_OUT' && !!row.receiptId && {
        label: 'Delete payment', icon: 'delete', danger: true,
        onClick: () => ask({ title: 'Delete this payment?', message: `The whole Payment-Out receipt for ${row.name || 'this supplier'} is deleted, including any other bills it paid. This cannot be undone. Void it instead if you may need it back.`, confirmLabel: 'Delete payment', busyLabel: 'Deleting...', run: async () => { await api.delete(`/payment-out/${row.receiptId}`); toast.success('Payment deleted'); } }),
      },
      canWrite && row.kind === 'CASH_ADJUSTMENT' && Number(row.amount) < 0 && { label: 'Link to loan account (EMI)', icon: 'convert', onClick: () => setLinking(row) },
      isOwner && row.kind === 'LOAN_PAYMENT' && {
        label: 'Delete EMI payment', icon: 'delete', danger: true,
        onClick: () => ask({ title: 'Delete this EMI payment?', message: `The ${amount} EMI paid on ${formatDate(transactionDate(row))} is removed from ${row.name}'s loan account and the cash/bank ledger. Both balances are updated. This cannot be undone.`, confirmLabel: 'Delete EMI', busyLabel: 'Deleting...', run: async () => { await api.delete(row.loanId && row.paymentId ? `/loans/${row.loanId}/payments/${row.paymentId}` : `/finance-entries/${row.id}`); toast.success('EMI payment deleted', { description: `${row.name} loan balance updated` }); } }),
      },
      isOwner && entry && {
        label: 'Delete', icon: 'delete', danger: true,
        onClick: () => ask({ title: 'Delete this transaction?', message: `${transactionType(row)} of ${amount} on ${formatDate(transactionDate(row))} will be removed${row.kind?.startsWith('TRANSFER') ? ' from both accounts of the transfer' : ''}. This cannot be undone.`, confirmLabel: 'Delete', busyLabel: 'Deleting...', run: async () => { await api.delete(`/finance-entries/${row.id}`); toast.success('Transaction deleted'); } }),
      },
    ];
  }

  const dialogs = (
    <>
      {linking && <LinkLoanModal row={linking} onClose={() => setLinking(null)} onSaved={() => { setLinking(null); onChanged(); }} />}
      {detail && (
        <Modal title={transactionType(detail)} onClose={() => setDetail(null)} size="lg">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Name">{detail.name || '—'}</Fact>
            <Fact label="Date">{formatDate(transactionDate(detail))}</Fact>
            <Fact label="Amount"><span className={detail.kind === 'LOAN_OPENING' ? 'text-black' : Number(detail.amount) < 0 ? 'font-semibold text-rose-600' : 'font-semibold text-emerald-600'}>{Number(detail.amount) < 0 ? '- ' : '+ '}{formatCurrency(Math.abs(Number(detail.amount)))}</span></Fact>
            {detail.principal !== undefined && <Fact label="Principal">{formatCurrency(detail.principal)}</Fact>}
            {detail.interest !== undefined && <Fact label="Interest & other charges">{formatCurrency(detail.interest)}</Fact>}
            {detail.number && <Fact label={sourceOf(detail) === 'PAYMENT_IN' ? 'Invoice' : 'Bill'}>{detail.number}</Fact>}
            {detail.method && <Fact label="Payment type">{METHODS[detail.method] ?? detail.method}</Fact>}
            {detail.category && <Fact label="Category">{detail.category}</Fact>}
            {detail.reference && detail.reference !== detail.notes && <Fact label="Reference">{detail.reference}</Fact>}
            {detail.notes && detail.notes !== detail.name && <Fact label="Description">{detail.notes}</Fact>}
          </dl>
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit ${transactionType(editing).toLowerCase()}`} onClose={() => { if (!saving) setEditing(null); }} size="lg">
          <form onSubmit={saveEdit} className="space-y-5">
            <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
              {editing.kind === 'CASH_ADJUSTMENT' && (
                <div role="radiogroup" aria-label="Adjustment" className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1 sm:col-span-2">
                  {([['IN', 'Add Cash'], ['OUT', 'Reduce Cash']] as const).map(([value, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={form.direction === value} onClick={() => setForm({ ...form, direction: value })} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${form.direction === value ? `bg-white shadow-sm ${value === 'IN' ? 'text-emerald-700' : 'text-rose-700'}` : 'text-slate-500 hover:text-slate-700'}`}>{label}</button>
                  ))}
                </div>
              )}
              <label className="block"><span className="label">Amount *</span><input className="input-field" type="number" required min={0.01} step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
              <label className="block"><span className="label">Date *</span><input className="input-field" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
              {editing.kind === 'CASH_ADJUSTMENT' && (
                <label className="block sm:col-span-2"><span className="label">Type</span><input className="input-field" maxLength={60} placeholder={form.direction === 'IN' ? 'Add Cash' : 'Reduce Cash'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              )}
              <label className="block sm:col-span-2"><span className="label">Description</span><input className="input-field" maxLength={editing.kind === 'CASH_ADJUSTMENT' ? 500 : 2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
              {editing.kind?.startsWith('TRANSFER') && <p className="text-xs text-slate-500 sm:col-span-2">The other account in this transfer is updated with the same amount and date.</p>}
            </fieldset>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <footer className="reference-form-footer">
              <button type="button" disabled={saving} className="btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving...' : 'Save'}</button>
            </footer>
          </form>
        </Modal>
      )}
      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          busyLabel={confirm.busyLabel}
          busy={busy}
          onCancel={() => { if (!busy) setConfirm(null); }}
          onConfirm={() => void runConfirm()}
        />
      )}
    </>
  );

  return { actionsFor, dialogs };
}

export type LoanAccount = { id: string; name: string; principal: string | number; openingDate: string; balance: number };

/** Loan accounts in this company and branch, for picking the loan an EMI belongs to. */
export function useLoanAccounts() {
  const [loans, setLoans] = useState<LoanAccount[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoaded(false); setError('');
    void getAllPages<LoanAccount>('/loans').then(({ data }) => { if (active) setLoans(data); }).catch((failure) => { if (active) setError(getApiError(failure, 'Could not load loan accounts.')); }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, [version]);
  return { loans, loaded, error, reload: () => setVersion((value) => value + 1) };
}

/** The loan picker and principal/interest split shared by Adjust Cash and "Link to loan account". */
export function LoanEmiFields({ loans, loanId, onLoanChange, interest, onInterestChange, amount }: { loans: LoanAccount[]; loanId: string; onLoanChange: (id: string) => void; interest: string; onInterestChange: (value: string) => void; amount: number }) {
  const loan = loans.find(({ id }) => id === loanId);
  const interestAmount = Number(interest) || 0;
  const principal = Math.max(0, subtractMoney(amount, Number.isFinite(interestAmount) && interestAmount >= 0 && interestAmount <= amount ? interestAmount : 0));
  return (
    <>
      <label className="block">
        <span className="label">Loan account (EMI paid)</span>
        <select aria-label="Loan account" className="input-field" value={loanId} onChange={(e) => onLoanChange(e.target.value)}>
          <option value="">Not a loan payment</option>
          {loans.map((option) => <option key={option.id} value={option.id}>{option.name} · balance {formatCurrency(option.balance)}</option>)}
        </select>
      </label>
      {loan && (
        <>
          <label className="block">
            <span className="label">Interest included</span>
            <input aria-label="Interest included" className="input-field" type="number" min={0} step="0.01" max={amount} value={interest} onChange={(e) => onInterestChange(e.target.value)} placeholder="0" />
          </label>
          <dl className="grid grid-cols-3 gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3 text-sm sm:col-span-2">
            <div><dt className="text-xs text-slate-500">Principal</dt><dd className="mt-0.5 font-semibold text-slate-800">{formatCurrency(principal)}</dd></div>
            <div><dt className="text-xs text-slate-500">{loan.name} balance</dt><dd className="mt-0.5 font-semibold text-slate-800">{formatCurrency(loan.balance)}</dd></div>
            <div><dt className="text-xs text-slate-500">Balance after</dt><dd className={`mt-0.5 font-semibold ${principal > loan.balance ? 'text-rose-600' : 'text-emerald-600'}`}>{formatCurrency(subtractMoney(loan.balance, principal))}</dd></div>
          </dl>
        </>
      )}
    </>
  );
}

/** Turns a "Reduce Cash" entry into an EMI on a loan account; cash stays the same and the loan balance drops. */
function LinkLoanModal({ row, onClose, onSaved }: { row: BankTransaction; onClose: () => void; onSaved: () => void }) {
  const { loans, loaded } = useLoanAccounts();
  const typed = transactionType(row).trim().toLowerCase();
  const [loanId, setLoanId] = useState('');
  const [interest, setInterest] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const amount = Math.abs(Number(row.amount));
  // Pre-select the loan whose name was typed in as the type, e.g. "Siva".
  const chosen = loanId || loans.find(({ name }) => name.trim().toLowerCase() === typed)?.id || '';
  const loan = loans.find(({ id }) => id === chosen);
  const principal = amount - (Number(interest) || 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !loan) return;
    setSaving(true); setError('');
    try {
      await api.post(`/finance-entries/${row.id}/loan-payment`, { loanId: loan.id, interest: Number(interest) || 0 });
      toast.success('Linked to loan account', { description: `${formatCurrency(principal)} off the ${loan.name} loan balance` });
      onSaved();
    } catch (failure) {
      setError(getApiError(failure, 'Could not link this payment to the loan.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Link to loan account" onClose={() => { if (!saving) onClose(); }} size="lg">
      <form onSubmit={submit} className="space-y-5">
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          <b>{transactionType(row)}</b> · {formatCurrency(amount)} on {formatDate(transactionDate(row))}. It becomes an <b>EMI Paid</b> on the loan. Cash in hand stays the same; the loan balance goes down by the principal.
        </p>
        {!loaded ? <p className="text-sm text-slate-500">Loading loan accounts...</p> : loans.length ? (
          <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
            <LoanEmiFields loans={loans} loanId={chosen} onLoanChange={setLoanId} interest={interest} onInterestChange={setInterest} amount={amount} />
          </fieldset>
        ) : (
          <p className="text-sm text-slate-600">No loan accounts yet. Add one in <Link className="font-semibold text-blue-600" href="/cash-banks/loans">Loan Accounts</Link> first.</p>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <footer className="reference-form-footer">
          <button type="button" disabled={saving} className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !loan || principal < 0 || principal > (loan?.balance ?? 0)} className="btn-primary">{saving ? 'Linking...' : 'Link to loan'}</button>
        </footer>
      </form>
    </Modal>
  );
}

/** The selected bank's details at the top of the Banks page. */
export function BankAccountSummary({ account, balance, actions, children }: { account: BankAccountSummaryData; balance: number; actions: Array<RowAction | false | null | undefined>; children?: ReactNode }) {
  const [hidden, setHidden] = useState(false);
  // Collapsed by default: only the bank name shows until the dropdown is opened.
  const [open, setOpen] = useState(false);
  const number = hidden ? `•••• ${account.accountNumber.slice(-4)}` : account.accountNumber;
  const detailsId = `bank-details-${account.id}`;
  return (
    <div className="reference-master-info" style={open ? undefined : { minHeight: 0 }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          className="flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left hover:bg-slate-50"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen(!open)}
        >
          <h2 className="truncate">{account.bankName}{account.primary && <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">Primary</span>}</h2>
          <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          <span className="sr-only">{open ? 'Hide bank details' : 'Show bank details'}</span>
        </button>
        <div className="flex items-center gap-3">
          {children}
          <RowActions label={`More actions for ${account.bankName}`} actions={actions} />
        </div>
      </div>
      {open && <>
      <p className="mt-1 truncate text-xs text-slate-500">{[account.accountHolder, account.accountType && ACCOUNT_TYPES[account.accountType]].filter(Boolean).join(' · ')}</p>
      <dl id={detailsId} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Tile label="Bank Name">{account.bankName}</Tile>
        <Tile label="Account Number">
          <span className="font-mono tracking-wide">{number}</span>
          <button type="button" className="ml-2 text-slate-400 hover:text-blue-600" aria-label={hidden ? 'Show account number' : 'Hide account number'} onClick={() => setHidden(!hidden)}>{hidden ? <Eye size={14} /> : <EyeOff size={14} />}</button>
          <CopyButton value={account.accountNumber} label="account number" />
        </Tile>
        <Tile label="IFSC Code"><span className="font-mono tracking-wide">{account.ifsc || '—'}</span>{account.ifsc && <CopyButton value={account.ifsc} label="IFSC code" />}</Tile>
        <Tile label="Branch">{account.branch || '—'}</Tile>
        <Tile label="UPI ID">{account.upiId || '—'}{account.upiId && <CopyButton value={account.upiId} label="UPI ID" />}</Tile>
        <Tile label="Current Balance"><span className={balance < 0 ? 'font-bold text-rose-600' : 'font-bold text-emerald-600'}>{formatCurrency(balance)}</span></Tile>
      </dl>
      </>}
    </div>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  return (
    <button
      type="button"
      className="ml-2 text-slate-400 hover:text-blue-600"
      aria-label={`Copy ${label}`}
      onClick={() => void navigator.clipboard?.writeText(value).then(() => toast.success(`Copied ${label}`), () => toast.error(`Could not copy the ${label}.`))}
    >
      <Copy size={14} />
    </button>
  );
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 flex items-center truncate text-sm font-semibold text-slate-800">{children}</dd>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{children}</dd>
    </div>
  );
}
