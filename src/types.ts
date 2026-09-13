export type UserRole = 'admin' | 'cashier' | 'stock_viewer';

export interface Branch {
  id: string;
  name: string;
  code?: string;
  phone?: string;
  address?: string;
  isMain?: boolean;
  createdAt?: string;
}

export interface UserAccount {
  id: string;
  username: string; // اسم المستخدم لتسجيل الدخول (مثل ahmed)
  name: string; // الاسم الظاهر
  password: string; // كلمة المرور (الافتراضية 12345)
  pin?: string;
  role: UserRole;
  branchId?: string; // الفرع التابع له ('all' لمدير الفروع)
  branchName?: string;
  mustChangePassword?: boolean;
  createdAt: string;
}

export interface StockTransferItem {
  productId: string;
  barcode: string;
  productName: string;
  quantity: number;
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  sourceBranchId: string;
  sourceBranchName: string;
  targetBranchId: string;
  targetBranchName: string;
  items: StockTransferItem[];
  totalQuantity: number;
  status: 'completed' | 'pending' | 'cancelled';
  notes?: string;
  transferredBy: string;
  createdAt: string;
  isSynced?: boolean;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  supplier?: string;
  expiryDate?: string;
  purchasePrice: number;
  salePrice: number;
  quantity: number;
  minQuantityAlert: number;
  unit?: string; // قطعة، كجم، لتر، علبة، كيس
  imageUrl?: string;
  branchId?: string; // 'all' أو معرف فرع محدد مثل 'branch-main' أو 'branch-sharshi'
  branchName?: string;
  assignedBranchIds?: string[]; // قائمة الفروع المعينة للصنف
  branchQuantities?: Record<string, number>; // أرصدة المخزون المستقلة لكل فرع { [branchId]: quantity }
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  company?: string;
  phone?: string;
  address?: string;
  balance: number; // رصيد الديون أو المستحقات
  notes?: string;
  createdAt: string;
}

export interface StockAuditLog {
  id: string;
  productId: string;
  barcode: string;
  productName: string;
  type: 'sale' | 'purchase' | 'manual_adjustment' | 'return' | 'scrap' | 'product_created' | 'product_deleted' | 'price_update' | 'transfer_in' | 'transfer_out';
  quantityDelta: number;
  previousQuantity: number;
  newQuantity: number;
  reason?: string;
  performedBy: string;
  createdAt: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  discount: number; // خصم على الصنف
  total: number;
}

export interface ParkedCart {
  id: string;
  name: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  heldAt: string;
  cashierName: string;
}

export interface SaleItem {
  productId: string;
  barcode: string;
  productName: string;
  quantity: number;
  purchasePrice: number;
  unitPrice: number;
  discount: number;
  total: number;
  profit: number;
}

export interface SplitPayments {
  cash: number;
  card: number;
  bankTransfer?: number;
}

export interface SaleTransaction {
  id: string;
  invoiceNumber: string;
  items: SaleItem[];
  subtotal: number;
  discountTotal: number;
  netTotal: number;
  totalProfit: number;
  paymentMethod: 'cash' | 'card' | 'credit' | 'split' | 'bank_transfer';
  splitPayments?: SplitPayments;
  taxAmount?: number;
  cashTendered: number;
  changeDue: number;
  cashierName: string;
  customerId?: string;
  customerName?: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
  isSynced?: boolean;
  status?: 'completed' | 'refunded';
  refundedAt?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  currentDebt: number; // إجمالي الدين الحالي
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isSynced?: boolean;
}

export interface DebtTransaction {
  id: string;
  customerId: string;
  customerName?: string;
  type: 'sale_credit' | 'payment'; // sale_credit = فاتورة آجل, payment = سداد دفعة
  amount: number; // المبلغ
  invoiceId?: string; // معرف الفاتورة إن وجد
  invoiceNumber?: string; // رقم الفاتورة إن وجد
  notes?: string; // ملاحظات
  remainingBalance: number; // الرصيد المتبقي بعد العملية
  cashierName: string; // اسم الكاشير الذي أجرى العملية
  createdAt: string;
  isSynced?: boolean;
}

export type ReturnReason = 
  | 'damaged' // تالف / عيب مصنعي
  | 'expired' // منتهي الصلاحية
  | 'wrong_item' // خطأ في الشراء
  | 'customer_choice' // رغبة العميل
  | 'other'; // أخرى

