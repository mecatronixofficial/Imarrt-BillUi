"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";

import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Power,
  ReceiptText,
  Search,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import ConfirmDialog from "@/components/ConfirmDialog";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";

import {
  api,
  clearActiveBusiness,
  getAllPages,
  getActiveBranchId,
  getActiveBusinessId,
  getApiError,
  getCurrentUser,
  setActiveBranchId,
  setActiveBusinessId,
} from "@/lib/api";

import { formatDate } from "@/lib/format";

import type { Branch, Business } from "@/types";

import { BranchFormModal, BusinessFormModal } from "./BusinessForms";
import BranchCompaniesPage from "./StylishBusinessPage";

/* ========================================================================== */
/* TYPES + HELPERS                                                            */
/* ========================================================================== */

type Feedback = { type: "success" | "error"; text: string };

type BusinessModal = { business?: Business } | null;
type BranchModal = { branch?: Branch } | null;

type BranchNode = { branch: Branch; depth: number; parentName?: string; subCount: number };

/** Orders branches depth-first so each sub-branch follows its parent. */
function buildBranchTree(branches: Branch[]): BranchNode[] {
  const ids = new Set(branches.map(({ id }) => id));
  const children = new Map<string, Branch[]>();
  const roots: Branch[] = [];

  for (const branch of branches) {
    if (branch.parentId && ids.has(branch.parentId)) {
      children.set(branch.parentId, [...(children.get(branch.parentId) ?? []), branch]);
    } else {
      roots.push(branch);
    }
  }

  const nodes: BranchNode[] = [];
  const names = new Map(branches.map(({ id, name }) => [id, name]));

  const visit = (branch: Branch, depth: number) => {
    nodes.push({
      branch,
      depth,
      parentName: branch.parentId ? names.get(branch.parentId) : undefined,
      subCount: children.get(branch.id)?.length ?? 0,
    });

    // `depth` cap only guards against corrupted cyclic data.
    if (depth < 10) children.get(branch.id)?.forEach((child) => visit(child, depth + 1));
  };

  roots.forEach((root) => visit(root, 0));

  return nodes;
}

type ConfirmTarget =
  | { kind: "business"; business: Business }
  | { kind: "branch"; branch: Branch }
  | null;

const EMPTY_BRANCH_COUNT = { invoices: 0, productionOrders: 0, documents: 0 };

function branchTransactionCount(branch: Branch) {
  const { invoices, productionOrders, documents } =
    branch._count ?? EMPTY_BRANCH_COUNT;

  return invoices + productionOrders + documents;
}

/* ========================================================================== */
/* PAGE                                                                       */
/* ========================================================================== */

function LegacyBusinessesPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesByBusiness, setBranchesByBusiness] = useState<Record<string, Branch[]>>({});

  const [activeId, setActiveId] = useState("");
  const [activeBranchId, setSelectedBranchId] = useState("");

  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");

  const [businessModal, setBusinessModal] = useState<BusinessModal>(null);
  const [branchModal, setBranchModal] = useState<BranchModal>(null);
  const [confirm, setConfirm] = useState<ConfirmTarget>(null);

  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  /* ====================================================================== */
  /* FEEDBACK                                                               */
  /* ====================================================================== */

  useEffect(() => {
    if (feedback?.type !== "success") return;

    const timer = window.setTimeout(() => setFeedback(null), 5000);

    return () => window.clearTimeout(timer);
  }, [feedback]);

  /* ====================================================================== */
  /* LOAD                                                                   */
  /* ====================================================================== */

  /** Loads the active company's branches and resolves the selected branch. */
  const loadBranches = useCallback(async (businessId: string, preferredCode?: string) => {
    const { data } = await getAllPages<Branch>("/branches", {
      headers: { "X-Business-Id": businessId },
    });

    setBranches(data);
    setBranchesByBusiness((current) => ({ ...current, [businessId]: data }));

    const stored = getActiveBranchId(businessId);

    const selected =
      data.find(({ code, isActive }) => code === preferredCode && isActive)?.id ??
      (stored === "all" ||
      data.some(({ id, isActive }) => id === stored && isActive)
        ? stored!
        : (data.find(({ isActive }) => isActive)?.id ?? ""));

    if (selected) setActiveBranchId(selected, businessId);

    setSelectedBranchId(selected);
  }, []);

  const loadBusinesses = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const [{ data }, user] = await Promise.all([
          getAllPages<Business>("/businesses"),
          getCurrentUser(),
        ]);

        setBusinesses(data);

        const branchEntries = await Promise.all(
          data.map(async (business) => {
            const response = await getAllPages<Branch>("/branches", {
              headers: { "X-Business-Id": business.id },
            });
            return [business.id, response.data] as const;
          }),
        );
        setBranchesByBusiness(Object.fromEntries(branchEntries));

        setCanManage(user?.role === "OWNER" || user?.role === "SUPER_ADMIN");

        const stored = getActiveBusinessId();

        const selected = data.some(({ id }) => id === stored)
          ? stored!
          : (data[0]?.id ?? "");

        if (selected) setActiveBusinessId(selected);

        setActiveId(selected);

        if (selected) {
          await loadBranches(selected);
        } else {
          setBranches([]);
          setSelectedBranchId("");
        }
      } catch (loadError: unknown) {
        setError(getApiError(loadError, "Could not load businesses."));
      } finally {
        setLoading(false);
      }
    },
    [loadBranches],
  );

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    if (!canManage || typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("newCompany") !== "1") return;
    setBusinessModal({});
    window.history.replaceState(null, "", window.location.pathname);
  }, [canManage]);

  /* ====================================================================== */
  /* COMPUTED                                                               */
  /* ====================================================================== */

  const activeBusiness = useMemo(
    () => businesses.find(({ id }) => id === activeId),
    [businesses, activeId],
  );

  const totals = useMemo(
    () => ({
      branches: businesses.reduce(
        (sum, business) => sum + (business._count?.branches ?? 0),
        0,
      ),
      invoices: businesses.reduce(
        (sum, business) => sum + (business._count?.invoices ?? 0),
        0,
      ),
      members: businesses.reduce(
        (sum, business) => sum + (business._count?.members ?? 0),
        0,
      ),
    }),
    [businesses],
  );

  const branchTree = useMemo(() => buildBranchTree(branches), [branches]);

  const activeBranch = useMemo(
    () => branches.find(({ id }) => id === activeBranchId),
    [branches, activeBranchId],
  );

  const branchBusinesses = useMemo(() => {
    if (!activeBranch || activeBranchId === "all") return businesses;

    return businesses.filter((business) =>
      (branchesByBusiness[business.id] ?? []).some(
        ({ code, isActive }) => code === activeBranch.code && isActive,
      ),
    );
  }, [activeBranch, activeBranchId, branchesByBusiness, businesses]);

  const visibleBusinesses = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return branchBusinesses;

    return branchBusinesses.filter(({ name, legalName, gstin }) =>
      [name, legalName, gstin].some((value) =>
        value?.toLowerCase().includes(query),
      ),
    );
  }, [branchBusinesses, search]);

  /* ====================================================================== */
  /* SELECT BUSINESS / BRANCH                                               */
  /* ====================================================================== */

  async function selectBusiness(businessId: string) {
    if (businessId === activeId || switching) return;

    setSwitching(true);
    setFeedback(null);

    const selectedBranchCode = activeBranch?.code;

    setActiveBusinessId(businessId);
    setActiveId(businessId);

    try {
      await loadBranches(businessId, selectedBranchCode);

      setFeedback({
        type: "success",
        text: "Company selected. Choose a branch or open the dashboard.",
      });
    } catch (switchError: unknown) {
      setFeedback({
        type: "error",
        text: getApiError(
          switchError,
          "Could not load branches for this company.",
        ),
      });
    } finally {
      setSwitching(false);
    }
  }

  function selectBranch(branchId: string) {
    setActiveBranchId(branchId, activeId);
    setSelectedBranchId(branchId);

    setFeedback({
      type: "success",
      text:
        branchId === "all"
          ? "All-branches reporting view selected."
          : "Branch selected successfully.",
    });
  }

  /** Falls back to another active branch when the selected one goes away. */
  function reselectBranch(remaining: Branch[], removedId: string) {
    if (activeBranchId !== removedId) return;

    const next = remaining.find(
      ({ id, isActive }) => id !== removedId && isActive,
    )?.id;

    setActiveBranchId(next ?? "all", activeId);
    setSelectedBranchId(next ?? "all");
  }

  /* ====================================================================== */
  /* COMPANY CRUD                                                           */
  /* ====================================================================== */

  function handleBusinessSaved(saved: Business) {
    const editing = Boolean(businessModal?.business);

    setBusinessModal(null);

    if (!editing) {
      // A new company becomes the active workspace.
      setActiveBusinessId(saved.id);

      window.location.href = "/dashboard";

      return;
    }

    setBusinesses((current) =>
      current.map((business) =>
        business.id === saved.id ? { ...business, ...saved } : business,
      ),
    );

    setFeedback({ type: "success", text: `${saved.name} was updated.` });
  }

  async function deleteBusiness(target: Business) {
    setBusy(true);
    setFeedback(null);

    try {
      await api.delete(`/businesses/${target.id}`);

      if (target.id === activeId) clearActiveBusiness();

      setConfirm(null);

      await loadBusinesses({ silent: true });

      setFeedback({
        type: "success",
        text: `${target.name} was deleted.`,
      });
    } catch (deleteError: unknown) {
      setConfirm(null);

      setFeedback({
        type: "error",
        text: getApiError(deleteError, "Could not delete company."),
      });
    } finally {
      setBusy(false);
    }
  }

  /* ====================================================================== */
  /* BRANCH CRUD                                                            */
  /* ====================================================================== */

  function handleBranchSaved(saved: Branch) {
    const editing = Boolean(branchModal?.branch);

    setBranchModal(null);

    if (editing) {
      const updateBranch = (current: Branch[]) =>
        current.map((branch) =>
          branch.id === saved.id
            ? { ...branch, ...saved, _count: saved._count ?? branch._count }
            : branch,
        );

      setBranches(updateBranch);
      setBranchesByBusiness((current) => ({
        ...current,
        [activeId]: updateBranch(current[activeId] ?? []),
      }));

      setFeedback({ type: "success", text: `${saved.name} was updated.` });

      return;
    }

    setBranches((current) => [
      ...current,
      { ...saved, _count: saved._count ?? EMPTY_BRANCH_COUNT },
    ]);
    setBranchesByBusiness((current) => ({
      ...current,
      [activeId]: [
        ...(current[activeId] ?? []),
        { ...saved, _count: saved._count ?? EMPTY_BRANCH_COUNT },
      ],
    }));

    setActiveBranchId(saved.id, activeId);
    setSelectedBranchId(saved.id);

    setFeedback({ type: "success", text: `${saved.name} was added.` });
  }

  async function toggleBranch(branch: Branch) {
    setBusy(true);
    setFeedback(null);

    try {
      const { data } = await api.patch<Branch>(`/branches/${branch.id}`, {
        isActive: !branch.isActive,
      });

      const next = branches.map((current) =>
        current.id === branch.id
          ? { ...current, ...data, _count: data._count ?? current._count }
          : current,
      );

      setBranches(next);
      setBranchesByBusiness((current) => ({ ...current, [activeId]: next }));

      if (branch.isActive) reselectBranch(next, branch.id);

      setFeedback({
        type: "success",
        text: `${branch.name} was ${branch.isActive ? "deactivated" : "activated"}.`,
      });
    } catch (toggleError: unknown) {
      setFeedback({
        type: "error",
        text: getApiError(toggleError, "Could not update branch."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function deleteBranch(target: Branch) {
    setBusy(true);
    setFeedback(null);

    try {
      await api.delete(`/branches/${target.id}`);

      const remaining = branches.filter(({ id }) => id !== target.id);

      setBranches(remaining);
      setBranchesByBusiness((current) => ({ ...current, [activeId]: remaining }));
      reselectBranch(remaining, target.id);

      setConfirm(null);

      setFeedback({ type: "success", text: `${target.name} was deleted.` });
    } catch (deleteError: unknown) {
      setConfirm(null);

      setFeedback({
        type: "error",
        text: getApiError(deleteError, "Could not delete branch."),
      });
    } finally {
      setBusy(false);
    }
  }

  /* ====================================================================== */
  /* UI                                                                     */
  /* ====================================================================== */

  const hasBusinesses = !loading && !error && businesses.length > 0;

  return (
    <>
      <div className="min-h-screen bg-slate-50/60">
        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <section className="relative mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-[35%] h-40 w-40 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-600" />

                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Workspace Management
                </span>
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Companies & Branches
              </h1>

              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                Select the company and branch where billing, inventory,
                production and reports should operate.
              </p>
            </div>

            {canManage && (
              <button
                type="button"
                onClick={() => setBusinessModal({})}
                className="group inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white shadow-[0_8px_20px_rgba(37,99,235,0.20)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_12px_25px_rgba(37,99,235,0.28)]"
              >
                <Plus
                  size={14}
                  className="transition-transform duration-300 group-hover:rotate-90"
                />
                Add Company
              </button>
            )}
          </div>

          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
        </section>

        {/* ================================================================ */}
        {/* FEEDBACK                                                         */}
        {/* ================================================================ */}

        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            className={`mb-4 flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-xs font-semibold shadow-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50/80 text-red-700"
                : "border-emerald-200 bg-emerald-50/80 text-emerald-700"
            }`}
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                feedback.type === "error" ? "bg-red-100" : "bg-emerald-100"
              }`}
            >
              {feedback.type === "error" ? (
                <AlertCircle size={13} />
              ) : (
                <Check size={13} strokeWidth={3} />
              )}
            </span>

            <span className="min-w-0 flex-1 pt-1">{feedback.text}</span>

            <button
              type="button"
              onClick={() => setFeedback(null)}
              aria-label="Dismiss message"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg opacity-60 transition hover:bg-black/5 hover:opacity-100"
            >
              <X size={13} />
            </button>
          </div>
        )}

        {/* ================================================================ */}
        {/* CONTENT                                                          */}
        {/* ================================================================ */}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <LoadingState label="Loading businesses..." />
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-100 bg-white shadow-sm">
            <ErrorState message={error} onRetry={() => void loadBusinesses()} />
          </section>
        ) : businesses.length === 0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <EmptyState
              icon={Building2}
              title="No company added"
              description="Add a company first. Its Main Branch will be created automatically."
            />

            {canManage && (
              <div className="flex justify-center pb-6">
                <button
                  type="button"
                  onClick={() => setBusinessModal({})}
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <Plus size={14} />
                  Add Your Company
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-4">
            {/* ============================================================ */}
            {/* METRICS                                                      */}
            {/* ============================================================ */}

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric
                icon={Building2}
                label="Companies"
                value={branchBusinesses.length}
                tone="blue"
                description={activeBranch ? `In ${activeBranch.name}` : "Available workspaces"}
              />

              <Metric
                icon={GitBranch}
                label="Branches"
                value={totals.branches || branches.length}
                tone="violet"
                description="Operational units"
              />

              <Metric
                icon={ReceiptText}
                label="Invoices"
                value={totals.invoices}
                tone="amber"
                description="Total transactions"
              />

              <Metric
                icon={Users}
                label="Team Members"
                value={totals.members}
                tone="emerald"
                description="Workspace users"
              />
            </section>

            {/* ============================================================ */}
            {/* COMPANY SELECTOR                                             */}
            {/* ============================================================ */}

            <section>
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-blue-600" />

                    <h2 className="text-sm font-extrabold text-slate-950">
                      {activeBranch ? `${activeBranch.name} Companies` : "Select Company"}
                    </h2>
                  </div>

                  <p className="mt-1 text-[11px] text-slate-400">
                    {activeBranch
                      ? `Only companies assigned to ${activeBranch.name} are shown`
                      : "Choose a company first, then select one of its branches"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {branchBusinesses.length > 3 && (
                    <label className="relative block">
                      <span className="sr-only">Search companies</span>

                      <Search
                        aria-hidden="true"
                        size={13}
                        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="search"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search companies"
                        className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-2.5 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                      />
                    </label>
                  )}

                  <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-500 shadow-sm">
                    {visibleBusinesses.length === branchBusinesses.length
                      ? `${branchBusinesses.length} Companies`
                      : `${visibleBusinesses.length} of ${branchBusinesses.length}`}
                  </span>
                </div>
              </div>

              {visibleBusinesses.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center">
                  <p className="text-xs text-slate-500">
                    {search.trim()
                      ? `No company matches “${search.trim()}”.`
                      : activeBranch
                        ? `No companies have been added to ${activeBranch.name} yet.`
                        : "No companies available."}
                  </p>
                  {!search.trim() && activeBranch && canManage && (
                    <button
                      type="button"
                      onClick={() => setBusinessModal({})}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-[11px] font-extrabold text-white transition hover:bg-blue-700"
                    >
                      <Plus size={13} />
                      Add Company to {activeBranch.name}
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {visibleBusinesses.map((business) => (
                    <CompanyCard
                      key={business.id}
                      business={business}
                      branches={branchesByBusiness[business.id] ?? []}
                      active={business.id === activeId}
                      switching={switching}
                      canManage={canManage}
                      onSelect={() => void selectBusiness(business.id)}
                      onEdit={() => setBusinessModal({ business })}
                      onDelete={() => setConfirm({ kind: "business", business })}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* ACTIVE COMPANY WORKSPACE                                         */}
        {/* ================================================================ */}

        {hasBusinesses && activeBusiness && (
          <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
            {/* Workspace header */}

            <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-4 py-4 sm:px-5">
              <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

              <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mb-1.5 flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em] text-blue-300">
                      Selected Workspace
                    </span>

                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        activeBusiness.gstRegistered
                          ? "bg-blue-500/20 text-blue-200"
                          : "bg-violet-500/20 text-violet-200"
                      }`}
                    >
                      {activeBusiness.gstRegistered ? "GST Registered" : "Non GST"}
                    </span>
                  </div>

                  <h2 className="truncate text-lg font-black text-white">
                    {activeBusiness.name}
                  </h2>

                  <p className="mt-1 truncate text-xs text-slate-400">
                    {activeBusiness.legalName ||
                      activeBusiness.address ||
                      "Company workspace"}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setBusinessModal({ business: activeBusiness })
                        }
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-bold text-white transition-all hover:bg-white/20"
                      >
                        <Pencil size={12} />
                        Edit Company
                      </button>

                      <button
                        type="button"
                        onClick={() => setBranchModal({})}
                        className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[11px] font-bold text-white transition-all hover:bg-white/20"
                      >
                        <Plus
                          size={12}
                          className="transition-transform group-hover:rotate-90"
                        />
                        Add Branch
                      </button>
                    </>
                  )}

                  <Link
                    href="/dashboard"
                    className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[11px] font-extrabold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500"
                  >
                    <LayoutDashboard size={12} />
                    Open Dashboard
                    <ChevronRight
                      size={11}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>
            </div>

            {/* Company facts */}

            <div className="grid grid-cols-1 gap-px border-b border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
              <CompanyFact
                label="GSTIN"
                value={
                  activeBusiness.gstRegistered
                    ? activeBusiness.gstin || "Not added"
                    : "Not applicable"
                }
                icon={FileCheck2}
              />

              <CompanyFact
                label="Contact"
                value={
                  [activeBusiness.phone, activeBusiness.email]
                    .filter(Boolean)
                    .join(" · ") || "Not provided"
                }
                icon={Users}
              />

              <CompanyFact
                label="Address"
                value={activeBusiness.address || "Not provided"}
                icon={MapPinned}
              />

              <CompanyFact
                label="Workspace Status"
                value={
                  activeBusiness.isActive
                    ? `Active since ${formatDate(activeBusiness.createdAt)}`
                    : "Inactive"
                }
                icon={ShieldCheck}
              />
            </div>

            {/* Branch header */}

            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div>
                <h3 className="text-sm font-extrabold text-slate-950">
                  Branches
                </h3>

                <p className="mt-0.5 text-[11px] text-slate-400">
                  Select where new operational records should be created.
                </p>
              </div>

              <button
                type="button"
                onClick={() => selectBranch("all")}
                aria-pressed={activeBranchId === "all"}
                className={`inline-flex h-8 items-center justify-center rounded-lg border px-3 text-[11px] font-extrabold transition-all ${
                  activeBranchId === "all"
                    ? "border-slate-900 bg-slate-900 text-white shadow-md"
                    : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                All Branches View
              </button>
            </div>

            {/* Branch cards */}

            {branches.length === 0 ? (
              <EmptyState
                icon={GitBranch}
                title="No branches yet"
                description="Add a branch to start creating invoices, documents and production orders."
              />
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {branchTree.map(({ branch, depth, parentName, subCount }) => (
                  <BranchCard
                    key={branch.id}
                    branch={branch}
                    depth={depth}
                    parentName={parentName}
                    subCount={subCount}
                    active={branch.id === activeBranchId}
                    canManage={canManage}
                    busy={busy}
                    onSelect={() => selectBranch(branch.id)}
                    onEdit={() => setBranchModal({ branch })}
                    onToggle={() => void toggleBranch(branch)}
                    onDelete={() => setConfirm({ kind: "branch", branch })}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ================================================================ */}
        {/* WORKSPACE INFO                                                   */}
        {/* ================================================================ */}

        {hasBusinesses && (
          <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50/50 p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <ShieldCheck size={15} />
            </span>

            <div>
              <p className="text-xs font-extrabold text-blue-900">
                Workspace Separation
              </p>

              <p className="mt-0.5 text-xs leading-5 text-blue-700">
                Select a branch first, then choose one of its companies. Parties,
                suppliers and items follow the branch. Invoices, purchases,
                production and reports follow the selected company.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ================================================================== */}
      {/* MODALS                                                             */}
      {/* ================================================================== */}

      {businessModal && (
        <BusinessFormModal
          business={businessModal.business}
          branch={businessModal.business ? undefined : activeBranch}
          onClose={() => setBusinessModal(null)}
          onSaved={handleBusinessSaved}
        />
      )}

      {branchModal && (
        <BranchFormModal
          branch={branchModal.branch as unknown as import("@/types").WorkspaceBranch}
          onClose={() => setBranchModal(null)}
          onSaved={(saved) => handleBranchSaved(saved as unknown as Branch)}
        />
      )}

      {confirm?.kind === "business" && (
        <ConfirmDialog
          title="Delete company?"
          message={`Delete ${confirm.business.name}? It will be removed from your workspace along with access to its branches. Its invoices and records are kept for audit and are not permanently erased.`}
          confirmLabel="Delete company"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deleteBusiness(confirm.business)}
        />
      )}

      {confirm?.kind === "branch" && (
        <ConfirmDialog
          title="Delete branch?"
          message={`Delete ${confirm.branch.name} (${confirm.branch.code})? This branch has no transactions. This cannot be undone.`}
          confirmLabel="Delete branch"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void deleteBranch(confirm.branch)}
        />
      )}
    </>
  );
}

export default BranchCompaniesPage;

/* ========================================================================== */
/* COMPANY CARD                                                               */
/* ========================================================================== */

function CompanyCard({
  business,
  branches,
  active,
  switching,
  canManage,
  onSelect,
  onEdit,
  onDelete,
}: {
  business: Business;
  branches: Branch[];
  active: boolean;
  switching: boolean;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-2xl border transition-all duration-300 ${
        active
          ? "border-blue-300 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-[0_12px_30px_rgba(37,99,235,0.10)] ring-4 ring-blue-50"
          : "border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(37,99,235,0.08)]"
      }`}
    >
      <button
        type="button"
        disabled={switching}
        aria-pressed={active}
        onClick={onSelect}
        className="block w-full p-4 text-left disabled:cursor-wait focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] ${
                  business.gstRegistered
                    ? "bg-blue-50 text-blue-700"
                    : "bg-violet-50 text-violet-700"
                }`}
              >
                {business.gstRegistered ? "GST Registered" : "Non GST"}
              </span>

              {active && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
            </div>

            <h3 className="truncate text-sm font-black text-slate-950">
              {business.name}
            </h3>

            {business.legalName && business.legalName !== business.name && (
              <p className="mt-1 truncate text-[11px] text-slate-400">
                {business.legalName}
              </p>
            )}
          </div>

          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
              active
                ? "bg-blue-600 text-white"
                : "bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white"
            }`}
          >
            {active ? (
              <Check size={14} strokeWidth={3} />
            ) : (
              <ChevronRight
                size={14}
                className="transition-transform group-hover:translate-x-0.5"
              />
            )}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              GSTIN
            </p>

            <p className="mt-1 truncate text-xs font-bold text-slate-700">
              {business.gstRegistered
                ? business.gstin || "Not added"
                : "Not applicable"}
            </p>
          </div>

          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Invoices
            </p>

            <p className="mt-1 text-xs font-extrabold text-slate-800">
              {(business._count?.invoices ?? 0).toLocaleString("en-IN")}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-400">
            <span>Branches under this company</span>
            <span>{branches.length}</span>
          </p>
          {branches.length ? (
            <div className="flex flex-wrap gap-1.5">
              {branches.map((branch) => (
                <span
                  key={branch.id}
                  className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-bold ${
                    branch.isActive
                      ? "border-blue-100 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-50 text-slate-400"
                  }`}
                >
                  <MapPin size={9} />
                  {branch.name}
                  <span className="font-medium opacity-60">({branch.code})</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">No branches added</p>
          )}
        </div>
      </button>

      {canManage && (
        <div className="flex border-t border-slate-100 bg-white/60">
          <CardAction icon={Pencil} label="Edit" onClick={onEdit} ariaLabel={`Edit ${business.name}`} />

          <CardAction icon={Trash2} label="Delete" tone="danger" onClick={onDelete} ariaLabel={`Delete ${business.name}`} />
        </div>
      )}

      <span
        className={`pointer-events-none absolute left-0 top-0 h-[3px] bg-blue-600 transition-all duration-300 ${
          active ? "w-full" : "w-0 group-hover:w-full"
        }`}
      />
    </div>
  );
}

/* ========================================================================== */
/* BRANCH CARD                                                                */
/* ========================================================================== */

function BranchCard({
  branch,
  depth,
  parentName,
  subCount,
  active,
  canManage,
  busy,
  onSelect,
  onEdit,
  onToggle,
  onDelete,
}: {
  branch: Branch;
  depth: number;
  parentName?: string;
  subCount: number;
  active: boolean;
  canManage: boolean;
  busy: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  // Branches with transactions or sub-branches are kept; the server enforces the same rule.
  const canDelete = branchTransactionCount(branch) === 0 && subCount === 0;

  const contact = [branch.phone, branch.email].filter(Boolean).join(" · ");

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-xl border transition-all duration-300 ${
        active
          ? "border-blue-300 bg-blue-50/60 shadow-[0_8px_22px_rgba(37,99,235,0.08)] ring-2 ring-blue-100"
          : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(37,99,235,0.07)]"
      } ${branch.isActive ? "" : "bg-slate-50"} ${depth > 0 ? "border-l-4 border-l-violet-300" : ""}`}
    >
      <button
        type="button"
        disabled={!branch.isActive}
        aria-pressed={active}
        onClick={onSelect}
        className="block w-full p-3.5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:cursor-not-allowed"
      >
        <div
          className={`flex items-start gap-3 ${branch.isActive ? "" : "opacity-60"}`}
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-300 ${
              active
                ? "bg-blue-600 text-white"
                : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
            }`}
          >
            <MapPin size={15} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="truncate text-xs font-extrabold text-slate-900">
                {branch.name}
              </h4>

              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-500">
                {branch.code}
              </span>

              {!branch.isActive && (
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black uppercase text-amber-700">
                  Inactive
                </span>
              )}
            </div>

            {(parentName || subCount > 0) && (
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-violet-600">
                {parentName && (
                  <span className="truncate rounded bg-violet-50 px-1.5 py-0.5">
                    Sub-branch of {parentName}
                  </span>
                )}

                {subCount > 0 && (
                  <span className="rounded bg-violet-50 px-1.5 py-0.5">
                    {subCount} sub-branch{subCount === 1 ? "" : "es"}
                  </span>
                )}
              </p>
            )}

            <p className="mt-1 truncate text-[11px] text-slate-400">
              {branch.address || "No branch address"}
            </p>

            {contact && (
              <p className="mt-0.5 truncate text-[11px] text-slate-400">
                {contact}
              </p>
            )}
          </div>

          {active && (
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
              <Check size={11} strokeWidth={3} />
            </span>
          )}
        </div>

        {branch._count && (
          <div
            className={`mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2.5 ${
              branch.isActive ? "" : "opacity-60"
            }`}
          >
            <BranchStat value={branch._count.invoices} label="Invoices" />

            <BranchStat value={branch._count.documents} label="Documents" />

            <BranchStat
              value={branch._count.productionOrders}
              label="Production"
            />
          </div>
        )}
      </button>

      {canManage && (
        <div className="flex border-t border-slate-100 bg-white/60">
          <CardAction icon={Pencil} label="Edit" onClick={onEdit} ariaLabel={`Edit ${branch.name}`} />

          <CardAction
            icon={Power}
            label={branch.isActive ? "Deactivate" : "Activate"}
            disabled={busy}
            onClick={onToggle}
            ariaLabel={`${branch.isActive ? "Deactivate" : "Activate"} ${branch.name}`}
          />

          {canDelete && (
            <CardAction icon={Trash2} label="Delete" tone="danger" disabled={busy} onClick={onDelete} ariaLabel={`Delete ${branch.name}`} />
          )}
        </div>
      )}

      <span
        className={`pointer-events-none absolute left-0 top-0 h-[2px] bg-blue-600 transition-all duration-300 ${
          active ? "w-full" : "w-0 group-hover:w-full"
        }`}
      />
    </div>
  );
}

/* ========================================================================== */
/* CARD ACTION                                                                */
/* ========================================================================== */

function CardAction({
  icon: Icon,
  label,
  ariaLabel,
  tone = "default",
  disabled = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  ariaLabel: string;
  tone?: "default" | "danger";
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 border-r border-slate-100 py-2 text-[11px] font-bold transition last:border-r-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 ${
        tone === "danger"
          ? "text-red-600 hover:bg-red-50"
          : "text-slate-600 hover:bg-blue-50 hover:text-blue-700"
      }`}
    >
      <Icon aria-hidden="true" size={12} />
      {label}
    </button>
  );
}

/* ========================================================================== */
/* METRIC CARD                                                                */
/* ========================================================================== */

const METRIC_TONES = {
  blue: {
    icon: "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    border: "hover:border-blue-200",
    accent: "bg-blue-600",
  },

  violet: {
    icon: "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    border: "hover:border-violet-200",
    accent: "bg-violet-500",
  },

  amber: {
    icon: "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
    border: "hover:border-amber-200",
    accent: "bg-amber-500",
  },

  emerald: {
    icon: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    border: "hover:border-emerald-200",
    accent: "bg-emerald-500",
  },
} as const;

function Metric({
  icon: Icon,
  label,
  value,
  tone,
  description,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  tone: keyof typeof METRIC_TONES;
  description: string;
}) {
  const style = METRIC_TONES[tone];

  return (
    <div
      className={`group relative min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_4px_18px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)] ${style.border}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value.toLocaleString("en-IN")}
          </p>

          <p className="mt-1 truncate text-[11px] text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110 ${style.icon}`}
        >
          <Icon size={17} />
        </span>
      </div>

      <span
        className={`absolute bottom-0 left-0 h-[3px] w-0 transition-all duration-300 group-hover:w-full ${style.accent}`}
      />
    </div>
  );
}

/* ========================================================================== */
/* COMPANY FACT                                                               */
/* ========================================================================== */

function CompanyFact({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
}) {
  return (
    <div className="group flex min-w-0 items-center gap-3 bg-slate-50 px-4 py-3 transition hover:bg-white">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 transition group-hover:bg-blue-600 group-hover:text-white">
        <Icon size={13} />
      </span>

      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className="mt-0.5 truncate text-xs font-extrabold text-slate-700"
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* BRANCH STAT                                                                */
/* ========================================================================== */

function BranchStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-xs font-black text-slate-800">
        {value.toLocaleString("en-IN")}
      </p>

      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}
