"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Check, GitBranch, Plus, Search } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ContentState";
import { api, getActiveBusinessId, getActiveWorkspaceBranchId, getApiError, getCurrentUser, setActiveBusinessId, setActiveWorkspaceBranchId } from "@/lib/api";
import type { Business, WorkspaceBranch } from "@/types";
import { BranchFormModal, BusinessFormModal } from "./BusinessForms";

export default function BranchCompaniesPage() {
  const [branches, setBranches] = useState<WorkspaceBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [activeCompanyId, setActiveCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchForm, setBranchForm] = useState(false);
  const [companyForm, setCompanyForm] = useState<{ business?: Business } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, user] = await Promise.all([api.get<WorkspaceBranch[]>("/workspace-branches"), getCurrentUser()]);
      setBranches(data);
      setCanManage(user?.role === "OWNER" || user?.role === "SUPER_ADMIN");
      const active = getActiveBusinessId();
      const storedBranch = getActiveWorkspaceBranchId();
      const containing = data.find(({ businesses }) => businesses.some(({ id }) => id === active));
      const selected = data.find(({ id }) => id === storedBranch) ?? containing ?? data[0];
      setBranchId(selected?.id ?? "");
      if (selected) setActiveWorkspaceBranchId(selected.id);
      setActiveCompanyId(active ?? "");
      setError("");
    } catch (cause) { setError(getApiError(cause, "Could not load branches.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const branch = branches.find(({ id }) => id === branchId);
  useEffect(() => {
    if (!canManage || !branch || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('newCompany') !== '1') return;
    setCompanyForm({});
    window.history.replaceState(null, '', window.location.pathname);
  }, [branch, canManage]);
  const companies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (branch?.businesses ?? []).filter(({ name, legalName, gstin }) => !query || [name, legalName, gstin].some((value) => value?.toLowerCase().includes(query)));
  }, [branch, search]);
  const totalCompanies = branches.reduce((sum, item) => sum + item.businesses.length, 0);

  function chooseBranch(selected: WorkspaceBranch) {
    setBranchId(selected.id); setActiveWorkspaceBranchId(selected.id); setSearch("");
    const first = selected.businesses[0];
    if (first) { setActiveBusinessId(first.id); setActiveCompanyId(first.id); }
  }

  return <div className="space-y-5">
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-sm">
      <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.18em] text-blue-600">Workspace Management</p><h1 className="mt-1 text-2xl font-black text-slate-950">Branches & Companies</h1><p className="mt-1 text-xs text-slate-500">Create a branch first, then create companies inside it.</p></div>{canManage && <button onClick={() => setBranchForm(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={14}/>New Branch</button>}</div>
      <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
    </section>
    {loading ? <LoadingState label="Loading branches..."/> : error ? <ErrorState message={error} onRetry={() => void load()}/> : branches.length === 0 ? <section className="rounded-2xl border bg-white py-6"><EmptyState icon={GitBranch} title="Create your first branch" description="Companies can only be created inside a branch."/>{canManage && <div className="flex justify-center"><button onClick={() => setBranchForm(true)} className="btn-primary">Create Branch</button></div>}</section> : <>
      <section className="grid grid-cols-2 gap-3"><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Branches</p><p className="text-2xl font-black">{branches.length}</p></div><div className="rounded-xl border bg-white p-4"><p className="text-xs text-slate-500">Companies</p><p className="text-2xl font-black">{totalCompanies}</p></div></section>
      <section><h2 className="mb-3 text-sm font-black">1. Select Branch</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{branches.map((item) => <button key={item.id} onClick={() => chooseBranch(item)} className={`rounded-2xl border p-4 text-left ${item.id === branchId ? "border-blue-400 bg-blue-50 ring-2 ring-blue-100" : "bg-white"}`}><div className="flex justify-between"><GitBranch className="text-blue-600" size={20}/>{item.id === branchId && <Check className="text-blue-600" size={16}/>}</div><h3 className="mt-3 font-black">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.code} · {item.businesses.length} {item.businesses.length === 1 ? "company" : "companies"}</p></button>)}</div></section>
      {branch && <section className="rounded-2xl border bg-white shadow-sm"><div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-black">2. Companies in {branch.name}</h2><p className="text-xs text-slate-500">Companies from other branches are not shown.</p></div><div className="flex gap-2"><label className="relative"><Search size={13} className="absolute left-3 top-3 text-slate-400"/><input className="input-field h-9 pl-8" placeholder="Search" value={search} onChange={(event) => setSearch(event.target.value)}/></label>{canManage && <button onClick={() => setCompanyForm({})} className="btn-primary whitespace-nowrap"><Plus size={13}/> Add Company</button>}</div></div>
        {companies.length === 0 ? <div className="py-6"><EmptyState icon={Building2} title="No companies in this branch" description="Add the first company to this branch."/></div> : <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">{companies.map((company) => <button key={company.id} onClick={() => { setActiveBusinessId(company.id); setActiveCompanyId(company.id); }} className={`rounded-xl border p-4 text-left ${company.id === activeCompanyId ? "border-blue-300 bg-blue-50" : "border-slate-200"}`}><div className="flex justify-between"><Building2 size={18}/>{company.id === activeCompanyId && <Check size={15} className="text-blue-600"/>}</div><h3 className="mt-3 font-black">{company.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{company.gstin || company.legalName || "Non-GST company"}</p></button>)}</div>}
      </section>}
    </>}
    {branchForm && <BranchFormModal onClose={() => setBranchForm(false)} onSaved={(saved) => { setBranchForm(false); setBranches((current) => [...current, { ...saved, businesses: saved.businesses ?? [] }]); setBranchId(saved.id); setActiveWorkspaceBranchId(saved.id); }}/>} 
    {companyForm && branch && <BusinessFormModal business={companyForm.business} branch={branch} onClose={() => setCompanyForm(null)} onSaved={() => { setCompanyForm(null); void load(); }}/>} 
  </div>;
}
