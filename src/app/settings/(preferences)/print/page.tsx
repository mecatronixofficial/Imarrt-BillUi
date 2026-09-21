'use client';

import { useEffect, useRef, useState } from 'react';
import { ImageUp, Maximize2, Printer, Receipt, X } from 'lucide-react';
import { getActiveBusinessId, getAllPages } from '@/lib/api';
import type { Business } from '@/types';
import Modal from '@/components/Modal';
import { useCompanySettings } from '@/lib/useGeneralPreferences';
import { imageToDataUrl } from '@/lib/imageCompression';
import { LinkRow, NumberRow, OptionCardRow, SavedNote, SelectRow, SettingsCard, SubHeading, TextRow, ToggleRow, UnavailableRow } from '@/components/settings/SettingsControls';
import { RegularInvoicePreview, ThermalReceiptPreview } from '@/components/settings/PrintPreview';
import {
  TEXT_SIZE_LABELS,
  THERMAL_PAGE_SIZES,
  TRANSACTION_NAME_FIELDS,
  type ThermalTheme,
} from '@/components/settings/printSettingsTypes';

const THERMAL_THEMES: ThermalTheme[] = [1, 2, 3, 4, 5];

const readFileAsDataUrl = (file: File) => imageToDataUrl(file);

export default function PrintSettingsPage() {
  const [printerType, setPrinterType] = useState<'regular' | 'thermal'>('regular');
  const [business, setBusiness] = useState<Business | null>(null);
  const [transactionNamesOpen, setTransactionNamesOpen] = useState(false);
  const [itemTableOpen, setItemTableOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const thermalLogoInputRef = useRef<HTMLInputElement>(null);

  const regular = useCompanySettings('printRegular');
  const thermal = useCompanySettings('printThermal');
  const transactionNames = useCompanySettings('printNames');
  const itemTableColumns = useCompanySettings('printColumns');

  useEffect(() => {
    let active = true;
    void getAllPages<Business>('/businesses').then(({ data }) => {
      if (!active) return;
      const activeId = getActiveBusinessId();
      setBusiness(data.find(({ id }) => id === activeId) ?? data[0] ?? null);
    }).catch(() => undefined);
    return () => { active = false; };
  }, []);

  const businessInfo = {
    name: business?.name ?? '',
    address: business?.address ?? '',
    phone: business?.phone ?? '',
    email: business?.email ?? '',
    gstin: business?.gstin ?? '',
  };

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    regular.update('companyLogo', await readFileAsDataUrl(file));
  }

  async function handleSignatureChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    regular.update('signatureImage', await readFileAsDataUrl(file));
  }

  async function handleThermalLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    thermal.update('companyLogo', await readFileAsDataUrl(file));
  }

  return (
    <div className="space-y-4">
      <div className="card inline-flex gap-1 p-1.5">
        <button
          type="button"
          onClick={() => setPrinterType('regular')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${printerType === 'regular' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Printer size={15} /> Regular Printer
        </button>
        <button
          type="button"
          onClick={() => setPrinterType('thermal')}
          className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-bold transition ${printerType === 'thermal' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
        >
          <Receipt size={15} /> Thermal Printer
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)] xl:items-start">
        {printerType === 'regular' ? (
          <div className="space-y-4">
            <SettingsCard title="Print company info / header">
              <ToggleRow label="Print repeat header in all pages" checked={regular.value.repeatHeader} onChange={(checked) => regular.update('repeatHeader', checked)} />
              <ToggleRow label="Company name" description={business?.name ? `Shown as "${business.name}" — edit in Business profile.` : 'Add your business name in Business profile.'} checked={regular.value.showCompanyName} onChange={(checked) => regular.update('showCompanyName', checked)} />

              <div className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Company logo</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">Shown next to the business name on print.</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {regular.value.companyLogo && <img src={regular.value.companyLogo} alt="Company logo" className="h-9 w-9 rounded-md border border-slate-200 object-contain" />}
                  <button type="button" onClick={() => logoInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs"><ImageUp size={13} /> Change</button>
                  {regular.value.companyLogo && <button type="button" onClick={() => regular.update('companyLogo', '')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Remove logo"><X size={14} /></button>}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleLogoChange(event)} />
              </div>

              <ToggleRow label="Address" description={business?.address || 'Add your address in Business profile.'} checked={regular.value.showAddress} onChange={(checked) => regular.update('showAddress', checked)} />
              <ToggleRow label="Email" description={business?.email || 'Add your email in Business profile.'} checked={regular.value.showEmail} onChange={(checked) => regular.update('showEmail', checked)} />
              <ToggleRow label="Phone number" description={business?.phone || 'Add your phone number in Business profile.'} checked={regular.value.showPhone} onChange={(checked) => regular.update('showPhone', checked)} />
              <ToggleRow label="GSTIN on sale" checked={regular.value.showGstin} onChange={(checked) => regular.update('showGstin', checked)} />

              <SelectRow label="Paper size" value={regular.value.paperSize} onChange={(paperSize) => regular.update('paperSize', paperSize as typeof regular.value.paperSize)} options={[{ value: 'a4', label: 'A4' }, { value: 'a5', label: 'A5' }, { value: 'letter', label: 'Letter' }]} />
              <SelectRow label="Orientation" value={regular.value.orientation} onChange={(orientation) => regular.update('orientation', orientation as typeof regular.value.orientation)} options={[{ value: 'portrait', label: 'Portrait' }, { value: 'landscape', label: 'Landscape' }]} />
              <SelectRow
                label="Company name text size"
                value={String(regular.value.companyNameTextSize)}
                onChange={(size) => regular.update('companyNameTextSize', Number(size) as typeof regular.value.companyNameTextSize)}
                options={Object.entries(TEXT_SIZE_LABELS).map(([size, label]) => ({ value: size, label }))}
              />
              <SelectRow
                label="Invoice text size"
                value={String(regular.value.invoiceTextSize)}
                onChange={(size) => regular.update('invoiceTextSize', Number(size) as typeof regular.value.invoiceTextSize)}
                options={Object.entries(TEXT_SIZE_LABELS).map(([size, label]) => ({ value: size, label }))}
              />
              <ToggleRow label="Print Original/Duplicate" description="Stamp the copy label (e.g. Original) in the top corner." checked={regular.value.printOriginalDuplicate} onChange={(checked) => regular.update('printOriginalDuplicate', checked)} />
              <NumberRow label="Extra space on top of PDF (mm)" min={0} max={40} value={regular.value.extraSpaceTop} onChange={(extraSpaceTop) => regular.update('extraSpaceTop', extraSpaceTop)} />
              <LinkRow label="Change Transaction Names" description="Rename Tax Invoice, Estimate, Purchase Order, and other document titles as they print." onClick={() => setTransactionNamesOpen(true)} />
            </SettingsCard>

            <SettingsCard title="Item table">
              <ToggleRow label="Expand table to print on whole page" checked={regular.value.expandTable} onChange={(checked) => regular.update('expandTable', checked)} />
              <NumberRow label="Min. no. of rows in item table" min={0} max={30} value={regular.value.minRows} onChange={(minRows) => regular.update('minRows', minRows)} />
              <LinkRow label="Item Table Customization" description="Choose which columns show in the item table." onClick={() => setItemTableOpen(true)} />
            </SettingsCard>

            <SettingsCard title="Totals & taxes">
              <ToggleRow label="Total item quantity" checked={regular.value.totalItemQuantity} onChange={(checked) => regular.update('totalItemQuantity', checked)} />
              <ToggleRow label="Amount with decimal" description="e.g. 0.00" checked={regular.value.amountWithDecimal} onChange={(checked) => regular.update('amountWithDecimal', checked)} />
              <ToggleRow label="Received amount" checked={regular.value.receivedAmount} onChange={(checked) => regular.update('receivedAmount', checked)} />
              <ToggleRow label="Balance amount" checked={regular.value.balanceAmount} onChange={(checked) => regular.update('balanceAmount', checked)} />
              <ToggleRow label="Current balance of party" checked={regular.value.currentBalanceOfParty} onChange={(checked) => regular.update('currentBalanceOfParty', checked)} />
              <ToggleRow label="Tax details" checked={regular.value.taxDetails} onChange={(checked) => regular.update('taxDetails', checked)} />
              <ToggleRow label="You saved" checked={regular.value.youSaved} onChange={(checked) => regular.update('youSaved', checked)} />
              <ToggleRow label="Print amount with grouping" description="e.g. 1,00,000.00" checked={regular.value.amountWithGrouping} onChange={(checked) => regular.update('amountWithGrouping', checked)} />
              <ToggleRow label="Amount in words" checked={regular.value.amountInWords} onChange={(checked) => regular.update('amountInWords', checked)} />
              {regular.value.amountInWords && (
                <SelectRow
                  label="Amount in words format"
                  value={regular.value.amountInWordsFormat}
                  onChange={(format) => regular.update('amountInWordsFormat', format as typeof regular.value.amountInWordsFormat)}
                  options={[{ value: 'indian', label: 'Indian (Lakh, Crore)' }, { value: 'international', label: 'International (Million, Billion)' }]}
                />
              )}
            </SettingsCard>

            <SettingsCard title="Footer">
              <ToggleRow label="Print description" checked={regular.value.printDescription} onChange={(checked) => regular.update('printDescription', checked)} />
              <ToggleRow label="Print terms and conditions" checked={regular.value.printTerms} onChange={(checked) => regular.update('printTerms', checked)} />
              <ToggleRow label="Print received by details" checked={regular.value.printReceivedBy} onChange={(checked) => regular.update('printReceivedBy', checked)} />
              <ToggleRow label="Print delivered by details" checked={regular.value.printDeliveredBy} onChange={(checked) => regular.update('printDeliveredBy', checked)} />
              <TextRow label="Print signature text" value={regular.value.signatureText} onChange={(signatureText) => regular.update('signatureText', signatureText)} placeholder="Authorized Signatory" />

              <div className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Signature</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">Optional — replaces the blank signature line on print.</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {regular.value.signatureImage && <img src={regular.value.signatureImage} alt="Signature" className="h-8 rounded border border-slate-200 bg-white object-contain px-1" />}
                  <button type="button" onClick={() => signatureInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs"><ImageUp size={13} /> Change Signature</button>
                  {regular.value.signatureImage && <button type="button" onClick={() => regular.update('signatureImage', '')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Remove signature"><X size={14} /></button>}
                </div>
                <input ref={signatureInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleSignatureChange(event)} />
              </div>

              <ToggleRow label="Payment mode" checked={regular.value.paymentMode} onChange={(checked) => regular.update('paymentMode', checked)} />
              <ToggleRow label="Print acknowledgement" description="Adds a tear-off receiver's acknowledgement slip." checked={regular.value.printAcknowledgement} onChange={(checked) => regular.update('printAcknowledgement', checked)} />
            </SettingsCard>

            <SettingsCard title="Bank details">
              <ToggleRow label="Show bank details" checked={regular.value.showBankDetails} onChange={(checked) => regular.update('showBankDetails', checked)} />
              {regular.value.showBankDetails && (
                <>
                  <TextRow label="Bank name" value={regular.value.bankName} onChange={(bankName) => regular.update('bankName', bankName)} placeholder="HDFC Bank" />
                  <TextRow label="Account number" value={regular.value.bankAccountNumber} onChange={(bankAccountNumber) => regular.update('bankAccountNumber', bankAccountNumber)} placeholder="50100123456789" />
                  <TextRow label="IFSC code" value={regular.value.bankIfsc} onChange={(bankIfsc) => regular.update('bankIfsc', bankIfsc)} placeholder="HDFC0001234" />
                  <ToggleRow label="Show UPI QR code" description="Generates a scannable QR from your UPI ID so parties can pay instantly." checked={regular.value.showUpiQrCode} onChange={(checked) => regular.update('showUpiQrCode', checked)} />
                  {regular.value.showUpiQrCode && <TextRow label="UPI ID" value={regular.value.upiId} onChange={(upiId) => regular.update('upiId', upiId)} placeholder="yourbusiness@okhdfcbank" />}
                </>
              )}
            </SettingsCard>

            <SavedNote />
          </div>
        ) : (
          <div className="space-y-4">
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">Thermal receipt printing is not available yet. These options are saved for your company but no thermal receipt is produced from them.</p>
            <SettingsCard title="Theme">
              <div className="flex gap-2 py-1">
                {THERMAL_THEMES.map((theme) => (
                  <button
                    key={theme}
                    type="button"
                    onClick={() => thermal.update('theme', theme)}
                    aria-pressed={thermal.value.theme === theme}
                    className={`flex-1 rounded-lg border px-2 py-3 text-center text-[11px] font-bold transition ${thermal.value.theme === theme ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
                  >
                    <Receipt size={16} className="mx-auto mb-1" />
                    Theme {theme}
                  </button>
                ))}
              </div>
            </SettingsCard>

            <SettingsCard title="Printer">
              <ToggleRow label="Make thermal printer default" checked={thermal.value.makeDefault} onChange={(checked) => thermal.update('makeDefault', checked)} />
              <OptionCardRow
                label="Page size"
                value={thermal.value.pageSize}
                onChange={(pageSize) => thermal.update('pageSize', pageSize)}
                options={THERMAL_PAGE_SIZES}
              />
              {thermal.value.pageSize === 'custom' && (
                <NumberRow label="Custom width" description="Characters per line" min={24} max={64} value={thermal.value.customWidthChars} onChange={(customWidthChars) => thermal.update('customWidthChars', customWidthChars)} />
              )}
              <SelectRow
                label="Printing type"
                description="Text prints faster; Image supports the logo and richer styling."
                value={thermal.value.printingType}
                onChange={(printingType) => thermal.update('printingType', printingType as typeof thermal.value.printingType)}
                options={[{ value: 'text', label: 'Text' }, { value: 'image', label: 'Image' }]}
              />
              <ToggleRow label="Use text styling (Bold)" checked={thermal.value.boldText} onChange={(checked) => thermal.update('boldText', checked)} />
              <ToggleRow label="Auto cut paper after printing" checked={thermal.value.autoCutPaper} onChange={(checked) => thermal.update('autoCutPaper', checked)} />
              <ToggleRow label="Open cash drawer after printing" checked={thermal.value.openCashDrawer} onChange={(checked) => thermal.update('openCashDrawer', checked)} />
              <NumberRow label="Extra lines at the end" min={0} max={10} value={thermal.value.extraLinesAtEnd} onChange={(extraLinesAtEnd) => thermal.update('extraLinesAtEnd', extraLinesAtEnd)} />
              <NumberRow label="Number of copies" min={1} max={5} value={thermal.value.numberOfCopies} onChange={(numberOfCopies) => thermal.update('numberOfCopies', numberOfCopies)} />
            </SettingsCard>

            <SettingsCard title="Print company info / header">
              <ToggleRow label="Company name" description={business?.name ? `Shown as "${business.name}" — edit in Business profile.` : 'Add your business name in Business profile.'} checked={thermal.value.showCompanyName} onChange={(checked) => thermal.update('showCompanyName', checked)} />

              <div className="flex items-center justify-between gap-4 py-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">Company logo</span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-500">Only prints with the Image printing type.</span>
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {thermal.value.companyLogo && <img src={thermal.value.companyLogo} alt="Company logo" className="h-9 w-9 rounded-md border border-slate-200 object-contain" />}
                  <button type="button" onClick={() => thermalLogoInputRef.current?.click()} className="btn-secondary flex items-center gap-1.5 !px-2.5 !py-1.5 text-xs"><ImageUp size={13} /> Change</button>
                  {thermal.value.companyLogo && <button type="button" onClick={() => thermal.update('companyLogo', '')} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Remove logo"><X size={14} /></button>}
                </div>
                <input ref={thermalLogoInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => void handleThermalLogoChange(event)} />
              </div>

              <ToggleRow label="Address" description={business?.address || 'Add your address in Business profile.'} checked={thermal.value.showAddress} onChange={(checked) => thermal.update('showAddress', checked)} />
              <ToggleRow label="Email" description={business?.email || 'Add your email in Business profile.'} checked={thermal.value.showEmail} onChange={(checked) => thermal.update('showEmail', checked)} />
              <ToggleRow label="Phone number" description={business?.phone || 'Add your phone number in Business profile.'} checked={thermal.value.showPhone} onChange={(checked) => thermal.update('showPhone', checked)} />
              <ToggleRow label="GSTIN on sale" checked={thermal.value.showGstin} onChange={(checked) => thermal.update('showGstin', checked)} />
              <LinkRow label="Change Transaction Names" description="Rename Tax Invoice, Estimate, Purchase Order, and other document titles as they print." onClick={() => setTransactionNamesOpen(true)} />
            </SettingsCard>

            <SettingsCard title="Item table">
              <ToggleRow label="S.No" checked={thermal.value.showSerialNo} onChange={(checked) => thermal.update('showSerialNo', checked)} />
              <ToggleRow label="HSN/SAC code" checked={thermal.value.showHsn} onChange={(checked) => thermal.update('showHsn', checked)} />
              <ToggleRow label="Units of measurement" checked={thermal.value.showUnitOfMeasurement} onChange={(checked) => thermal.update('showUnitOfMeasurement', checked)} />
              <ToggleRow label="MRP" checked={thermal.value.showMrp} onChange={(checked) => thermal.update('showMrp', checked)} />
              <ToggleRow label="Description" checked={thermal.value.showItemDescription} onChange={(checked) => thermal.update('showItemDescription', checked)} />
              <SubHeading>Additional item details</SubHeading>
              <ToggleRow label="Batch No." checked={thermal.value.showBatchNo} onChange={(checked) => thermal.update('showBatchNo', checked)} />
              <ToggleRow label="Exp. date" checked={thermal.value.showExpDate} onChange={(checked) => thermal.update('showExpDate', checked)} />
              <ToggleRow label="Mfg. date" checked={thermal.value.showMfgDate} onChange={(checked) => thermal.update('showMfgDate', checked)} />
              <ToggleRow label="Size" checked={thermal.value.showSize} onChange={(checked) => thermal.update('showSize', checked)} />
              <ToggleRow label="Model No." checked={thermal.value.showModelNo} onChange={(checked) => thermal.update('showModelNo', checked)} />
              <ToggleRow label="Serial No." checked={thermal.value.showItemSerialNo} onChange={(checked) => thermal.update('showItemSerialNo', checked)} />
            </SettingsCard>

            <SettingsCard title="Totals & taxes">
              <ToggleRow label="Total item quantity" checked={thermal.value.totalItemQuantity} onChange={(checked) => thermal.update('totalItemQuantity', checked)} />
              <ToggleRow label="Amount with decimal" description="e.g. 0.00" checked={thermal.value.amountWithDecimal} onChange={(checked) => thermal.update('amountWithDecimal', checked)} />
              <ToggleRow label="Received amount" checked={thermal.value.receivedAmount} onChange={(checked) => thermal.update('receivedAmount', checked)} />
              <ToggleRow label="Balance amount" checked={thermal.value.balanceAmount} onChange={(checked) => thermal.update('balanceAmount', checked)} />
              <ToggleRow label="Current balance of party" checked={thermal.value.currentBalanceOfParty} onChange={(checked) => thermal.update('currentBalanceOfParty', checked)} />
              <ToggleRow label="Tax details" checked={thermal.value.taxDetails} onChange={(checked) => thermal.update('taxDetails', checked)} />
              <ToggleRow label="You saved" checked={thermal.value.youSaved} onChange={(checked) => thermal.update('youSaved', checked)} />
              <ToggleRow label="Print amount with grouping" description="e.g. 1,00,000.00" checked={thermal.value.amountWithGrouping} onChange={(checked) => thermal.update('amountWithGrouping', checked)} />
              <ToggleRow label="Amount in words" checked={thermal.value.amountInWords} onChange={(checked) => thermal.update('amountInWords', checked)} />
              {thermal.value.amountInWords && (
                <SelectRow
                  label="Amount in words format"
                  value={thermal.value.amountInWordsFormat}
                  onChange={(format) => thermal.update('amountInWordsFormat', format as typeof thermal.value.amountInWordsFormat)}
                  options={[{ value: 'indian', label: 'Indian (Lakh, Crore)' }, { value: 'international', label: 'International (Million, Billion)' }]}
                />
              )}
            </SettingsCard>

            <SettingsCard title="Footer">
              <ToggleRow label="Print description" checked={thermal.value.printDescription} onChange={(checked) => thermal.update('printDescription', checked)} />
              <ToggleRow label="Print terms and conditions" checked={thermal.value.printTerms} onChange={(checked) => thermal.update('printTerms', checked)} />
            </SettingsCard>

            <SavedNote />
          </div>
        )}

        <div className="scrollbar-hide min-w-0 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto">
          <div className="mb-2 flex items-center justify-center gap-2">
            <p className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">Preview · sample data</p>
            <button type="button" onClick={() => setPreviewOpen(true)} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-blue-600 transition hover:bg-blue-50" title="Open full view">
              <Maximize2 size={12} /> Full view
            </button>
          </div>
          <div className="scrollbar-hide overflow-x-auto pb-4">
            {printerType === 'regular' ? (
              <RegularInvoicePreview settings={regular.value} business={businessInfo} documentTitle={transactionNames.value.saleInvoice} columns={itemTableColumns.value} />
            ) : (
              <ThermalReceiptPreview settings={thermal.value} business={businessInfo} documentTitle={transactionNames.value.saleInvoice} />
            )}
          </div>
        </div>
      </div>

      {previewOpen && (
        <Modal title="Print preview" onClose={() => setPreviewOpen(false)} size="full">
          <div className="scrollbar-hide overflow-x-auto pb-6">
            {printerType === 'regular' ? (
              <RegularInvoicePreview settings={regular.value} business={businessInfo} documentTitle={transactionNames.value.saleInvoice} columns={itemTableColumns.value} />
            ) : (
              <ThermalReceiptPreview settings={thermal.value} business={businessInfo} documentTitle={transactionNames.value.saleInvoice} />
            )}
          </div>
        </Modal>
      )}

      {transactionNamesOpen && (
        <Modal title="Change Transaction Names" onClose={() => setTransactionNamesOpen(false)} size="lg">
          <p className="mb-4 text-xs leading-5 text-slate-500">These names are used as the document title on print-outs, e.g. the “Tax Invoice” heading at the top of a sale invoice.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {TRANSACTION_NAME_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="label" htmlFor={`txn-name-${key}`}>{label}</label>
                <input id={`txn-name-${key}`} className="input-field" value={transactionNames.value[key]} onChange={(event) => transactionNames.update(key, event.target.value)} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => transactionNames.reset()}>Reset to default</button>
            <button type="button" className="btn-primary" onClick={() => setTransactionNamesOpen(false)}>Done</button>
          </div>
        </Modal>
      )}

      {itemTableOpen && (
        <Modal title="Item Table Customization" onClose={() => setItemTableOpen(false)}>
          <div className="divide-y divide-slate-100">
            <ToggleRow label="HSN/SAC column" checked={itemTableColumns.value.showHsnColumn} onChange={(checked) => itemTableColumns.update('showHsnColumn', checked)} />
            <UnavailableRow label="Discount column" description="Discounts are entered once per invoice, not per line, so there is no column to show." />
            <ToggleRow label="GST column" checked={itemTableColumns.value.showGstColumn} onChange={(checked) => itemTableColumns.update('showGstColumn', checked)} />
            <ToggleRow label="Item code" description="Show the item's code next to its name." checked={itemTableColumns.value.showItemCode} onChange={(checked) => itemTableColumns.update('showItemCode', checked)} />
            <ToggleRow label="Item description" description="Show the item's description under its name." checked={itemTableColumns.value.showItemDescription} onChange={(checked) => itemTableColumns.update('showItemDescription', checked)} />
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" className="btn-primary" onClick={() => setItemTableOpen(false)}>Done</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
