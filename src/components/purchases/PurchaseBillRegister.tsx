"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Camera,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  Mail,
  MessageCircle,
  Plus,
  Printer,
  ScanLine,
  Search,
  Share2,
  X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { MenuButton, MenuLink, Popover } from "@/components/PopoverMenu";
import RowActions from "@/components/RowActions";
import ConfirmDialog from "@/components/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/ContentState";
import { toast } from "@/components/ToastProvider";
import { api, getAllPages, getApiError, getCurrentUser } from "@/lib/api";
import { localDate } from "@/lib/business-report";
import { DOCUMENT_CONFIG } from "@/lib/documents";
import { formatCurrency, formatDate } from "@/lib/format";
import { documentOutstanding } from "@/lib/outstanding";
import { whatsappLink } from "@/lib/messageTemplates";
import { setPendingBillUploads } from "@/lib/pendingBillUploads";
import type { BusinessDocument } from "@/types";

type BillState = "PAID" | "UNPAID" | "PARTIAL" | "OVERDUE" | "DRAFT" | "CANCELLED";
type StatusFilter = "ALL" | BillState;
type Period = "ALL" | "THIS_MONTH" | "LAST_MONTH" | "THIS_QUARTER" | "THIS_FY" | "CUSTOM";
type ColumnKey = "date" | "billNo" | "party" | "paymentType" | "amount" | "balance" | "due" | "status";
type ColumnFilter = { text?: string; min?: string; max?: string };

type BillRow = {
  id: string;
  date: string;
  billNo: string;
  documentNumber: string;
  party: string;
  phone?: string;
  email?: string;
  paymentType: string;
  amount: number;
  paid: number;
  balance: number;
  due: string;
  state: BillState;
  overdueDays: number;
  status: string;
  firm: string;
  user: string;
};

const CREATE_PATH = DOCUMENT_CONFIG.PURCHASE_INVOICE.createPath;
const MAX_FILES = 10;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TOTAL_BYTES = 25 * 1024 * 1024;

const STATUS_OPTIONS: Array<[StatusFilter, string]> = [
  ["ALL", "All Purchase Bills"],
  ["PAID", "Paid"],
  ["UNPAID", "Unpaid"],
  ["PARTIAL", "Partially paid"],
  ["OVERDUE", "Overdue"],
  ["DRAFT", "Draft"],
  ["CANCELLED", "Cancelled"],
];

const PERIOD_OPTIONS: Array<[Period, string]> = [
  ["ALL", "All time"],
  ["THIS_MONTH", "This month"],
  ["LAST_MONTH", "Last month"],
  ["THIS_QUARTER", "This quarter"],
  ["THIS_FY", "This financial year"],
  ["CUSTOM", "Custom"],
];

const COLUMNS: Array<{ key: ColumnKey; label: string; kind: "date" | "text" | "number" | "status"; align?: "right" }> = [
  { key: "date", label: "Date", kind: "date" },
  { key: "billNo", label: "Bill No.", kind: "text" },
  { key: "party", label: "Party Name", kind: "text" },
  { key: "paymentType", label: "Payment Type", kind: "text" },
  { key: "amount", label: "Amount", kind: "number", align: "right" },
  { key: "balance", label: "Balance Due", kind: "number", align: "right" },
  { key: "due", label: "Due Date", kind: "date" },
  { key: "status", label: "Status", kind: "status" },
];

/** Inclusive YYYY-MM-DD range for a preset; Indian financial years start in April. */
function periodRange(period: Period, now = new Date()): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const day = (year: number, month: number, date: number) => localDate(new Date(year, month, date));
  switch (period) {
    case "THIS_MONTH":
      return { from: day(y, m, 1), to: day(y, m + 1, 0) };
    case "LAST_MONTH":
      return { from: day(y, m - 1, 1), to: day(y, m, 0) };
    case "THIS_QUARTER": {
      const start = m - (m % 3);
      return { from: day(y, start, 1), to: day(y, start + 3, 0) };
    }
    case "THIS_FY": {
      const startYear = m >= 3 ? y : y - 1;
      return { from: day(startYear, 3, 1), to: day(startYear + 1, 2, 31) };
    }
    default:
      return { from: "", to: "" };
  }
}

