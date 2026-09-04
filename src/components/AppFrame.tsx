'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardShell from './DashboardShell';

const FULL_BLEED_ROUTES = new Set(['/items', '/parties']);

export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname === '/' || pathname === '/login') return children;

  return (
    <DashboardShell contentClassName={FULL_BLEED_ROUTES.has(pathname) ? '!max-w-none !p-0' : ''}>
      {children}
    </DashboardShell>
  );
}
