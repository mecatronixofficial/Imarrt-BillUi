'use client';

import Link from 'next/link';
import { Percent } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { SavedNote, SelectRow, SettingsCard, ToggleRow, UnavailableRow } from '@/components/settings/SettingsControls';

export default function TaxesGstSettingsPage() {
  const { value, update } = useCompanySettings('taxes');

  return (
    <>
      <SettingsCard title="GST" description="How tax is calculated and shown on invoices and documents." icon={<Percent size={17} />}>
        <div className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-slate-800">GST registration and GSTIN</span>
            <span className="mt-0.5 block text-xs leading-5 text-slate-500">Set once per company; it decides whether tax rates are used at all.</span>
          </span>
          <Link href="/businesses" className="text-xs font-bold text-blue-600 hover:underline">Edit in Business profile</Link>
        </div>
        <SelectRow
          label="Tax breakup"
          description="How GST is split on printed invoices. Auto uses IGST when the party is in another state, otherwise CGST + SGST."
          value={value.taxType}
          onChange={(taxType) => update('taxType', taxType as typeof value.taxType)}
          options={[
            { value: 'igst-cgst-sgst', label: 'Auto (IGST or CGST+SGST)' },
            { value: 'igst', label: 'IGST only' },
            { value: 'cgst-sgst', label: 'CGST + SGST only' },
          ]}
        />
        <ToggleRow label="Round off tax amount" description="Round the total tax on new invoices and documents to the nearest whole rupee." checked={value.roundOffTax} onChange={(checked) => update('roundOffTax', checked)} />
      </SettingsCard>

      <SettingsCard title="Special schemes">
        <ToggleRow label="Composition scheme" description="No tax is charged on new sale invoices and documents, and printed copies say “Bill of supply — composition taxable person”." checked={value.compositionScheme} onChange={(checked) => update('compositionScheme', checked)} />
        <ToggleRow label="Reverse charge" description="Print “Tax payable on reverse charge: Yes” on invoices and documents." checked={value.reverseCharge} onChange={(checked) => update('reverseCharge', checked)} />
        <UnavailableRow label="TCS (Tax Collected at Source)" description="Needs tax collection lines and reports that are not built yet." />
        <UnavailableRow label="TDS (Tax Deducted at Source)" description="Needs deduction handling on payments that is not built yet." />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
