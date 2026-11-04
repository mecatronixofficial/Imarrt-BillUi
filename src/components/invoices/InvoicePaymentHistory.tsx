'use client';

import { formatCurrency, formatDateTime } from '@/lib/format';
import type { PaymentRecord } from '@/types';

export default function InvoicePaymentHistory({ payments = [] }: { payments?: PaymentRecord[] }) {
  const sorted = [...payments].sort((a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime() || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  if (!sorted.length) return <p className="p-5 text-sm text-slate-500">No payments recorded for this invoice.</p>;

  return <ol className="divide-y divide-slate-100" aria-label="Payment history">
    {sorted.map((payment) => <li key={payment.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-3 text-sm">
      <div className="min-w-0">
        <p className="font-semibold capitalize text-slate-800">{payment.method.replaceAll('_', ' ')}</p>
        <p className="mt-1 text-xs text-slate-600">Paid: <time dateTime={payment.paidAt}>{formatDateTime(payment.paidAt)}</time></p>
        <p className="mt-1 text-xs text-slate-400">Recorded: <time dateTime={payment.createdAt}>{formatDateTime(payment.createdAt)}</time></p>
        {payment.reference && <p className="mt-1 break-all text-xs text-slate-500">Reference: {payment.reference}</p>}
      </div>
      <span className="font-bold tabular-nums text-emerald-700">{formatCurrency(payment.amount)}</span>
    </li>)}
  </ol>;
}
