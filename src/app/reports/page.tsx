"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  Download,
  IndianRupee,
  RefreshCw,
  TrendingUp,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

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
  formatCurrency,
} from "@/lib/format";

import type {
  BusinessDocument,
  Invoice,
  Item,
  Party,
  ProductionOrder,
} from "@/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

type Range =
  | "30D"
  | "90D"
  | "YEAR"
  | "ALL";

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function ReportsPage() {
  const [invoices, setInvoices] =
    useState<Invoice[]>([]);

  const [documents, setDocuments] =
    useState<BusinessDocument[]>([]);

  const [orders, setOrders] =
    useState<ProductionOrder[]>([]);

  const [parties, setParties] =
    useState<Party[]>([]);

  const [items, setItems] =
    useState<Item[]>([]);

  const [range, setRange] =
    useState<Range>("YEAR");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  /* ------------------------------------------------------------------------ */
  /* Load Reports                                                             */
  /* ------------------------------------------------------------------------ */

  const loadReports =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const [
          invoiceRes,
          documentRes,
          orderRes,
          partyRes,
          itemRes,
        ] = await Promise.all([
          getAllPages<Invoice>(
            "/invoices",
          ),

          getAllPages<BusinessDocument>(
            "/documents",
          ),

          getAllPages<ProductionOrder>(
            "/production-orders",
          ),

          getAllPages<Party>(
            "/parties",
          ),

          getAllPages<Item>(
            "/items",
          ),
        ]);

        setInvoices(
          invoiceRes.data,
        );

        setDocuments(
          documentRes.data,
        );

        setOrders(
          orderRes.data,
        );

        setParties(
          partyRes.data,
        );

        setItems(
          itemRes.data,
        );
      } catch (
        loadError: unknown
      ) {
        setError(
          getApiError(
            loadError,
            "Could not prepare reports.",
          ),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  /* ------------------------------------------------------------------------ */
  /* Report                                                                   */
  /* ------------------------------------------------------------------------ */

  const report =
    useMemo(() => {
      const now =
        new Date();

      const cutoff =
        new Date(now);

      if (range === "30D") {
        cutoff.setDate(
          now.getDate() - 30,
        );
      }

      if (range === "90D") {
        cutoff.setDate(
          now.getDate() - 90,
        );
      }

      if (range === "YEAR") {
        cutoff.setMonth(
          0,
          1,
        );
      }

      cutoff.setHours(
        0,
        0,
        0,
        0,
      );

      const inRange = (
        value: string,
      ) =>
        range === "ALL" ||
        new Date(value) >=
          cutoff;

      const activeInvoices =
        invoices.filter(
          (invoice) =>
            invoice.status !==
              "CANCELLED" &&
            inRange(
              invoice.issueDate,
            ),
        );

      const purchaseDocs =
        documents.filter(
          (document) =>
            document.type ===
              "PURCHASE_INVOICE" &&
            document.status !==
              "CANCELLED" &&
            inRange(
              document.issueDate,
            ),
        );

      const sales =
        activeInvoices.reduce(
          (
            sum,
            invoice,
          ) =>
            sum +
            Number(
              invoice.grandTotal,
            ),
          0,
        );

      const collected =
        activeInvoices.reduce(
          (
            sum,
            invoice,
          ) =>
            sum +
            Number(
              invoice.amountPaid,
            ),
          0,
        );

      const purchases =
        purchaseDocs.reduce(
          (
            sum,
            document,
          ) =>
            sum +
            Number(
              document.grandTotal,
            ),
          0,
        );

      const productionCost =
        orders
          .filter((order) =>
            inRange(
              order.createdAt,
            ),
          )
          .reduce(
            (
              sum,
              order,
            ) =>
              sum +
              Number(
                order.summary
                  ?.totalMakingCost ||
                  0,
              ),
            0,
          );

      const byStatus = [
        "PAID",
        "PARTIALLY_PAID",
        "UNPAID",
        "DRAFT",
      ].map(
        (status) => ({
          status,

          count:
            activeInvoices.filter(
              (invoice) =>
                invoice.status ===
                status,
            ).length,

          total:
            activeInvoices
              .filter(
                (invoice) =>
                  invoice.status ===
                  status,
              )
              .reduce(
                (
                  sum,
                  invoice,
                ) =>
                  sum +
                  Number(
                    invoice.grandTotal,
                  ),
                0,
              ),
        }),
      );

      const customerMap =
        new Map<
          string,
          {
            name: string;
            total: number;
            paid: number;
            count: number;
          }
        >();

      activeInvoices.forEach(
        (invoice) => {
          const current =
            customerMap.get(
              invoice.party.id,
            ) ?? {
              name:
                invoice.party
                  .name,
              total: 0,
              paid: 0,
              count: 0,
            };

          current.total +=
            Number(
              invoice.grandTotal,
            );

          current.paid +=
            Number(
              invoice.amountPaid,
            );

          current.count += 1;

          customerMap.set(
            invoice.party.id,
            current,
          );
        },
      );

      const topCustomers = [
        ...customerMap.values(),
      ]
        .sort(
          (a, b) =>
            b.total -
            a.total,
        )
        .slice(0, 5);

      const months =
        Array.from(
          {
            length: 6,
          },
          (_, index) => {
            const date =
              new Date(
                now.getFullYear(),
                now.getMonth() -
                  5 +
                  index,
                1,
              );

            const next =
              new Date(
                date.getFullYear(),
                date.getMonth() +
                  1,
                1,
              );

            return {
              label:
                date.toLocaleDateString(
                  "en-IN",
                  {
                    month:
                      "short",
                  },
                ),

              value:
                invoices
                  .filter(
                    (
                      invoice,
                    ) =>
                      invoice.status !==
                        "CANCELLED" &&
                      new Date(
                        invoice.issueDate,
                      ) >= date &&
                      new Date(
                        invoice.issueDate,
                      ) < next,
                  )
                  .reduce(
                    (
                      sum,
                      invoice,
                    ) =>
                      sum +
                      Number(
                        invoice.grandTotal,
                      ),
                    0,
                  ),
            };
          },
        );

      return {
        sales,
        collected,

        outstanding:
          Math.max(
            0,
            sales -
              collected,
          ),

        purchases,
        productionCost,

        profit:
          sales -
          purchases -
          productionCost,

        byStatus,
        topCustomers,
        months,
      };
    }, [
      documents,
      invoices,
      orders,
      range,
    ]);

  /* ------------------------------------------------------------------------ */
  /* Low Stock                                                                */
  /* ------------------------------------------------------------------------ */

  const lowStock =
    items
      .filter(
        (item) =>
          Number(
            item.stockQty,
          ) <= 5,
      )
      .sort(
        (a, b) =>
          Number(
            a.stockQty,
          ) -
          Number(
            b.stockQty,
          ),
      )
      .slice(0, 6);

  const maxMonth =
    Math.max(
      ...report.months.map(
        ({ value }) =>
          value,
      ),
      1,
    );

  /* ------------------------------------------------------------------------ */
  /* Export                                                                   */
  /* ------------------------------------------------------------------------ */

  function exportReport() {
    const rows = [
      [
        "Metric",
        "Value",
      ],
      [
        "Sales",
        report.sales,
      ],
      [
        "Collected",
        report.collected,
      ],
      [
        "Outstanding",
        report.outstanding,
      ],
      [
        "Purchases",
        report.purchases,
      ],
      [
        "Production cost",
        report.productionCost,
      ],
      [
        "Estimated profit",
        report.profit,
      ],
      [
        "Parties",
        parties.length,
      ],
      [
        "Inventory items",
        items.length,
      ],
    ];

    const csv = rows
      .map((row) =>
        row
          .map(
            (value) =>
              `"${String(
                value,
              ).replaceAll(
                '"',
                '""',
              )}"`,
          )
          .join(","),
      )
      .join("\n");

    const url =
      URL.createObjectURL(
        new Blob(
          [csv],
          {
            type: "text/csv;charset=utf-8",
          },
        ),
      );

    const anchor =
      document.createElement(
        "a",
      );

    anchor.href = url;

    anchor.download = `business-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url,
    );
  }

  /* ------------------------------------------------------------------------ */
  /* UI                                                                       */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* ================================================================ */}
      {/* PREMIUM HEADER                                                   */}
      {/* ================================================================ */}

      <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />

        <div className="pointer-events-none absolute -bottom-20 left-[40%] h-40 w-40 rounded-full bg-cyan-100/50 blur-3xl" />

        <div className="relative flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          {/* Heading */}

          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="h-5 w-1 rounded-full bg-blue-600" />

              <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                Business Analytics
              </span>
            </div>

            <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              Reports
            </h1>

            <p className="mt-1 max-w-2xl text-[10px] leading-5 text-slate-500">
              Sales, collections,
              costs, customers and
              inventory performance
              in one workspace.
            </p>
          </div>

          {/* Actions */}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                void loadReports()
              }
              className="
                group
                inline-flex
                h-9
                items-center
                gap-1.5
                rounded-lg
                border
                border-slate-200
                bg-white
                px-3
                text-[9px]
                font-extrabold
                text-slate-600
                shadow-sm
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:border-blue-200
                hover:bg-blue-50
                hover:text-blue-700
              "
            >
              <RefreshCw
                size={13}
                className="transition-transform duration-500 group-hover:rotate-180"
              />

              Refresh
            </button>

            <button
              type="button"
              onClick={
                exportReport
              }
              disabled={
                loading ||
                Boolean(error)
              }
              className="
                group
                inline-flex
                h-9
                items-center
                gap-1.5
                rounded-lg
                bg-blue-600
                px-3
                text-[9px]
                font-extrabold
                text-white
                shadow-[0_7px_18px_rgba(37,99,235,0.20)]
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-blue-700
                hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)]
                disabled:pointer-events-none
                disabled:opacity-50
              "
            >
              <Download
                size={13}
                className="transition-transform duration-300 group-hover:translate-y-0.5"
              />

              Export CSV
            </button>
          </div>
        </div>

        <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
      </section>

      {/* ================================================================ */}
      {/* REPORT RANGE - COMPACT SINGLE LINE                              */}
      {/* ================================================================ */}

      <section className="mb-4 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-800">
              Reporting Period
            </p>

            <p className="mt-0.5 text-[8px] text-slate-400">
              Values update
              automatically by period
            </p>
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-lg bg-slate-100 p-1">
            {(
              [
                "30D",
                "90D",
                "YEAR",
                "ALL",
              ] as Range[]
            ).map(
              (value) => (
                <button
                  key={
                    value
                  }
                  type="button"
                  onClick={() =>
                    setRange(
                      value,
                    )
                  }
                  className={`
                    whitespace-nowrap
                    rounded-md
                    px-3
                    py-1.5
                    text-[8px]
                    font-extrabold
                    transition-all
                    duration-200
                    ${
                      range ===
                      value
                        ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200"
                        : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                    }
                  `}
                >
                  {value ===
                  "30D"
                    ? "30 Days"
                    : value ===
                        "90D"
                      ? "90 Days"
                      : value ===
                          "YEAR"
                        ? "This Year"
                        : "All Time"}
                </button>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ================================================================ */}
      {/* CONTENT                                                          */}
      {/* ================================================================ */}

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <LoadingState label="Generating business reports..." />
        </section>
      ) : error ? (
        <section className="rounded-2xl border border-red-100 bg-white">
          <ErrorState
            message={error}
            onRetry={
              loadReports
            }
          />
        </section>
      ) : (
        <>
          {/* ============================================================ */}
          {/* MAIN METRICS                                                 */}
          {/* ============================================================ */}

          <div className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
            <ReportCard
              icon={
                TrendingUp
              }
              label="Net Sales"
              value={formatCurrency(
                report.sales,
              )}
              description="Total invoice value"
              tone="blue"
            />

            <ReportCard
              icon={
                CircleDollarSign
              }
              label="Collected"
              value={formatCurrency(
                report.collected,
              )}
              description="Payments received"
              tone="emerald"
            />

            <ReportCard
              icon={
                IndianRupee
              }
              label="Outstanding"
              value={formatCurrency(
                report.outstanding,
              )}
              description="Pending collections"
              tone="red"
            />

            <ReportCard
              icon={
                BarChart3
              }
              label="Estimated Profit"
              value={formatCurrency(
                report.profit,
              )}
              description="After purchase & production"
              tone={
                report.profit >=
                0
                  ? "violet"
                  : "red"
              }
            />
          </div>

          {/* ============================================================ */}
          {/* CHART + PAYMENT STATUS                                       */}
          {/* ============================================================ */}

          <div className="mb-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.6fr)]">
            {/* Sales Trend */}

            <section className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)] transition-all duration-300 hover:border-blue-100 hover:shadow-[0_12px_30px_rgba(37,99,235,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <h2 className="text-[11px] font-extrabold text-slate-900">
                    Six-Month Sales
                    Trend
                  </h2>

                  <p className="mt-0.5 text-[8px] text-slate-400">
                    Invoice value by
                    issue month
                  </p>
                </div>

                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <TrendingUp
                    size={14}
                  />
                </span>
              </div>

              <div className="relative px-4 pb-4 pt-5">
                {/* Background Lines */}

                <div className="pointer-events-none absolute inset-x-4 bottom-10 top-5 flex flex-col justify-between">
                  <span className="border-t border-dashed border-slate-100" />
                  <span className="border-t border-dashed border-slate-100" />
                  <span className="border-t border-dashed border-slate-100" />
                  <span className="border-t border-dashed border-slate-100" />
                </div>

                {/* No horizontal slider */}

                <div className="relative grid h-52 grid-cols-6 items-end gap-2 sm:gap-4">
                  {report.months.map(
                    (
                      month,
                      index,
                    ) => {
                      const height =
                        Math.max(
                          5,
                          (month.value /
                            maxMonth) *
                            150,
                        );

                      return (
                        <div
                          key={
                            month.label
                          }
                          className="group/bar flex h-full min-w-0 flex-col justify-end text-center"
                        >
                          <div className="mb-1.5 min-h-[24px]">
                            <span className="block truncate text-[7px] font-extrabold text-slate-500 sm:text-[8px]">
                              {formatCurrency(
                                month.value,
                              )}
                            </span>
                          </div>

                          <div className="relative flex h-[150px] items-end justify-center">
                            <div
                              className="
                                w-full
                                max-w-[52px]
                                rounded-t-lg
                                bg-gradient-to-t
                                from-blue-600
                                to-cyan-400
                                shadow-[0_5px_15px_rgba(37,99,235,0.15)]
                                transition-all
                                duration-500
                                group-hover/bar:-translate-y-1
                                group-hover/bar:shadow-[0_10px_20px_rgba(37,99,235,0.20)]
                              "
                              style={{
                                height: `${height}px`,
                              }}
                            >
                              <div className="mx-auto mt-1 h-1 w-1/2 rounded-full bg-white/30" />
                            </div>
                          </div>

                          <span className="mt-2 text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                            {
                              month.label
                            }
                          </span>

                          <span className="mt-0.5 text-[7px] text-slate-300">
                            M
                            {index +
                              1}
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              </div>
            </section>

            {/* Payment Status */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
                <div>
                  <h2 className="text-[11px] font-extrabold text-slate-900">
                    Payment Status
                  </h2>

                  <p className="mt-0.5 text-[8px] text-slate-400">
                    Invoice distribution
                  </p>
                </div>

                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                  <CircleDollarSign
                    size={14}
                  />
                </span>
              </div>

              <div>
                {report.byStatus.map(
                  (
                    row,
                    index,
                  ) => {
                    const statusTone =
                      getPaymentTone(
                        row.status,
                      );

                    return (
                      <div
                        key={
                          row.status
                        }
                        className={`
                          group
                          grid
                          grid-cols-[minmax(0,1fr)_36px_minmax(80px,110px)]
                          items-center
                          gap-2
                          border-b
                          border-slate-100
                          px-4
                          py-3
                          transition-all
                          duration-200
                          hover:bg-blue-50/40
                          ${
                            index ===
                            report
                              .byStatus
                              .length -
                              1
                              ? "border-b-0"
                              : ""
                          }
                        `}
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`h-2 w-2 shrink-0 rounded-full ${statusTone.dot}`}
                          />

                          <span className="truncate text-[9px] font-bold capitalize text-slate-700">
                            {row.status
                              .toLowerCase()
                              .replaceAll(
                                "_",
                                " ",
                              )}
                          </span>
                        </div>

                        <span
                          className={`
                            rounded-md
                            px-1.5
                            py-1
                            text-center
                            text-[8px]
                            font-extrabold
                            ${statusTone.badge}
                          `}
                        >
                          {
                            row.count
                          }
                        </span>

                        <span className="truncate text-right text-[9px] font-black text-slate-900">
                          {formatCurrency(
                            row.total,
                          )}
                        </span>
                      </div>
                    );
                  },
                )}
              </div>
            </section>
          </div>

          {/* ============================================================ */}
          {/* CUSTOMERS + LOW STOCK                                        */}
          {/* ============================================================ */}

          <div className="grid gap-4 xl:grid-cols-2">
            {/* Top Customers */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-blue-50/50 to-white px-4 py-3">
                <div>
                  <h2 className="text-[11px] font-extrabold text-slate-900">
                    Top Customers
                  </h2>

                  <p className="mt-0.5 text-[8px] text-slate-400">
                    Ranked by invoiced
                    value
                  </p>
                </div>

                <Link
                  href="/parties"
                  className="group inline-flex items-center gap-1 text-[8px] font-extrabold text-blue-600 transition hover:text-blue-800"
                >
                  View Parties

                  <ArrowUpRight
                    size={11}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              {report
                .topCustomers
                .length ? (
                <div>
                  {report.topCustomers.map(
                    (
                      customer,
                      index,
                    ) => (
                      <div
                        key={
                          customer.name
                        }
                        className="
                          group
                          grid
                          grid-cols-[28px_minmax(0,1fr)_minmax(80px,120px)]
                          items-center
                          gap-3
                          border-b
                          border-slate-100
                          px-4
                          py-3
                          transition-all
                          duration-200
                          last:border-b-0
                          hover:bg-blue-50/40
                          hover:shadow-[inset_3px_0_0_#2563eb]
                        "
                      >
                        <span
                          className={`
                            flex
                            h-7
                            w-7
                            items-center
                            justify-center
                            rounded-lg
                            text-[9px]
                            font-black
                            transition-transform
                            duration-300
                            group-hover:scale-105
                            ${
                              index ===
                              0
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-600"
                            }
                          `}
                        >
                          {index +
                            1}
                        </span>

                        <div className="min-w-0">
                          <p className="truncate text-[10px] font-extrabold text-slate-800">
                            {
                              customer.name
                            }
                          </p>

                          <p className="mt-0.5 truncate text-[8px] text-slate-400">
                            {
                              customer.count
                            }{" "}
                            invoices
                            {" · "}
                            {formatCurrency(
                              customer.paid,
                            )}{" "}
                            paid
                          </p>
                        </div>

                        <p className="truncate text-right text-[10px] font-black text-slate-950">
                          {formatCurrency(
                            customer.total,
                          )}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              ) : (
                <EmptyPanel label="No customer sales in this period" />
              )}
            </section>

            {/* Low Stock */}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_6px_24px_rgba(15,23,42,0.04)]">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-amber-50/60 to-white px-4 py-3">
                <div>
                  <h2 className="flex items-center gap-1.5 text-[11px] font-extrabold text-slate-900">
                    <AlertTriangle
                      size={14}
                      className="text-amber-500"
                    />

                    Low-Stock Items
                  </h2>

                  <p className="mt-0.5 text-[8px] text-slate-400">
                    Five units or fewer
                  </p>
                </div>

                <Link
                  href="/items"
                  className="group inline-flex items-center gap-1 text-[8px] font-extrabold text-blue-600 transition hover:text-blue-800"
                >
                  View Inventory

                  <ArrowUpRight
                    size={11}
                    className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </div>

              {lowStock.length ? (
                <div>
                  {lowStock.map(
                    (
                      item,
                      index,
                    ) => {
                      const qty =
                        Number(
                          item.stockQty,
                        );

                      return (
                        <div
                          key={
                            item.id
                          }
                          className="
                            group
                            grid
                            grid-cols-[minmax(0,1fr)_auto]
                            items-center
                            gap-3
                            border-b
                            border-slate-100
                            px-4
                            py-3
                            transition-all
                            duration-200
                            last:border-b-0
                            hover:bg-amber-50/40
                            hover:shadow-[inset_3px_0_0_#f59e0b]
                          "
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[7px] font-black text-slate-500">
                                {index +
                                  1}
                              </span>

                              <p className="truncate text-[10px] font-extrabold text-slate-800">
                                {
                                  item.name
                                }
                              </p>
                            </div>

                            <p className="ml-7 mt-0.5 truncate text-[8px] text-slate-400">
                              {item.sku ||
                                "No SKU"}
                            </p>
                          </div>

                          <span
                            className={`
                              whitespace-nowrap
                              rounded-lg
                              border
                              px-2.5
                              py-1
                              text-[8px]
                              font-black
                              ${
                                qty <=
                                0
                                  ? "border-red-100 bg-red-50 text-red-700"
                                  : "border-amber-100 bg-amber-50 text-amber-700"
                              }
                            `}
                          >
                            {qty.toLocaleString(
                              "en-IN",
                            )}{" "}
                            {
                              item.unit
                            }
                          </span>
                        </div>
                      );
                    },
                  )}
                </div>
              ) : (
                <EmptyPanel label="Inventory levels look healthy" />
              )}
            </section>
          </div>

          {/* ============================================================ */}
          {/* SECONDARY METRICS                                            */}
          {/* ============================================================ */}

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SmallMetric
              icon={Users}
              label="Parties"
              value={parties.length.toLocaleString(
                "en-IN",
              )}
            />

            <SmallMetric
              icon={Boxes}
              label="Inventory Units"
              value={items
                .reduce(
                  (
                    sum,
                    item,
                  ) =>
                    sum +
                    Number(
                      item.stockQty,
                    ),
                  0,
                )
                .toLocaleString(
                  "en-IN",
                )}
            />

            <SmallMetric
              icon={
                IndianRupee
              }
              label="Purchases"
              value={formatCurrency(
                report.purchases,
              )}
            />

            <SmallMetric
              icon={
                BarChart3
              }
              label="Production Cost"
              value={formatCurrency(
                report.productionCost,
              )}
            />
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Report Card                                                                */
/* -------------------------------------------------------------------------- */

const REPORT_TONES = {
  blue: {
    icon:
      "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",

    border:
      "hover:border-blue-200 hover:shadow-[0_14px_30px_rgba(37,99,235,0.10)]",

    accent:
      "bg-blue-600",
  },

  emerald: {
    icon:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",

    border:
      "hover:border-emerald-200 hover:shadow-[0_14px_30px_rgba(16,185,129,0.10)]",

    accent:
      "bg-emerald-500",
  },

  red: {
    icon:
      "bg-red-50 text-red-600 group-hover:bg-red-600 group-hover:text-white",

    border:
      "hover:border-red-200 hover:shadow-[0_14px_30px_rgba(239,68,68,0.10)]",

    accent:
      "bg-red-500",
  },

  violet: {
    icon:
      "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",

    border:
      "hover:border-violet-200 hover:shadow-[0_14px_30px_rgba(139,92,246,0.10)]",

    accent:
      "bg-violet-500",
  },
} as const;

function ReportCard({
  icon: Icon,
  label,
  value,
  description,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  description: string;
  tone: keyof typeof REPORT_TONES;
}) {
  const style =
    REPORT_TONES[tone];

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
        ${style.border}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-400">
            {label}
          </p>

          <p className="mt-2 truncate text-lg font-black tracking-tight text-slate-950 sm:text-xl">
            {value}
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

      <div
        className={`
          absolute
          bottom-0
          left-0
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

/* -------------------------------------------------------------------------- */
/* Small Metric                                                               */
/* -------------------------------------------------------------------------- */

function SmallMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div
      className="
        group
        flex
        min-w-0
        items-center
        gap-3
        rounded-xl
        border
        border-slate-200
        bg-white
        p-3
        shadow-[0_4px_15px_rgba(15,23,42,0.04)]
        transition-all
        duration-300
        hover:-translate-y-0.5
        hover:border-blue-200
        hover:shadow-[0_10px_22px_rgba(37,99,235,0.08)]
      "
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-all duration-300 group-hover:bg-blue-600 group-hover:text-white">
        <Icon size={15} />
      </span>

      <div className="min-w-0">
        <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 truncate text-[11px] font-black text-slate-900">
          {value}
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Payment Tone                                                               */
/* -------------------------------------------------------------------------- */

function getPaymentTone(
  status: string,
) {
  switch (status) {
    case "PAID":
      return {
        dot: "bg-emerald-500",
        badge:
          "bg-emerald-50 text-emerald-700",
      };

    case "PARTIALLY_PAID":
      return {
        dot: "bg-blue-500",
        badge:
          "bg-blue-50 text-blue-700",
      };

    case "UNPAID":
      return {
        dot: "bg-red-500",
        badge:
          "bg-red-50 text-red-700",
      };

    default:
      return {
        dot: "bg-slate-400",
        badge:
          "bg-slate-100 text-slate-600",
      };
  }
}

/* -------------------------------------------------------------------------- */
/* Empty Panel                                                                */
/* -------------------------------------------------------------------------- */

function EmptyPanel({
  label,
}: {
  label: string;
}) {
  return (
    <div className="flex min-h-32 items-center justify-center px-5 py-8 text-center">
      <p className="text-[9px] font-medium text-slate-400">
        {label}
      </p>
    </div>
  );
}