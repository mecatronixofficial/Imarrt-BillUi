'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Search,
  ImagePlus,
  Scissors,
  Shirt,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import StatusBadge from '@/components/StatusBadge';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
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
  MASTER: { label: 'Master', shortLabel: 'Master', icon: Users, accent: 'text-slate-700 bg-slate-100' },
  FABRIC_PURCHASE: { label: 'Fabric purchase', shortLabel: 'Fabric', icon: Boxes, accent: 'text-indigo-700 bg-indigo-50' },
  WASHING_COMPACTING: { label: 'Washing / compacting', shortLabel: 'Wash', icon: Factory, accent: 'text-cyan-700 bg-cyan-50' },
  CUTTING: { label: 'Cutting', shortLabel: 'Cut', icon: Scissors, accent: 'text-blue-600 bg-blue-50' },
  PRINT_EMBROIDERY: { label: 'Print / Embroidery DC', shortLabel: 'Print & Emb', icon: Palette, accent: 'text-violet-600 bg-violet-50' },
  STITCHING: { label: 'Stitching', shortLabel: 'Stitch', icon: Shirt, accent: 'text-amber-600 bg-amber-50' },
  PACKING: { label: 'Packing', shortLabel: 'Pack', icon: PackageCheck, accent: 'text-emerald-600 bg-emerald-50' },
  FINAL: { label: 'Final total / delivery', shortLabel: 'Final', icon: Check, accent: 'text-teal-700 bg-teal-50' },
};

const PRODUCTION_PIPELINE: ProductionStageType[] = ['MASTER', 'FABRIC_PURCHASE', 'WASHING_COMPACTING', 'CUTTING', 'PRINT_EMBROIDERY', 'STITCHING', 'PACKING', 'FINAL'];

function sortProductionStages(stages: ProductionStage[]) {
  return [...stages].sort(
    (left, right) => left.sequence - right.sequence,
  );
}

function getNextProductionStage(stages: ProductionStage[], currentType: ProductionStageType) {
  const ordered = sortProductionStages(stages);
  const nextType = ordered[ordered.findIndex((stage) => stage.type === currentType) + 1]?.type;
  return nextType ? stages.find((stage) => stage.type === nextType) : undefined;
}

