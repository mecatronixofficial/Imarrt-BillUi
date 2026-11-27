'use client';

import { useEffect, useState } from 'react';
import { Clock3, ListOrdered, Repeat } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { NumberRow, SavedNote, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';
import { INVOICE_PREFIX_MAX, isValidInvoicePrefix, previewInvoiceNumber } from '@/lib/invoiceNumbering';

/** Company-wise invoice prefix. Saved when the field loses focus so half-typed tokens are never sent. */
function InvoicePrefixRow({ value, digits, onSave }: { value: string; digits: number; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const valid = isValidInvoicePrefix(draft);
  const commit = () => { if (valid && draft !== value) onSave(draft); };

  return (
    <div className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-800">Invoice prefix</span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500">
          Each company keeps its own running number (INV-01, INV-02 …). Optionally add {'{YYYY}'}, {'{YY}'} or {'{FY}'} (financial year, e.g. 26-27) to restart the count every year. Saved invoices keep their numbers.
        </span>
        {valid
          ? <span className="mt-1 block text-xs font-semibold text-slate-700">Format: {previewInvoiceNumber(draft, new Date(), digits)}</span>
          : <span role="alert" className="mt-1 block text-xs font-semibold text-red-600">Use letters, numbers, / _ . - and the tokens above; start with a letter, number or token (max {INVOICE_PREFIX_MAX}).</span>}
      </span>
      <input
        type="text"
        className="input-field w-full sm:w-64"
        value={draft}
        maxLength={INVOICE_PREFIX_MAX}
        placeholder="INV-{YYYY}-"
        aria-label="Invoice prefix"
        aria-invalid={!valid}
        onChange={(event) => setDraft(event.target.value.replace(/\s/g, ''))}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') commit(); }}
      />
    </div>
  );
}

export default function TransactionSettingsPage() {
  const { value, update } = useCompanySettings('transaction');

  return (
    <>
      <SettingsCard title="Transaction Header" description="Defaults applied when creating sale invoices and business documents." icon={<Repeat size={17} />}>
        <ToggleRow label="Billing Name of Parties" checked={value.billingName} onChange={checked=>update('billingName',checked)} />
        <ToggleRow label="E-way bill no" checked={value.eWayBill} onChange={checked=>update('eWayBill',checked)} />
        <ToggleRow label="Round off total" description="Round the grand total to the nearest whole rupee on new invoices and documents." checked={value.autoRoundOff} onChange={(checked) => update('autoRoundOff', checked)} />
        <ToggleRow label="Allow negative stock" description="When off, a sale invoice is blocked if it would take a catalogue item's stock below zero." checked={value.negativeStock} onChange={(checked) => update('negativeStock', checked)} />
        <ToggleRow label="Allow editing price on invoice" description="When off, the unit price is locked to the item's sale price while billing." checked={value.editPriceOnInvoice} onChange={(checked) => update('editPriceOnInvoice', checked)} />
        <ToggleRow label="Enable additional charges" description="Show an “Add charge” button on invoices and documents for freight, packing, or other charges." checked={value.additionalCharges} onChange={(checked) => update('additionalCharges', checked)} />
      </SettingsCard>

      <SettingsCard title="Transaction Prefixes" description="Applies to sale invoice numbers of this company." icon={<ListOrdered size={17} />}>
        <ToggleRow label="Auto-increment transaction number" description="When off, you type the invoice number yourself on each new invoice." checked={value.autoNumbering} onChange={(checked) => update('autoNumbering', checked)} />
        <InvoicePrefixRow value={value.invoicePrefix} digits={value.invoiceNumberDigits} onSave={(invoicePrefix) => update('invoicePrefix', invoicePrefix)} />
        <NumberRow label="Number digits" description="Minimum digits of the running number: 2 gives INV-01, INV-02 … INV-99, INV-100." value={value.invoiceNumberDigits} min={1} max={10} onChange={(digits) => update('invoiceNumberDigits', digits)} />
      </SettingsCard>

      <SettingsCard title="More Transaction Features" icon={<Clock3 size={17} />}>
        <ToggleRow label="Show time on transactions" description="Show the time of day an invoice or document was created next to its date." checked={value.showTimeOnTransaction} onChange={(checked) => update('showTimeOnTransaction', checked)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