function daysBetween(fromDay: string, toDay: string) {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / 86400000);
}

function toRow(bill: BusinessDocument, today: string): BillRow {
  const amount = Number(bill.grandTotal) || 0;
  const balance = documentOutstanding(bill);
  const paid = Number(bill.paidAmount) || 0;
  const due = bill.dueDate?.slice(0, 10) ?? "";
  const overdueDays = due && due < today ? daysBetween(due, today) : 0;
  let state: BillState;
  if (bill.status === "DRAFT") state = "DRAFT";
  else if (bill.status === "CANCELLED" || bill.status === "REJECTED") state = "CANCELLED";
  else if (balance <= 0) state = "PAID";
  else if (overdueDays > 0) state = "OVERDUE";
  else state = paid > 0 ? "PARTIAL" : "UNPAID";
  const status = {
    PAID: "Paid",
    UNPAID: "Unpaid",
    PARTIAL: "Partially paid",
    OVERDUE: `Overdue (${overdueDays} ${overdueDays === 1 ? "day" : "days"})`,
    DRAFT: "Draft",
    CANCELLED: "Cancelled",
  }[state];
  return {
    id: bill.id,
    date: bill.issueDate.slice(0, 10),
    billNo: bill.referenceNumber || "",
    documentNumber: bill.documentNumber,
    party: bill.supplier?.name || "—",
    phone: bill.supplier?.phone,
    email: bill.supplier?.email,
    paymentType: bill.paymentType || "—",
    amount,
    paid,
    balance,
    due,
    state,
    overdueDays,
    status,
    firm: bill.business?.name || "Current firm",
    user: bill.createdBy?.name || "Unknown user",
  };
}

const STATE_STYLES: Record<BillState, string> = {
  PAID: "text-emerald-600",
  UNPAID: "text-slate-600",
  PARTIAL: "text-amber-600",
  OVERDUE: "text-red-600",
  DRAFT: "text-slate-400",
  CANCELLED: "text-slate-400 line-through",
};

