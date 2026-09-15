"use client";

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  FileSpreadsheet,
  Package,
  Pencil,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import Modal from "@/components/Modal";
import StatusBadge from "@/components/StatusBadge";

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
  BusinessDocument,
  Invoice,
  Item,
} from "@/types";

import InvoiceModal from "@/components/invoices/InvoiceModal";
import DocumentModal from "@/components/documents/DocumentModal";

/* ========================================================================== */
/* TYPES                                                                      */
/* ========================================================================== */

type ItemTransaction = {
  id: string;
  type: "SALE" | "PURCHASE";
  number: string;
  date: string;
  quantity: number;
  rate: number;
  total: number;
  status: string;
  href: string;
};

type TransactionSources = {
  invoices: Invoice[];
  documents: BusinessDocument[];
};

/* ========================================================================== */
/* PAGE                                                                       */
/* ========================================================================== */

export default function ItemsPage() {
  const [items, setItems] =
    useState<Item[]>([]);

  const [
    selectedItemId,
    setSelectedItemId,
  ] = useState("");

  const [search, setSearch] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [
    transactions,
    setTransactions,
  ] = useState<ItemTransaction[]>([]);

  const [
    transactionLoading,
    setTransactionLoading,
  ] = useState(false);

  const [
    transactionError,
    setTransactionError,
  ] = useState("");

  const [showForm, setShowForm] =
    useState(false);

  const [
    editingItem,
    setEditingItem,
  ] = useState<Item | null>(null);

  const [
    activeForm,
    setActiveForm,
  ] = useState<
    "sale" | "expense" | null
  >(null);

  const sourcesRef =
    useRef<TransactionSources | null>(
      null,
    );

  /* ====================================================================== */
  /* LOAD ITEMS                                                             */
  /* ====================================================================== */

  const loadItems =
    useCallback(
      async (
        preferredId?: string,
      ) => {
        setLoading(true);
        setError("");

        try {
          const { data } =
            await getAllPages<Item>(
              "/items",
            );

          setItems(data);

          setSelectedItemId(
            (current) =>
              preferredId &&
              data.some(
                (item) =>
                  item.id ===
                  preferredId,
              )
                ? preferredId
                : current &&
                    data.some(
                      (item) =>
                        item.id ===
                        current,
                    )
                  ? current
                  : "",
          );
        } catch (
          loadError: unknown
        ) {
          setError(
            getApiError(
              loadError,
              "Could not load items.",
            ),
          );
        } finally {
          setLoading(false);
        }
      },
      [],
    );

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  /* ====================================================================== */
  /* LOAD TRANSACTION SOURCES                                               */
  /* ====================================================================== */

  const loadTransactionSources =
    useCallback(async () => {
      if (
        sourcesRef.current
      ) {
        return sourcesRef.current;
      }

      const [
        invoiceList,
        documentList,
      ] = await Promise.all([
        getAllPages<Invoice>(
          "/invoices",
        ),

        getAllPages<BusinessDocument>(
          "/documents",
        ),
      ]);

      const purchaseDocuments =
        documentList.data.filter(
          (document) =>
            document.type ===
            "PURCHASE_INVOICE",
        );

      const [
        invoiceResults,
        documentResults,
      ] = await Promise.all([
        Promise.allSettled(
          invoiceList.data.map(
            (invoice) =>
              api.get<Invoice>(
                `/invoices/${invoice.id}`,
              ),
          ),
        ),

        Promise.allSettled(
          purchaseDocuments.map(
            (document) =>
              api.get<BusinessDocument>(
                `/documents/${document.id}`,
              ),
          ),
        ),
      ]);

      const sources = {
        invoices:
          invoiceResults.flatMap(
            (result) =>
              result.status ===
              "fulfilled"
                ? [
                    result.value
                      .data,
                  ]
                : [],
          ),

        documents:
          documentResults.flatMap(
            (result) =>
              result.status ===
              "fulfilled"
                ? [
                    result.value
                      .data,
                  ]
                : [],
          ),
      };

      sourcesRef.current =
        sources;

      return sources;
    }, []);

  /* ====================================================================== */
  /* LOAD TRANSACTIONS                                                      */
  /* ====================================================================== */

  const loadTransactions =
    useCallback(
      async (
        itemId: string,
      ) => {
        if (!itemId) {
          setTransactions([]);
          return;
        }

        setTransactionLoading(
          true,
        );

        setTransactionError("");

        try {
          const sources =
            await loadTransactionSources();

          const sales =
            sources.invoices.flatMap(
              (invoice) =>
                invoice.items
                  .filter(
                    (line) =>
                      line.itemId ===
                      itemId,
                  )
                  .map((line) => ({
                    id: `sale-${line.id}`,
                    type: "SALE" as const,
                    number:
                      invoice.invoiceNumber,
                    date:
                      invoice.issueDate,
                    quantity:
                      -Number(
                        line.quantity,
                      ),
                    rate:
                      Number(
                        line.unitPrice,
                      ),
                    total:
                      Number(
                        line.lineTotal,
                      ),
                    status:
                      invoice.status,
                    href: `/invoices/${invoice.id}`,
                  })),
            );

          const purchases =
            sources.documents.flatMap(
              (document) =>
                (
                  document.items ??
                  []
                )
                  .filter(
                    (line) =>
                      line.itemId ===
                      itemId,
                  )
                  .map((line) => ({
                    id: `purchase-${line.id}`,
                    type:
                      "PURCHASE" as const,
                    number:
                      document.documentNumber,
                    date:
                      document.issueDate,
                    quantity:
                      Number(
                        line.quantity,
                      ),
                    rate:
                      Number(
                        line.unitPrice,
                      ),
                    total:
                      Number(
                        line.lineTotal,
                      ),
                    status:
                      document.status,
                    href: `/documents/${document.id}`,
                  })),
            );

          setTransactions(
            [
              ...sales,
              ...purchases,
            ].sort(
              (a, b) =>
                new Date(
                  b.date,
                ).getTime() -
                new Date(
                  a.date,
                ).getTime(),
            ),
          );
        } catch (
          loadError: unknown
        ) {
          setTransactions([]);

          setTransactionError(
            getApiError(
              loadError,
              "Could not load item transactions.",
            ),
          );
        } finally {
          setTransactionLoading(
            false,
          );
        }
      },
      [
        loadTransactionSources,
      ],
    );

  useEffect(() => {
    void loadTransactions(
      selectedItemId,
    );
  }, [
    loadTransactions,
    selectedItemId,
  ]);

  /* ====================================================================== */
  /* COMPUTED                                                               */
  /* ====================================================================== */

  const selectedItem =
    items.find(
      (item) =>
        item.id ===
        selectedItemId,
    ) ?? null;

  const filteredItems =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return term
        ? items.filter(
            (item) =>
              [
                item.name,
                item.sku,
                item.description,
              ].some(
                (value) =>
                  value
                    ?.toLowerCase()
                    .includes(
                      term,
                    ),
              ),
          )
        : items;
    }, [items, search]);

  const salesQty =
    Math.abs(
      transactions
        .filter(
          (transaction) =>
            transaction.type ===
              "SALE" &&
            transaction.status !==
              "CANCELLED",
        )
        .reduce(
          (
            sum,
            transaction,
          ) =>
            sum +
            transaction.quantity,
          0,
        ),
    );

  const purchaseQty =
    transactions
      .filter(
        (transaction) =>
          transaction.type ===
            "PURCHASE" &&
          [
            "ISSUED",
            "ACCEPTED",
          ].includes(
            transaction.status,
          ),
      )
      .reduce(
        (
          sum,
          transaction,
        ) =>
          sum +
          transaction.quantity,
        0,
      );

  const totalStockValue =
    items.reduce(
      (sum, item) =>
        sum +
        Number(item.stockQty) *
          Number(item.salePrice),
      0,
    );

  const lowStockCount =
    items.filter(
      (item) =>
        Number(item.stockQty) <=
        5,
    ).length;

  /* ====================================================================== */
  /* ACTIONS                                                                */
  /* ====================================================================== */

  function openAddItem() {
    setEditingItem(null);
    setShowForm(true);
  }

  function openEditItem() {
    if (!selectedItem) {
      return;
    }

    setEditingItem(
      selectedItem,
    );

    setShowForm(true);
  }

  function exportTransactions() {
    if (
      !selectedItem ||
      transactions.length === 0
    ) {
      return;
    }

    const rows = [
      [
        "Type",
        "Number",
        "Date",
        "Quantity",
        "Rate",
        "Total",
        "Status",
      ],

      ...transactions.map(
        (row) => [
          row.type,
          row.number,
          new Date(
            row.date,
          ).toLocaleDateString(
            "en-IN",
          ),
          row.quantity,
          row.rate,
          row.total,
          row.status,
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

    anchor.download = `${selectedItem.name
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

  /* ====================================================================== */
  /* UI                                                                     */
  /* ====================================================================== */

  return (
    <>
      <div className="min-h-screen bg-slate-50/70">
        {/* ================================================================ */}
        {/* HEADER                                                           */}
        {/* ================================================================ */}

        <section className="relative mb-4 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 via-white to-cyan-50 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="relative flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-5 w-1 rounded-full bg-blue-600" />

                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Inventory Management
                </span>
              </div>

              <h1 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                Items
              </h1>

              <p className="mt-1 text-[10px] text-slate-500">
                Manage inventory,
                pricing, stock
                movement and item
                transactions.
              </p>
            </div>

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
                <ShoppingCart
                  size={12}
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
                onClick={
                  openAddItem
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
                  hover:-translate-y-0.5
                  hover:bg-blue-700
                  hover:shadow-[0_10px_24px_rgba(37,99,235,0.28)]
                "
              >
                <Plus
                  size={12}
                  className="transition-transform group-hover:rotate-90"
                />

                Add Item
              </button>
            </div>
          </div>

          <div className="h-[3px] bg-gradient-to-r from-blue-600 via-cyan-500 to-transparent" />
        </section>

        {/* ================================================================ */}
        {/* KPI SUMMARY                                                      */}
        {/* ================================================================ */}

        <section className="mb-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <InventoryMetric
            icon={Package}
            label="Total Items"
            value={items.length.toLocaleString(
              "en-IN",
            )}
            helper="Inventory records"
            tone="blue"
          />

          <InventoryMetric
            icon={Boxes}
            label="Stock Units"
            value={items
              .reduce(
                (
                  total,
                  item,
                ) =>
                  total +
                  Number(
                    item.stockQty,
                  ),
                0,
              )
              .toLocaleString(
                "en-IN",
              )}
            helper="Current quantity"
            tone="violet"
          />

          <InventoryMetric
            icon={TrendingDown}
            label="Low Stock"
            value={lowStockCount.toLocaleString(
              "en-IN",
            )}
            helper="Five units or less"
            tone="amber"
          />

          <InventoryMetric
            icon={WalletCards}
            label="Stock Value"
            value={formatCurrency(
              totalStockValue,
            )}
            helper="Based on sale price"
            tone="emerald"
          />
        </section>

        {/* ================================================================ */}
        {/* ITEM REGISTER                                                    */}
        {/* ================================================================ */}

        <ItemRegisterTable
          items={filteredItems}
          selectedId={
            selectedItemId
          }
          search={search}
          onSearch={
            setSearch
          }
          onSelect={
            setSelectedItemId
          }
          loading={loading}
          error={error}
          onRetry={() =>
            loadItems()
          }
        />

        {/* ================================================================ */}
        {/* SELECTED ITEM                                                    */}
        {/* ================================================================ */}

        {!selectedItem ? (
          <section className="mt-4 flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-[0_6px_22px_rgba(15,23,42,0.04)]">
            <div className="max-w-md">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Package
                  size={20}
                />
              </span>

              <h3 className="mt-4 text-[12px] font-black text-slate-800">
                Select an Item
              </h3>

              <p className="mt-1.5 text-[9px] leading-5 text-slate-400">
                Choose an item from
                the register above to
                view its inventory
                profile, stock
                movement and complete
                transaction history.
              </p>
            </div>
          </section>
        ) : (
          <>
            {/* ============================================================ */}
            {/* ITEM PROFILE                                                */}
            {/* ============================================================ */}

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              {/* Profile Top */}

              <div className="relative border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/60 px-4 py-4 sm:px-5">
                <div className="pointer-events-none absolute -right-12 -top-16 h-36 w-36 rounded-full bg-blue-100/70 blur-3xl" />

                <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-100 px-2 py-1 text-[7px] font-black uppercase tracking-[0.12em] text-blue-700">
                        Selected Item
                      </span>

                      <span
                        className={`rounded-md px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] ${
                          Number(
                            selectedItem.stockQty,
                          ) <= 5
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {Number(
                          selectedItem.stockQty,
                        ) <= 5
                          ? "Low Stock"
                          : "In Stock"}
                      </span>
                    </div>

                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-lg font-black tracking-tight text-slate-950">
                        {
                          selectedItem.name
                        }
                      </h2>

                      <button
                        type="button"
                        onClick={
                          openEditItem
                        }
                        aria-label="Edit item"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 shadow-sm transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                      >
                        <Pencil
                          size={12}
                        />
                      </button>
                    </div>

                    <p className="mt-1 max-w-2xl truncate text-[9px] text-slate-500">
                      {selectedItem.description ||
                        "No description added"}
                    </p>
                  </div>

                  <div className="shrink-0 rounded-xl border border-blue-100 bg-white px-4 py-2.5 text-left shadow-sm sm:text-right">
                    <p className="text-[7px] font-black uppercase tracking-[0.12em] text-slate-400">
                      Current Stock Value
                    </p>

                    <p className="mt-1 text-lg font-black text-blue-700">
                      {formatCurrency(
                        Number(
                          selectedItem.stockQty,
                        ) *
                          Number(
                            selectedItem.salePrice,
                          ),
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Profile Grid */}

              <div className="grid lg:grid-cols-[1.4fr_.6fr]">
                {/* Item Details */}

                <div className="border-b border-slate-200 p-4 lg:border-b-0 lg:border-r">
                  <div className="mb-3">
                    <h3 className="text-[11px] font-black text-slate-900">
                      Item Information
                    </h3>

                    <p className="mt-0.5 text-[8px] text-slate-400">
                      Product,
                      pricing and tax
                      information
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4">
                    <ItemFact
                      label="SKU"
                      value={
                        selectedItem.sku ||
                        "Not provided"
                      }
                    />

                    <ItemFact
                      label="Sale Price"
                      value={formatCurrency(
                        selectedItem.salePrice,
                      )}
                      highlight
                    />

                    <ItemFact
                      label="Tax Rate"
                      value={`${Number(
                        selectedItem.taxRate,
                      ).toFixed(
                        2,
                      )}%`}
                    />

                    <ItemFact
                      label="Unit"
                      value={
                        selectedItem.unit
                      }
                    />
                  </div>
                </div>

                {/* Stock Movement */}

                <div className="bg-slate-50/60 p-4">
                  <div className="mb-3">
                    <h3 className="text-[11px] font-black text-slate-900">
                      Stock Position
                    </h3>

                    <p className="mt-0.5 text-[8px] text-slate-400">
                      Current inventory
                      movement
                    </p>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
                    <StockRow
                      label="Current Stock"
                      value={`${Number(
                        selectedItem.stockQty,
                      ).toLocaleString(
                        "en-IN",
                      )} ${
                        selectedItem.unit
                      }`}
                      type="normal"
                    />

                    <StockRow
                      label="Purchased"
                      value={`+${purchaseQty.toLocaleString(
                        "en-IN",
                      )} ${
                        selectedItem.unit
                      }`}
                      type="positive"
                    />

                    <StockRow
                      label="Sold"
                      value={`-${salesQty.toLocaleString(
                        "en-IN",
                      )} ${
                        selectedItem.unit
                      }`}
                      type="negative"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* ============================================================ */}
            {/* TRANSACTIONS                                                */}
            {/* ============================================================ */}

            <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.05)]">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 px-4 py-3.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-blue-600" />

                    <h3 className="text-[11px] font-black text-slate-950">
                      Item Transactions
                    </h3>
                  </div>

                  <p className="ml-3 mt-0.5 text-[8px] text-slate-400">
                    Sales and purchase
                    stock movement
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="hidden rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[8px] font-bold text-slate-500 sm:block">
                    {
                      transactions.length
                    }{" "}
                    Transactions
                  </span>

                  <button
                    type="button"
                    onClick={() =>
                      window.print()
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
                    aria-label="Print transactions"
                  >
                    <Printer
                      size={12}
                    />
                  </button>

                  <button
                    type="button"
                    disabled={
                      !transactions.length
                    }
                    onClick={
                      exportTransactions
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-blue-100 bg-blue-50 text-blue-600 transition-all hover:bg-blue-600 hover:text-white disabled:pointer-events-none disabled:opacity-30"
                    aria-label="Export transactions"
                  >
                    <FileSpreadsheet
                      size={12}
                    />
                  </button>
                </div>
              </div>

              {transactionLoading ? (
                <LoadingState label="Loading item transactions..." />
              ) : transactionError ? (
                <ErrorState
                  message={
                    transactionError
                  }
                  onRetry={() =>
                    loadTransactions(
                      selectedItem.id,
                    )
                  }
                />
              ) : transactions.length ? (
                /*
                 * NO overflow-x-auto
                 * NO min-width
                 * NO horizontal slider
                 */
                <div className="w-full">
                  <table className="w-full table-fixed border-collapse">
                    <caption className="sr-only">
                      Item transactions
                    </caption>

                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-100/80">
                        <th className="w-[16%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
                          Type
                        </th>

                        <th className="w-[24%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
                          Number
                        </th>

                        <th className="hidden w-[15%] border-r border-slate-200 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 md:table-cell">
                          Date
                        </th>

                        <th className="w-[19%] border-r border-slate-200 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
                          Qty
                        </th>

                        <th className="hidden w-[13%] border-r border-slate-200 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-500 lg:table-cell">
                          Rate
                        </th>

                        <th className="w-[21%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-blue-600">
                          Total
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {transactions.map(
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
                            unit={
                              selectedItem.unit
                            }
                          />
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex min-h-[180px] items-center justify-center px-5 py-10 text-center">
                  <div>
                    <p className="text-[10px] font-extrabold text-slate-600">
                      No transactions
                      yet
                    </p>

                    <p className="mt-1 text-[8px] text-slate-400">
                      Sales and issued
                      purchases
                      containing this
                      item will appear
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
      {/* MODALS                                                             */}
      {/* ================================================================== */}

      {activeForm ===
        "sale" && (
        <InvoiceModal
          onClose={() =>
            setActiveForm(
              null,
            )
          }
        />
      )}

      {activeForm ===
        "expense" && (
        <DocumentModal
          type="PURCHASE_INVOICE"
          onClose={() =>
            setActiveForm(
              null,
            )
          }
        />
      )}

      {showForm && (
        <ItemFormModal
          item={
            editingItem
          }
          onClose={() =>
            setShowForm(false)
          }
          onSaved={(
            savedItem,
          ) => {
            setShowForm(false);

            sourcesRef.current =
              null;

            void loadItems(
              savedItem.id,
            );
          }}
        />
      )}
    </>
  );
}

/* ========================================================================== */
/* ITEM REGISTER                                                              */
/* ========================================================================== */

function ItemRegisterTable({
  items,
  selectedId,
  search,
  onSearch,
  onSelect,
  loading,
  error,
  onRetry,
}: {
  items: Item[];
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
      {/* Toolbar */}

      <div className="grid items-end gap-2 border-b border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/50 px-3 py-3 sm:grid-cols-[180px_minmax(220px,1fr)] sm:px-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-blue-600" />

            <h2 className="text-[11px] font-black text-slate-950">
              Item Register
            </h2>
          </div>

          <p className="ml-3 mt-0.5 text-[8px] text-slate-400">
            {items.length} records
            shown
          </p>
        </div>

        <div className="relative min-w-0">
          <Search
            size={12}
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) =>
              onSearch(
                event.target.value,
              )
            }
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
            placeholder="Search item name, SKU or description..."
            aria-label="Search items"
          />
        </div>
      </div>

      {loading ? (
        <LoadingState label="Loading items..." />
      ) : error ? (
        <ErrorState
          message={error}
          onRetry={
            onRetry
          }
        />
      ) : items.length ===
        0 ? (
        <EmptyState
          icon={Package}
          title="No items found"
          description={
            search
              ? "Try a different search."
              : "Add your first item to start billing."
          }
        />
      ) : (
        /* No horizontal slider */
        <div className="w-full">
          <table className="w-full table-fixed border-collapse">
            <caption className="sr-only">
              Item register
            </caption>

            <thead>
              <tr className="border-b border-slate-200 bg-slate-950">
                <th className="w-[5%] border-r border-white/10 px-1 py-2.5 text-center text-[7px] font-black uppercase text-slate-400">
                  #
                </th>

                <th className="w-[27%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                  Item
                </th>

                <th className="hidden w-[15%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 md:table-cell">
                  SKU
                </th>

                <th className="hidden w-[9%] border-r border-white/10 px-3 py-2.5 text-left text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 lg:table-cell">
                  Unit
                </th>

                <th className="w-[17%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                  Price
                </th>

                <th className="hidden w-[9%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300 xl:table-cell">
                  Tax
                </th>

                <th className="w-[17%] border-r border-white/10 px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-slate-300">
                  Stock
                </th>

                <th className="w-[19%] px-3 py-2.5 text-right text-[8px] font-black uppercase tracking-[0.1em] text-blue-300">
                  Value
                </th>
              </tr>
            </thead>

            <tbody>
              {items.map(
                (
                  item,
                  index,
                ) => {
                  const stock =
                    Number(
                      item.stockQty,
                    );

                  const lowStock =
                    stock <= 5;

                  const selected =
                    item.id ===
                    selectedId;

                  return (
                    <tr
                      key={
                        item.id
                      }
                      onClick={() =>
                        onSelect(
                          item.id,
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
                        {index +
                          1}
                      </td>

                      <td className="min-w-0 border-r border-slate-100 px-3 py-3">
                        <p
                          className={`truncate text-[10px] font-extrabold transition-colors ${
                            selected
                              ? "text-blue-700"
                              : "text-slate-900 group-hover:text-blue-700"
                          }`}
                        >
                          {
                            item.name
                          }
                        </p>

                        {item.description && (
                          <p className="mt-0.5 hidden truncate text-[7px] text-slate-400 sm:block">
                            {
                              item.description
                            }
                          </p>
                        )}
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 font-mono text-[9px] text-slate-500 md:table-cell">
                        {item.sku ||
                          "—"}
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 text-[9px] font-semibold text-slate-500 lg:table-cell">
                        {
                          item.unit
                        }
                      </td>

                      <td className="border-r border-slate-100 px-3 py-3 text-right text-[9px] font-extrabold text-slate-800">
                        {formatCurrency(
                          item.salePrice,
                        )}
                      </td>

                      <td className="hidden border-r border-slate-100 px-3 py-3 text-right text-[8px] font-semibold text-slate-500 xl:table-cell">
                        {Number(
                          item.taxRate,
                        ).toFixed(
                          2,
                        )}
                        %
                      </td>

                      <td className="border-r border-slate-100 px-3 py-3 text-right">
                        <span
                          className={`
                            inline-flex
                            whitespace-nowrap
                            rounded-md
                            px-2
                            py-1
                            text-[8px]
                            font-extrabold

                            ${
                              lowStock
                                ? "bg-amber-50 text-amber-700"
                                : "bg-emerald-50 text-emerald-700"
                            }
                          `}
                        >
                          {stock.toLocaleString(
                            "en-IN",
                          )}{" "}
                          {
                            item.unit
                          }
                        </span>
                      </td>

                      <td className="bg-blue-50/20 px-3 py-3 text-right">
                        <span className="whitespace-nowrap text-[9px] font-black text-slate-900">
                          {formatCurrency(
                            stock *
                              Number(
                                item.salePrice,
                              ),
                          )}
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
    </section>
  );
}

/* ========================================================================== */
/* TRANSACTION ROW                                                            */
/* ========================================================================== */

function TransactionRow({
  transaction,
  unit,
}: {
  transaction: ItemTransaction;
  unit: string;
}) {
  const purchase =
    transaction.type ===
    "PURCHASE";

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
              purchase
                ? "text-emerald-700"
                : "text-blue-700"
            }
          `}
        >
          {purchase ? (
            <ArrowDownLeft
              size={10}
            />
          ) : (
            <ArrowUpRight
              size={10}
            />
          )}

          {purchase
            ? "Purchase"
            : "Sale"}
        </span>
      </td>

      <td className="min-w-0 border-r border-slate-100 px-3 py-3">
        <Link
          href={
            transaction.href
          }
          className="block truncate text-[9px] font-extrabold text-blue-600 hover:text-blue-800"
        >
          {
            transaction.number
          }
        </Link>

        <div className="mt-1">
          <StatusBadge
            status={
              transaction.status
            }
          />
        </div>
      </td>

      <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-[8px] font-medium text-slate-500 md:table-cell">
        {formatDate(
          transaction.date,
        )}
      </td>

      <td
        className={`border-r border-slate-100 px-3 py-3 text-right text-[9px] font-black ${
          purchase
            ? "text-emerald-600"
            : "text-red-600"
        }`}
      >
        {purchase
          ? "+"
          : "-"}
        {Math.abs(
          transaction.quantity,
        ).toLocaleString(
          "en-IN",
        )}{" "}
        {unit}
      </td>

      <td className="hidden whitespace-nowrap border-r border-slate-100 px-3 py-3 text-right text-[8px] font-semibold text-slate-600 lg:table-cell">
        {formatCurrency(
          transaction.rate,
        )}
      </td>

      <td className="bg-blue-50/20 px-3 py-3 text-right text-[9px] font-black text-slate-900">
        {formatCurrency(
          transaction.total,
        )}
      </td>
    </tr>
  );
}

/* ========================================================================== */
/* METRIC CARD                                                                */
/* ========================================================================== */

const INVENTORY_TONES = {
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

  amber: {
    icon:
      "bg-amber-50 text-amber-600 group-hover:bg-amber-500 group-hover:text-white",
    accent:
      "bg-amber-500",
    border:
      "hover:border-amber-200",
  },

  emerald: {
    icon:
      "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white",
    accent:
      "bg-emerald-500",
    border:
      "hover:border-emerald-200",
  },
} as const;

function InventoryMetric({
  icon: Icon,
  label,
  value,
  helper,
  tone,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  helper: string;
  tone:
    keyof typeof INVENTORY_TONES;
}) {
  const style =
    INVENTORY_TONES[
      tone
    ];

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
            {helper}
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
/* ITEM FACT                                                                  */
/* ========================================================================== */

function ItemFact({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 bg-white px-3 py-3 transition-colors hover:bg-slate-50">
      <p className="text-[7px] font-black uppercase tracking-[0.1em] text-slate-400">
        {label}
      </p>

      <p
        title={value}
        className={`mt-1 truncate text-[10px] font-extrabold ${
          highlight
            ? "text-blue-700"
            : "text-slate-800"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* STOCK ROW                                                                  */
/* ========================================================================== */

function StockRow({
  label,
  value,
  type,
}: {
  label: string;
  value: string;
  type:
    | "normal"
    | "positive"
    | "negative";
}) {
  const styles = {
    normal:
      "border-slate-200 bg-white text-slate-800",

    positive:
      "border-emerald-100 bg-emerald-50/70 text-emerald-700",

    negative:
      "border-red-100 bg-red-50/70 text-red-600",
  };

  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-sm ${styles[type]}`}
    >
      <span className="truncate text-[8px] font-bold opacity-70">
        {label}
      </span>

      <strong className="whitespace-nowrap text-[9px] font-black">
        {value}
      </strong>
    </div>
  );
}

/* ========================================================================== */
/* ITEM FORM                                                                  */
/* ========================================================================== */

function ItemFormModal({
  item,
  onClose,
  onSaved,
}: {
  item: Item | null;
  onClose: () => void;
  onSaved: (
    item: Item,
  ) => void;
}) {
  const [form, setForm] =
    useState({
      name:
        item?.name ?? "",

      sku:
        item?.sku ?? "",

      description:
        item?.description ??
        "",

      unit:
        item?.unit ??
        "pcs",

      salePrice:
        String(
          item?.salePrice ??
            "",
        ),

      taxRate:
        String(
          item?.taxRate ??
            0,
        ),

      stockQty:
        String(
          item?.stockQty ??
            0,
        ),
    });

  const [
    error,
    setError,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const payload = {
        name:
          form.name.trim(),

        sku:
          form.sku.trim() ||
          undefined,

        description:
          form.description.trim() ||
          undefined,

        unit:
          form.unit.trim(),

        salePrice:
          Number(
            form.salePrice,
          ),

        taxRate:
          Number(
            form.taxRate,
          ),

        stockQty:
          Number(
            form.stockQty,
          ),
      };

      const { data } =
        item
          ? await api.patch<Item>(
              `/items/${item.id}`,
              payload,
            )
          : await api.post<Item>(
              "/items",
              payload,
            );

      onSaved(data);
    } catch (
      saveError: unknown
    ) {
      setError(
        getApiError(
          saveError,
          "Could not save item.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={
        item
          ? "Edit Item"
          : "Add Item"
      }
      onClose={
        onClose
      }
      size="lg"
      className="!max-w-2xl"
    >
      <form
        onSubmit={
          handleSubmit
        }
        className="space-y-4"
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-[9px] font-semibold text-red-700"
          >
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Item Name"
            required
          >
            <input
              id="item-name"
              required
              autoFocus
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
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
              placeholder="Enter item name"
            />
          </FormField>

          <FormField label="SKU">
            <input
              id="item-sku"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
              value={
                form.sku
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  sku:
                    event
                      .target
                      .value,
                })
              }
              placeholder="Product SKU"
            />
          </FormField>
        </div>

        <FormField label="Description">
          <textarea
            id="item-description"
            rows={2}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-medium text-slate-800 outline-none transition-all hover:border-slate-300 focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
            value={
              form.description
            }
            onChange={(
              event,
            ) =>
              setForm({
                ...form,
                description:
                  event.target
                    .value,
              })
            }
            placeholder="Short item description"
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <FormField
            label="Unit"
            required
          >
            <input
              id="item-unit"
              required
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
              value={
                form.unit
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  unit:
                    event
                      .target
                      .value,
                })
              }
            />
          </FormField>

          <FormField
            label="Sale Price"
            required
          >
            <input
              id="item-price"
              required
              type="number"
              step="0.01"
              min="0"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
              value={
                form.salePrice
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  salePrice:
                    event.target
                      .value,
                })
              }
            />
          </FormField>

          <FormField label="Tax %">
            <input
              id="item-tax"
              type="number"
              step="0.01"
              min="0"
              max="100"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
              value={
                form.taxRate
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  taxRate:
                    event.target
                      .value,
                })
              }
            />
          </FormField>

          <FormField label="Stock">
            <input
              id="item-stock"
              type="number"
              step="0.001"
              min="0"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[10px] font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100/60"
              value={
                form.stockQty
              }
              onChange={(
                event,
              ) =>
                setForm({
                  ...form,
                  stockQty:
                    event.target
                      .value,
                })
              }
            />
          </FormField>
        </div>

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
            className="inline-flex h-9 min-w-28 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 text-[9px] font-extrabold text-white transition-all hover:-translate-y-0.5 hover:bg-blue-700 disabled:pointer-events-none disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : item
                ? "Update Item"
                : "Save Item"}
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
  children,
}: {
  label: string;
  required?: boolean;
  children:
    React.ReactNode;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1.5 block text-[7px] font-black uppercase tracking-[0.11em] text-slate-400">
        {label}

        {required && (
          <span className="ml-0.5 text-red-500">
            *
          </span>
        )}
      </span>

      {children}
    </label>
  );
}
