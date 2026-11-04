import type { TrackingFields } from '@/lib/tracking';
export type Role = 'SUPER_ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'STAFF';

export interface Business {
  preferences?: unknown;
  id: string;
  name: string;
  legalName?: string;
  gstRegistered: boolean;
  gstin?: string;
  tin?: string | null;
  address?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  workspaceBranchId?: string;
  _count?: { members: number; invoices: number; branches?: number };
}

export interface Branch {
  id: string;
  businessId: string;
  parentId?: string | null;
  name: string;
  code: string;
  address?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { invoices: number; productionOrders: number; documents: number };
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Party {
  id: string;
  code?: string;
  name: string;
  billingName?: string;
  group?: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  invoiceDeliveryMode?: 'MANUAL' | 'AUTOMATIC';
  invoiceDeliveryChannel?: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  gstType?: 'REGISTERED_REGULAR' | 'REGISTERED_COMPOSITION' | 'UNREGISTERED' | 'CONSUMER' | 'OVERSEAS' | 'SEZ';
  gstin?: string;
  tin?: string | null;
  billingAddr?: string;
  shippingAddr?: string;
  creditLimit?: string | number;
  openingBalance?: string | number;
  openingBalanceType?: 'RECEIVABLE' | 'PAYABLE';
  totalBilled?: number;
  totalReceived?: number;
  balanceDue?: number;
  creditAvailable?: number;
  notes?: string;
  createdAt: string;
}

export interface PartyTransaction {
  id: string;
  type: 'OPENING_BALANCE' | 'SALE_INVOICE' | 'PAYMENT_IN' | 'CREDIT_NOTE';
  number: string;
  date: string;
  amount: number;
  balance: number;
  status?: InvoiceStatus;
  invoiceId?: string;
}

export interface PartyLedger {
  party: Party;
  summary: {
    openingBalance: number;
    totalBilled: number;
    totalReceived: number;
    balanceDue: number;
    creditLimit: number;
    creditAvailable: number;
  };
  transactions: PartyTransaction[];
}

export interface Item extends TrackingFields {
  id: string;
  name: string;
  sku?: string;
  hsnSac?: string;
  purchasePrice?: string | number;
  salePriceTaxMode?: 'WITH_TAX' | 'WITHOUT_TAX';
  purchasePriceTaxMode?: 'WITH_TAX' | 'WITHOUT_TAX';
  lowStockThreshold?: string | number;
  description?: string;
  category?: string | null;
  wholesalePrice?: string | number | null;
  unit: string;
  salePrice: string;
  taxRate: string;
  stockQty: string;
}

export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface InvoiceLineItem extends TrackingFields {
  unit?: string;
  hsnSac?: string;
  taxInclusive?: boolean;
    id: string;
    itemId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: string;
}

export interface InvoiceAttachment {
  id: string;
  kind: 'IMAGE' | 'DOCUMENT';
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Invoice {
  conversionSource?: Pick<BusinessDocument, 'id' | 'type' | 'documentNumber'> | null;
  placeOfSupply?: string | null;
  notes?: string;
  warehouseId?: string;
  creditTotal?: number;
  balanceDue?: number;
  id: string;
  branchId?: string;
  branch?: Branch;
  invoiceNumber: string;
  party: Party;
  status: InvoiceStatus;
  issueDate: string;
  createdAt?: string;
  dueDate?: string;
  subTotal: string;
  taxTotal: string;
  discount: string;
  grandTotal: string;
  amountPaid: string;
  items: InvoiceLineItem[];
  business?: Business;
  deliveries?: InvoiceDelivery[];
  deliveryAttempts?: InvoiceDelivery[];
  payments?: PaymentRecord[];
  attachments?: InvoiceAttachment[];
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: string;
  method: string;
  reference?: string;
  accountId?: string | null;
  paidAt: string;
  createdAt: string;
}

export interface PaymentInRecord extends PaymentRecord {
  invoice: Pick<Invoice, 'id' | 'invoiceNumber' | 'grandTotal' | 'amountPaid' | 'creditTotal' | 'balanceDue'> & { party: Pick<Party, 'id' | 'name' | 'phone' | 'email'> };
  account?: { id: string; bankName: string } | null;
}

export interface ProductionPayment {
  id: string;
  costId: string;
  amount: string;
  method: string;
  reference?: string;
  paidAt: string;
  createdAt: string;
  cost: ProductionCost & { order: Pick<ProductionOrder, 'id' | 'orderNumber'> };
}

export type InvoiceDeliveryChannel = 'EMAIL' | 'WHATSAPP';
export type InvoiceDeliveryStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface InvoiceDelivery {
  id: string;
  invoiceId: string;
  channel: InvoiceDeliveryChannel;
  recipient: string;
  status: InvoiceDeliveryStatus;
  providerMessageId?: string;
  errorMessage?: string;
  attemptedAt: string;
  sentAt?: string;
  createdAt: string;
}

export type BusinessDocumentType =
  | 'QUOTATION'
  | 'SALES_ORDER'
  | 'PROFORMA_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'DELIVERY_CHALLAN'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type BusinessDocumentStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED';

export interface BusinessDocumentItem extends TrackingFields {
  taxInclusive?: boolean;
  id: string;
  itemId?: string;
  description: string;
  hsnSac?: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: string;
}

export interface BusinessDocument {
  returnStock?: boolean;
  debitTotal?: number;
  balanceDue?: number;
  id: string;
  businessId: string;
  branchId?: string;
  branch?: Branch;
  type: BusinessDocumentType;
  documentNumber: string;
  status: BusinessDocumentStatus;
  partyId?: string;
  party?: Party;
  supplierId?: string;
  supplier?: Supplier;
  referenceInvoiceId?: string;
  referenceInvoice?: Pick<Invoice, 'id' | 'invoiceNumber' | 'grandTotal' | 'issueDate'>;
  sourceDocumentId?: string;
  sourceDocument?: Pick<BusinessDocument, 'id' | 'documentNumber' | 'type'>;
  conversionTarget?: { id: string; type: BusinessDocumentType | 'INVOICE'; documentNumber?: string } | null;
  convertedInvoiceId?: string;
  issueDate: string;
  validUntil?: string;
  dueDate?: string;
  placeOfSupply?: string;
  transportName?: string;
  vehicleNumber?: string;
  eWayBillNumber?: string;
  referenceNumber?: string;
  paymentMethod?: string;
  reason?: string;
  terms?: string;
  notes?: string;
  subTotal: string;
  taxTotal: string;
  discount: string;
  grandTotal: string;
  paidAmount?: string;
    stockAdjusted?: boolean;
  createdAt: string;
  updatedAt: string;
  items?: BusinessDocumentItem[];
  attachments?: BusinessDocumentAttachment[];
  payments?: PurchasePayment[];
  business?: Business;
  createdBy?: Pick<User, 'id' | 'name'> & { email?: string };
  warehouseId?: string | null;
  warehouse?: { id: string; name: string } | null;
  billingName?: string | null;
  deliveryLocation?: string | null;
  lrNumber?: string | null;
  noOfBags?: number | null;
  /** List only: the latest payment's bank account or method, else the method chosen on the bill. */
  paymentType?: string | null;
}

/** One supplier payment; its money (and any discount) is split across purchase bills. */
export interface PaymentOutReceipt {
  id: string;
  receiptNumber: string;
  supplierId?: string | null;
  supplier?: { id: string; name: string; phone?: string | null; email?: string | null } | null;
  paidAt: string;
  reference?: string | null;
  description?: string | null;
  paid: number;
  discount: number;
  total: number;
  paymentTypes: string[];
  splits: Array<{ method: string; accountId?: string | null; bankName?: string | null; amount: number; reference?: string | null }>;
  bills: Array<{ id: string; documentNumber: string; referenceNumber?: string | null; settled: number }>;
  attachmentCount: number;
  attachments?: Array<{ id: string; kind: 'IMAGE' | 'DOCUMENT'; fileName: string; mimeType: string; size: number; createdAt: string }>;
  voidedAt?: string | null;
  voidReason?: string | null;
  createdAt: string;
}

export interface OpenPurchaseBill {
  id: string;
  documentNumber: string;
  referenceNumber?: string | null;
  issueDate: string;
  dueDate?: string | null;
  grandTotal: number;
  outstanding: number;
}

export interface PurchasePayment {
  id: string;
  documentId: string;
  amount: string;
  method: string;
  reference?: string;
  notes?: string;
  paidAt: string;
  createdAt: string;
  accountId?: string | null;
  voidedAt?: string | null;
  voidReason?: string | null;
  document: Pick<BusinessDocument, 'id' | 'documentNumber' | 'referenceNumber' | 'grandTotal' | 'paidAmount'> & {
    supplier?: Pick<Supplier, 'id' | 'name'>;
  };
}

export interface WorkspaceBranch {
  id: string;
  name: string;
  code: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  businesses: Business[];
  _count?: { businesses: number };
}

export interface BusinessDocumentAttachment {
  id: string;
  kind: 'IMAGE' | 'DOCUMENT';
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  notes?: string;
}

export type ProductionOrderStatus = 'DRAFT' | 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
export type ProductionStageType = 'MASTER' | 'FABRIC_PURCHASE' | 'WASHING_COMPACTING' | 'CUTTING' | 'PRINT_EMBROIDERY' | 'STITCHING' | 'PACKING' | 'FINAL';
export type ProductionStageStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type ProductionCostCategory = 'FABRIC' | 'COLLAR_RIB' | 'ACCESSORIES' | 'LABELS' | 'TAGS' | 'POLY_BAGS' | 'BUTTONS' | 'CARTONS' | 'TRANSPORT' | 'OTHER';

export interface ProductionStage {
  id: string;
  type: ProductionStageType;
  sequence: number;
  status: ProductionStageStatus;
  partnerName?: string;
  dcNumber?: string;
  plannedQty: number;
  issuedQty: number;
  completedQty: number;
  rejectedQty: number;
  rate: string;
  otherCost: string;
  inputWeightKg?: string | null;
  outputWeightKg?: string | null;
  rateUnit?: 'PIECE' | 'KG';
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  notes?: string;
}

export interface ProductionCost {
  id: string;
  category: ProductionCostCategory;
  description: string;
  quantity: string;
  rate: string;
  amount: string;
  paidAmount: string;
  supplier?: Pick<Supplier, 'id' | 'name'>;
  notes?: string;
}

export interface ProductionSummary {
  revenue: number;
  processCost: number;
  materialCost: number;
  totalMakingCost: number;
  costPerPiece: number;
  profit: number;
  marginPercent: number;
  packedQty: number;
  progressPercent: number;
}

export interface ProductionOrder {
  id: string;
  branchId?: string;
  branch?: Branch;
  orderNumber: string;
  party: Pick<Party, 'id' | 'name' | 'phone'>;
  supplier?: Pick<Supplier, 'id' | 'name' | 'phone'>;
  styleName: string;
  fabricName?: string;
  fabricGsm?: string;
  color?: string;
  sizeBreakdown?: Record<string, number>;
  sizeColorBreakdown?: Record<string, Record<string, number>>;
  instructions?: { product?: Array<{ item: string; detail: string }>; accessories?: Array<{ item: string; detail: string }>; packing?: Array<{ item: string; detail: string }> };
  orderedQty: number;
  saleRate: string;
  supplierRate?: string;
  orderDate?: string;
  confirmedAt?: string;
  invoiceDetails?: string;
  transport?: string;
  destination?: string;
  dueDate?: string;
  status: ProductionOrderStatus;
  notes?: string;
  createdAt: string;
  stages: ProductionStage[];
  costs: ProductionCost[];
  images?: Array<{ id: string; stageType?: ProductionStageType | null; displayName?: string; color?: string; sizeLabel?: string; details?: string; fileName: string; mimeType: string; size: number; createdAt: string }>;
  summary: ProductionSummary;
}

export type PurchaseOrderStatus = 'DRAFT' | 'SENT' | 'CONFIRMED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED' | 'CLOSED';
export interface PurchaseOrderItem extends TrackingFields { id: string; itemId?: string | null; description: string; quantity: string; unit: string; unitPrice: string; taxRate: string; lineTotal: string; taxInclusive?: boolean; }
export interface PurchaseOrder {
  branchId?: string;
  convertedDocumentId?: string;
  id: string; orderNumber: string; orderDate: string; expectedDeliveryDate?: string; deliveryLocation?: string;
  paymentTerms?: string; notes?: string; status: PurchaseOrderStatus; subTotal: string; taxTotal: string; createdAt?: string;
  convertedDocument?: { id: string; documentNumber: string; status: BusinessDocumentStatus } | null;
  warehouseId?: string | null; placeOfSupply?: string | null; billingName?: string | null; phone?: string | null;
  transportName?: string | null; lrNumber?: string | null; eWayBillNumber?: string | null; noOfBags?: number | null;
  paymentMethod?: string | null; accountId?: string | null; paymentReference?: string | null; roundOff?: boolean;
  attachments?: BusinessDocumentAttachment[];
  discount: string; grandTotal: string; supplier: Supplier; items: PurchaseOrderItem[];
}

export interface Expense {
  reference?: string; id: string; description: string; category: string; expenseDate: string; amount: string; taxAmount: string; total: string; method: string; status: string; accountId?: string; notes?: string | null; account?: { id: string; bankName: string } | null; }

export interface ExpenseCategory {
  id: string;
  name: string;
  /** Sum of active (not cancelled) expenses. */
  total: number;
  count: number;
}
