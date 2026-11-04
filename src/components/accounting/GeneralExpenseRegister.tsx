'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, ChevronDown, FileSpreadsheet, FolderPlus, MoreVertical, Pencil, Plus, Printer, Search, Trash2, Wallet } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import Modal from '@/components/Modal';
import PageHeader from '@/components/PageHeader';
import { MenuButton, Popover } from '@/components/PopoverMenu';
import { toast } from '@/components/ToastProvider';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { computeBilling } from '@/lib/billing';
import { localDate } from '@/lib/business-report';
import { downloadCsv } from '@/lib/export';
import { formatCurrency, formatDate } from '@/lib/format';
import type { Expense, ExpenseCategory } from '@/types';

const METHODS = [['cash', 'Cash'], ['upi', 'UPI'], ['cheque', 'Cheque'], ['bank_transfer', 'Bank transfer'], ['other', 'Other']] as const;
const METHOD_LABELS: Record<string, string> = Object.fromEntries(METHODS);
const GST_RATES = [0, 5, 12, 18, 28];
const NEW_CATEGORY = '__new__';

type Account = { id: string; bankName: string; accountNumber?: string };

function paymentLabel(expense: Expense) {
  return expense.account?.bankName ?? METHOD_LABELS[expense.method] ?? expense.method;
}

