import { api, getActiveBusinessId, getApiError, onWorkspaceChanged } from '@/lib/api';
import {
  ITEM_TABLE_COLUMN_DEFAULTS,
  REGULAR_PRINT_DEFAULTS,
  THERMAL_PRINT_DEFAULTS,
  TRANSACTION_NAME_DEFAULTS,
} from '@/components/settings/printSettingsTypes';

export type DateFormat = 'dd-mm-yyyy' | 'mm-dd-yyyy' | 'dd/mm/yyyy';
export type PrintLanguage = 'english' | 'hindi' | 'gujarati' | 'marathi';

export type GeneralPreferences = {
  tinNumber: boolean;
  itemDescription: boolean;
  compressImages: boolean;
  ownerNameOnPrint: boolean;
  quantityDecimals: number;
  amountDecimals: number;
  dateFormat: DateFormat;
  language: PrintLanguage;
};

export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = {
  tinNumber: false,
  itemDescription: true,
  compressImages: true,
  ownerNameOnPrint: false,
  quantityDecimals: 2,
  amountDecimals: 2,
  dateFormat: 'dd-mm-yyyy',
  language: 'english',
};

/** Defaults for every section; they mirror the server's declarations in business-preferences.ts. */
export const PREFERENCE_DEFAULTS = {
  profile: { businessType:'',businessCategory:'',pincode:'' },
  general: DEFAULT_GENERAL_PREFERENCES,
  transaction: {
    billingName: true,
    eWayBill: true,
    autoRoundOff: false,
    negativeStock: true,
    showTimeOnTransaction: false,
    editPriceOnInvoice: true,
    additionalCharges: false,
    autoNumbering: true,
    numberingPrefix: 'invoice' as 'invoice' | 'bill' | 'none',
  },
  taxes: {
    taxType: 'igst-cgst-sgst' as 'igst-cgst-sgst' | 'igst' | 'cgst-sgst',
    roundOffTax: false,
    compositionScheme: false,
    reverseCharge: false,
  },
  message: {
    autoShareOnSave: false,
    invoiceMessage: 'Dear {PartyName}, thank you for your business. Your invoice {InvoiceNumber} of {Amount} is attached. — {FirmName}',
    paymentReminderMessage: 'Dear {PartyName}, this is a reminder that {Amount} is due against invoice {InvoiceNumber}. Please pay at your earliest convenience. — {FirmName}',
    estimateMessage: 'Dear {PartyName}, please find the estimate {EstimateNumber} for {Amount}. — {FirmName}',
  },
  party: {
    openingBalance: true,
    partyCategories: true,
    paymentReminders: true,
    defaultPaymentTermDays: 15,
    showGstinOnPrint: true,
  },
  item: {
    showMrp: true,
    showBrand: true,
    showBatch: true,
    showBarcode: true,
    showSerial: true,
    showCount: true,
    itemCategories: true,
    wholesalePrice: false,
    lowStockAlert: true,
    lowStockThreshold: 5,
  },
  printRegular: REGULAR_PRINT_DEFAULTS,
  printThermal: THERMAL_PRINT_DEFAULTS,
  printNames: TRANSACTION_NAME_DEFAULTS,
  printColumns: ITEM_TABLE_COLUMN_DEFAULTS,
};

export type PreferenceSection = keyof typeof PREFERENCE_DEFAULTS;
export type Preferences<S extends PreferenceSection> = (typeof PREFERENCE_DEFAULTS)[S];

const SECTIONS = Object.keys(PREFERENCE_DEFAULTS) as PreferenceSection[];

type Listener = () => void;
export type CompanyPreferences = Snapshot;
type Snapshot = { [S in PreferenceSection]: Preferences<S> };
export type SaveStatus = { state: 'idle' | 'saving' | 'saved' | 'error'; error: string };

const listeners = new Set<Listener>();
const statusListeners = new Set<Listener>();
let cache: { businessId: string | null; snapshot: Snapshot } | null = null;

function storageKey(businessId: string | null) {
  return `imart:preferences:${businessId ?? 'default'}`;
}

/** Keeps only known fields whose stored type matches the default; everything else falls back to the default. */
function mergeKnown<T extends Record<string, unknown>>(defaults: T, stored: unknown): T {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  const result: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (typeof source[key] === typeof defaults[key]) result[key] = source[key];
  }
  return result as T;
}

export function normalizePreferences(stored: unknown): Snapshot {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(
    SECTIONS.map((section) => [section, mergeKnown(PREFERENCE_DEFAULTS[section], source[section])]),
  ) as Snapshot;
}

function readCached(businessId: string | null): Snapshot {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    return normalizePreferences(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizePreferences(null);
  }
}

function current(): Snapshot {
  if (typeof window === 'undefined') return normalizePreferences(null);
  const businessId = getActiveBusinessId();
  if (!cache || cache.businessId !== businessId) cache = { businessId, snapshot: readCached(businessId) };
  return cache.snapshot;
}

/** Current values of one settings section for the active company. Safe to call during render. */
export function getPreferences<S extends PreferenceSection>(section: S): Preferences<S> {
  return current()[section];
}

