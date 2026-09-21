import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
  /** Small section label; when set, the header renders as the gradient banner used on Sale Invoices. */
  eyebrow?: string;
};

export default function PageHeader({ title, description, action, eyebrow }: PageHeaderProps) {
  if (eyebrow) {
    return (
      <header className="mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-cyan-200/30 blur-3xl" />
          <div className="relative">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-blue-600" />
              <span className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-blue-600">{eyebrow}</span>
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">{description}</p>
          </div>
          {action && (
            <div className="relative shrink-0 [&_.btn-primary]:h-10 [&_.btn-primary]:rounded-xl [&_.btn-primary]:px-4 [&_.btn-primary]:text-[11px] [&_.btn-primary]:font-extrabold [&_.btn-primary]:shadow-[0_8px_20px_rgba(37,99,235,0.22)] [&_.btn-primary]:transition-all [&_.btn-primary]:duration-300 [&_.btn-primary]:hover:-translate-y-0.5 [&_.btn-primary]:hover:shadow-[0_12px_26px_rgba(37,99,235,0.30)]">{action}</div>
          )}
        </div>
        <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
      </header>
    );
  }

  return (
    <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
