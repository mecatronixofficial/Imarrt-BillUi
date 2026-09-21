'use client';

import { MessageSquare } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { SavedNote, SettingsCard, TextAreaRow, ToggleRow } from '@/components/settings/SettingsControls';

export default function TransactionMessageSettingsPage() {
  const { value, update } = useCompanySettings('message');

  return (
    <>
      <SettingsCard title="Sharing" description="Controls whether a message is offered right after saving a transaction." icon={<MessageSquare size={17} />}>
        <ToggleRow label="Auto-share on save" description="Open WhatsApp with the message below as soon as an invoice or document is saved." checked={value.autoShareOnSave} onChange={(checked) => update('autoShareOnSave', checked)} />
      </SettingsCard>

      <SettingsCard title="Message templates" description="Used for WhatsApp and email shares. Placeholders: {FirmName}, {PartyName}, {InvoiceNumber}, {EstimateNumber}, {Amount}.">
        <TextAreaRow label="Invoice message" value={value.invoiceMessage} onChange={(invoiceMessage) => update('invoiceMessage', invoiceMessage)} />
        <TextAreaRow label="Payment reminder message" value={value.paymentReminderMessage} onChange={(paymentReminderMessage) => update('paymentReminderMessage', paymentReminderMessage)} />
        <TextAreaRow label="Estimate / quotation message" value={value.estimateMessage} onChange={(estimateMessage) => update('estimateMessage', estimateMessage)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
