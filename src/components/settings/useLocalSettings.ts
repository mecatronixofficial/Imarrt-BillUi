'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Persists a settings object to localStorage under the given key.
 * Values are UI-only (no backend endpoint exists for these preferences yet),
 * so they are scoped to this browser and merged over the provided defaults.
 */
export function useLocalSettings<T extends Record<string, unknown>>(key: string, defaults: T) {
  const [value, setValue] = useState<T>(defaults);
  const [loaded, setLoaded] = useState(false);
  const storageKey = useRef(`imart:settings:${key}`).current;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) setValue({ ...defaults, ...(JSON.parse(stored) as Partial<T>) });
    } catch {
      // ignore malformed local storage
    } finally {
      setLoaded(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(storageKey, JSON.stringify(value));
  }, [loaded, storageKey, value]);

  function update<K extends keyof T>(field: K, fieldValue: T[K]) {
    setValue((current) => ({ ...current, [field]: fieldValue }));
  }

  function reset() {
    setValue(defaults);
  }

  return { value, update, reset, loaded };
}
