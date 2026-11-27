/**
 * Client mirror of the server's company-wise invoice prefix rules (src/invoices/invoice-numbering.ts).
 * Used only to validate the Settings field and show an example; the server assigns real numbers on save.
 */
export const INVOICE_PREFIX_MAX = 24;
const INVOICE_PREFIX_PATTERN = /^(?:(?:[A-Za-z0-9]|\{(?:YYYY|YY|FY)\})(?:[A-Za-z0-9/_.-]|\{(?:YYYY|YY|FY)\})*)?$/;

export function isValidInvoicePrefix(value: string) {
  return value.length <= INVOICE_PREFIX_MAX && INVOICE_PREFIX_PATTERN.test(value);
}

/** Fills {YYYY}, {YY} and {FY} (April–March financial year, e.g. "26-27") from a date. */
export function resolveInvoicePrefix(template: string, date: Date) {
  const year = date.getFullYear();
  const fyStart = date.getMonth() >= 3 ? year : year - 1;
  const two = (value: number) => String(value % 100).padStart(2, '0');
  return template
    .replaceAll('{YYYY}', String(year))
    .replaceAll('{YY}', two(year))
    .replaceAll('{FY}', `${two(fyStart)}-${two(fyStart + 1)}`);
}

/** Example of the first number under a prefix, e.g. "INV-01". */
export function previewInvoiceNumber(template: string, date: Date, digits = 2) {
  return `${resolveInvoicePrefix(template, date)}${'1'.padStart(digits, '0')}`;
}
