import { getGeneralPreferences } from '@/lib/preferences';

const MAX_DIMENSION = 1600;
const QUALITY = 0.8;
const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];

/** Downscales and re-encodes a photo. Returns the original file when it cannot be improved. */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE.includes(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name, { type: file.type, lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Applies the company's "Compress images" setting; non-image files pass through untouched. */
export async function prepareUploads(files: File[]): Promise<File[]> {
  if (!getGeneralPreferences().compressImages) return files;
  return Promise.all(files.map(compressImage));
}

/** Reads a logo or signature as a small data URL (max 400px per side) so it can be stored with the company's settings. */
export async function imageToDataUrl(file: File, maxSide = 400): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const png = canvas.toDataURL('image/png');
  return png.length <= 300_000 ? png : canvas.toDataURL('image/jpeg', 0.85);
}
