export type TextSize = 1 | 2 | 3 | 4 | 5;

export type RegularPrintSettings = {
  makeDefault: boolean;
  repeatHeader: boolean;
  showCompanyName: boolean;
  companyLogo: string;
  showAddress: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showGstin: boolean;
  paperSize: 'a4' | 'a5' | 'letter';
  orientation: 'portrait' | 'landscape';
  companyNameTextSize: TextSize;
  invoiceTextSize: TextSize;
  printOriginalDuplicate: boolean;
  extraSpaceTop: number;
  expandTable: boolean;
  minRows: number;
  totalItemQuantity: boolean;
  amountWithDecimal: boolean;
  receivedAmount: boolean;
  balanceAmount: boolean;
  currentBalanceOfParty: boolean;
  taxDetails: boolean;
  youSaved: boolean;
  amountWithGrouping: boolean;
  amountInWords: boolean;
  amountInWordsFormat: 'indian' | 'international';
  printDescription: boolean;
  printTerms: boolean;
  printReceivedBy: boolean;
  printDeliveredBy: boolean;
  signatureText: string;
  signatureImage: string;
  paymentMode: boolean;
  printAcknowledgement: boolean;
  showBankDetails: boolean;
  bankName: string;
  bankAccountNumber: string;
  bankIfsc: string;
  upiId: string;
  showUpiQrCode: boolean;
};

export const REGULAR_PRINT_DEFAULTS: RegularPrintSettings = {
  makeDefault: true,
  repeatHeader: false,
  showCompanyName: true,
  companyLogo: '',
  showAddress: true,
  showEmail: false,
  showPhone: true,
  showGstin: true,
  paperSize: 'a4',
  orientation: 'portrait',
  companyNameTextSize: 4,
  invoiceTextSize: 3,
  printOriginalDuplicate: true,
  extraSpaceTop: 0,
  expandTable: false,
  minRows: 0,
  totalItemQuantity: true,
  amountWithDecimal: true,
  receivedAmount: true,
  balanceAmount: true,
  currentBalanceOfParty: false,
  taxDetails: true,
  youSaved: true,
  amountWithGrouping: false,
  amountInWords: true,
  amountInWordsFormat: 'indian',
  printDescription: true,
  printTerms: true,
  printReceivedBy: false,
  printDeliveredBy: false,
  signatureText: 'Authorized Signatory',
  signatureImage: '',
  paymentMode: true,
  printAcknowledgement: false,
  showBankDetails: true,
  bankName: '',
  bankAccountNumber: '',
  bankIfsc: '',
  upiId: '',
  showUpiQrCode: true,
};

export type ThermalTheme = 1 | 2 | 3 | 4 | 5;
export type ThermalPageSize = '2in' | '3in' | '4in' | 'custom';
export type ThermalPrintingType = 'text' | 'image';

export const THERMAL_PAGE_SIZES: Array<{ value: ThermalPageSize; label: string; sublabel: string }> = [
  { value: '2in', label: '2 Inch', sublabel: '58mm' },
  { value: '3in', label: '3 Inch', sublabel: '68mm' },
  { value: '4in', label: '4 Inch', sublabel: '88mm' },
  { value: 'custom', label: 'Custom', sublabel: 'Set width' },
];

export type ThermalPrintSettings = {
  theme: ThermalTheme;
  makeDefault: boolean;
  pageSize: ThermalPageSize;
  customWidthChars: number;
  printingType: ThermalPrintingType;
  boldText: boolean;
  autoCutPaper: boolean;
  openCashDrawer: boolean;
  extraLinesAtEnd: number;
  numberOfCopies: number;

  showCompanyName: boolean;
  companyLogo: string;
  showAddress: boolean;
  showEmail: boolean;
  showPhone: boolean;
  showGstin: boolean;

  showSerialNo: boolean;
  showHsn: boolean;
  showUnitOfMeasurement: boolean;
  showMrp: boolean;
  showItemDescription: boolean;
  showBatchNo: boolean;
  showExpDate: boolean;
  showMfgDate: boolean;
  showSize: boolean;
  showModelNo: boolean;
  showItemSerialNo: boolean;

  totalItemQuantity: boolean;
  amountWithDecimal: boolean;
  receivedAmount: boolean;
  balanceAmount: boolean;
  currentBalanceOfParty: boolean;
  taxDetails: boolean;
  youSaved: boolean;
  amountWithGrouping: boolean;
  amountInWords: boolean;
  amountInWordsFormat: 'indian' | 'international';

  printDescription: boolean;
  printTerms: boolean;
};

