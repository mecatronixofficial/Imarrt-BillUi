'use client';

import { useEffect, useMemo, useState } from 'react';
import { getActiveBusinessId } from '@/lib/api';

/**
 * Persists a settings object to localStorage under the given key.
 * Values are UI-only (no backend endpoint exists for these preferences yet),
 * so they are scoped to this browser and merged over the provided defaults.
 */
export function useLocalSettings<T extends Record<string, unknown>>(key: string, defaults: T) {
  const [value, setValue] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const storageKey = useMemo(() => {
    const businessId = typeof window === 'undefined' ? 'default' : getActiveBusinessId() ?? 'default';
    return `imart:settings:${businessId}:${key}`;
  }, [key]);

  useEffect(() => {
    try {
      const legacyKey = `imart:settings:${key}`;
      const stored = localStorage.getItem(storageKey) ?? localStorage.getItem(legacyKey);
      if (stored) setValue({ ...defaults, ...(JSON.parse(stored) as Partial<T>) });
    } catch {
      // ignore malformed local storage
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    function syncSettings(event: StorageEvent) {
      if (event.key !== storageKey || !event.newValue) return;
      try { setValue({ ...defaults, ...(JSON.parse(event.newValue) as Partial<T>) }); } catch { /* Ignore invalid external values. */ }
    }
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, [defaults, storageKey]);

  useEffect(() => {
    if (!loaded) return;
    try { localStorage.setItem(storageKey, JSON.stringify(value)); } catch { /* Storage may be unavailable or full. */ }
  }, [loaded, storageKey, value]);

  function update<K extends keyof T>(field: K, fieldValue: T[K]) {
    setValue((current) => ({ ...current, [field]: fieldValue }));
  }

  function reset() {
    setValue(defaults);
  }

  return { value, update, reset, loaded };
}
