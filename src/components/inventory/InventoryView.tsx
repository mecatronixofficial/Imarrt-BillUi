'use client';

import { type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowDownUp, ArrowRight, ArrowUpRight, Boxes, CircleAlert, ClipboardList, IndianRupee, Loader2, MapPin, Package, RefreshCw, Save, Search, Warehouse, X } from 'lucide-react';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/format';
import { multiplyMoney, sumMoney } from '@/lib/billing';
import type { Godown } from './GodownsView';
import InventoryNav from './InventoryNav';
import shared from './GodownsView.module.css';
import styles from './InventoryView.module.css';
import { usePageState } from '@/lib/navigation';

export type InventoryStock = { id: string; name: string; unit: string; quantity: string; purchasePrice: string; unallocated: string; stocks: Array<{ warehouseId: string; name: string; quantity: string }> };
export type InventoryMovement = { id: string; kind: string; quantity: string; createdAt: string; item: { name: string; unit: string }; warehouse?: { name: string } };

type Props = {
  mode: 'summary' | 'adjustments';
  stocks: InventoryStock[];
  movements: InventoryMovement[];
  godowns: Godown[];
  loading: boolean;
  saving: boolean;
  error: string;
  query: string;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  operation: {
    itemId: string; quantity: string; kind: string; warehouseId: string; fromWarehouseId: string; notes: string;
    onItemChange: (value: string) => void;
    onQuantityChange: (value: string) => void;
    onKindChange: (value: string) => void;
    onWarehouseChange: (value: string) => void;
    onFromWarehouseChange: (value: string) => void;
    onNotesChange: (value: string) => void;
    onSave: (event: FormEvent) => void;
  };
};