export const THERMAL_PRINT_DEFAULTS: ThermalPrintSettings = {
  theme: 1,
  makeDefault: false,
  pageSize: '2in',
  customWidthChars: 48,
  printingType: 'text',
  boldText: false,
  autoCutPaper: true,
  openCashDrawer: false,
  extraLinesAtEnd: 0,
  numberOfCopies: 1,

  showCompanyName: true,
  companyLogo: '',
  showAddress: true,
  showEmail: false,
  showPhone: true,
  showGstin: true,

  showSerialNo: true,
  showHsn: false,
  showUnitOfMeasurement: true,
  showMrp: false,
  showItemDescription: false,
  showBatchNo: false,
  showExpDate: false,
  showMfgDate: false,
  showSize: false,
  showModelNo: false,
  showItemSerialNo: false,

  totalItemQuantity: true,
  amountWithDecimal: true,
  receivedAmount: true,
  balanceAmount: true,
  currentBalanceOfParty: false,
  taxDetails: false,
  youSaved: false,
  amountWithGrouping: false,
  amountInWords: false,
  amountInWordsFormat: 'indian',

  printDescription: false,
  printTerms: true,
};

export type TransactionNameSettings = {
  saleInvoice: string;
  estimateQuotation: string;
  proformaInvoice: string;
  purchaseOrder: string;
  saleOrder: string;
  deliveryChallan: string;
  creditNote: string;
  debitNote: string;
  paymentIn: string;
  paymentOut: string;
};

export const TRANSACTION_NAME_DEFAULTS: TransactionNameSettings = {
  saleInvoice: 'Tax Invoice',
  estimateQuotation: 'Estimate / Quotation',
  proformaInvoice: 'Proforma Invoice',
  purchaseOrder: 'Purchase Order',
  saleOrder: 'Sale Order',
  deliveryChallan: 'Delivery Challan',
  creditNote: 'Credit Note',
  debitNote: 'Debit Note',
  paymentIn: 'Payment-In Receipt',
  paymentOut: 'Payment-Out Receipt',
};

export const TRANSACTION_NAME_FIELDS: Array<{ key: keyof TransactionNameSettings; label: string }> = [
  { key: 'saleInvoice', label: 'Sale Invoice' },
  { key: 'estimateQuotation', label: 'Estimate / Quotation' },
  { key: 'proformaInvoice', label: 'Proforma Invoice' },
  { key: 'purchaseOrder', label: 'Purchase Order' },
  { key: 'saleOrder', label: 'Sale Order' },
  { key: 'deliveryChallan', label: 'Delivery Challan' },
  { key: 'creditNote', label: 'Sale Return / Credit Note' },
  { key: 'debitNote', label: 'Purchase Return / Debit Note' },
  { key: 'paymentIn', label: 'Payment-In' },
  { key: 'paymentOut', label: 'Payment-Out' },
];

export type ItemTableColumnSettings = {
  showHsnColumn: boolean;
  showDiscountColumn: boolean;
  showGstColumn: boolean;
  showItemCode: boolean;
  showItemDescription: boolean;
};

export const ITEM_TABLE_COLUMN_DEFAULTS: ItemTableColumnSettings = {
  showHsnColumn: true,
  showDiscountColumn: true,
  showGstColumn: true,
  showItemCode: false,
  showItemDescription: false,
};

export const TEXT_SIZE_LABELS: Record<TextSize, string> = {
  1: 'Extra small',
  2: 'Small',
  3: 'Medium',
  4: 'Large',
  5: 'Extra large',
};

export function formatAmount(value: number, decimal: boolean, grouping: boolean) {
  return value.toLocaleString('en-IN', {
    minimumFractionDigits: decimal ? 2 : 0,
    maximumFractionDigits: decimal ? 2 : 0,
    useGrouping: grouping,
  });
}
