'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { Landmark, RotateCcw, Search } from 'lucide-react';
import ConfirmDialog from '../ConfirmDialog';
import Modal from '../Modal';
import RowActions, { type RowAction } from '../RowActions';
import { EmptyState, ErrorState, LoadingState } from '../ContentState';
import { toast } from '../ToastProvider';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';

type Account = { id: string; bankName: string; accountNumber: string };
type ChequeEvent = { id: string; action: string; createdAt: string; accountId?: string | null };
type Cheque = {
  id: string;
  name: string;
  reference?: string | null;
  date: string;
  amount: string;
  accountId?: string | null;
  bankName?: string | null;
  invoiceId: string;
  invoiceNumber: string;
  invoiceStatus?: string;
  history: ChequeEvent[];
};
type Status = 'ALL' | 'OPEN' | 'DEPOSITED';

/** Cheques received against invoices: deposit them into a bank, re-open them, and see what happened to each. */
export default function ChequeRegister() {
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canWrite, setCanWrite] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [status, setStatus] = useState<Status>('ALL');
  const [search, setSearch] = useState('');
  const [depositing, setDepositing] = useState<Cheque | null>(null);
  const [reopening, setReopening] = useState<Cheque | null>(null);
  const [deleting, setDeleting] = useState<Cheque | null>(null);
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<Cheque | null>(null);
  const [history, setHistory] = useState<Cheque | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [chequeRes, accountRes] = await Promise.all([getAllPages<Cheque>('/cheques'), getAllPages<Account>('/accounts')]);
      setCheques(chequeRes.data); setAccounts(accountRes.data);
    } catch (failure) {
      setError(getApiError(failure, 'Could not load cheques.'));
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

  const bankName = (id?: string | null) => accounts.find((account) => account.id === id)?.bankName ?? 'a bank account';
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cheques.filter((cheque) =>
      (status === 'ALL' || (status === 'OPEN' ? !cheque.accountId : Boolean(cheque.accountId)))
      && (!query || [cheque.name, cheque.reference, cheque.invoiceNumber, cheque.bankName, String(Number(cheque.amount))].some((value) => value?.toLowerCase().includes(query))));
  }, [cheques, status, search]);
  const openTotal = cheques.filter((cheque) => !cheque.accountId).reduce((sum, cheque) => sum + Number(cheque.amount), 0);
  const depositedTotal = cheques.filter((cheque) => cheque.accountId).reduce((sum, cheque) => sum + Number(cheque.amount), 0);

  async function reopen() {
    if (!reopening || busy) return;
    setBusy(true);
    try {
      await api.post(`/cheques/${reopening.id}/actions`, { action: 'REOPEN', requestId: crypto.randomUUID() });
      toast.success('Cheque re-opened', { description: `${formatCurrency(reopening.amount)} removed from ${reopening.bankName ?? 'the bank'}` });
      setReopening(null);
      await load();
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not re-open this cheque.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!deleting || busy) return;
    setBusy(true);
    try {
      await api.delete(`/invoices/payments/${deleting.id}`);
      toast.success('Cheque payment deleted', { description: `${deleting.invoiceNumber} balance is back up by ${formatCurrency(deleting.amount)}` });
      setDeleting(null);
      await load();
    } catch (failure) {
      toast.error(getApiError(failure, 'Could not delete this cheque payment.'));
    } finally {
      setBusy(false);
    }
  }

  function actionsFor(cheque: Cheque): Array<RowAction | false> {
    const live = cheque.invoiceStatus !== 'CANCELLED' && cheque.invoiceStatus !== 'DRAFT';
    return [
      { label: 'View details', icon: 'view', onClick: () => setDetail(cheque) },
      { label: `Open invoice ${cheque.invoiceNumber}`, icon: 'view', href: `/invoices/${cheque.invoiceId}` },
      { label: 'View history', icon: 'restore', onClick: () => setHistory(cheque) },
      canWrite && live && !cheque.accountId && { label: 'Deposit to bank', icon: 'payment', onClick: () => setDepositing(cheque) },
      canWrite && live && Boolean(cheque.accountId) && { label: 'Re-open cheque', icon: 'undo', onClick: () => setReopening(cheque) },
      isOwner && !cheque.history.length && { label: 'Delete payment', icon: 'delete', danger: true, onClick: () => setDeleting(cheque) },
    ];
  }

  return (
    <>
      <header className="reference-page-header">
        <div className="flex min-w-0 items-center gap-2"><h1>Cheque Details</h1></div>
      </header>

      <div className="reference-filters">
        <span>Filter by :</span>
        <select aria-label="Filter cheques by status" value={status} onChange={(e) => setStatus(e.target.value as Status)}>
          <option value="ALL">All cheques</option>
          <option value="OPEN">Open (not deposited)</option>
          <option value="DEPOSITED">Deposited</option>
        </select>
        <span className="ml-auto text-xs text-slate-500">
          Open: <b className="text-amber-600">{formatCurrency(openTotal)}</b>
          <span className="mx-2">|</span>
          Deposited: <b className="text-emerald-600">{formatCurrency(depositedTotal)}</b>
        </span>
      </div>

      <section className="reference-register">
        <div className="reference-register-title">
          <h2>Transactions</h2>
          <div className="reference-register-tools">
            <label className="relative">
              <Search size={16} className="absolute left-2 top-2 text-slate-400" />
              <input className="!pl-8" placeholder="Search cheques" aria-label="Search cheques" value={search} onChange={(e) => setSearch(e.target.value)} />
            </label>
          </div>
        </div>
        {loading ? <LoadingState label="Loading cheques..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : (
          <div className="reference-table-scroll">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '11%' }}>Type</th>
                  <th style={{ width: '19%' }}>Name</th>
                  <th style={{ width: '13%' }}>Ref No.</th>
                  <th style={{ width: '13%' }}>Transaction Date</th>
                  <th style={{ width: '13%' }}>Amount</th>
                  <th style={{ width: '17%' }}>Status</th>
                  <th style={{ width: 160 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((cheque) => {
                  const live = cheque.invoiceStatus !== 'CANCELLED' && cheque.invoiceStatus !== 'DRAFT';
                  return (
                    <tr key={cheque.id}>
                      <td>Payment-In</td>
                      <td title={cheque.name}>{cheque.name}</td>
                      <td>{cheque.reference || '—'}</td>
                      <td>{formatDate(cheque.date)}</td>
                      <td className="money">{formatCurrency(cheque.amount)}</td>
                      <td className={cheque.accountId ? 'reference-status-paid' : 'reference-status-open'} title={cheque.accountId ? `Deposited to ${cheque.bankName}` : 'Received, not deposited'}>
                        {cheque.accountId ? `Deposited to ${cheque.bankName}` : 'Open'}
                      </td>
                      <td>
                        <div data-row-actions className="reference-row-actions">
                          {canWrite && live && (cheque.accountId
                            ? <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline" onClick={() => setReopening(cheque)}><RotateCcw size={13} /> Re-Open</button>
                            : <button type="button" className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => setDepositing(cheque)}><Landmark size={13} /> Deposit</button>)}
                          <RowActions label={`Actions for cheque ${cheque.reference || cheque.invoiceNumber}`} actions={actionsFor(cheque)} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!visible.length && (
              <EmptyState icon={Landmark} title={cheques.length ? 'No matching cheques' : 'No cheque payments recorded'} description={cheques.length ? 'Try another search or status.' : 'Cheques received on invoices (Payment-In with payment type Cheque) show here.'} />
            )}
          </div>
        )}
      </section>

      {depositing && <DepositModal cheque={depositing} accounts={accounts} onClose={() => setDepositing(null)} onSaved={() => { setDepositing(null); void load(); }} />}
      {reopening && (
        <ConfirmDialog
          title="Re-open this cheque?"
          message={`${formatCurrency(reopening.amount)} from ${reopening.name} comes out of ${reopening.bankName ?? 'the bank'} and the cheque goes back to Open. The invoice payment stays recorded.`}
          confirmLabel="Re-open cheque" busyLabel="Re-opening..." busy={busy}
          onCancel={() => { if (!busy) setReopening(null); }} onConfirm={() => void reopen()}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete this cheque payment?"
          message={`${formatCurrency(deleting.amount)} from ${deleting.name} is removed from ${deleting.invoiceNumber}, and the invoice balance goes back up. This cannot be undone.`}
          confirmLabel="Delete payment" busy={busy}
          onCancel={() => { if (!busy) setDeleting(null); }} onConfirm={() => void remove()}
        />
      )}
      {detail && (
        <Modal title="Cheque details" onClose={() => setDetail(null)} size="lg">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Fact label="Received from">{detail.name}</Fact>
            <Fact label="Amount"><b>{formatCurrency(detail.amount)}</b></Fact>
            <Fact label="Cheque / Ref No.">{detail.reference || '—'}</Fact>
            <Fact label="Received on">{formatDate(detail.date)}</Fact>
            <Fact label="Invoice">{detail.invoiceNumber}</Fact>
            <Fact label="Status">{detail.accountId ? `Deposited to ${detail.bankName}` : 'Open (not deposited)'}</Fact>
          </dl>
        </Modal>
      )}
      {history && (
        <Modal title="Cheque history" onClose={() => setHistory(null)} size="lg">
          <p className="mb-4 text-sm text-slate-500">{history.name} · {history.reference || 'No ref no.'} · {formatCurrency(history.amount)}</p>
          <ol className="divide-y divide-slate-100">
            <li className="py-3 text-sm"><b>Received</b> on {history.invoiceNumber} · {formatDate(history.date)}</li>
            {[...history.history].reverse().map((event) => (
              <li key={event.id} className="py-3 text-sm">
                <b>{event.action === 'DEPOSIT' ? 'Deposited' : 'Re-opened'}</b>
                {event.action === 'DEPOSIT' ? ` to ${bankName(event.accountId)}` : event.accountId ? ` (taken out of ${bankName(event.accountId)})` : ''} · {formatDate(event.createdAt)}
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  );
}

function DepositModal({ cheque, accounts, onClose, onSaved }: { cheque: Cheque; accounts: Account[]; onClose: () => void; onSaved: () => void }) {
  const [accountId, setAccountId] = useState(accounts.length === 1 ? accounts[0].id : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving || !accountId) return;
    setSaving(true); setError('');
    try {
      await api.post(`/cheques/${cheque.id}/actions`, { action: 'DEPOSIT', accountId, requestId: requestId.current });
      toast.success('Cheque deposited', { description: `${formatCurrency(cheque.amount)} to ${accounts.find((account) => account.id === accountId)?.bankName}` });
      onSaved();
    } catch (failure) {
      setError(getApiError(failure, 'Could not deposit this cheque.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Deposit cheque" onClose={() => { if (!saving) onClose(); }} size="md">
      <form onSubmit={submit} className="space-y-5">
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
          {formatCurrency(cheque.amount)} from <b>{cheque.name}</b>{cheque.reference ? ` · Ref ${cheque.reference}` : ''}
        </p>
        {accounts.length ? (
          <label className="block">
            <span className="label">Deposit to bank *</span>
            <select className="input-field" required value={accountId} disabled={saving} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select a bank</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName} · {account.accountNumber.slice(-4)}</option>)}
            </select>
          </label>
        ) : (
          <p className="text-sm text-slate-600">Add a bank account in <Link className="font-semibold text-blue-600" href="/cash-banks">Bank Accounts</Link> first.</p>
        )}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <footer className="reference-form-footer">
          <button type="button" disabled={saving} className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" disabled={saving || !accountId} className="btn-primary">{saving ? 'Depositing...' : 'Deposit'}</button>
        </footer>
      </form>
    </Modal>
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

