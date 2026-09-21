import { api, getActiveBusinessId, getApiError } from '@/lib/api';
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
  general: DEFAULT_GENERAL_PREFERENCES,
  transaction: {
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
type Snapshot = { [S in PreferenceSection]: Preferences<S> };
export type SaveStatus = { state: 'idle' | 'saving' | 'saved' | 'error'; error: string };

const listeners = new Set<Listener>();
const statusListeners = new Set<Listener>();
let cache: { businessId: string | null; snapshot: Snapshot } | null = null;
let status: SaveStatus = { state: 'idle', error: '' };

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

function buildSnapshot(stored: unknown): Snapshot {
  const source = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {};
  return Object.fromEntries(
    SECTIONS.map((section) => [section, mergeKnown(PREFERENCE_DEFAULTS[section], source[section])]),
  ) as Snapshot;
}

function readCached(businessId: string | null): Snapshot {
  try {
    const raw = localStorage.getItem(storageKey(businessId));
    return buildSnapshot(raw ? JSON.parse(raw) : null);
  } catch {
    return buildSnapshot(null);
  }
}

function current(): Snapshot {
  if (typeof window === 'undefined') return buildSnapshot(null);
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

function replaceSnapshot(snapshot: Snapshot) {
  const businessId = getActiveBusinessId();
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
  const { data } = await api.get<unknown>(`/businesses/${businessId}/preferences`);
  return replaceSnapshot(buildSnapshot(data));
}

// ---- Saving -------------------------------------------------------------

const SAVE_DELAY_MS = 500;
let pending: Partial<Record<PreferenceSection, Record<string, unknown>>> = {};
let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;

function setStatus(next: SaveStatus) {
  status = next;
  statusListeners.forEach((listener) => listener());
}

export function getSaveStatus() {
  return status;
}

export function subscribeSaveStatus(listener: Listener) {
  statusListeners.add(listener);
  return () => { statusListeners.delete(listener); };
}

async function flush() {
  if (inFlight) { timer = setTimeout(() => void flush(), SAVE_DELAY_MS); return; }
  const batch = pending;
  pending = {};
  timer = undefined;
  if (!Object.keys(batch).length) return;
  const businessId = getActiveBusinessId();
  if (!businessId) return;
  inFlight = true;
  setStatus({ state: 'saving', error: '' });
  try {
    const { data } = await api.patch<unknown>(`/businesses/${businessId}/preferences`, batch);
    replaceSnapshot(buildSnapshot(data));
    setStatus({ state: Object.keys(pending).length ? 'saving' : 'saved', error: '' });
  } catch (error: unknown) {
    pending = {};
    clearTimeout(timer);
    // Roll the optimistic values back to what the server has.
    await syncPreferences().catch(() => undefined);
    setStatus({ state: 'error', error: getApiError(error, 'Could not save your changes. They were not applied.') });
  } finally {
    inFlight = false;
  }
}

/** Applies a change immediately and saves it to the server shortly after (changes are batched). */
export function updatePreferences<S extends PreferenceSection>(section: S, patch: Partial<Preferences<S>>) {
  replaceSnapshot({ ...current(), [section]: { ...current()[section], ...patch } } as Snapshot);
  pending = { ...pending, [section]: { ...pending[section], ...patch } };
  setStatus({ state: 'saving', error: '' });
  clearTimeout(timer);
  timer = setTimeout(() => void flush(), SAVE_DELAY_MS);
}

export function resetPreferences<S extends PreferenceSection>(section: S) {
  updatePreferences(section, PREFERENCE_DEFAULTS[section]);
}
