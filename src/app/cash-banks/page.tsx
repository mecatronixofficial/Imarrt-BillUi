'use client';

import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import { Building2, CheckCircle2, Eye, EyeOff, Landmark, LockKeyhole, Pencil, Plus, Save, ShieldCheck, Trash2, WalletCards, X } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { getActiveBusinessId } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { loadEncrypted, saveEncrypted } from '@/lib/encryptedStorage';

type AccountType = 'CURRENT' | 'SAVINGS' | 'CASH_CREDIT' | 'OVERDRAFT';
type BankAccount = { id: string; accountHolder: string; bankName: string; accountNumber: string; ifsc: string; branch: string; accountType: AccountType; upiId: string; openingBalance: number; primary: boolean; updatedAt: string };
type BankForm = Omit<BankAccount, 'id' | 'updatedAt' | 'openingBalance'> & { openingBalance: string };

const EMPTY_FORM: BankForm = { accountHolder: '', bankName: '', accountNumber: '', ifsc: '', branch: '', accountType: 'CURRENT', upiId: '', openingBalance: '0', primary: false };
const ACCOUNT_LABELS: Record<AccountType, string> = { CURRENT: 'Current account', SAVINGS: 'Savings account', CASH_CREDIT: 'Cash credit', OVERDRAFT: 'Overdraft' };
const storageKey = () => `vyapar:bank-accounts:${getActiveBusinessId() ?? 'default'}`;
const maskAccount = (number: string) => `•••• •••• ${number.slice(-4)}`;

export default function CashBanksPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [form, setForm] = useState<BankForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showNumbers, setShowNumbers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    loadEncrypted<BankAccount[]>(storageKey(), []).then((saved) => { if (active) setAccounts(saved); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const totalBalance = useMemo(() => accounts.reduce((sum, account) => sum + account.openingBalance, 0), [accounts]);
  const updateField = <K extends keyof BankForm>(field: K, value: BankForm[K]) => { setForm((current) => ({ ...current, [field]: value })); setError(''); };

  function startAdd() {
    setEditingId(null); setForm({ ...EMPTY_FORM, primary: accounts.length === 0 }); setShowForm(true); setMessage(''); setError('');
  }
  function startEdit(account: BankAccount) {
    setEditingId(account.id); setForm({ ...account, openingBalance: String(account.openingBalance) }); setShowForm(true); setMessage(''); setError('');
  }
  function closeForm() { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); setError(''); }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const accountNumber = form.accountNumber.replace(/\s+/g, '');
    const ifsc = form.ifsc.trim().toUpperCase();
    if (!/^\d{9,18}$/.test(accountNumber)) return setError('Enter a valid 9 to 18 digit account number.');
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) return setError('Enter a valid 11 character IFSC code.');
    const record: BankAccount = { ...form, id: editingId ?? crypto.randomUUID(), accountNumber, ifsc, accountHolder: form.accountHolder.trim(), bankName: form.bankName.trim(), branch: form.branch.trim(), upiId: form.upiId.trim(), openingBalance: Number(form.openingBalance) || 0, updatedAt: new Date().toISOString() };
    let next = editingId ? accounts.map((account) => account.id === editingId ? record : account) : [...accounts, record];
    if (record.primary) next = next.map((account) => ({ ...account, primary: account.id === record.id }));
    setSaving(true);
    try {
      await saveEncrypted(storageKey(), next); setAccounts(next); closeForm(); setMessage(editingId ? 'Bank details updated securely.' : 'Bank account added securely.');
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Could not securely save bank details.'); }
    finally { setSaving(false); }
  }

  async function removeAccount(account: BankAccount) {
    if (!window.confirm(`Remove ${account.bankName} ending in ${account.accountNumber.slice(-4)}?`)) return;
    const next = accounts.filter(({ id }) => id !== account.id);
    if (account.primary && next.length) next[0] = { ...next[0], primary: true };
    try { await saveEncrypted(storageKey(), next); setAccounts(next); setMessage('Bank account removed.'); }
    catch { setError('Could not update encrypted bank details.'); }
  }

  return <>
    <PageHeader title="Cash & Banks" description="Manage bank accounts and securely store payment details." action={<button type="button" className="btn-primary inline-flex items-center gap-2" onClick={startAdd}><Plus size={16} /> Add bank account</button>} />
    {message && <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status"><CheckCircle2 size={17} />{message}</div>}
    <div className="grid gap-4 md:grid-cols-3">
      <SummaryCard icon={WalletCards} label="Total bank balance" value={formatCurrency(totalBalance)} tone="blue" />
      <SummaryCard icon={Landmark} label="Linked accounts" value={String(accounts.length)} tone="emerald" />
      <SummaryCard icon={ShieldCheck} label="Storage security" value="AES-256 encrypted" tone="violet" />
    </div>
    <section className="card mt-5 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-base font-extrabold text-slate-900">Bank details</h2><p className="mt-1 text-xs text-slate-500">Account numbers are hidden by default and encrypted before saving.</p></div>
        {accounts.length > 0 && <button type="button" className="btn-secondary inline-flex items-center justify-center gap-2 text-xs" onClick={() => setShowNumbers((visible) => !visible)}>{showNumbers ? <EyeOff size={15} /> : <Eye size={15} />}{showNumbers ? 'Hide numbers' : 'Show numbers'}</button>}
      </div>
      {loading ? <div className="px-5 py-16 text-center text-sm text-slate-500">Opening encrypted bank details…</div> : accounts.length === 0 ? <EmptyState onAdd={startAdd} /> :
        <div className="grid gap-4 p-4 lg:grid-cols-2">{accounts.map((account) => <article key={account.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
          <div className="flex items-start justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><Landmark size={20} /></span><div className="min-w-0"><div className="flex items-center gap-2"><h3 className="truncate text-sm font-extrabold text-slate-900">{account.bankName}</h3>{account.primary && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">Primary</span>}</div><p className="mt-1 text-xs text-slate-500">{account.accountHolder}</p></div></div>
            <div className="flex shrink-0 gap-1"><button type="button" aria-label={`Edit ${account.bankName}`} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-blue-600" onClick={() => startEdit(account)}><Pencil size={15} /></button><button type="button" aria-label={`Delete ${account.bankName}`} className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-rose-600" onClick={() => void removeAccount(account)}><Trash2 size={15} /></button></div></div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-200 pt-4 text-xs"><Detail label="Account number" value={showNumbers ? account.accountNumber : maskAccount(account.accountNumber)} /><Detail label="IFSC code" value={account.ifsc} /><Detail label="Account type" value={ACCOUNT_LABELS[account.accountType]} /><Detail label="Branch" value={account.branch || 'Not provided'} /><Detail label="UPI ID" value={account.upiId || 'Not provided'} /><Detail label="Opening balance" value={formatCurrency(account.openingBalance)} /></dl>
        </article>)}</div>}
    </section>
    <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-xs leading-5 text-blue-800"><LockKeyhole className="mt-0.5 shrink-0" size={17} /><p><strong>Protected on this device.</strong> Details are encrypted with AES-GCM using a non-exportable key stored by your browser. Clearing site data removes both the key and saved accounts.</p></div>
    {showForm && <BankAccountDialog form={form} editing={Boolean(editingId)} saving={saving} error={error} onClose={closeForm} onSubmit={handleSubmit} updateField={updateField} />}
  </>;
}