const COST_CATEGORIES: ProductionCostCategory[] = [
  'FABRIC', 'COLLAR_RIB', 'ACCESSORIES', 'LABELS', 'TAGS', 'POLY_BAGS', 'BUTTONS', 'CARTONS', 'TRANSPORT', 'OTHER',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL'];

export function ProductionWorkspace({ orderId }: { orderId?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingMaster, setEditingMaster] = useState<ProductionOrder | null>(null);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [editingStage, setEditingStage] = useState<ProductionStage | null>(null);
  const [showCostForm, setShowCostForm] = useState(false);
  const [actionError, setActionError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [masterSupported, setMasterSupported] = useState(false);
  const [canDeleteOrder, setCanDeleteOrder] = useState(false);
  const [confirmDeleteOrder, setConfirmDeleteOrder] = useState<ProductionOrder | null>(null);
  const [confirmDeleteCostId, setConfirmDeleteCostId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void api.get<{ masterVersion: number }>('/production-orders/capabilities').then(({ data }) => {
      if (active) setMasterSupported(data.masterVersion >= 2);
    }).catch(() => { if (active) setMasterSupported(false); });
    void getCurrentUser().then((user) => {
      if (active) setCanDeleteOrder(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN');
    }).catch(() => { if (active) setCanDeleteOrder(false); });
    return () => { active = false; };
  }, []);

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
      const requestedOrderId = orderId ?? searchParams.get('orderId');
      setSelectedId(requestedOrderId && production.some(({ id }) => id === requestedOrderId) ? requestedOrderId : '');
    } catch (loadError: unknown) {
      setError(getApiError(loadError, 'Could not load production workspace.'));
    } finally {
      setLoading(false);
    }
  }, [orderId, searchParams]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const linkedOrderId = searchParams.get('orderId');
    if (!orderId && linkedOrderId) router.replace(`/production/${linkedOrderId}`);
  }, [orderId, router, searchParams]);

  const selectedOrder = orders.find(({ id }) => id === selectedId);
  const stats = useMemo(() => {
    const active = orders.filter(({ status }) => !['DRAFT', 'COMPLETED', 'CANCELLED'].includes(status));
    return {
      active: active.length,
      pieces: active.reduce((total, order) => total + order.orderedQty, 0),
      cost: orders.reduce((total, order) => total + order.summary.totalMakingCost, 0),
      profit: orders.filter(({ status }) => status !== 'DRAFT').reduce((total, order) => total + order.summary.profit, 0),
    };
  }, [orders]);

  function applyUpdatedOrder(updated: ProductionOrder) {
    setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
  }

  function requestDeleteOrder(order: ProductionOrder) {
    if (deletingId || !canDeleteOrder) return;
    setConfirmDeleteOrder(order);
  }

  async function performDeleteOrder() {
    const order = confirmDeleteOrder;
    if (!order || deletingId) return;
    setDeletingId(order.id);
    setActionError('');
    try {
      await api.delete(`/production-orders/${order.id}`);
      setOrders((current) => current.filter((entry) => entry.id !== order.id));
      if (selectedId === order.id) setSelectedId('');
      setConfirmDeleteOrder(null);
      if (orderId) router.push('/production');
    } catch (deleteError) {
      setActionError(getApiError(deleteError, 'Could not delete production order.'));
      setConfirmDeleteOrder(null);
    } finally {
      setDeletingId('');
    }
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

  function requestRemoveCost(costId: string) {
    if (!selectedOrder) return;
    setConfirmDeleteCostId(costId);
  }

  async function performRemoveCost() {
    const costId = confirmDeleteCostId;
    if (!selectedOrder || !costId) return;
    setActionError('');
    try {
      const { data } = await api.delete<ProductionOrder>(`/production-orders/${selectedOrder.id}/costs/${costId}`);
      applyUpdatedOrder(data);
    } catch (removeError: unknown) {
      setActionError(getApiError(removeError, 'Could not remove cost.'));
    } finally {
      setConfirmDeleteCostId(null);
    }
  }

  async function confirmOrder(confirmedAt: string) {
    if (!selectedOrder || updatingStatus) return;
    setUpdatingStatus(true); setActionError('');
    try {
      const { data } = await api.patch<ProductionOrder>(`/production-orders/${selectedOrder.id}/confirm`, { confirmedAt });
      applyUpdatedOrder(data);
    } catch (confirmError) { setActionError(getApiError(confirmError, 'Could not confirm order.')); }
    finally { setUpdatingStatus(false); }
  }

  return (
  <>
    <div className="min-w-0 bg-slate-50/70">
      <section className="mb-5 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          {orderId && <Link href="/production" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700">Back to all orders</Link>}
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">Production</p>
          <h1 className="mt-1 text-xl font-extrabold text-slate-950 sm:text-2xl">{orderId ? selectedOrder?.orderNumber ?? 'Order details' : 'Production orders'}</h1>
          <p className="mt-1 text-xs text-slate-500">{orderId ? 'Order information, stages and costs' : `${orders.length} total orders · ${stats.active} active`}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!orderId && <button type="button" onClick={() => setShowSupplierForm(true)} className="btn-secondary inline-flex items-center gap-2"><Building2 size={15} /> Add supplier</button>}
          <button type="button" onClick={() => setShowOrderForm(true)} className="btn-primary inline-flex items-center gap-2"><Plus size={15} /> New order</button>
        </div>
      </section>
      {loading ? (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <LoadingState label="Loading production orders..." />
        </section>
      ) : error ? (
        <section className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
          <ErrorState
            message={error}
            onRetry={loadData}
          />
        </section>
      ) : orders.length === 0 ? (
        /* Empty */
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
          <EmptyState
            icon={Factory}
            title="No production orders yet"
            description="Create your first order to start the production workflow."
          />

          <div className="flex justify-center pb-6">
            <button
              type="button"
              onClick={() => setShowOrderForm(true)}
              className="
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
                shadow-[0_8px_20px_rgba(37,99,235,0.22)]
                transition-all
                duration-300
                hover:-translate-y-0.5
                hover:bg-blue-700
                hover:shadow-[0_12px_26px_rgba(37,99,235,0.28)]
              "
            >
              <Plus size={14} />
              Create First Order
            </button>
          </div>
        </section>
      ) : (
        <section className="min-w-0">
          {orderId ? (
            selectedOrder ? (
              <OrderDetail
                order={selectedOrder}
                error={actionError}
                updatingStatus={updatingStatus}
                onEditStage={setEditingStage}
                onAddCost={() => setShowCostForm(true)}
                onRemoveCost={requestRemoveCost}
                onChangeStatus={(status) => void changeStatus(status)}
                onUpdated={applyUpdatedOrder}
                onConfirm={(date) => void confirmOrder(date)}
                onEditMaster={() => setEditingMaster(selectedOrder)}
                onDelete={() => requestDeleteOrder(selectedOrder)}
                deleting={deletingId === selectedOrder.id}
                canDelete={canDeleteOrder}
              />
            ) : <ErrorState message="Production order not found." onRetry={loadData} />
          ) : (
            <OrderList orders={orders} onSelect={(id) => router.push(`/production/${id}`)} onEdit={setEditingMaster} onDelete={requestDeleteOrder} deletingId={deletingId} error={actionError} canDelete={canDeleteOrder} />
          )}
        </section>
      )}
    </div>

    {/* ============================================================ */}
    {/* MODALS                                                       */}
    {/* ============================================================ */}

    {showOrderForm && (
      masterSupported ? <MasterOrderForm
        parties={parties}
        suppliers={suppliers}
        onClose={() => setShowOrderForm(false)}
        onSaved={(order) => { setOrders((current) => [order, ...current]); setSelectedId(order.id); setShowOrderForm(false); router.push(`/production/${order.id}`); }}
      /> : <OrderFormModal
        parties={parties}
        suppliers={suppliers}
        onClose={() =>
          setShowOrderForm(false)
        }
        onSaved={(order) => {
          setOrders((current) => [
            order,
            ...current,
          ]);

          setSelectedId(order.id);
          setShowOrderForm(false);
          router.push(`/production/${order.id}`);
        }}
      />
    )}

    {editingMaster && <MasterOrderForm
      parties={parties}
      suppliers={suppliers}
      initialOrder={editingMaster}
      onClose={() => setEditingMaster(null)}
      onSaved={(order) => { applyUpdatedOrder(order); setEditingMaster(null); }}
    />}

    {showSupplierForm && (
      <SupplierFormModal
        onClose={() =>
          setShowSupplierForm(false)
        }
        onSaved={(supplier) => {
          setSuppliers((current) =>
            [...current, supplier].sort(
              (a, b) =>
                a.name.localeCompare(
                  b.name,
                ),
            ),
          );

          setShowSupplierForm(false);
        }}
      />
    )}

    {editingStage &&
      selectedOrder && (
        <StageFormModal
          orderId={selectedOrder.id}
          stage={editingStage}
          nextStage={getNextProductionStage(
            selectedOrder.stages,
            editingStage.type,
          )}
          onClose={() =>
            setEditingStage(null)
          }
          onSaved={(order) => {
            applyUpdatedOrder(order);
            setEditingStage(null);
          }}
        />
      )}

    {showCostForm &&
      selectedOrder && (
        <CostFormModal
          orderId={selectedOrder.id}
          suppliers={suppliers}
          onClose={() =>
            setShowCostForm(false)
          }
          onSaved={(order) => {
            applyUpdatedOrder(order);
            setShowCostForm(false);
          }}
        />
      )}

    {confirmDeleteOrder && (
      <ConfirmDialog
        title="Delete production order?"
        message={`Delete production order ${confirmDeleteOrder.orderNumber} and all its stages, costs and images? This cannot be undone.`}
        confirmLabel="Delete"
        busy={deletingId === confirmDeleteOrder.id}
        onCancel={() => setConfirmDeleteOrder(null)}
        onConfirm={() => void performDeleteOrder()}
      />
    )}

    {confirmDeleteCostId && (
      <ConfirmDialog
        title="Remove cost entry?"
        message="This cost entry will be permanently removed from the order."
        confirmLabel="Remove"
        onCancel={() => setConfirmDeleteCostId(null)}
        onConfirm={() => void performRemoveCost()}
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

function OrderList({ orders, onSelect, onEdit, onDelete, deletingId, error, canDelete }: { orders: ProductionOrder[]; onSelect: (id: string) => void; onEdit: (order: ProductionOrder) => void; onDelete: (order: ProductionOrder) => void; deletingId: string; error: string; canDelete: boolean }) {
  const [query, setQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('ALL');
  const availableStages = PRODUCTION_PIPELINE.filter((type) => orders.some((order) => order.stages.some((stage) => stage.type === type)));
  const currentStage = (order: ProductionOrder): ProductionStageType | 'DRAFT' | 'DELIVERED' | 'CANCELLED' => {
    if (order.status === 'DRAFT') return 'DRAFT';
    if (order.status === 'COMPLETED' || order.status === 'DISPATCHED') return 'DELIVERED';
    if (order.status === 'CANCELLED') return 'CANCELLED';
    return sortProductionStages(order.stages).find((stage) => stage.status === 'IN_PROGRESS')?.type
      ?? sortProductionStages(order.stages).find((stage) => stage.status === 'PENDING')?.type
      ?? 'FINAL';
  };
  const matchingOrders = orders.filter((order) => {
    const term = query.trim().toLowerCase();
    return (!term || [order.orderNumber, order.styleName, order.party?.name, order.supplier?.name].some((value) => value?.toLowerCase().includes(term)))
      && (stageFilter === 'ALL' || stageFilter === currentStage(order));
  });
  return (
    <section className="min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">Orders</h2>
          <p className="mt-1 text-xs text-slate-500">{matchingOrders.length} of {orders.length} orders</p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <div className="relative sm:w-72">
            <Search aria-hidden="true" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input aria-label="Find production order" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search order, style or customer" className="input-field w-full pl-9" />
          </div>
          <select aria-label="Filter current process" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="input-field sm:w-48">
            <option value="ALL">All processes</option>
            {orders.some((order) => order.status === 'DRAFT') && <option value="DRAFT">Draft master</option>}
            {availableStages.map((type) => <option key={type} value={type}>{STAGE_META[type].label}</option>)}
          </select>
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      {matchingOrders.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No orders match your search.</div> : (
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {matchingOrders.map((order) => {
            const stage = currentStage(order);
            const processName = stage === 'DRAFT' ? 'Draft master' : stage === 'DELIVERED' ? 'Delivered' : stage === 'CANCELLED' ? 'Cancelled' : STAGE_META[stage].label;
            return <article key={order.id} className="group min-w-0 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-300 hover:shadow-md">
              <button type="button" onClick={() => onSelect(order.id)} className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label={`View details for ${order.orderNumber}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-950">{order.orderNumber}</p>
                  <p className="mt-1 truncate text-xs text-slate-500">{order.party.name} · {order.styleName}</p>
                </div>
                <StatusBadge status={order.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 border-y border-slate-100 py-3">
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Delivery date</p><p className="mt-1 text-xs font-semibold text-slate-800">{order.dueDate ? formatDate(order.dueDate) : 'Not set'}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Cost so far</p><p className="mt-1 text-xs font-semibold text-slate-800">{formatCurrency(order.summary.totalMakingCost)}</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Quantity</p><p className="mt-1 text-xs font-semibold text-slate-800">{order.orderedQty.toLocaleString('en-IN')} pieces</p></div>
                <div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Current process</p><p className="mt-1 text-xs font-semibold text-blue-700">{processName}</p></div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">{order.summary.progressPercent}% complete</span>
                <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600">Full details <ArrowRight size={14} className="transition group-hover:translate-x-1" /></span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min(order.summary.progressPercent, 100)}%` }} /></div>
              </button>
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                <button type="button" onClick={() => onEdit(order)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"><Pencil size={13} /> Edit</button>
                {canDelete && <button type="button" disabled={deletingId === order.id} onClick={() => onDelete(order)} className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 size={13} /> {deletingId === order.id ? 'Deleting...' : 'Delete'}</button>}
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
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
  onUpdated,
  onConfirm,
  onEditMaster,
  onDelete,
  deleting,
  canDelete,
}: {
  order: ProductionOrder;
  error: string;
  updatingStatus: boolean;
  onEditStage: (stage: ProductionStage) => void;
  onAddCost: () => void;
  onRemoveCost: (id: string) => void;
  onChangeStatus: (status: ProductionOrderStatus) => void;
  onUpdated: (order: ProductionOrder) => void;
  onConfirm: (date: string) => void;
  onEditMaster: () => void;
  onDelete: () => void;
  deleting: boolean;
  canDelete: boolean;
}) {
  const nextAction = order.status === 'READY' ? { label: 'Mark dispatched', status: 'DISPATCHED' as const } : order.status === 'DISPATCHED' ? { label: 'Complete order', status: 'COMPLETED' as const } : null;
  const [confirmDate, setConfirmDate] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10));
  const stages = sortProductionStages(order.stages);
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
            <div className="flex flex-wrap items-center gap-2">
              {order.status === 'DRAFT' && <label className="text-[10px] text-slate-300">Confirm date<input type="date" aria-label="Confirmation date" value={confirmDate} onChange={(event) => setConfirmDate(event.target.value)} className="mt-1 block rounded-lg border border-white/20 bg-slate-900 px-2 py-1.5 text-xs text-white" /></label>}
              <button type="button" onClick={onEditMaster} className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3.5 py-2 text-xs font-bold text-white hover:bg-white/10"><Pencil aria-hidden="true" size={14} />Edit order</button>
              {canDelete && <button type="button" disabled={deleting} onClick={onDelete} className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 px-3.5 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-50"><Trash2 aria-hidden="true" size={14} />{deleting ? 'Deleting...' : 'Delete'}</button>}
              {order.status === 'DRAFT' && <button type="button" disabled={updatingStatus || !confirmDate} onClick={() => onConfirm(confirmDate)} className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-500 disabled:opacity-60">Confirm order <ArrowRight aria-hidden="true" size={15} /></button>}
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

      <MasterDetails order={order} />
      {order.images && <ProductionImages order={order} onUpdated={onUpdated} />}
      {order.status !== 'DRAFT' && <>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
  {/* Header */}
  <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
    <div>
      <h3 className="text-sm font-extrabold text-slate-950">
        Production Workflow
      </h3>

      <p className="mt-1 text-[11px] text-slate-500">
        Update DC, quantity, unit and cost at every stage.
      </p>
    </div>

    <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2">
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">
          Overall Progress
        </p>

        <p className="text-sm font-black text-blue-700">
          {order.summary.progressPercent}%
        </p>
      </div>

      <div className="h-2 w-20 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all duration-500"
          style={{
            width: `${Math.min(
              order.summary.progressPercent,
              100,
            )}%`,
          }}
        />
      </div>
    </div>
  </div>

  {/* Workflow Cards */}
  <div className="p-4 sm:p-5">
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5">
      <span className="mr-1 text-[10px] font-bold uppercase tracking-wider text-blue-500">Good quantity flow</span>
      {stages.map((stage, index) => (
        <div key={`flow-${stage.id}`} className="flex items-center gap-2">
          {index > 0 && <ArrowRight aria-hidden="true" size={13} className="text-blue-300" />}
          <span className={clsx('rounded-lg border px-2 py-1 text-[10px] font-bold', stage.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : stage.status === 'IN_PROGRESS' ? 'border-blue-200 bg-white text-blue-700' : 'border-slate-200 bg-white text-slate-500')}>
            {STAGE_META[stage.type].shortLabel} · {stage.issuedQty} pcs
          </span>
        </div>
      ))}
      <span className="ml-auto text-[10px] text-slate-500">Rejected pieces do not move forward.</span>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {stages.map((stage, index) => {
        const nextStage = stages[index + 1];
        return (
        <div
          key={stage.id}
          className="
            group
            relative
            overflow-hidden
            rounded-2xl
            border
            border-slate-200
            bg-gradient-to-br
            from-white
            to-slate-50/70
            p-2
            shadow-[0_4px_15px_rgba(15,23,42,0.04)]
            transition-all
            duration-300
            hover:-translate-y-1
            hover:border-blue-200
            hover:bg-blue-50/40
            hover:shadow-[0_15px_35px_rgba(15,23,42,0.10)]
          "
        >
          {/* Stage Number */}
          <div className="mb-2 flex items-center justify-between px-1 pt-1">
            <div className="flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-2 text-[10px] font-black text-white transition-colors group-hover:bg-blue-600">
              {String(index + 1).padStart(2, "0")}
            </div>

            <button
              type="button"
              onClick={() => onEditStage(stage)}
              className="
                rounded-lg
                bg-blue-600
                px-3
                py-1.5
                text-[10px]
                font-bold
                text-white
                shadow-sm
                transition-all
                hover:bg-blue-700
                hover:shadow-md
                active:scale-95
              "
            >
              Edit
            </button>
          </div>

          {/* Existing Stage Card */}
          <StageCard
            stage={stage}
            onEdit={() => onEditStage(stage)}
          />

          {stage.status === 'COMPLETED' && nextStage && (
            <div className="mx-1 mt-2 rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-2 text-[10px] font-semibold text-emerald-700">
              {stage.completedQty.toLocaleString('en-IN')} good pcs issued to {STAGE_META[nextStage.type].label}
            </div>
          )}

          {/* Hover bottom line */}
          <div className="absolute bottom-0 left-0 h-[3px] w-0 bg-blue-600 transition-all duration-300 group-hover:w-full" />
        </div>
        );
      })}
    </div>
  </div>
</section>

      <section className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="card overflow-hidden">
          <div className="flex flex-col items-start gap-2 border-b border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div><h3 className="text-sm font-bold text-slate-950">Material & accessory costing</h3><p className="text-[11px] text-slate-500">Fabric, trims, labels, packing and transport.</p></div>
            <button type="button" onClick={onAddCost} className="btn-secondary inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"><Plus aria-hidden="true" size={14} /> Add cost</button>
          </div>
          {order.costs.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-slate-500">No material costs added yet.</div>
          ) : (
            <>
            <div className="divide-y divide-slate-100 md:hidden">
              {order.costs.map((cost) => (
                <div key={cost.id} className="p-4">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0"><p className="break-words text-xs font-semibold text-slate-800">{cost.description}</p><p className="mt-0.5 text-[10px] text-slate-400">{labelize(cost.category)}</p></div>
                    <button type="button" onClick={() => onRemoveCost(cost.id)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${cost.description}`}><Trash2 aria-hidden="true" size={14} /></button>
                  </div>
                  <p className="mt-2 truncate text-[11px] text-slate-500">{cost.supplier?.name || 'No supplier'}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs"><span className="text-slate-500">{Number(cost.quantity).toLocaleString('en-IN')} × {formatCurrency(cost.rate)}</span><strong className="text-slate-900">{formatCurrency(cost.amount)}</strong></div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
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
            </>
          )}
        </div>
        <CostSummary order={order} />
      </section>
      </>}
    </div>
  );
}

function MasterDetails({ order }: { order: ProductionOrder }) {
  if (!order.orderDate && !order.sizeColorBreakdown && !order.instructions) return null;
  const supplierEstimate = order.orderedQty * Number(order.supplierRate ?? 0);
  return <section className="card space-y-4 p-4 sm:p-5">
    <div><h3 className="text-sm font-bold text-slate-900">Order master</h3><p className="text-xs text-slate-500">{order.status === 'DRAFT' ? 'Review this draft before confirming production.' : 'Customer and supplier order details.'}</p></div>
    <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-slate-400">Order date</p><strong>{formatDate(order.orderDate)}</strong></div><div><p className="text-slate-400">Confirmed</p><strong>{order.confirmedAt ? formatDate(order.confirmedAt) : 'Pending'}</strong></div><div><p className="text-slate-400">Transport</p><strong className="break-words">{order.transport || '—'}</strong></div><div><p className="text-slate-400">Destination</p><strong className="break-words">{order.destination || '—'}</strong></div></div>
    {order.invoiceDetails && <p className="text-xs text-slate-600"><strong>Invoice details:</strong> {order.invoiceDetails}</p>}
    <div className="grid gap-2 rounded-xl bg-blue-50 p-3 text-xs sm:grid-cols-3"><p>Customer estimate <strong className="block text-blue-900">{formatCurrency(order.summary.revenue)}</strong></p><p>Supplier estimate <strong className="block text-blue-900">{formatCurrency(supplierEstimate)}</strong></p><p>Estimated spread <strong className="block text-blue-900">{formatCurrency(order.summary.revenue - supplierEstimate)}</strong></p></div>
    {order.sizeColorBreakdown && <div><h4 className="text-xs font-bold text-slate-800">Color × size quantities</h4><div className="mt-2 space-y-2">{Object.entries(order.sizeColorBreakdown).map(([color, sizes]) => <div key={color} className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-2 text-xs"><strong className="min-w-20 text-slate-800">{color}</strong>{Object.entries(sizes).filter(([, qty]) => qty > 0).map(([size, qty]) => <span key={size} className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{size}: {qty}</span>)}<span className="ml-auto font-bold text-blue-700">{Object.values(sizes).reduce((sum, qty) => sum + qty, 0)} pcs</span></div>)}</div></div>}
    {order.instructions && <div className="grid gap-3 sm:grid-cols-3">{(['product', 'accessories', 'packing'] as const).map((group) => <div key={group} className="rounded-xl bg-slate-50 p-3"><h4 className="text-xs font-bold capitalize text-slate-800">{group === 'product' ? 'Product details' : group}</h4>{(order.instructions?.[group] ?? []).map((item, index) => <p key={index} className="mt-2 text-[11px] text-slate-600"><strong>{item.item}</strong>: {item.detail}</p>)}</div>)}</div>}
  </section>;
}

function ProductionImages({ order, onUpdated }: { order: ProductionOrder; onUpdated: (order: ProductionOrder) => void }) {
  const [stageType, setStageType] = useState<ProductionStageType>('MASTER');
  const [imageMeta, setImageMeta] = useState({ displayName: '', color: '', sizeLabel: '', details: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    void Promise.all((order.images ?? []).map(async (image) => {
      const response = await api.get<Blob>(`/production-orders/${order.id}/images/${image.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      urls.push(url);
      return [image.id, url] as const;
    })).then((entries) => { if (active) setPreviews(Object.fromEntries(entries)); }).catch(() => { if (active) setError('Could not load an image preview.'); });
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [order.id, order.images]);

  async function upload(file?: File) {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG, or WEBP image under 5 MB.');
      return;
    }
    setBusy(true); setError('');
    try {
      const body = new FormData();
      body.append('image', file);
      body.append('stageType', stageType);
      Object.entries(imageMeta).forEach(([key, value]) => { if (value.trim()) body.append(key, value.trim()); });
      await api.post(`/production-orders/${order.id}/images`, body, { headers: { 'Content-Type': undefined } });
      const { data } = await api.get<ProductionOrder>(`/production-orders/${order.id}`);
      onUpdated(data);
    } catch (uploadError) { setError(getApiError(uploadError, 'Could not upload image.')); }
    finally { setBusy(false); }
  }

  async function remove(imageId: string) {
    setBusy(true); setError('');
    try {
      await api.delete(`/production-orders/${order.id}/images/${imageId}`);
      const { data } = await api.get<ProductionOrder>(`/production-orders/${order.id}`);
      onUpdated(data);
    } catch (removeError) { setError(getApiError(removeError, 'Could not remove image.')); }
    finally { setBusy(false); }
  }

  return <section className="card min-w-0 p-4 sm:p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-900">Order and process images</h3><p className="text-[11px] text-slate-500">Upload fabric, artwork, work in progress, and finished goods.</p></div><ImagePlus aria-hidden="true" size={20} className="text-blue-600" /></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2"><Field label="Image name"><input className="input-field" value={imageMeta.displayName} onChange={(event) => setImageMeta({ ...imageMeta, displayName: event.target.value })} placeholder="Front design" /></Field><Field label="Color"><input className="input-field" value={imageMeta.color} onChange={(event) => setImageMeta({ ...imageMeta, color: event.target.value })} placeholder="White" /></Field><Field label="Size"><input className="input-field" value={imageMeta.sizeLabel} onChange={(event) => setImageMeta({ ...imageMeta, sizeLabel: event.target.value })} placeholder="XL" /></Field><Field label="Details"><input className="input-field" value={imageMeta.details} onChange={(event) => setImageMeta({ ...imageMeta, details: event.target.value })} placeholder="Print size and placement" /></Field></div>
    <div className="mt-3 flex flex-wrap gap-2"><select aria-label="Image process" className="input-field max-w-56" value={stageType} onChange={(event) => setStageType(event.target.value as ProductionStageType)}>{PRODUCTION_PIPELINE.map((type) => <option key={type} value={type}>{STAGE_META[type].label}</option>)}</select><label className="btn-secondary inline-flex cursor-pointer items-center gap-2"><ImagePlus aria-hidden="true" size={15} />{busy ? 'Uploading...' : 'Add image'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(event) => { void upload(event.target.files?.[0]); event.target.value = ''; }} /></label></div>
    {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
    <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {(order.images ?? []).map((image) => <div key={image.id} className="min-w-0 overflow-hidden rounded-xl border border-slate-200"><div className="aspect-square bg-slate-100">{previews[image.id] && <img src={previews[image.id]} alt={image.displayName || image.fileName} className="h-full w-full object-cover" />}</div><div className="p-2"><p className="truncate text-[10px] font-semibold text-slate-700" title={image.fileName}>{image.displayName || image.fileName}</p><p className="text-[9px] text-slate-400">{image.stageType ? STAGE_META[image.stageType].shortLabel : 'Order'} {image.color} {image.sizeLabel}</p>{image.details && <p className="mt-1 text-[10px] text-slate-500">{image.details}</p>}<button type="button" disabled={busy} onClick={() => void remove(image.id)} className="mt-1 text-[10px] font-semibold text-red-600">Remove</button></div></div>)}
    </div>
    {!order.images?.length && <p className="mt-3 text-xs text-slate-400">No images yet.</p>}
  </section>;
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 px-3.5 py-3"><span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">{label}</span><span className="mt-1 block truncate text-xs font-semibold text-slate-800" title={value}>{value}</span></div>;
}

function StageCard({ stage, onEdit }: { stage: ProductionStage; onEdit: () => void }) {
  const meta = STAGE_META[stage.type];
  const Icon = meta.icon;
  const chargeable = stage.rateUnit === 'KG' ? Number(stage.outputWeightKg || 0) : stage.completedQty + stage.rejectedQty;
  const cost = chargeable * Number(stage.rate) + Number(stage.otherCost);
  const perPiece = stage.completedQty ? cost / stage.completedQty : 0;
  return (
    <article className={clsx('relative overflow-hidden rounded-xl border p-3.5', stage.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200 bg-white')}>
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('flex h-9 w-9 items-center justify-center rounded-lg', meta.accent)}><Icon aria-hidden="true" size={17} /></span>
        <button type="button" onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-blue-600" aria-label={`Edit ${meta.label}`}><Pencil aria-hidden="true" size={14} /></button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2"><h4 className="text-xs font-bold text-slate-900">{meta.label}</h4><StatusBadge status={stage.status} /></div>
      <div className="mt-3 grid grid-cols-4 gap-1 text-center">
        <MiniStat label="Planned" value={stage.plannedQty} /><MiniStat label="Issued" value={stage.issuedQty} /><MiniStat label="Completed" value={stage.completedQty} /><MiniStat label="Rejected" value={stage.rejectedQty} />
      </div>
      {stage.rateUnit && <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
        <span>In: <strong>{stage.inputWeightKg ?? '—'} kg</strong></span><span>Out: <strong>{stage.outputWeightKg ?? '—'} kg</strong></span>
        <span>Rate: <strong>{formatCurrency(stage.rate)} / {stage.rateUnit === 'KG' ? 'kg' : 'pc'}</strong></span><span>Cost / pc: <strong>{formatCurrency(perPiece)}</strong></span>
        <span>Weight / pc: <strong>{stage.completedQty ? (Number(stage.outputWeightKg || 0) / stage.completedQty).toFixed(3) : '0.000'} kg</strong></span>
      </div>}
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
        <SummaryRow label="Selling price / piece" value={formatCurrency(order.saleRate)} />
        <SummaryRow label="Process cost" value={formatCurrency(summary.processCost)} />
        <SummaryRow label="Material & accessories" value={formatCurrency(summary.materialCost)} />
        <div className="my-3 border-t border-white/10" />
        <SummaryRow label="Total making cost" value={formatCurrency(summary.totalMakingCost)} strong />
        <SummaryRow label="Making cost / piece" value={formatCurrency(summary.costPerPiece)} />
        <SummaryRow label="Projected profit / piece" value={formatCurrency(order.orderedQty ? summary.profit / order.orderedQty : 0)} />
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

type MasterInstruction = { item: string; detail: string };
type InstructionGroup = 'product' | 'accessories' | 'packing';
const INSTRUCTION_OPTIONS: Record<InstructionGroup, string[]> = {
  product: ['Button', 'Collar', 'Pocket', 'Slit', 'Neck tape', 'Sleeve', 'Fabric'],
  accessories: ['Main label', 'Wash care label', 'Size label', 'Tag', 'Tissue paper'],
  packing: ['Fold', 'Poly bag', 'Insert card', 'Carton', 'Ironing', 'Rope'],
};

function MasterOrderForm({ parties, suppliers, initialOrder, onClose, onSaved }: { parties: Party[]; suppliers: Supplier[]; initialOrder?: ProductionOrder; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const quantityLocked = Boolean(initialOrder && initialOrder.status !== 'DRAFT');
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
  const defaultNumber = `PO-${today.replaceAll('-', '')}-${String(Date.now()).slice(-4)}`;
  const [form, setForm] = useState({ orderNumber: initialOrder?.orderNumber ?? defaultNumber, partyId: initialOrder?.party.id ?? parties[0]?.id ?? '', supplierId: initialOrder?.supplier?.id ?? '', orderDate: initialOrder?.orderDate ? dateInput(initialOrder.orderDate) : today, dueDate: initialOrder?.dueDate ? dateInput(initialOrder.dueDate) : '', invoiceDetails: initialOrder?.invoiceDetails ?? '', transport: initialOrder?.transport ?? '', destination: initialOrder?.destination ?? '', styleName: initialOrder?.styleName ?? '', fabricName: initialOrder?.fabricName ?? '', fabricGsm: initialOrder?.fabricGsm ?? '', saleRate: String(initialOrder?.saleRate ?? ''), supplierRate: String(initialOrder?.supplierRate ?? ''), notes: initialOrder?.notes ?? '' });
  const [colors, setColors] = useState<Array<{ color: string; sizes: Record<string, string> }>>(() => {
    const breakdown = initialOrder?.sizeColorBreakdown ?? (initialOrder?.sizeBreakdown ? { [initialOrder.color || 'Unspecified']: initialOrder.sizeBreakdown } : undefined);
    return breakdown ? Object.entries(breakdown).map(([color, sizes]) => ({ color, sizes: Object.fromEntries(SIZES.map((size) => [size, String(sizes[size] ?? '')])) })) : [{ color: '', sizes: Object.fromEntries(SIZES.map((size) => [size, ''])) }];
  });
  const [instructions, setInstructions] = useState<Record<InstructionGroup, MasterInstruction[]>>({ product: initialOrder?.instructions?.product ?? [{ item: 'Button', detail: '' }, { item: 'Collar', detail: '' }, { item: 'Pocket', detail: '' }], accessories: initialOrder?.instructions?.accessories ?? [{ item: 'Main label', detail: '' }, { item: 'Tag', detail: '' }], packing: initialOrder?.instructions?.packing ?? [{ item: 'Fold', detail: '' }, { item: 'Poly bag', detail: '' }, { item: 'Insert card', detail: '' }] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = colors.reduce((sum, row) => sum + Object.values(row.sizes).reduce((rowTotal, value) => rowTotal + (Number(value) || 0), 0), 0);
  const customerEstimate = total * Number(form.saleRate || 0);
  const supplierEstimate = total * Number(form.supplierRate || 0);

  function updateInstruction(group: InstructionGroup, index: number, key: keyof MasterInstruction, value: string) {
    setInstructions((current) => ({ ...current, [group]: current[group].map((entry, position) => position === index ? { ...entry, [key]: value } : entry) }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!form.partyId) { setError('Select a customer.'); return; }
    if (total <= 0) { setError('Enter at least one color and size quantity.'); return; }
    const usedColors = colors.filter((row) => Object.values(row.sizes).some((value) => Number(value) > 0));
    if (usedColors.some((row) => !row.color.trim()) || new Set(usedColors.map((row) => row.color.trim().toLowerCase())).size !== usedColors.length) { setError('Give each used color a unique name.'); return; }
    const sizeBreakdown = Object.fromEntries(SIZES.map((size) => [size, usedColors.reduce((sum, row) => sum + Number(row.sizes[size] || 0), 0)]).filter(([, value]) => Number(value) > 0));
    const sizeColorBreakdown = Object.fromEntries(usedColors.map((row) => [row.color.trim(), Object.fromEntries(Object.entries(row.sizes).filter(([, value]) => Number(value) > 0).map(([size, value]) => [size, Number(value)]))]));
    setSaving(true); setError('');
    try {
      const { data } = await (initialOrder ? api.patch<ProductionOrder>(`/production-orders/${initialOrder.id}/master`, {
        ...form, supplierId: form.supplierId || undefined, dueDate: form.dueDate || undefined,
        orderedQty: total, saleRate: Number(form.saleRate), supplierRate: Number(form.supplierRate || 0),
        sizeBreakdown, sizeColorBreakdown,
        instructions: Object.fromEntries((['product', 'accessories', 'packing'] as InstructionGroup[]).map((group) => [group, instructions[group].filter((entry) => entry.item.trim() && entry.detail.trim()).map((entry) => ({ item: entry.item.trim(), detail: entry.detail.trim() }))])),
      }) : api.post<ProductionOrder>('/production-orders', {
        ...form, supplierId: form.supplierId || undefined, dueDate: form.dueDate || undefined,
        orderedQty: total, saleRate: Number(form.saleRate), supplierRate: Number(form.supplierRate || 0),
        sizeBreakdown, sizeColorBreakdown,
        instructions: Object.fromEntries((['product', 'accessories', 'packing'] as InstructionGroup[]).map((group) => [group, instructions[group].filter((entry) => entry.item.trim() && entry.detail.trim()).map((entry) => ({ item: entry.item.trim(), detail: entry.detail.trim() }))])),
      }));
      onSaved(data);
    } catch (saveError) { setError(getApiError(saveError, 'Could not save production order.')); }
    finally { setSaving(false); }
  }

  return <Modal title={initialOrder ? 'Edit production order' : 'New production order master'} onClose={onClose} size="full">
    <form onSubmit={submit} className="space-y-5 pb-8">
      {error && <FormError message={error} />}
      <p className="rounded-xl bg-blue-50 px-4 py-3 text-xs text-blue-800">{quantityLocked ? 'Order quantity is locked after confirmation. You can update customer, delivery, style, prices and instructions.' : 'Save this order as a draft. Review the details and add images before confirming production.'}</p>
      <FormSection title="Order and delivery" icon={Factory}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Order number *"><input required className="input-field" value={form.orderNumber} onChange={(event) => setForm({ ...form, orderNumber: event.target.value })} /></Field>
          <Field label="Order date *"><input required type="date" className="input-field" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} /></Field>
          <Field label="Customer *"><select required className="input-field" value={form.partyId} onChange={(event) => setForm({ ...form, partyId: event.target.value })}><option value="">Select customer</option>{parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}</select></Field>
          <Field label="Supplier"><select className="input-field" value={form.supplierId} onChange={(event) => setForm({ ...form, supplierId: event.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field>
          <Field label="Delivery date"><input type="date" className="input-field" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></Field>
          <Field label="Transport"><input className="input-field" value={form.transport} onChange={(event) => setForm({ ...form, transport: event.target.value })} /></Field>
          <Field label="Destination"><input className="input-field" value={form.destination} onChange={(event) => setForm({ ...form, destination: event.target.value })} /></Field>
          <Field label="Invoice details"><input className="input-field" value={form.invoiceDetails} onChange={(event) => setForm({ ...form, invoiceDetails: event.target.value })} /></Field>
        </div>
      </FormSection>
      <FormSection title="Style and pricing" icon={Shirt}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Style / product *"><input required className="input-field" value={form.styleName} onChange={(event) => setForm({ ...form, styleName: event.target.value })} placeholder="Men's polo T-shirt" /></Field>
          <Field label="Fabric"><input className="input-field" value={form.fabricName} onChange={(event) => setForm({ ...form, fabricName: event.target.value })} placeholder="Airtex cotton" /></Field>
          <Field label="GSM / finish"><input className="input-field" value={form.fabricGsm} onChange={(event) => setForm({ ...form, fabricGsm: event.target.value })} /></Field>
          <Field label="Customer price / piece *"><input required type="number" min="0" step="0.01" className="input-field" value={form.saleRate} onChange={(event) => setForm({ ...form, saleRate: event.target.value })} /></Field>
          <Field label="Supplier price / piece"><input type="number" min="0" step="0.01" className="input-field" value={form.supplierRate} onChange={(event) => setForm({ ...form, supplierRate: event.target.value })} /></Field>
        </div>
      </FormSection>
      <FormSection title="Color and size quantities" icon={Palette} trailing={<span className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{total} pieces</span>}>
        <div className="space-y-3">{colors.map((row, index) => <div key={index} className="rounded-xl border border-slate-200 p-3"><div className="mb-3 flex items-center gap-2"><input aria-label={`Color ${index + 1}`} className="input-field max-w-52" placeholder="Color, e.g. White" value={row.color} onChange={(event) => setColors((current) => current.map((entry, position) => position === index ? { ...entry, color: event.target.value } : entry))} /><span className="text-xs font-bold text-slate-600">{Object.values(row.sizes).reduce((sum, value) => sum + Number(value || 0), 0)} pcs</span>{colors.length > 1 && <button type="button" className="ml-auto text-xs font-bold text-red-600" onClick={() => setColors((current) => current.filter((_, position) => position !== index))}>Remove</button>}</div><div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4 md:grid-cols-7">{SIZES.map((size) => <Field key={size} label={size}><input type="number" min="0" step="1" className="input-field px-2 text-center" value={row.sizes[size]} onChange={(event) => setColors((current) => current.map((entry, position) => position === index ? { ...entry, sizes: { ...entry.sizes, [size]: event.target.value } } : entry))} /></Field>)}</div></div>)}</div>
        <button type="button" className="btn-secondary mt-3 text-xs" onClick={() => setColors((current) => [...current, { color: '', sizes: Object.fromEntries(SIZES.map((size) => [size, ''])) }])}>Add color</button>
      </FormSection>
      <div className="grid gap-3 sm:grid-cols-3">{(['product', 'accessories', 'packing'] as InstructionGroup[]).map((group) => <FormSection key={group} title={group === 'product' ? 'Product details' : group === 'accessories' ? 'Accessories' : 'Packing'} icon={group === 'product' ? Shirt : group === 'accessories' ? PackageCheck : Boxes}><datalist id={`options-${group}`}>{INSTRUCTION_OPTIONS[group].map((item) => <option key={item} value={item} />)}</datalist><div className="space-y-2">{instructions[group].map((entry, index) => <div key={index} className="flex gap-2"><div className="min-w-0 flex-1 space-y-1"><input list={`options-${group}`} aria-label={`${group} item ${index + 1}`} className="input-field" placeholder="Select or enter item" value={entry.item} onChange={(event) => updateInstruction(group, index, 'item', event.target.value)} /><input aria-label={`${group} details ${index + 1}`} className="input-field" placeholder="Details" value={entry.detail} onChange={(event) => updateInstruction(group, index, 'detail', event.target.value)} /></div><button type="button" aria-label={`Remove ${group} item`} className="self-start text-red-600" onClick={() => setInstructions((current) => ({ ...current, [group]: current[group].filter((_, position) => position !== index) }))}><Trash2 size={15} /></button></div>)}</div><button type="button" className="mt-2 text-xs font-bold text-blue-600" onClick={() => setInstructions((current) => ({ ...current, [group]: [...current[group], { item: '', detail: '' }] }))}>+ Add item</button></FormSection>)}</div>
      <Field label="Additional notes"><textarea rows={2} className="input-field" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
      <div className="grid gap-3 rounded-xl bg-slate-950 p-4 text-xs text-white sm:grid-cols-3"><p>Customer estimate <strong className="block text-base">{formatCurrency(customerEstimate)}</strong></p><p>Supplier estimate <strong className="block text-base">{formatCurrency(supplierEstimate)}</strong></p><p>Estimated spread <strong className="block text-base">{formatCurrency(customerEstimate - supplierEstimate)}</strong></p></div>
      <FormActions saving={saving} onClose={onClose} submitLabel={initialOrder ? 'Save changes' : 'Save draft order'} />
    </form>
  </Modal>;
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
          <div className="grid grid-cols-2 gap-2 min-[400px]:grid-cols-4 sm:grid-cols-7">{SIZES.map((size) => <Field key={size} label={size}><input min="0" type="number" className="input-field px-2 text-center" value={sizes[size]} onChange={(e) => setSizes({ ...sizes, [size]: e.target.value })} /></Field>)}</div>
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
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Contact person"><input className="input-field" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} /></Field><Field label="Phone"><input type="tel" className="input-field" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Email"><input type="email" className="input-field" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field><Field label="GSTIN"><input maxLength={15} className="input-field uppercase" value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value.toUpperCase() })} /></Field></div>
        <Field label="Address"><textarea rows={2} className="input-field resize-none" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <FormActions saving={saving} onClose={onClose} submitLabel="Save supplier" />
      </form>
    </Modal>
  );
}

function StageFormModal({ orderId, stage, nextStage, onClose, onSaved }: { orderId: string; stage: ProductionStage; nextStage?: ProductionStage; onClose: () => void; onSaved: (order: ProductionOrder) => void }) {
  const meta = STAGE_META[stage.type];
  const [form, setForm] = useState({ status: stage.status, partnerName: stage.partnerName ?? '', dcNumber: stage.dcNumber ?? '', plannedQty: String(stage.plannedQty), issuedQty: String(stage.issuedQty), completedQty: String(stage.completedQty), rejectedQty: String(stage.rejectedQty), rate: String(stage.rate), otherCost: String(stage.otherCost), inputWeightKg: String(stage.inputWeightKg ?? ''), outputWeightKg: String(stage.outputWeightKg ?? ''), rateUnit: stage.rateUnit ?? 'PIECE', startDate: dateInput(stage.startDate), dueDate: dateInput(stage.dueDate), notes: stage.notes ?? '' });
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const issuedQty = Number(form.issuedQty);
    const completedQty = Number(form.completedQty);
    const rejectedQty = Number(form.rejectedQty);
    const accountedQty = completedQty + rejectedQty;
    if (issuedQty > Number(form.plannedQty)) {
      setError('Issued quantity cannot exceed the planned quantity.');
      return;
    }
    if (accountedQty > issuedQty) {
      setError('Completed and rejected quantities cannot exceed the issued quantity.');
      return;
    }
    if (form.status === 'COMPLETED' && accountedQty !== issuedQty) {
      setError('Completed and rejected quantities must equal the issued quantity before completing this stage.');
      return;
    }
    setSaving(true); setError('');
    try {
      const { data } = await api.patch<ProductionOrder>(`/production-orders/${orderId}/stages/${stage.id}`, {
        status: form.status,
        plannedQty: Number(form.plannedQty), issuedQty: Number(form.issuedQty), completedQty: Number(form.completedQty), rejectedQty: Number(form.rejectedQty), rate: Number(form.rate), otherCost: Number(form.otherCost),
        ...(stage.rateUnit && { inputWeightKg: form.inputWeightKg === '' ? undefined : Number(form.inputWeightKg), outputWeightKg: form.outputWeightKg === '' ? undefined : Number(form.outputWeightKg), rateUnit: form.rateUnit }),
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
        <div className="grid gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
          <NumberField label="Planned qty" value={form.plannedQty} onChange={(value) => setForm({ ...form, plannedQty: value })} />
          <NumberField label="Issued qty" value={form.issuedQty} onChange={(value) => setForm({ ...form, issuedQty: value })} />
          <NumberField label="Completed qty" value={form.completedQty} onChange={(value) => setForm({ ...form, completedQty: value })} />
          <NumberField label="Rejected qty" value={form.rejectedQty} onChange={(value) => setForm({ ...form, rejectedQty: value })} />
        </div>
        <div className="grid gap-3 min-[400px]:grid-cols-2 sm:grid-cols-4">
          <NumberField label={stage.rateUnit ? 'Process rate' : 'Rate / piece'} value={form.rate} step="0.01" onChange={(value) => setForm({ ...form, rate: value })} />
          <NumberField label="Other cost" value={form.otherCost} step="0.01" onChange={(value) => setForm({ ...form, otherCost: value })} />
          <Field label="Start date"><input type="date" className="input-field" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
          <Field label="Due date"><input type="date" className="input-field" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} /></Field>
        </div>
        {stage.rateUnit && <div className="grid gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3">
          <Field label="Input weight (kg)"><input type="number" min="0" step="0.001" className="input-field" value={form.inputWeightKg} onChange={(event) => setForm({ ...form, inputWeightKg: event.target.value })} /></Field>
          <Field label={stage.type === 'FABRIC_PURCHASE' ? 'Purchased fabric weight (kg)' : 'Output weight (kg)'}><input type="number" min="0" step="0.001" className="input-field" value={form.outputWeightKg} onChange={(event) => setForm({ ...form, outputWeightKg: event.target.value })} /></Field>
          <Field label="Rate charged per"><select className="input-field" value={form.rateUnit} onChange={(event) => setForm({ ...form, rateUnit: event.target.value as 'PIECE' | 'KG' })}><option value="PIECE">Piece</option><option value="KG">Kilogram</option></select></Field>
        </div>}
        <Field label="Stage notes"><textarea rows={2} className="input-field resize-none" placeholder="Colour, artwork, measurement or quality notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">Estimated stage cost: <strong className="text-slate-950">{formatCurrency((form.rateUnit === 'KG' ? Number(form.outputWeightKg) : Number(form.completedQty) + Number(form.rejectedQty)) * Number(form.rate) + Number(form.otherCost))}</strong> · Per completed piece: <strong>{formatCurrency(Number(form.completedQty) ? ((form.rateUnit === 'KG' ? Number(form.outputWeightKg) : Number(form.completedQty) + Number(form.rejectedQty)) * Number(form.rate) + Number(form.otherCost)) / Number(form.completedQty) : 0)}</strong></div>
        {nextStage && (
          <div className={clsx('rounded-lg border px-3 py-2.5 text-xs', form.status === 'COMPLETED' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-blue-100 bg-blue-50 text-blue-800')}>
            {form.status === 'COMPLETED'
              ? `${Number(form.completedQty).toLocaleString('en-IN')} completed good pieces will be planned and issued automatically to ${STAGE_META[nextStage.type].label}.`
              : `Complete this stage to send only its completed good quantity to ${STAGE_META[nextStage.type].label}. Rejected pieces stay here.`}
          </div>
        )}
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
        <div className="grid gap-3 sm:grid-cols-2"><Field label="Category"><select className="input-field" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ProductionCostCategory })}>{COST_CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}</select></Field><Field label="Supplier"><select className="input-field" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })}><option value="">Not assigned</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field></div>
        <Field label="Description *"><input required autoFocus className="input-field" placeholder="Navy Airtex fabric" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
        <div className="grid gap-3 min-[400px]:grid-cols-2 sm:grid-cols-3"><NumberField label="Quantity" value={form.quantity} step="0.001" onChange={(value) => setForm({ ...form, quantity: value })} /><NumberField label="Rate" value={form.rate} step="0.01" onChange={(value) => setForm({ ...form, rate: value })} /><NumberField label="Paid" value={form.paidAmount} step="0.01" onChange={(value) => setForm({ ...form, paidAmount: value })} /></div>
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
