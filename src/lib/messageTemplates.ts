export type MessageValues = Partial<Record<'FirmName' | 'PartyName' | 'InvoiceNumber' | 'EstimateNumber' | 'Amount', string>>;

/** Fills {Placeholders} in a company message template; unknown placeholders are left as typed. */
export function renderMessage(template: string, values: MessageValues) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? values[key as keyof MessageValues] ?? '' : match));
}

/** wa.me expects digits only, with a country code; bare 10-digit numbers are treated as Indian. */
export function whatsappNumber(phone?: string | null) {
  const digits = (phone || '').replace(/\D/g, '');
  return digits.length === 10 ? `91${digits}` : digits;
}

export function whatsappLink(phone: string | null | undefined, message: string) {
  return `https://wa.me/${whatsappNumber(phone)}?text=${encodeURIComponent(message)}`;
}
