'use client';

import { useSyncExternalStore } from 'react';
import {
  getPreferences,
  getSaveStatus,
  getServerPreferences,
  resetPreferences,
  subscribePreferences,
  subscribeSaveStatus,
  updatePreferences,
  type PreferenceSection,
  type Preferences,
  type SaveStatus,
} from '@/lib/preferences';

/** Reactive values of one settings section for the active company (defaults during server render). */
export function usePreferences<S extends PreferenceSection>(section: S): Preferences<S> {
  return useSyncExternalStore(subscribePreferences, () => getPreferences(section), () => getServerPreferences(section));
}

/** Same shape the Settings pages used with browser storage: { value, update, reset }, now saved per company on the server. */
export function useCompanySettings<S extends PreferenceSection>(section: S) {
  const value = usePreferences(section);
  return {
    value,
    update: <K extends keyof Preferences<S>>(field: K, fieldValue: Preferences<S>[K]) => updatePreferences(section, { [field]: fieldValue } as unknown as Partial<Preferences<S>>),
    reset: () => resetPreferences(section),
  };
}

export function useSaveStatus(): SaveStatus {
  return useSyncExternalStore(subscribeSaveStatus, getSaveStatus, getSaveStatus);
}

/** Back-compat helper for the General section. */
export function useGeneralPreferences() {
  return usePreferences('general');
}
