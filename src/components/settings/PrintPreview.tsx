'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { amountToWords } from '@/lib/numberToWords';
import { formatAmount, type ItemTableColumnSettings, type RegularPrintSettings, type ThermalPrintSettings } from './printSettingsTypes';

type BusinessInfo = {
  name: string;
  address: string;
  phone: string;
  email: string;
  gstin: string;
};

const COMPANY_TEXT_SIZE: Record<number, string> = { 1: 'text-lg', 2: 'text-xl', 3: 'text-2xl', 4: 'text-3xl', 5: 'text-4xl' };
const INVOICE_TEXT_SIZE: Record<number, string> = { 1: 'text-[11px]', 2: 'text-xs', 3: 'text-sm', 4: 'text-base', 5: 'text-lg' };

// Demo line items — chosen so every downstream total (line amount, item-table TOTAL row,
// tax summary, and the invoice-level discount/tax/TCS chain) reconciles to a real number,
// the same way a live invoice would compute it.
const DEMO_ITEMS = [
  { name: 'Item 1', hsn: '1234', displayQty: '1 + 1', totalUnits: 2, billQty: 1, unit: 'PCS', price: 10, discountPct: 1, gstPct: 5, mrp: 12, batchNo: 'B-2201', expDate: '12-2026', mfgDate: '01-2025', size: 'M', modelNo: 'MDL-100', serialNo: 'SN-00123' },
  { name: 'Item 2', hsn: '6325', displayQty: '1', totalUnits: 1, billQty: 1, unit: 'BOX', price: 30, discountPct: 0, gstPct: 18, mrp: 35, batchNo: 'B-1187', expDate: '06-2027', mfgDate: '03-2025', size: 'L', modelNo: 'MDL-200', serialNo: 'SN-00456' },
].map((item) => {
  const base = item.billQty * item.price;
  const discountAmount = Math.round(((base * item.discountPct) / 100) * 100) / 100;
  const taxable = base - discountAmount;
  const gstAmount = Math.round(((taxable * item.gstPct) / 100) * 100) / 100;
  return { ...item, base, discountAmount, taxable, gstAmount, amount: taxable + gstAmount };
});

const ITEM_AMOUNT_TOTAL = DEMO_ITEMS.reduce((sum, item) => sum + item.amount, 0);
const ITEM_DISCOUNT_TOTAL = DEMO_ITEMS.reduce((sum, item) => sum + item.discountAmount, 0);
const ITEM_TAX_TOTAL = DEMO_ITEMS.reduce((sum, item) => sum + item.gstAmount, 0);
const TOTAL_QTY_DISPLAY = DEMO_ITEMS.map((item) => item.totalUnits).join(' + ');

// Invoice-level charges applied on top of the line items, same as a real Sale Invoice would show.
const INVOICE_DISCOUNT_PCT = 12;
const INVOICE_DISCOUNT_AMOUNT = Math.round(((ITEM_AMOUNT_TOTAL * INVOICE_DISCOUNT_PCT) / 100) * 100) / 100;
const AFTER_DISCOUNT = ITEM_AMOUNT_TOTAL - INVOICE_DISCOUNT_AMOUNT;
const INVOICE_TAX_PCT = 5;
const INVOICE_TAX_AMOUNT = Math.round(((AFTER_DISCOUNT * INVOICE_TAX_PCT) / 100) * 100) / 100;
const GRAND_TOTAL = AFTER_DISCOUNT + INVOICE_TAX_AMOUNT;
const TCS_PCT = 1;
const TCS_AMOUNT = Math.round(((GRAND_TOTAL * TCS_PCT) / 100) * 100) / 100;
const RECEIVED = 12;
const YOU_SAVED = 111.6;
const PARTY_BALANCE = 1250;

