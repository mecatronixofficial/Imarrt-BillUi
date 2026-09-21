'use client';

import { Users } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { NumberRow, SavedNote, SettingsCard, ToggleRow, UnavailableRow } from '@/components/settings/SettingsControls';

export default function PartySettingsPage() {
  const { value, update } = useCompanySettings('party');

  return (
    <>
      <SettingsCard title="Party defaults" description="Applied on the party form, invoices, and print-outs." icon={<Users size={17} />}>
        <ToggleRow label="Enable opening balance" description="Show the opening balance fields on the add-party form." checked={value.openingBalance} onChange={(checked) => update('openingBalance', checked)} />
        <ToggleRow label="Enable party categories" description="Show the group field on the party form and a group filter in the party list." checked={value.partyCategories} onChange={(checked) => update('partyCategories', checked)} />
        <ToggleRow label="Show party's GSTIN on print" description="Print the customer or supplier GSTIN on invoices and documents." checked={value.showGstinOnPrint} onChange={(checked) => update('showGstinOnPrint', checked)} />
        <UnavailableRow label="Enable loyalty points" description="Reward points are not built yet." />
      </SettingsCard>

      <SettingsCard title="Payment reminders">
        <ToggleRow label="Enable payment reminders" description="Show overdue invoices on the dashboard." checked={value.paymentReminders} onChange={(checked) => update('paymentReminders', checked)} />
        <NumberRow label="Default payment term (days)" description="New sale invoices get a due date this many days after the invoice date." min={0} max={180} value={value.defaultPaymentTermDays} onChange={(defaultPaymentTermDays) => update('defaultPaymentTermDays', defaultPaymentTermDays)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
