import { Boxes, Check, Factory, PackageCheck, Palette, Scissors, Shirt, Users, type LucideIcon } from 'lucide-react';
import type { OrderProcess } from '@/lib/production-dashboard';
import type { ProductionStageType } from '@/types';

export const STAGE_META: Record<ProductionStageType, { label: string; shortLabel: string; icon: LucideIcon; accent: string }> = {
  MASTER: { label: 'Master', shortLabel: 'Master', icon: Users, accent: 'text-slate-700 bg-slate-100' },
  FABRIC_PURCHASE: { label: 'Fabric purchase', shortLabel: 'Fabric', icon: Boxes, accent: 'text-indigo-700 bg-indigo-50' },
  WASHING_COMPACTING: { label: 'Washing / compacting', shortLabel: 'Wash', icon: Factory, accent: 'text-cyan-700 bg-cyan-50' },
  CUTTING: { label: 'Cutting', shortLabel: 'Cut', icon: Scissors, accent: 'text-blue-600 bg-blue-50' },
  PRINT_EMBROIDERY: { label: 'Print / Embroidery DC', shortLabel: 'Print & Emb', icon: Palette, accent: 'text-violet-600 bg-violet-50' },
  STITCHING: { label: 'Stitching', shortLabel: 'Stitch', icon: Shirt, accent: 'text-amber-600 bg-amber-50' },
  PACKING: { label: 'Packing', shortLabel: 'Pack', icon: PackageCheck, accent: 'text-emerald-600 bg-emerald-50' },
  FINAL: { label: 'Final total / delivery', shortLabel: 'Final', icon: Check, accent: 'text-teal-700 bg-teal-50' },
};

export function processLabel(process: OrderProcess) {
  if (process === 'DRAFT') return 'Draft master';
  if (process === 'DELIVERED') return 'Delivered';
  if (process === 'CANCELLED') return 'Cancelled';
  return STAGE_META[process].label;
}

export function processShortLabel(process: OrderProcess) {
  if (process === 'DRAFT') return 'Draft';
  if (process === 'DELIVERED') return 'Delivered';
  if (process === 'CANCELLED') return 'Cancelled';
  return STAGE_META[process].shortLabel;
}
