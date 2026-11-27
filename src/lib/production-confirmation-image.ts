import type { ProductionOrder } from '../types';
import { orderedProductionImages, productionColorRows, productionTotals } from './production-master';

export type ProductionConfirmationPage = { file: File; kind: 'details' | 'image'; title: string };

const ink = '#14213d', muted = '#66758b', border = '#dce3ec', blue = '#2348b5';

/** Export all order details in one continuous image, followed by artwork in upload order. */
export async function createProductionConfirmationImages(order: ProductionOrder, images: Map<string, HTMLImageElement>, continuousDetails = true): Promise<ProductionConfirmationPage[]> {
  const pages: Array<{ canvas: HTMLCanvasElement; kind: ProductionConfirmationPage['kind']; title: string; contentBottom: number }> = [];
  const width = 1200, height = 1600, left = 72, contentWidth = width - left * 2, bottom = 1470;
  let ctx: CanvasRenderingContext2D;
  let y = 0;
  let currentKind: ProductionConfirmationPage['kind'] = 'details';
  let currentTitle = 'Order details';
  const font = (size = 23, bold = false) => { ctx.font = `${bold ? 'bold ' : ''}${size}px Arial`; };
  const rect = (x: number, top: number, w: number, h: number, fill = '#ffffff', stroke = border) => {
    ctx.fillStyle = fill; ctx.fillRect(x, top, w, h);
    ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x, top, w, h);
  };
  const write = (value: string, x: number, top: number, size = 23, bold = false, color = ink) => {
    font(size, bold); ctx.fillStyle = color; ctx.fillText(value, x, top);
  };
  const wrap = (value: string, maxWidth: number, size = 23, bold = false) => {
    font(size, bold);
    const lines: string[] = [];
    for (const paragraph of String(value).split('\n')) {
      let line = '';
      for (const word of paragraph.split(/\s+/)) {
        const next = line ? `${line} ${word}` : word;
        if (ctx.measureText(next).width <= maxWidth) { line = next; continue; }
        if (line) { lines.push(line); line = ''; }
        for (const character of word) {
          if (ctx.measureText(line + character).width > maxWidth) { lines.push(line); line = ''; }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  };
  const newPage = (kind = currentKind, title = currentTitle) => {
    if (pages.length) pages[pages.length - 1].contentBottom = y;
    currentKind = kind; currentTitle = title;
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the order image.');
    ctx = context;
    pages.push({ canvas, kind, title, contentBottom: 230 });
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    rect(28, 28, width - 56, height - 56);
    ctx.fillStyle = ink; ctx.fillRect(29, 29, width - 58, 162);
    ctx.fillStyle = '#f6c649'; ctx.fillRect(29, 191, width - 58, 5);
    write('PRODUCTION  /  ORDER CONFIRMATION', left, 75, 18, true, '#c4d0e6');
    font(34, true); ctx.fillStyle = '#ffffff';
    ctx.fillText(order.orderNumber, left, 126, contentWidth - 335);
    write(kind === 'details' ? 'Customer order sheet' : 'Artwork reference sheet', left, 161, 20, false, '#c4d0e6');
    rect(width - 345, 91, 271, 42, '#fff4d4', '#fff4d4');
    write(order.confirmedAt ? 'CONFIRMED' : 'FOR CONFIRMATION', width - 325, 119, 18, true, '#805d0c');
    y = 230;
  };
  const ensure = (space: number) => { if (y + space > bottom) newPage(); };
  const section = (number: string, title: string) => {
    const lines = wrap(title, contentWidth - 65, 26, true);
    ensure(150 + lines.length * 32);
    y += 18;
    rect(left, y, 38, 36, '#edf2ff', '#edf2ff');
    write(number, left + 8, y + 25, 19, true, blue);
    lines.forEach((line, index) => write(line, left + 52, y + 26 + index * 32, 26, true));
    y += 51 + (lines.length - 1) * 32;
    ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(width - left, y); ctx.stroke();
    y += 19;
  };
  const textBlock = (value: string, fill = '#f8fafc', color = ink) => {
    const lines = wrap(value, contentWidth - 40);
    let offset = 0;
    while (offset < lines.length) {
      ensure(80);
      const count = Math.min(lines.length - offset, Math.max(1, Math.floor((bottom - y - 32) / 32)));
      rect(left, y, contentWidth, count * 32 + 28, fill);
      for (let index = 0; index < count; index++) write(lines[offset + index], left + 20, y + 35 + index * 32, 23, false, color);
      y += count * 32 + 42; offset += count;
    }
  };
  const table = (headers: string[], rows: string[][], fractions: number[]) => {
    const widths = fractions.map((fraction) => fraction * contentWidth);
    const drawRow = (cells: string[], heading: boolean, alternate = false, offset = 0, maxLines = Infinity) => {
      const wrapped = cells.map((value, index) => wrap(value, widths[index] - 32, heading ? 19 : 23, heading));
      const totalLines = Math.max(...wrapped.map((lines) => lines.length));
      const count = Math.min(maxLines, totalLines - offset);
      const rowHeight = count * 31 + 26;
      let x = left;
      cells.forEach((_, column) => {
        rect(x, y, widths[column], rowHeight, heading ? '#edf2f8' : alternate ? '#f8fafc' : '#ffffff');
        wrapped[column].slice(offset, offset + count).forEach((line, index) => write(line, x + 16, y + 34 + index * 31, heading ? 19 : 23, heading, heading ? '#516078' : ink));
        x += widths[column];
      });
      y += rowHeight;
      return count;
    };
    ensure(125); drawRow(headers, true);
    rows.forEach((row, index) => {
      const totalLines = Math.max(...row.map((value, column) => wrap(value, widths[column] - 32).length));
      let offset = 0;
      while (offset < totalLines) {
        if (y + Math.min(totalLines - offset, 3) * 31 + 26 > bottom) { newPage(); drawRow(headers, true); }
        const count = Math.max(1, Math.floor((bottom - y - 26) / 31));
        offset += drawRow(row, false, index % 2 === 1, offset, count);
      }
    });
    y += 15;
  };
  const detailGrid = (fields: Array<[string, string]>) => {
    for (let index = 0; index < fields.length; index += 2) {
      const pair = fields.slice(index, index + 2);
      const cellWidth = contentWidth / pair.length;
      const lines = pair.map(([, value]) => wrap(value || '—', cellWidth - 40, 24, true));
      const rowHeight = Math.max(...lines.map((cell) => cell.length)) * 32 + 55;
      if (rowHeight > 650) { table(['Detail', 'Information'], pair, [.28, .72]); continue; }
      ensure(rowHeight + 5);
      pair.forEach(([label], column) => {
        const x = left + column * cellWidth;
        rect(x, y, cellWidth, rowHeight, label === 'Total order value' ? '#f0f5ff' : '#ffffff');
        write(label.toUpperCase(), x + 20, y + 29, 17, true, muted);
        lines[column].forEach((line, lineIndex) => write(line, x + 20, y + 63 + lineIndex * 32, 24, true));
      });
      y += rowHeight;
    }
    y += 12;
  };
  const date = (value?: string) => value ? value.slice(0, 10).split('-').reverse().join(' / ') : 'Not specified';
  const money = (value: number) => `INR ${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const rows = productionColorRows(order);
  const totals = productionTotals(rows);
  newPage();
  section('01', 'Order & delivery details');
  detailGrid([
    ['Customer', order.party.name], ['Style / product', order.styleName],
    ['Order date', date(order.orderDate)], ['Delivery date', date(order.dueDate)],
    ['Fabric / GSM', [order.fabricName, order.fabricGsm].filter(Boolean).join(' · ') || 'Not specified'],
    ['Destination', order.destination || 'Not specified'],
    ['Transport', order.transport || 'Not specified'], ['Confirmation', order.confirmedAt ? date(order.confirmedAt) : 'Awaiting customer confirmation'],
  ]);
  if (order.invoiceDetails) table(['Reference', 'Information'], [['Invoice details', order.invoiceDetails]], [.25, .75]);
  section('02', 'Color & size quantities');
  const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL'];
  const sizes = Object.keys(totals.sizes).sort((a, b) => {
    const first = sizeOrder.indexOf(a), second = sizeOrder.indexOf(b);
    return first === -1 || second === -1 ? (first === second ? a.localeCompare(b, undefined, { numeric: true }) : first === -1 ? 1 : -1) : first - second;
  });
  for (let start = 0; start < sizes.length; start += 6) {
    const group = sizes.slice(start, start + 6);
    table(['COLOR', ...group, 'TOTAL'], [
      ...rows.map((row) => [row.color, ...group.map((size) => String(Number(row.sizes[size]) || 0)), `${Object.values(row.sizes).reduce<number>((sum, qty) => sum + Number(qty || 0), 0)} pcs`]),
      ['ALL COLORS', ...group.map((size) => String(totals.sizes[size])), `${order.orderedQty} pcs`],
    ], [.23, ...group.map(() => .59 / group.length), .18]);
  }
  const summaries = [
    { title: 'Color-wise total:', values: totals.colors.map(({ color, total }) => [color, `${total} pcs`]) },
    { title: 'Size-wise total:', values: sizes.map((size) => [size, `${totals.sizes[size]} pcs`]) },
  ];
  const summaryWidth = (contentWidth - 20) / 2;
  const summaryLines = summaries.map((summary) => summary.values.map(([label]) => wrap(label, summaryWidth - 170, 21)));
  const summaryHeight = 65 + Math.max(...summaryLines.map((values) => values.reduce((sum, lines) => sum + lines.length * 29 + 10, 0)));
  if (summaryHeight > 550) {
    summaries.forEach((summary) => table([summary.title, 'QUANTITY'], summary.values, [.72, .28]));
  } else {
    ensure(summaryHeight + 15);
    summaries.forEach((summary, column) => {
      const x = left + column * (summaryWidth + 20);
      rect(x, y, summaryWidth, summaryHeight, '#f8fafc');
      rect(x, y, summaryWidth, 45, '#edf2f8');
      write(summary.title, x + 18, y + 30, 20, true, blue);
      let lineY = y + 78;
      summary.values.forEach(([, quantity], index) => {
        summaryLines[column][index].forEach((line, lineIndex) => write(line, x + 18, lineY + lineIndex * 29, 21));
        font(21, true);
        write(quantity, x + summaryWidth - 18 - ctx.measureText(quantity).width, lineY, 21, true);
        lineY += summaryLines[column][index].length * 29 + 10;
      });
    });
    y += summaryHeight + 15;
  }
  section('03', 'Order value');
  detailGrid([
    ['Total quantity', `${order.orderedQty} pcs`], ['Price / piece', money(Number(order.saleRate))],
    ['Total order value', money(order.orderedQty * Number(order.saleRate))],
  ]);
  if (order.instructions?.printEmbroidery?.length) {
    section('04', 'Print / embroidery');
    order.instructions.printEmbroidery.forEach((entry, index) => {
      table(['ARTWORK', 'SPECIFICATION'], [
        [`Artwork ${index + 1}`, `${entry.method} · ${entry.placement}`],
        ...(entry.size ? [['Size', entry.size]] : []), ...(entry.colors ? [['Colors', entry.colors]] : []),
        ...(entry.detail ? [['Details', entry.detail]] : []),
      ], [.25, .75]);
    });
  }
  const titles = { product: 'Product details', accessories: 'Accessories', packing: 'Packing' };
  for (const group of ['product', 'accessories', 'packing'] as const) {
    if (!order.instructions?.[group]?.length) continue;
    section(group === 'product' ? '05' : group === 'accessories' ? '06' : '07', titles[group]);
    table(['ITEM', 'INSTRUCTIONS'], order.instructions[group]!.map((entry) => [entry.item, entry.detail]), [.3, .7]);
  }
  if (order.notes) { section('08', 'Additional notes'); textBlock(order.notes); }
  ensure(155); y += 18;
  textBlock('CONFIRMATION REQUEST\nPlease review the quantities, specifications and artwork. Reply with your confirmation or any changes required.', '#f0f5ff', '#23428b');
  for (const [index, image] of orderedProductionImages(order).entries()) {
    const source = images.get(image.id);
    if (!source) throw new Error(`Image ${index + 1} could not be loaded. Please retry.`);
    newPage('image', `Image ${index + 1}`);
    section(String(index + 1).padStart(2, '0'), `Image ${index + 1}: ${image.displayName || image.fileName}`);
    const frameHeight = 770;
    rect(left, y, contentWidth, frameHeight, '#f8fafc');
    const scale = Math.min((contentWidth - 48) / source.naturalWidth, (frameHeight - 48) / source.naturalHeight);
    const w = source.naturalWidth * scale, h = source.naturalHeight * scale;
    ctx!.drawImage(source, left + (contentWidth - w) / 2, y + (frameHeight - h) / 2, w, h);
    y += frameHeight + 20;
    detailGrid([
      ['Color', image.color || 'Not specified'], ['Size', image.sizeLabel || 'Not specified'],
      ['Process', image.stageType?.replaceAll('_', ' / ') || 'Order master'], ['Reference', `Image ${index + 1} of ${order.images?.length ?? 0}`],
    ]);
    if (image.details) { section('—', 'Artwork details'); textBlock(image.details); }
  }
  pages[pages.length - 1].contentBottom = y;
  const details = pages.filter((page) => page.kind === 'details');
  const combined = document.createElement('canvas');
  combined.width = width;
  combined.height = 230 + details.reduce((sum, page) => sum + Math.max(0, Math.min(page.contentBottom, bottom) - 230) + 18, 0) + 120;
  const combinedContext = combined.getContext('2d');
  if (!combinedContext) throw new Error('Could not create the order image.');
  combinedContext.fillStyle = '#ffffff'; combinedContext.fillRect(0, 0, width, combined.height);
  combinedContext.drawImage(details[0].canvas, 0, 0, width, 230, 0, 0, width, 230);
  let nextY = 230;
  for (const page of details) {
    const sectionHeight = Math.max(0, Math.min(page.contentBottom, bottom) - 230);
    if (sectionHeight) combinedContext.drawImage(page.canvas, 0, 230, width, sectionHeight, 0, nextY, width, sectionHeight);
    nextY += sectionHeight + 18;
  }
  combinedContext.strokeStyle = border; combinedContext.lineWidth = 1;
  combinedContext.strokeRect(28, 28, width - 56, combined.height - 56);
  const sheets = continuousDetails ? [{ canvas: combined, kind: 'details' as const, title: 'Complete order details' }, ...pages.filter((page) => page.kind === 'image')] : pages;
  const safeNumber = order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_');
  return Promise.all(sheets.map(async ({ canvas, kind, title }, index) => {
    ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = border; ctx.beginPath(); ctx.moveTo(left, canvas.height - 100); ctx.lineTo(width - left, canvas.height - 100); ctx.stroke();
    write('Prepared for customer review', left, canvas.height - 65, 18, false, muted);
    font(18); ctx.fillStyle = muted; ctx.textAlign = 'right'; ctx.fillText(`${order.orderNumber}  ·  ${continuousDetails ? kind === 'details' ? 'Complete order details' : title : `Page ${index + 1} of ${sheets.length}`}`, width - left, canvas.height - 65); ctx.textAlign = 'left';
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Could not export the order image.');
    return { file: new File([blob], `${safeNumber}-confirmation-${index + 1}.png`, { type: 'image/png' }), kind, title };
  }));
}
