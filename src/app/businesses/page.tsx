"use client";

import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  Building2,
  Check,
  ChevronRight,
  FileCheck2,
  GitBranch,
  LayoutDashboard,
  MapPin,
  Plus,
  ReceiptText,
  ShieldCheck,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

import Modal from "@/components/Modal";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";

import {
  api,
  getAllPages,
  getActiveBranchId,
  getActiveBusinessId,
  getApiError,
  getCurrentUser,
  setActiveBranchId,
  setActiveBusinessId,
} from "@/lib/api";

import type {
  Branch,
  Business,
} from "@/types";

/* ========================================================================== */
/* PAGE                                                                       */
/* ========================================================================== */

export default function BusinessesPage() {
  const [businesses, setBusinesses] =
    useState<Business[]>([]);

  const [branches, setBranches] =
    useState<Branch[]>([]);

  const [activeId, setActiveId] =
    useState("");

  const [
    activeBranchId,
    setSelectedBranchId,
  ] = useState("");

  const [canCreate, setCanCreate] =
    useState(false);

  const [showForm, setShowForm] =
    useState(false);

  const [
    showBranchForm,
    setShowBranchForm,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  const [switching, setSwitching] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  /* ====================================================================== */
  /* LOAD                                                                   */
  /* ====================================================================== */

  const loadBusinesses =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const [
          { data },
          user,
        ] = await Promise.all([
          getAllPages<Business>(
            "/businesses",
          ),
          getCurrentUser(),
        ]);

        setBusinesses(data);

        setCanCreate(
          user?.role === "OWNER" ||
            user?.role ===
              "SUPER_ADMIN",
        );

        const stored =
          getActiveBusinessId();

        const selected =
          data.some(
            ({ id }) =>
              id === stored,
          )
            ? stored!
            : data[0]?.id ?? "";

        if (selected) {
          setActiveBusinessId(
            selected,
          );
        }

        setActiveId(selected);

        if (selected) {
          const {
            data:
              companyBranches,
          } =
            await getAllPages<Branch>(
              "/branches",
            );

          setBranches(
            companyBranches,
          );

          const storedBranch =
            getActiveBranchId(
              selected,
            );

          const selectedBranch =
            storedBranch ===
              "all" ||
            companyBranches.some(
              ({
                id,
                isActive,
              }) =>
                id ===
                  storedBranch &&
                isActive,
            )
              ? storedBranch!
              : companyBranches.find(
                    ({
                      isActive,
                    }) =>
                      isActive,
                  )?.id ?? "";

          if (selectedBranch) {
            setActiveBranchId(
              selectedBranch,
              selected,
            );
          }

          setSelectedBranchId(
            selectedBranch,
          );
        }
      } catch (
        loadError: unknown
      ) {
        setError(
          getApiError(
            loadError,
            "Could not load businesses.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  /* ====================================================================== */
  /* COMPUTED                                                               */
  /* ====================================================================== */

  const activeBusiness =
    useMemo(
      () =>
        businesses.find(
          ({ id }) =>
            id === activeId,
        ),
      [businesses, activeId],
    );

  const totals =
    useMemo(
      () => ({
        branches:
          businesses.reduce(
            (
              sum,
              business,
            ) =>
              sum +
              (business._count
                ?.branches ?? 0),
            0,
          ),

        invoices:
          businesses.reduce(
            (
              sum,
              business,
            ) =>
              sum +
              (business._count
                ?.invoices ?? 0),
            0,
          ),

        members:
          businesses.reduce(
            (
              sum,
              business,
            ) =>
              sum +
              (business._count
                ?.members ?? 0),
            0,
          ),
      }),
      [businesses],
    );

  /* ====================================================================== */
  /* SELECT BUSINESS                                                        */
  /* ====================================================================== */

  async function selectBusiness(
    businessId: string,
  ) {
    if (
      businessId === activeId ||
      switching
    ) {
      return;
    }

    setSwitching(true);
    setError("");
    setNotice("");

    setActiveBusinessId(
      businessId,
    );

    setActiveId(businessId);

    try {
      const { data } =
        await getAllPages<Branch>(
          "/branches",
        );

      setBranches(data);

      const selected =
        data.find(
          ({ isActive }) =>
            isActive,
        )?.id ?? "";

      if (selected) {
        setActiveBranchId(
          selected,
          businessId,
        );
      }

      setSelectedBranchId(
        selected,
      );

      setNotice(
        "Company selected. Choose a branch or open the dashboard.",
      );
    } catch (
      switchError
    ) {
      setError(
        getApiError(
          switchError,
          "Could not load branches for this company.",
        ),
      );
    } finally {
      setSwitching(false);
    }
  }

  /* ====================================================================== */
  /* SELECT BRANCH                                                          */
  /* ====================================================================== */

  function selectBranch(
    branchId: string,
  ) {
    setActiveBranchId(
      branchId,
      activeId,
    );

    setSelectedBranchId(
      branchId,
    );

    setNotice(
      branchId === "all"
        ? "All-branches reporting view selected."
        : "Branch selected successfully.",
    );
  }

  /* ====================================================================== */
  /* UI                                                                     */
  /* ====================================================================== */

  return (
    <>
      <div className="min-h-screen bg-slate-50/60">
        {/* ================================================================ */}
        {/* PREMIUM HEADER                                                   */}
        {/* ================================================================ */}

        <section className="relative mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-[35%] h-40 w-40 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-600" />

                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Workspace Management
                </span>
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Companies & Branches
              </h1>

              <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">
                Select the company and
                branch where billing,
                inventory, production
                and reports should
                operate.
              </p>
            </div>

            {canCreate && (
              <button
                type="button"
                onClick={() =>
                  setShowForm(true)
                }
                className="
                  group
                  inline-flex
                  h-10
                  items-center
                  justify-center
                  gap-2
                  rounded-xl
                  bg-blue-600
                  px-4
                  text-[10px]
                  font-extrabold
                  text-white
                  shadow-[0_8px_20px_rgba(37,99,235,0.20)]
                  transition-all
                  duration-300
                  hover:-translate-y-0.5
                  hover:bg-blue-700
                  hover:shadow-[0_12px_25px_rgba(37,99,235,0.28)]
                "
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
        {/* CONTENT                                                          */}
        {/* ================================================================ */}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <LoadingState label="Loading businesses..." />
          </section>
        ) : error ? (
          <section className="rounded-2xl border border-red-100 bg-white shadow-sm">
            <ErrorState
              message={error}
              onRetry={
                loadBusinesses
              }
            />
          </section>
        ) : businesses.length ===
          0 ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
            <EmptyState
              icon={Building2}
              title="No company added"
              description="Add your company to start billing. A Main Branch will be created automatically."
            />

            {canCreate && (
              <div className="flex justify-center pb-6">
                <button
                  type="button"
                  onClick={() =>
                    setShowForm(
                      true,
                    )
                  }
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-[10px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700"
                >
                  <Plus
                    size={14}
                  />
                  Add Your Company
                </button>
              </div>
            )}
          </section>
        ) : (
          <div className="space-y-4">
            {/* ============================================================ */}
            {/* NOTICE                                                       */}
            {/* ============================================================ */}

            {notice && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-[10px] font-semibold text-emerald-700 shadow-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-100">
                  <Check
                    size={12}
                    strokeWidth={
                      3
                    }
                  />
                </span>

                <span className="min-w-0">
                  {notice}
                </span>
              </div>
            )}

            {/* ============================================================ */}
            {/* METRICS                                                      */}
            {/* ============================================================ */}

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric
                icon={
                  Building2
                }
                label="Companies"
                value={
                  businesses.length
                }
                tone="blue"
                description="Available workspaces"
              />

              <Metric
                icon={
                  GitBranch
                }
                label="Branches"
                value={
                  totals.branches ||
                  branches.length
                }
                tone="violet"
                description="Operational units"
              />

              <Metric
                icon={
                  ReceiptText
                }
                label="Invoices"
                value={
                  totals.invoices
                }
                tone="amber"
                description="Total transactions"
              />

              <Metric
                icon={Users}
                label="Team Members"
                value={
                  totals.members
                }
                tone="emerald"
                description="Workspace users"
              />
            </section>

            {/* ============================================================ */}
            {/* COMPANY SELECTOR                                             */}
            {/* ============================================================ */}

            <section>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-blue-600" />

                    <h2 className="text-sm font-extrabold text-slate-950">
                      Select Company
                    </h2>
                  </div>

                  <p className="mt-1 text-[9px] text-slate-400">
                    Choose the company
                    workspace you want
                    to manage
                  </p>
                </div>

                <span className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[8px] font-bold text-slate-500 shadow-sm">
                  {
                    businesses.length
                  }{" "}
                  Companies
                </span>
              </div>

              {/* No slider */}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {businesses.map(
                  (
                    business,
                  ) => {
                    const active =
                      business.id ===
                      activeId;

                    return (
                      <button
                        type="button"
                        key={
                          business.id
                        }
                        disabled={
                          switching
                        }
                        aria-pressed={
                          active
                        }
                        onClick={() =>
                          void selectBusiness(
                            business.id,
                          )
                        }
                        className={`
                          group
                          relative
                          min-w-0
                          overflow-hidden
                          rounded-2xl
                          border
                          p-4
                          text-left
                          transition-all
                          duration-300
                          disabled:cursor-wait
                          ${
                            active
                              ? "border-blue-300 bg-gradient-to-br from-blue-50 via-white to-cyan-50 shadow-[0_12px_30px_rgba(37,99,235,0.10)] ring-4 ring-blue-50"
                              : "border-slate-200 bg-white shadow-[0_4px_16px_rgba(15,23,42,0.04)] hover:-translate-y-1 hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(37,99,235,0.08)]"
                          }
                        `}
                      >
                        {/* Hover glow */}

                        <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-blue-100/70 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                        {/* Top */}

                        <div className="relative flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className={`
                                  inline-flex
                                  items-center
                                  rounded-md
                                  px-2
                                  py-1
                                  text-[7px]
                                  font-black
                                  uppercase
                                  tracking-[0.1em]
                                  ${
                                    business.gstRegistered
                                      ? "bg-blue-50 text-blue-700"
                                      : "bg-violet-50 text-violet-700"
                                  }
                                `}
                              >
                                {business.gstRegistered
                                  ? "GST Registered"
                                  : "Non GST"}
                              </span>

                              {active && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-[7px] font-black uppercase tracking-wider text-emerald-700">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                  Active
                                </span>
                              )}
                            </div>

                            <h3 className="truncate text-[13px] font-black text-slate-950">
                              {
                                business.name
                              }
                            </h3>

                            {business.legalName &&
                              business.legalName !==
                                business.name && (
                                <p className="mt-1 truncate text-[9px] text-slate-400">
                                  {
                                    business.legalName
                                  }
                                </p>
                              )}
                          </div>

                          <span
                            className={`
                              flex
                              h-8
                              w-8
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              transition-all
                              duration-300
                              ${
                                active
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white"
                              }
                            `}
                          >
                            {active ? (
                              <Check
                                size={
                                  14
                                }
                                strokeWidth={
                                  3
                                }
                              />
                            ) : (
                              <ChevronRight
                                size={
                                  14
                                }
                                className="transition-transform group-hover:translate-x-0.5"
                              />
                            )}
                          </span>
                        </div>

                        {/* Details */}

                        <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                          <div>
                            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">
                              GSTIN
                            </p>

                            <p className="mt-1 truncate text-[9px] font-bold text-slate-700">
                              {business.gstRegistered
                                ? business.gstin ||
                                  "Not added"
                                : "Not applicable"}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">
                              Invoices
                            </p>

                            <p className="mt-1 text-[9px] font-extrabold text-slate-800">
                              {business._count
                                ?.invoices ??
                                0}
                            </p>
                          </div>
                        </div>

                        {/* Bottom accent */}

                        <span
                          className={`
                            absolute bottom-0 left-0
                            h-[3px]
                            bg-blue-600
                            transition-all
                            duration-300
                            ${
                              active
                                ? "w-full"
                                : "w-0 group-hover:w-full"
                            }
                          `}
                        />
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          </div>
        )}

        {/* ================================================================ */}
        {/* ACTIVE COMPANY WORKSPACE                                         */}
        {/* ================================================================ */}

        {!loading &&
          !error &&
          businesses.length >
            0 && (
            <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
              {/* Workspace header */}

              <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 px-4 py-4 sm:px-5">
                <div className="pointer-events-none absolute -right-16 -top-20 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl" />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-[7px] font-black uppercase tracking-[0.15em] text-blue-300">
                        Selected
                        Workspace
                      </span>

                      <span
                        className={`
                          rounded-md
                          px-2
                          py-0.5
                          text-[7px]
                          font-bold
                          ${
                            activeBusiness?.gstRegistered
                              ? "bg-blue-500/20 text-blue-200"
                              : "bg-violet-500/20 text-violet-200"
                          }
                        `}
                      >
                        {activeBusiness?.gstRegistered
                          ? "GST Registered"
                          : "Non GST"}
                      </span>
                    </div>

                    <h2 className="truncate text-lg font-black text-white">
                      {
                        activeBusiness?.name
                      }
                    </h2>

                    <p className="mt-1 truncate text-[9px] text-slate-400">
                      {activeBusiness?.legalName ||
                        activeBusiness?.address ||
                        "Company workspace"}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {canCreate && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowBranchForm(
                            true,
                          )
                        }
                        className="group inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-white/10 px-3 text-[9px] font-bold text-white transition-all hover:bg-white/20"
                      >
                        <Plus
                          size={
                            12
                          }
                          className="transition-transform group-hover:rotate-90"
                        />

                        Add Branch
                      </button>
                    )}

                    <Link
                      href="/dashboard"
                      className="group inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[9px] font-extrabold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-blue-500"
                    >
                      <LayoutDashboard
                        size={
                          12
                        }
                      />

                      Open Dashboard

                      <ChevronRight
                        size={
                          11
                        }
                        className="transition-transform group-hover:translate-x-0.5"
                      />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Company facts */}

              <div className="grid grid-cols-1 border-b border-slate-200 bg-slate-50/70 sm:grid-cols-3">
                <CompanyFact
                  label="GSTIN"
                  value={
                    activeBusiness?.gstin ||
                    "Not applicable"
                  }
                  icon={
                    FileCheck2
                  }
                />

                <CompanyFact
                  label="Contact"
                  value={
                    activeBusiness?.phone ||
                    activeBusiness?.email ||
                    "Not provided"
                  }
                  icon={Users}
                />

                <CompanyFact
                  label="Workspace Status"
                  value={
                    activeBusiness?.isActive
                      ? "Active workspace"
                      : "Inactive"
                  }
                  icon={
                    ShieldCheck
                  }
                />
              </div>

              {/* Branch header */}

              <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <h3 className="text-[12px] font-extrabold text-slate-950">
                    Branches
                  </h3>

                  <p className="mt-0.5 text-[9px] text-slate-400">
                    Select where new
                    operational records
                    should be created.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    selectBranch(
                      "all",
                    )
                  }
                  aria-pressed={
                    activeBranchId ===
                    "all"
                  }
                  className={`
                    inline-flex h-8 items-center
                    justify-center rounded-lg
                    border px-3
                    text-[8px] font-extrabold
                    transition-all
                    ${
                      activeBranchId ===
                      "all"
                        ? "border-slate-900 bg-slate-900 text-white shadow-md"
                        : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    }
                  `}
                >
                  All Branches View
                </button>
              </div>

              {/* ========================================================== */}
              {/* BRANCH CARDS                                               */}
              {/* ========================================================== */}

              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {branches.map(
                  (branch) => {
                    const active =
                      branch.id ===
                      activeBranchId;

                    return (
                      <button
                        key={
                          branch.id
                        }
                        type="button"
                        disabled={
                          !branch.isActive
                        }
                        aria-pressed={
                          active
                        }
                        onClick={() =>
                          selectBranch(
                            branch.id,
                          )
                        }
                        className={`
                          group
                          relative
                          min-w-0
                          overflow-hidden
                          rounded-xl
                          border
                          p-3.5
                          text-left
                          transition-all
                          duration-300
                          disabled:cursor-not-allowed
                          disabled:opacity-50
                          ${
                            active
                              ? "border-blue-300 bg-blue-50/60 shadow-[0_8px_22px_rgba(37,99,235,0.08)] ring-2 ring-blue-100"
                              : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(37,99,235,0.07)]"
                          }
                        `}
                      >
                        <div className="flex items-start gap-3">
                          <span
                            className={`
                              flex
                              h-9
                              w-9
                              shrink-0
                              items-center
                              justify-center
                              rounded-lg
                              transition-all
                              duration-300
                              ${
                                active
                                  ? "bg-blue-600 text-white"
                                  : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                              }
                            `}
                          >
                            <MapPin
                              size={
                                15
                              }
                            />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                              <h4 className="truncate text-[11px] font-extrabold text-slate-900">
                                {
                                  branch.name
                                }
                              </h4>

                              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[7px] font-black text-slate-500">
                                {
                                  branch.code
                                }
                              </span>
                            </div>

                            <p className="mt-1 truncate text-[8px] text-slate-400">
                              {branch.address ||
                                "No branch address"}
                            </p>
                          </div>

                          {active && (
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                              <Check
                                size={
                                  11
                                }
                                strokeWidth={
                                  3
                                }
                              />
                            </span>
                          )}
                        </div>

                        {branch._count && (
                          <div className="mt-3 grid grid-cols-3 gap-1 border-t border-slate-100 pt-2.5">
                            <BranchStat
                              value={
                                branch
                                  ._count
                                  .invoices
                              }
                              label="Invoices"
                            />

                            <BranchStat
                              value={
                                branch
                                  ._count
                                  .documents
                              }
                              label="Documents"
                            />

                            <BranchStat
                              value={
                                branch
                                  ._count
                                  .productionOrders
                              }
                              label="Production"
                            />
                          </div>
                        )}

                        <span
                          className={`
                            absolute bottom-0 left-0
                            h-[2px]
                            bg-blue-600
                            transition-all
                            duration-300
                            ${
                              active
                                ? "w-full"
                                : "w-0 group-hover:w-full"
                            }
                          `}
                        />
                      </button>
                    );
                  },
                )}
              </div>
            </section>
          )}

        {/* ================================================================ */}
        {/* WORKSPACE INFO                                                   */}
        {/* ================================================================ */}

        {!loading &&
          !error &&
          businesses.length >
            0 && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50 to-cyan-50/50 p-3.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                <ShieldCheck
                  size={15}
                />
              </span>

              <div>
                <p className="text-[9px] font-extrabold text-blue-900">
                  Workspace
                  Separation
                </p>

                <p className="mt-0.5 text-[9px] leading-5 text-blue-700">
                  Parties and items stay
                  shared company-wide.
                  Invoices, documents,
                  production and reports
                  follow the selected
                  branch.
                </p>
              </div>
            </div>
          )}
      </div>

      {/* ================================================================== */}
      {/* MODALS                                                             */}
      {/* ================================================================== */}

      {showForm && (
        <BusinessFormModal
          onClose={() =>
            setShowForm(false)
          }
          onSaved={(
            business,
          ) => {
            setActiveBusinessId(
              business.id,
            );

            setShowForm(false);

            window.location.href =
              "/dashboard";
          }}
        />
      )}

      {showBranchForm && (
        <BranchFormModal
          onClose={() =>
            setShowBranchForm(
              false,
            )
          }
          onSaved={(branch) => {
            setBranches(
              (current) => [
                ...current,
                branch,
              ],
            );

            setActiveBranchId(
              branch.id,
              activeId,
            );

            setSelectedBranchId(
              branch.id,
            );

            setShowBranchForm(
              false,
            );
          }}
        />
      )}
    </>
  );
}

/* ========================================================================== */
/* METRIC CARD                                                                */
/* ========================================================================== */

const METRIC_TONES = {
  blue: {
    icon:
      "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    border:
      "hover:border-blue-200",
    accent:
      "bg-blue-600",
  },

  violet: {
    icon:
      "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    border:
      "hover:border-violet-200",
    accent:
      "bg-violet-500",
  },

  amber: {
    icon:
      "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
    border:
      "hover:border-amber-200",
    accent:
      "bg-amber-500",
  },

  emerald: {
    icon:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    border:
      "hover:border-emerald-200",
    accent:
      "bg-emerald-500",
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
  tone:
    | "blue"
    | "violet"
    | "amber"
    | "emerald";
  description: string;
}) {
  const style =
    METRIC_TONES[tone];

  return (
    <div
      className={`
        group
        relative
        min-w-0
        overflow-hidden
        rounded-2xl
        border
        border-slate-200
        bg-white
        p-4
        shadow-[0_4px_18px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-1
        hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]
        ${style.border}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            {value.toLocaleString(
              "en-IN",
            )}
          </p>

          <p className="mt-1 truncate text-[8px] text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={`
            flex
            h-10
            w-10
            shrink-0
            items-center
            justify-center
            rounded-xl
            transition-all
            duration-300
            group-hover:scale-110
            ${style.icon}
          `}
        >
          <Icon size={17} />
        </span>
      </div>

      <span
        className={`
          absolute bottom-0 left-0
          h-[3px]
          w-0
          transition-all
          duration-300
          group-hover:w-full
          ${style.accent}
        `}
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
    <div className="group flex min-w-0 items-center gap-3 border-b border-slate-200 px-4 py-3 transition hover:bg-white sm:border-b-0 sm:border-r sm:last:border-r-0">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 transition group-hover:bg-blue-600 group-hover:text-white">
        <Icon size={13} />
      </span>

      <div className="min-w-0">
        <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p
          className="mt-0.5 truncate text-[9px] font-extrabold text-slate-700"
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

function BranchStat({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-[10px] font-black text-slate-800">
        {value.toLocaleString(
          "en-IN",
        )}
      </p>

      <p className="mt-0.5 truncate text-[6px] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* CREATE COMPANY / BRANCH MODALS                                            */
/* ========================================================================== */

function BusinessFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (business: Business) => void;
}) {
  const [form, setForm] = useState({
    name: "",
    legalName: "",
    gstRegistered: true,
    gstin: "",
    address: "",
    stateCode: "",
    phone: "",
    email: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const { data } = await api.post<Business>("/businesses", {
        name: form.name.trim(),
        legalName: form.legalName.trim() || undefined,
        gstRegistered: form.gstRegistered,
        gstin: form.gstRegistered ? form.gstin.trim().toUpperCase() : undefined,
        address: form.address.trim() || undefined,
        stateCode: form.stateCode.trim() || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim().toLowerCase() || undefined,
      });
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, "Could not create business."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add company" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <ModalError message={error} />}

        <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button type="button" onClick={() => setForm({ ...form, gstRegistered: true })} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${form.gstRegistered ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`}>
            GST registered
          </button>
          <button type="button" onClick={() => setForm({ ...form, gstRegistered: false, gstin: "" })} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${!form.gstRegistered ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>
            Without GST
          </button>
        </div>

        <ModalField id="business-name" label="Business name *">
          <input id="business-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Sunrise Traders" />
        </ModalField>
        <ModalField id="business-legal-name" label="Legal name">
          <input id="business-legal-name" className="input-field" value={form.legalName} onChange={(event) => setForm({ ...form, legalName: event.target.value })} />
        </ModalField>

        {form.gstRegistered && (
          <div className="grid gap-3 sm:grid-cols-[1fr_90px]">
            <ModalField id="business-gstin" label="GSTIN *">
              <input id="business-gstin" required minLength={15} maxLength={15} pattern="[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]" className="input-field uppercase" value={form.gstin} onChange={(event) => {
                const gstin = event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                setForm({ ...form, gstin, stateCode: gstin.length >= 2 && /^\d{2}/.test(gstin) ? gstin.slice(0, 2) : form.stateCode });
              }} placeholder="22AAAAA0000A1Z5" />
            </ModalField>
            <ModalField id="business-state" label="State code">
              <input id="business-state" inputMode="numeric" minLength={2} maxLength={2} className="input-field" value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value.replace(/\D/g, "") })} placeholder="22" />
            </ModalField>
          </div>
        )}

        <ModalField id="business-address" label="Business address">
          <textarea id="business-address" rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </ModalField>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModalField id="business-phone" label="Phone">
            <input id="business-phone" type="tel" className="input-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </ModalField>
          <ModalField id="business-email" label="Email">
            <input id="business-email" type="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </ModalField>
        </div>

        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
          {form.gstRegistered ? "GST invoices will include tax rates and your GSTIN." : "Tax will be fixed at 0% and invoices will be marked non-GST."}
        </p>
        <ModalActions saving={saving} onClose={onClose} label="Create company" />
      </form>
    </Modal>
  );
}

function BranchFormModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (branch: Branch) => void;
}) {
  const [form, setForm] = useState({ name: "", code: "", address: "", stateCode: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");

    try {
      const { data } = await api.post<Branch>("/branches", {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        address: form.address.trim() || undefined,
        stateCode: form.stateCode || undefined,
        phone: form.phone.trim() || undefined,
        email: form.email.trim().toLowerCase() || undefined,
      });
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, "Could not create branch."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add branch" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && <ModalError message={error} />}
        <ModalField id="branch-name" label="Branch name *">
          <input id="branch-name" required autoFocus className="input-field" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Mumbai Branch" />
        </ModalField>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModalField id="branch-code" label="Branch code *">
            <input id="branch-code" required minLength={2} maxLength={24} pattern="[A-Za-z0-9_-]{2,24}" className="input-field uppercase" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/[^a-zA-Z0-9_-]/g, "") })} placeholder="MUM" />
          </ModalField>
          <ModalField id="branch-state" label="State code">
            <input id="branch-state" inputMode="numeric" maxLength={2} className="input-field" value={form.stateCode} onChange={(event) => setForm({ ...form, stateCode: event.target.value.replace(/\D/g, "") })} placeholder="27" />
          </ModalField>
        </div>
        <ModalField id="branch-address" label="Address">
          <textarea id="branch-address" rows={2} className="input-field resize-none" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
        </ModalField>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModalField id="branch-phone" label="Phone">
            <input id="branch-phone" type="tel" className="input-field" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
          </ModalField>
          <ModalField id="branch-email" label="Email">
            <input id="branch-email" type="email" className="input-field" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
          </ModalField>
        </div>
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-[11px] leading-5 text-blue-700">
          Parties, suppliers, and items remain shared. New transactions will use this branch.
        </p>
        <ModalActions saving={saving} onClose={onClose} label="Create branch" />
      </form>
    </Modal>
  );
}

function ModalField({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div><label htmlFor={id} className="label">{label}</label>{children}</div>;
}

function ModalError({ message }: { message: string }) {
  return <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</div>;
}

function ModalActions({ saving, onClose, label }: { saving: boolean; onClose: () => void; label: string }) {
  return <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-32">{saving ? "Creating..." : label}</button></div>;
}
