import type { LucideIcon } from 'lucide-react';
import { Loader2, RefreshCw } from 'lucide-react';

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-slate-500">
      <Loader2 aria-hidden="true" size={17} className="animate-spin text-blue-600" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
      <p className="text-sm text-red-600">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-3 inline-flex items-center gap-2 text-xs">
          <RefreshCw aria-hidden="true" size={14} /> Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description }: { icon: LucideIcon; title: string; description: string }) {
  return (
    <div className="flex min-h-52 flex-col items-center justify-center px-5 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon aria-hidden="true" size={20} />
      </span>
      <p className="text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-xs leading-5 text-slate-500">{description}</p>
    </div>
  );
}
