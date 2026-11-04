type DatedTransaction = { id: string; date?: string; entryDate?: string; createdAt?: string };

function timestamp(value?: string) {
  const result = value ? Date.parse(value) : 0;
  return Number.isFinite(result) ? result : 0;
}

/** Same-day entries follow their actual creation time, rather than random UUID order. */
export function compareCashTransactions(a: DatedTransaction, b: DatedTransaction, newestFirst = true) {
  const order = timestamp(a.date || a.entryDate) - timestamp(b.date || b.entryDate)
    || timestamp(a.createdAt) - timestamp(b.createdAt)
    || a.id.localeCompare(b.id);
  return order * (newestFirst ? -1 : 1);
}
