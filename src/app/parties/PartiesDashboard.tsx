'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, FolderOpen, Plus, RefreshCw, Users, Wallet } from 'lucide-react';
import { api, getAllPages, getApiError } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import { buildPartyOverview } from '@/lib/party-dashboard';
import type { Party, PartyGroup } from '@/types';
import PageHeader from '@/components/PageHeader';
import { ErrorState, LoadingState } from '@/components/ContentState';
import AddPartyGroupModal from '@/components/parties/AddPartyGroupModal';
import styles from './PartiesDashboard.module.css';

export default function PartiesDashboard() {
  const [parties, setParties] = useState<Party[]>([]);
  const [groups, setGroups] = useState<PartyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [partyError, setPartyError] = useState('');
  const [groupError, setGroupError] = useState('');
  const [addingGroup, setAddingGroup] = useState(false);
  const generation = useRef(0);

  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setPartyError(''); setGroupError('');
    const [partyResult, groupResult] = await Promise.allSettled([getAllPages<Party>('/parties'), api.get<PartyGroup[]>('/party-groups')]);
    if (request !== generation.current) return;
    if (partyResult.status === 'fulfilled') setParties(partyResult.value.data);
    else { setParties([]); setPartyError(getApiError(partyResult.reason, 'Could not load party details.')); }
    if (groupResult.status === 'fulfilled') setGroups(groupResult.value.data);
    else { setGroups([]); setGroupError(getApiError(groupResult.reason, 'Could not load party groups.')); }
    setLoading(false);
  }, []);
  useEffect(() => { void load(); return () => { generation.current += 1; }; }, [load]);
  const overview = useMemo(() => buildPartyOverview(parties, groups), [parties, groups]);
  const partyValue = (value: string | number) => loading || partyError ? '—' : value;
  const groupValue = loading || groupError ? '—' : overview.groupCount;

  return <div className={styles.dashboard}>
    <PageHeader title="Parties dashboard" action={<div className={styles.actions}>
      <button type="button" className="btn-primary inline-flex items-center gap-2 whitespace-nowrap" onClick={() => setAddingGroup(true)}><Plus size={16} /> Add Party Group</button>
      <Link className="btn-primary inline-flex items-center gap-2 whitespace-nowrap" href="/parties/details?create=1"><Plus size={16} /> Add Party</Link>
    </div>} />
    <div className={styles.content}>
      <div className={styles.intro}><p>Manage your parties and groups in one place.</p><button type="button" className={styles.refresh} disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh</button></div>
      <section className={styles.metrics} aria-label="Party overview">
        <article className={styles.metric}><span className={styles.metricIcon}><Users size={20} /></span><div><p>Total parties</p><strong>{partyValue(overview.partyCount)}</strong><small>{partyValue(overview.ungroupedCount)} without a group</small></div></article>
        <article className={styles.metric}><span className={styles.metricIcon}><FolderOpen size={20} /></span><div><p>Party groups</p><strong>{groupValue}</strong><small>Organise your party records</small></div></article>
        <article className={styles.metric}><span className={styles.receiveIcon}><ArrowDownLeft size={20} /></span><div><p>To receive</p><strong>{partyValue(formatCurrency(overview.receivable))}</strong><small>Outstanding party balances</small></div></article>
        <article className={styles.metric}><span className={styles.payIcon}><ArrowUpRight size={20} /></span><div><p>To pay</p><strong>{partyValue(formatCurrency(overview.payable))}</strong><small>Payable party balances</small></div></article>
      </section>
      <section className={styles.workspaces} aria-label="Party workspaces">
        <Link href="/parties/details" className={styles.workspace}><span className={styles.workspaceIcon}><Users size={27} /></span><div><h2>Party Details</h2><p>View profiles, contact details, balances, and transaction history.</p><span className={styles.open}>Open Party Details <ArrowRight size={16} /></span></div></Link>
        <Link href="/parties/groups" className={styles.workspace}><span className={styles.workspaceIcon}><FolderOpen size={27} /></span><div><h2>Party Groups</h2><p>Create groups, organise parties, and manage group membership.</p><span className={styles.open}>Open Party Groups <ArrowRight size={16} /></span></div></Link>
      </section>
      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="party-balances-heading"><header><div><Wallet size={18} /><h2 id="party-balances-heading">Outstanding balances</h2></div><Link href="/parties/details">View all <ArrowRight size={14} /></Link></header>
          {loading ? <LoadingState label="Loading party balances..." /> : partyError ? <ErrorState message={partyError} onRetry={() => void load()} /> : overview.outstanding.length ? <ul className={styles.rows}>{overview.outstanding.map((party) => <li key={party.id}><Link href={'/parties/' + party.id}><span><b>{party.name}</b><small>{party.group || 'No group'}</small></span><strong className={styles.balance}>{formatCurrency(party.balanceDue ?? 0)}</strong><ArrowRight size={15} /></Link></li>)}</ul> : <p className={styles.empty}>{parties.length ? 'No outstanding receivables.' : 'No parties yet. Add your first party to get started.'}</p>}
        </section>
        <section className={styles.panel} aria-labelledby="party-groups-heading"><header><div><FolderOpen size={18} /><h2 id="party-groups-heading">Groups at a glance</h2></div><Link href="/parties/groups">Manage <ArrowRight size={14} /></Link></header>
          {loading ? <LoadingState label="Loading party groups..." /> : groupError || partyError ? <ErrorState message={groupError || partyError} onRetry={() => void load()} /> : overview.groups.length ? <ul className={styles.rows}>{overview.groups.slice(0, 5).map((group) => <li key={group.id}><Link href={'/parties/details?group=' + encodeURIComponent(group.id)}><span className={styles.groupMarker}><FolderOpen size={17} /></span><span><b>{group.name}</b><small>{group.code ? `${group.code} · ` : ''}{group.count} {group.count === 1 ? 'party' : 'parties'}</small></span><ArrowRight size={15} /></Link></li>)}</ul> : <div className={styles.empty}><p>No party groups yet.</p><button type="button" className={styles.textButton} onClick={() => setAddingGroup(true)}>Add Party Group <Plus size={14} /></button></div>}
          {!loading && !partyError && overview.ungroupedCount > 0 && <Link className={styles.ungrouped} href="/parties/details?group=ungrouped">{overview.ungroupedCount} {overview.ungroupedCount === 1 ? 'party' : 'parties'} without a group <ArrowRight size={14} /></Link>}
        </section>
      </div>
    </div>
    {addingGroup && <AddPartyGroupModal onClose={() => setAddingGroup(false)} onSaved={() => { setAddingGroup(false); void load(); }} />}
  </div>;
}