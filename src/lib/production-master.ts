import type { ProductionOrder } from '../types';

export const PRODUCTION_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '5XL'];
export type ColorQuantities = { color: string; sizes: Record<string, number | string> };

export function productionTotals(rows: ColorQuantities[]) {
  const sizes: Record<string, number> = {};
  const colors = rows.map((row) => {
    let total = 0;
    for (const [size, value] of Object.entries(row.sizes)) {
      const quantity = Number(value);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      sizes[size] = (sizes[size] ?? 0) + quantity;
      total += quantity;
    }
    return { color: row.color, total };
  });
  return { colors, sizes, total: colors.reduce((sum, row) => sum + row.total, 0) };
}

export function productionColorRows(order: ProductionOrder): ColorQuantities[] {
  if (order.sizeColorBreakdown && Object.keys(order.sizeColorBreakdown).length) {
    return Object.entries(order.sizeColorBreakdown).map(([color, sizes]) => ({ color, sizes }));
  }
  return order.sizeBreakdown ? [{ color: order.color || 'Unspecified', sizes: order.sizeBreakdown }] : [];
}

/** The API returns newest first. Always show and export the first upload first. */
export function orderedProductionImages(order: Pick<ProductionOrder, 'images'>) {
  return [...(order.images ?? [])].sort((a, b) => {
    const first = Date.parse(a.createdAt);
    const second = Date.parse(b.createdAt);
    return Number.isFinite(first) && Number.isFinite(second) ? first - second : 0;
  });
}

export function productionConfirmationMessage(order: ProductionOrder, imagesAttached = false) {
  const rows = productionColorRows(order);
  const totals = productionTotals(rows);
  const money = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return [
    '*ORDER CONFIRMATION*',
    order.orderNumber,
    '',
    '*Customer & delivery*',
    `Customer: ${order.party.name}`,
    `Style: ${order.styleName}`,
    ...(order.orderDate ? [`Order date: ${order.orderDate.slice(0, 10).split('-').reverse().join('/')}`] : []),
    ...(order.dueDate ? [`Delivery: ${order.dueDate.slice(0, 10).split('-').reverse().join('/')}`] : []),
    ...([order.fabricName, order.fabricGsm].some(Boolean) ? [`Fabric: ${[order.fabricName, order.fabricGsm].filter(Boolean).join(' · ')}`] : []),
    ...(order.transport ? [`Transport: ${order.transport}`] : []),
    ...(order.destination ? [`Destination: ${order.destination}`] : []),
    ...(order.invoiceDetails ? [`Invoice details: ${order.invoiceDetails}`] : []),
    '',
    '*Order summary*',
    `Quantity: ${order.orderedQty} pcs`,
    `Price / piece: ${money(Number(order.saleRate))}`,
    `Order value: ${money(order.orderedQty * Number(order.saleRate))}`,
    ...(rows.length ? ['', '*Color & size quantities*', ...rows.map((row) => `${row.color}: ${Object.entries(row.sizes).filter(([, quantity]) => Number(quantity) > 0).map(([size, quantity]) => `${size}: ${quantity}`).join(', ')}`)] : []),
    ...(totals.colors.length ? ['', '*Color-wise total*', ...totals.colors.map(({ color, total }) => `${color}: ${total} pcs`)] : []),
    ...(Object.keys(totals.sizes).length ? ['', '*Size-wise total*', ...Object.entries(totals.sizes).map(([size, total]) => `${size}: ${total} pcs`)] : []),
    ...(order.instructions?.printEmbroidery?.length ? ['', '*Print / embroidery*', ...order.instructions.printEmbroidery.map((entry, index) => `${index + 1}. ${[entry.method, entry.placement, entry.size && `Size: ${entry.size}`, entry.colors && `Colors: ${entry.colors}`, entry.detail].filter(Boolean).join(' · ')}`)] : []),
    ...(['product', 'accessories', 'packing'] as const).flatMap((group) => order.instructions?.[group]?.length ? ['', `*${group === 'product' ? 'Product details' : group === 'accessories' ? 'Accessories' : 'Packing'}*`, ...order.instructions[group]!.map((entry) => `${entry.item}: ${entry.detail}`)] : []),
    ...(order.notes ? ['', '*Additional notes*', order.notes] : []),
    '',
    imagesAttached ? 'Please review the attached order images and confirm the details.' : 'Please review the order details above and reply to confirm or request changes.',
  ].join('\n');
}
