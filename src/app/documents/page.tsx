"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowDownUp,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  FileText,
  Filter,
  IndianRupee,
  MinusCircle,
  Plus,
  PlusCircle,
  ReceiptText,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";

import StatusBadge from "@/components/StatusBadge";

import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/ContentState";

import {
  getAllPages,
  getApiError,
} from "@/lib/api";

import {
  DOCUMENT_CONFIG,
  DOCUMENT_STATUS_OPTIONS,
  DOCUMENT_TYPES,
} from "@/lib/documents";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

import type {
  BusinessDocument,
  BusinessDocumentStatus,
  BusinessDocumentType,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type DateFilter =
  | "ALL"
  | "30_DAYS"
  | "THIS_YEAR";

type SortOption =
  | "NEWEST"
  | "OLDEST"
  | "VALUE_HIGH"
  | "VALUE_LOW";

/* -------------------------------------------------------------------------- */
/* Document Icons                                                             */
/* -------------------------------------------------------------------------- */

const TYPE_ICONS = {
  QUOTATION: FileText,
  PROFORMA_INVOICE: ReceiptText,
  PURCHASE_INVOICE: ShoppingCart,
  DELIVERY_CHALLAN: Truck,
  CREDIT_NOTE: MinusCircle,
  DEBIT_NOTE: PlusCircle,
} as const;

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DocumentsPage() {
  const [documents, setDocuments] =
    useState<BusinessDocument[]>([]);

  const [type, setType] =
    useState<"ALL" | BusinessDocumentType>(
      "ALL",
    );

  const [status, setStatus] =
    useState<
      "ALL" | BusinessDocumentStatus
    >("ALL");

  const [query, setQuery] =
    useState("");

  const [dateFilter, setDateFilter] =
    useState<DateFilter>("ALL");

  const [sort, setSort] =
    useState<SortOption>("NEWEST");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    showCreateMenu,
    setShowCreateMenu,
  ] = useState(false);

  const createMenuRef =
    useRef<HTMLDivElement>(null);

  /* ------------------------------------------------------------------------ */
  /* Load Documents                                                           */
  /* ------------------------------------------------------------------------ */

  const loadDocuments =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const { data } =
          await getAllPages<BusinessDocument>(
            "/documents",
          );

        setDocuments(data);
      } catch (loadError: unknown) {
        setError(
          getApiError(
            loadError,
            "Could not load business documents.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  /* ------------------------------------------------------------------------ */
  /* Close Create Menu                                                        */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!showCreateMenu) return;

    function closeCreateMenu(
      event: MouseEvent,
    ) {
      if (
        !createMenuRef.current?.contains(
          event.target as Node,
        )
      ) {
        setShowCreateMenu(false);
      }
    }

    function closeOnEscape(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setShowCreateMenu(false);
      }
    }

    document.addEventListener(
      "mousedown",
      closeCreateMenu,
    );

    document.addEventListener(
      "keydown",
      closeOnEscape,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        closeCreateMenu,
      );

      document.removeEventListener(
        "keydown",
        closeOnEscape,
      );
    };
  }, [showCreateMenu]);

  /* ------------------------------------------------------------------------ */
  /* Filter + Sort                                                            */
  /* ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    const term =
      query.trim().toLowerCase();

    const now = new Date();

    const thirtyDaysAgo =
      new Date(now);

    thirtyDaysAgo.setDate(
      now.getDate() - 30,
    );

    const startOfYear =
      new Date(
        now.getFullYear(),
        0,
        1,
      );

    return documents
      .filter((document) => {
        if (
          type !== "ALL" &&
          document.type !== type
        ) {
          return false;
        }

        if (
          status !== "ALL" &&
          document.status !== status
        ) {
          return false;
        }

        const issuedAt =
          new Date(
            document.issueDate,
          );

        if (
          dateFilter === "30_DAYS" &&
          issuedAt < thirtyDaysAgo
        ) {
          return false;
        }

        if (
          dateFilter === "THIS_YEAR" &&
          issuedAt < startOfYear
        ) {
          return false;
        }

        if (!term) {
          return true;
        }

        return [
          document.documentNumber,
          document.party?.name,
          document.supplier?.name,
          document.referenceNumber,
          DOCUMENT_CONFIG[
            document.type
          ].label,
        ].some((value) =>
          value
            ?.toLowerCase()
            .includes(term),
        );
      })
      .sort((a, b) => {
        if (sort === "OLDEST") {
          return (
            new Date(
              a.issueDate,
            ).getTime() -
            new Date(
              b.issueDate,
            ).getTime()
          );
        }

        if (
          sort === "VALUE_HIGH"
        ) {
          return (
            Number(b.grandTotal) -
            Number(a.grandTotal)
          );
        }

        if (
          sort === "VALUE_LOW"
        ) {
          return (
            Number(a.grandTotal) -
            Number(b.grandTotal)
          );
        }

        return (
          new Date(
            b.issueDate,
          ).getTime() -
          new Date(
            a.issueDate,
          ).getTime()
        );
      });
  }, [
    documents,
    type,
    status,
    dateFilter,
    query,
    sort,
  ]);

  /* ------------------------------------------------------------------------ */
  /* Summary                                                                  */
  /* ------------------------------------------------------------------------ */

  const summary = useMemo(
    () => ({
      total: documents.length,

      drafts: documents.filter(
        (document) =>
          document.status === "DRAFT",
      ).length,

      accepted: documents.filter(
        (document) =>
          document.status === "ACCEPTED",
      ).length,

      value: documents.reduce(
        (total, document) =>
          total +
          (Number(
            document.grandTotal,
          ) || 0),
        0,
      ),
    }),
    [documents],
  );

  const hasFilters =
    type !== "ALL" ||
    status !== "ALL" ||
    dateFilter !== "ALL" ||
    query.trim().length > 0;

  function clearFilters() {
    setType("ALL");
    setStatus("ALL");
    setDateFilter("ALL");
    setQuery("");
  }

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <>
      {/* ================================================================ */}
      {/* PAGE HEADER                                                      */}
      {/* ================================================================ */}

      <section className="relative mb-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-blue-600" />

              <span className="text-[9px] font-black uppercase tracking-[0.18em] text-blue-600">
                Business Workspace
              </span>
            </div>

            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Business Documents
            </h1>

            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-slate-500">
              Manage quotations, proforma invoices,
              purchases, challans and adjustment notes
              from one register.
            </p>
          </div>

          {/* New document */}
          <div
            ref={createMenuRef}
            className="relative"
          >
            <button
              type="button"
              onClick={() =>
                setShowCreateMenu(
                  (current) =>
                    !current,
                )
              }
              className="
                group
                inline-flex
                h-10
                items-center
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
              aria-haspopup="menu"
              aria-expanded={
                showCreateMenu
              }
            >
              <Plus
                size={14}
                className="transition-transform duration-300 group-hover:rotate-90"
              />

              New Document
            </button>

            {showCreateMenu && (
              <div
                role="menu"
                className="absolute right-0 top-full z-30 mt-2 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_20px_50px_rgba(15,23,42,0.15)]"
              >
                <div className="border-b border-slate-100 px-2.5 pb-2 pt-1">
                  <p className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                    Choose Document Type
                  </p>
                </div>

                <div className="mt-1">
                  {DOCUMENT_TYPES.map(
                    (documentType) => {
                      const config =
                        DOCUMENT_CONFIG[
                          documentType
                        ];

                      const Icon =
                        TYPE_ICONS[
                          documentType
                        ];

                      return (
                        <Link
                          key={
                            documentType
                          }
                          href={
                            config.createPath
                          }
                          onClick={() =>
                            setShowCreateMenu(
                              false,
                            )
                          }
                          className="group flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition hover:bg-blue-50/50"
                        >
                          <span
                            className={`
                              flex h-9 w-9
                              shrink-0 items-center
                              justify-center rounded-xl
                              transition-transform
                              group-hover:scale-105
                              ${config.soft}
                              ${config.accent}
                            `}
                          >
                            <Icon
                              size={16}
                            />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] font-bold text-slate-800">
                              {
                                config.label
                              }
                            </span>

                            <span className="mt-0.5 block truncate text-[9px] text-slate-400">
                              {
                                config.description
                              }
                            </span>
                          </span>

                          <ArrowUpRight
                            size={13}
                            className="text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-blue-600"
                          />
                        </Link>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
      </section>

      {/* ================================================================ */}
      {/* SUMMARY                                                          */}
      {/* ================================================================ */}

      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {/* Total */}
        <SummaryCard
          label="Total Documents"
          value={summary.total.toLocaleString(
            "en-IN",
          )}
          description="All business records"
          icon={FileText}
          tone="bg-blue-50 text-blue-700"
          accent="bg-blue-600"
        />

        {/* Draft */}
        <button
          type="button"
          onClick={() =>
            setStatus(
              status === "DRAFT"
                ? "ALL"
                : "DRAFT",
            )
          }
          className={`
            group relative overflow-hidden rounded-2xl
            border bg-white p-4 text-left
            shadow-[0_4px_18px_rgba(15,23,42,0.04)]
            transition-all duration-300
            hover:-translate-y-1
            hover:shadow-[0_14px_30px_rgba(245,158,11,0.10)]
            ${
              status === "DRAFT"
                ? "border-amber-300 ring-4 ring-amber-50"
                : "border-slate-200 hover:border-amber-200"
            }
          `}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Drafts
              </p>

              <p className="mt-2 text-2xl font-black text-slate-950">
                {summary.drafts}
              </p>

              <p className="mt-1 text-[9px] text-slate-400">
                Waiting to issue
              </p>
            </div>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 transition-transform group-hover:scale-110">
              <ReceiptText
                size={18}
              />
            </span>
          </div>

          <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
        </button>

        {/* Accepted */}
        <button
          type="button"
          onClick={() =>
            setStatus(
              status === "ACCEPTED"
                ? "ALL"
                : "ACCEPTED",
            )
          }
          className={`
            group relative overflow-hidden rounded-2xl
            border bg-white p-4 text-left
            shadow-[0_4px_18px_rgba(15,23,42,0.04)]
            transition-all duration-300
            hover:-translate-y-1
            hover:shadow-[0_14px_30px_rgba(16,185,129,0.10)]
            ${
              status === "ACCEPTED"
                ? "border-emerald-300 ring-4 ring-emerald-50"
                : "border-slate-200 hover:border-emerald-200"
            }
          `}
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                Accepted
              </p>

              <p className="mt-2 text-2xl font-black text-slate-950">
                {summary.accepted}
              </p>

              <p className="mt-1 text-[9px] text-slate-400">
                Approved documents
              </p>
            </div>

            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-110">
              <CheckCircle2
                size={18}
              />
            </span>
          </div>

          <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-emerald-500 transition-all duration-300 group-hover:w-full" />
        </button>

        {/* Value */}
        <SummaryCard
          label="Document Value"
          value={formatCurrency(
            summary.value,
          )}
          description="Combined document value"
          icon={IndianRupee}
          tone="bg-violet-50 text-violet-700"
          accent="bg-violet-500"
        />
      </div>

      {/* ================================================================ */}
      {/* DOCUMENT CATEGORIES                                               */}
      {/* ================================================================ */}

      <section className="mb-5">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-slate-950">
              Document Categories
            </h2>

            <p className="mt-0.5 text-[10px] text-slate-400">
              Select a category to filter records
            </p>
          </div>

          {type !== "ALL" && (
            <button
              type="button"
              onClick={() =>
                setType("ALL")
              }
              className="text-[9px] font-bold text-blue-600 hover:text-blue-800"
            >
              Show all
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {DOCUMENT_TYPES.map(
            (documentType) => {
              const config =
                DOCUMENT_CONFIG[
                  documentType
                ];

              const Icon =
                TYPE_ICONS[
                  documentType
                ];

              const count =
                documents.filter(
                  (document) =>
                    document.type ===
                    documentType,
                ).length;

              const selected =
                type ===
                documentType;

              return (
                <button
                  type="button"
                  key={
                    documentType
                  }
                  onClick={() =>
                    setType(
                      selected
                        ? "ALL"
                        : documentType,
                    )
                  }
                  aria-pressed={
                    selected
                  }
                  className={`
                    group relative overflow-hidden
                    rounded-2xl border bg-white
                    p-3.5 text-left
                    shadow-[0_4px_15px_rgba(15,23,42,0.04)]
                    transition-all duration-300
                    hover:-translate-y-1
                    hover:shadow-[0_12px_25px_rgba(15,23,42,0.09)]
                    ${
                      selected
                        ? `${config.border} ring-4 ring-slate-100`
                        : "border-slate-200 hover:border-blue-200"
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`
                        flex h-9 w-9
                        items-center justify-center
                        rounded-xl
                        transition-transform
                        group-hover:scale-110
                        ${config.soft}
                        ${config.accent}
                      `}
                    >
                      <Icon
                        size={17}
                      />
                    </span>

                    <span className="text-xl font-black text-slate-950">
                      {count}
                    </span>
                  </div>

                  <p className="mt-3 truncate text-[11px] font-extrabold text-slate-800">
                    {config.plural}
                  </p>

                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-[9px] text-slate-400">
                      {selected
                        ? "Active"
                        : "View records"}
                    </span>

                    <ArrowRight
                      size={12}
                      className="text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-blue-600"
                    />
                  </div>

                  <div
                    className={`
                      absolute bottom-0 left-0
                      h-[3px] bg-blue-600
                      transition-all duration-300
                      ${
                        selected
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

      {/* ================================================================ */}
      {/* DOCUMENT REGISTER                                                 */}
      {/* ================================================================ */}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
        {/* COMPACT SINGLE-LINE TOOLBAR */}

        <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 bg-blue px-3 py-3 sm:px-4">
          <div
            className="
              grid
              grid-cols-2
              items-end
              gap-2

              lg:grid-cols-[150px_minmax(190px,1fr)_130px_120px_145px_auto]
            "
          >
            {/* Heading */}

            <div className="col-span-2 min-w-0 lg:col-span-1">
              <p className="truncate text-[11px] font-extrabold text-slate-950">
                Document Register
              </p>

              <p className="mt-0.5 truncate text-[8px] font-medium text-slate-400">
                {filtered.length} of{" "}
                {documents.length} records
              </p>
            </div>

            {/* SEARCH */}

            <div className="col-span-2 min-w-0 lg:col-span-1">
              <p className="mb-1 text-[7px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Search
              </p>

              <div className="relative">
                <Search
                  size={12}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <input
                  aria-label="Search documents"
                  value={query}
                  onChange={(
                    event,
                  ) =>
                    setQuery(
                      event.target
                        .value,
                    )
                  }
                  placeholder="Document, party..."
                  className="
                    h-8
                    w-full
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-7
                    pr-2
                    text-[9px]
                    font-medium
                    text-slate-700
                    outline-none
                    transition-all
                    placeholder:text-slate-400
                    hover:border-blue-200
                    hover:shadow-sm
                    focus:border-blue-400
                    focus:ring-2
                    focus:ring-blue-100
                  "
                />
              </div>
            </div>

            {/* STATUS */}

            <div className="min-w-0">
              <p className="mb-1 text-[7px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Status
              </p>

              <div className="group relative">
                <Filter
                  size={11}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  aria-label="Filter by status"
                  value={status}
                  onChange={(
                    event,
                  ) =>
                    setStatus(
                      event.target
                        .value as typeof status,
                    )
                  }
                  className="
                    h-8
                    w-full
                    appearance-none
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-7
                    pr-6
                    text-[9px]
                    font-semibold
                    text-slate-600
                    outline-none
                    transition-all
                    hover:border-blue-200
                    hover:shadow-sm
                    focus:border-blue-400
                    focus:ring-2
                    focus:ring-blue-100
                  "
                >
                  <option value="ALL">
                    All statuses
                  </option>

                  {DOCUMENT_STATUS_OPTIONS.map(
                    (option) => (
                      <option
                        key={
                          option.value
                        }
                        value={
                          option.value
                        }
                      >
                        {option.label}
                      </option>
                    ),
                  )}
                </select>

                <ChevronDown
                  size={11}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            {/* DATE */}

            <div className="min-w-0">
              <p className="mb-1 text-[7px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Date
              </p>

              <div className="relative">
                <CalendarDays
                  size={11}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  aria-label="Filter by date"
                  value={dateFilter}
                  onChange={(
                    event,
                  ) =>
                    setDateFilter(
                      event.target
                        .value as DateFilter,
                    )
                  }
                  className="
                    h-8
                    w-full
                    appearance-none
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-7
                    pr-6
                    text-[9px]
                    font-semibold
                    text-slate-600
                    outline-none
                    transition-all
                    hover:border-blue-200
                    hover:shadow-sm
                    focus:border-blue-400
                    focus:ring-2
                    focus:ring-blue-100
                  "
                >
                  <option value="ALL">
                    Any date
                  </option>

                  <option value="30_DAYS">
                    Last 30 days
                  </option>

                  <option value="THIS_YEAR">
                    This year
                  </option>
                </select>

                <ChevronDown
                  size={11}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            {/* SORT */}

            <div className="min-w-0">
              <p className="mb-1 text-[7px] font-extrabold uppercase tracking-[0.12em] text-slate-400">
                Sort
              </p>

              <div className="relative">
                <ArrowDownUp
                  size={11}
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
                />

                <select
                  aria-label="Sort documents"
                  value={sort}
                  onChange={(
                    event,
                  ) =>
                    setSort(
                      event.target
                        .value as SortOption,
                    )
                  }
                  className="
                    h-8
                    w-full
                    appearance-none
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    pl-7
                    pr-6
                    text-[9px]
                    font-semibold
                    text-slate-600
                    outline-none
                    transition-all
                    hover:border-blue-200
                    hover:shadow-sm
                    focus:border-blue-400
                    focus:ring-2
                    focus:ring-blue-100
                  "
                >
                  <option value="NEWEST">
                    Newest first
                  </option>

                  <option value="OLDEST">
                    Oldest first
                  </option>

                  <option value="VALUE_HIGH">
                    Value: high to low
                  </option>

                  <option value="VALUE_LOW">
                    Value: low to high
                  </option>
                </select>

                <ChevronDown
                  size={11}
                  className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400"
                />
              </div>
            </div>

            {/* CLEAR */}

            <div className="flex min-w-0 items-end">
              {hasFilters ? (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                  className="
                    inline-flex
                    h-8
                    w-full
                    items-center
                    justify-center
                    gap-1
                    rounded-lg
                    border
                    border-slate-200
                    bg-white
                    px-2.5
                    text-[8px]
                    font-bold
                    text-slate-500
                    transition-all
                    hover:border-red-200
                    hover:bg-red-50
                    hover:text-red-600
                    lg:w-auto
                  "
                >
                  <X size={11} />
                  Clear
                </button>
              ) : (
                <div className="hidden h-8 lg:block" />
              )}
            </div>
          </div>
        </div>

        {/* ============================================================ */}
        {/* TABLE                                                        */}
        {/* ============================================================ */}

        {loading ? (
          <LoadingState label="Loading documents..." />
        ) : error ? (
          <ErrorState
            message={error}
            onRetry={
              loadDocuments
            }
          />
        ) : filtered.length ===
          0 ? (
          <EmptyState
            icon={FileText}
            title="No documents found"
            description={
              documents.length
                ? "Try changing your filters or search."
                : "Create a quotation, purchase invoice, challan, or adjustment note."
            }
          />
        ) : (
          /*
           * No overflow-x-auto
           * No horizontal slider
           */
          <div className="w-full">
            <table className="w-full table-fixed border-collapse text-xs">
              <caption className="sr-only">
                Business document register
              </caption>

              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80">
                  <th className="w-[23%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    Document
                  </th>

                  <th className="w-[23%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    Party / Supplier
                  </th>

                  <th className="hidden w-[14%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-500 md:table-cell">
                    Issue Date
                  </th>

                  <th className="hidden w-[15%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-500 lg:table-cell">
                    Reference
                  </th>

                  <th className="w-[13%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-extrabold uppercase tracking-[0.1em] text-slate-500">
                    Status
                  </th>

                  <th className="w-[14%] px-3 py-2.5 text-right text-[8px] font-extrabold uppercase tracking-[0.1em] text-blue-600">
                    Total
                  </th>

                  <th className="w-[4%]" />
                </tr>
              </thead>

              <tbody>
                {filtered.map(
                  (
                    businessDocument,
                    index,
                  ) => {
                    const config =
                      DOCUMENT_CONFIG[
                        businessDocument
                          .type
                      ];

                    return (
                      <tr
                        key={
                          businessDocument.id
                        }
                        className={`
                          group
                          border-b
                          border-slate-100
                          transition-all
                          duration-200
                          ${
                            index %
                              2 ===
                            0
                              ? "bg-white"
                              : "bg-slate-50/40"
                          }
                          hover:bg-blue-50/60
                          hover:shadow-[inset_3px_0_0_#2563eb]
                        `}
                      >
                        {/* Document */}

                        <td className="border-r border-slate-100 px-3 py-3">
                          <Link
                            href={`/documents/${businessDocument.id}`}
                            className="block min-w-0"
                          >
                            <span className="block truncate text-[10px] font-extrabold text-slate-900 transition-colors group-hover:text-blue-700">
                              {
                                businessDocument.documentNumber
                              }
                            </span>

                            <span
                              className={`
                                mt-1
                                inline-flex
                                rounded-md
                                px-1.5
                                py-0.5
                                text-[7px]
                                font-bold
                                ${config.soft}
                                ${config.accent}
                              `}
                            >
                              {
                                config.label
                              }
                            </span>
                          </Link>
                        </td>

                        {/* Party / Supplier */}

                        <td className="border-r border-slate-100 px-3 py-3">
                          <p
                            className="truncate text-[10px] font-bold text-slate-700"
                            title={
                              businessDocument
                                .party
                                ?.name ||
                              businessDocument
                                .supplier
                                ?.name ||
                              undefined
                            }
                          >
                            {businessDocument
                              .party
                              ?.name ||
                              businessDocument
                                .supplier
                                ?.name ||
                              "—"}
                          </p>

                          <p className="mt-0.5 text-[8px] text-slate-400">
                            {businessDocument.supplier
                              ? "Supplier"
                              : businessDocument.party
                                ? "Party"
                                : "Not assigned"}
                          </p>
                        </td>

                        {/* Date */}

                        <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-[9px] font-medium text-slate-500 md:table-cell">
                          {formatDate(
                            businessDocument.issueDate,
                          )}
                        </td>

                        {/* Reference */}

                        <td
                          className="hidden truncate border-r border-slate-100 px-3 py-3 text-[9px] text-slate-500 lg:table-cell"
                          title={
                            businessDocument.referenceNumber ||
                            undefined
                          }
                        >
                          {businessDocument.referenceNumber ||
                            "—"}
                        </td>

                        {/* Status */}

                        <td className="border-r border-slate-100 px-3 py-3">
                          <StatusBadge
                            status={
                              businessDocument.status
                            }
                          />
                        </td>

                        {/* Total */}

                        <td className="bg-blue-50/20 px-3 py-3 text-right">
                          <span className="whitespace-nowrap text-[10px] font-extrabold text-slate-950">
                            {formatCurrency(
                              businessDocument.grandTotal,
                            )}
                          </span>
                        </td>

                        {/* Open */}

                        <td className="px-1 text-center">
                          <Link
                            href={`/documents/${businessDocument.id}`}
                            aria-label={`Open ${businessDocument.documentNumber}`}
                            className="
                              inline-flex
                              h-7
                              w-7
                              items-center
                              justify-center
                              rounded-lg
                              text-slate-300
                              transition-all
                              duration-300
                              group-hover:translate-x-0.5
                              group-hover:bg-blue-600
                              group-hover:text-white
                            "
                          >
                            <ArrowUpRight
                              size={12}
                            />
                          </Link>
                        </td>
                      </tr>
                    );
                  },
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}

        {!loading &&
          !error &&
          filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/60 px-3 py-2">
              <span className="text-[8px] text-slate-400">
                Showing{" "}
                <strong className="text-slate-700">
                  {
                    filtered.length
                  }
                </strong>{" "}
                records
              </span>

              <span className="text-[8px] text-slate-400">
                {hasFilters
                  ? "Filtered results"
                  : "All business documents"}
              </span>
            </div>
          )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Summary Card                                                               */
/* -------------------------------------------------------------------------- */

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  tone,
  accent,
}: {
  label: string;
  value: string;
  description: string;
  icon: typeof FileText;
  tone: string;
  accent: string;
}) {
  return (
    <div
      className="
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
        hover:border-blue-200
        hover:shadow-[0_14px_30px_rgba(15,23,42,0.08)]
      "
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">
            {label}
          </p>

          <p className="mt-2 truncate text-xl font-black text-slate-950 sm:text-2xl">
            {value}
          </p>

          <p className="mt-1 text-[9px] text-slate-400">
            {description}
          </p>
        </div>

        <span
          className={`
            flex h-10 w-10 shrink-0
            items-center justify-center
            rounded-xl
            transition-transform
            duration-300
            group-hover:scale-110
            ${tone}
          `}
        >
          <Icon size={18} />
        </span>
      </div>

      <div
        className={`
          absolute bottom-0 left-0
          h-[3px] w-0
          transition-all duration-300
          group-hover:w-full
          ${accent}
        `}
      />
    </div>
  );
}