'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import InvoiceForm from './InvoiceForm';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';

export default function InvoiceModal({ onClose }: { onClose?: () => void }) {
  const router = useRouter();
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { embedded } = useEmbeddedForm();

  const handleClose = useCallback(() => {
    if (onCloseRef.current) {
      onCloseRef.current();
    } else {
      router.push('/invoices');
    }
  }, [router]);

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
