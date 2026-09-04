'use client';

import { Clock3, ListOrdered, Repeat } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { SavedNote, SelectRow, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  autoRoundOff: true,
  negativeStock: false,
  showTimeOnTransaction: false,
  editPriceOnInvoice: true,
  additionalCharges: false,
  autoNumbering: true,
  numberingPrefix: 'invoice',
};

export default function TransactionSettingsPage() {
  const { value, update } = useLocalSettings('transaction', DEFAULTS);

  return (
    <>
      <SettingsCard title="Invoice behaviour" description="Defaults applied when creating sale and purchase transactions." icon={<Repeat size={17} />}>
        <ToggleRow label="Round off total" description="Round the grand total to the nearest whole rupee." checked={value.autoRoundOff} onChange={(checked) => update('autoRoundOff', checked)} />
        <ToggleRow label="Allow negative stock" description="Let a sale go through even if it takes item stock below zero." checked={value.negativeStock} onChange={(checked) => update('negativeStock', checked)} />
        <ToggleRow label="Allow editing price on invoice" description="Let users override an item's default sale price while billing." checked={value.editPriceOnInvoice} onChange={(checked) => update('editPriceOnInvoice', checked)} />
        <ToggleRow label="Enable additional charges" description="Add freight, packing, or other charges as extra invoice lines." checked={value.additionalCharges} onChange={(checked) => update('additionalCharges', checked)} />
      </SettingsCard>

      <SettingsCard title="Numbering & timestamps" icon={<ListOrdered size={17} />}>
        <ToggleRow label="Auto-increment transaction number" description="Generate the next invoice/order number automatically." checked={value.autoNumbering} onChange={(checked) => update('autoNumbering', checked)} />
        <SelectRow
          label="Numbering prefix"
          description="Prefix used before the running transaction number."
          value={value.numberingPrefix}
          onChange={(numberingPrefix) => update('numberingPrefix', numberingPrefix)}
          options={[
            { value: 'invoice', label: 'INV-' },
            { value: 'bill', label: 'BILL-' },
            { value: 'none', label: 'No prefix' },
          ]}
        />
      </SettingsCard>

      <SettingsCard title="Time tracking" icon={<Clock3 size={17} />}>
        <ToggleRow label="Show time on transactions" description="Record and display the time of day a transaction was created." checked={value.showTimeOnTransaction} onChange={(checked) => update('showTimeOnTransaction', checked)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
