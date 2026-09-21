"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, Check, GitBranch, MapPin, Plus, ReceiptText, Search, Sparkles } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/ContentState";
import { api, getActiveBusinessId, getActiveWorkspaceBranchId, getApiError, getCurrentUser, setActiveBusinessId, setActiveWorkspaceBranchId } from "@/lib/api";
import type { Business, WorkspaceBranch } from "@/types";
import { BranchFormModal, BusinessFormModal } from "./BusinessForms";

export default function StylishBusinessPage() {
  const [branches, setBranches] = useState<WorkspaceBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [companyId, setCompanyId] = useState("");
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
      const activeCompany = getActiveBusinessId();
      const storedBranch = getActiveWorkspaceBranchId();
      const selected = data.find(({ id }) => id === storedBranch) ?? data.find(({ businesses }) => businesses.some(({ id }) => id === activeCompany)) ?? data[0];
      setBranches(data); setBranchId(selected?.id ?? ""); setCompanyId(activeCompany ?? "");
      setCanManage(user?.role === "OWNER" || user?.role === "SUPER_ADMIN");
      if (selected) setActiveWorkspaceBranchId(selected.id);
      setError("");
    } catch (cause) { setError(getApiError(cause, "Could not load branches and companies.")); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const branch = branches.find(({ id }) => id === branchId);
  useEffect(() => {
    if (!canManage || !branch || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("newCompany") === "1") { setCompanyForm({}); window.history.replaceState(null, "", window.location.pathname); }
  }, [branch, canManage]);
  const companies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (branch?.businesses ?? []).filter(({ name, legalName, gstin }) => !query || [name, legalName, gstin].some((value) => value?.toLowerCase().includes(query)));
  }, [branch, search]);
  const totalCompanies = branches.reduce((sum, item) => sum + item.businesses.length, 0);

  function selectBranch(item: WorkspaceBranch) {
    setBranchId(item.id); setActiveWorkspaceBranchId(item.id); setSearch("");
    const company = item.businesses[0];
    if (company) { setActiveBusinessId(company.id); setCompanyId(company.id); }
  }

  return <div className="space-y-6">
    <section className="relative overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-[0_22px_60px_rgba(15,23,42,.18)]">
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-blue-500/25 blur-3xl"/><div className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-cyan-400/15 blur-3xl"/>
      <div className="relative flex flex-col gap-6 px-6 py-7 sm:flex-row sm:items-center sm:justify-between lg:px-8"><div className="max-w-2xl"><div className="mb-3 flex items-center gap-2 text-blue-300"><Sparkles size={15}/><span className="text-[10px] font-black uppercase tracking-[.2em]">Workspace control</span></div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Branches & Companies</h1><p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">Keep every company, team, inventory item, party, and transaction organized in the right branch.</p></div>{canManage && <button onClick={() => setBranchForm(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-extrabold shadow-lg transition hover:-translate-y-0.5 hover:bg-blue-500"><Plus size={16}/>Create Branch</button>}</div>
    </section>

    {loading ? <section className="rounded-2xl border bg-white"><LoadingState label="Loading branches..."/></section> : error ? <section className="rounded-2xl border bg-white"><ErrorState message={error} onRetry={() => void load()}/></section> : !branches.length ? <section className="rounded-[24px] border border-dashed border-blue-200 bg-gradient-to-br from-white to-blue-50 py-8"><EmptyState icon={GitBranch} title="Create your first branch" description="Start with a branch, then add its companies."/>{canManage && <div className="flex justify-center"><button onClick={() => setBranchForm(true)} className="btn-primary">Create Branch</button></div>}</section> : <>
      <section className="grid gap-3 sm:grid-cols-3"><Stat icon={GitBranch} label="Total branches" value={branches.length}/><Stat icon={Building2} label="Total companies" value={totalCompanies}/><Stat icon={ReceiptText} label="In selected branch" value={branch?.businesses.length ?? 0}/></section>
      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Step 1</p><h2 className="text-lg font-black text-slate-950">Choose a branch</h2></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">{branches.length} available</span></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{branches.map((item) => { const selected = item.id === branchId; return <button key={item.id} onClick={() => selectBranch(item)} className={`group rounded-2xl border p-5 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${selected ? "border-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white" : "border-slate-200 bg-white hover:border-blue-200"}`}><div className="flex justify-between"><span className={`flex h-11 w-11 items-center justify-center rounded-xl ${selected ? "bg-white/15" : "bg-blue-50 text-blue-600"}`}><GitBranch size={20}/></span>{selected ? <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold"><Check size={12}/>Selected</span> : <ArrowRight size={17} className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600"/>}</div><h3 className="mt-4 text-base font-black">{item.name}</h3><div className={`mt-2 flex items-center gap-2 text-xs ${selected ? "text-blue-100" : "text-slate-500"}`}><span className={`rounded-md px-2 py-1 font-black ${selected ? "bg-white/10" : "bg-slate-100"}`}>{item.code}</span><span>{item.businesses.length} {item.businesses.length === 1 ? "company" : "companies"}</span></div>{item.address && <p className={`mt-3 flex items-center gap-1.5 truncate text-xs ${selected ? "text-blue-100" : "text-slate-400"}`}><MapPin size={12}/>{item.address}</p>}</button>; })}</div></section>
      {branch && <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_35px_rgba(15,23,42,.06)]"><div className="border-b bg-gradient-to-r from-slate-50 to-blue-50/60 p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">Step 2 · Company workspace</p><h2 className="text-lg font-black text-slate-950">Companies in {branch.name}</h2><p className="mt-1 text-xs text-slate-500">Companies from other branches stay hidden.</p></div><div className="flex flex-col gap-2 sm:flex-row"><label className="relative sm:w-56"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/><input className="input-field h-10 pl-9" placeholder="Search companies" value={search} onChange={(event) => setSearch(event.target.value)}/></label>{canManage && <button onClick={() => setCompanyForm({})} className="btn-primary inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap"><Plus size={14}/>Add Company</button>}</div></div></div>
        {!companies.length ? <div className="py-8"><EmptyState icon={Building2} title={search ? "No matching companies" : "No companies in this branch"} description={search ? "Try another name or GSTIN." : "Add the first company to this branch."}/>{!search && canManage && <div className="flex justify-center"><button onClick={() => setCompanyForm({})} className="btn-primary">Add First Company</button></div>}</div> : <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">{companies.map((company) => { const active = company.id === companyId; return <button key={company.id} onClick={() => { setActiveBusinessId(company.id); setCompanyId(company.id); }} className={`group rounded-2xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 hover:border-blue-200"}`}><div className="flex justify-between"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white"}`}><Building2 size={18}/></span>{active && <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-extrabold text-emerald-700"><Check size={12}/>Active</span>}</div><h3 className="mt-4 truncate text-base font-black text-slate-950">{company.name}</h3><p className="mt-1 truncate text-xs text-slate-500">{company.legalName || "Company workspace"}</p><div className="mt-4 flex items-center justify-between border-t pt-3"><span className={`rounded-md px-2 py-1 text-xs font-extrabold ${company.gstRegistered ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}>{company.gstRegistered ? "GST Registered" : "Non GST"}</span><span className="text-xs font-bold text-slate-400">{company.gstin || `${company._count?.invoices ?? 0} invoices`}</span></div></button>; })}</div>}
      </section>}
    </>}
    {branchForm && <BranchFormModal onClose={() => setBranchForm(false)} onSaved={(saved) => { setBranchForm(false); setBranches((current) => [...current, { ...saved, businesses: saved.businesses ?? [] }]); setBranchId(saved.id); setActiveWorkspaceBranchId(saved.id); }}/>} 
    {companyForm && branch && <BusinessFormModal business={companyForm.business} branch={branch} onClose={() => setCompanyForm(null)} onSaved={() => { setCompanyForm(null); void load(); }}/>} 
  </div>;
}

function Stat({ icon: Icon, label, value }: { icon: typeof GitBranch; label: string; value: number }) {
  return <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19}/></span><div><p className="text-xs font-bold text-slate-500">{label}</p><p className="text-2xl font-black text-slate-950">{value.toLocaleString("en-IN")}</p></div></div>;
}
