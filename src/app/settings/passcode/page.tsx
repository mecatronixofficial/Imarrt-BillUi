'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { api, getApiError } from '@/lib/api';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import { toast } from '@/components/ToastProvider';

export default function PasscodeSettingsPage() {
  const [status, setStatus] = useState<{ enabled: boolean } | null>(null);
  const [passcode, setPasscode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    setError('');
    try { setStatus((await api.get<{ enabled: boolean }>('/action-security')).data); }
    catch (reason) { setError(getApiError(reason, 'Could not load passcode settings.')); }
  }
  useEffect(() => { void load(); }, []);

  async function save(enabled: boolean) {
    if (enabled && (!/^[0-9]{6,12}$/.test(passcode) || passcode !== confirmation)) {
      setError('Enter matching passcodes of 6–12 digits.');
      return;
    }
    setBusy(true); setError('');
    try {
      const { data } = await api.put<{ enabled: boolean }>('/action-security', { enabled, ...(enabled ? { passcode } : {}) });
      setStatus(data); setPasscode(''); setConfirmation('');
      toast.success(enabled ? 'Passcode saved' : 'Passcode disabled');
    } catch (reason) { setError(getApiError(reason, 'Could not save passcode settings.')); }
    finally { setBusy(false); }
  }

  return <><PageHeader title="Add & edit passcode" />
    <section className="card max-w-xl space-y-5 p-6">
      <p className="text-sm text-slate-600">Your passcode protects edits and deletions throughout the project (items, parties, party groups and all other records), across all companies you use. Adding new records does not ask for it. It is stored securely on the server for your account.</p>
      {!status ? error ? <ErrorState message={error} onRetry={() => void load()} /> : <LoadingState label="Loading passcode settings..." /> : <>
        <p className="text-sm font-semibold">Protection: {status.enabled ? 'Enabled' : 'Not configured'}</p>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <form className="space-y-4" onSubmit={(event: FormEvent) => { event.preventDefault(); void save(true); }}>
          <label className="block"><span className="label">{status.enabled ? 'New passcode' : 'Passcode'} (6–12 digits)</span><input className="input-field" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={passcode} onChange={(event) => setPasscode(event.target.value)} /></label>
          <label className="block"><span className="label">Confirm passcode</span><input className="input-field" type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{6,12}" minLength={6} maxLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {status.enabled && <p className="text-xs text-slate-500">Your current passcode is required to change or disable protection.</p>}
          <div className="flex flex-wrap gap-3"><button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving...' : status.enabled ? 'Change passcode' : 'Enable passcode'}</button>{status.enabled && <button type="button" className="btn-secondary" disabled={busy} onClick={() => void save(false)}>Disable passcode</button>}</div>
        </form>
      </>}
    </section>
  </>;
}
