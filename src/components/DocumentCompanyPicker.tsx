'use client';

import { Building2 } from 'lucide-react';
import type { Business } from '@/types';

export default function DocumentCompanyPicker({
  businesses,
  value,
  onChange,
  disabled = false,
}: {
  businesses: Business[];
  value: string;
  onChange: (businessId: string) => void;
  disabled?: boolean;
}) {
  if (!businesses.length) return null;

  return (
    <label className="flex h-9 max-w-56 items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm">
      <Building2 aria-hidden="true" size={15} className="shrink-0 text-blue-600" />
      <span className="sr-only">Company for this document</span>
      <select
        aria-label="Company for this document"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:opacity-60"
      >
        {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
      </select>
    </label>
  );
}
