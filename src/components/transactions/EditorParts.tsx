'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, ChevronDown, PlusCircle, Settings, Warehouse, X } from 'lucide-react';
import QuickCalculator from '@/components/QuickCalculator';
import WarehouseSelect from '@/components/inventory/WarehouseSelect';
import type { Business } from '@/types';
import styles from './TransactionEditor.module.css';

/** Shared building blocks for the full-screen sale and purchase editors. */

export const PAYMENT_TERMS = [0, 7, 15, 30, 45, 60];
export const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28];
export const SUPPLY_STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Other Territory'];
// The API has no dedicated charge fields, so charges are saved as their own lines.
export const CHARGES = [['shipping', 'Shipping', 'Shipping charges'], ['packing', 'Packing', 'Packing charges'], ['adjustment', 'Adjustment', 'Adjustment']] as const;
export type ChargeKey = (typeof CHARGES)[number][0];
export const noCharges: Record<ChargeKey, string> = { shipping: '', packing: '', adjustment: '' };

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const today = () => isoDate(new Date());
export const addDays = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
};

export function EditorTabBar({ label, newHref, onClose, closeDisabled }: { label: string; newHref: string; onClose: () => void; closeDisabled?: boolean }) {
  const router = useRouter();
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  return (
    <div className={styles.tabBar}>
      <div className={styles.tabs}>
        <div className={styles.tab}>
          <span>{label}</span>
          <button type="button" onClick={onClose} disabled={closeDisabled} aria-label={`Close ${label}`}><X size={14} /></button>
        </div>
        <button type="button" className={styles.newTab} onClick={() => window.open(newHref, '_blank', 'noopener')} aria-label="Open a new one in another tab"><PlusCircle size={20} /></button>
      </div>
      <div className={styles.tabTools}>
        <div className={styles.calculatorAnchor}>
          <button type="button" onClick={() => setCalculatorOpen((open) => !open)} aria-label="Calculator" aria-expanded={calculatorOpen}><Calculator size={17} /></button>
          {calculatorOpen && <QuickCalculator onClose={() => setCalculatorOpen(false)} />}
        </div>
        <button type="button" onClick={() => router.push('/settings/transaction')} aria-label="Transaction settings"><Settings size={17} /></button>
        <button type="button" className={styles.tabClose} onClick={onClose} disabled={closeDisabled} aria-label="Close editor"><X size={16} /></button>
      </div>
    </div>
  );
}

export function GodownPill({ value, onChange, businessId }: { value: string; onChange: (id: string) => void; businessId: string }) {
  return (
    <label className={styles.godownPill}>
      <Warehouse size={15} aria-hidden="true" />
      <span>Godown:</span>
      <WarehouseSelect value={value} onChange={onChange} businessId={businessId} className={styles.godownSelect} />
    </label>
  );
}

export function CompanyChip({ businesses, value, disabled, onChange }: { businesses: Business[]; value: string; disabled?: boolean; onChange: (id: string) => void }) {
  if (!businesses.length) return null;
  const name = businesses.find(({ id }) => id === value)?.name ?? '';
  return (
    <label className={styles.companyPicker}>
      <span className={styles.companyAvatar} aria-hidden="true">{(name || 'C').charAt(0).toUpperCase()}</span>
      <select aria-label="Company for this document" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {businesses.map((business) => <option key={business.id} value={business.id}>{business.name}</option>)}
      </select>
      <ChevronDown size={18} aria-hidden="true" />
    </label>
  );
}

export function MetaRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={styles.metaRow}>
      <span>{label}</span>
      <span className={styles.metaValue}>{children}</span>
    </label>
  );
}
