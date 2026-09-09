'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRight,
  Boxes,
  Building2,
  CalendarDays,
  Check,
  CircleDollarSign,
  Factory,
  IndianRupee,
  PackageCheck,
  Palette,
  Pencil,
  Plus,
  Scissors,
  Shirt,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import type {
  Party,
  ProductionCostCategory,
  ProductionOrder,
  ProductionOrderStatus,
  ProductionStage,
  ProductionStageType,
  Supplier,
} from '@/types';

const STAGE_META: Record<ProductionStageType, { label: string; shortLabel: string; icon: typeof Scissors; accent: string }> = {
  CUTTING: { label: 'Cutting', shortLabel: 'Cut', icon: Scissors, accent: 'text-blue-600 bg-blue-50' },
  PRINT_EMBROIDERY: { label: 'Print / Embroidery DC', shortLabel: 'Print & Emb', icon: Palette, accent: 'text-violet-600 bg-violet-50' },
  STITCHING: { label: 'Stitching', shortLabel: 'Stitch', icon: Shirt, accent: 'text-amber-600 bg-amber-50' },
  PACKING: { label: 'Packing', shortLabel: 'Pack', icon: PackageCheck, accent: 'text-emerald-600 bg-emerald-50' },
};

const COST_CATEGORIES: ProductionCostCategory[] = [
  'FABRIC', 'COLLAR_RIB', 'ACCESSORIES', 'LABELS', 'TAGS', 'POLY_BAGS', 'BUTTONS', 'CARTONS', 'TRANSPORT', 'OTHER',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function ProductionPage() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);
  const [showCostForm, setShowCostForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: production }, { data: partyData }, { data: supplierData }] = await Promise.all([
        getAllPages<ProductionOrder>('/production-orders'),
        getAllPages<Party>('/parties'),
        getAllPages<Supplier>('/suppliers'),
      ]);
      setOrders(production);
      setParties(partyData);
      setSuppliers(supplierData);
      const requestedOrderId = searchParams.get('orderId');
      setSelectedId((current) => requestedOrderId && production.some(({ id }) => id === requestedOrderId) ? requestedOrderId : production.some(({ id }) => id === current) ? current : production[0]?.id ?? '');
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load production workspace.'));
    } finally {
      setLoading(false);
    }
  }, [searchParams]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedOrder = orders.find(({ id }) => id === selectedId);
  const stats = useMemo(() => {
    const active = orders.filter(({ status }) => !['COMPLETED', 'CANCELLED'].includes(status));
    return {
      active: active.length,
      pieces: active.reduce((total, order) => total + order.orderedQty, 0),
      cost: orders.reduce((total, order) => total + order.summary.totalMakingCost, 0),
      profit: orders.reduce((total, order) => total + order.summary.profit, 0),
    };
  }, [orders]);

  function applyUpdatedOrder(updated: ProductionOrder) {
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
  }

  async function changeStatus(status: ProductionOrderStatus) {
    if (!selectedOrder || updatingStatus) return;
    setUpdatingStatus(true);
    setActionError('');
    try {
      const { data } = await api.patch<ProductionOrder>(`/production-orders/${selectedOrder.id}/status`, { status });
      applyUpdatedOrder(data);
    } catch (statusError: unknown) {
      setActionError(getApiError(statusError, 'Could not update order status.'));
    } finally {
      setUpdatingStatus(false);
    }
  }

  async function removeCost(costId: string) {
    if (!selectedOrder || !window.confirm('Remove this cost entry?')) return;
    setActionError('');
    try {
      const { data } = await api.delete<ProductionOrder>(`/production-orders/${selectedOrder.id}/costs/${costId}`);
      applyUpdatedOrder(data);
    } catch (removeError: unknown) {
      setActionError(getApiError(removeError, 'Could not remove cost.'));
    }
  }

  return (
    <>
      <PageHeader
        title="Production"
        description="Track every garment order from master details to final making cost and profit."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowSupplierForm(true)} className="btn-secondary inline-flex items-center gap-2">
              <Building2 aria-hidden="true" size={16} /> Add supplier
            </button>
            <button type="button" onClick={() => setShowOrderForm(true)} className="btn-primary inline-flex items-center gap-2">
              <Plus aria-hidden="true" size={16} /> New order
            </button>
          </div>
        }
      />

      <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <MetricCard icon={Factory} label="Active orders" value={String(stats.active)} tone="blue" />
        <MetricCard icon={Boxes} label="Pieces in production" value={stats.pieces.toLocaleString('en-IN')} tone="violet" />
        <MetricCard icon={IndianRupee} label="Total making cost" value={formatCurrency(stats.cost)} tone="amber" />
        <MetricCard icon={TrendingUp} label="Projected profit" value={formatCurrency(stats.profit)} tone={stats.profit >= 0 ? 'emerald' : 'red'} />
      </section>

      {loading ? (
        <section className="card"><LoadingState label="Loading production orders..." /></section>
      ) : error ? (
        <section className="card"><ErrorState message={error} onRetry={loadData} /></section>
      ) : orders.length === 0 ? (
        <section className="card">
          <EmptyState icon={Factory} title="No production orders yet" description="Create your first order to start the cutting-to-packing workflow." />
          <div className="flex justify-center pb-6">
            <button type="button" onClick={() => setShowOrderForm(true)} className="btn-primary">Create first order</button>
          </div>
        </section>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
          <OrderList orders={orders} selectedId={selectedId} onSelect={setSelectedId} />
          {selectedOrder && (
            <OrderDetail
              order={selectedOrder}
              error={actionError}
              updatingStatus={updatingStatus}
              onEditStage={setEditingStage}
              onAddCost={() => setShowCostForm(true)}
              onRemoveCost={(id) => void removeCost(id)}
              onChangeStatus={(status) => void changeStatus(status)}
            />
          )}
        </div>
      )}

      {showOrderForm && (
        <OrderFormModal
          parties={parties}
          suppliers={suppliers}
          onClose={() => setShowOrderForm(false)}
          onSaved={(order) => {
            setOrders((current) => [order, ...current]);
            setSelectedId(order.id);
            setShowOrderForm(false);
          }}
        />
      )}
      {showSupplierForm && (
        <SupplierFormModal
          onClose={() => setShowSupplierForm(false)}
          onSaved={(supplier) => {
            setSuppliers((current) => [...current, supplier].sort((a, b) => a.name.localeCompare(b.name)));
            setShowSupplierForm(false);
          }}
        />
      )}
      {editingStage && selectedOrder && (
        <StageFormModal
          orderId={selectedOrder.id}
          stage={editingStage}
          onClose={() => setEditingStage(null)}
          onSaved={(order) => {
            applyUpdatedOrder(order);
            setEditingStage(null);
          }}
        />
      )}
      {showCostForm && selectedOrder && (
        <CostFormModal
          orderId={selectedOrder.id}
          suppliers={suppliers}
          onClose={() => setShowCostForm(false)}
          onSaved={(order) => {
            applyUpdatedOrder(order);
            setShowCostForm(false);
          }}
        />
      )}
    </>
  );
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: typeof Factory; label: string; value: string; tone: string }) {
  const tones: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600', violet: 'bg-violet-50 text-violet-600', amber: 'bg-amber-50 text-amber-600', emerald: 'bg-emerald-50 text-emerald-600', red: 'bg-red-50 text-red-600',
  };
  return (
    <article className="card flex min-w-0 items-center gap-3 p-3.5 sm:p-4">
      <span className={clsx('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tones[tone])}><Icon aria-hidden="true" size={19} /></span>
      <span className="min-w-0">
        <span className="block truncate text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
        <span className="mt-0.5 block truncate text-base font-extrabold text-slate-950 sm:text-lg">{value}</span>
      </span>
    </article>
  );
}

function OrderList({ orders, selectedId, onSelect }: { orders: ProductionOrder[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <aside className="card overflow-hidden xl:sticky xl:top-6">
      <div className="border-b border-slate-100 px-4 py-3">
        <h2 className="text-sm font-bold text-slate-900">Production orders</h2>
        <p className="text-[11px] text-slate-500">{orders.length} total orders</p>
      </div>
      <div className="max-h-[68vh] space-y-1.5 overflow-y-auto p-2">
        {orders.map((order) => (
          <button
            key={order.id}
            type="button"
            onClick={() => onSelect(order.id)}
            className={clsx(
              'w-full rounded-xl border p-3 text-left outline-none transition focus:ring-2 focus:ring-blue-500',
              selectedId === order.id ? 'border-blue-200 bg-blue-50/70 shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-slate-900">{order.orderNumber}</p>
                <p className="mt-0.5 truncate text-[11px] text-slate-500">{order.styleName} · {order.party.name}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>
            <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>{order.orderedQty.toLocaleString('en-IN')} pcs</span>
              <span>{order.summary.progressPercent}% complete</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${order.summary.progressPercent}%` }} />
            </div>
          </button>
        ))}
      </div>
    </aside>
  );
}

function OrderDetail({
  order,
  error,
  updatingStatus,
  onEditStage,
  onAddCost,
  onRemoveCost,
  onChangeStatus,
}: {
  order: ProductionOrder;
  error: string;
  updatingStatus: boolean;
  onEditStage: (stage: ProductionStage) => void;
  onAddCost: () => void;
  onRemoveCost: (id: string) => void;
  onChangeStatus: (status: ProductionOrderStatus) => void;
}) {
  const nextAction = order.status === 'READY' ? { label: 'Mark dispatched', status: 'DISPATCHED' as const } : order.status === 'DISPATCHED' ? { label: 'Complete order', status: 'COMPLETED' as const } : null;
  return (
    <div className="min-w-0 space-y-4">
      <section className="card overflow-hidden">
        <div className="bg-slate-950 px-4 py-4 text-white sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2"><StatusBadge status={order.status} /><span className="text-[10px] text-slate-400">Created {formatDate(order.createdAt)}</span></div>
              <h2 className="text-lg font-extrabold tracking-tight">{order.styleName}</h2>
              <p className="text-xs text-slate-400">Order {order.orderNumber}</p>
            </div>
            {nextAction && (
              <button type="button" disabled={updatingStatus} onClick={() => onChangeStatus(nextAction.status)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-3.5 py-2 text-xs font-bold text-slate-900 transition hover:bg-blue-50 disabled:opacity-60">
                {nextAction.label} <ArrowRight aria-hidden="true" size={15} />
              </button>
            )}
          </div>
        </div>
        {error && <div role="alert" className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
        <div className="grid grid-cols-2 divide-x divide-y divide-slate-100 sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
          <InfoCell label="Party" value={order.party.name} />
          <InfoCell label="Supplier" value={order.supplier?.name || 'Not assigned'} />
          <InfoCell label="Fabric" value={[order.fabricName, order.fabricGsm].filter(Boolean).join(' · ') || '—'} />
          <InfoCell label="Colour" value={order.color || '—'} />
          <InfoCell label="Order qty" value={`${order.orderedQty.toLocaleString('en-IN')} pcs`} />
          <InfoCell label="Due date" value={formatDate(order.dueDate)} />
        </div>
        {order.sizeBreakdown && Object.keys(order.sizeBreakdown).length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Size breakdown</span>
            {Object.entries(order.sizeBreakdown).map(([size, quantity]) => (
              <span key={size} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700">{size} <strong className="ml-1 text-slate-950">{quantity}</strong></span>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div><h3 className="text-sm font-bold text-slate-950">Production workflow</h3><p className="text-[11px] text-slate-500">Update DC, quantity, unit and cost at every stage.</p></div>
          <span className="text-xs font-bold text-blue-700">{order.summary.progressPercent}%</span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          {order.stages.map((stage) => <StageCard key={stage.id} stage={stage} onEdit={() => onEditStage(stage)} />)}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div><h3 className="text-sm font-bold text-slate-950">Material & accessory costing</h3><p className="text-[11px] text-slate-500">Fabric, trims, labels, packing and transport.</p></div>
            <button type="button" onClick={onAddCost} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus aria-hidden="true" size={14} /> Add cost</button>
          </div>
          {order.costs.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">No material costs added yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[590px] text-xs">
                <thead className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-400"><tr><th className="px-4 py-2.5">Cost item</th><th className="px-4 py-2.5">Supplier</th><th className="px-4 py-2.5 text-right">Qty × rate</th><th className="px-4 py-2.5 text-right">Amount</th><th className="w-10" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {order.costs.map((cost) => (
                    <tr key={cost.id}>
                      <td className="px-4 py-3"><span className="font-semibold text-slate-800">{cost.description}</span><span className="mt-0.5 block text-[10px] text-slate-400">{labelize(cost.category)}</span></td>
                      <td className="px-4 py-3 text-slate-500">{cost.supplier?.name || '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{Number(cost.quantity).toLocaleString('en-IN')} × {formatCurrency(cost.rate)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(cost.amount)}</td>
                      <td className="pr-3"><button type="button" onClick={() => onRemoveCost(cost.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${cost.description}`}><Trash2 aria-hidden="true" size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <CostSummary order={order} />
      </section>
    </div>
  );
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-3.5 py-3"><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-800" title={value}>{value}</span></div>;
}

function StageCard({ stage, onEdit }: { stage: ProductionStage; onEdit: () => void }) {
  const meta = STAGE_META[stage.type];
  const Icon = meta.icon;
  const cost = Math.max(stage.issuedQty, stage.completedQty) * Number(stage.rate) + Number(stage.otherCost);
  return (
    <article className={clsx('relative overflow-hidden rounded-xl border p-3.5', stage.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', meta.accent)}><Icon aria-hidden="true" size={17} /></span>
        <button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600" aria-label={`Edit ${meta.label}`}><Pencil aria-hidden="true" size={14} /></button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-900">{meta.label}</h4><StatusBadge status={stage.status} /></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
        <MiniStat label="Issued" value={stage.issuedQty} /><MiniStat label="Done" value={stage.completedQty} /><MiniStat label="Reject" value={stage.rejectedQty} />
      </div>
      <div className="mt-3 space-y-1 text-[10px] text-slate-500">
        <p className="truncate"><strong className="text-slate-700">Unit:</strong> {stage.partnerName || 'Not assigned'}</p>
        <p className="truncate"><strong className="text-slate-700">DC:</strong> {stage.dcNumber || '—'} · <strong className="text-slate-700">Cost:</strong> {formatCurrency(cost)}</p>
      </div>
    </article>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return <span className="rounded-lg bg-slate-50 px-1 py-2"><strong className="block text-xs text-slate-900">{value}</strong><span className="text-[9px] text-slate-400">{label}</span></span>;
}

function CostSummary({ order }: { order: ProductionOrder }) {
  const summary = order.summary;
  return (
    <aside className="overflow-hidden rounded-xl bg-slate-950 text-white shadow-xl shadow-slate-200">
      <div className="border-b border-white/10 p-4"><div className="flex items-center gap-2"><CircleDollarSign aria-hidden="true" size={18} className="text-blue-300" /><h3 className="text-sm font-bold">Order profitability</h3></div><p className="mt-1 text-[10px] text-slate-400">Live actual cost based on recorded production.</p></div>
      <div className="space-y-2.5 p-4 text-xs">
        <SummaryRow label={`Revenue (${order.orderedQty} × ${formatCurrency(order.saleRate)})`} value={formatCurrency(summary.revenue)} />
        <SummaryRow label="Process cost" value={formatCurrency(summary.processCost)} />
        <SummaryRow label="Material & accessories" value={formatCurrency(summary.materialCost)} />
        <div className="my-3 border-t border-white/10" />
        <SummaryRow label="Total making cost" value={formatCurrency(summary.totalMakingCost)} strong />
        <SummaryRow label="Making cost / piece" value={formatCurrency(summary.costPerPiece)} />
      </div>
      <div className={clsx('m-3 mt-0 rounded-xl p-3.5', summary.profit >= 0 ? 'bg-emerald-500/15' : 'bg-red-500/15')}>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Projected profit</span>
        <div className="mt-1 flex items-end justify-between gap-2"><strong className={clsx('text-xl', summary.profit >= 0 ? 'text-emerald-300' : 'text-red-300')}>{formatCurrency(summary.profit)}</strong><span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold">{summary.marginPercent}% margin</span></div>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="flex items-center justify-between gap-3"><span className={strong ? 'font-semibold text-slate-200' : 'text-slate-400'}>{label}</span><span className={strong ? 'font-extrabold text-white' : 'font-semibold text-slate-200'}>{value}</span></div>;
}

function OrderFormModal({ parties, suppliers, onClose, onSaved }: { parties: Party[]; suppliers: Supplier[]; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const now = new Date();
  const defaultNumber = `PO-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getTime()).slice(-4)}`;
  const [form, setForm] = useState({ orderNumber: defaultNumber, partyId: parties[0]?.id ?? '', supplierId: '', styleName: '', fabricName: '', fabricGsm: '', color: '', saleRate: '', dueDate: '', notes: '' });
  const [sizes, setSizes] = useState<Record<string, string>>(Object.fromEntries(SIZES.map((size) => [size, ''])));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = Object.values(sizes).reduce((sum, quantity) => sum + (Number(quantity) || 0), 0);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.partyId) { setError('Add or select a party first.'); return; }
    if (total <= 0) { setError('Enter at least one size quantity.'); return; }
    setSaving(true); setError('');
    try {
      const sizeBreakdown = Object.fromEntries(Object.entries(sizes).filter(([, value]) => Number(value) > 0).map(([size, value]) => [size, Number(value)]));
      const { data } = await api.post<ProductionOrder>('/production-orders', {
        ...form,
        supplierId: form.supplierId || undefined,
        fabricName: form.fabricName.trim() || undefined,
        fabricGsm: form.fabricGsm.trim() || undefined,
        color: form.color.trim() || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes.trim() || undefined,
        styleName: form.styleName.trim(),
        orderedQty: total,
        saleRate: Number(form.saleRate),
        sizeBreakdown,
      });
      onSaved(data);
    } catch (saveError: unknown) {
      setError(getApiError(saveError, 'Could not create production order.'));
    } finally { setSaving(false); }
  }

  return (
    <Modal title="New production order" onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <FormError message={error} />}
        {parties.length === 0 && <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">Create a party before adding an order. <Link href="/parties" className="font-bold underline">Go to parties</Link></div>}
        <FormSection title="Order master" icon={Factory}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Order number *"><input required className="input-field" value={form.orderNumber} onChange={(e) => setForm({ ...form, orderNumber: e.target.value })} /></Field>
            <Field label="Party *"><select required className="input-field" value={form.partyId} onChange={(e) => setForm({ ...form, partyId: e.target.value })}><option value="">Select party</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></Field>
            <Field label="Primary supplier"><select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
            <Field label="Style / product *"><input required className="input-field" placeholder="Mens polo T-shirt" value={form.styleName} onChange={(e) => setForm({ ...form, styleName: e.target.value })} /></Field>
            <Field label="Fabric"><input className="input-field" placeholder="Airtex / cotton" value={form.fabricName} onChange={(e) => setForm({ ...form, fabricName: e.target.value })} /></Field>
            <Field label="GSM / finish"><input className="input-field" placeholder="240 GSM bio wash" value={form.fabricGsm} onChange={(e) => setForm({ ...form, fabricGsm: e.target.value })} /></Field>
            <Field label="Colour"><input className="input-field" placeholder="Navy blue" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} /></Field>
            <Field label="Party rate / pc *"><input required min="0" step="0.01" type="number" className="input-field" value={form.saleRate} onChange={(e) => setForm({ ...form, saleRate: e.target.value })} /></Field>
            <Field label="Delivery date"><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
          </div>
        </FormSection>
        <FormSection title="Size ratio" icon={Shirt} trailing={<span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">Total {total} pcs</span>}>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">{SIZES.map((size) => <Field key={size} label={size}><input min="0" type="number" className="input-field px-2 text-center" value={sizes[size]} onChange={(e) => setSizes({ ...sizes, [size]: e.target.value })} /></Field>)}</div>
        </FormSection>
        <Field label="Production notes"><textarea rows={2} className="input-field resize-none" placeholder="Artwork, labels, packing or quality instructions" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <FormActions saving={saving} onClose={onClose} submitLabel="Create order" />
      </form>
    </Modal>
  );
}

function SupplierFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: (supplier: Supplier) => void }) {
  const [form, setForm] = useState({ name: '', contactName: '', phone: '', email: '', gstin: '', address: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try {
      const { data } = await api.post<Supplier>('/suppliers', Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() || undefined])));
      onSaved(data);
    } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not add supplier.')); } finally { setSaving(false); }
  }
  return (
    <Modal title="Add supplier" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        {error && <FormError message={error} />}
        <Field label="Supplier / unit name *"><input required autoFocus className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Contact person"><input className="input-field" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field><Field label="Phone"><input type="tel" className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>
        <div className="grid grid-cols-2 gap-3"><Field label="Email"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="GSTIN"><input maxLength={15} className="input-field uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field></div>
        <Field label="Address"><textarea rows={2} className="input-field resize-none" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <FormActions saving={saving} onClose={onClose} submitLabel="Save supplier" />
      </form>
    </Modal>
  );
}

function StageFormModal({ orderId, stage, onClose, onSaved }: { orderId: string; stage: ProductionStage; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const meta = STAGE_META[stage.type];
  const [form, setForm] = useState({ status: stage.status, partnerName: stage.partnerName ?? '', dcNumber: stage.dcNumber ?? '', plannedQty: String(stage.plannedQty), issuedQty: String(stage.issuedQty), completedQty: String(stage.completedQty), rejectedQty: String(stage.rejectedQty), rate: String(stage.rate), otherCost: String(stage.otherCost), startDate: dateInput(stage.startDate), dueDate: dateInput(stage.dueDate), notes: stage.notes ?? '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try {
      const { data } = await api.patch<ProductionOrder>(`/production-orders/${orderId}/stages/${stage.id}`, {
        ...form,
        plannedQty: Number(form.plannedQty), issuedQty: Number(form.issuedQty), completedQty: Number(form.completedQty), rejectedQty: Number(form.rejectedQty), rate: Number(form.rate), otherCost: Number(form.otherCost),
        partnerName: form.partnerName.trim() || undefined, dcNumber: form.dcNumber.trim() || undefined, startDate: form.startDate || undefined, dueDate: form.dueDate || undefined, notes: form.notes.trim() || undefined,
      });
      onSaved(data);
    } catch (saveError: unknown) { setError(getApiError(saveError, `Could not update ${meta.label.toLowerCase()}.`)); } finally { setSaving(false); }
  }
  return (
    <Modal title={`Update ${meta.label}`} onClose={onClose} size="lg">
      <form onSubmit={submit} className="space-y-4">
        {error && <FormError message={error} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Status"><select className="input-field" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProductionStage['status'] })}><option value="PENDING">Pending</option><option value="IN_PROGRESS">In progress</option><option value="COMPLETED">Completed</option></select></Field>
          <Field label="Processing unit / master"><input className="input-field" placeholder="Unit or worker name" value={form.partnerName} onChange={(e) => setForm({ ...form, partnerName: e.target.value })} /></Field>
          <Field label="DC number"><input className="input-field" placeholder="DC-001" value={form.dcNumber} onChange={(e) => setForm({ ...form, dcNumber: e.target.value })} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Planned qty" value={form.plannedQty} onChange={(value) => setForm({ ...form, plannedQty: value })} />
          <NumberField label="Issued qty" value={form.issuedQty} onChange={(value) => setForm({ ...form, issuedQty: value })} />
          <NumberField label="Completed qty" value={form.completedQty} onChange={(value) => setForm({ ...form, completedQty: value })} />
          <NumberField label="Rejected qty" value={form.rejectedQty} onChange={(value) => setForm({ ...form, rejectedQty: value })} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <NumberField label="Rate / piece" value={form.rate} step="0.01" onChange={(value) => setForm({ ...form, rate: value })} />
          <NumberField label="Other cost" value={form.otherCost} step="0.01" onChange={(value) => setForm({ ...form, otherCost: value })} />
          <Field label="Start date"><input type="date" className="input-field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        </div>
        <Field label="Stage notes"><textarea rows={2} className="input-field resize-none" placeholder="Colour, artwork, measurement or quality notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Calculated stage cost: <strong className="text-slate-950">{formatCurrency(Math.max(Number(form.issuedQty), Number(form.completedQty)) * Number(form.rate) + Number(form.otherCost))}</strong></div>
        <FormActions saving={saving} onClose={onClose} submitLabel="Update stage" />
      </form>
    </Modal>
  );
}

function CostFormModal({ orderId, suppliers, onClose, onSaved }: { orderId: string; suppliers: Supplier[]; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const [form, setForm] = useState({ category: 'FABRIC' as ProductionCostCategory, description: '', supplierId: '', quantity: '1', rate: '', paidAmount: '0', notes: '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  const amount = Number(form.quantity) * Number(form.rate);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError('');
    try {
      const { data } = await api.post<ProductionOrder>(`/production-orders/${orderId}/costs`, { ...form, supplierId: form.supplierId || undefined, quantity: Number(form.quantity), rate: Number(form.rate), paidAmount: Number(form.paidAmount), notes: form.notes.trim() || undefined });
      onSaved(data);
    } catch (saveError: unknown) { setError(getApiError(saveError, 'Could not add production cost.')); } finally { setSaving(false); }
  }
  return (
    <Modal title="Add material cost" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3.5">
        {error && <FormError message={error} />}
        <div className="grid grid-cols-2 gap-3"><Field label="Category"><select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductionCostCategory })}>{COST_CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}</select></Field><Field label="Supplier"><select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field></div>
        <Field label="Description *"><input required autoFocus className="input-field" placeholder="Navy Airtex fabric" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid grid-cols-3 gap-3"><NumberField label="Quantity" value={form.quantity} step="0.001" onChange={(value) => setForm({ ...form, quantity: value })} /><NumberField label="Rate" value={form.rate} step="0.01" onChange={(value) => setForm({ ...form, rate: value })} /><NumberField label="Paid" value={form.paidAmount} step="0.01" onChange={(value) => setForm({ ...form, paidAmount: value })} /></div>
        <div className="rounded-lg bg-blue-50 px-3 py-2.5 text-xs text-blue-800">Total amount <strong className="float-right text-sm">{formatCurrency(amount)}</strong></div>
        <Field label="Notes"><textarea rows={2} className="input-field resize-none" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <FormActions saving={saving} onClose={onClose} submitLabel="Add cost" />
      </form>
    </Modal>
  );
}

function FormSection({ title, icon: Icon, trailing, children }: { title: string; icon: typeof Factory; trailing?: React.ReactNode; children: React.ReactNode }) {
  return <fieldset className="rounded-xl border border-slate-200 p-3.5"><legend className="px-1.5"><span className="flex items-center gap-2 text-xs font-bold text-slate-800"><Icon aria-hidden="true" size={15} className="text-blue-600" />{title}{trailing}</span></legend>{children}</fieldset>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="label">{label}</span>{children}</label>;
}

function NumberField({ label, value, step = '1', onChange }: { label: string; value: string; step?: string; onChange: (value: string) => void }) {
  return <Field label={label}><input type="number" min="0" step={step} required className="input-field" value={value} onChange={(event) => onChange(event.target.value)} /></Field>;
}

function FormActions({ saving, onClose, submitLabel }: { saving: boolean; onClose: () => void; submitLabel: string }) {
  return <div className="flex justify-end gap-2 pt-1"><button type="button" onClick={onClose} className="btn-secondary">Cancel</button><button type="submit" disabled={saving} className="btn-primary min-w-28">{saving ? 'Saving...' : submitLabel}</button></div>;
}

function FormError({ message }: { message: string }) {
  return <div role="alert" className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{message}</div>;
}

function labelize(value: string) {
  return value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateInput(value?: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}
