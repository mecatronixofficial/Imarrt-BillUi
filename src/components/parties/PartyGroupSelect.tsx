'use client';

import { useEffect, useState } from 'react';
import { api, getApiError } from '@/lib/api';
import type { PartyGroup } from '@/types';

export default function PartyGroupSelect({ value, legacyName, onChange }: { value: string; legacyName?: string; onChange: (id: string, name: string) => void }) {
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setGroups((await api.get<PartyGroup[]>('/party-groups')).data); }
    catch (reason) { setError(getApiError(reason, 'Could not load party groups.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setBusy(true); setError('');
    try {
      const { data } = await api.post<PartyGroup>('/party-groups', { name: name.trim() });
      setGroups((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      onChange(data.id, data.name); setAdding(false); setName('');
    } catch (reason) { setError(getApiError(reason, 'Could not create party group.')); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    <select aria-label="Party Group" className="input-field" value={value} disabled={loading || busy} onChange={(event) => onChange(event.target.value, groups.find((group) => group.id === event.target.value)?.name ?? '')}>
      <option value="">{loading ? 'Loading groups...' : 'No group'}</option>
      {value && !groups.some((group) => group.id === value) && <option value={value}>{legacyName || 'Current group'}</option>}
      {groups.map((group) => <option key={group.id} value={group.id}>{group.code ? `${group.code} · ${group.name}` : group.name}</option>)}
    </select>
    {error && <div role="alert" className="text-xs text-red-600">{error} <button type="button" className="underline" onClick={() => void load()}>Retry</button></div>}
    {adding ? <div className="space-y-2 rounded-lg border border-blue-100 bg-blue-50 p-2">
      <input aria-label="New party group name" className="input-field" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="Group name" onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); void create(); } }} />
      <div className="flex gap-2"><button type="button" className="text-xs font-semibold text-blue-700" disabled={busy || !name.trim()} onClick={() => void create()}>{busy ? 'Adding...' : 'Add Party Group'}</button><button type="button" className="text-xs text-slate-500" disabled={busy} onClick={() => setAdding(false)}>Cancel</button></div>
    </div> : <button type="button" className="text-xs font-semibold text-blue-600" onClick={() => setAdding(true)}>+ Add Party Group</button>}
  </div>;
}