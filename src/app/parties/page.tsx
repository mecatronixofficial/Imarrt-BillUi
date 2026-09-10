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
  ArrowDownLeft,
  ArrowUpRight,
  CircleDollarSign,
  FileSpreadsheet,
  FileText,
  IndianRupee,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  Printer,
  Search,
  Settings,
  TrendingUp,
  UserRound,
  Users,
  WalletCards,
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
  getApiError,
} from "@/lib/api";

import {
  formatCurrency,
  formatDate,
} from "@/lib/format";

import type {
  Party,
  PartyLedger,
  PartyTransaction,
} from "@/types";

import InvoiceModal from "@/components/invoices/InvoiceModal";
import DocumentModal from "@/components/documents/DocumentModal";

import {
  EmbeddedFormProvider,
} from "@/components/EmbeddedFormContext";

/* ========================================================================== */
/* GST                                                                        */
/* ========================================================================== */

const GST_TYPE_LABELS: Record<
  NonNullable<Party["gstType"]>,
  string
> = {
  REGISTERED_REGULAR:
    "Registered - Regular",

  REGISTERED_COMPOSITION:
    "Registered - Composition",

  UNREGISTERED:
    "Unregistered business",

  CONSUMER:
    "Consumer",

  OVERSEAS:
    "Overseas",

  SEZ:
    "Special Economic Zone (SEZ)",
};

const GSTIN_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

function isRegisteredGstType(
  type: Party["gstType"],
) {
  return (
    type ===
      "REGISTERED_REGULAR" ||
    type ===
      "REGISTERED_COMPOSITION" ||
    type === "SEZ"
  );
}

/* ========================================================================== */
/* PAGE                                                                       */
/* ========================================================================== */

