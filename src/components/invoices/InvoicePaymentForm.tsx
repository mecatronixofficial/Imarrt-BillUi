'use client';

import { useRef, useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import AccountSelect from '@/components/accounting/AccountSelect';
import { toast } from '@/components/ToastProvider';
import { api, getApiError } from '@/lib/api';
import { subtractMoney } from '@/lib/billing';
import { formatCurrency } from '@/lib/format';
import { invoiceOutstanding } from '@/lib/outstanding';
import { localPaymentDateTime, paymentDateToIso } from '@/lib/payment-date';
import type { Invoice } from '@/types';

export default function InvoicePaymentForm({ invoice, onSaved, onSavingChange }: {
  invoice: Invoice;
  onSaved: (invoice: Invoice) => void;
  onSavingChange?: (saving: boolean) => void;
}) {
  const balance = invoiceOutstanding(invoice);
  const [amount, setAmount] = useState(String(balance));
  const [method, setMethod] = useState('cash');
  const [accountId, setAccountId] = useState('');
  const [reference, setReference] = useState('');
  const [paidAt, setPaidAt] = useState(localPaymentDateTime);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const requestId = useRef(crypto.randomUUID());
  const canPay = balance > 0 && !['DRAFT', 'CANCELLED'].includes(invoice.status);
  const enteredAmount = Number(amount);
  const remainingAfterPayment = !Number.isFinite(enteredAmount) || enteredAmount <= 0 ? balance : enteredAmount >= balance ? 0 : subtractMoney(balance, Math.round(enteredAmount * 100) / 100);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !canPay) return;
    const paymentAmount = Number(amount);
    let timestamp: string;
    try {
      if (!Number.isFinite(paymentAmount) || paymentAmount < 0.01 || paymentAmount > balance || Math.abs(paymentAmount * 100 - Math.round(paymentAmount * 100)) > 0.000001) {
        throw new Error(`Enter an amount from 0.01 to ${formatCurrency(balance)}, with at most two decimal places.`);
      }
      timestamp = paymentDateToIso(paidAt);
    } catch (validationError) {
      setError((validationError as Error).message);
      return;
    }
    submitting.current = true;
    setSaving(true);
    onSavingChange?.(true);
    setError('');
    try {
      const { data } = await api.post<Invoice>(`/invoices/${invoice.id}/payments`, {
        amount: paymentAmount, method, accountId: accountId || undefined,
        reference: reference.trim() || undefined, paidAt: timestamp, requestId: requestId.current,
      });
      toast.success('Payment received', { description: `${formatCurrency(paymentAmount)} recorded against ${invoice.invoiceNumber}.` });
      onSaved(data);
    } catch (saveError) {
      const message = getApiError(saveError, 'Could not record payment.');
      setError(message);
      toast.error(message);
    } finally {
      submitting.current = false;
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  if (!canPay) return <p role="status" className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
    {['DRAFT', 'CANCELLED'].includes(invoice.status) ? 'Payments can only be added to an issued invoice.' : 'This invoice is settled. No balance remains to pay.'}
  </p>;

  return <form onSubmit={submit} className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <fieldset disabled={saving} className="space-y-4">
      <label className="block"><span className="label">Amount received *</span>
        <input aria-label="Amount received" required type="number" min="0.01" max={balance} step="0.01" className="input-field" value={amount} onChange={(event) => setAmount(event.target.value)} />
      </label>
      <p className="text-xs text-slate-500">Balance after payment: <strong>{formatCurrency(remainingAfterPayment)}</strong></p>
      <label className="block"><span className="label">Payment date and time *</span>
        <input aria-label="Payment date and time" required type="datetime-local" className="input-field" value={paidAt} onChange={(event) => setPaidAt(event.target.value)} />
      </label>
      <label className="block"><span className="label">Payment method *</span>
        <select aria-label="Payment method" className="input-field" value={method} onChange={(event) => setMethod(event.target.value)}>
          <option value="cash">Cash</option><option value="bank_transfer">Bank transfer</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="other">Other</option>
        </select>
      </label>
      <label className="block"><span className="label">Reference / transaction ID</span>
        <input className="input-field" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="UTR or cheque number" />
      </label>
      <AccountSelect value={accountId} onChange={setAccountId} branchId={invoice.branchId} />
      <button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
        {saving && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}{saving ? 'Saving...' : 'Save payment'}
      </button>
    </fieldset>
  </form>;
}
