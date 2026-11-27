'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useBackNavigation } from '@/lib/navigation';
import InvoiceForm from './InvoiceForm';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';

export default function InvoiceModal({ onClose }: { onClose?: () => void }) {
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { embedded } = useEmbeddedForm();

  // Closing goes back to wherever the editor was opened from (fallback: the invoice list), asking first
  // when the form has unsaved changes. An embedding page's own close handler is guarded the same way.
  const { goBack, confirmLeave } = useBackNavigation('/invoices');
  const handleClose = useCallback(() => {
    const parentClose = onCloseRef.current;
    if (parentClose) void confirmLeave().then((leave) => { if (leave) parentClose(); });
    else void goBack();
  }, [confirmLeave, goBack]);

  useEffect(() => {
    if (embedded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busyRef.current) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClose, embedded]);

  if (embedded) {
    return <InvoiceForm onClose={handleClose} onBusyChange={(busy) => { busyRef.current = busy; }} />;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Add invoice"
      className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden"
    >
      <InvoiceForm onClose={handleClose} onBusyChange={(busy) => { busyRef.current = busy; }} />
    </div>
  );
}
