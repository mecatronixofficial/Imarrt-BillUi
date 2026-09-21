'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { AlertCircle, Check, ChevronRight, Loader2, Lock } from 'lucide-react';
import { getApiError, getCurrentUser } from '@/lib/api';
import { syncPreferences } from '@/lib/preferences';
import { useSaveStatus } from '@/lib/useGeneralPreferences';

export function SettingsCard({ title, description, icon, children }: { title: string; description?: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        {icon && <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">{icon}</span>}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-extrabold text-slate-900">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-5 text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="mt-4 divide-y divide-slate-100">{children}</div>
    </section>
  );
}

export function ToggleRow({ label, description, checked, onChange }: { label: string; description?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center">
        <input type="checkbox" className="peer sr-only" checked={checked} onChange={(event) => onChange(event.target.checked)} aria-label={label} />
        <span className="absolute inset-0 rounded-full bg-slate-200 transition peer-checked:bg-blue-600 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2" />
        <span className="relative h-[18px] w-[18px] translate-x-1 rounded-full bg-white shadow transition peer-checked:translate-x-[22px]" />
      </span>
    </label>
  );
}

export function SelectRow({ label, description, value, onChange, options }: { label: string; description?: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <select className="input-field w-full sm:w-52" value={value} onChange={(event) => onChange(event.target.value)} aria-label={label}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  );
}

export function NumberRow({ label, description, value, onChange, min = 0, max = 4 }: { label: string; description?: string; value: number; onChange: (value: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <input type="number" min={min} max={max} className="input-field w-full sm:w-24" value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} aria-label={label} />
    </div>
  );
}

export function TextRow({ label, description, value, onChange, placeholder }: { label: string; description?: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <input type="text" className="input-field w-full sm:w-64" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </div>
  );
}

export function TextAreaRow({ label, description, value, onChange, rows = 3 }: { label: string; description?: string; value: string; onChange: (value: string) => void; rows?: number }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      <span className="block text-sm font-semibold text-slate-800">{label}</span>
      {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      <textarea className="input-field mt-2 w-full resize-none" rows={rows} value={value} onChange={(event) => onChange(event.target.value)} aria-label={label} />
    </div>
  );
}

export function OptionCardRow<T extends string>({ label, description, value, onChange, options }: { label?: string; description?: string; value: T; onChange: (value: T) => void; options: Array<{ value: T; label: string; sublabel?: string }> }) {
  return (
    <div className="py-3 first:pt-0 last:pb-0">
      {label && (
        <span className="mb-2 block">
          <span className="block text-sm font-semibold text-slate-800">{label}</span>
          {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
        </span>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={active}
              className={`rounded-lg border px-3 py-2 text-center transition ${active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50'}`}
            >
              <span className="block text-xs font-bold">{option.label}</span>
              {option.sublabel && <span className="mt-0.5 block text-[10px] text-slate-400">{option.sublabel}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <p className="pb-2 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400 first:pt-0">{children}</p>;
}

export function LinkRow({ label, description, onClick }: { label: string; description?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 py-3 text-left first:pt-0 last:pb-0">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-blue-600">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-500">{description}</span>}
      </span>
      <ChevronRight size={16} className="shrink-0 text-slate-300" />
    </button>
  );
}

/** Live save state for the company preferences (replaces the old "saved on this device" note). */
export function SavedNote() {
  const { state, error } = useSaveStatus();
  return (
    <div role="status" aria-live="polite" className="mt-5 min-h-5 text-[11px] font-medium">
      {state === 'saving' && <span className="inline-flex items-center gap-1.5 text-slate-500"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
      {state === 'saved' && <span className="inline-flex items-center gap-1.5 text-emerald-600"><Check size={12} /> Saved for this company</span>}
      {state === 'error' && <span className="inline-flex items-center gap-1.5 text-red-600"><AlertCircle size={12} /> {error}</span>}
      {state === 'idle' && <span className="text-slate-400">Changes save automatically for this company.</span>}
    </div>
  );
}

/** A setting whose feature does not exist in the app yet. It is shown so it is not a mystery, but cannot be switched on. */
export function UnavailableRow({ label, description }: { label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0" aria-disabled="true">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-400">{label}</span>
        {description && <span className="mt-0.5 block text-xs leading-5 text-slate-400">{description}</span>}
      </span>
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Coming soon</span>
    </div>
  );
}

/**
 * Wraps every Settings page: pulls the company's saved preferences from the server
 * and makes the controls read-only for roles that may not change them.
 */
export function SettingsAccess({ children }: { children: ReactNode }) {
  const [canEdit, setCanEdit] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    void getCurrentUser().then((user) => { if (active) setCanEdit(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN'); }).catch(() => undefined);
    void syncPreferences().catch((error: unknown) => { if (active) setLoadError(getApiError(error, 'Could not load the saved settings.')); });
    return () => { active = false; };
  }, []);

  return (
    <>
      {!canEdit && (
        <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800"><Lock size={14} aria-hidden="true" /> Only the company owner can change these settings. You are viewing the current values.</p>
      )}
      {loadError && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700"><AlertCircle size={14} aria-hidden="true" /> {loadError}</p>
      )}
      <fieldset disabled={!canEdit} className="min-w-0 space-y-4 border-0 p-0">{children}</fieldset>
    </>
  );
}
