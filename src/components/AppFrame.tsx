'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import DashboardShell from './DashboardShell';
import { ToastProvider } from './ToastProvider';
import BackButton from './BackButton';
import { NavigationProvider } from '@/lib/navigation';
import ActionPasscodePrompt from './ActionPasscodePrompt';

const FULL_BLEED_ROUTES = new Set(['/items', '/parties/details']);
// Routes that just need the 1440px width cap lifted, keeping the shell's own padding.
const WIDE_ROUTE_PREFIXES = ['/production'];
// Public routes rendered without the authenticated dashboard shell (sidebar, session check).
const PUBLIC_ROUTES = new Set(['/', '/login', '/forgot-password', '/reset-password']);

export default function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (PUBLIC_ROUTES.has(pathname)) return <NavigationProvider><ToastProvider>{pathname !== '/' && <BackButton className="brand-public-back" />}{children}</ToastProvider></NavigationProvider>;

  const isFullBleed = FULL_BLEED_ROUTES.has(pathname);
  const isWide = WIDE_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const contentClassName = isFullBleed ? '!max-w-none !p-0' : isWide ? '!max-w-none' : '!max-w-none';

  return (
    <NavigationProvider><ToastProvider>
      <ActionPasscodePrompt />
      <DashboardShell contentClassName={contentClassName}>
        {children}
      </DashboardShell>
    </ToastProvider></NavigationProvider>
  );
}
