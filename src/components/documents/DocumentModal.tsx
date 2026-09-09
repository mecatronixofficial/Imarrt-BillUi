'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import DocumentForm from './DocumentForm';
import { useEmbeddedForm } from '@/components/EmbeddedFormContext';
import type { BusinessDocumentType } from '@/types';
import { DOCUMENT_CONFIG } from '@/lib/documents';

export type DocumentModalProps = {
  type?: BusinessDocumentType;
  onClose?: () => void;
  allowTypeSwitch?: boolean;
  onTypeChange?: (type: BusinessDocumentType) => void;
};

export default function DocumentModal({
  type = 'QUOTATION',
  onClose,
  allowTypeSwitch = false,
  onTypeChange,
}: DocumentModalProps) {
  const router = useRouter();
  const busyRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const { embedded } = useEmbeddedForm();
  const config = DOCUMENT_CONFIG[type];

  const handleClose = useCallback(() => {
    if (onCloseRef.current) {
      onCloseRef.current();
    } else {
      router.push('/documents');
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
    return (
      <DocumentForm
        type={type}
        onClose={handleClose}
        allowTypeSwitch={allowTypeSwitch}
        onTypeChange={onTypeChange}
        onBusyChange={(busy) => {
          busyRef.current = busy;
        }}
      />
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${config.label}`}
      className="fixed inset-0 z-50 flex flex-col bg-white overflow-hidden"
    >
      <DocumentForm
        type={type}
        onClose={handleClose}
        allowTypeSwitch={allowTypeSwitch}
        onTypeChange={onTypeChange}
        onBusyChange={(busy) => {
          busyRef.current = busy;
        }}
      />
    </div>
  );
}
