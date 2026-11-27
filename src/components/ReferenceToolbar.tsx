'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Plus, Printer, Settings } from 'lucide-react';
import CommandMenu from './CommandMenu';
import BackButton from './BackButton';
import CompanyCornerPicker from './CompanyCornerPicker';

export default function ReferenceToolbar() {
  const pathname = usePathname();

  return (
    <div className="reference-toolbar">
      <div className="brand-toolbar-start">
        {pathname !== '/dashboard' && <BackButton />}
        <div className="reference-search"><CommandMenu /></div>
      </div>
      <div className="reference-toolbar-actions">
        <Link href="/invoices/new" className="reference-pill reference-sale"><Plus size={16} /><span className="brand-add-label">Add </span>Sale</Link>
        <Link href="/purchases/bills/new" className="reference-pill reference-purchase"><Plus size={16} /><span className="brand-add-label">Add </span>Purchase</Link>
        <div className="reference-company-switch"><CompanyCornerPicker compact companyOnly /></div>
        <button type="button" onClick={() => window.print()} aria-label="Print current page" className="reference-icon"><Printer size={18} /></button>
        <Link href="/settings/general" aria-label="Settings" className="reference-icon brand-settings-link"><Settings size={18} /></Link>
      </div>
    </div>
  );
}
