'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Building2, Check, ChevronDown, MapPin, Plus } from 'lucide-react';
import { api, getActiveBranchId, getActiveBusinessId, getActiveWorkspaceBranchId, setActiveBranchId, setActiveBusinessId, setActiveWorkspaceBranchId } from '@/lib/api';
import type { Branch, WorkspaceBranch } from '@/types';

function Dropdown({ label, icon, value, options, disabled, triggerClass, maxWidth, onSelect }: {
  label: string; icon: ReactNode; value: string; options: { id: string; name: string }[]; disabled: boolean; triggerClass: string; maxWidth: string; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find(({ id }) => id === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return <div ref={root} className="relative min-w-0">
    <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} disabled={disabled} onClick={() => setOpen((v) => !v)} className={`${triggerClass} disabled:opacity-60`}>
      {icon}<span className={`${maxWidth} truncate text-xs font-semibold`}>{current?.name}</span>
      <ChevronDown size={13} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && <div role="listbox" aria-label={label} className="absolute left-0 top-full z-50 mt-1.5 max-h-72 min-w-full w-56 max-w-[calc(100vw-1.5rem)] overflow-y-auto lg:left-auto lg:right-0 rounded-xl border border-slate-200 bg-white p-1 shadow-lg ring-1 ring-slate-900/5">
      {options.map((option) => {
        const selected = option.id === current?.id;
        return <button key={option.id} type="button" role="option" aria-selected={selected} onClick={() => { setOpen(false); if (!selected) onSelect(option.id); }}
          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition ${selected ? 'bg-blue-50 font-bold text-blue-700' : 'font-semibold text-slate-700 hover:bg-slate-50'}`}>
          <span className="truncate">{option.name}</span>{selected && <Check size={14} aria-hidden="true" className="shrink-0" />}
        </button>;
      })}
    </div>}
  </div>;
}

export default function WorkspaceCompanyPicker({ compact = false, companyOnly = false }: { compact?: boolean; companyOnly?: boolean }) {
  const [groups, setGroups] = useState<WorkspaceBranch[]>([]);
  const [groupId, setGroupId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    void api.get<WorkspaceBranch[]>('/workspace-branches').then(({ data }) => {
      const businessId = getActiveBusinessId();
      const storedGroup = getActiveWorkspaceBranchId();
      const group = data.find(({ id }) => id === storedGroup) ?? data.find(({ businesses }) => businesses.some(({ id }) => id === businessId)) ?? data[0];
      const company = group?.businesses.find(({ id }) => id === businessId) ?? group?.businesses[0];
      setGroups(data); setGroupId(group?.id ?? ''); setCompanyId(company?.id ?? '');
      if (group) setActiveWorkspaceBranchId(group.id);
    }).catch(() => undefined);
  }, []);

  const group = groups.find(({ id }) => id === groupId);
  async function activate(nextGroupId: string, requestedCompanyId?: string) {
    const nextGroup = groups.find(({ id }) => id === nextGroupId);
    const company = nextGroup?.businesses.find(({ id }) => id === requestedCompanyId) ?? nextGroup?.businesses[0];
    if (!nextGroup || !company) return;
    setSwitching(true); setActiveWorkspaceBranchId(nextGroup.id); setActiveBusinessId(company.id);
    const { data } = await api.get<Branch[]>('/branches', { headers: { 'X-Business-Id': company.id } });
    const stored = getActiveBranchId(company.id);
    const operational = data.find(({ id, isActive }) => id === stored && isActive) ?? data.find(({ isActive }) => isActive);
    if (operational) setActiveBranchId(operational.id, company.id);
    window.location.reload();
  }

  if (!groups.length) return null;
  const control = `flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? 'h-9 px-2' : 'h-10 px-3'}`;
  return <div className="flex min-w-0 items-center gap-2">
    {!companyOnly && <Dropdown label="Select branch" icon={<MapPin size={14} className="text-violet-600"/>} value={groupId} options={groups} disabled={switching} triggerClass={control} maxWidth="max-w-32" onSelect={(id) => void activate(id)} />}
    {group && group.businesses.length > 0 && <Dropdown label="Select company" icon={<Building2 size={14} className="text-blue-600"/>} value={companyId} options={group.businesses} disabled={switching} triggerClass={control} maxWidth="max-w-36" onSelect={(id) => void activate(group.id, id)} />}
    {!companyOnly && <Link href="/businesses?newCompany=1" className="flex h-9 w-9 items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-600" aria-label="Add company"><Plus size={15}/></Link>}
  </div>;
}
