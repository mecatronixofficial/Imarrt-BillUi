import { productionTotals, type ColorQuantities } from '@/lib/production-master';

export default function ProductionQuantityTotals({ rows }: { rows: ColorQuantities[] }) {
  const totals = productionTotals(rows);
  return <div className="mt-3 grid gap-3 sm:grid-cols-2">
    <section aria-label="Color-wise total" className="rounded-xl border border-blue-100 bg-blue-50/50 p-3">
      <h4 className="text-xs font-bold text-slate-800">Color-wise total</h4>
      <div className="mt-2 flex flex-wrap gap-2">{totals.colors.map(({ color, total }, index) => <span key={index} className="rounded-md border border-blue-100 bg-white px-2 py-1 text-xs text-slate-600">{color.trim() || `Color ${index + 1}`} <strong className="ml-1 text-blue-800">{total} pcs</strong></span>)}</div>
      <p className="mt-2 text-xs font-bold text-blue-800">Total: {totals.total} pcs</p>
    </section>
    <section aria-label="Size-wise total" className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h4 className="text-xs font-bold text-slate-800">Size-wise total</h4>
      <div className="mt-2 flex flex-wrap gap-2">{Object.entries(totals.sizes).map(([size, total]) => <span key={size} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600">{size} <strong className="ml-1 text-slate-900">{total} pcs</strong></span>)}</div>
      <p className="mt-2 text-xs font-bold text-slate-800">Total: {totals.total} pcs</p>
    </section>
  </div>;
}