export default function PartiesPage() {
  const [
    parties,
    setParties,
  ] = useState<Party[]>([]);

  const [
    selectedPartyId,
    setSelectedPartyId,
  ] = useState("");

  const [
    ledger,
    setLedger,
  ] =
    useState<PartyLedger | null>(
      null,
    );

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    detailLoading,
    setDetailLoading,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    detailError,
    setDetailError,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editingParty,
    setEditingParty,
  ] =
    useState<Party | null>(
      null,
    );

  const [
    formTab,
    setFormTab,
  ] = useState<
    "profile" | "credit"
  >("profile");

  const [
    activeForm,
    setActiveForm,
  ] = useState<
    "sale" | "expense" | null
  >(null);

  /* ====================================================================== */
  /* LOAD PARTIES                                                           */
  /* ====================================================================== */

  const loadParties =
    useCallback(
      async (
        preferredId?: string,
      ) => {
        setLoading(true);
        setError("");

        try {
          const { data } =
            await getAllPages<Party>(
              "/parties",
            );

          setParties(data);

          setSelectedPartyId(
            (current) => {
              if (
                preferredId &&
                data.some(
                  (party) =>
                    party.id ===
                    preferredId,
                )
              ) {
                return preferredId;
              }

              if (
                current &&
                data.some(
                  (party) =>
                    party.id ===
                    current,
                )
              ) {
                return current;
              }

              return "";
            },
          );
        } catch (
          loadError: unknown
        ) {
          setError(
            getApiError(
              loadError,
              "Could not load parties.",
            ),
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  /* ====================================================================== */
  /* LOAD LEDGER                                                            */
  /* ====================================================================== */

  const loadLedger =
    useCallback(
      async (
        partyId: string,
      ) => {
        setDetailLoading(
          true,
        );

        setDetailError("");

        try {
          const { data } =
            await api.get<PartyLedger>(
              `/parties/${partyId}/ledger`,
            );

          setLedger(data);
        } catch (
          loadError: unknown
        ) {
          setLedger(null);

          setDetailError(
            getApiError(
              loadError,
              "Could not load party transactions.",
            ),
          );
        } finally {
          setDetailLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(() => {
    void loadParties();
  }, [loadParties]);

  useEffect(() => {
    if (
      !selectedPartyId
    ) {
      setLedger(null);
      return;
    }

    void loadLedger(
      selectedPartyId,
    );
  }, [
    loadLedger,
    selectedPartyId,
  ]);

  /* ====================================================================== */
  /* FILTER                                                                 */
  /* ====================================================================== */

  const filteredParties =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return parties;
      }

      return parties.filter(
        (party) =>
          [
            party.name,
            party.phone,
            party.email,
            party.gstin,
          ].some((value) =>
            value
              ?.toLowerCase()
              .includes(
                query,
              ),
          ),
      );
    }, [
      parties,
      search,
    ]);

  const selectedSummary =
    parties.find(
      (party) =>
        party.id ===
        selectedPartyId,
    ) ?? null;

  const selectedParty =
    ledger?.party ??
    selectedSummary;

  /* ====================================================================== */
  /* SUMMARY                                                                */
  /* ====================================================================== */

  const stats =
    useMemo(() => {
      const billed =
        parties.reduce(
          (
            total,
            party,
          ) =>
            total +
            Number(
              party.totalBilled ??
                0,
            ),
          0,
        );

      const received =
        parties.reduce(
          (
            total,
            party,
          ) =>
            total +
            Number(
              party.totalReceived ??
                0,
            ),
          0,
        );

      const receivable =
        parties.reduce(
          (
            total,
            party,
          ) => {
            const balance =
              Number(
                party.balanceDue ??
                  0,
              );

            return (
              total +
              Math.max(
                0,
                balance,
              )
            );
          },
          0,
        );

      return {
        count:
          parties.length,
        billed,
        received,
        receivable,
      };
    }, [parties]);

  /* ====================================================================== */
  /* PARTY ACTIONS                                                          */
  /* ====================================================================== */

  function openAddParty() {
    setEditingParty(null);
    setFormTab("profile");
    setShowForm(true);
  }

  function openPartySettings(
    tab:
      | "profile"
      | "credit" =
      "profile",
  ) {
    if (
      !selectedParty
    ) {
      return;
    }

    setEditingParty(
      selectedParty,
    );

    setFormTab(tab);

    setShowForm(true);
  }

  /* ====================================================================== */
  /* CONTACT                                                                */
  /* ====================================================================== */

  function openWhatsApp(
    message: string,
  ) {
    const number = (
      selectedParty?.whatsappNumber ||
      selectedParty?.phone ||
      ""
    ).replace(
      /\D/g,
      "",
    );

    if (!number) {
      return;
    }

    window.open(
      `https://wa.me/${number}?text=${encodeURIComponent(
        message,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  function openSms() {
    if (
      !selectedParty?.phone
    ) {
      return;
    }

    window.location.href =
      `sms:${selectedParty.phone}?body=${encodeURIComponent(
        `Hello ${selectedParty.name},`,
      )}`;
  }

  function openEmail() {
    if (
      !selectedParty?.email
    ) {
      return;
    }

    window.location.href =
      `mailto:${selectedParty.email}?subject=${encodeURIComponent(
        `Message for ${selectedParty.name}`,
      )}&body=${encodeURIComponent(
        `Hello ${selectedParty.name},`,
      )}`;
  }

  /* ====================================================================== */
  /* EXPORT                                                                 */
  /* ====================================================================== */

  function exportTransactions() {
    if (
      !selectedParty ||
      !ledger
    ) {
      return;
    }

    const rows = [
      [
        "Type",
        "Number",
        "Date",
        "Total",
        "Balance",
      ],

      ...ledger.transactions.map(
        (
          transaction,
        ) => [
          transaction.type.replaceAll(
            "_",
            " ",
          ),

          transaction.number,

          new Date(
            transaction.date,
          ).toLocaleDateString(
            "en-IN",
          ),

          transaction.amount,

          transaction.balance,
        ],
      ),
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

    anchor.download = `${selectedParty.name
      .replace(
        /[^a-z0-9]+/gi,
        "-",
      )
      .toLowerCase()}-transactions.csv`;

    anchor.click();

    URL.revokeObjectURL(
      url,
    );
  }

  const hasWhatsApp =
    Boolean(
      selectedParty?.whatsappNumber ||
        selectedParty?.phone,
    );

  /* ====================================================================== */
  /* UI                                                                     */
  /* ====================================================================== */

  return (
    <>
      <div className="min-h-screen bg-slate-50/70">
        {/* ================================================================ */}
        {/* PREMIUM HEADER                                                   */}
        {/* ================================================================ */}

        <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute -right-20 -top-20 h-52 w-52 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="pointer-events-none absolute -bottom-20 left-[35%] h-40 w-40 rounded-full bg-cyan-100/50 blur-3xl" />

          <div className="relative flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-600" />

                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Customer &
                  Supplier Ledger
                </span>
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Parties
              </h1>

              <p className="mt-1 max-w-xl text-[10px] leading-5 text-slate-500">
                Manage customers,
                suppliers,
                receivables, billing
                activity and account
                transactions.
              </p>
            </div>

            {/* ACTIONS */}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setActiveForm(
                    "sale",
                  )
                }
                className="
                  group
                  inline-flex
                  h-9
                  items-center
                  gap-1.5
                  rounded-lg
                  border
                  border-blue-100
                  bg-white
                  px-3
                  text-[9px]
                  font-extrabold
                  text-blue-700
                  shadow-sm
                  transition-all
                  hover:-translate-y-0.5
                  hover:border-blue-200
                  hover:bg-blue-50
                "
              >
                <Plus
                  size={12}
                  className="transition-transform group-hover:rotate-90"
                />

                Add Sale
              </button>

              <button
                type="button"
                onClick={() =>
                  setActiveForm(
                    "expense",
                  )
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
                  hover:-translate-y-0.5
                  hover:bg-slate-100
                "
              >
                <ArrowDownLeft
                  size={12}
                />

                Add Purchase
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveForm(
                    null,
                  );

                  openAddParty();
                }}
                className="
                  group
                  inline-flex
                  h-9
                  items-center
                  gap-1.5
                  rounded-lg
                  bg-blue-600
                  px-3.5
                  text-[9px]
                  font-extrabold
                  text-white
                  shadow-[0_7px_18px_rgba(37,99,235,0.22)]
                  transition-all
                  hover:-translate-y-0.5
                  hover:bg-blue-700
                  hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)]
                "
              >
                <Plus
                  size={12}
                  className="transition-transform group-hover:rotate-90"
                />

                Add Party
              </button>

              <button
                type="button"
                disabled={
                  !selectedParty
                }
                onClick={() =>
                  openPartySettings(
                    "credit",
                  )
                }
                aria-label="Party settings"
                className="
                  flex
                  h-9
                  w-9
                  items-center
                  justify-center
                  rounded-lg
                  border
                  border-slate-200
                  bg-white
                  text-slate-500
                  shadow-sm
                  transition-all
                  hover:border-blue-200
                  hover:bg-blue-50
                  hover:text-blue-600
                  disabled:pointer-events-none
                  disabled:opacity-35
                "
              >
                <Settings
                  size={13}
                />
              </button>
            </div>
          </div>

          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
        </section>

        {/* ================================================================ */}
        {/* METRICS                                                          */}
        {/* ================================================================ */}

        <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <PartyMetric
            icon={Users}
            label="Total Parties"
            value={stats.count.toLocaleString(
              "en-IN",
            )}
            description="Customers & suppliers"
            tone="blue"
          />

          <PartyMetric
            icon={
              IndianRupee
            }
            label="Total Sales"
            value={formatCurrency(
              stats.billed,
            )}
            description="Total billed value"
            tone="violet"
          />

          <PartyMetric
            icon={
              TrendingUp
            }
            label="Received"
            value={formatCurrency(
              stats.received,
            )}
            description="Payments collected"
            tone="emerald"
          />

          <PartyMetric
            icon={
              WalletCards
            }
            label="Receivable"
            value={formatCurrency(
              stats.receivable,
            )}
            description="Pending collections"
            tone="amber"
          />
        </section>

        {/* ================================================================ */}
        {/* PARTY REGISTER                                                   */}
        {/* ================================================================ */}

        <PartyRegisterTable
          parties={
            filteredParties
          }
          selectedId={
            selectedPartyId
          }
          search={search}
          onSearch={
            setSearch
          }
          onSelect={
            setSelectedPartyId
          }
          loading={loading}
          error={error}
          onRetry={() =>
            loadParties()
          }
        />

        {/* ================================================================ */}
        {/* NO SELECTED PARTY                                                */}
        {/* ================================================================ */}

        {!selectedParty ? (
          <section className="mt-4 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center shadow-[0_6px_22px_rgba(15,23,42,0.04)]">
            <div className="max-w-md">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Users
                  size={20}
                />
              </span>

              <h3 className="mt-4 text-[12px] font-black text-slate-800">
                Select a Party
              </h3>

              <p className="mt-1.5 text-[9px] leading-5 text-slate-400">
                Select any customer or
                supplier from the
                register to view
                contact information,
                outstanding balance
                and transaction
                history.
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ============================================================ */}
            {/* PARTY PROFILE                                               */}
            {/* ============================================================ */}

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              {/* HEADER */}

              <div className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-4 py-4 sm:px-5">
                <div className="pointer-events-none absolute -right-16 -top-20 h-40 w-40 rounded-full bg-blue-100/80 blur-3xl" />

                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1.5 flex items-center gap-2">
                      <span className="rounded-md bg-blue-100 px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-blue-700">
                        Selected Party
                      </span>

                      {selectedParty.gstin ? (
                        <span className="rounded-md bg-emerald-100 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-emerald-700">
                          GST Registered
                        </span>
                      ) : (
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] text-slate-500">
                          Non GST
                        </span>
                      )}
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-lg font-black tracking-tight text-slate-950">
                        {
                          selectedParty.name
                        }
                      </h2>

                      <button
                        type="button"
                        onClick={() =>
                          openPartySettings(
                            "profile",
                          )
                        }
                        aria-label="Edit party"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil
                          size={12}
                        />
                      </button>
                    </div>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      <PartyField
                        icon={Phone}
                        label="Phone"
                        value={
                          selectedParty.phone
                        }
                      />

                      <PartyField
                        icon={Mail}
                        label="Email"
                        value={
                          selectedParty.email
                        }
                      />

                      <PartyField
                        icon={MapPin}
                        label="Billing Address"
                        value={
                          selectedParty.billingAddr
                        }
                      />
                    </div>
                  </div>

                  {/* CONTACT ACTIONS */}

                  <div className="flex shrink-0 items-center gap-2">
                    <ContactAction
                      label="Email"
                      disabled={
                        !selectedParty.email
                      }
                      onClick={
                        openEmail
                      }
                      tone="violet"
                    >
                      <Mail
                        size={13}
                      />
                    </ContactAction>

                    <ContactAction
                      label="SMS"
                      disabled={
                        !selectedParty.phone
                      }
                      onClick={
                        openSms
                      }
                      tone="blue"
                    >
                      <MessageSquareText
                        size={13}
                      />
                    </ContactAction>

                    <ContactAction
                      label="WhatsApp"
                      disabled={
                        !hasWhatsApp
                      }
                      onClick={() =>
                        openWhatsApp(
                          `Hello ${selectedParty.name},`,
                        )
                      }
                      tone="emerald"
                    >
                      <MessageCircle
                        size={13}
                      />
                    </ContactAction>
                  </div>
                </div>
              </div>

              {/* LEDGER SUMMARY */}

              {ledger && (
                <div className="grid grid-cols-2 gap-px bg-slate-200 sm:grid-cols-4">
                  <MiniTotal
                    label="Receivable"
                    value={
                      ledger.summary
                        .balanceDue
                    }
                    tone="red"
                  />

                  <MiniTotal
                    label="Total Sales"
                    value={
                      ledger.summary
                        .totalBilled
                    }
                    tone="blue"
                  />

                  <MiniTotal
                    label="Received"
                    value={
                      ledger.summary
                        .totalReceived
                    }
                    tone="emerald"
                  />

                  <MiniTotal
                    label="Credit Available"
                    value={
                      ledger.summary
                        .creditAvailable
                    }
                    tone="violet"
                  />
                </div>
              )}
            </section>

            {/* ============================================================ */}
            {/* TRANSACTION REGISTER                                        */}
            {/* ============================================================ */}

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-blue-600" />

                    <h3 className="text-[11px] font-black text-slate-950">
                      Transactions
                    </h3>

                    {ledger && (
                      <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[7px] font-bold text-slate-500">
                        {
                          ledger
                            .transactions
                            .length
                        }
                      </span>
                    )}
                  </div>

                  <p className="ml-3 mt-0.5 text-[8px] text-slate-400">
                    Invoices, payments
                    and running account
                    balance
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      window.print()
                    }
                    aria-label="Print transactions"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Printer
                      size={12}
                    />
                  </button>

                  <button
                    type="button"
                    disabled={
                      !ledger
                        ?.transactions
                        .length
                    }
                    onClick={
                      exportTransactions
                    }
                    aria-label="Export transactions"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                  >
                    <FileSpreadsheet
                      size={12}
                    />
                  </button>
                </div>
              </div>

              {detailLoading &&
              !ledger ? (
                <LoadingState label="Loading party account..." />
              ) : detailError ? (
                <ErrorState
                  message={
                    detailError
                  }
                  onRetry={() =>
                    loadLedger(
                      selectedParty.id,
                    )
                  }
                />
              ) : ledger
                  ?.transactions
                  .length ? (
                /*
                 * NO overflow-x-auto
                 * NO min-width
                 * NO horizontal slider
                 */
                <div className="w-full">
                  <table className="w-full table-fixed border-collapse">
                    <caption className="sr-only">
                      Party transactions
                    </caption>

                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-950">
                        <th className="w-[20%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                          Type
                        </th>

                        <th className="w-[28%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                          Number
                        </th>

                        <th className="hidden w-[16%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 md:table-cell">
                          Date
                        </th>

                        <th className="w-[24%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                          Amount
                        </th>

                        <th className="w-[28%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-blue-300">
                          Balance
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {ledger.transactions.map(
                        (
                          transaction,
                        ) => (
                          <TransactionRow
                            key={
                              transaction.id
                            }
                            transaction={
                              transaction
                            }
                          />
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[190px] items-center justify-center px-5 py-10 text-center">
                  <div>
                    <FileText
                      className="mx-auto text-slate-300"
                      size={24}
                    />

                    <p className="mt-2 text-[10px] font-extrabold text-slate-600">
                      No Transactions
                      Yet
                    </p>

                    <p className="mt-1 text-[8px] text-slate-400">
                      Invoices and
                      payments for this
                      party will appear
                      here.
                    </p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* ================================================================== */}
      {/* SALE / PURCHASE                                                    */}
      {/* ================================================================== */}

      {activeForm && (
        <EmbeddedFormProvider
          value={{
            initialPartyId:
              selectedParty?.id,
          }}
        >
          {activeForm ===
          "sale" ? (
            <InvoiceModal
              onClose={() =>
                setActiveForm(
                  null,
                )
              }
            />
          ) : (
            <DocumentModal
              type="PURCHASE_INVOICE"
              onClose={() =>
                setActiveForm(
                  null,
                )
              }
            />
          )}
        </EmbeddedFormProvider>
      )}

      {/* ================================================================== */}
      {/* PARTY FORM                                                         */}
      {/* ================================================================== */}

      {showForm && (
        <PartyFormModal
          party={
            editingParty
          }
          initialTab={
            formTab
          }
          onClose={() =>
            setShowForm(false)
          }
          onSaved={(
            savedParty,
          ) => {
            setShowForm(false);

            void loadParties(
              savedParty.id,
            );
          }}
        />
      )}
    </>
  );
}

/* ========================================================================== */
/* PARTY REGISTER                                                             */
/* ========================================================================== */

function PartyRegisterTable({
  parties,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
  error,
  onRetry,
}: {
  parties: Party[];
  selectedId: string;
  search: string;

  onSearch: (
    value: string,
  ) => void;

  onSelect: (
    id: string,
  ) => void;

  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
      {/* TOOLBAR */}

      <div className="grid items-center gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-3 py-3 sm:grid-cols-[190px_minmax(220px,1fr)] sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-blue-600" />

            <h2 className="text-[11px] font-black text-slate-950">
              Party Register
            </h2>

            <span className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[7px] font-bold text-slate-500">
              {parties.length}
            </span>
          </div>

          <p className="ml-3 mt-0.5 truncate text-[8px] text-slate-400">
            Party accounts and
            outstanding balances
          </p>
        </div>

        <div className="relative min-w-0">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(
              event,
            ) =>
              onSearch(
                event.target
                  .value,
              )
            }
            placeholder="Search party, phone, email or GSTIN..."
            aria-label="Search parties"
            className="
              h-8
              w-full
              rounded-lg
              border
              border-slate-200
              bg-white
              pl-7
              pr-3
              text-[9px]
              font-medium
              text-slate-700
              outline-none
              transition-all
              placeholder:text-slate-400
              hover:border-blue-200
              focus:border-blue-400
              focus:ring-2
              focus:ring-blue-100
            "
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading parties..." />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={
            onRetry
          }
        />
      ) : parties.length ===
        0 ? (
        <EmptyState
          icon={UserRound}
          title="No parties found"
          description={
            search
              ? "Try a different search."
              : "Add your first party to start billing."
          }
        />
      ) : (
        /*
         * NO overflow-x-auto
         * No horizontal slider
         */
        <div className="w-full">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">
              Party register
            </caption>

            <thead>
              <tr className="border-b border-slate-200 bg-slate-950">
                <th className="w-[5%] border-r border-white/10 px-1 py-2.5 text-center text-[7px] font-black uppercase text-slate-400">
                  #
                </th>

                <th className="w-[27%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                  Party
                </th>

                <th className="hidden w-[14%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 md:table-cell">
                  Phone
                </th>

                <th className="hidden w-[18%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 lg:table-cell">
                  Email
                </th>

                <th className="hidden w-[15%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 xl:table-cell">
                  GSTIN
                </th>

                <th className="w-[20%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                  Sales
                </th>

                <th className="hidden w-[17%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-emerald-300 sm:table-cell">
                  Received
                </th>

                <th className="w-[21%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-amber-300">
                  Balance
                </th>
              </tr>
            </thead>

            <tbody>
              {parties.map(
                (
                  party,
                  index,
                ) => {
                  const balance =
                    Number(
                      party.balanceDue ??
                        0,
                    );

                  const selected =
                    party.id ===
                    selectedId;

                  return (
                    <tr
                      key={
                        party.id
                      }
                      onClick={() =>
                        onSelect(
                          party.id,
                        )
                      }
                      className={`
                        group
                        cursor-pointer
                        border-b
                        border-slate-100
                        transition-all
                        duration-200

                        ${
                          selected
                            ? "bg-blue-50 shadow-[inset_3px_0_0_#2563eb]"
                            : index % 2
                              ? "bg-slate-50/40 hover:bg-blue-50/40"
                              : "bg-white hover:bg-blue-50/40"
                        }
                      `}
                    >
                      <td className="border-r border-slate-100 px-1 py-3 text-center text-[8px] font-bold text-slate-400">
                        {String(
                          index + 1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </td>

                      <td className="min-w-0 border-r border-slate-100 px-3 py-3">
                        <p
                          title={
                            party.name
                          }
                          className={`truncate text-[10px] font-extrabold transition-colors ${
                            selected
                              ? "text-blue-700"
                              : "text-slate-900 group-hover:text-blue-700"
                          }`}
                        >
                          {
                            party.name
                          }
                        </p>

                        {party.phone && (
                          <p className="mt-0.5 truncate text-[7px] text-slate-400 md:hidden">
                            {
                              party.phone
                            }
                          </p>
                        )}
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 text-[9px] font-medium text-slate-600 md:table-cell">
                        <p className="truncate">
                          {party.phone ||
                            "—"}
                        </p>
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 text-[8px] text-slate-500 lg:table-cell">
                        <p className="truncate">
                          {party.email ||
                            "—"}
                        </p>
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 xl:table-cell">
                        {party.gstin ? (
                          <span className="block truncate font-mono text-[8px] font-semibold text-slate-500">
                            {
                              party.gstin
                            }
                          </span>
                        ) : (
                          <span className="text-slate-300">
                            —
                          </span>
                        )}
                      </td>

                      <td className="border-r border-slate-100 bg-slate-50/30 px-3 py-3 text-right">
                        <span className="whitespace-nowrap text-[9px] font-extrabold text-slate-800">
                          {formatCurrency(
                            party.totalBilled ??
                              0,
                          )}
                        </span>
                      </td>

                      <td className="hidden border-r border-slate-100 bg-emerald-50/20 px-3 py-3 text-right sm:table-cell">
                        <span className="whitespace-nowrap text-[9px] font-extrabold text-emerald-700">
                          {formatCurrency(
                            party.totalReceived ??
                              0,
                          )}
                        </span>
                      </td>

                      <td
                        className={`
                          px-3
                          py-3
                          text-right

                          ${
                            balance >
                            0
                              ? "bg-red-50/40"
                              : balance <
                                  0
                                ? "bg-emerald-50/30"
                                : "bg-slate-50/20"
                          }
                        `}
                      >
                        <span
                          className={`
                            inline-flex
                            whitespace-nowrap
                            rounded-md
                            px-2
                            py-1
                            text-[8px]
                            font-black

                            ${
                              balance >
                              0
                                ? "bg-red-100/70 text-red-700"
                                : balance <
                                    0
                                  ? "bg-emerald-100/70 text-emerald-700"
                                  : "bg-slate-100 text-slate-500"
                            }
                          `}
                        >
                          {formatCurrency(
                            Math.abs(
                              balance,
                            ),
                          )}

                          {balance <
                          0
                            ? " Cr"
                            : balance >
                                0
                              ? " Dr"
                              : ""}
                        </span>
                      </td>
                    </tr>
                  );
                },
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading &&
        !error &&
        parties.length >
          0 && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/70 px-4 py-2">
            <p className="text-[8px] font-medium text-slate-500">
              Showing{" "}
              <span className="font-extrabold text-slate-800">
                {
                  parties.length
                }
              </span>{" "}
              records
            </p>

            <p className="hidden text-[8px] text-slate-400 sm:block">
              Select a row to
              view account activity
            </p>
          </div>
        )}
    </section>
  );
}

/* ========================================================================== */
/* PARTY METRIC                                                               */
/* ========================================================================== */

const PARTY_TONES = {
  blue: {
    icon:
      "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white",
    accent:
      "bg-blue-600",
    border:
      "hover:border-blue-200",
  },

  violet: {
    icon:
      "bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white",
    accent:
      "bg-violet-500",
    border:
      "hover:border-violet-200",
  },

  emerald: {
    icon:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    accent:
      "bg-emerald-500",
    border:
      "hover:border-emerald-200",
  },

  amber: {
    icon:
      "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
    accent:
      "bg-amber-500",
    border:
      "hover:border-amber-200",
  },
} as const;

function PartyMetric({
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

  tone:
    keyof typeof PARTY_TONES;
}) {
  const style =
    PARTY_TONES[tone];

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
          <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
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
          <Icon
            size={17}
          />
        </span>
      </div>

      <span
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

/* ========================================================================== */
/* PARTY FIELD                                                                */
/* ========================================================================== */

function PartyField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value?:
    | string
    | null;
}) {
  return (
    <div className="group flex min-w-0 items-start gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 transition-all hover:border-blue-200 hover:bg-blue-50/40">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
        <Icon
          size={11}
        />
      </span>

      <div className="min-w-0">
        <p className="text-[6px] font-black uppercase tracking-[0.12em] text-slate-400">
          {label}
        </p>

        <p className="mt-0.5 break-words text-[9px] font-semibold leading-4 text-slate-700">
          {value ||
            "Not provided"}
        </p>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* CONTACT ACTION                                                             */
/* ========================================================================== */

function ContactAction({
  children,
  label,
  disabled,
  onClick,
  tone,
}: {
  children: ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
  tone:
    | "blue"
    | "violet"
    | "emerald";
}) {
  const styles = {
    blue:
      "border-blue-100 bg-blue-50 text-blue-600 hover:bg-blue-600",

    violet:
      "border-violet-100 bg-violet-50 text-violet-600 hover:bg-violet-600",

    emerald:
      "border-emerald-100 bg-emerald-50 text-emerald-600 hover:bg-emerald-600",
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={
        label
      }
      disabled={
        disabled
      }
      onClick={
        onClick
      }
      className={`
        flex
        h-8
        w-8
        items-center
        justify-center
        rounded-lg
        border
        transition-all
        duration-200
        hover:-translate-y-0.5
        hover:text-white
        hover:shadow-md
        disabled:pointer-events-none
        disabled:opacity-30

        ${styles[tone]}
      `}
    >
      {children}
    </button>
  );
}

/* ========================================================================== */
/* MINI TOTAL                                                                 */
/* ========================================================================== */

function MiniTotal({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;

  tone:
    | "red"
    | "blue"
    | "emerald"
    | "violet";
}) {
  const colors = {
    red:
      "text-red-600",

    blue:
      "text-blue-700",

    emerald:
      "text-emerald-700",

    violet:
      "text-violet-700",
  };

  return (
    <div className="min-w-0 bg-white px-3 py-3 transition-colors hover:bg-slate-50">
      <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p
        className={`mt-1 truncate text-[11px] font-black ${colors[tone]}`}
      >
        {formatCurrency(
          Math.abs(
            value,
          ),
        )}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* TRANSACTION ROW                                                            */
/* ========================================================================== */

function TransactionRow({
  transaction,
}: {
  transaction: PartyTransaction;
}) {
  const isPayment =
    transaction.type ===
    "PAYMENT_IN";

  const isOpening =
    transaction.type ===
    "OPENING_BALANCE";

  return (
    <tr className="group border-b border-slate-100 transition-all duration-200 hover:bg-blue-50/40 hover:shadow-[inset_3px_0_0_#2563eb]">
      <td className="border-r border-slate-100 px-3 py-3">
        <span
          className={`
            inline-flex
            items-center
            gap-1
            whitespace-nowrap
            text-[8px]
            font-extrabold

            ${
              isPayment
                ? "text-emerald-700"
                : isOpening
                  ? "text-violet-700"
                  : "text-blue-700"
            }
          `}
        >
          {isPayment ? (
            <ArrowDownLeft
              size={10}
            />
          ) : (
            <ArrowUpRight
              size={10}
            />
          )}

          {isPayment
            ? "Payment In"
            : isOpening
              ? "Opening"
              : "Sale"}
        </span>
      </td>

      <td className="min-w-0 border-r border-slate-100 px-3 py-3">
        {transaction.invoiceId &&
        transaction.type ===
          "SALE_INVOICE" ? (
          <Link
            href={`/invoices/${transaction.invoiceId}`}
            className="block truncate text-[9px] font-extrabold text-blue-600 hover:text-blue-800"
          >
            {
              transaction.number
            }
          </Link>
        ) : (
          <span className="block truncate text-[9px] font-bold text-slate-700">
            {
              transaction.number
            }
          </span>
        )}
      </td>

      <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-[8px] font-medium text-slate-500 md:table-cell">
        {formatDate(
          transaction.date,
        )}
      </td>

      <td
        className={`
          border-r
          border-slate-100
          px-3
          py-3
          text-right
          text-[9px]
          font-extrabold

          ${
            isPayment
              ? "text-emerald-600"
              : "text-slate-800"
          }
        `}
      >
        {isPayment ||
        transaction.amount <
          0
          ? "-"
          : ""}

        {formatCurrency(
          Math.abs(
            transaction.amount,
          ),
        )}
      </td>

      <td className="bg-blue-50/20 px-3 py-3 text-right">
        <span
          className={`
            whitespace-nowrap
            text-[9px]
            font-black

            ${
              transaction.balance >
              0
                ? "text-red-600"
                : transaction.balance <
                    0
                  ? "text-emerald-600"
                  : "text-slate-700"
            }
          `}
        >
          {formatCurrency(
            Math.abs(
              transaction.balance,
            ),
          )}

          {transaction.balance <
          0
            ? " Cr"
            : transaction.balance >
                0
              ? " Dr"
              : ""}
        </span>
      </td>
    </tr>
  );
}

/* ========================================================================== */
/* FORM STATE                                                                 */
/* ========================================================================== */

type PartyFormState = {
  name: string;
  email: string;
  phone: string;
  whatsappNumber: string;
  whatsappOptIn: boolean;

  gstin: string;

  gstType:
    NonNullable<
      Party["gstType"]
    >;

  billingAddr: string;
  shippingAddr: string;

  creditLimit: string;
  openingBalance: string;

  openingBalanceType:
    NonNullable<
      Party["openingBalanceType"]
    >;

  notes: string;

  invoiceDeliveryMode:
    NonNullable<
      Party["invoiceDeliveryMode"]
    >;

  invoiceDeliveryChannel:
    NonNullable<
      Party["invoiceDeliveryChannel"]
    >;
};

function createForm(
  party: Party | null,
): PartyFormState {
  return {
    name:
      party?.name ?? "",

    email:
      party?.email ?? "",

    phone:
      party?.phone ?? "",

    whatsappNumber:
      party?.whatsappNumber ??
      party?.phone ??
      "",

    whatsappOptIn:
      party?.whatsappOptIn ??
      false,

    gstin:
      party?.gstin ?? "",

    gstType:
      party?.gstType ??
      "UNREGISTERED",

    billingAddr:
      party?.billingAddr ??
      "",

    shippingAddr:
      party?.shippingAddr ??
      "",

    creditLimit:
      String(
        party?.creditLimit ??
          0,
      ),

    openingBalance:
      String(
        party?.openingBalance ??
          0,
      ),

    openingBalanceType:
      party?.openingBalanceType ??
      "RECEIVABLE",

    notes:
      party?.notes ?? "",

    invoiceDeliveryMode:
      party?.invoiceDeliveryMode ??
      "MANUAL",

    invoiceDeliveryChannel:
      party?.invoiceDeliveryChannel ??
      "BOTH",
  };
}

/* ========================================================================== */
/* PARTY FORM                                                                 */
/* ========================================================================== */

function PartyFormModal({
  party,
  initialTab,
  onClose,
  onSaved,
}: {
  party: Party | null;

  initialTab:
    | "profile"
    | "credit";

  onClose: () => void;

  onSaved: (
    party: Party,
  ) => void;
}) {
  const [
    tab,
    setTab,
  ] = useState(
    initialTab,
  );

  const [
    form,
    setForm,
  ] =
    useState<PartyFormState>(
      () =>
        createForm(
          party,
        ),
    );

  const [
    hasDifferentWhatsApp,
    setHasDifferentWhatsApp,
  ] = useState(() =>
    Boolean(
      party?.whatsappNumber &&
        party.whatsappNumber.trim() !==
          (
            party.phone ??
            ""
          ).trim(),
    ),
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  const registered =
    isRegisteredGstType(
      form.gstType,
    );

  /* ====================================================================== */
  /* SAVE                                                                   */
  /* ====================================================================== */

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    if (
      registered &&
      !GSTIN_PATTERN.test(
        form.gstin
          .trim()
          .toUpperCase(),
      )
    ) {
      setTab(
        "profile",
      );

      setError(
        "Enter a valid 15-character GSTIN in the official alphanumeric format.",
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        ...form,

        name:
          form.name.trim(),

        email:
          form.email
            .trim()
            .toLowerCase() ||
          undefined,

        phone:
          form.phone.trim() ||
          undefined,

        whatsappNumber:
          (
            hasDifferentWhatsApp
              ? form.whatsappNumber
              : form.phone
          ).trim() ||
          undefined,

        gstin:
          registered
            ? form.gstin
                .trim()
                .toUpperCase()
            : undefined,

        billingAddr:
          form.billingAddr.trim() ||
          undefined,

        shippingAddr:
          form.shippingAddr.trim() ||
          undefined,

        notes:
          form.notes.trim() ||
          undefined,

        creditLimit:
          Math.max(
            0,
            Number(
              form.creditLimit,
            ) || 0,
          ),

        openingBalance:
          Math.max(
            0,
            Number(
              form.openingBalance,
            ) || 0,
          ),
      };

      const { data } =
        party
          ? await api.patch<Party>(
              `/parties/${party.id}`,
              payload,
            )
          : await api.post<Party>(
              "/parties",
              payload,
            );

      onSaved(data);
    } catch (
      saveError: unknown
    ) {
      setError(
        getApiError(
          saveError,
          "Could not save party.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        party
          ? "Edit Party"
          : "Add Party"
      }
      onClose={
        onClose
      }
      size="lg"
      className="!max-w-3xl"
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        {/* ERROR */}

        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[9px] font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        {/* CONTACT */}

        <section className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
          <div className="mb-3">
            <p className="text-[10px] font-black text-slate-900">
              Party Details
            </p>

            <p className="mt-0.5 text-[8px] text-slate-400">
              Basic contact and
              communication
              information
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField
              label="Party Name"
              required
            >
              <input
                id="party-name"
                required
                autoFocus
                className="input-field"
                value={
                  form.name
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    name:
                      event
                        .target
                        .value,
                  })
                }
                placeholder="Business or customer name"
              />
            </FormField>

            <FormField label="Phone Number">
              <input
                id="party-phone"
                type="tel"
                autoComplete="tel"
                className="input-field"
                value={
                  form.phone
                }
                onChange={(
                  event,
                ) => {
                  const phone =
                    event
                      .target
                      .value;

                  setForm({
                    ...form,

                    phone,

                    whatsappNumber:
                      hasDifferentWhatsApp
                        ? form.whatsappNumber
                        : phone,
                  });
                }}
              />
            </FormField>

            <FormField label="WhatsApp Number">
              <input
                id="party-whatsapp"
                type="tel"
                autoComplete="tel"
                disabled={
                  !hasDifferentWhatsApp
                }
                className="input-field disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                value={
                  hasDifferentWhatsApp
                    ? form.whatsappNumber
                    : form.phone
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    whatsappNumber:
                      event
                        .target
                        .value,
                  })
                }
                placeholder={
                  hasDifferentWhatsApp
                    ? "Enter WhatsApp number"
                    : "Same as phone"
                }
              />

              <label className="mt-1.5 flex cursor-pointer items-center gap-2 text-[8px] font-semibold text-slate-500">
                <input
                  type="checkbox"
                  checked={
                    hasDifferentWhatsApp
                  }
                  onChange={(
                    event,
                  ) => {
                    const different =
                      event
                        .target
                        .checked;

                    setHasDifferentWhatsApp(
                      different,
                    );

                    setForm({
                      ...form,

                      whatsappNumber:
                        different
                          ? form.whatsappNumber ===
                            form.phone
                            ? ""
                            : form.whatsappNumber
                          : form.phone,
                    });
                  }}
                />

                WhatsApp number is
                different
              </label>
            </FormField>

            <FormField label="Email">
              <input
                id="party-email"
                type="email"
                autoComplete="email"
                className="input-field"
                value={
                  form.email
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,
                    email:
                      event
                        .target
                        .value,
                  })
                }
              />
            </FormField>
          </div>

          <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-[8px] leading-4 text-emerald-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={
                form.whatsappOptIn
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  whatsappOptIn:
                    event.target
                      .checked,
                })
              }
            />

            <span>
              <strong>
                WhatsApp consent recorded.
              </strong>{" "}
              Required for
              automatic invoice
              delivery.
            </span>
          </label>
        </section>

        {/* TABS */}

        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() =>
              setTab(
                "profile",
              )
            }
            className={`
              rounded-lg
              px-3
              py-2
              text-[9px]
              font-extrabold
              transition-all

              ${
                tab ===
                "profile"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }
            `}
          >
            GST & Address
          </button>

          <button
            type="button"
            onClick={() =>
              setTab(
                "credit",
              )
            }
            className={`
              rounded-lg
              px-3
              py-2
              text-[9px]
              font-extrabold
              transition-all

              ${
                tab ===
                "credit"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }
            `}
          >
            Credit & Balance
          </button>
        </div>

        {/* ================================================================ */}
        {/* GST TAB                                                          */}
        {/* ================================================================ */}

        {tab ===
        "profile" ? (
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="GST Type">
                <select
                  id="gst-type"
                  className="input-field"
                  value={
                    form.gstType
                  }
                  onChange={(
                    event,
                  ) => {
                    const gstType =
                      event
                        .target
                        .value as PartyFormState["gstType"];

                    setForm({
                      ...form,

                      gstType,

                      gstin:
                        isRegisteredGstType(
                          gstType,
                        )
                          ? form.gstin
                          : "",
                    });
                  }}
                >
                  {Object.entries(
                    GST_TYPE_LABELS,
                  ).map(
                    ([
                      value,
                      label,
                    ]) => (
                      <option
                        key={
                          value
                        }
                        value={
                          value
                        }
                      >
                        {label}
                      </option>
                    ),
                  )}
                </select>
              </FormField>

              {registered ? (
                <FormField
                  label="GSTIN"
                  required
                >
                  <input
                    id="party-gstin"
                    required
                    className="input-field uppercase"
                    minLength={
                      15
                    }
                    maxLength={
                      15
                    }
                    value={
                      form.gstin
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,

                        gstin:
                          event.target.value
                            .replace(
                              /\s/g,
                              "",
                            )
                            .toUpperCase(),
                      })
                    }
                    placeholder="33ABCDE1234F1Z5"
                  />
                </FormField>
              ) : (
                <div className="flex min-h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-[9px] text-slate-500">
                  GSTIN is not
                  applicable.
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Billing Address">
                <textarea
                  id="billing-address"
                  rows={3}
                  className="input-field resize-none"
                  value={
                    form.billingAddr
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      billingAddr:
                        event
                          .target
                          .value,
                    })
                  }
                />
              </FormField>

              <FormField
                label="Shipping Address"
                action={
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        shippingAddr:
                          form.billingAddr,
                      })
                    }
                    className="text-[7px] font-bold text-blue-600 hover:underline"
                  >
                    Same as billing
                  </button>
                }
              >
                <textarea
                  id="shipping-address"
                  rows={3}
                  className="input-field resize-none"
                  value={
                    form.shippingAddr
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      shippingAddr:
                        event
                          .target
                          .value,
                    })
                  }
                />
              </FormField>
            </div>
          </section>
        ) : (
          /* ============================================================== */
          /* CREDIT TAB                                                     */
          /* ============================================================== */

          <section className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              {/* OPENING */}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black text-slate-900">
                  Opening Balance
                </p>

                <p className="mt-0.5 text-[8px] text-slate-400">
                  Starting balance
                  for this party
                </p>

                <div className="mt-3 flex h-10 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100/60">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-[8px] font-black text-slate-500">
                    INR
                  </span>

                  <input
                    id="opening-balance"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent px-3 text-[10px] font-bold text-slate-900 outline-none"
                    value={
                      form.openingBalance
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,

                        openingBalance:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <p className="mb-2 mt-3 text-[7px] font-black uppercase tracking-wider text-slate-400">
                  Balance Type
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        openingBalanceType:
                          "RECEIVABLE",
                      })
                    }
                    className={`
                      flex
                      h-9
                      items-center
                      justify-center
                      gap-1.5
                      rounded-lg
                      text-[8px]
                      font-extrabold
                      transition

                      ${
                        form.openingBalanceType ===
                        "RECEIVABLE"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }
                    `}
                  >
                    <ArrowDownLeft
                      size={11}
                    />
                    To Receive
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        openingBalanceType:
                          "PAYABLE",
                      })
                    }
                    className={`
                      flex
                      h-9
                      items-center
                      justify-center
                      gap-1.5
                      rounded-lg
                      text-[8px]
                      font-extrabold
                      transition

                      ${
                        form.openingBalanceType ===
                        "PAYABLE"
                          ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                          : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                      }
                    `}
                  >
                    <ArrowUpRight
                      size={11}
                    />
                    To Pay
                  </button>
                </div>
              </div>

              {/* CREDIT LIMIT */}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-black text-slate-900">
                  Credit Limit
                </p>

                <p className="mt-0.5 text-[8px] text-slate-400">
                  Maximum unpaid
                  balance allowed
                </p>

                <div className="mt-3 flex h-10 overflow-hidden rounded-xl border border-slate-200 bg-white transition focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-100/60">
                  <span className="flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-[8px] font-black text-slate-500">
                    INR
                  </span>

                  <input
                    id="credit-limit"
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    className="min-w-0 flex-1 bg-transparent px-3 text-[10px] font-bold text-slate-900 outline-none"
                    value={
                      form.creditLimit
                    }
                    onChange={(
                      event,
                    ) =>
                      setForm({
                        ...form,

                        creditLimit:
                          event
                            .target
                            .value,
                      })
                    }
                    placeholder="0.00"
                  />
                </div>

                <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[8px] leading-4 text-blue-700">
                  Enter 0 when no
                  credit should be
                  allowed.
                </div>
              </div>
            </div>

            {/* DELIVERY */}

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-800">
                    Invoice Delivery
                  </p>

                  <p className="mt-0.5 text-[8px] text-slate-500">
                    Manual sharing or
                    automatic delivery
                    after invoice
                    creation.
                  </p>
                </div>

                <select
                  className="input-field h-9 sm:w-36"
                  value={
                    form.invoiceDeliveryMode
                  }
                  onChange={(
                    event,
                  ) =>
                    setForm({
                      ...form,

                      invoiceDeliveryMode:
                        event
                          .target
                          .value as PartyFormState["invoiceDeliveryMode"],
                    })
                  }
                >
                  <option value="MANUAL">
                    Manual
                  </option>

                  <option value="AUTOMATIC">
                    Automatic
                  </option>
                </select>
              </div>

              {form.invoiceDeliveryMode ===
                "AUTOMATIC" && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <FormField label="Automatic Channel">
                    <select
                      className="input-field"
                      value={
                        form.invoiceDeliveryChannel
                      }
                      onChange={(
                        event,
                      ) =>
                        setForm({
                          ...form,

                          invoiceDeliveryChannel:
                            event
                              .target
                              .value as PartyFormState["invoiceDeliveryChannel"],
                        })
                      }
                    >
                      <option value="BOTH">
                        Email and
                        WhatsApp
                      </option>

                      <option value="EMAIL">
                        Email only
                      </option>

                      <option value="WHATSAPP">
                        WhatsApp only
                      </option>
                    </select>
                  </FormField>
                </div>
              )}
            </div>

            <FormField label="Credit Terms / Notes">
              <textarea
                id="party-notes"
                rows={3}
                className="input-field resize-none"
                value={
                  form.notes
                }
                onChange={(
                  event,
                ) =>
                  setForm({
                    ...form,

                    notes:
                      event.target
                        .value,
                  })
                }
                placeholder="Example: Net 30 days, preferred payment method..."
              />
            </FormField>
          </section>
        )}

        {/* FOOTER */}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={
              onClose
            }
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-[9px] font-extrabold text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving
            }
            className="inline-flex h-9 min-w-28 items-center justify-center rounded-lg bg-blue-600 px-4 text-[9px] font-extrabold text-white shadow-[0_6px_16px_rgba(37,99,235,0.18)] transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : party
                ? "Update Party"
                : "Save Party"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/* ========================================================================== */
/* FORM FIELD                                                                 */
/* ========================================================================== */

function FormField({
  label,
  required,
  action,
  children,
}: {
  label: string;
  required?: boolean;
  action?: ReactNode;
  children:
    ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-[7px] font-black uppercase tracking-[0.11em] text-slate-400">
          {label}

          {required && (
            <span className="ml-0.5 text-red-500">
              *
            </span>
          )}
        </label>

        {action}
      </div>

      {children}
    </div>
  );
}