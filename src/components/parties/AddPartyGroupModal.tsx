'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Modal from '@/components/Modal';
import { toast } from '@/components/ToastProvider';
import { api, getApiError } from '@/lib/api';
import type { PartyGroup } from '@/types';
import { codeSet, isCodeTaken } from '@/lib/codes';
import { useNextGroupCode } from './useNextGroupCode';

export default function AddPartyGroupModal({ onClose, onSaved }: { onClose: () => void; onSaved: (group: PartyGroup) => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const { generating, generate } = useNextGroupCode(setCode);

  const [takenCodes, setTakenCodes] = useState<Set<string>>(new Set());
  const codeTaken = isCodeTaken(code, takenCodes);

  useEffect(() => { void generate(); }, [generate]);
  useEffect(() => {
    // Existing codes for the duplicate warning; the server still rejects any duplicate on save.
    api.get<PartyGroup[]>('/party-groups').then(({ data }) => setTakenCodes(codeSet(data))).catch(() => undefined);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (saving || codeTaken || !name.trim()) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post<PartyGroup>('/party-groups', { name: name.trim(), code: code.trim() || undefined });
      toast.success('Party group created', { description: data.code ? `${data.code} · ${data.name}` : data.name });
      onSaved(data);
    } catch (reason) {
      setError(getApiError(reason, 'Could not create party group.'));
    } finally {
      setSaving(false);
    }
  }

  return <Modal title="Add Party Group" size="sm" onClose={() => { if (!saving) onClose(); }}>
    <form onSubmit={save} className="space-y-4">
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <GroupCodeField value={code} generating={generating} disabled={saving} taken={codeTaken} onChange={setCode} onGenerate={() => void generate()} />
      <label className="block"><span className="label">Group name</span><input autoFocus aria-label="Party group name" className="input-field" required maxLength={60} disabled={saving} value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter party group name" /></label>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" disabled={saving} onClick={onClose}>Cancel</button><button type="submit" className="btn-primary" disabled={saving || codeTaken || !name.trim()}>{saving ? 'Adding...' : 'Add Party Group'}</button></div>
    </form>
  </Modal>;
}

export function GroupCodeField({ value, generating, disabled, taken = false, onChange, onGenerate }: { value: string; generating: boolean; disabled?: boolean; taken?: boolean; onChange: (code: string) => void; onGenerate?: () => void }) {
  return <label className="block"><span className="label">Group code</span><div className="flex gap-2">
    <input aria-label="Party group code" aria-invalid={taken} className={`input-field ${taken ? '!border-red-500' : ''}`} maxLength={30} disabled={disabled || generating} value={value} onChange={(event) => onChange(event.target.value)} placeholder={generating ? 'Generating...' : 'Auto-generated'} />
    {onGenerate && <button type="button" className="whitespace-nowrap text-xs font-semibold text-blue-600 disabled:opacity-50" disabled={disabled || generating} onClick={onGenerate}>Generate</button>}
  </div>{taken && <p role="alert" className="mt-1 text-xs text-red-600">Group code {value.trim()} already exists. Enter a different code.</p>}</label>;
}