export function getGeneralPreferences(): GeneralPreferences {
  return getPreferences('general');
}

export const getServerPreferences = <S extends PreferenceSection>(section: S): Preferences<S> => PREFERENCE_DEFAULTS[section];

export function subscribePreferences(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function replaceSnapshot(snapshot: Snapshot, businessId = getActiveBusinessId()) {
  if (businessId !== getActiveBusinessId()) {
    try { localStorage.setItem(storageKey(businessId), JSON.stringify(snapshot)); } catch { /* Storage unavailable. */ }
    return false;
  }
  const changedSections = SECTIONS.filter((section) => JSON.stringify(current()[section]) !== JSON.stringify(snapshot[section]));
  // Untouched sections keep their object identity so useSyncExternalStore consumers do not re-render.
  const next = Object.fromEntries(SECTIONS.map((section) => [section, changedSections.includes(section) ? snapshot[section] : current()[section]])) as Snapshot;
  cache = { businessId, snapshot: next };
  try { localStorage.setItem(storageKey(businessId), JSON.stringify(next)); } catch { /* Storage may be unavailable or full. */ }
  if (changedSections.length) listeners.forEach((listener) => listener());
  return changedSections.length > 0;
}

/** Loads the company's preferences from the server. Resolves true when they differ from the local copy. */
export async function syncPreferences(): Promise<boolean> {
  const businessId = getActiveBusinessId();
  if (!businessId) return false;
  const revision = revisions.get(businessId) ?? 0;
  const { data } = await api.get<unknown>(`/businesses/${businessId}/preferences`);
  if (revision !== (revisions.get(businessId) ?? 0) || pending.has(businessId) || inFlight.has(businessId)) return false;
  return replaceSnapshot(normalizePreferences(data), businessId);
}

type Patch = Partial<Record<PreferenceSection, Record<string, unknown>>>;
const pending = new Map<string, Patch>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();
const revisions = new Map<string, number>();
const statuses = new Map<string, SaveStatus>();
const IDLE: SaveStatus = { state: 'idle', error: '' };
function setStatus(next: SaveStatus, businessId: string) {
  statuses.set(businessId, next);
  if (businessId === getActiveBusinessId()) { statusListeners.forEach((listener) => listener()); }
}
export function getSaveStatus() { return statuses.get(getActiveBusinessId() ?? '') ?? IDLE; }
export function subscribeSaveStatus(listener: Listener) { statusListeners.add(listener); return () => { statusListeners.delete(listener); }; }
function applyPatch(snapshot: Snapshot, patch: Patch): Snapshot {
  return Object.fromEntries(SECTIONS.map((section) => [section, { ...snapshot[section], ...patch[section] }])) as Snapshot;
}
async function flush(businessId: string) {
  if (inFlight.has(businessId)) return;
  clearTimeout(timers.get(businessId));
  timers.delete(businessId);
  const batch = pending.get(businessId);
  if (!batch) return;
  pending.delete(businessId);
  inFlight.add(businessId);
  setStatus({ state: 'saving', error: '' }, businessId);
  try {
    const { data } = await api.patch<unknown>(`/businesses/${businessId}/preferences`, batch);
    // A server response must never overwrite edits made while this request ran.
    replaceSnapshot(applyPatch(normalizePreferences(data), pending.get(businessId) ?? {}), businessId);
    setStatus({ state: pending.has(businessId) ? 'saving' : 'saved', error: '' }, businessId);
  } catch (error: unknown) {
    try {
      const { data } = await api.get<unknown>(`/businesses/${businessId}/preferences`);
      replaceSnapshot(applyPatch(normalizePreferences(data), pending.get(businessId) ?? {}), businessId);
    } catch { /* Keep the local values visible with an explicit save error. */ }
    setStatus({ state: 'error', error: getApiError(error, 'Could not save your changes. Please retry.') }, businessId);
  } finally {
    inFlight.delete(businessId);
    if (pending.has(businessId)) void flush(businessId);
  }
}
export function updatePreferences<S extends PreferenceSection>(section: S, patch: Partial<Preferences<S>>) {
  const businessId = getActiveBusinessId();
  if (!businessId) return;
  revisions.set(businessId, (revisions.get(businessId) ?? 0) + 1);
  replaceSnapshot({ ...current(), [section]: { ...current()[section], ...patch } } as Snapshot, businessId);
  const previous = pending.get(businessId) ?? {};
  pending.set(businessId, { ...previous, [section]: { ...previous[section], ...patch } });
  setStatus({ state: 'saving', error: '' }, businessId);
  clearTimeout(timers.get(businessId));
  timers.set(businessId, setTimeout(() => void flush(businessId), 100));
}
export function resetPreferences<S extends PreferenceSection>(section: S) { updatePreferences(section, PREFERENCE_DEFAULTS[section]); }
if (typeof window !== 'undefined') {
  onWorkspaceChanged(() => {
    cache = null;
    listeners.forEach((listener) => listener());
    statusListeners.forEach((listener) => listener());
    void syncPreferences().catch(() => undefined);
  });
}