function escapeMarkup(value: string | number) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export default function PurchaseBillRegister() {
  const router = useRouter();
  const [bills, setBills] = useState<BusinessDocument[]>([]);
  const [godowns, setGodowns] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [status, setStatus] = useState<StatusFilter>("ALL");
  const [period, setPeriod] = useState<Period>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [firm, setFirm] = useState("ALL");
  const [godown, setGodown] = useState("ALL");
  const [user, setUser] = useState("ALL");
  const [query, setQuery] = useState("");
  const [columnFilters, setColumnFilters] = useState<Partial<Record<ColumnKey, ColumnFilter>>>({});
  const [sort, setSort] = useState<{ key: ColumnKey; asc: boolean }>({ key: "date", asc: false });
  const [canDelete, setCanDelete] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [confirm, setConfirm] = useState<{ row: BillRow; action: "cancel" | "delete" } | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("status") === "overdue") setStatus("OVERDUE");
    void getCurrentUser().then((current) => setCanDelete(current?.role === "OWNER" || current?.role === "SUPER_ADMIN")).catch(() => undefined);
    void getAllPages<{ id: string; name: string }>("/inventory/godowns").then(({ data }) => setGodowns(data)).catch(() => undefined);
  }, []);

  // Dates and godown are filtered by the server; everything else is filtered locally.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    getAllPages<BusinessDocument>("/documents", {
      signal: controller.signal,
      params: {
        type: "PURCHASE_INVOICE",
        from: from || undefined,
        to: to || undefined,
        warehouseId: godown === "ALL" ? undefined : godown,
      },
    })
      .then(({ data }) => setBills(data))
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(getApiError(loadError, "Could not load purchase bills."));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [from, to, godown, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  const rows = useMemo(() => {
    const today = localDate();
    return bills.map((bill) => toRow(bill, today));
  }, [bills]);

  const firms = useMemo(() => [...new Set(rows.map((row) => row.firm))].sort(), [rows]);
  const users = useMemo(() => [...new Set(rows.map((row) => row.user))].sort(), [rows]);

  // Everything except the status filter, so the summary cards keep their totals while one is selected.
  const scoped = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (firm !== "ALL" && row.firm !== firm) return false;
      if (user !== "ALL" && row.user !== user) return false;
      if (term && ![row.billNo, row.documentNumber, row.party, row.paymentType, row.status].some((value) => value.toLowerCase().includes(term))) return false;
      return COLUMNS.every(({ key, kind }) => {
        const filter = columnFilters[key];
        if (!filter) return true;
        const value = row[key];
        if (kind === "number") {
          const amount = Number(value);
          return (!filter.min || amount >= Number(filter.min)) && (!filter.max || amount <= Number(filter.max));
        }
        if (kind === "date") {
          const day = String(value);
          return (!filter.min || (day && day >= filter.min)) && (!filter.max || (day && day <= filter.max));
        }
        if (kind === "status") return !filter.text || row.state === filter.text;
        const text = key === "billNo" ? `${row.billNo} ${row.documentNumber}` : String(value);
        return !filter.text || text.toLowerCase().includes(filter.text.toLowerCase());
      });
    });
  }, [rows, firm, user, query, columnFilters]);

  const visible = useMemo(() => {
    const matches = (row: BillRow) =>
      status === "ALL" || row.state === status || (status === "UNPAID" && row.state === "PARTIAL");
    return scoped.filter(matches).sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      const order = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
      return (order || b.date.localeCompare(a.date)) * (sort.asc ? 1 : -1);
    });
  }, [scoped, status, sort]);

  const summary = useMemo(() => {
    const live = scoped.filter((row) => row.state !== "DRAFT" && row.state !== "CANCELLED");
    const sum = (list: BillRow[], pick: (row: BillRow) => number) => list.reduce((total, row) => total + pick(row), 0);
    const paid = sum(live, (row) => row.paid);
    const overdue = sum(live.filter((row) => row.state === "OVERDUE"), (row) => row.balance);
    const unpaid = sum(live.filter((row) => row.state === "UNPAID" || row.state === "PARTIAL"), (row) => row.balance);
    return { paid, unpaid, overdue, total: paid + unpaid + overdue };
  }, [scoped]);

  const totals = useMemo(() => ({
    amount: visible.reduce((sum, row) => sum + (row.state === "CANCELLED" ? 0 : row.amount), 0),
    balance: visible.reduce((sum, row) => sum + (row.state === "CANCELLED" || row.state === "DRAFT" ? 0 : row.balance), 0),
  }), [visible]);

  const activeColumnFilters = Object.values(columnFilters).filter(Boolean).length;
  const hasFilters = status !== "ALL" || period !== "ALL" || firm !== "ALL" || godown !== "ALL" || user !== "ALL" || Boolean(query) || activeColumnFilters > 0;

  function choosePeriod(next: Period) {
    setPeriod(next);
    if (next === "CUSTOM") return;
    const range = periodRange(next);
    setFrom(range.from);
    setTo(range.to);
  }

  function clearFilters() {
    setStatus("ALL");
    choosePeriod("ALL");
    setFirm("ALL");
    setGodown("ALL");
    setUser("ALL");
    setQuery("");
    setColumnFilters({});
  }

  function pickUploads(fileList: FileList | null) {
    const files = Array.from(fileList ?? []);
    if (!files.length) return;
    const total = files.reduce((sum, file) => sum + file.size, 0);
    if (files.length > MAX_FILES || total > MAX_TOTAL_BYTES || files.some((file) => file.size <= 0 || file.size > MAX_FILE_BYTES)) {
      toast.error("Upload up to 10 files, 25 MB in total, each 10 MB or smaller.");
      return;
    }
    setPendingBillUploads(files);
    router.push(CREATE_PATH);
  }

  function registerMarkup() {
    const range = from || to ? `${from ? formatDate(from) : "Start"} to ${to ? formatDate(to) : "Today"}` : "All dates";
    const body = visible.map((row) => `<tr><td>${escapeMarkup(formatDate(row.date))}</td><td>${escapeMarkup(row.billNo || row.documentNumber)}</td><td>${escapeMarkup(row.party)}</td><td>${escapeMarkup(row.paymentType)}</td><td class="n">${row.amount.toFixed(2)}</td><td class="n">${row.balance.toFixed(2)}</td><td>${escapeMarkup(row.due ? formatDate(row.due) : "")}</td><td>${escapeMarkup(row.status)}</td></tr>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>Purchase Bills</title><style>body{font-family:Arial,sans-serif;color:#172033;font-size:12px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 12px;color:#55607a}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd3dc;padding:6px 8px;text-align:left}th{background:#eef3f8}.n{text-align:right}tfoot td{font-weight:700}</style></head><body><h1>Purchase Bills</h1><p>${escapeMarkup(range)} · Paid ${escapeMarkup(formatCurrency(summary.paid))} · Unpaid ${escapeMarkup(formatCurrency(summary.unpaid))} · Overdue ${escapeMarkup(formatCurrency(summary.overdue))} · Total ${escapeMarkup(formatCurrency(summary.total))}</p><table><thead><tr><th>Date</th><th>Bill No.</th><th>Party Name</th><th>Payment Type</th><th class="n">Amount</th><th class="n">Balance Due</th><th>Due Date</th><th>Status</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="4">Total (${visible.length} bills)</td><td class="n">${totals.amount.toFixed(2)}</td><td class="n">${totals.balance.toFixed(2)}</td><td colspan="2"></td></tr></tfoot></table></body></html>`;
  }

  function exportExcel() {
    const url = URL.createObjectURL(new Blob([registerMarkup()], { type: "application/vnd.ms-excel;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `purchase-bills-${localDate()}.xls`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function printRegister() {
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) return frame.remove();
    doc.open();
    doc.write(registerMarkup());
    doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 1000);
  }

  async function openPdf(row: BillRow, download = false) {
    const tab = download ? null : window.open("about:blank", "_blank");
    if (!download && !tab) return toast.error("Allow pop-ups to view this PDF.");
    if (tab) tab.opener = null;
    setBusyId(row.id);
    try {
      const { data } = await api.get<Blob>(`/documents/${row.id}/pdf`, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      if (tab) {
        tab.location.href = url;
      } else {
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${row.billNo || row.documentNumber}.pdf`;
        anchor.click();
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 120000);
    } catch (pdfError) {
      tab?.close();
      toast.error(getApiError(pdfError, "Could not open PDF."));
    } finally {
      setBusyId("");
    }
  }

  function shareText(row: BillRow) {
    return `Purchase bill ${row.billNo || row.documentNumber} dated ${formatDate(row.date)}\nAmount: ${formatCurrency(row.amount)}\nBalance due: ${formatCurrency(row.balance)}`;
  }

  async function runConfirm() {
    if (!confirm) return;
    const { row, action } = confirm;
    setBusyId(row.id);
    try {
      if (action === "cancel") {
        await api.patch(`/documents/${row.id}/status`, { status: "CANCELLED" });
        toast.success("Bill cancelled", { description: `${row.billNo || row.documentNumber} no longer counts toward payables.` });
      } else {
        await api.delete(`/documents/${row.id}`);
        toast.success("Bill deleted", { description: row.billNo || row.documentNumber });
      }
      setConfirm(null);
      reload();
    } catch (actionError) {
      toast.error(getApiError(actionError, action === "cancel" ? "Could not cancel bill." : "Could not delete bill."));
    } finally {
      setBusyId("");
    }
  }

  return (
    <>
      <PageHeader
        title="Purchase Bills"
        description="Record supplier bills, GST input, incoming stock, and purchase value."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <input ref={uploadInput} type="file" className="hidden" multiple accept="image/png,image/jpeg,image/webp,application/pdf" onChange={(event) => { pickUploads(event.target.files); event.target.value = ""; }} />
            <input ref={cameraInput} type="file" className="hidden" accept="image/*" capture="environment" onChange={(event) => { pickUploads(event.target.files); event.target.value = ""; }} />
            <div className="inline-flex h-10 overflow-hidden rounded-full border border-red-300 bg-white text-red-600">
              <button type="button" onClick={() => uploadInput.current?.click()} className="inline-flex items-center gap-2 px-4 text-xs font-bold transition hover:bg-red-50">
                <ScanLine size={16} aria-hidden="true" />
                Upload Purchase Bills
              </button>
              <Popover
                label="More upload options"
                align="right"
                trigger={(open) => (
                  <span className={`inline-flex h-full items-center border-l border-red-200 px-2.5 transition hover:bg-red-50 ${open ? "bg-red-50" : ""}`}>
                    <ChevronDown size={16} aria-hidden="true" />
                  </span>
                )}
              >
                {(close) => (
                  <div role="menu" className="w-56 py-1">
                    <MenuButton icon={<ScanLine size={15} />} onClick={() => { close(); uploadInput.current?.click(); }}>Upload image or PDF</MenuButton>
                    <MenuButton icon={<Camera size={15} />} onClick={() => { close(); cameraInput.current?.click(); }}>Take a photo of the bill</MenuButton>
                    <MenuLink icon={<Plus size={15} />} href={CREATE_PATH} onClick={close}>Enter bill manually</MenuLink>
                  </div>
                )}
              </Popover>
            </div>
            <Link href={CREATE_PATH} className="inline-flex h-10 items-center gap-2 rounded-full bg-red-600 px-5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700">
              <Plus size={16} aria-hidden="true" />
              Add Purchase
            </Link>
          </div>
        }
      />

      <section className="card mb-4 p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Bill status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as StatusFilter)}
                className="h-9 appearance-none rounded-lg bg-transparent pr-7 text-base font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-100"
              >
                {STATUS_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <ChevronDown size={16} aria-hidden="true" className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-500" />
            </label>

            <div className="flex h-9 items-stretch overflow-hidden rounded-lg border border-slate-200 text-xs">
              <label className="flex items-center bg-slate-100 px-2.5 font-bold text-slate-600">
                <span className="sr-only">Period</span>
                <select value={period} onChange={(event) => choosePeriod(event.target.value as Period)} className="bg-transparent font-bold outline-none">
                  {PERIOD_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </label>
              <span className="flex items-center bg-slate-50 px-2 font-semibold text-slate-500">Between</span>
              <input type="date" aria-label="From date" value={from} max={to || undefined} onChange={(event) => { setPeriod("CUSTOM"); setFrom(event.target.value); }} className="w-[8.5rem] px-2 text-slate-700 outline-none" />
              <span className="flex items-center px-1 text-slate-400">to</span>
              <input type="date" aria-label="To date" value={to} min={from || undefined} onChange={(event) => { setPeriod("CUSTOM"); setTo(event.target.value); }} className="w-[8.5rem] px-2 text-slate-700 outline-none" />
            </div>

            <FilterSelect label="Firm" value={firm} onChange={setFirm} options={firms.map((name) => [name, name])} allLabel="All firms" />
            <FilterSelect label="Godown" value={godown} onChange={setGodown} options={godowns.map(({ id, name }) => [id, name])} allLabel="All godowns" />
            <FilterSelect label="User" value={user} onChange={setUser} options={users.map((name) => [name, name])} allLabel="All users" />

            {hasFilters && (
              <button type="button" onClick={clearFilters} className="inline-flex h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-blue-600 hover:bg-blue-50">
                <X size={13} aria-hidden="true" /> Clear filters
              </button>
            )}
          </div>

          <div className="flex items-center gap-1 self-end xl:self-auto">
            <ToolButton label="Excel Report" onClick={exportExcel} disabled={!visible.length}>
              <FileSpreadsheet size={20} className="text-emerald-700" />
            </ToolButton>
            <ToolButton label="Print" onClick={printRegister} disabled={!visible.length}>
              <Printer size={20} className="text-slate-700" />
            </ToolButton>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:flex md:items-center md:gap-2">
          <SummaryCard label="Paid" value={summary.paid} tone="bg-emerald-50 text-emerald-900 ring-emerald-300" active={status === "PAID"} onClick={() => setStatus(status === "PAID" ? "ALL" : "PAID")} />
          <Operator>+</Operator>
          <SummaryCard label="Unpaid" value={summary.unpaid} tone="bg-sky-50 text-sky-900 ring-sky-300" active={status === "UNPAID"} onClick={() => setStatus(status === "UNPAID" ? "ALL" : "UNPAID")} />
          <Operator>+</Operator>
          <SummaryCard label="Overdue" value={summary.overdue} tone="bg-rose-50 text-rose-900 ring-rose-300" active={status === "OVERDUE"} onClick={() => setStatus(status === "OVERDUE" ? "ALL" : "OVERDUE")} />
          <Operator>=</Operator>
          <SummaryCard label="Total" value={summary.total} tone="bg-amber-50 text-amber-900 ring-amber-300" active={status === "ALL"} onClick={() => setStatus("ALL")} />
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-800">Transactions</h2>
          <div className="flex items-center gap-3">
            {activeColumnFilters > 0 && (
              <button type="button" onClick={() => setColumnFilters({})} className="text-xs font-bold text-blue-600 hover:underline">
                Clear column filters ({activeColumnFilters})
              </button>
            )}
            <label className="relative w-full sm:w-72">
              <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input aria-label="Search purchase bills" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Bill no., party, payment type..." className="input-field w-full !pl-9" />
            </label>
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading purchase bills..." />
        ) : error ? (
          <ErrorState message={error} onRetry={reload} />
        ) : !visible.length ? (
          <EmptyState
            icon={FileSpreadsheet}
            title={rows.length ? "No matching bills" : "No purchase bills yet"}
            description={rows.length ? "Try another search or clear your filters." : "Upload a supplier bill or add one manually to start this register."}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} scope="col" className="border-r border-slate-100 px-3 py-2.5 font-bold" aria-sort={sort.key === column.key ? (sort.asc ? "ascending" : "descending") : undefined}>
                      <div className={`flex items-center gap-1 ${column.align === "right" ? "justify-end" : "justify-between"}`}>
                        <button type="button" onClick={() => setSort({ key: column.key, asc: sort.key === column.key ? !sort.asc : true })} className="inline-flex items-center gap-1 uppercase hover:text-slate-800">
                          {column.label}
                          {sort.key === column.key && (sort.asc ? <ArrowUpNarrowWide size={12} /> : <ArrowDownWideNarrow size={12} />)}
                        </button>
                        <ColumnFilterButton
                          column={column}
                          value={columnFilters[column.key]}
                          onSort={(asc) => setSort({ key: column.key, asc })}
                          onChange={(filter) => setColumnFilters((current) => {
                            const next = { ...current };
                            if (filter && (filter.text || filter.min || filter.max)) next[column.key] = filter;
                            else delete next[column.key];
                            return next;
                          })}
                        />
                      </div>
                    </th>
                  ))}
                  <th scope="col" className="w-[120px] px-3 py-2.5 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visible.map((row) => {
                  const live = row.state !== "DRAFT" && row.state !== "CANCELLED";
                  return (
                    <tr key={row.id} className="hover:bg-blue-50/40">
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{formatDate(row.date)}</td>
                      <td className="px-3 py-3">
                        <Link href={`/documents/${row.id}`} className="font-semibold text-blue-700 hover:underline">{row.billNo || row.documentNumber}</Link>
                        {row.billNo && <span className="block text-[10px] text-slate-400">{row.documentNumber}</span>}
                      </td>
                      <td className="max-w-[220px] truncate px-3 py-3 font-semibold text-slate-800" title={row.party}>{row.party}</td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-slate-600" title={row.paymentType}>{row.paymentType}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800">{formatCurrency(row.amount)}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-right font-semibold text-slate-800">{live ? formatCurrency(row.balance) : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-slate-600">{row.due && row.balance > 0 && live ? formatDate(row.due) : ""}</td>
                      <td className={`whitespace-nowrap px-3 py-3 font-semibold ${STATE_STYLES[row.state]}`}>{row.status}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconButton label={`Print ${row.billNo || row.documentNumber}`} disabled={busyId === row.id} onClick={() => void openPdf(row)}>
                            <Printer size={16} />
                          </IconButton>
                          <Popover label={`Share ${row.billNo || row.documentNumber}`} align="right" trigger={() => <span className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700"><Share2 size={16} /></span>}>
                            {(close) => (
                              <div role="menu" className="w-52 py-1">
                                <MenuLink icon={<MessageCircle size={15} />} href={whatsappLink(row.phone, shareText(row))} external onClick={close}>WhatsApp supplier</MenuLink>
                                <MenuLink icon={<Mail size={15} />} href={`mailto:${encodeURIComponent(row.email ?? "")}?subject=${encodeURIComponent(`Purchase bill ${row.billNo || row.documentNumber}`)}&body=${encodeURIComponent(shareText(row))}`} external onClick={close}>Email supplier</MenuLink>
                                <MenuButton icon={<Download size={15} />} onClick={() => { close(); void openPdf(row, true); }}>Download PDF</MenuButton>
                              </div>
                            )}
                          </Popover>
                          <RowActions
                            label={`More actions for ${row.billNo || row.documentNumber}`}
                            actions={[
                              { label: "View", icon: "view", href: `/documents/${row.id}` },
                              row.state !== "CANCELLED" && row.paid === 0 && { label: "Edit", icon: "edit", href: `${CREATE_PATH}?editId=${row.id}` },
                              { label: "Duplicate", icon: "duplicate", href: `${CREATE_PATH}?duplicateId=${row.id}` },
                              { label: "Print / PDF", icon: "print", onClick: () => void openPdf(row) },
                              live && row.balance > 0 && { label: "Make payment", icon: "payment", href: `/purchases/payment-out?billId=${row.id}` },
                              live && { label: "Purchase return / Dr. note", icon: "undo", href: `${DOCUMENT_CONFIG.DEBIT_NOTE.createPath}?sourceDocumentId=${row.id}` },
                              live && row.paid === 0 && { label: "Cancel bill", icon: "cancel", danger: true, onClick: () => setConfirm({ row, action: "cancel" }) },
                              canDelete && !live && { label: "Delete", icon: "delete", danger: true, onClick: () => setConfirm({ row, action: "delete" }) },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-xs font-bold text-slate-700">
                <tr>
                  <td colSpan={4} className="px-3 py-2.5">Total · {visible.length} {visible.length === 1 ? "bill" : "bills"}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(totals.amount)}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(totals.balance)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {confirm && (
        <ConfirmDialog
          title={confirm.action === "cancel" ? "Cancel this bill?" : "Delete this bill?"}
          message={confirm.action === "cancel"
            ? `${confirm.row.billNo || confirm.row.documentNumber} from ${confirm.row.party} will be cancelled and its stock and payable reversed. Cancelled bills stay in the register.`
            : `${confirm.row.billNo || confirm.row.documentNumber} will be removed from the register.`}
          confirmLabel={confirm.action === "cancel" ? "Cancel bill" : "Delete"}
          busyLabel={confirm.action === "cancel" ? "Cancelling..." : "Deleting..."}
          busy={busyId === confirm.row.id}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void runConfirm()}
        />
      )}
    </>
  );
}

function SummaryCard({ label, value, tone, active, onClick }: { label: string; value: number; tone: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-w-0 rounded-xl px-4 py-3 text-left transition hover:-translate-y-0.5 md:min-w-[11rem] ${tone} ${active ? "ring-2" : "ring-0"}`}
    >
      <span className="block text-xs font-semibold opacity-80">{label}</span>
      <span className="mt-1 block truncate text-lg font-extrabold">{formatCurrency(value)}</span>
    </button>
  );
}

function Operator({ children }: { children: ReactNode }) {
  return <span aria-hidden="true" className="hidden px-1 text-xl font-bold text-slate-400 md:block">{children}</span>;
}

function FilterSelect({ label, value, onChange, options, allLabel }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; allLabel: string }) {
  return (
    <label className="relative">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="h-9 appearance-none rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs font-semibold uppercase text-slate-600 outline-none hover:border-blue-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
        <option value="ALL">{allLabel}</option>
        {options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}
      </select>
      <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
    </label>
  );
}

function ToolButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="flex min-w-16 flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-40">
      {children}
      {label}
    </button>
  );
}

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} disabled={disabled} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-blue-700 disabled:opacity-40">
      {children}
    </button>
  );
}

