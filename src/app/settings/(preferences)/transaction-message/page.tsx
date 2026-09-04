'use client';

import { MessageSquare } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { SavedNote, SettingsCard, TextAreaRow, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  autoShareOnSave: false,
  invoiceMessage: 'Dear {PartyName}, thank you for your business. Your invoice {InvoiceNumber} of {Amount} is attached. — {FirmName}',
  paymentReminderMessage: 'Dear {PartyName}, this is a reminder that {Amount} is due against invoice {InvoiceNumber}. Please pay at your earliest convenience. — {FirmName}',
  estimateMessage: 'Dear {PartyName}, please find the estimate {EstimateNumber} for {Amount}. — {FirmName}',
};

export default function TransactionMessageSettingsPage() {
  const { value, update } = useLocalSettings('transaction-message', DEFAULTS);

  return (
    <>
      <SettingsCard title="Sharing" description="Controls whether a message is offered right after saving a transaction." icon={<MessageSquare size={17} />}>
        <ToggleRow label="Auto-share on save" description="Open the WhatsApp/SMS share sheet as soon as a transaction is saved." checked={value.autoShareOnSave} onChange={(checked) => update('autoShareOnSave', checked)} />
      </SettingsCard>

      <SettingsCard title="Message templates" description="Use {FirmName}, {PartyName}, {InvoiceNumber}, and {Amount} as placeholders.">
        <TextAreaRow label="Invoice message" value={value.invoiceMessage} onChange={(invoiceMessage) => update('invoiceMessage', invoiceMessage)} />
        <TextAreaRow label="Payment reminder message" value={value.paymentReminderMessage} onChange={(paymentReminderMessage) => update('paymentReminderMessage', paymentReminderMessage)} />
        <TextAreaRow label="Estimate / quotation message" value={value.estimateMessage} onChange={(estimateMessage) => update('estimateMessage', estimateMessage)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
