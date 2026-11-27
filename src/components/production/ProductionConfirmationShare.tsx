'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import NextImage from 'next/image';
import { Download, FileCheck2, Image as ImageIcon, Loader2, MessageCircle, ShieldCheck } from 'lucide-react';
import Modal from '@/components/Modal';
import { api, getApiError } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/format';
import { orderedProductionImages, productionColorRows, productionTotals } from '@/lib/production-master';
import type { ProductionOrder } from '@/types';
import styles from './ProductionConfirmationShare.module.css';

export default function ProductionConfirmationShare({ order, onClose }: { order: ProductionOrder; onClose: () => void }) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const imageSources = useRef(new Map<string, HTMLImageElement>());
  const pdfRequest = useRef<Promise<File> | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [canSharePdf, setCanSharePdf] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const images = orderedProductionImages(order);
  const rows = productionColorRows(order);
  const totals = productionTotals(rows);
  const sizes = Object.keys(totals.sizes);
  const attachmentsPreparing = !error && !pdfError && !pdfFile;

  const preparePdf = useCallback(() => {
    if (!pdfRequest.current) {
      pdfRequest.current = import('@/lib/production-confirmation-pdf').then(async ({ createProductionConfirmationPdf }) => {
        const blob = await createProductionConfirmationPdf(order, imageSources.current);
        return new File([blob], `${order.orderNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}-confirmation.pdf`, { type: 'application/pdf' });
      }).catch((cause) => { pdfRequest.current = null; throw cause; });
    }
    return pdfRequest.current;
  }, [order]);

  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setError(''); setPdfError(''); setPreviews({}); setCanSharePdf(false); setPdfFile(null); pdfRequest.current = null; imageSources.current = new Map();
    void (async () => {
      try {
        const sources = await Promise.all(orderedProductionImages(order).map(async (image) => {
          const { data } = await api.get<Blob>(`/production-orders/${order.id}/images/${image.id}`, { responseType: 'blob' });
          if (!active) return null;
          const url = URL.createObjectURL(data); urls.push(url);
          const source = new Image();
          await new Promise<void>((resolve, reject) => { source.onload = () => resolve(); source.onerror = () => reject(new Error(`Could not load ${image.displayName || image.fileName}.`)); source.src = url; });
          return { id: image.id, source, url };
        }));
        if (!active) return;
        const loaded = sources.filter((source): source is NonNullable<typeof source> => source !== null);
        imageSources.current = new Map(loaded.map(({ id, source }) => [id, source]));
        setPreviews(Object.fromEntries(loaded.map(({ id, url }) => [id, url])));
        const file = await preparePdf();
        if (!active) return;
        setPdfFile(file);
        try { setCanSharePdf(typeof navigator.share === 'function' && Boolean(navigator.canShare?.({ files: [file] }))); }
        catch { setCanSharePdf(false); }
      } catch (cause) { if (active) setError(getApiError(cause, cause instanceof Error ? cause.message : 'Could not prepare the confirmation PDF. Please retry.')); }
    })();
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [order, attempt, preparePdf]);

  async function sharePdf() {
    if (sharing || !pdfFile || !canSharePdf) return;
    setSharing(true); setError('');
    try { await navigator.share({ files: [pdfFile] }); }
    catch (cause) { if (!(cause instanceof Error && cause.name === 'AbortError')) setError('The PDF could not be shared. Try again, or use Download PDF and attach it in WhatsApp.'); }
    finally { setSharing(false); }
  }

  async function downloadPdf() {
    if (downloadingPdf || !pdfFile) return;
    setDownloadingPdf(true); setPdfError('');
    try {
      const file = await preparePdf();
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = file.name;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause) { setPdfError(getApiError(cause, 'Could not download the PDF. Please try again.')); }
    finally { setDownloadingPdf(false); }
  }

  return <Modal title={`Share order ${order.orderNumber} for confirmation`} size="xl" className={styles.modal} onClose={onClose}>
    <div className={styles.workspace} data-image-preparation={pdfFile ? 'ready' : error ? 'failed' : 'loading'}>
      <header className={styles.overview}>
        <div className={styles.identity}><span className={styles.orderIcon}><FileCheck2 size={23} /></span><div><p>PRODUCTION ORDER</p><h3>{order.orderNumber}</h3><span>{order.party.name} · {order.styleName}</span></div></div>
        <span className={styles.status}>{order.confirmedAt ? 'Confirmed' : 'Awaiting confirmation'}</span>
      </header>

      <div className={styles.layout}>
        <section className={styles.detailsPanel} aria-label="Complete order details">
          <div className={styles.panelHeading}><h3>Order details</h3><span>All details in one view</span></div>
          <div className={styles.detailContent}>
            <dl className={styles.detailGrid}>
              <div><dt>Order date</dt><dd>{formatDate(order.orderDate)}</dd></div><div><dt>Delivery date</dt><dd>{formatDate(order.dueDate)}</dd></div>
              <div><dt>Fabric / GSM</dt><dd>{[order.fabricName, order.fabricGsm].filter(Boolean).join(' · ') || '—'}</dd></div><div><dt>Destination</dt><dd>{order.destination || '—'}</dd></div>
              <div><dt>Transport</dt><dd>{order.transport || '—'}</dd></div><div><dt>Invoice details</dt><dd>{order.invoiceDetails || '—'}</dd></div>
            </dl>

            <section className={styles.section}><h4>Color & size quantities</h4>{sizes.length > 0 && <div className={styles.tableScroll}><table><thead><tr><th>Color</th>{sizes.map((size) => <th key={size}>{size}</th>)}<th>Total</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><td>{row.color}</td>{sizes.map((size) => <td key={size}>{Number(row.sizes[size]) || '—'}</td>)}<td><strong>{totals.colors[index].total}</strong></td></tr>)}</tbody></table></div>}
              <div className={styles.totalRows}><p><strong>Color-wise total</strong><span>{totals.colors.map(({ color, total }) => `${color}: ${total}`).join(' · ') || '—'}</span></p><p><strong>Size-wise total</strong><span>{sizes.map((size) => `${size}: ${totals.sizes[size]}`).join(' · ') || '—'}</span></p></div>
            </section>

            <dl className={styles.valueBand}><div><dt>Total quantity</dt><dd>{order.orderedQty.toLocaleString('en-IN')} pcs</dd></div><div><dt>Price / piece</dt><dd>{formatCurrency(order.saleRate)}</dd></div><div><dt>Order value</dt><dd>{formatCurrency(order.orderedQty * Number(order.saleRate))}</dd></div></dl>

            {!!order.instructions?.printEmbroidery?.length && <section className={styles.section}><h4>Print / embroidery</h4><div className={styles.printEntries}>{order.instructions.printEmbroidery.map((entry, index) => <div key={index}><strong>{entry.method} · {entry.placement}</strong>{(entry.size || entry.colors) && <p>{[entry.size && `Size: ${entry.size}`, entry.colors && `Colors: ${entry.colors}`].filter(Boolean).join(' · ')}</p>}{entry.detail && <p>{entry.detail}</p>}</div>)}</div></section>}
            <div className={styles.instructions}>{(['product', 'accessories', 'packing'] as const).filter((group) => order.instructions?.[group]?.length).map((group) => <section key={group}><h4>{group === 'product' ? 'Product details' : group === 'accessories' ? 'Accessories' : 'Packing'}</h4>{order.instructions![group]!.map((entry, index) => <p key={index}><strong>{entry.item}</strong><span>{entry.detail}</span></p>)}</section>)}</div>
            {order.notes && <section className={styles.section}><h4>Additional notes</h4><p className={styles.notes}>{order.notes}</p></section>}

            {images.length > 0 && <section className={styles.section} aria-label="Order artwork"><h4><ImageIcon size={14} />Artwork & images <span>{images.length}</span></h4><div className={styles.artwork}>{images.map((image, index) => <article key={image.id}><div className={styles.thumbnail}>{previews[image.id] ? <NextImage unoptimized fill sizes="70px" src={previews[image.id]} alt={`Image ${index + 1}: ${image.displayName || image.fileName}`} /> : <ImageIcon size={21} />}</div><div><small>Image {index + 1}</small><strong>{image.displayName || image.fileName}</strong><p>{[image.color, image.sizeLabel].filter(Boolean).join(' · ')}</p>{image.details && <p>{image.details}</p>}</div></article>)}</div></section>}
          </div>
        </section>

        <aside className={styles.sharePanel} aria-label="Sharing options">
          <div className={styles.shareHeading}><MessageCircle size={20} /><div><h3>Send PDF on WhatsApp</h3><p>Order details and images in one PDF.</p></div></div>
          <button type="button" className={styles.whatsappButton} data-share-whatsapp-files disabled={attachmentsPreparing || sharing || !canSharePdf || !pdfFile} onClick={() => void sharePdf()}>{attachmentsPreparing || sharing ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={18} />}{attachmentsPreparing ? 'Preparing PDF…' : 'WhatsApp · PDF only'}</button>
          <p className={styles.sendHint}>{attachmentsPreparing ? 'Preparing the confirmation PDF with all order images.' : canSharePdf ? 'Choose WhatsApp and your recipient in the share menu. Only the PDF is shared, with no text message or separate image files.' : 'This browser cannot share PDF files directly. Use Download PDF, then attach the PDF in WhatsApp.'}</p>
          <button type="button" className={styles.pdfButton} disabled={downloadingPdf || !pdfFile} onClick={() => void downloadPdf()}>{downloadingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}Download PDF</button>
          {pdfError && <p role="alert" className={styles.error}>{pdfError}</p>}
          {error && <div role="alert" className={styles.error}>{error}<button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry PDF preparation</button></div>}
          <p className={styles.footer}><ShieldCheck size={15} />Confirm the order after the customer replies.</p>
        </aside>
      </div>
    </div>
  </Modal>;
}
