'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';
import { GroupCodeField } from '@/components/parties/AddPartyGroupModal';
import { useNextGroupCode } from '@/components/parties/useNextGroupCode';
import { codeSet, isCodeTaken } from '@/lib/codes';
import { EmptyState, ErrorState, LoadingState } from '@/components/ContentState';
import { api, getAllPages, getApiError, getCurrentUser } from '@/lib/api';
import { toast } from '@/components/ToastProvider';
import type { Party, PartyGroup } from '@/types';
import { usePageState } from '@/lib/navigation';

export default function PartyGroupsPage() {
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = usePageState('groups.query', '');
  const [form, setForm] = useState<{ id?: string; name: string; code: string } | null>(null);
  const setFormCode = useCallback((code: string) => setForm((current) => current ? { ...current, code } : current), []);
  const { generating: generatingCode, generate: generateCode } = useNextGroupCode(setFormCode);
  const [removing, setRemoving] = useState<PartyGroup | null>(null);
  const [members, setMembers] = useState<PartyGroup | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [memberQuery, setMemberQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [canDelete, setCanDelete] = useState(false);
  const formCodeTaken = form ? isCodeTaken(form.code, codeSet(groups, form.id)) : false;

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [groupResponse, partyResponse] = await Promise.all([api.get<PartyGroup[]>('/party-groups'), getAllPages<Party>('/parties')]);
      setGroups(groupResponse.data); setParties(partyResponse.data);
    } catch (reason) { setError(getApiError(reason, 'Could not load party groups.')); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); void getCurrentUser().then((user) => setCanDelete(user?.role === 'OWNER' || user?.role === 'SUPER_ADMIN')); }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!form || busy || formCodeTaken) return;
    setBusy(true); setFormError('');
    try {
      if (form.id) await api.patch('/party-groups/' + form.id, { name: form.name.trim(), code: form.code.trim() || undefined });
      else await api.post('/party-groups', { name: form.name.trim(), code: form.code.trim() || undefined });
      setForm(null); toast.success('Party group saved'); await load();
    } catch (reason) { setFormError(getApiError(reason, 'Could not save party group.')); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!removing || busy) return;
    setBusy(true); setFormError('');
    try { await api.delete('/party-groups/' + removing.id); setRemoving(null); toast.success('Party group deleted'); await load(); }
    catch (reason) { setFormError(getApiError(reason, 'Could not delete party group.')); }
    finally { setBusy(false); }
  }
  async function saveMembers() {
    if (!members || busy) return;
    setBusy(true); setFormError('');
    try {
      await api.patch('/party-groups/' + members.id + '/parties', { partyIds: selected });
      setMembers(null); toast.success('Group parties updated'); await load();
    } catch (reason) { setFormError(getApiError(reason, 'Could not update group parties.')); }
    finally { setBusy(false); }
  }

  return <><PageHeader title="Party groups" action={<button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => { setForm({ name: '', code: '' }); setFormError(''); void generateCode(); }}><Plus size={16} /> Add party group</button>} />
    <section className="card space-y-4 p-5">
      <p className="text-sm text-slate-500">Create groups, then add parties to them. Each party belongs to one group. Groups are shared with the party records in the selected branch.</p>
      <input className="input-field max-w-sm" aria-label="Search party groups" placeholder="Search groups..." value={query} onChange={(event) => setQuery(event.target.value)} />
      {loading ? <LoadingState label="Loading party groups..." /> : error ? <ErrorState message={error} onRetry={() => void load()} /> : !groups.length ? <EmptyState icon={Users} title="No party groups yet" description="Add a group such as Retail, Wholesale, or Distributors." /> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-slate-500"><th className="p-3">Code</th><th className="p-3">Group</th><th className="p-3">Parties</th><th className="p-3">Actions</th></tr></thead><tbody>{groups.filter((group) => [group.name, group.code].some((value) => value?.toLowerCase().includes(query.toLowerCase()))).map((group) => <tr key={group.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs text-slate-600">{group.code || '—'}</td><td className="p-3 font-semibold"><Link className="text-blue-600" href={'/parties/details?group=' + group.id}>{group.name}</Link></td><td className="p-3">{group.partyCount ?? 0}</td><td className="flex flex-wrap gap-4 p-3">
        <button type="button" className="inline-flex items-center gap-1 text-blue-600" onClick={() => { setMembers(group); setSelected(parties.filter((party) => party.groupId === group.id).map((party) => party.id)); setMemberQuery(''); setFormError(''); }}><Users size={15} /> Add / remove parties</button>
        <button type="button" aria-label={'Edit ' + group.name} onClick={() => { setForm({ id: group.id, name: group.name, code: group.code ?? '' }); setFormError(''); }}><Pencil size={15} /></button>
        {canDelete && <button type="button" aria-label={'Delete ' + group.name} onClick={() => { setRemoving(group); setFormError(''); }}><Trash2 size={15} /></button>}
      </td></tr>)}</tbody></table></div>}
      <Link href="/parties/details" className="inline-block text-sm font-semibold text-blue-600">View parties</Link>
    </section>
    {form && <Modal title={form.id ? 'Edit party group' : 'Add party group'} size="sm" onClose={() => { if (!busy) setForm(null); }}><form onSubmit={save} className="space-y-4">
      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      <GroupCodeField value={form.code} generating={generatingCode} disabled={busy} taken={formCodeTaken} onChange={(code) => setForm({ ...form, code })} onGenerate={form.id ? undefined : () => void generateCode()} />
      <label className="block"><span className="label">Group name</span><input className="input-field" autoFocus required maxLength={60} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <button type="submit" className="btn-primary" disabled={busy || formCodeTaken || !form.name.trim()}>{busy ? 'Saving...' : 'Save group'}</button>
    </form></Modal>}
    {members && <Modal title={'Parties in ' + members.name} onClose={() => { if (!busy) setMembers(null); }}><div className="space-y-4">
      <p className="text-xs text-slate-500">Selecting a party moves it from its previous group. Unchecking removes it from this group.</p>
      {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
      <input className="input-field" aria-label="Search parties to group" placeholder="Search parties..." value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} />
      <div className="max-h-80 space-y-2 overflow-y-auto">{parties.filter((party) => [party.name, party.phone, party.group].some((value) => value?.toLowerCase().includes(memberQuery.toLowerCase()))).map((party) => <label key={party.id} className="flex items-center gap-3 rounded-lg border p-3 text-sm"><input type="checkbox" checked={selected.includes(party.id)} disabled={busy} onChange={(event) => setSelected((current) => event.target.checked ? [...current, party.id] : current.filter((id) => id !== party.id))} /><span>{party.name}<small className="block text-slate-500">{party.group || 'No group'}</small></span></label>)}</div>
      <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveMembers()}>{busy ? 'Saving...' : `Save ${selected.length} parties`}</button>
    </div></Modal>}
    {removing && <ConfirmDialog title="Delete party group?" message={formError || ('Delete ' + removing.name + '? Groups with parties must be emptied first.')} confirmLabel="Delete group" busy={busy} onConfirm={() => void remove()} onCancel={() => { if (!busy) setRemoving(null); }} />}
  </>;
}