export interface ReturnRecord {
  id: string;
  returnNumber: string;
  originalInvoiceNumber?: string;
  productId: string;
  barcode: string;
  productName: string;
  quantity: number;
  refundUnitPrice: number;
  refundTotal: number;
  reason: ReturnReason;
  customReasonText?: string;
  actionTaken: 'restock' | 'scrap'; // إعادة للمخزن أو إتلاف
  cashierName: string;
  branchId?: string;
  branchName?: string;
  createdAt: string;
  notes?: string;
  isSynced?: boolean;
}

export interface StoreSettings {
  storeName: string;
  storePhone: string;
  storeAddress: string;
  storeVatNumber?: string;
  currency: string;
  backupEmail: string;
  enableAutoWeeklyEmail: boolean;
  lastBackupDate?: string;
  receiptFooterMessage: string;
  securityPin: string;
  cashiers: string[]; // قائمة الكاشيرية
  activeCashier: string;
  taxRate: number; // نسبة الضريبة إن وجدت (0 افتراضي)
  receiptPaperSize: '80mm' | '58mm' | 'A4';
  soundEnabled?: boolean;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  supabaseAutoSync?: boolean;
  theme?: 'dark' | 'light';
  currentUserRole?: UserRole;
  users?: UserAccount[];
  branches?: Branch[];
  activeBranchId?: string;
  hardwareScannerDelayThreshold?: number; // ms for barcode scanner
  autoPrintReceipt?: boolean; // طباعة تلقائية فور إنهاء البيع
  skipReceiptPreviewModal?: boolean; // تخطي نافذة المعاينة المنبثقة عند الطباعة التلقائية
}

export interface CashDrawerShift {
  id: string;
  cashierName: string;
  branchId?: string;
  branchName?: string;
  openedAt: string;
  closedAt?: string;
  startingCash: number; // المبلغ الافتتاحي في الصندوق
  expectedCash: number; // النقد المتوقع بالدرج المحسوب آلياً
  actualCashCounted?: number; // المبلغ الفعلي بعد الجرد والعد اليدوي
  difference?: number; // الفارق (+ فائض، - عجز، 0 متطابق)
  status: 'open' | 'closed';
  notes?: string;
  breakdown: {
    startingCash: number;
    cashSales: number;
    debtCollectedCash: number;
    cashReturns: number;
    totalExpectedCash: number;
  };
}

export interface ZReportData {
  reportDate: string;
  generatedAt: string;
  cashierFilter?: string;
  branchFilter?: string;
  branchName?: string;
  totalInvoicesCount: number;
  totalItemsSoldCount: number;
  grossSalesAmount: number;
  totalDiscountsAmount: number;
  totalVatAmount: number;
  netSalesAmount: number;
  totalCostOfGoods: number;
  netProfitAmount: number;
  profitMarginPercent: number;
  paymentBreakdown: {
    cash: number;
    card: number;
    bankTransfer: number;
    credit: number;
    split: number;
  };
  totalReturnsCount: number;
  totalReturnsAmount: number;
  cashierSummaries: {
    cashierName: string;
    invoicesCount: number;
    salesTotal: number;
    profitTotal: number;
  }[];
  branchSummaries?: {
    branchId: string;
    branchName: string;
    invoicesCount: number;
    salesTotal: number;
    profitTotal: number;
  }[];
}

export interface BarcodeLabelConfig {
  format: 'roll_40x30' | 'roll_50x25' | 'a4_30';
  showStoreName: boolean;
  showPrice: boolean;
  showBarcodeText: boolean;
  currency: string;
}

export interface SyncStatus {
  isSyncing: boolean;
  lastSyncedAt?: string;
  pendingSalesCount: number;
  pendingReturnsCount: number;
  pendingCustomersCount?: number;
  pendingDebtCount?: number;
  isConfigured: boolean;
  lastError?: string;
}

export interface DailySummary {
  date: string;
  totalSales: number;
  totalCost: number;
  netProfit: number;
  totalInvoices: number;
  totalItemsSold: number;
  totalReturns: number;
  totalReturnsAmount: number;
  totalCreditSales?: number;
  totalDebtCollected?: number;
}

