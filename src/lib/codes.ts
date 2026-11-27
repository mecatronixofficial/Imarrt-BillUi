/** Lower-cased codes for a duplicate check. The database compares codes case-insensitively. */
export function codeSet(records: Array<{ id: string; code?: string | null }>, excludeId?: string) {
  return new Set(records.filter((record) => record.id !== excludeId && record.code?.trim()).map((record) => record.code!.trim().toLowerCase()));
}

export function isCodeTaken(code: string, taken: Set<string>) {
  const clean = code.trim().toLowerCase();
  return Boolean(clean) && taken.has(clean);
}
