import type { ReactNode } from 'react';

type PageHeaderProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export default function PageHeader({ title, description, action }: PageHeaderProps) {
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
