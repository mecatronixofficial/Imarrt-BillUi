'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Plus } from 'lucide-react';
import { getAllPages, getActiveBranchId, getActiveBusinessId, setActiveBranchId, setActiveBusinessId } from '@/lib/api';
import type { Branch, Business } from '@/types';
import WorkspaceCompanyPicker from './WorkspaceCompanyPicker';

export function LegacyCompanyCornerPicker({ compact = false, companyOnly = false }: { compact?: boolean; companyOnly?: boolean }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branchesByBusiness, setBranchesByBusiness] = useState<Record<string, Branch[]>>({});
  const [selectedBusinessId, setSelectedBusinessId] = useState('');
  const [selectedBranchCode, setSelectedBranchCode] = useState('');
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    let active = true;
    void getAllPages<Business>('/businesses').then(async ({ data }) => {
      const storedBusinessId = getActiveBusinessId();
      const selected = data.some(({ id }) => id === storedBusinessId) ? storedBusinessId! : data[0]?.id ?? '';
      const entries = await Promise.all(data.map(async (business) => {
        const response = await getAllPages<Branch>('/branches', { headers: { 'X-Business-Id': business.id } });
        return [business.id, response.data] as const;
      }));
      if (!active) return;
      const grouped = Object.fromEntries(entries);
      const selectedBranches = grouped[selected] ?? [];
      const storedBranchId = getActiveBranchId(selected);
      const branch = selectedBranches.find(({ id, isActive }) => id === storedBranchId && isActive) ?? selectedBranches.find(({ isActive }) => isActive);
      setBusinesses(data);
      setBranchesByBusiness(grouped);
      setSelectedBusinessId(selected);
      setSelectedBranchCode(branch?.code ?? '');
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const logicalBranches = useMemo(() => Array.from(new Map(
    Object.values(branchesByBusiness).flat().filter(({ isActive }) => isActive).map((branch) => [branch.code, branch]),
  ).values()), [branchesByBusiness]);

  const branchBusinesses = useMemo(() => selectedBranchCode
    ? businesses.filter((business) => branchesByBusiness[business.id]?.some(({ code, isActive }) => isActive && code === selectedBranchCode))
    : businesses, [branchesByBusiness, businesses, selectedBranchCode]);

  function changeBranch(code: string) {
    if (!code || code === selectedBranchCode || switching) return;
    const business = businesses.find(({ id }) => id === selectedBusinessId && branchesByBusiness[id]?.some((branch) => branch.code === code && branch.isActive))
      ?? businesses.find(({ id }) => branchesByBusiness[id]?.some((branch) => branch.code === code && branch.isActive));
    const branch = business && branchesByBusiness[business.id]?.find(({ code: branchCode, isActive }) => isActive && branchCode === code);
    if (!business || !branch) return;
    setSwitching(true);
    setActiveBusinessId(business.id);
    setActiveBranchId(branch.id, business.id);
    window.location.reload();
  }

  function changeCompany(businessId: string) {
    if (!businessId || businessId === selectedBusinessId || switching) return;
    const branch = branchesByBusiness[businessId]?.find(({ code, isActive }) => isActive && code === selectedBranchCode);
    if (!branch) return;
    setSwitching(true);
    setActiveBusinessId(businessId);
    setActiveBranchId(branch.id, businessId);
    window.location.reload();
  }

  if (businesses.length === 0) return null;
  const controlClass = `flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white shadow-sm ${compact ? 'h-9 px-2' : 'h-10 px-3'}`;

  return <div className="flex min-w-0 items-center gap-2">
    {!companyOnly && <label className={controlClass}><MapPin aria-hidden="true" size={14} className="shrink-0 text-violet-600" /><span className="sr-only">Select branch</span><select aria-label="Select branch" value={selectedBranchCode} disabled={switching} onChange={(event) => changeBranch(event.target.value)} className="max-w-32 bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:opacity-60">{logicalBranches.map((branch) => <option key={branch.code} value={branch.code}>{branch.name}</option>)}</select></label>}
    {branchBusinesses.length > 0 && <label className={controlClass}><Building2 aria-hidden="true" size={14} className="shrink-0 text-blue-600" /><span className="sr-only">Select company</span><select aria-label="Select company" value={selectedBusinessId} disabled={switching} onChange={(event) => changeCompany(event.target.value)} className="max-w-36 bg-transparent text-xs font-semibold text-slate-700 outline-none disabled:opacity-60">{branchBusinesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}</select></label>}
    {!companyOnly && <Link href="/businesses?newCompany=1" aria-label="Add company to selected branch" title="Add company to selected branch" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-dashed border-blue-300 bg-blue-50 text-blue-600 transition hover:border-blue-400 hover:bg-blue-100"><Plus aria-hidden="true" size={15} /></Link>}
  </div>;
}

export default WorkspaceCompanyPicker;
