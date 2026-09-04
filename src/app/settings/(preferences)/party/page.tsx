'use client';

import { Users } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { NumberRow, SavedNote, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  openingBalance: true,
  partyCategories: false,
  paymentReminders: true,
  defaultPaymentTermDays: 15,
  showGstinOnPrint: true,
  loyaltyPoints: false,
};

export default function PartySettingsPage() {
  const { value, update } = useLocalSettings('party', DEFAULTS);

  return (
    <>
      <SettingsCard title="Party defaults" description="Applied when a new party is added." icon={<Users size={17} />}>
        <ToggleRow label="Enable opening balance" description="Show an opening balance field on the add-party form." checked={value.openingBalance} onChange={(checked) => update('openingBalance', checked)} />
        <ToggleRow label="Enable party categories" description="Group parties by category for filtering and reports." checked={value.partyCategories} onChange={(checked) => update('partyCategories', checked)} />
        <ToggleRow label="Show party's GSTIN on print" checked={value.showGstinOnPrint} onChange={(checked) => update('showGstinOnPrint', checked)} />
        <ToggleRow label="Enable loyalty points" description="Track reward points earned per party on sales." checked={value.loyaltyPoints} onChange={(checked) => update('loyaltyPoints', checked)} />
      </SettingsCard>

      <SettingsCard title="Payment reminders">
        <ToggleRow label="Enable payment reminders" description="Surface parties with overdue balances on the dashboard." checked={value.paymentReminders} onChange={(checked) => update('paymentReminders', checked)} />
        <NumberRow label="Default payment term (days)" min={0} max={180} value={value.defaultPaymentTermDays} onChange={(defaultPaymentTermDays) => update('defaultPaymentTermDays', defaultPaymentTermDays)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
