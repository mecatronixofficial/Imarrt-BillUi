'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { PASSCODE_NOT_CONFIGURED, registerPasscodeHandler } from '@/lib/actionPasscode';
import { onWorkspaceChanged } from '@/lib/api';
import Modal from './Modal';

type Challenge = Parameters<Parameters<typeof registerPasscodeHandler>[0]>[0];

export default function ActionPasscodePrompt() {
  const [queue, setQueue] = useState<Challenge[]>([]);
  const pending = useRef<Challenge[]>([]);
  const [passcode, setPasscode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    const unregister = registerPasscodeHandler((challenge) => {
      pending.current = [...pending.current, challenge];
      setQueue(pending.current);
    });
    return () => {
      unregister();
      pending.current.forEach((challenge) => challenge.resolve(null));
      pending.current = [];
    };
  }, []);

  useEffect(() => {
    const cancel = () => {
      pending.current.forEach((challenge) => challenge.resolve(null));
      pending.current = [];
      setQueue([]);
      setPasscode('');
    };
    cancel();
    return onWorkspaceChanged(cancel);
  }, [pathname]);

  function finish(value: string | null) {
    const [challenge, ...rest] = pending.current;
    pending.current = rest;
    setQueue(rest);
    setPasscode('');
    challenge?.resolve(value);
  }

  if (!queue.length) return null;
  const action = queue[0].action;
  const deletingParty = action === 'delete-party';
  const deleting = deletingParty || action === 'delete';
  const editingParty = action === 'edit-party';
  const message = deletingParty ? 'Enter your Settings passcode to confirm deletion of this party.'
    : editingParty ? 'Enter your Settings passcode to save changes to this party.'
    : deleting ? 'Enter your Settings passcode to confirm this deletion.'
    : 'Enter your Settings passcode to save this edit.';
  if (queue[0].message === PASSCODE_NOT_CONFIGURED) {
    return <Modal title="Set up a passcode first" size="sm" onClose={() => finish(null)}>
      <div className="space-y-4">
        <p className="text-sm text-slate-600">{deletingParty ? 'Deleting a party' : 'Editing a party'} needs your Settings passcode. You haven&apos;t set one yet, so nothing was changed.</p>
        <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => finish(null)}>Cancel</button><Link href="/settings/passcode" className="btn-primary" onClick={() => finish(null)}>Set passcode</Link></div>
      </div>
    </Modal>;
  }
  return <Modal title="Passcode required" size="sm" initialFocusRef={inputRef} onClose={() => finish(null)}>
    <form onSubmit={(event) => { event.preventDefault(); finish(passcode); }} className="space-y-4">
      <p className="text-sm text-slate-600">{message}</p>
      {queue[0].message === 'PASSCODE_INVALID' && <p role="alert" className="text-sm text-red-600">Incorrect passcode. Try again.</p>}
      <label className="block"><span className="label">Passcode</span><input ref={inputRef} className="input-field" aria-label="Action passcode" type="password" inputMode="numeric" autoComplete="off" minLength={6} maxLength={12} pattern="[0-9]{6,12}" required value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => finish(null)}>Cancel</button><button className="btn-primary" type="submit">{deleting ? 'Verify & delete' : 'Verify & save changes'}</button></div>
    </form>
  </Modal>;
}
