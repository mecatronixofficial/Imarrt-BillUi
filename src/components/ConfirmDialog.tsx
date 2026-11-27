'use client';

import Modal from '@/components/Modal';

export default function ConfirmDialog({
  title,
  message,
  error,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  busy = false,
  busyLabel = 'Deleting...',
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  error?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  busyLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title={title} onClose={() => { if (!busy) onCancel(); }} size="sm">
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{message}</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" disabled={busy} onClick={onCancel} className="btn-secondary">{cancelLabel}</button>
          <button type="button" disabled={busy} onClick={onConfirm} className="inline-flex min-w-24 items-center justify-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700 disabled:opacity-60">
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
