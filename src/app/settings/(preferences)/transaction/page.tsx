'use client';

import { Clock3, ListOrdered, Repeat } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { SavedNote, SelectRow, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';

export default function TransactionSettingsPage() {
  const { value, update } = useCompanySettings('transaction');

  return (
    <>
      <SettingsCard title="Invoice behaviour" description="Defaults applied when creating sale invoices and business documents." icon={<Repeat size={17} />}>
        <ToggleRow label="Round off total" description="Round the grand total to the nearest whole rupee on new invoices and documents." checked={value.autoRoundOff} onChange={(checked) => update('autoRoundOff', checked)} />
        <ToggleRow label="Allow negative stock" description="When off, a sale invoice is blocked if it would take a catalogue item's stock below zero." checked={value.negativeStock} onChange={(checked) => update('negativeStock', checked)} />
        <ToggleRow label="Allow editing price on invoice" description="When off, the unit price is locked to the item's sale price while billing." checked={value.editPriceOnInvoice} onChange={(checked) => update('editPriceOnInvoice', checked)} />
        <ToggleRow label="Enable additional charges" description="Show an “Add charge” button on invoices and documents for freight, packing, or other charges." checked={value.additionalCharges} onChange={(checked) => update('additionalCharges', checked)} />
      </SettingsCard>

      <SettingsCard title="Numbering & timestamps" description="Applies to sale invoice numbers." icon={<ListOrdered size={17} />}>
        <ToggleRow label="Auto-increment transaction number" description="When off, you type the invoice number yourself on each new invoice." checked={value.autoNumbering} onChange={(checked) => update('autoNumbering', checked)} />
        <SelectRow
          label="Numbering prefix"
          description="Used in automatic numbers, e.g. MAIN-INV-2026-000001. Each prefix keeps its own running count."
          value={value.numberingPrefix}
          onChange={(numberingPrefix) => update('numberingPrefix', numberingPrefix as typeof value.numberingPrefix)}
          options={[
            { value: 'invoice', label: 'INV-' },
            { value: 'bill', label: 'BILL-' },
            { value: 'none', label: 'No prefix' },
          ]}
        />
      </SettingsCard>

      <SettingsCard title="Time tracking" icon={<Clock3 size={17} />}>
        <ToggleRow label="Show time on transactions" description="Show the time of day an invoice or document was created next to its date." checked={value.showTimeOnTransaction} onChange={(checked) => update('showTimeOnTransaction', checked)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
