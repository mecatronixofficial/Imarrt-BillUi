import { getGeneralPreferences, getPreferences } from '@/lib/preferences';

/** "OWNER" -> "Owner", "SUPER_ADMIN" -> "Super admin". */
export function formatRoleLabel(role?: string | null) {
  if (!role) return 'Member';
  if (role === 'SUPER_ADMIN') return 'Super admin';
  return role.charAt(0) + role.slice(1).toLowerCase();
}

const currencyFormatters = new Map<number, Intl.NumberFormat>();

function currencyFormatter(decimals: number) {
  let formatter = currencyFormatters.get(decimals);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    currencyFormatters.set(decimals, formatter);
  }
  return formatter;
}

export function formatCurrency(value: string | number) {
  const amount = Number(value);
  return currencyFormatter(getGeneralPreferences().amountDecimals).format(Number.isFinite(amount) ? amount : 0);
}

/** Quantity with the company's "decimal places for quantity" setting. */
export function formatQuantity(value: string | number) {
  const quantity = Number(value);
  const decimals = getGeneralPreferences().quantityDecimals;
  return (Number.isFinite(quantity) ? quantity : 0).toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const { dateFormat } = getGeneralPreferences();
  if (dateFormat === 'mm-dd-yyyy') return `${month}-${day}-${year}`;
  if (dateFormat === 'dd/mm/yyyy') return `${day}/${month}/${year}`;
  return `${day}-${month}-${year}`;
}

/** The transaction date, followed by the time it was created when the company asks for times. */
export function formatTransactionDate(issueDate?: string, createdAt?: string) {
  const date = formatDate(issueDate);
  if (!getPreferences('transaction').showTimeOnTransaction || !createdAt) return date;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return date;
  return `${date} · ${created.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}
