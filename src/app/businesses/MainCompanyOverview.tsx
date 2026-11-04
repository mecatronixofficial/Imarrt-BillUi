"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Crown, Landmark, Wallet } from "lucide-react";
import { ErrorState, LoadingState } from "@/components/ContentState";
import { api, getApiError, setActiveBusinessId } from "@/lib/api";
import { localDate } from "@/lib/business-report";
import { formatCurrency } from "@/lib/format";
import type { WorkspaceBranch } from "@/types";

type Figures = {
  sales: number; salesCount: number; salesReturns: number; received: number; receivable: number;
  purchases: number; purchasesCount: number; purchaseReturns: number; paid: number; payable: number;
  expenses: number; otherIncome: number; profit: number; cash: number; bank: number;
};
type Summary = { id: string; name: string; code: string; from: string; to: string; companies: Array<Figures & { id: string; name: string; gstin: string | null; gstRegistered: boolean }>; totals: Figures };
type Period = "MONTH" | "QUARTER" | "YEAR" | "LAST_YEAR" | "ALL";

const PERIODS: Array<[Period, string]> = [["MONTH", "This Month"], ["QUARTER", "This Quarter"], ["YEAR", "This Financial Year"], ["LAST_YEAR", "Last Financial Year"], ["ALL", "All Time"]];

function periodDates(period: Period, now = new Date()) {
  const y = now.getFullYear(), m = now.getMonth();
  const fy = m >= 3 ? y : y - 1;
  switch (period) {
    case "MONTH": return { from: localDate(new Date(y, m, 1)), to: localDate(new Date(y, m + 1, 0)) };
    case "QUARTER": { const q = Math.floor(m / 3) * 3; return { from: localDate(new Date(y, q, 1)), to: localDate(new Date(y, q + 3, 0)) }; }
    case "LAST_YEAR": return { from: `${fy - 1}-04-01`, to: `${fy}-03-31` };
    case "ALL": return { from: "2000-01-01", to: localDate(now) };
    default: return { from: `${fy}-04-01`, to: `${fy + 1}-03-31` };
  }
}

/** The main company's view: every sub company's figures, side by side and added up. */
export default function MainCompanyOverview({ group }: { group: WorkspaceBranch }) {
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("YEAR");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setSummary(null); setError("");
    api.get<Summary>(`/workspace-branches/${group.id}/summary`, { params: periodDates(period) })
      .then(({ data }) => { if (active) setSummary(data); })
      .catch((failure) => { if (active) setError(getApiError(failure, "Could not load the main company figures.")); });
    return () => { active = false; };
  }, [group.id, period, version]);

  function open(companyId: string) {
    setActiveBusinessId(companyId);
    router.push("/dashboard");
  }

  const totals = summary?.totals;
  const tiles: Array<[string, number | undefined, string]> = [
    ["Sales", totals?.sales, "text-emerald-700"],
    ["Received", totals?.received, "text-emerald-700"],
    ["Receivable", totals?.receivable, "text-amber-700"],
    ["Purchases", totals?.purchases, "text-rose-700"],
    ["Payable", totals?.payable, "text-rose-700"],
    ["Expenses", totals?.expenses, "text-rose-700"],
    ["Estimated profit", totals?.profit, (totals?.profit ?? 0) < 0 ? "text-rose-700" : "text-blue-700"],
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white"><Crown size={18} /></span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[.16em] text-blue-600">Main company view</p>
            <h2 className="text-base font-black text-slate-950">{group.name} <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{group.code}</span></h2>
            <p className="text-[11px] text-slate-500">All {group.businesses.length} sub {group.businesses.length === 1 ? "company" : "companies"} added together</p>
          </div>
        </div>
        <select aria-label="Main company period" className="input-field h-9 w-full sm:w-52" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
          {PERIODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </div>

      {error ? <ErrorState message={error} onRetry={() => setVersion((v) => v + 1)} /> : !summary ? <LoadingState label="Adding up sub companies..." /> : (
        <div className="space-y-4 p-4">
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-7">
            {tiles.map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
                <p className={`mt-1 truncate text-sm font-black ${tone}`}>{formatCurrency(value ?? 0)}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-emerald-50/60 px-3 py-2.5"><Wallet size={18} className="text-emerald-600" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Cash in hand (today)</p><p className="text-sm font-black text-slate-900">{formatCurrency(summary.totals.cash)}</p></div></div>
            <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2.5"><Landmark size={18} className="text-blue-600" /><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Bank balance (today)</p><p className="text-sm font-black text-slate-900">{formatCurrency(summary.totals.bank)}</p></div></div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Sub company</th>
                  <th className="px-3 py-2.5 text-right">Sales</th>
                  <th className="px-3 py-2.5 text-right">Received</th>
                  <th className="px-3 py-2.5 text-right">Receivable</th>
                  <th className="px-3 py-2.5 text-right">Purchases</th>
                  <th className="px-3 py-2.5 text-right">Payable</th>
                  <th className="px-3 py-2.5 text-right">Expenses</th>
                  <th className="px-3 py-2.5 text-right">Profit</th>
                  <th className="px-3 py-2.5 text-right">Cash</th>
                  <th className="px-3 py-2.5 text-right">Bank</th>
                  <th className="px-3 py-2.5"><span className="sr-only">Open</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {summary.companies.map((company) => {
                  const share = summary.totals.sales > 0 ? Math.round((company.sales / summary.totals.sales) * 100) : 0;
                  return (
                    <tr key={company.id} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2.5">
                        <p className="font-bold text-slate-900">{company.name}</p>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${share}%` }} /></span>
                          <span className="text-[10px] text-slate-400">{share}% of sales</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.sales)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.received)}</td>
                      <td className="px-3 py-2.5 text-right text-amber-700">{formatCurrency(company.receivable)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.purchases)}</td>
                      <td className="px-3 py-2.5 text-right text-rose-700">{formatCurrency(company.payable)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.expenses)}</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${company.profit < 0 ? "text-rose-700" : "text-blue-700"}`}>{formatCurrency(company.profit)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.cash)}</td>
                      <td className="px-3 py-2.5 text-right">{formatCurrency(company.bank)}</td>
                      <td className="px-3 py-2.5 text-right">
                        <button type="button" onClick={() => open(company.id)} className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800">Open <ArrowRight size={12} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-blue-50/60 font-black text-slate-900">
                <tr>
                  <td className="px-3 py-2.5">Total · {summary.name}</td>
                  {(["sales", "received", "receivable", "purchases", "payable", "expenses", "profit", "cash", "bank"] as const).map((key) => (
                    <td key={key} className="px-3 py-2.5 text-right">{formatCurrency(summary.totals[key])}</td>
                  ))}
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-slate-400">Sales, purchases, received, paid, expenses and profit are for the chosen period. Receivable, payable, cash and bank are as of today. Profit is an estimate: sales less returns and purchases plus other income, minus expenses.</p>
        </div>
      )}
    </section>
  );
}
