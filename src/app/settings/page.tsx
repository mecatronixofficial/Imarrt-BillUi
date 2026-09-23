'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import { Building2, ChevronRight, Globe2, KeyRound, MessageCircle, MessageSquare, Package, Percent, Printer, Repeat, Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, UserCog, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Group = 'Preferences' | 'Workspace' | 'Access';
type SettingsEntry = { href: string; icon: LucideIcon; title: string; description: string; group: Group };

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

const GROUP_STYLE: Record<Group, { line: string; icon: string; chip: string; badge: string; blurb: string; ring: string }> = {
  Preferences: { line: 'bg-blue-500', icon: 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white', chip: 'bg-blue-50 text-blue-700', badge: 'bg-blue-600 text-white', blurb: 'Company-scoped defaults saved automatically', ring: 'hover:border-blue-200 hover:shadow-blue-100/60' },
  Workspace: { line: 'bg-violet-500', icon: 'bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white', chip: 'bg-violet-50 text-violet-700', badge: 'bg-violet-600 text-white', blurb: 'Business identity and communication settings', ring: 'hover:border-violet-200 hover:shadow-violet-100/60' },
  Access: { line: 'bg-emerald-500', icon: 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white', chip: 'bg-emerald-50 text-emerald-700', badge: 'bg-emerald-600 text-white', blurb: 'People, roles, and account protection', ring: 'hover:border-emerald-200 hover:shadow-emerald-100/60' },
};

export default function SettingsPage() {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => { const term = query.trim().toLowerCase(); return term ? SETTINGS.filter((item) => `${item.title} ${item.description} ${item.group}`.toLowerCase().includes(term)) : SETTINGS; }, [query]);

  return <>
    <header className="relative mb-6 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-xl shadow-slate-200">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_0%,rgba(37,99,235,0.35),transparent_38%),radial-gradient(circle_at_90%_100%,rgba(124,58,237,0.24),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgba(255,255,255,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.2)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="relative grid gap-5 p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-blue-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_9px_rgba(52,211,153,0.8)]" /> Control centre
          </span>
          <h1 className="mt-3 flex items-center gap-2 text-xl font-extrabold tracking-tight sm:text-2xl">
            <Settings size={20} className="text-blue-300" /> Make billing work your way
          </h1>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">Preferences save automatically for the active company on this browser. Business identity, team access, and security are managed in their dedicated workspaces.</p>
        </div>
        <div className="relative">
          <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input autoFocus={false} aria-label="Search settings" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-white/10 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 backdrop-blur-sm transition focus:border-blue-400 focus:bg-white/[0.14] focus:ring-2 focus:ring-blue-500/30" placeholder="Search settings..." />
        </div>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-blue-500 via-violet-500 to-emerald-500" />
    </header>

    {(['Preferences', 'Workspace', 'Access'] as const).map((group) => {
      const entries = filtered.filter((item) => item.group === group);
      if (!entries.length) return null;
      const style = GROUP_STYLE[group];
      return (
        <section key={group} className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className={clsx('h-6 w-1.5 rounded-full', style.line)} />
              <div>
                <h2 className="text-sm font-extrabold text-slate-900">{group}</h2>
                <p className="text-[10px] text-slate-400">{style.blurb}</p>
              </div>
            </div>
            <span className={clsx('rounded-full px-2.5 py-1 text-[10px] font-bold', style.chip)}>{entries.length}</span>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {entries.map(({ href, icon: Icon, title, description }) => (
              <Link key={href} href={href} className={clsx('card group relative flex min-h-32 items-start gap-4 overflow-hidden p-4 transition duration-200 hover:-translate-y-1 hover:shadow-lg', style.ring)}>
                <span className={clsx('absolute inset-x-0 top-0 h-0.5 scale-x-0 transition-transform duration-200 group-hover:scale-x-100', style.line)} />
                <span className={clsx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors duration-200', style.icon)}><Icon size={19} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-extrabold text-slate-900">{title}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span>
                </span>
                <ChevronRight size={17} className="mt-1 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
              </Link>
            ))}
          </div>
        </section>
      );
    })}

    {!filtered.length && (
      <div className="card px-5 py-14 text-center">
        <Search size={24} className="mx-auto text-slate-300" />
        <p className="mt-3 text-sm font-bold text-slate-700">No matching setting</p>
        <button type="button" onClick={() => setQuery('')} className="mt-2 text-xs font-bold text-blue-600">Clear search</button>
      </div>
    )}

    <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 via-white to-slate-50 p-5">
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-600 shadow-sm ring-1 ring-slate-100"><Globe2 size={18} /></span>
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900"><Sparkles size={13} className="text-amber-400" /> System defaults</h2>
          <p className="text-xs text-slate-500">Indian currency and financial date conventions are enabled by default.</p>
        </div>
      </div>
      <div className="relative mt-4 grid gap-3 sm:grid-cols-3">
        <Preference icon={KeyRound} label="MFA protection" value="Required for billing" tone="emerald" />
        <Preference icon={Users} label="Party delivery" value="Configured per party" tone="blue" />
        <Preference icon={Building2} label="Preference scope" value="Active company" tone="violet" />
      </div>
    </section>
  </>;
}

const PREF_TONE: Record<'blue' | 'violet' | 'emerald', string> = { blue: 'text-blue-500', violet: 'text-violet-500', emerald: 'text-emerald-500' };

function Preference({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: 'blue' | 'violet' | 'emerald' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <Icon size={15} className={PREF_TONE[tone]} />
      <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-xs font-bold text-slate-800">{value}</p>
    </div>
  );
}
