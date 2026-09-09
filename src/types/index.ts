export type Role = 'SUPER_ADMIN' | 'OWNER' | 'ACCOUNTANT' | 'STAFF';

export interface Business {
  id: string;
  name: string;
  legalName?: string;
  gstRegistered: boolean;
  gstin?: string;
  address?: string;
  stateCode?: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  createdAt: string;
  _count?: { members: number; invoices: number; branches?: number };
}

export interface Branch {
  id: string;
  businessId: string;
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
  name: string;
  email?: string;
  phone?: string;
  whatsappNumber?: string;
  whatsappOptIn?: boolean;
  invoiceDeliveryMode?: 'MANUAL' | 'AUTOMATIC';
  invoiceDeliveryChannel?: 'EMAIL' | 'WHATSAPP' | 'BOTH';
  gstType?: 'REGISTERED_REGULAR' | 'REGISTERED_COMPOSITION' | 'UNREGISTERED' | 'CONSUMER' | 'OVERSEAS' | 'SEZ';
  gstin?: string;
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
  type: 'OPENING_BALANCE' | 'SALE_INVOICE' | 'PAYMENT_IN';
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

export interface Item {
  id: string;
  name: string;
  sku?: string;
  description?: string;
  unit: string;
  salePrice: string;
  taxRate: string;
  stockQty: string;
}

export type InvoiceStatus = 'DRAFT' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID' | 'CANCELLED';

export interface InvoiceLineItem {
    id: string;
    itemId?: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  lineTotal: string;
}

export interface Invoice {
  id: string;
  branchId?: string;
  branch?: Branch;
  invoiceNumber: string;
  party: Party;
  status: InvoiceStatus;
  issueDate: string;
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
}

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: string;
  method: string;
  reference?: string;
  paidAt: string;
  createdAt: string;
}

export interface PaymentInRecord extends PaymentRecord {
  invoice: Pick<Invoice, 'id' | 'invoiceNumber' | 'grandTotal' | 'amountPaid'> & { party: Pick<Party, 'id' | 'name'> };
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
  | 'PROFORMA_INVOICE'
  | 'PURCHASE_INVOICE'
  | 'DELIVERY_CHALLAN'
  | 'CREDIT_NOTE'
  | 'DEBIT_NOTE';

export type BusinessDocumentStatus = 'DRAFT' | 'ISSUED' | 'ACCEPTED' | 'REJECTED' | 'CONVERTED' | 'CANCELLED';

export interface BusinessDocumentItem {
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
  convertedInvoiceId?: string;
  issueDate: string;
  validUntil?: string;
  dueDate?: string;
  placeOfSupply?: string;
  transportName?: string;
  vehicleNumber?: string;
  eWayBillNumber?: string;
  referenceNumber?: string;
  reason?: string;
  terms?: string;
  notes?: string;
  subTotal: string;
  taxTotal: string;
  discount: string;
    grandTotal: string;
    stockAdjusted?: boolean;
  createdAt: string;
  updatedAt: string;
  items?: BusinessDocumentItem[];
  business?: Business;
  createdBy?: Pick<User, 'id' | 'name' | 'email'>;
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

export type ProductionOrderStatus = 'CONFIRMED' | 'IN_PRODUCTION' | 'READY' | 'DISPATCHED' | 'COMPLETED' | 'CANCELLED';
export type ProductionStageType = 'CUTTING' | 'PRINT_EMBROIDERY' | 'STITCHING' | 'PACKING';
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
  orderedQty: number;
  saleRate: string;
  dueDate?: string;
  status: ProductionOrderStatus;
  notes?: string;
  createdAt: string;
  stages: ProductionStage[];
  costs: ProductionCost[];
  summary: ProductionSummary;
}
