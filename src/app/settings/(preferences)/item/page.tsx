'use client';

import { Package } from 'lucide-react';
import { useLocalSettings } from '@/components/settings/useLocalSettings';
import { NumberRow, SavedNote, SettingsCard, ToggleRow } from '@/components/settings/SettingsControls';

const DEFAULTS = {
  itemCategories: true,
  batchAndExpiry: false,
  serialNumberTracking: false,
  lowStockAlert: true,
  lowStockThreshold: 5,
  wholesalePrice: false,
  multipleUnits: false,
  showImagesOnInvoice: false,
};

export default function ItemSettingsPage() {
  const { value, update } = useLocalSettings('item', DEFAULTS);

  return (
    <>
      <SettingsCard title="Item tracking" description="Applied when a new item is added." icon={<Package size={17} />}>
        <ToggleRow label="Enable item categories" description="Group items by category for filtering and reports." checked={value.itemCategories} onChange={(checked) => update('itemCategories', checked)} />
        <ToggleRow label="Enable batch & expiry tracking" checked={value.batchAndExpiry} onChange={(checked) => update('batchAndExpiry', checked)} />
        <ToggleRow label="Enable serial number tracking" checked={value.serialNumberTracking} onChange={(checked) => update('serialNumberTracking', checked)} />
        <ToggleRow label="Enable multiple units" description="Allow items to be sold in a secondary unit, e.g. box of 12 pieces." checked={value.multipleUnits} onChange={(checked) => update('multipleUnits', checked)} />
        <ToggleRow label="Enable wholesale price" description="Show a second price that applies above a minimum quantity." checked={value.wholesalePrice} onChange={(checked) => update('wholesalePrice', checked)} />
        <ToggleRow label="Show item images on invoice print" checked={value.showImagesOnInvoice} onChange={(checked) => update('showImagesOnInvoice', checked)} />
      </SettingsCard>

      <SettingsCard title="Stock alerts">
        <ToggleRow label="Enable low stock alert" checked={value.lowStockAlert} onChange={(checked) => update('lowStockAlert', checked)} />
        <NumberRow label="Low stock threshold" description="Flag an item when stock falls at or below this quantity." min={0} max={1000} value={value.lowStockThreshold} onChange={(lowStockThreshold) => update('lowStockThreshold', lowStockThreshold)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
