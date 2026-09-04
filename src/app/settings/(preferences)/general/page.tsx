'use client';

import { Building2, Globe2, Hash, SlidersHorizontal } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { NumberRow, SavedNote, SelectRow, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  tinNumber: false,
  itemDescription: true,
  compressImages: true,
  ownerNameOnPrint: false,
  quantityDecimals: 2,
  amountDecimals: 2,
  dateFormat: 'dd-mm-yyyy',
  language: 'english',
};

export default function GeneralSettingsPage() {
  const { value, update } = useLocalSettings('general', DEFAULTS);

  return (
    <>
      <SettingsCard title="Business behaviour" description="Core toggles that affect how invoices and items behave app-wide." icon={<SlidersHorizontal size={17} />}>
        <ToggleRow label="Enable TIN number" description="Show a TIN field on business and party profiles." checked={value.tinNumber} onChange={(checked) => update('tinNumber', checked)} />
        <ToggleRow label="Enable item description" description="Allow a free-text description on each item and invoice line." checked={value.itemDescription} onChange={(checked) => update('itemDescription', checked)} />
        <ToggleRow label="Compress images" description="Automatically compress uploaded item and document images to save space." checked={value.compressImages} onChange={(checked) => update('compressImages', checked)} />
        <ToggleRow label="Show owner's name on print" description="Print the business owner's name in the invoice footer." checked={value.ownerNameOnPrint} onChange={(checked) => update('ownerNameOnPrint', checked)} />
      </SettingsCard>

      <SettingsCard title="Number formatting" description="Decimal precision used across quantities and amounts." icon={<Hash size={17} />}>
        <NumberRow label="Decimal places for quantity" min={0} max={4} value={value.quantityDecimals} onChange={(quantityDecimals) => update('quantityDecimals', quantityDecimals)} />
        <NumberRow label="Decimal places for amount" min={0} max={4} value={value.amountDecimals} onChange={(amountDecimals) => update('amountDecimals', amountDecimals)} />
      </SettingsCard>

      <SettingsCard title="Regional" description="Date format and print language." icon={<Globe2 size={17} />}>
        <SelectRow
          label="Date format"
          value={value.dateFormat}
          onChange={(dateFormat) => update('dateFormat', dateFormat)}
          options={[
            { value: 'dd-mm-yyyy', label: 'DD-MM-YYYY' },
            { value: 'mm-dd-yyyy', label: 'MM-DD-YYYY' },
            { value: 'dd/mm/yyyy', label: 'DD/MM/YYYY' },
          ]}
        />
        <SelectRow
          label="Print language"
          value={value.language}
          onChange={(language) => update('language', language)}
          options={[
            { value: 'english', label: 'English' },
            { value: 'hindi', label: 'Hindi' },
            { value: 'gujarati', label: 'Gujarati' },
            { value: 'marathi', label: 'Marathi' },
          ]}
        />
      </SettingsCard>

      <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400"><Building2 size={12} /> Business-specific fields such as legal name and GSTIN live under Business profile.</p>
      <SavedNote />
    </>
  );
}
