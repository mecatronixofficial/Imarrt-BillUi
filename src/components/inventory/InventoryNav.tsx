import Link from 'next/link';
import { ArrowDownUp, Boxes, Warehouse } from 'lucide-react';
import styles from './GodownsView.module.css';

export default function InventoryNav({ active }: { active: 'summary' | 'godowns' | 'adjustments' }) {
  return <nav className={styles.tabs} aria-label="Inventory navigation">
    <Link href="/inventory" aria-current={active === 'summary' ? 'page' : undefined}><Boxes size={16} aria-hidden="true" /> Stock summary</Link>
    <Link href="/inventory/godowns" aria-current={active === 'godowns' ? 'page' : undefined}><Warehouse size={16} aria-hidden="true" /> Godowns</Link>
    <Link href="/inventory/adjustments" aria-current={active === 'adjustments' ? 'page' : undefined}><ArrowDownUp size={16} aria-hidden="true" /> Adjustments & transfers</Link>
  </nav>;
}
