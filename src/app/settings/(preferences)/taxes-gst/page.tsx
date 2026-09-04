'use client';

import { Percent } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { SavedNote, SelectRow, SettingsCard, TextRow, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  gstEnabled: true,
  gstin: '',
  taxType: 'igst-cgst-sgst',
  reverseCharge: false,
  compositionScheme: false,
  tcsEnabled: false,
  tdsEnabled: false,
  roundOffTax: true,
};

export default function TaxesGstSettingsPage() {
  const { value, update } = useLocalSettings('taxes-gst', DEFAULTS);

  return (
    <>
      <SettingsCard title="GST" description="Controls tax fields shown on items, parties, and invoices." icon={<Percent size={17} />}>
        <ToggleRow label="Enable GST" description="Show GST rate on items and tax breakup on invoices." checked={value.gstEnabled} onChange={(checked) => update('gstEnabled', checked)} />
        <TextRow label="Business GSTIN" placeholder="22AAAAA0000A1Z5" value={value.gstin} onChange={(gstin) => update('gstin', gstin)} />
        <SelectRow
          label="Tax breakup"
          description="How GST is split on an invoice."
          value={value.taxType}
          onChange={(taxType) => update('taxType', taxType)}
          options={[
            { value: 'igst-cgst-sgst', label: 'Auto (IGST or CGST+SGST)' },
            { value: 'igst', label: 'IGST only' },
            { value: 'cgst-sgst', label: 'CGST + SGST only' },
          ]}
        />
        <ToggleRow label="Round off tax amount" checked={value.roundOffTax} onChange={(checked) => update('roundOffTax', checked)} />
      </SettingsCard>

      <SettingsCard title="Special schemes">
        <ToggleRow label="Composition scheme" description="Hide tax rate entry and print a composition-scheme notice." checked={value.compositionScheme} onChange={(checked) => update('compositionScheme', checked)} />
        <ToggleRow label="Reverse charge" description="Mark applicable invoices as reverse-charge liable." checked={value.reverseCharge} onChange={(checked) => update('reverseCharge', checked)} />
        <ToggleRow label="TCS (Tax Collected at Source)" checked={value.tcsEnabled} onChange={(checked) => update('tcsEnabled', checked)} />
        <ToggleRow label="TDS (Tax Deducted at Source)" checked={value.tdsEnabled} onChange={(checked) => update('tdsEnabled', checked)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
