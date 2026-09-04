const statusStyles: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700',
  UNPAID: 'bg-red-50 text-red-700',
  PARTIALLY_PAID: 'bg-amber-50 text-amber-700',
  DRAFT: 'bg-slate-100 text-slate-600',
  CANCELLED: 'bg-slate-100 text-slate-400',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  IN_PRODUCTION: 'bg-amber-50 text-amber-700',
  READY: 'bg-violet-50 text-violet-700',
  DISPATCHED: 'bg-cyan-50 text-cyan-700',
  COMPLETED: 'bg-emerald-50 text-emerald-700',
  PENDING: 'bg-slate-100 text-slate-500',
  IN_PROGRESS: 'bg-amber-50 text-amber-700',
  ISSUED: 'bg-blue-50 text-blue-700',
  ACCEPTED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  CONVERTED: 'bg-indigo-50 text-indigo-700',
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}
