import Link from 'next/link';
import { Building2, ChevronRight, KeyRound, MessageCircle, Settings, ShieldCheck, SlidersHorizontal, UserCog, Users } from 'lucide-react';
import PageHeader from '@/components/PageHeader';

const SETTINGS = [
  { href: '/settings/general', icon: SlidersHorizontal, title: 'Preferences', description: 'General, transaction, print, taxes & GST, transaction message, party, and item defaults.' },
  { href: '/businesses', icon: Building2, title: 'Business profile', description: 'Legal name, GST registration, address, email, and active business.' },
  { href: '/parties', icon: MessageCircle, title: 'Invoice delivery', description: 'Configure email, WhatsApp, consent, and automatic sharing per party.' },
  { href: '/team', icon: UserCog, title: 'Team & permissions', description: 'Invite team members and control billing access by role.' },
  { href: '/security', icon: ShieldCheck, title: 'Security & MFA', description: 'Authenticator setup, recovery codes, sessions, and account protection.' },
] as const;

export default function SettingsPage() {
  return <><PageHeader title="Settings" description="Manage business preferences, delivery, team access, and security." /><div className="grid gap-4 md:grid-cols-2">{SETTINGS.map(({ href, icon: Icon, title, description }) => <Link key={href} href={href} className="card group flex items-start gap-4 p-5 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-900">{title}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{description}</span></span><ChevronRight size={17} className="mt-1 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-500" /></Link>)}</div><section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-5"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm"><Settings size={18} /></span><div><h2 className="text-sm font-extrabold text-slate-900">System preferences</h2><p className="mt-0.5 text-xs text-slate-500">Currency is INR, financial dates use the Indian format, and business data is isolated by active workspace.</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-3"><Preference icon={KeyRound} label="MFA protection" value="Required" /><Preference icon={Users} label="Party delivery" value="Per party" /><Preference icon={Building2} label="Business scope" value="Active workspace" /></div></section></>;
}

function Preference({ icon: Icon, label, value }: { icon: typeof KeyRound; label: string; value: string }) { return <div className="rounded-xl border border-slate-200 bg-white p-3"><Icon size={15} className="text-blue-500" /><p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xs font-bold text-slate-800">{value}</p></div>; }
