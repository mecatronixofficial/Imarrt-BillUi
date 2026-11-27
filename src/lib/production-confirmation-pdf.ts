import type { ProductionOrder } from '../types';
import { createProductionConfirmationImages } from './production-confirmation-image';

/** Prepare a PDF for attachment or the separate manual download action. */
export async function createProductionConfirmationPdf(order: ProductionOrder, images: Map<string, HTMLImageElement>): Promise<Blob> {
  const [{ jsPDF }, sheets] = await Promise.all([
    import('jspdf'),
    createProductionConfirmationImages(order, images, false),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `Order ${order.orderNumber} for confirmation`, subject: `${order.party.name} · ${order.styleName}` });
  const pageWidth = doc.internal.pageSize.getWidth(), pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;
  for (const [index, sheet] of sheets.entries()) {
    if (index > 0) doc.addPage();
    const bytes = new Uint8Array(await sheet.file.arrayBuffer());
    const image = doc.getImageProperties(bytes);
    const scale = Math.min((pageWidth - margin * 2) / image.width, (pageHeight - margin * 2) / image.height);
    const width = image.width * scale, height = image.height * scale;
    doc.addImage(bytes, 'PNG', (pageWidth - width) / 2, (pageHeight - height) / 2, width, height, undefined, 'FAST');
  }
  return doc.output('blob');
}
