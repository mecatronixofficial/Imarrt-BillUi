'use client';

import { ArrowLeft } from 'lucide-react';
import { useBackNavigation } from '@/lib/navigation';

// Kept for existing imports: the history tracking now lives in the central navigation module.
export { NavigationProvider as NavigationHistory, fallbackRoute as parentPage } from '@/lib/navigation';

/**
 * The app's one Back button. Goes to the page the user actually came from (with its filters, page and
 * scroll), asks before discarding unsaved changes, and uses `fallback` (or the module's parent page)
 * only when there is no previous page in this tab.
 */
export default function BackButton({ fallback, className = '', label = 'Back' }: { fallback?: string; className?: string; label?: string }) {
  const { goBack } = useBackNavigation(fallback);
  return (
    <button type="button" className={`brand-back ${className}`} aria-label={label === 'Back' ? 'Go back' : label} onClick={() => void goBack()}>
      <ArrowLeft size={17} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