function ColumnFilterButton({ column, value, onSort, onChange }: {
  column: (typeof COLUMNS)[number];
  value?: ColumnFilter;
  onSort: (asc: boolean) => void;
  onChange: (filter: ColumnFilter | undefined) => void;
}) {
  const active = Boolean(value);
  const inputClass = "h-8 w-full rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100";
  return (
    <Popover
      label={`Filter ${column.label}`}
      align={column.align === "right" ? "right" : "left"}
      trigger={() => (
        <span className={`flex h-6 w-6 items-center justify-center rounded-md transition ${active ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-200 hover:text-slate-700"}`}>
          <Filter size={11} />
        </span>
      )}
    >
      {(close) => (
        <div className="w-60 space-y-3 p-3 text-xs">
          <div className="flex gap-1.5">
            <button type="button" onClick={() => { onSort(true); close(); }} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">
              {column.kind === "number" ? "Low to high" : column.kind === "date" ? "Oldest first" : "A to Z"}
            </button>
            <button type="button" onClick={() => { onSort(false); close(); }} className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">
              {column.kind === "number" ? "High to low" : column.kind === "date" ? "Newest first" : "Z to A"}
            </button>
          </div>
          {column.kind === "text" && (
            <label className="block space-y-1">
              <span className="font-semibold text-slate-500">Contains</span>
              <input autoFocus className={inputClass} value={value?.text ?? ""} onChange={(event) => onChange({ text: event.target.value })} />
            </label>
          )}
          {column.kind === "status" && (
            <label className="block space-y-1">
              <span className="font-semibold text-slate-500">Status is</span>
              <select className={inputClass} value={value?.text ?? ""} onChange={(event) => onChange({ text: event.target.value })}>
                <option value="">Any status</option>
                {STATUS_OPTIONS.filter(([option]) => option !== "ALL").map(([option, label]) => <option key={option} value={option}>{label}</option>)}
              </select>
            </label>
          )}
          {(column.kind === "number" || column.kind === "date") && (
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-1">
                <span className="font-semibold text-slate-500">{column.kind === "date" ? "From" : "Min"}</span>
                <input type={column.kind === "date" ? "date" : "number"} min={column.kind === "number" ? 0 : undefined} className={inputClass} value={value?.min ?? ""} onChange={(event) => onChange({ ...value, min: event.target.value })} />
              </label>
              <label className="space-y-1">
                <span className="font-semibold text-slate-500">{column.kind === "date" ? "To" : "Max"}</span>
                <input type={column.kind === "date" ? "date" : "number"} min={column.kind === "number" ? 0 : undefined} className={inputClass} value={value?.max ?? ""} onChange={(event) => onChange({ ...value, max: event.target.value })} />
              </label>
            </div>
          )}
          {active && (
            <button type="button" onClick={() => { onChange(undefined); close(); }} className="font-bold text-blue-600 hover:underline">
              Clear filter
            </button>
          )}
        </div>
      )}
    </Popover>
  );
}
