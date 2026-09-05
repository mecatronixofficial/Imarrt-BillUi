'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import { api, getAllPages, getActiveBusinessId, setActiveBranchId, setActiveBusinessId } from '@/lib/api';
import type { Branch, Business } from '@/types';

export default function CompanyCornerPicker({ compact = false }: { compact?: boolean }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    void getAllPages<Business>('/businesses').then(({ data }) => {
      if (!active) return;
      setBusinesses(data);
      setSelectedId(getActiveBusinessId() ?? data[0]?.id ?? '');
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  async function changeCompany(businessId: string) {
    if (!businessId || businessId === selectedId || switching) return;
    setSwitching(true);
    setSelectedId(businessId);
    setActiveBusinessId(businessId);
    try {
      const { data: branches } = await api.get<Branch[]>('/branches', { params: { limit: 100, offset: 0 } });
      const branch = branches.find(({ isActive }) => isActive);
      if (branch) setActiveBranchId(branch.id, businessId);
      window.location.reload();
    } catch {
      setSwitching(false);
    }
  }

  if (businesses.length === 0) return null;
  return <label className={`flex items-center gap-2 rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? 'h-9 px-2' : 'h-10 px-3'}`}><Building2 aria-hidden="true" size={15} className="shrink-0 text-blue-600" /><span className="sr-only">Select company</span><select aria-label="Select company" value={selectedId} disabled={switching} onChange={(event) => void changeCompany(event.target.value)} className="max-w-40 bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:opacity-60">{businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>;
}