function BankAccountDialog({ form, editing, saving, error, onClose, onSubmit, updateField }: { form: BankForm; editing: boolean; saving: boolean; error: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; updateField: <K extends keyof BankForm>(field: K, value: BankForm[K]) => void }) {
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="bank-form-title"><form onSubmit={onSubmit} className="max-h-[95vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4"><div><h2 id="bank-form-title" className="text-base font-extrabold text-slate-950">{editing ? 'Update bank details' : 'Add bank account'}</h2><p className="mt-1 text-xs text-slate-500">All fields are encrypted before being stored.</p></div><button type="button" aria-label="Close" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100" onClick={onClose}><X size={18} /></button></div>
    <div className="grid gap-4 p-5 sm:grid-cols-2">
      <Field label="Account holder name" required><input className="input-field" required autoFocus value={form.accountHolder} onChange={(e) => updateField('accountHolder', e.target.value)} placeholder="Business or account holder" /></Field>
      <Field label="Bank name" required><input className="input-field" required value={form.bankName} onChange={(e) => updateField('bankName', e.target.value)} placeholder="e.g. HDFC Bank" /></Field>
      <Field label="Account number" required><input className="input-field" required inputMode="numeric" autoComplete="off" value={form.accountNumber} onChange={(e) => updateField('accountNumber', e.target.value.replace(/[^\d ]/g, ''))} placeholder="9–18 digit account number" /></Field>
      <Field label="IFSC code" required><input className="input-field uppercase" required maxLength={11} value={form.ifsc} onChange={(e) => updateField('ifsc', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="HDFC0001234" /></Field>
      <Field label="Account type"><select className="input-field" value={form.accountType} onChange={(e) => updateField('accountType', e.target.value as AccountType)}>{Object.entries(ACCOUNT_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></Field>
      <Field label="Branch"><input className="input-field" value={form.branch} onChange={(e) => updateField('branch', e.target.value)} placeholder="Branch name or city" /></Field>
      <Field label="UPI ID"><input className="input-field" value={form.upiId} onChange={(e) => updateField('upiId', e.target.value)} placeholder="business@bank" /></Field>
      <Field label="Opening balance"><input className="input-field" type="number" step="0.01" value={form.openingBalance} onChange={(e) => updateField('openingBalance', e.target.value)} /></Field>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 sm:col-span-2"><input type="checkbox" className="h-4 w-4" checked={form.primary} onChange={(e) => updateField('primary', e.target.checked)} /><span><span className="block text-sm font-bold text-slate-800">Set as primary account</span><span className="block text-xs text-slate-500">Use by default for payment details.</span></span></label>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700 sm:col-span-2" role="alert">{error}</p>}
    </div>
    <div className="sticky bottom-0 flex justify-end gap-3 border-t border-slate-100 bg-white px-5 py-4"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={saving}><Save size={15} />{saving ? 'Encrypting…' : editing ? 'Save changes' : 'Save account'}</button></div>
  </form></div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) { return <div className="px-5 py-16 text-center"><span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Building2 size={22} /></span><h3 className="mt-4 text-sm font-extrabold text-slate-800">No bank accounts added</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-slate-500">Add business bank details for quick access while receiving payments and preparing invoices.</p><button type="button" className="btn-primary mt-4 inline-flex items-center gap-2" onClick={onAdd}><Plus size={15} />Add first account</button></div>; }
function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) { return <label><span className="label">{label}{required && <span className="ml-0.5 text-rose-500">*</span>}</span>{children}</label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt><dd className="mt-1 truncate font-bold text-slate-700" title={value}>{value}</dd></div>; }
function SummaryCard({ icon: Icon, label, value, tone }: { icon: typeof Landmark; label: string; value: string; tone: 'blue' | 'emerald' | 'violet' }) { const colors = { blue: 'bg-blue-50 text-blue-600', emerald: 'bg-emerald-50 text-emerald-600', violet: 'bg-violet-50 text-violet-600' }; return <div className="card p-4"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors[tone]}`}><Icon size={18} /></span><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-extrabold text-slate-950">{value}</p></div>; }