export default function GeneralExpenseRegister() {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [categoryQuery, setCategoryQuery] = useState('');
  const [expenseQuery, setExpenseQuery] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [categoryForm, setCategoryForm] = useState<{ category?: ExpenseCategory } | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<ExpenseCategory | null>(null);
  const [expenseForm, setExpenseForm] = useState<{ categoryName?: string } | null>(null);
  const [cancelling, setCancelling] = useState<Expense | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);

  const load = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [categoryRes, expenseRes] = await Promise.all([
        getAllPages<ExpenseCategory>('/expenses/categories'),
        getAllPages<Expense>('/expenses'),
      ]);
      setCategories(categoryRes.data);
      setExpenses(expenseRes.data);
    } catch (loadError) {
      setError(getApiError(loadError, 'Could not load expenses.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    // Staff can view expenses; adding and changing them is for owners and accountants.
    void getCurrentUser().then((user) => setCanManage(Boolean(user && user.role !== 'STAFF'))).catch(() => undefined);
  }, [load]);

  // After saving an expense, show its category once the reloaded list includes it (it may be new).
  const [selectName, setSelectName] = useState('');
  useEffect(() => {
    if (!selectName) return;
    const match = categories.find(({ name }) => name.toLowerCase() === selectName.toLowerCase());
    if (match) {
      setSelectedId(match.id);
      setCategoryQuery('');
      setSelectName('');
    }
  }, [categories, selectName]);

  const visibleCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    return term ? categories.filter(({ name }) => name.toLowerCase().includes(term)) : categories;
  }, [categories, categoryQuery]);
  const selected = categories.find(({ id }) => id === selectedId) ?? visibleCategories[0] ?? null;
  const inCategory = useMemo(
    () => (selected ? expenses.filter((expense) => expense.category.toLowerCase() === selected.name.toLowerCase()) : []),
    [expenses, selected],
  );
  const shown = useMemo(() => {
    const term = expenseQuery.trim().toLowerCase();
    return term ? inCategory.filter((expense) => [expense.description, expense.reference, paymentLabel(expense), expense.status].some((value) => value?.toLowerCase().includes(term))) : inCategory;
  }, [expenseQuery, inCategory]);
  const monthStart = localDate().slice(0, 8) + '01';
  const thisMonth = inCategory.filter((expense) => expense.status === 'ISSUED' && expense.expenseDate.slice(0, 10) >= monthStart).reduce((sum, expense) => sum + Number(expense.total), 0);
  const grandTotal = categories.reduce((sum, category) => sum + category.total, 0);

  async function cancelExpense() {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      await api.post(`/expenses/${cancelling.id}/cancel`);
      toast.success('Expense cancelled', { description: `${cancelling.description} no longer counts toward totals or account balances.` });
      setCancelling(null);
      await load({ quiet: true });
    } catch (cancelError) {
      toast.error(getApiError(cancelError, 'Could not cancel expense.'));
    } finally {
      setCancelBusy(false);
    }
  }

  function exportRows() {
    if (!selected) return;
    downloadCsv(`expenses-${selected.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, [
      ['Date', 'Description', 'Category', 'Payment type', 'Reference', 'Amount', 'Tax', 'Total', 'Status'],
      ...shown.map((expense) => [formatDate(expense.expenseDate), expense.description, expense.category, paymentLabel(expense), expense.reference ?? '', expense.amount, expense.taxAmount, expense.total, expense.status]),
    ]);
  }

  return (
    <>
      <PageHeader
        title="Expenses"
        description="Record business expenses by category."
        action={canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setCategoryForm({})} className="btn-secondary inline-flex items-center gap-2">
              <FolderPlus size={16} /> Add Category
            </button>
            <button type="button" onClick={() => setExpenseForm({ categoryName: selected?.name })} className="btn-primary inline-flex items-center gap-2">
              <Plus size={16} /> Add Expense
            </button>
          </div>
        ) : null}
      />

      {loading ? (
        <section className="card"><LoadingState label="Loading expenses..." /></section>
      ) : error ? (
        <section className="card"><ErrorState message={error} onRetry={() => void load()} /></section>
      ) : !categories.length ? (
        <section className="card">
          <EmptyState icon={Wallet} title="No expense categories yet" description={canManage ? 'Add a category such as Rent, Salary or Electricity, then record expenses under it.' : 'Expenses recorded by your team will appear here.'} />
          {canManage && (
            <div className="flex justify-center gap-2 pb-8">
              <button type="button" onClick={() => setCategoryForm({})} className="btn-secondary inline-flex items-center gap-2"><FolderPlus size={16} /> Add Category</button>
              <button type="button" onClick={() => setExpenseForm({})} className="btn-primary inline-flex items-center gap-2"><Plus size={16} /> Add Expense</button>
            </div>
          )}
        </section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 p-3">
              <label className="relative block">
                <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input aria-label="Search categories" value={categoryQuery} onChange={(event) => setCategoryQuery(event.target.value)} placeholder="Search category" className="input-field w-full !pl-9" />
              </label>
            </div>
            <div className="flex justify-between bg-slate-50 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <span>Category</span><span>Amount</span>
            </div>
            <div role="listbox" aria-label="Expense categories" className="max-h-[60vh] overflow-y-auto">
              {visibleCategories.map((category) => {
                const active = category.id === selected?.id;
                return (
                  <button
                    key={category.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(category.id)}
                    className={`flex w-full items-center justify-between gap-3 border-l-4 px-4 py-3 text-left text-sm transition ${active ? 'border-blue-600 bg-blue-50 font-bold text-blue-800' : 'border-transparent text-slate-700 hover:bg-slate-50'}`}
                  >
                    <span className="min-w-0 truncate">{category.name}</span>
                    <span className="shrink-0 text-xs font-semibold">{formatCurrency(category.total)}</span>
                  </button>
                );
              })}
              {!visibleCategories.length && <p className="p-5 text-center text-xs text-slate-500">No matching categories.</p>}
            </div>
            <div className="flex justify-between border-t border-slate-100 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
              <span>All categories</span><span>{formatCurrency(grandTotal)}</span>
            </div>
          </section>

          {selected && (
            <section className="card min-w-0 overflow-hidden">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-extrabold text-slate-900">{selected.name}</h2>
                    {canManage && (
                      <>
                        <button type="button" aria-label={`Rename ${selected.name}`} title="Rename category" onClick={() => setCategoryForm({ category: selected })} className="rounded-md p-1 text-blue-600 hover:bg-blue-50"><Pencil size={15} /></button>
                        <button type="button" aria-label={`Delete ${selected.name}`} title="Delete category" onClick={() => setDeletingCategory(selected)} className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                      </>
                    )}
                  </div>
                  <dl className="mt-3 flex flex-wrap gap-6 text-xs">
                    <div><dt className="text-slate-500">Total</dt><dd className="mt-0.5 text-base font-extrabold text-red-600">{formatCurrency(selected.total)}</dd></div>
                    <div><dt className="text-slate-500">This month</dt><dd className="mt-0.5 text-base font-bold text-slate-800">{formatCurrency(thisMonth)}</dd></div>
                    <div><dt className="text-slate-500">Expenses</dt><dd className="mt-0.5 text-base font-bold text-slate-800">{selected.count}</dd></div>
                  </dl>
                </div>
                {canManage && (
                  <button type="button" onClick={() => setExpenseForm({ categoryName: selected.name })} className="btn-primary inline-flex items-center gap-2">
                    <Plus size={16} /> Add {selected.name} expense
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-600">Transactions</h3>
                <div className="flex items-center gap-1">
                  <label className="relative">
                    <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input aria-label="Search expenses" value={expenseQuery} onChange={(event) => setExpenseQuery(event.target.value)} placeholder="Search" className="input-field h-8 w-44 !pl-8 text-xs" />
                  </label>
                  <button type="button" onClick={() => window.print()} aria-label="Print expenses" title="Print" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"><Printer size={16} /></button>
                  <button type="button" onClick={exportRows} disabled={!shown.length} aria-label="Export expenses" title="Export to Excel (CSV)" className="flex h-8 w-8 items-center justify-center rounded-lg text-emerald-700 hover:bg-slate-100 disabled:opacity-40"><FileSpreadsheet size={16} /></button>
                </div>
              </div>

              {shown.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Description</th>
                        <th className="px-4 py-2.5">Payment type</th>
                        <th className="px-4 py-2.5">Reference</th>
                        <th className="px-4 py-2.5 text-right">Amount</th>
                        <th className="px-4 py-2.5">Status</th>
                        <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {shown.map((expense) => {
                        const cancelled = expense.status !== 'ISSUED';
                        return (
                          <tr key={expense.id} className={cancelled ? 'bg-slate-50/70 text-slate-400' : 'hover:bg-slate-50'}>
                            <td className="whitespace-nowrap px-4 py-3 text-slate-500">{formatDate(expense.expenseDate)}</td>
                            <td className="max-w-[260px] px-4 py-3">
                              <span className="block truncate font-semibold text-slate-800" title={expense.description}>{expense.description}</span>
                              {expense.notes && <span className="block truncate text-[11px] text-slate-400" title={expense.notes}>{expense.notes}</span>}
                            </td>
                            <td className="px-4 py-3 text-slate-600">{paymentLabel(expense)}</td>
                            <td className="px-4 py-3 text-slate-500">{expense.reference || '—'}</td>
                            <td className={`whitespace-nowrap px-4 py-3 text-right font-bold ${cancelled ? 'line-through' : 'text-slate-900'}`}>
                              {formatCurrency(expense.total)}
                              {Number(expense.taxAmount) > 0 && <span className="block text-[10px] font-normal text-slate-400">incl. GST {formatCurrency(expense.taxAmount)}</span>}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${cancelled ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{cancelled ? 'Cancelled' : 'Paid'}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              {canManage && !cancelled && (
                                <Popover label={`Actions for ${expense.description}`} align="right" trigger={() => <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><MoreVertical size={16} /></span>}>
                                  {(close) => (
                                    <div role="menu" className="w-48 py-1">
                                      <MenuButton icon={<Plus size={15} />} onClick={() => { close(); setExpenseForm({ categoryName: expense.category }); }}>Add similar expense</MenuButton>
                                      <MenuButton icon={<Ban size={15} />} danger onClick={() => { close(); setCancelling(expense); }}>Cancel expense</MenuButton>
                                    </div>
                                  )}
                                </Popover>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState icon={Wallet} title={expenseQuery ? 'No matching expenses' : `No ${selected.name} expenses yet`} description={expenseQuery ? 'Try another search.' : canManage ? 'Add the first expense for this category.' : 'Expenses in this category will appear here.'} />
              )}
            </section>
          )}
        </div>
      )}

      {categoryForm && (
        <CategoryModal
          category={categoryForm.category}
          onClose={() => setCategoryForm(null)}
          onSaved={(saved) => { setCategoryForm(null); setSelectedId(saved.id); void load({ quiet: true }); }}
        />
      )}
      {deletingCategory && (
        <DeleteCategoryModal
          category={deletingCategory}
          others={categories.filter(({ id }) => id !== deletingCategory.id)}
          used={expenses.filter((expense) => expense.category.toLowerCase() === deletingCategory.name.toLowerCase()).length}
          onClose={() => setDeletingCategory(null)}
          onDeleted={(moveToId) => { setDeletingCategory(null); setSelectedId(moveToId ?? ''); void load({ quiet: true }); }}
        />
      )}
      {expenseForm && (
        <ExpenseModal
          categories={categories}
          initialCategory={expenseForm.categoryName}
          onClose={() => setExpenseForm(null)}
          onSaved={(expense) => {
            setExpenseForm(null);
            setSelectName(expense.category);
            void load({ quiet: true });
          }}
        />
      )}
      {cancelling && (
        <ConfirmDialog
          title="Cancel this expense?"
          message={`${cancelling.description} (${formatCurrency(cancelling.total)}) will stop counting toward ${cancelling.category} and its account balance. Cancelled expenses stay in the list.`}
          confirmLabel="Cancel expense"
          busyLabel="Cancelling..."
          busy={cancelBusy}
          onCancel={() => setCancelling(null)}
          onConfirm={() => void cancelExpense()}
        />
      )}
    </>
  );
}

function CategoryModal({ category, onClose, onSaved }: { category?: ExpenseCategory; onClose: () => void; onSaved: (category: ExpenseCategory) => void }) {
  const [name, setName] = useState(category?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!name.trim()) return setError('Enter a category name.');
    setSaving(true);
    setError('');
    try {
      const { data } = category
        ? await api.patch<ExpenseCategory>(`/expenses/categories/${category.id}`, { name: name.trim() })
        : await api.post<ExpenseCategory>('/expenses/categories', { name: name.trim() });
      toast.success(category ? 'Category renamed' : 'Category added', { description: data.name });
      onSaved(data);
    } catch (saveError) {
      setError(getApiError(saveError, 'Could not save category.'));
      setSaving(false);
    }
  }
  return (
    <Modal title={category ? 'Rename Category' : 'Add Expense Category'} onClose={onClose} size="sm">
      <form onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <label className="block">
          <span className="label">Category name *</span>
          <input autoFocus required maxLength={80} className="input-field" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Rent, Salary, Electricity" />
        </label>
        {category && category.count > 0 && <p className="text-xs text-slate-500">Its {category.count} {category.count === 1 ? 'expense moves' : 'expenses move'} to the new name too.</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : category ? 'Rename' : 'Add Category'}</button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteCategoryModal({ category, others, used, onClose, onDeleted }: { category: ExpenseCategory; others: ExpenseCategory[]; used: number; onClose: () => void; onDeleted: (moveToId?: string) => void }) {
  const [moveTo, setMoveTo] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    if (saving) return;
    if (used && !moveTo) return setError('Choose where to move its expenses.');
    setSaving(true);
    setError('');
    try {
      await api.delete(`/expenses/categories/${category.id}`, { params: moveTo ? { moveTo } : undefined });
      toast.success('Category deleted', { description: used ? `${used} ${used === 1 ? 'expense' : 'expenses'} moved to ${others.find(({ id }) => id === moveTo)?.name}.` : category.name });
      onDeleted(moveTo || undefined);
    } catch (deleteError) {
      setError(getApiError(deleteError, 'Could not delete category.'));
      setSaving(false);
    }
  }
  return (
    <Modal title="Delete category?" onClose={onClose} size="sm">
      <div className="space-y-4">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        {used ? (
          others.length ? (
            <>
              <p className="text-sm text-slate-600"><strong>{category.name}</strong> has {used} {used === 1 ? 'expense' : 'expenses'}. Move {used === 1 ? 'it' : 'them'} to another category, then this category is deleted.</p>
              <label className="block">
                <span className="label">Move expenses to *</span>
                <select className="input-field" value={moveTo} onChange={(event) => setMoveTo(event.target.value)}>
                  <option value="">Select category</option>
                  {others.map((other) => <option key={other.id} value={other.id}>{other.name}</option>)}
                </select>
              </label>
            </>
          ) : (
            <p className="text-sm text-slate-600"><strong>{category.name}</strong> has {used} {used === 1 ? 'expense' : 'expenses'} and there is no other category to move {used === 1 ? 'it' : 'them'} to. Add another category first, or rename this one instead.</p>
          )
        ) : (
          <p className="text-sm text-slate-600"><strong>{category.name}</strong> has no expenses and will be removed.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Keep category</button>
          <button type="button" disabled={saving || (used > 0 && !others.length)} onClick={() => void confirm()} className="inline-flex min-w-24 items-center justify-center rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-50">
            {saving ? 'Deleting...' : used ? 'Move & delete' : 'Delete'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ExpenseModal({ categories, initialCategory, onClose, onSaved }: { categories: ExpenseCategory[]; initialCategory?: string; onClose: () => void; onSaved: (expense: Expense) => void }) {
  const [category, setCategory] = useState(initialCategory ?? categories[0]?.name ?? NEW_CATEGORY);
  const [newCategory, setNewCategory] = useState('');
  const [description, setDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState(localDate);
  const [amount, setAmount] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [source, setSource] = useState('cash');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(crypto.randomUUID());

  useEffect(() => {
    void getAllPages<Account>('/accounts').then(({ data }) => setAccounts(data)).catch(() => undefined);
  }, []);

  const value = Number(amount);
  const rate = Number(taxRate);
  const totals = Number.isFinite(value) && value > 0 && Number.isFinite(rate) ? computeBilling([{ quantity: 1, unitPrice: value, taxRate: rate }]) : null;
  const categoryName = category === NEW_CATEGORY ? newCategory.trim() : category;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (!categoryName) return setError('Choose a category or type a new one.');
    if (!description.trim()) return setError('Enter what the expense was for.');
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than zero.');
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) return setError('GST must be between 0% and 100%.');
    setSaving(true);
    setError('');
    const account = accounts.find(({ id }) => id === source);
    try {
      const { data } = await api.post<Expense>('/expenses', {
        requestId: requestId.current,
        category: categoryName,
        description: description.trim(),
        expenseDate,
        amount: value,
        taxRate: rate,
        method: account ? 'bank_transfer' : source,
        accountId: account?.id,
        reference: reference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      toast.success('Expense saved', { description: `${data.category} · ${formatCurrency(data.total)}` });
      onSaved(data);
    } catch (saveError) {
      setError(getApiError(saveError, 'Could not save the expense.'));
      setSaving(false);
    }
  }

  return (
    <Modal title="Add Expense" onClose={() => { if (!saving) onClose(); }} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}
        <fieldset disabled={saving} className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">Expense category *</span>
            <span className="relative block">
              <select className="input-field appearance-none pr-8" value={category} onChange={(event) => setCategory(event.target.value)}>
                {categories.map((option) => <option key={option.id} value={option.name}>{option.name}</option>)}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
              <ChevronDown size={15} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </span>
          </label>
          {category === NEW_CATEGORY ? (
            <label className="block">
              <span className="label">New category name *</span>
              <input autoFocus required maxLength={80} className="input-field" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="e.g. Transport" />
            </label>
          ) : <span className="hidden sm:block" />}
          <label className="block sm:col-span-2">
            <span className="label">Description *</span>
            <input required maxLength={200} className="input-field" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What was this expense for?" />
          </label>
          <label className="block">
            <span className="label">Date *</span>
            <input required type="date" className="input-field" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">Payment type *</span>
            <select className="input-field" value={source} onChange={(event) => setSource(event.target.value)}>
              {METHODS.map(([method, label]) => <option key={method} value={method}>{label}</option>)}
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.bankName}{account.accountNumber ? ` ••${account.accountNumber.slice(-4)}` : ''}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Amount (before GST) *</span>
            <input required type="number" min="0.01" step="0.01" className="input-field" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="block">
            <span className="label">GST</span>
            <select className="input-field" value={taxRate} onChange={(event) => setTaxRate(event.target.value)}>
              {GST_RATES.map((gst) => <option key={gst} value={gst}>{gst === 0 ? 'None' : `GST @ ${gst}%`}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="label">Reference / bill no.</span>
            <input maxLength={150} className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Optional" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Notes</span>
            <textarea rows={2} maxLength={5000} className="input-field resize-none" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
          </label>
        </fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="text-sm text-slate-600">
            {totals && totals.taxTotal > 0 && <span className="mr-3 text-xs">GST {formatCurrency(totals.taxTotal)}</span>}
            Total <strong className="ml-1 text-lg text-slate-900">{formatCurrency(totals?.grandTotal ?? 0)}</strong>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
            <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Expense'}</button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
