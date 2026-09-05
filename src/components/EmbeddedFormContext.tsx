'use client';

import { createContext, useContext } from 'react';
import type { BusinessDocumentType } from '@/types';

type EmbeddedFormOptions = {
  embedded?: boolean;
  initialPartyId?: string;
  initialType?: BusinessDocumentType;
};

const EmbeddedFormContext = createContext<EmbeddedFormOptions>({});

export function EmbeddedFormProvider({ value, children }: { value: EmbeddedFormOptions; children: React.ReactNode }) {
  return <EmbeddedFormContext.Provider value={value}>{children}</EmbeddedFormContext.Provider>;
}

export function useEmbeddedForm() {
  return useContext(EmbeddedFormContext);
}
