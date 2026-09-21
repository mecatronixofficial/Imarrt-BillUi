'use client';

import type { ReactNode } from 'react';
import PageHeader from '@/components/PageHeader';
import { SettingsAccess } from '@/components/settings/SettingsControls';

export default function PreferencesLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Preferences" description="Defaults applied across invoices, print-outs, tax, messaging, parties, and items." />
      <div className="min-w-0 space-y-4"><SettingsAccess>{children}</SettingsAccess></div>
    </>
  );
}
