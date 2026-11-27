'use client';

import { useCallback, useState } from 'react';
import { api } from '@/lib/api';

/** Fetches the next free "G-0001" style party group code from the server. */
export function useNextGroupCode(onCode: (code: string) => void) {
  const [generating, setGenerating] = useState(false);
  const generate = useCallback(async () => {
    setGenerating(true);
    try {
      const { data } = await api.get<{ code: string }>('/party-groups/next-code');
      onCode(data.code);
    } catch {
      // Leave the field as is; the server generates a code when it is blank.
    } finally {
      setGenerating(false);
    }
  }, [onCode]);
  return { generating, generate };
}
