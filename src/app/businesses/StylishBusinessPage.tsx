"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  GitBranch,
  MapPin,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import ConfirmDialog from "@/components/ConfirmDialog";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";
import {
  api,
  getActiveBusinessId,
  getActiveWorkspaceBranchId,
  getApiError,
  getCurrentUser,
  setActiveBusinessId,
  setActiveWorkspaceBranchId,
} from "@/lib/api";
import type { Business, WorkspaceBranch } from "@/types";
import { toast } from "@/components/ToastProvider";
import { formatRoleLabel } from "@/lib/format";
import { BranchFormModal, BusinessFormModal } from "./BusinessForms";

type ConfirmTarget =
  | { kind: "branch"; branch: WorkspaceBranch }
  | { kind: "company"; company: Business }
  | null;

export default function StylishBusinessPage() {
  const [branches, setBranches] = useState<WorkspaceBranch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [branchForm, setBranchForm] = useState<{ branch?: WorkspaceBranch } | null>(null);
  const [companyForm, setCompanyForm] = useState<{
    business?: Business;
  } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);
  const [busy, setBusy] = useState(false);
  const [roleLabel, setRoleLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data }, user] = await Promise.all([
        api.get<WorkspaceBranch[]>("/workspace-branches"),
        getCurrentUser(),
      ]);
      const activeCompany = getActiveBusinessId();
      const storedBranch = getActiveWorkspaceBranchId();
      const selected =
        data.find(({ id }) => id === storedBranch) ??
        data.find(({ businesses }) =>
          businesses.some(({ id }) => id === activeCompany),
        ) ??
        data[0];
      setBranches(data);
      setBranchId(selected?.id ?? "");
      setCompanyId(activeCompany ?? "");
      setCanManage(user?.role === "OWNER" || user?.role === "SUPER_ADMIN");
      setRoleLabel(formatRoleLabel(user?.role));
      if (selected) setActiveWorkspaceBranchId(selected.id);
      setError("");
    } catch (cause) {
      setError(getApiError(cause, "Could not load branches and companies."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  const branch = branches.find(({ id }) => id === branchId);
  useEffect(() => {
    if (!canManage || !branch || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("newCompany") === "1") {
      setCompanyForm({});
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [branch, canManage]);
  const companies = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (branch?.businesses ?? []).filter(
      ({ name, legalName, gstin }) =>
        !query ||
        [name, legalName, gstin].some((value) =>
          value?.toLowerCase().includes(query),
        ),
    );
  }, [branch, search]);
  const totalCompanies = branches.reduce(
    (sum, item) => sum + item.businesses.length,
    0,
  );

  function selectBranch(item: WorkspaceBranch) {
    if (item.id === branchId) return;
    setBranchId(item.id);
    setActiveWorkspaceBranchId(item.id);
    setSearch("");
    const company = item.businesses[0];
    if (company) {
      setActiveBusinessId(company.id);
      setCompanyId(company.id);
    }
    toast.success(`Switched to ${item.name}`, {
      description: company ? `Welcome, ${roleLabel} — ${company.name} is now the active company.` : `Welcome, ${roleLabel}.`,
    });
  }

  function selectCompany(company: Business) {
    if (company.id === companyId) return;
    setActiveBusinessId(company.id);
    setCompanyId(company.id);
    toast.success(`Switched to ${company.name}`, { description: `Welcome, ${roleLabel}.` });
  }

  /** Falls back to another branch when the one currently selected goes away. */
  function reselectBranch(remaining: WorkspaceBranch[], removedId: string) {
    if (branchId !== removedId) return;
    const next = remaining[0];
    setBranchId(next?.id ?? "");
    setActiveWorkspaceBranchId(next?.id ?? "");
    const company = next?.businesses[0];
    setCompanyId(company?.id ?? "");
    if (company) setActiveBusinessId(company.id);
  }

  async function deleteBranch(target: WorkspaceBranch) {
    setBusy(true);
    try {
      await api.delete(`/workspace-branches/${target.id}`);
      const remaining = branches.filter(({ id }) => id !== target.id);
      setBranches(remaining);
      reselectBranch(remaining, target.id);
      setConfirm(null);
      toast.success(`${target.name} was deleted.`);
    } catch (deleteError: unknown) {
      setConfirm(null);
      toast.error(getApiError(deleteError, "Could not delete branch."));
    } finally {
      setBusy(false);
    }
  }

  async function deleteCompany(target: Business) {
    setBusy(true);
    try {
      await api.delete(`/businesses/${target.id}`);
      setConfirm(null);
      toast.success(`${target.name} was deleted.`);
      await load();
    } catch (deleteError: unknown) {
      setConfirm(null);
      toast.error(getApiError(deleteError, "Could not delete company."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-200">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(37,99,235,0.35),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(124,58,237,0.24),transparent_42%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:34px_34px]" />
        <div className="absolute -right-16 -top-16 h-44 w-44 rounded-full bg-blue-500/25 blur-3xl" />
        <div className="absolute -bottom-16 left-1/3 h-36 w-36 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em] text-blue-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]" />
              <Sparkles size={12} />
              Workspace control
            </span>
            <h1 className="mt-2 text-xl font-black tracking-tight sm:text-2xl">
              Branches & Companies
            </h1>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-slate-400">
              Keep every company, team, inventory item, party, and transaction
              organized in the right branch.
            </p>
          </div>
          {canManage && (
            <button
              onClick={() => setBranchForm({})}
              className="group inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-xs font-extrabold shadow-lg shadow-blue-950/40 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-500"
            >
              <Plus size={14} className="transition-transform duration-300 group-hover:rotate-90" />
              Create Branch
            </button>
          )}
        </div>
        <div className="relative h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-400" />
      </section>

      {loading ? (
        <section className="rounded-2xl border bg-white">
          <LoadingState label="Loading branches..." />
        </section>
      ) : error ? (
        <section className="rounded-2xl border bg-white">
          <ErrorState message={error} onRetry={() => void load()} />
        </section>
      ) : !branches.length ? (
        <section className="rounded-2xl border border-dashed border-blue-200 bg-gradient-to-br from-white to-blue-50 py-6">
          <EmptyState
            icon={GitBranch}
            title="Create your first branch"
            description="Start with a branch, then add its companies."
          />
          {canManage && (
            <div className="flex justify-center">
              <button
                onClick={() => setBranchForm({})}
                className="btn-primary"
              >
                Create Branch
              </button>
            </div>
          )}
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat
              icon={GitBranch}
              label="Total branches"
              value={branches.length}
            />
            <Stat
              icon={Building2}
              label="Total companies"
              value={totalCompanies}
            />
            <Stat
              icon={ReceiptText}
              label="In selected branch"
              value={branch?.businesses.length ?? 0}
            />
          </section>
          <section>
            <div className="mb-2.5 flex items-end justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">
                  Step 1
                </p>
                <h2 className="text-base font-black text-slate-950">
                  Choose a branch
                </h2>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-500">
                {branches.length} available
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {branches.map((item) => {
                const selected = item.id === branchId;
                return (
                  <div
                    key={item.id}
                    className={`group overflow-hidden rounded-xl border shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${selected ? "border-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white" : "border-slate-200 bg-white hover:border-blue-200"}`}
                  >
                    <button
                      type="button"
                      onClick={() => selectBranch(item)}
                      className="block w-full p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                    >
                      <div className="flex justify-between">
                        <span
                          className={`flex h-9 w-9 items-center justify-center rounded-lg ${selected ? "bg-white/15" : "bg-blue-50 text-blue-600"}`}
                        >
                          <GitBranch size={16} />
                        </span>
                        {selected ? (
                          <span className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-extrabold">
                            <Check size={11} />
                            Selected
                          </span>
                        ) : (
                          <ArrowRight
                            size={15}
                            className="text-slate-300 transition group-hover:translate-x-1 group-hover:text-blue-600"
                          />
                        )}
                      </div>
                      <h3 className="mt-3 truncate text-sm font-black">{item.name}</h3>
                      <div
                        className={`mt-1.5 flex items-center gap-1.5 text-[11px] ${selected ? "text-blue-100" : "text-slate-500"}`}
                      >
                        <span
                          className={`rounded-md px-1.5 py-0.5 font-black ${selected ? "bg-white/10" : "bg-slate-100"}`}
                        >
                          {item.code}
                        </span>
                        <span>
                          {item.businesses.length}{" "}
                          {item.businesses.length === 1 ? "company" : "companies"}
                        </span>
                      </div>
                      {item.address && (
                        <p
                          className={`mt-2 flex items-center gap-1.5 truncate text-[11px] ${selected ? "text-blue-100" : "text-slate-400"}`}
                        >
                          <MapPin size={11} />
                          {item.address}
                        </p>
                      )}
                    </button>
                    {canManage && (
                      <div className={`flex border-t ${selected ? "border-white/15" : "border-slate-100"}`}>
                        <button
                          type="button"
                          onClick={() => setBranchForm({ branch: item })}
                          aria-label={`Edit ${item.name}`}
                          className={`inline-flex flex-1 items-center justify-center gap-1 border-r py-1.5 text-[10px] font-bold transition ${selected ? "border-white/15 text-blue-100 hover:bg-white/10" : "border-slate-100 text-slate-600 hover:bg-blue-50 hover:text-blue-700"}`}
                        >
                          <Pencil aria-hidden="true" size={11} /> Edit
                        </button>
                        <button
                          type="button"
                          disabled={item.businesses.length > 0}
                          title={item.businesses.length > 0 ? "Move or delete its companies first" : undefined}
                          onClick={() => setConfirm({ kind: "branch", branch: item })}
                          aria-label={`Delete ${item.name}`}
                          className={`inline-flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${selected ? "text-red-200 hover:bg-red-500/10" : "text-red-600 hover:bg-red-50"}`}
                        >
                          <Trash2 aria-hidden="true" size={11} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          {branch && (
            <section>
              <div className="mb-2.5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.15em] text-blue-600">
                    Step 2 · Company workspace
                  </p>

                  <h2 className="text-base font-black text-slate-950">
                    Companies in {branch.name}
                  </h2>

                  <p className="mt-1 text-[11px] text-slate-500">
                    Companies from other branches stay hidden.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative block w-full sm:w-52">
                    {!search && (
                      <Search
                        aria-hidden="true"
                        size={14}
                        className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
                      />
                    )}

                    <input
                      type="text"
                      aria-label="Search companies"
                      placeholder="Search companies"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      className={`input-field h-9 w-full pr-9 ${search ? "!pl-3.5" : "!pl-10"
                        }`}
                    />

                    {search && (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Clear search"
                        className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      >
                        <X aria-hidden="true" size={13} />
                      </button>
                    )}
                  </label>

                  {canManage && (
                    <button
                      type="button"
                      onClick={() => setCompanyForm({})}
                      className="btn-primary inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap text-xs"
                    >
                      <Plus size={13} />
                      Add Company
                    </button>
                  )}
                </div>
              </div>
              {!companies.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 py-8">
                  <EmptyState
                    icon={Building2}
                    title={
                      search
                        ? "No matching companies"
                        : "No companies in this branch"
                    }
                    description={
                      search
                        ? "Try another name or GSTIN."
                        : "Add the first company to this branch."
                    }
                  />
                  {!search && canManage && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => setCompanyForm({})}
                        className="btn-primary"
                      >
                        Add First Company
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {companies.map((company) => {
                    const active = company.id === companyId;
                    return (
                      <div
                        key={company.id}
                        className={`group overflow-hidden rounded-xl border transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 hover:border-blue-200"}`}
                      >
                        <button
                          type="button"
                          onClick={() => selectCompany(company)}
                          className="block w-full p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-400"
                        >
                          <div className="flex justify-between">
                            <span
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-600 group-hover:text-white"}`}
                            >
                              <Building2 size={15} />
                            </span>
                            {active && (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700">
                                <Check size={11} />
                                Active
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 truncate text-sm font-black text-slate-950">
                            {company.name}
                          </h3>
                          <p className="mt-1 truncate text-[11px] text-slate-500">
                            {company.legalName || "Company workspace"}
                          </p>
                          <div className="mt-3 flex items-center justify-between border-t pt-2.5">
                            <span
                              className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${company.gstRegistered ? "bg-blue-50 text-blue-700" : "bg-violet-50 text-violet-700"}`}
                            >
                              {company.gstRegistered
                                ? "GST Registered"
                                : "Non GST"}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                              {company.gstin ||
                                `${company._count?.invoices ?? 0} invoices`}
                            </span>
                          </div>
                        </button>
                        {canManage && (
                          <div className="flex border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => setCompanyForm({ business: company })}
                              aria-label={`Edit ${company.name}`}
                              className="inline-flex flex-1 items-center justify-center gap-1 border-r border-slate-100 py-1.5 text-[10px] font-bold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              <Pencil aria-hidden="true" size={11} /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirm({ kind: "company", company })}
                              aria-label={`Delete ${company.name}`}
                              className="inline-flex flex-1 items-center justify-center gap-1 py-1.5 text-[10px] font-bold text-red-600 transition hover:bg-red-50"
                            >
                              <Trash2 aria-hidden="true" size={11} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {branchForm && (
        <BranchFormModal
          branch={branchForm.branch}
          onClose={() => setBranchForm(null)}
          onSaved={(saved) => {
            const editing = Boolean(branchForm.branch);
            setBranchForm(null);
            if (editing) {
              setBranches((current) =>
                current.map((item) => (item.id === saved.id ? { ...item, ...saved, businesses: saved.businesses ?? item.businesses } : item)),
              );
            } else {
              setBranches((current) => [
                ...current,
                { ...saved, businesses: saved.businesses ?? [] },
              ]);
              setBranchId(saved.id);
              setActiveWorkspaceBranchId(saved.id);
            }
            toast.success(editing ? `${saved.name} was updated.` : `${saved.name} was added.`);
          }}
        />
      )}
      {companyForm && branch && (
        <BusinessFormModal
          business={companyForm.business}
          branch={branch}
          onClose={() => setCompanyForm(null)}
          onSaved={(saved) => {
            const editing = Boolean(companyForm.business);
            setCompanyForm(null);
            toast.success(editing ? `${saved.name} was updated.` : `${saved.name} was added.`);
            void load();
          }}
        />
      )}
      {confirm?.kind === "branch" && (
        <ConfirmDialog
          title="Delete branch?"
          message={`Delete ${confirm.branch.name} (${confirm.branch.code})? This cannot be undone.`}
          confirmLabel="Delete branch"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deleteBranch(confirm.branch)}
        />
      )}
      {confirm?.kind === "company" && (
        <ConfirmDialog
          title="Delete company?"
          message={`Delete ${confirm.company.name}? It will be removed from your workspace. Its invoices and records are kept for audit and are not permanently erased.`}
          confirmLabel="Delete company"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deleteCompany(confirm.company)}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof GitBranch;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-bold text-slate-500">{label}</p>
        <p className="text-lg font-black text-slate-950">
          {value.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
