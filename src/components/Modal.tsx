'use client';

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  size?: 'sm' | 'md' | 'lg' | 'full';
  className?: string;
  initialFocusRef?: RefObject<HTMLElement>;
};

export default function Modal({ title, children, onClose, size = 'md', className = '', initialFocusRef }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab') return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    const frame = window.requestAnimationFrame(() => {
      (initialFocusRef?.current ?? dialogRef.current?.querySelector<HTMLElement>('button, input, select, textarea, a[href]'))?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(frame);
      previouslyFocused?.focus();
    };
  }, [initialFocusRef]);

  if (!mounted) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm ${size === 'full' ? 'p-0' : 'px-4 py-5'}`} onMouseDown={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onMouseDown={(event) => event.stopPropagation()}
        className={`max-h-full w-full overflow-y-auto bg-white p-5 shadow-2xl ${size === 'full' ? 'h-full max-w-none rounded-xl border border-white/70 sm:p-6' : `rounded-2xl border border-white/70 ${size === 'sm' ? 'max-w-sm' : size === 'lg' ? 'max-w-3xl' : 'max-w-md'}`} ${className}`}
      >
        <div className={`mb-4 flex items-center justify-between gap-4 ${size === 'full' ? 'mx-auto max-w-6xl' : ''}`}>
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-slate-950">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Close dialog">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className={size === 'full' ? 'mx-auto max-w-6xl' : ''}>{children}</div>
      </section>
    </div>,
    document.body,
  );
}