export default function InventoryView({ mode, stocks, movements, godowns, loading, saving, error, query, onQueryChange, onRefresh, operation }: Props) {
  const [filter, setFilter] = usePageState('InventoryView.filter', 'ALL');
  const stockValue = sumMoney(stocks.map((stock) => multiplyMoney(stock.quantity, stock.purchasePrice)));
  const visible = stocks.filter((stock) => stock.name.toLowerCase().includes(query.trim().toLowerCase())
    && (filter !== 'UNALLOCATED' || Number(stock.unallocated) > 0)
    && (filter !== 'OUT' || Number(stock.quantity) <= 0));
  const visibleValue = sumMoney(visible.map((stock) => multiplyMoney(stock.quantity, stock.purchasePrice)));
  const recent = movements.slice(0, 50);
  const selectedItem = stocks.find((stock) => stock.id === operation.itemId);

  function clearFilters() { onQueryChange(''); setFilter('ALL'); }

  return <div className={`${shared.page} ${styles.inventoryPage}`}>
    <header className={shared.header}>
      <div className={shared.heading}><span className={shared.heroIcon}><Boxes size={28} strokeWidth={1.7} aria-hidden="true" /></span><div><p className={shared.eyebrow}>INVENTORY / STOCK CONTROL</p><h1>{mode === 'summary' ? 'Inventory' : 'Stock adjustments'}</h1><p className={shared.subtitle}>{mode === 'summary' ? 'Know what you have, where it is, and what it’s worth.' : 'Keep stock accurate. Record inward, outward and location transfers.'}</p></div></div>
      <Link className={shared.primaryButton} href={mode === 'summary' ? '/inventory/adjustments' : '/inventory'}>{mode === 'summary' ? <ArrowDownUp size={17} aria-hidden="true" /> : <Boxes size={17} aria-hidden="true" />}{mode === 'summary' ? 'Adjust stock' : 'View stock summary'}</Link>
    </header>

    <InventoryNav active={mode} />

    <div className={`${shared.metrics} ${styles.metrics}`} aria-label="Inventory overview">
      <div className={`${shared.metric} ${styles.valueMetric}`}><span className={`${shared.metricIcon} ${shared.greenIcon}`}><IndianRupee size={22} aria-hidden="true" /></span><div><span>Total stock value</span><strong data-stock-value>{loading ? '—' : formatCurrency(stockValue)}</strong></div><small>At purchase price</small></div>
      <div className={shared.metric}><span className={shared.metricIcon}><Package size={21} aria-hidden="true" /></span><div><span>Stock items</span><strong>{loading ? '—' : stocks.length}</strong></div><small>Items tracked</small></div>
      <div className={shared.metric}><span className={`${shared.metricIcon} ${shared.amberIcon}`}><Warehouse size={21} aria-hidden="true" /></span><div><span>Godowns</span><strong>{loading ? '—' : godowns.length}</strong></div><small>Storage locations</small></div>
    </div>

    {error && <div role="alert" className={shared.error}><CircleAlert size={19} aria-hidden="true" /><p>{error}</p><button type="button" className={shared.secondaryButton} disabled={loading || saving} onClick={onRefresh}><RefreshCw size={15} aria-hidden="true" /> Retry</button></div>}

    {mode === 'adjustments' ? <div className={styles.operationLayout}>
      <section className={shared.listPanel} aria-labelledby="stock-operation-heading">
        <div className={shared.panelHeading}><span className={shared.formIcon}><ArrowDownUp size={20} aria-hidden="true" /></span><div><h2 id="stock-operation-heading">Stock operation</h2><p>Record a change or move stock between locations.</p></div></div>
        <form onSubmit={operation.onSave} className={styles.operationForm}>
          <fieldset disabled={saving} className={styles.operationFields}>
            <label htmlFor="stock-kind">Operation<select id="stock-kind" value={operation.kind} onChange={(event) => operation.onKindChange(event.target.value)}><option value="IN">Stock inward</option><option value="OUT">Stock outward</option><option value="TRANSFER">Transfer between locations</option></select></label>
            <label htmlFor="stock-item">Item <span className={shared.required}>*</span><select id="stock-item" required value={operation.itemId} onChange={(event) => operation.onItemChange(event.target.value)}><option value="">Select an item</option>{stocks.map((stock) => <option key={stock.id} value={stock.id}>{stock.name} · {formatQuantity(stock.quantity)} {stock.unit}</option>)}</select></label>
            {operation.kind === 'TRANSFER' && <label htmlFor="stock-from">From location<select id="stock-from" value={operation.fromWarehouseId} onChange={(event) => operation.onFromWarehouseChange(event.target.value)}><option value="">Unallocated stock</option>{godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}</select></label>}
            <label htmlFor="stock-godown">{operation.kind === 'TRANSFER' ? 'Destination godown' : 'Godown'}{operation.kind === 'TRANSFER' && <span className={shared.required}> *</span>}<select id="stock-godown" required={operation.kind === 'TRANSFER'} value={operation.warehouseId} onChange={(event) => operation.onWarehouseChange(event.target.value)}><option value="">{operation.kind === 'TRANSFER' ? 'Select destination' : 'Unallocated stock'}</option>{godowns.map((godown) => <option key={godown.id} value={godown.id}>{godown.name}</option>)}</select></label>
            <label htmlFor="stock-quantity">Quantity <span className={shared.required}>*</span><div className={styles.quantityField}><input id="stock-quantity" required type="number" min="0.001" step="0.001" placeholder="0.00" value={operation.quantity} onChange={(event) => operation.onQuantityChange(event.target.value)} />{selectedItem && <span>{selectedItem.unit}</span>}</div></label>
            <label htmlFor="stock-notes" className={styles.notesField}>Reason / notes <span className={styles.optional}>Optional</span><textarea id="stock-notes" rows={3} maxLength={2000} placeholder="Add a reason for this stock operation..." value={operation.notes} onChange={(event) => operation.onNotesChange(event.target.value)} /></label>
          </fieldset>
          <div className={styles.operationFooter}><span><ClipboardList size={15} aria-hidden="true" /> Changes will appear in stock movements.</span><button type="submit" className={shared.primaryButton} disabled={saving || !operation.itemId || !operation.quantity}>{saving ? <Loader2 size={16} className={shared.spin} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}{saving ? 'Posting...' : 'Save stock operation'}</button></div>
        </form>
      </section>
      <aside className={`${shared.listPanel} ${styles.operationGuide}`} aria-label="Stock operation guidance"><span className={shared.metricIcon}><Package size={24} aria-hidden="true" /></span><h2>{selectedItem ? selectedItem.name : 'Every movement matters'}</h2>{selectedItem ? <dl><div><dt>Current total stock</dt><dd>{formatQuantity(selectedItem.quantity)} <small>{selectedItem.unit}</small></dd></div><div><dt>Unallocated stock</dt><dd>{formatQuantity(selectedItem.unallocated)} <small>{selectedItem.unit}</small></dd></div></dl> : <p>Select an item to see its current stock before making a change.</p>}<div className={styles.guideNote}><ArrowDownUp size={17} aria-hidden="true" /><p>{operation.kind === 'TRANSFER' ? 'Transfers move stock between locations and keep the total item quantity unchanged. Transfer unallocated stock into a godown to assign its location.' : operation.kind === 'OUT' ? 'Stock outward reduces the item quantity at the selected location.' : 'Stock inward adds to the item quantity at the selected location.'}</p></div><Link className={styles.textLink} href="/inventory/godowns">Manage godowns <ArrowRight size={15} aria-hidden="true" /></Link></aside>
    </div> : <section className={`${shared.listPanel} ${styles.stockPanel}`} aria-labelledby="stock-summary-heading" aria-busy={loading}>
      <div className={shared.listHeading}><div><div className={shared.titleRow}><h2 id="stock-summary-heading">Stock summary</h2><span className={shared.count}>{loading ? '—' : stocks.length}</span></div><p>Available quantities and purchase value across your locations.</p></div><button type="button" className={shared.secondaryButton} disabled={loading || saving} onClick={onRefresh}><RefreshCw size={15} className={loading ? shared.spin : undefined} aria-hidden="true" /> Refresh</button></div>
      <div className={styles.stockToolbar}><div className={shared.searchField}><Search size={17} aria-hidden="true" /><input aria-label="Search inventory" placeholder="Search stock items..." value={query} onChange={(event) => onQueryChange(event.target.value)} />{query && <button type="button" aria-label="Clear inventory search" onClick={() => onQueryChange('')}><X size={15} aria-hidden="true" /></button>}</div><div className={styles.filters} aria-label="Stock filters">{[['ALL', 'All items'], ['UNALLOCATED', 'Unallocated'], ['OUT', 'Out of stock']].map(([value, label]) => <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div></div>
      {loading ? <div className={shared.loading} role="status"><Loader2 size={23} className={shared.spin} aria-hidden="true" /><p>Loading inventory...</p></div> : stocks.length === 0 ? <div className={shared.empty} role="status"><span><Boxes size={31} strokeWidth={1.5} aria-hidden="true" /></span><h3>No inventory records found.</h3><p>{error ? 'Refresh inventory to load your stock records.' : 'Add your items to start tracking stock and its value.'}</p>{!error && <Link href="/items" className={shared.secondaryButton}><Package size={16} aria-hidden="true" /> View items</Link>}</div> : visible.length === 0 ? <div className={shared.empty} role="status"><span><Search size={28} aria-hidden="true" /></span><h3>No stock items match your filters.</h3><p>Try a different item name or clear your filters.</p><button type="button" className={shared.secondaryButton} onClick={clearFilters}>Clear filters</button></div> : <>
        <p className={styles.scrollHint}><ArrowRight size={13} aria-hidden="true" /> Scroll to see all columns</p><div className={`${shared.tableWrap} ${styles.tableScroll}`} tabIndex={0} role="region" aria-label="Stock summary table"><table className={`${shared.table} ${styles.stockTable}`}><thead><tr>{['ITEM', 'TOTAL QUANTITY', 'UNALLOCATED', 'GODOWN QUANTITIES', 'PURCHASE VALUE'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{visible.map((stock) => <tr key={stock.id}><td><Link className={styles.itemLink} href={`/items/${stock.id}`}><span className={shared.locationIcon}><Package size={19} strokeWidth={1.7} aria-hidden="true" /></span><div><strong>{stock.name}</strong><small>{stock.unit}</small></div><ArrowUpRight className={styles.itemArrow} size={15} aria-hidden="true" /></Link></td><td><span className={Number(stock.quantity) <= 0 ? styles.zeroQuantity : styles.totalQuantity}>{formatQuantity(stock.quantity)}</span> <small className={styles.unit}>{stock.unit}</small></td><td><span className={Number(stock.unallocated) > 0 ? styles.unallocated : styles.allocated}>{formatQuantity(stock.unallocated)}</span></td><td><div className={styles.godownChips}>{stock.stocks.length ? stock.stocks.map((entry) => <span key={entry.warehouseId}><Warehouse size={12} aria-hidden="true" /><span>{entry.name}</span><strong>{formatQuantity(entry.quantity)}</strong></span>) : <span className={styles.noLocation}>No godown assigned</span>}</div></td><td className={styles.money}>{formatCurrency(multiplyMoney(stock.quantity, stock.purchasePrice))}</td></tr>)}</tbody></table></div>
        <footer className={shared.listFooter}><span>Showing <strong>{visible.length}</strong> of <strong>{stocks.length}</strong> items</span><span>Shown stock value <strong>{formatCurrency(visibleValue)}</strong></span></footer>
      </>}
    </section>}

    <section className={`${shared.listPanel} ${styles.movementPanel}`} aria-labelledby="stock-movements-heading" aria-busy={loading}>
      <div className={shared.listHeading}><div><div className={shared.titleRow}><h2 id="stock-movements-heading">Recent stock movements</h2><span className={shared.count}>{loading ? '—' : recent.length}</span></div><p>Follow every inward, outward and transfer.</p></div><span className={styles.activityIcon}><ArrowDownUp size={19} aria-hidden="true" /></span></div>
      {loading ? <div className={shared.loading} role="status"><Loader2 size={23} className={shared.spin} aria-hidden="true" /><p>Loading stock movements...</p></div> : recent.length === 0 ? <div className={`${shared.empty} ${styles.emptyMovements}`} role="status"><span><ClipboardList size={29} strokeWidth={1.5} aria-hidden="true" /></span><h3>No stock movements posted yet.</h3><p>Your stock operations will appear here once recorded.</p>{mode === 'summary' && <Link href="/inventory/adjustments" className={shared.secondaryButton}><ArrowDownUp size={15} aria-hidden="true" /> Record a stock operation</Link>}</div> : <>
        <p className={styles.scrollHint}><ArrowRight size={13} aria-hidden="true" /> Scroll to see all columns</p><div className={`${shared.tableWrap} ${styles.tableScroll}`} tabIndex={0} role="region" aria-label="Recent stock movements table"><table className={`${shared.table} ${styles.movementTable}`}><thead><tr>{['DATE', 'ITEM', 'LOCATION', 'OPERATION', 'QUANTITY'].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{recent.map((movement) => <tr key={movement.id}><td className={styles.date}>{formatDate(movement.createdAt)}</td><td><strong className={styles.movementItem}>{movement.item.name}</strong></td><td><span className={styles.movementLocation}><MapPin size={13} aria-hidden="true" />{movement.warehouse?.name || 'Unallocated'}</span></td><td><span className={`${styles.operationBadge} ${movement.kind === 'IN' ? styles.inward : movement.kind === 'OUT' ? styles.outward : ''}`}>{movement.kind === 'IN' ? <ArrowDownLeft size={13} aria-hidden="true" /> : movement.kind === 'OUT' ? <ArrowUpRight size={13} aria-hidden="true" /> : <ArrowDownUp size={13} aria-hidden="true" />}{movement.kind.replaceAll('_', ' ')}</span></td><td><strong className={styles.totalQuantity}>{formatQuantity(movement.quantity)}</strong> <small className={styles.unit}>{movement.item.unit}</small></td></tr>)}</tbody></table></div>
        <footer className={shared.listFooter}><span>Showing the latest <strong>{recent.length}</strong> of <strong>{movements.length}</strong> movements</span><span><ClipboardList size={13} aria-hidden="true" /> Your stock activity at a glance</span></footer>
      </>}
    </section>
  </div>;
}
