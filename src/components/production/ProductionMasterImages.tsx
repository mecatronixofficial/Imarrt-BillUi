'use client';

import { useEffect, useState } from 'react';
import NextImage from 'next/image';
import { Check, ImagePlus, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { orderedProductionImages } from '@/lib/production-master';
import type { ProductionOrder } from '@/types';
import styles from './ProductionMasterImages.module.css';

export type PendingMasterImage = { id: string; file: File; previewUrl: string; uploaded?: boolean };

export default function ProductionMasterImages({ order, pending, disabled, progress, onAdd, onRemove }: {
  order?: ProductionOrder;
  pending: PendingMasterImage[];
  disabled: boolean;
  progress: string;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [previewError, setPreviewError] = useState('');
  const existing = orderedProductionImages(order ?? {});
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    setPreviews({}); setPreviewError('');
    if (order) {
      for (const image of order.images ?? []) {
        void api.get<Blob>(`/production-orders/${order.id}/images/${image.id}`, { responseType: 'blob' }).then(({ data }) => {
          if (!active) return;
          const url = URL.createObjectURL(data); urls.push(url);
          setPreviews((current) => ({ ...current, [image.id]: url }));
        }).catch(() => { if (active) setPreviewError('An existing image preview could not be loaded.'); });
      }
    }
    return () => { active = false; urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, [order]);

  return <section className={styles.panel} aria-label="Order master images">
    <div className={styles.heading}><h3><ImagePlus size={16} />Order images</h3><span>{existing.length + pending.length} images</span></div>
    <p className={styles.help}>Images stay in the order you add them. They upload when you save the order.</p>
    <div className={styles.grid}>
      {existing.map((image, index) => <article key={image.id} data-master-image-number={index + 1}><div className={styles.preview}>{previews[image.id] ? <NextImage unoptimized fill sizes="150px" src={previews[image.id]} alt={`Image ${index + 1}: ${image.displayName || image.fileName}`} /> : <ImagePlus size={22} />}</div><div className={styles.caption}><strong>Image {index + 1}</strong><p title={image.fileName}>{image.displayName || image.fileName}</p><small><Check size={11} />Saved</small></div></article>)}
      {pending.map((image, index) => <article key={image.id} data-master-image-number={existing.length + index + 1}><div className={styles.preview}><NextImage unoptimized fill sizes="150px" src={image.previewUrl} alt={`Image ${existing.length + index + 1}: ${image.file.name}`} /></div><div className={styles.caption}><strong>Image {existing.length + index + 1}</strong><p title={image.file.name}>{image.file.name}</p>{image.uploaded ? <small><Check size={11} />Uploaded</small> : <button type="button" disabled={disabled} aria-label={`Remove Image ${existing.length + index + 1}`} onClick={() => onRemove(image.id)}><Trash2 size={12} />Remove</button>}</div></article>)}
      <label className={styles.add} aria-disabled={disabled}><ImagePlus size={24} /><strong>Add images</strong><span>JPG, PNG or WEBP</span><input type="file" aria-label="Add order master images" accept="image/jpeg,image/png,image/webp" multiple disabled={disabled} onChange={(event) => { onAdd(Array.from(event.target.files ?? [])); event.target.value = ''; }} /></label>
    </div>
    {progress && <p role="status" className={styles.progress}>{progress}</p>}
    {previewError && <p role="alert" className={styles.error}>{previewError}</p>}
  </section>;
}