export function RegularInvoicePreview({ settings, business, documentTitle = 'Tax Invoice', columns }: { settings: RegularPrintSettings; business: BusinessInfo; documentTitle?: string; columns?: ItemTableColumnSettings }) {
  const name = business.name || 'Your Business';
  const address = business.address || '123 Market Street, Koramangala, Bengaluru, Karnataka 560034';
  const phone = business.phone || '98765 43210';
  const email = business.email || 'billing@yourbusiness.com';
  const gstin = business.gstin || '29ABCDE1234F1Z5';
  const balance = GRAND_TOTAL - RECEIVED;
  const fmt = (value: number) => formatAmount(value, settings.amountWithDecimal, settings.amountWithGrouping);
  const cols = columns ?? { showHsnColumn: true, showDiscountColumn: true, showGstColumn: true, showItemCode: false, showItemDescription: false };
  const columnCount = 4 + Number(cols.showHsnColumn) + Number(cols.showDiscountColumn) + Number(cols.showGstColumn);

  const baseWidth = settings.paperSize === 'a5' ? 620 : 860;
  const width = settings.orientation === 'landscape' ? baseWidth + 220 : baseWidth;

  return (
    <div
      className={`mx-auto w-full overflow-hidden border border-slate-400 bg-white text-slate-900 shadow-sm ${INVOICE_TEXT_SIZE[settings.invoiceTextSize]}`}
      style={{ maxWidth: width, paddingTop: settings.extraSpaceTop }}
    >
      <div className="relative border-b border-slate-400 px-6 py-4 text-center">
        {settings.printOriginalDuplicate && <span className="absolute right-4 top-4 rounded border border-slate-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">Original</span>}
        <h1 className="text-2xl font-extrabold tracking-tight">{documentTitle}</h1>
      </div>

      <div className="flex items-center gap-4 border-b border-slate-400 px-6 py-4">
        <LogoBox src={settings.companyLogo} />
        <div className="min-w-0">
          {settings.showCompanyName && <p className={`font-extrabold leading-tight ${COMPANY_TEXT_SIZE[settings.companyNameTextSize]}`}>{name}</p>}
          {settings.showAddress && <p className="mt-1 text-slate-600">{address}</p>}
          <p className="mt-1 text-slate-600">
            {settings.showPhone && <>Phone: <span className="font-semibold text-slate-800">{phone}</span></>}
            {settings.showPhone && settings.showEmail && <span className="mx-1.5 text-slate-300">·</span>}
            {settings.showEmail && <>Email: <span className="font-semibold text-slate-800">{email}</span></>}
          </p>
          {settings.showGstin && <p className="mt-1 text-slate-600">GSTIN: <span className="font-semibold text-slate-800">{gstin}</span></p>}
        </div>
      </div>

      <div className="grid grid-cols-2 border-b border-slate-400">
        <div className="border-r border-slate-400">
          <SectionLabel>Bill To:</SectionLabel>
          <div className="space-y-0.5 px-4 py-3 text-slate-600">
            <p className="font-semibold text-slate-900">Classic Enterprises</p>
            <p>Plot No. 1, Shop No. 8, Koramangala, Bengaluru, 560034</p>
            <p>Contact No.: 88888 88888</p>
          </div>
        </div>
        <div>
          <SectionLabel>Invoice Details:</SectionLabel>
          <div className="space-y-0.5 px-4 py-3 text-slate-600">
            <p>Invoice No.: INV-101</p>
            <p>Date: 18-08-2026</p>
            <p>Time: 12:30 PM</p>
            <p>Due Date: 02-09-2026</p>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-400">
        <SectionLabel>Ship To:</SectionLabel>
        <p className="px-4 py-3 text-slate-600">Mehta Textiles, Marathalli Road, Bengaluru, Karnataka, 560034</p>
      </div>

      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="bg-slate-50 text-slate-700">
            <Th>#</Th>
            <Th className={settings.expandTable ? 'w-full' : ''}>Item name</Th>
            {cols.showHsnColumn && <Th>HSN/SAC</Th>}
            <Th align="right">Quantity</Th>
            <Th align="right">Price/unit</Th>
            {cols.showDiscountColumn && <Th align="right">Discount</Th>}
            {cols.showGstColumn && <Th align="right">GST</Th>}
            <Th align="right" last>Amount</Th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ITEMS.map((item, index) => (
            <tr key={item.name}>
              <Td>{index + 1}</Td>
              <Td className="font-medium text-slate-900">
                {item.name}
                {cols.showItemCode && <span className="ml-1.5 text-slate-400">#{item.hsn}</span>}
                {cols.showItemDescription && <span className="mt-0.5 block font-normal text-slate-400">Sale item</span>}
              </Td>
              {cols.showHsnColumn && <Td>{item.hsn}</Td>}
              <Td align="right">{item.displayQty}{item.unit && ` ${item.unit}`}</Td>
              <Td align="right">₹{fmt(item.price)}</Td>
              {cols.showDiscountColumn && <Td align="right">₹{fmt(item.discountAmount)} ({item.discountPct}%)</Td>}
              {cols.showGstColumn && <Td align="right">₹{fmt(item.gstAmount)} ({item.gstPct}%)</Td>}
              <Td align="right" last className="font-semibold text-slate-900">₹{fmt(item.amount)}</Td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, settings.minRows - DEMO_ITEMS.length) }).map((_, index) => (
            <tr key={`blank-${index}`}><Td colSpan={columnCount} last>&nbsp;</Td></tr>
          ))}
          <tr className="bg-slate-50 font-bold">
            <Td colSpan={2}>TOTAL</Td>
            {cols.showHsnColumn && <Td />}
            <Td align="right">{settings.totalItemQuantity ? TOTAL_QTY_DISPLAY : ''}</Td>
            <Td />
            {cols.showDiscountColumn && <Td align="right">₹{fmt(ITEM_DISCOUNT_TOTAL)}</Td>}
            {cols.showGstColumn && <Td align="right">₹{fmt(ITEM_TAX_TOTAL)}</Td>}
            <Td align="right" last>₹{fmt(ITEM_AMOUNT_TOTAL)}</Td>
          </tr>
        </tbody>
      </table>

      <div className="grid grid-cols-1 border-t border-slate-400 lg:grid-cols-2">
        {settings.taxDetails && (
          <div className="border-b border-slate-400 lg:border-b-0 lg:border-r">
            <SectionLabel>Tax Summary:</SectionLabel>
            <table className="w-full border-collapse text-left">
              <thead className="text-slate-500">
                <tr>
                  <Th rowSpan={2}>HSN/SAC</Th>
                  <Th rowSpan={2} align="right">Taxable Amt.</Th>
                  <Th colSpan={2} align="center">CGST</Th>
                  <Th colSpan={2} align="center">SGST</Th>
                  <Th rowSpan={2} align="right" last>Total Tax</Th>
                </tr>
                <tr>
                  <Th align="right" muted>Rate</Th>
                  <Th align="right" muted>Amt.</Th>
                  <Th align="right" muted>Rate</Th>
                  <Th align="right" muted>Amt.</Th>
                </tr>
              </thead>
              <tbody>
                {DEMO_ITEMS.map((item) => (
                  <tr key={item.hsn}>
                    <Td>{item.hsn}</Td>
                    <Td align="right">₹{fmt(item.taxable)}</Td>
                    <Td align="right">{(item.gstPct / 2).toFixed(1)}%</Td>
                    <Td align="right">₹{fmt(item.gstAmount / 2)}</Td>
                    <Td align="right">{(item.gstPct / 2).toFixed(1)}%</Td>
                    <Td align="right">₹{fmt(item.gstAmount / 2)}</Td>
                    <Td align="right" last className="font-semibold text-slate-900">₹{fmt(item.gstAmount)}</Td>
                  </tr>
                ))}
                <tr className="bg-slate-50 font-bold">
                  <Td>Total</Td>
                  <Td align="right">₹{fmt(DEMO_ITEMS.reduce((sum, item) => sum + item.taxable, 0))}</Td>
                  <Td colSpan={2} align="right">₹{fmt(ITEM_TAX_TOTAL / 2)}</Td>
                  <Td colSpan={2} align="right">₹{fmt(ITEM_TAX_TOTAL / 2)}</Td>
                  <Td align="right" last>₹{fmt(ITEM_TAX_TOTAL)}</Td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className={settings.taxDetails ? '' : 'lg:col-span-2'}>
          <div className="divide-y divide-slate-200">
            <SummaryRow label="Sub Total" value={`₹${fmt(ITEM_AMOUNT_TOTAL)}`} />
            <SummaryRow label={`Discount (${INVOICE_DISCOUNT_PCT}%)`} value={`₹${fmt(INVOICE_DISCOUNT_AMOUNT)}`} />
            <SummaryRow label={`Tax (${INVOICE_TAX_PCT}%)`} value={`₹${fmt(INVOICE_TAX_AMOUNT)}`} />
            <SummaryRow label={`TCS (${TCS_PCT}%)`} value={`₹${fmt(TCS_AMOUNT)}`} />
            <SummaryRow label="Total" value={`₹${fmt(GRAND_TOTAL)}`} bold />
          </div>

          {settings.amountInWords && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2.5">
              <p className="font-bold text-slate-600">Invoice Amount In Words:</p>
              <p className="mt-0.5 text-slate-700">{amountToWords(GRAND_TOTAL, settings.amountInWordsFormat)}</p>
            </div>
          )}

          {(settings.receivedAmount || settings.balanceAmount || settings.youSaved || settings.currentBalanceOfParty || settings.paymentMode) && (
            <div className="divide-y divide-slate-200 border-t border-slate-200">
              {settings.receivedAmount && <SummaryRow label="Received" value={`₹${fmt(RECEIVED)}`} />}
              {settings.balanceAmount && <SummaryRow label="Balance" value={`₹${fmt(balance)}`} />}
              {settings.youSaved && <SummaryRow label="You Saved" value={`₹${fmt(YOU_SAVED)}`} bold />}
              {settings.currentBalanceOfParty && <SummaryRow label="Party's Current Balance" value={`₹${fmt(PARTY_BALANCE)}`} />}
              {settings.paymentMode && <SummaryRow label="Payment Mode" value="Cash" />}
            </div>
          )}
        </div>
      </div>

      {(settings.printDescription || settings.printTerms) && (
        <div className="grid grid-cols-1 border-t border-slate-400 sm:grid-cols-2">
          {settings.printDescription && (
            <div className={settings.printTerms ? 'border-b border-slate-400 sm:border-b-0 sm:border-r' : ''}>
              <SectionLabel>Description:</SectionLabel>
              <p className="px-4 py-3 text-slate-600">Sale Description</p>
            </div>
          )}
          {settings.printTerms && (
            <div>
              <SectionLabel>Terms &amp; Conditions:</SectionLabel>
              <p className="px-4 py-3 text-slate-600">Thanks for doing business with us!</p>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 border-t border-slate-400 sm:grid-cols-2">
        {settings.showBankDetails && (
          <div className="border-b border-slate-400 sm:border-b-0 sm:border-r">
            <SectionLabel>Bank Details:</SectionLabel>
            <div className="flex items-start gap-3 px-4 py-3">
              {settings.showUpiQrCode && <UpiQrCode payeeVpa={settings.upiId || 'yourbusiness@okhdfcbank'} payeeName={name} amount={GRAND_TOTAL} note="Invoice INV-101" />}
              <div className="space-y-0.5 text-slate-600">
                <p>Bank Name: {settings.bankName || 'HDFC Bank'}</p>
                <p>Bank Account No.: {settings.bankAccountNumber || '50100123456789'}</p>
                <p>Bank IFSC code: {settings.bankIfsc || 'HDFC0001234'}</p>
                {settings.showUpiQrCode && <p>UPI ID: {settings.upiId || 'yourbusiness@okhdfcbank'}</p>}
              </div>
            </div>
          </div>
        )}
        <div className={settings.showBankDetails ? '' : 'sm:col-span-2'}>
          <SectionLabel>For: {name}</SectionLabel>
          <div className="flex flex-col items-end px-4 py-3 text-right">
            {settings.printReceivedBy && <p className="mb-1 self-start text-slate-600">Received by: ______________</p>}
            {settings.printDeliveredBy && <p className="mb-1 self-start text-slate-600">Delivered by: ______________</p>}
            {settings.signatureImage ? <img src={settings.signatureImage} alt="Signature" className="mt-2 h-10 object-contain" /> : <LogoBox src="" label="Signature" className="mt-2" />}
            <p className="mt-1 font-semibold text-slate-800">{settings.signatureText || 'Authorized Signatory'}</p>
          </div>
        </div>
      </div>

      {settings.printAcknowledgement && (
        <div className="border-t-2 border-dashed border-slate-400 px-6 py-3 text-slate-600">
          <p className="font-bold text-slate-700">Acknowledgement</p>
          <p className="mt-0.5">Received goods as per invoice INV-101 dated 18-08-2026 in good condition.</p>
          <p className="mt-4">Receiver&apos;s signature: ______________</p>
        </div>
      )}
    </div>
  );
}

function UpiQrCode({ payeeVpa, payeeName, amount, note }: { payeeVpa: string; payeeName: string; amount: number; note: string }) {
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    let active = true;
    setDataUrl('');
    const uri = `upi://pay?pa=${encodeURIComponent(payeeVpa)}&pn=${encodeURIComponent(payeeName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note)}`;
    void QRCode.toDataURL(uri, { errorCorrectionLevel: 'M', margin: 0, width: 112, color: { dark: '#0f172a', light: '#ffffff' } })
      .then((url) => { if (active) setDataUrl(url); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [payeeVpa, payeeName, amount, note]);

  if (!dataUrl) return <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-[9px] font-bold uppercase text-slate-400">QR</div>;
  return <img src={dataUrl} alt={`UPI QR code for ${payeeVpa}`} className="h-14 w-14 shrink-0 rounded border border-slate-200 object-contain" />;
}

function LogoBox({ src, label = 'Image', className = '' }: { src: string; label?: string; className?: string }) {
  if (src) return <img src={src} alt={label} className={`h-16 w-16 shrink-0 rounded object-contain ${className}`} />;
  return <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-100 text-[10px] font-semibold text-slate-400 ${className}`}>{label}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="border-b border-slate-300 bg-slate-50 px-4 py-2 font-bold text-slate-700">{children}</p>;
}

function Th({ children, align = 'left', colSpan, rowSpan, last, muted, className = '' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; colSpan?: number; rowSpan?: number; last?: boolean; muted?: boolean; className?: string }) {
  return (
    <th colSpan={colSpan} rowSpan={rowSpan} className={`border-b border-slate-300 px-2.5 py-2 font-bold ${last ? '' : 'border-r'} ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'} ${muted ? 'border-t font-medium text-slate-400' : ''} ${className}`}>
      {children}
    </th>
  );
}

function Td({ children, align = 'left', colSpan, last, className = '' }: { children?: React.ReactNode; align?: 'left' | 'right'; colSpan?: number; last?: boolean; className?: string }) {
  return (
    <td colSpan={colSpan} className={`border-b border-slate-200 px-2.5 py-2 text-slate-600 ${last ? '' : 'border-r'} ${align === 'right' ? 'text-right' : 'text-left'} ${className}`}>
      {children}
    </td>
  );
}

function SummaryRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${bold ? 'text-[15px] font-extrabold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span className="flex items-center gap-2"><span className="text-slate-400">:</span><span className={bold ? '' : 'font-semibold text-slate-800'}>{value}</span></span>
    </div>
  );
}

function ThermalRow({ label, value, bold = false }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-2 py-0.5 ${bold ? 'font-bold text-slate-900' : 'text-blue-700'}`}>
      <span>{label}</span>
      <span className="flex items-center gap-1.5"><span className={bold ? 'text-slate-400' : 'text-blue-300'}>:</span><span>{value}</span></span>
    </div>
  );
}

// Demo bill-to party — kept the same as the Regular preview's demo party so both previews read as one consistent sample invoice.
const THERMAL_DEMO_PARTY = {
  name: 'Classic Enterprises',
  phone: '88888 88888',
  address: 'Plot No. 1, Shop No. 8, Koramangala, Bengaluru, 560034',
  state: 'Karnataka',
};

export function ThermalReceiptPreview({ settings, business, documentTitle = 'Tax Invoice' }: { settings: ThermalPrintSettings; business: BusinessInfo; documentTitle?: string }) {
  const charWidth = 5.6;
  const chars = settings.pageSize === '2in' ? 32 : settings.pageSize === '3in' ? 40 : settings.pageSize === '4in' ? 48 : Math.max(24, Math.min(64, settings.customWidthChars));
  const width = Math.round(chars * charWidth) + 24;
  const fmt = (value: number) => formatAmount(value, settings.amountWithDecimal, settings.amountWithGrouping);
  const balance = GRAND_TOTAL - RECEIVED;
  const sep = settings.theme === 3 ? '* '.repeat(Math.round(chars / 2)).trim() : settings.theme === 4 ? '='.repeat(chars) : '-'.repeat(chars);
  const border = settings.theme === 2 ? 'border-2 border-slate-800' : 'border border-slate-200';
  const tight = settings.theme === 5;
  // Themes 3-4 fold HSN into the item name and give MRP its own column; theme 4 also moves the
  // invoice number/date up next to the title instead of alongside the bill-to block.
  const combinedHeader = settings.theme === 3 || settings.theme === 4;
  const metaAtTitle = settings.theme === 4;
  const subtotalStyle = settings.theme === 2;
  const Sep = () => <p className={`${tight ? 'my-1' : 'my-2'} overflow-hidden whitespace-nowrap text-center text-slate-300`}>{sep}</p>;

  return (
    <div className={`mx-auto rounded-lg ${border} bg-white p-3 font-mono text-[10px] text-slate-800 shadow-sm`} style={{ width }}>
      {settings.numberOfCopies > 1 && <p className="mb-1.5 text-center text-[9px] font-bold uppercase tracking-wide text-slate-400">{settings.numberOfCopies} copies</p>}

      <div className="text-center">
        {settings.printingType === 'image' && settings.companyLogo && <img src={settings.companyLogo} alt="Company logo" className="mx-auto mb-1 h-8 w-8 object-contain" />}
        {settings.printingType === 'text' && settings.companyLogo && <p className="mb-1 text-[8px] italic text-slate-400">(Logo needs Image printing type)</p>}
        {settings.showCompanyName && <p className="text-xs font-extrabold">{business.name || 'Your Business'}</p>}
        {settings.showAddress && <p className="mt-0.5 text-slate-500">{business.address || '123 Market Street, Bengaluru'}</p>}
        {settings.showPhone && <p className="mt-0.5 text-slate-500">Ph. No.: {business.phone || '98765 43210'}</p>}
        {settings.showEmail && <p className="mt-0.5 text-slate-500">{business.email || 'billing@yourbusiness.com'}</p>}
        {settings.showGstin && <p className="mt-0.5 text-slate-500">GSTIN: {business.gstin || '29ABCDE1234F1Z5'}</p>}
      </div>

      <Sep />
      <p className="text-center font-bold uppercase tracking-wide">{documentTitle}</p>
      {metaAtTitle && <div className="flex justify-between text-slate-500"><span>Invoice No.: INV-101</span><span>Date: 18/08/2026</span></div>}

      <div className={tight ? 'mt-0.5' : 'mt-1'}>
        <p className="font-bold">{THERMAL_DEMO_PARTY.name}</p>
        <p className="text-slate-500">Ph. No.: {THERMAL_DEMO_PARTY.phone}</p>
        <p className="mt-0.5 font-bold">Bill To:</p>
        <p className="text-slate-500">{THERMAL_DEMO_PARTY.address}</p>
        <p className="mt-0.5 font-bold">Place of Supply:</p>
        <p className="text-slate-500">{THERMAL_DEMO_PARTY.state}</p>
        {!metaAtTitle && (
          <>
            <p className="mt-0.5 text-slate-500">Date: 18/08/2026</p>
            <p className="text-slate-500">Invoice No.: INV-101</p>
          </>
        )}
      </div>

      <Sep />

      {combinedHeader ? (
        <div className="font-bold text-slate-600">
          <div className="flex justify-between"><span>#</span><span className="ml-2 flex-1">Item Name{settings.showHsn && '(HSN)'}</span></div>
          <div className="flex justify-between">
            <span>Qty</span>
            {settings.showMrp && <span>MRP</span>}
            <span>Price</span>
            <span>Amount</span>
          </div>
          {settings.showItemDescription && <p>Description</p>}
        </div>
      ) : (
        <div className="flex justify-between font-bold text-slate-600">
          <span>#</span><span className="ml-2 flex-1">Name</span><span>Qty</span><span>Price</span><span>Amount</span>
        </div>
      )}

      <Sep />

      {DEMO_ITEMS.map((item, index) => (
        <div key={item.name} className={tight ? 'mb-1' : 'mb-1.5'}>
          {combinedHeader ? (
            <>
              <p className={settings.boldText ? 'font-bold' : 'font-semibold'}>{index + 1}. {item.name}{settings.showHsn && `(${item.hsn})`}</p>
              <div className="flex justify-between text-slate-600">
                <span>{item.displayQty}{settings.showUnitOfMeasurement && ` ${item.unit}`}</span>
                {settings.showMrp && <span>{item.mrp.toFixed(2)}</span>}
                <span>{item.price.toFixed(2)}</span>
                <span>{fmt(item.amount)}</span>
              </div>
            </>
          ) : (
            <div className={`flex justify-between ${settings.boldText ? 'font-bold' : 'font-semibold'}`}>
              <span>{index + 1}. {item.name}</span>
              <span>{item.displayQty}{settings.showUnitOfMeasurement && ` ${item.unit}`}</span>
              <span>{item.price.toFixed(2)}</span>
              <span>{fmt(item.amount)}</span>
            </div>
          )}
          {settings.showItemDescription && <p className="italic text-slate-400">{item.name} description</p>}
          {(settings.showHsn || settings.showMrp || settings.showBatchNo || settings.showExpDate || settings.showMfgDate || settings.showSize || settings.showModelNo || settings.showItemSerialNo) && (
            <p className="text-slate-400">
              {[
                !combinedHeader && settings.showHsn && `HSN: ${item.hsn}`,
                !combinedHeader && settings.showMrp && `MRP: ${item.mrp.toFixed(2)}`,
                settings.showBatchNo && `Batch No.: ${item.batchNo}`,
                settings.showModelNo && `Model No.: ${item.modelNo}`,
                settings.showExpDate && `Exp. Date: ${item.expDate}`,
                settings.showMfgDate && `Mfg. Date: ${item.mfgDate}`,
                settings.showSize && `Size: ${item.size}`,
                settings.showItemSerialNo && `S/N: ${item.serialNo}`,
              ].filter(Boolean).join(', ')}
            </p>
          )}
          {settings.taxDetails && (
            <div className="pl-3">
              <ThermalRow label={`Disc.(${item.discountPct}%)`} value={`-${fmt(item.discountAmount)}`} />
              <ThermalRow label={`Tax(${item.gstPct}%)`} value={fmt(item.gstAmount)} />
              <ThermalRow label="Final amount" value={fmt(item.amount)} bold />
            </div>
          )}
        </div>
      ))}

      <Sep />

      <div className="flex justify-between font-bold">
        <span>{combinedHeader ? `Qty: ${settings.totalItemQuantity ? TOTAL_QTY_DISPLAY : ''}` : 'Total'}</span>
        {!combinedHeader && settings.totalItemQuantity && <span>{TOTAL_QTY_DISPLAY}</span>}
        <span>{fmt(ITEM_AMOUNT_TOTAL)}</span>
      </div>

      <div className="pl-3">
        {subtotalStyle && <ThermalRow label="Sub Total" value={fmt(ITEM_AMOUNT_TOTAL)} />}
        {subtotalStyle && <ThermalRow label="Disc." value={`-${fmt(ITEM_DISCOUNT_TOTAL)}`} />}
        {!subtotalStyle && settings.taxDetails && <ThermalRow label={`Tax(${INVOICE_TAX_PCT}%)`} value={fmt(INVOICE_TAX_AMOUNT)} />}
        <ThermalRow label={`Disc.(${INVOICE_DISCOUNT_PCT}%)`} value={`-${fmt(INVOICE_DISCOUNT_AMOUNT)}`} />
        <ThermalRow label="Total Disc." value={`-${fmt(ITEM_DISCOUNT_TOTAL + INVOICE_DISCOUNT_AMOUNT)}`} />
        <ThermalRow label="Total" value={fmt(GRAND_TOTAL)} bold />
        {settings.amountInWords && <p className="py-1 text-slate-500">{amountToWords(GRAND_TOTAL, settings.amountInWordsFormat)}</p>}
        {settings.receivedAmount && <ThermalRow label="Received" value={fmt(RECEIVED)} />}
        {settings.balanceAmount && <ThermalRow label="Balance" value={fmt(balance)} />}
        {settings.youSaved && <ThermalRow label="You Saved" value={fmt(YOU_SAVED)} bold />}
        {settings.currentBalanceOfParty && <ThermalRow label="Party Balance" value={fmt(PARTY_BALANCE)} />}
      </div>

      {(settings.printDescription || settings.printTerms || balance > 0) && <Sep />}
      {settings.printDescription && <p className="text-slate-500">Description: Sale Description</p>}
      {settings.printTerms && <p className="text-center text-slate-500">Thanks for doing business with us!</p>}
      {balance > 0 && <p className="mt-1 text-slate-500">Balance to be paid in 3 days</p>}

      {(settings.autoCutPaper || settings.openCashDrawer) && (
        <p className="mt-2 text-center text-[9px] text-slate-400">
          {[settings.autoCutPaper && '✂ Auto-cut', settings.openCashDrawer && '💵 Cash drawer'].filter(Boolean).join('  ·  ')}
        </p>
      )}

      {Array.from({ length: settings.extraLinesAtEnd }).map((_, index) => <div key={`blank-${index}`} className="h-3" />)}
    </div>
  );
}
