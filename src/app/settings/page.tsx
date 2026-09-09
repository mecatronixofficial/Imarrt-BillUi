'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, Globe2, KeyRound, MessageCircle, MessageSquare, Package, Percent, Printer, Repeat, Search, Settings, ShieldCheck, SlidersHorizontal, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

type SettingsEntry = { href: string; icon: LucideIcon; title: string; description: string; group: 'Preferences' | 'Workspace' | 'Access' };

const SETTINGS: SettingsEntry[] = [
  { href: '/settings/general', icon: SlidersHorizontal, title: 'General', description: 'Business behaviour, number precision, date format, and language.', group: 'Preferences' },
  { href: '/settings/transaction', icon: Repeat, title: 'Transactions', description: 'Invoice behaviour, stock rules, numbering, and timestamps.', group: 'Preferences' },
  { href: '/settings/print', icon: Printer, title: 'Print & thermal', description: 'Invoice layouts, company header, columns, totals, QR, and receipts.', group: 'Preferences' },
  { href: '/settings/taxes-gst', icon: Percent, title: 'Taxes & GST', description: 'GST visibility, breakup, rounding, composition, TCS, and TDS.', group: 'Preferences' },
  { href: '/settings/transaction-message', icon: MessageSquare, title: 'Transaction messages', description: 'Invoice, quotation, payment reminder, and auto-share templates.', group: 'Preferences' },
  { href: '/settings/party', icon: Users, title: 'Party defaults', description: 'Opening balances, categories, reminders, credit terms, and loyalty.', group: 'Preferences' },
  { href: '/settings/item', icon: Package, title: 'Item & inventory', description: 'Categories, batches, serial numbers, units, pricing, and stock alerts.', group: 'Preferences' },
  { href: '/businesses', icon: Building2, title: 'Business profile', description: 'Legal name, GST registration, contact details, branches, and active company.', group: 'Workspace' },
  { href: '/parties', icon: MessageCircle, title: 'Invoice delivery', description: 'Configure email, WhatsApp consent, and automatic delivery per party.', group: 'Workspace' },
  { href: '/team', icon: UserCog, title: 'Team & permissions', description: 'Invite members and control billing access by role.', group: 'Access' },
  { href: '/security', icon: ShieldCheck, title: 'Security & MFA', description: 'Authenticator setup, recovery codes, sessions, and account protection.', group: 'Access' },
];

export default function SettingsPage() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return term ? SETTINGS.filter((item) => `${item.title} ${item.description} ${item.group}`.toLowerCase().includes(term)) : SETTINGS; }, [query]);

  return <>
    <PageHeader title="Settings" description="Configure documents, taxes, printing, inventory, workspace access, and security." />
    <section className="mb-5 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-200"><div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:items-center"><div><span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-300"><Settings size={13} />Control centre</span><h2 className="mt-3 text-xl font-extrabold tracking-tight">Make billing work your way</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Preferences save automatically for the active company on this browser. Business identity, team access, and security are managed in their dedicated workspaces.</p></div><div className="relative"><Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" /><input autoFocus={false} aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/30" placeholder="Search settings..." /></div></div></section>
    {(['Preferences', 'Workspace', 'Access'] as const).map((group) => { const entries = filtered.filter((item) => item.group === group); if (!entries.length) return null; return <section key={group} className="mb-6"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-slate-900">{group}</h2><p className="text-[10px] text-slate-400">{group === 'Preferences' ? 'Company-scoped defaults saved automatically' : group === 'Workspace' ? 'Business identity and communication settings' : 'People, roles, and account protection'}</p></div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">{entries.length}</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{entries.map(({ href, icon: Icon, title, description }) => <Link key={href} href={href} className="card group flex min-h-32 items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><ChevronRight size={17} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" /></Link>)}</div></section>; })}
    {!filtered.length && <div className="card px-5 py-14 text-center"><Search size={24} className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-bold text-slate-700">No matching setting</p><button type="button" onClick={() => setQuery('')} className="mt-2 text-xs font-bold text-blue-600">Clear search</button></div>}
    <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm"><Globe2 size={18} /></span><div><h2 className="text-sm font-extrabold text-slate-900">System defaults</h2><p className="text-xs text-slate-500">Indian currency and financial date conventions are enabled by default.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Preference icon={KeyRound} label="MFA protection" value="Required for billing" /><Preference icon={Users} label="Party delivery" value="Configured per party" /><Preference icon={Building2} label="Preference scope" value="Active company" /></div></section>
  </>;
}

function Preference({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><Icon size={15} className="text-blue-500" /><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-800">{value}</p></div>; }
