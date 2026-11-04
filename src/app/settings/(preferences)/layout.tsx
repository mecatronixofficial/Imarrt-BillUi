'use client';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BackButton from '@/components/BackButton';
import { SettingsAccess } from '@/components/settings/SettingsControls';
const tabs=[['general','GENERAL'],['transaction','TRANSACTION'],['print','PRINT'],['taxes-gst','TAXES & GST'],['transaction-message','TRANSACTION MESSAGE'],['party','PARTY'],['item','ITEM']];
export default function PreferencesLayout({children}:{children:ReactNode}){const pathname=usePathname();return <div className="reference-settings"><aside className="reference-settings-nav"><div className="brand-settings-heading"><BackButton fallback="/settings"/><h1>Settings</h1></div>{tabs.map(([key,label])=><Link key={key} href={'/settings/'+key} aria-current={pathname==='/settings/'+key?'page':undefined}>{label}</Link>)}<Link href="/security">ACCOUNT SECURITY</Link><Link href="/businesses">MULTI FIRM</Link><Link href="/dashboard">CLOSE SETTINGS</Link></aside><SettingsAccess><div className="reference-settings-content">{children}</div></SettingsAccess></div>}
