'use client';

import { Package } from 'lucide-react';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { NumberRow, SavedNote, SettingsCard, ToggleRow, UnavailableRow } from '@/components/settings/SettingsControls';

export default function ItemSettingsPage() {
  const { value, update } = useCompanySettings('item');

  return (
    <>
      <SettingsCard title="Item Settings" description="Applied on the item form and item list." icon={<Package size={17} />}>
        <ToggleRow label="Enable item categories" description="Show the category field on the item form and a category column in the item list." checked={value.itemCategories} onChange={(checked) => update('itemCategories', checked)} />
        <ToggleRow label="Enable wholesale price" description="Show a wholesale price field on the item form." checked={value.wholesalePrice} onChange={(checked) => update('wholesalePrice', checked)} />


        <UnavailableRow label="Enable multiple units" description="Needs unit conversion, which is not built yet." />

      </SettingsCard>

      <SettingsCard title="Additional Item Fields">
        <ToggleRow label="MRP" checked={value.showMrp} onChange={v=>update('showMrp',v)}/>
        <ToggleRow label="Serial No. / Brand reference" checked={value.showSerial} onChange={v=>update('showSerial',v)}/>
        <ToggleRow label="Batch No. / Lot No. reference" checked={value.showBatch} onChange={v=>update('showBatch',v)}/>
        <ToggleRow label="Barcode" checked={value.showBarcode} onChange={v=>update('showBarcode',v)}/>
        <ToggleRow label="Brand" checked={value.showBrand} onChange={v=>update('showBrand',v)}/>
        <ToggleRow label="Count" checked={value.showCount} onChange={v=>update('showCount',v)}/>
      </SettingsCard>
      <SettingsCard title="Stock alerts">
        <ToggleRow label="Enable low stock alert" description="Flag low items in the item list and on the dashboard." checked={value.lowStockAlert} onChange={(checked) => update('lowStockAlert', checked)} />
        <NumberRow label="Low stock threshold" description="Flag an item when stock falls at or below this quantity." min={0} max={1000} value={value.lowStockThreshold} onChange={(lowStockThreshold) => update('lowStockThreshold', lowStockThreshold)} />
      </SettingsCard>

      <SavedNote />
    </>
  );
}
