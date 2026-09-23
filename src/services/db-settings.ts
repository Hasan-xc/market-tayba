import {
  Product,
  SaleTransaction,
  ReturnRecord,
  StoreSettings,
  ParkedCart,
  Customer,
  DebtTransaction,
  Supplier,
  StockAuditLog,
  UserAccount,
  UserRole,
  ReturnReason,
  CashDrawerShift,
  Branch,
  StockTransfer,
} from '../types';
import {
  hashPin,
  hashPassword,
  isHashedValue,
  isAlreadyHashed,
  verifySecret,
  hashEqualsKnown,
} from '../utils/crypto';
import { DbSalesService } from './db-sales';
import {
  DbCore,
  DEFAULT_BRANCHES,
  DEFAULT_USERS,
  MIN_PASSWORD_LENGTH,
  DEFAULT_SETTINGS,
  SEED_PRODUCTS,
  STORAGE_KEYS,
  OfflineMutation,
  DBListener,
} from './db-core';

class DbSettingsService extends DbSalesService {
  getSettings(): StoreSettings {
    return this.inMemorySettings;
  }

  saveSettings(settings: Partial<StoreSettings>): StoreSettings {
    this.inMemorySettings = { ...this.inMemorySettings, ...settings };

    // تطبيع: أي securityPin وارد كنص صريح يُهاش قبل الحفظ (حماسة ذاتية).
    // نؤجل حفظ الإعدادات حتى اكتمال الهاش حتى لا يُكتب النص الصريح على الإطلاق.
    const incomingPin = this.inMemorySettings.securityPin;
    if (incomingPin && !isAlreadyHashed(incomingPin)) {
      hashPin(incomingPin)
        .then((hashed) => {
          if (this.inMemorySettings.securityPin !== hashed) {
            this.inMemorySettings = { ...this.inMemorySettings, securityPin: hashed };
          }
          this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
          this.notify();
        })
        .catch((e) => {
          console.warn('Failed to hash incoming securityPin:', e);
          // سلوك تدهوري: نحفظ كما هي حتى لا تضيع بقية تغييرات الإعدادات
          this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
        });
    } else {
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    }
    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncSettings(this.inMemorySettings);
        await supabase.broadcastEvent('SETTINGS_UPDATED', this.inMemorySettings);
      },
      { type: 'SETTINGS_SAVE', data: this.inMemorySettings }
    );

    return this.inMemorySettings;
  }

  // ==== إدارة المستخدمين وتسجيل الدخول والحسابات ====
  setActiveBranchId(branchId: string) {
    if (this.currentAuthUser && this.currentAuthUser.role !== 'admin') {
      // الكاشير مقيد بفرعه المخصص ولا يمكنه التبديل لفرع آخر
      this.inMemorySettings.activeBranchId = this.currentAuthUser.branchId || 'branch-main';
      return;
    }
    this.inMemorySettings.activeBranchId = branchId;
    this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    this.notify();
  }

  saveBranch(branch: Partial<Branch> & { name: string }): Branch {
    const now = new Date().toISOString();
    const cleanName = branch.name.trim();

    let savedBranch: Branch;
    if (branch.id) {
      const idx = this.inMemoryBranches.findIndex((b) => b.id === branch.id);
      if (idx !== -1) {
        savedBranch = {
          ...this.inMemoryBranches[idx],
          ...branch,
          name: cleanName,
        };
        this.inMemoryBranches[idx] = savedBranch;
      } else {
        savedBranch = {
          id: branch.id,
          name: cleanName,
          code: branch.code,
          phone: branch.phone,
          address: branch.address,
          isMain: branch.isMain || false,
          createdAt: now,
        };
        this.inMemoryBranches.push(savedBranch);
      }
    } else {
      const count = this.inMemoryBranches.length + 1;
      savedBranch = {
        id: 'br-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        code: branch.code || `BR-0${count}`,
        phone: branch.phone,
        address: branch.address,
        isMain: false,
        createdAt: now,
      };
      this.inMemoryBranches.push(savedBranch);
    }

    this.persist(STORAGE_KEYS.BRANCHES, this.inMemoryBranches);
    this.inMemorySettings.branches = this.inMemoryBranches;
    this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    this.notify();
    return savedBranch;
  }

  deleteBranch(branchId: string): boolean {
    const branch = this.inMemoryBranches.find((b) => b.id === branchId);
    if (branch?.isMain) {
      throw new Error('لا يمكن حذف الفرع الرئيسي');
    }

    const prevLen = this.inMemoryBranches.length;
    this.inMemoryBranches = this.inMemoryBranches.filter((b) => b.id !== branchId);
    const changed = this.inMemoryBranches.length !== prevLen;
    if (changed) {
      if (this.inMemorySettings.activeBranchId === branchId) {
        this.inMemorySettings.activeBranchId = 'all';
      }
      this.persist(STORAGE_KEYS.BRANCHES, this.inMemoryBranches);
      this.inMemorySettings.branches = this.inMemoryBranches;
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
      this.notify();
    }
    return changed;
  }

  applyCloudSettings(settings: Partial<StoreSettings>) {
    this.inMemorySettings = { ...this.inMemorySettings, ...settings };

    // جهاز قديم في السحابة قد يرسل security_pin نصياً — نهاشه قبل أي حفظ
    const incomingPin = this.inMemorySettings.securityPin;
    if (incomingPin && !isAlreadyHashed(incomingPin)) {
      hashPin(incomingPin)
        .then((hashed) => {
          if (this.inMemorySettings.securityPin !== hashed) {
            this.inMemorySettings = { ...this.inMemorySettings, securityPin: hashed };
          }
          this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
          this.notify();
        })
        .catch((e) => {
          console.warn('Failed to hash cloud securityPin:', e);
          this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
        });
    } else {
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    }
    this.notify();
  }

  // ==== إدارة ورديات الصندوق وكشف العجز والفائض Cash Drawer Shifts ====
  getShifts(): CashDrawerShift[] {
    return this.inMemoryShifts;
  }

  getCurrentShift(): CashDrawerShift | null {
    return this.inMemoryShifts.find((s) => s.status === 'open') || null;
  }

  calculateShiftExpectedCash(openedAt: string, startingCash: number) {
    const openedTime = new Date(openedAt).getTime();

    // 1. مبيعات النقد (كاش أو الجزء النقدي من الفواتير المجزأة)
    let cashSales = 0;
    for (const sale of this.inMemorySales) {
      const saleTime = new Date(sale.createdAt).getTime();
      if (saleTime >= openedTime) {
        if (sale.paymentMethod === 'cash') {
          cashSales += sale.netTotal;
        } else if (sale.paymentMethod === 'split' && sale.splitPayments?.cash) {
          cashSales += sale.splitPayments.cash;
        }
      }
    }

    // 2. مقبوضات سداد الديون النقدية
    let debtCollectedCash = 0;
    for (const tx of this.inMemoryDebtTransactions) {
      const txTime = new Date(tx.createdAt).getTime();
      if (txTime >= openedTime && tx.type === 'payment') {
        debtCollectedCash += tx.amount;
      }
    }

    // 3. المرتجعات المدفوعة نقداً
    let cashReturns = 0;
    for (const ret of this.inMemoryReturns) {
      const retTime = new Date(ret.createdAt).getTime();
      if (retTime >= openedTime) {
        cashReturns += ret.refundTotal;
      }
    }

    const totalExpectedCash = Number((startingCash + cashSales + debtCollectedCash - cashReturns).toFixed(2));

    return {
      startingCash,
      cashSales: Number(cashSales.toFixed(2)),
      debtCollectedCash: Number(debtCollectedCash.toFixed(2)),
      cashReturns: Number(cashReturns.toFixed(2)),
      totalExpectedCash,
    };
  }

  openShift(cashierName: string, startingCash: number, notes?: string): CashDrawerShift {
    // إغلاق أي وردية مفتوحة سابقة تلقائياً إذا وجدت
    const existing = this.getCurrentShift();
    if (existing) {
      this.closeShift(existing.id, existing.expectedCash, 'إغلاق تلقائي عند فتح وردية جديدة');
    }

    const activeBranch = this.getActiveBranch();
    const branchId = activeBranch ? activeBranch.id : 'branch-main';
    const branchName = activeBranch ? activeBranch.name : 'الفرع الرئيسي';

    const now = new Date().toISOString();
    const newShift: CashDrawerShift = {
      id: 'shift-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      cashierName: cashierName.trim() || 'الكاشير',
      branchId,
      branchName,
      openedAt: now,
      startingCash: Number(startingCash) || 0,
      expectedCash: Number(startingCash) || 0,
      status: 'open',
      notes: notes?.trim() || '',
      breakdown: {
        startingCash: Number(startingCash) || 0,
        cashSales: 0,
        debtCollectedCash: 0,
        cashReturns: 0,
        totalExpectedCash: Number(startingCash) || 0,
      },
    };

    this.inMemoryShifts.unshift(newShift);
    this.persist(STORAGE_KEYS.SHIFTS, this.inMemoryShifts);
    this.notify();
    return newShift;
  }

  closeShift(shiftId: string, actualCashCounted: number, notes?: string): CashDrawerShift {
    const shift = this.inMemoryShifts.find((s) => s.id === shiftId);
    if (!shift) {
      throw new Error('الوردية المحددة غير موجودة');
    }

    const breakdown = this.calculateShiftExpectedCash(shift.openedAt, shift.startingCash);
    const actual = Number(Number(actualCashCounted || 0).toFixed(2));
    const difference = Number((actual - breakdown.totalExpectedCash).toFixed(2));

    shift.closedAt = new Date().toISOString();
    shift.status = 'closed';
    shift.expectedCash = breakdown.totalExpectedCash;
    shift.actualCashCounted = actual;
    shift.difference = difference;
    shift.breakdown = breakdown;
    if (notes) {
      shift.notes = (shift.notes ? shift.notes + ' | ' : '') + notes.trim();
    }

    this.persist(STORAGE_KEYS.SHIFTS, this.inMemoryShifts);
    this.notify();
    return shift;
  }

  // ==== النسخ الاحتياطي والتصدير Backup & Export ====
  exportSuppliersCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const suppliers = this.getSuppliers().filter((s) => this.isWithinDateRange(s.createdAt, dateRange));
    let csv = '\uFEFFاسم المورد,الشركة,رقم الهاتف,العنوان,الرصيد الدائن,ملاحظات\n';
    suppliers.forEach((s) => {
      csv += `"${s.name}","${s.company || '-'}","${s.phone || '-'}","${s.address || '-'}","${s.balance} ${this.inMemorySettings.currency}","${s.notes || ''}"\n`;
    });
    return csv;
  }

  exportStockAuditCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const logs = this.getStockAuditLogs().filter((l) => this.isWithinDateRange(l.createdAt, dateRange));
    let csv = '\uFEFFالتاريخ والوقت,اسم الصنف,الباركود,نوع الحركة,الكمية المعدلة,الرصيد السابق,الرصيد الجديد,السبب,المسؤول\n';
    const typeMap: Record<string, string> = {
      sale: 'بيع فاتورة',
      purchase: 'شراء / توريد',
      manual_adjustment: 'تعديل جردي',
      return: 'إرجاع مستودع',
      scrap: 'إتلاف وتالف',
      damage: 'إتلاف / تالف',
      vendor_return: 'إرجاع للمورد',
      product_created: 'إضافة صنف جديد',
      product_deleted: 'حذف صنف من المخزون',
      price_update: 'تعديل أسعار',
    };
    logs.forEach((l) => {
      const dateStr = new Date(l.createdAt).toLocaleString('ar-SA');
      const typeStr = typeMap[l.type] || l.type;
      csv += `"${dateStr}","${l.productName}","${l.barcode}","${typeStr}",${l.quantityDelta},${l.previousQuantity},${l.newQuantity},"${l.reason || '-'}","${l.performedBy}"\n`;
    });
    return csv;
  }

  exportProductsCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const products = this.getProducts().filter((p) => this.isWithinDateRange(p.createdAt, dateRange));
    let csv = '\uFEFFالباركود,اسم الصنف,القسم,سعر الشراء,سعر البيع,الكمية,حد التنبيه,الوحدة\n';
    products.forEach((p) => {
      csv += `"${p.barcode}","${p.name}","${p.category}",${p.purchasePrice},${p.salePrice},${p.quantity},${p.minQuantityAlert},"${p.unit || 'حبة'}"\n`;
    });
    return csv;
  }

  exportCustomersCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const customers = this.getCustomers().filter((c) => this.isWithinDateRange(c.createdAt, dateRange));
    let csv = '\uFEFFالاسم,الهاتف,إجمالي الدين,تاريخ التسجيل,ملاحظات\n';
    customers.forEach((c) => {
      const dateStr = new Date(c.createdAt).toLocaleDateString('ar-SA');
      csv += `"${c.name}","${c.phone || '-'}","${c.currentDebt.toFixed(2)} ${this.inMemorySettings.currency}","${dateStr}","${c.notes || ''}"\n`;
    });
    return csv;
  }

  exportInventoryValuationCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const products = this.getProducts().filter((p) => this.isWithinDateRange(p.createdAt, dateRange));
    let csv = '\uFEFFالباركود,اسم الصنف,القسم,الكمية,سعر التكلفة,إجمالي التكلفة,سعر البيع,إجمالي البيع,الربح المتوقع,هامش الربح %\n';
    products.forEach((p) => {
      const totalCost = p.quantity * p.purchasePrice;
      const totalRetail = p.quantity * p.salePrice;
      const expectedProfit = totalRetail - totalCost;
      const margin = totalRetail > 0 ? ((expectedProfit / totalRetail) * 100).toFixed(1) : '0';
      csv += `"${p.barcode}","${p.name}","${p.category}",${p.quantity},${p.purchasePrice},${totalCost.toFixed(2)},${p.salePrice},${totalRetail.toFixed(2)},${expectedProfit.toFixed(2)},${margin}%\n`;
    });
    return csv;
  }

  exportSalesCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const sales = this.getSales().filter((s) => this.isWithinDateRange(s.createdAt, dateRange));
    let csv = '\uFEFFرقم الفاتورة,التاريخ والوقت,الكاشير,عدد الأصناف,المجموع الفرعي,الخصم,الصافي,الربح,طريقة الدفع,العميل\n';
    const payMap: Record<string, string> = {
      cash: 'نقدي',
      card: 'شبكة / مدى',
      credit: 'آجل / على الحساب',
      split: 'مزدوج',
    };
    sales.forEach((s) => {
      const dateStr = new Date(s.createdAt).toLocaleString('ar-SA');
      const payStr = payMap[s.paymentMethod] || s.paymentMethod;
      csv += `"${s.invoiceNumber}","${dateStr}","${s.cashierName}",${s.items.length},${s.subtotal},${s.discountTotal},${s.netTotal},${s.totalProfit},"${payStr}","${s.customerName || '-'}"\n`;
    });
    return csv;
  }

  exportReturnsCSV(dateRange?: { dateFrom?: string; dateTo?: string }): string {
    const returns = this.getReturns().filter((r) => this.isWithinDateRange(r.createdAt, dateRange));
    let csv = '\uFEFFرقم الإرجاع,التاريخ والوقت,رقم الفاتورة الأصلية,اسم الصنف,الباركود,الكمية,سعر الوحدة,إجمالي المسترجع,السبب,الإجراء,الكاشير,ملاحظات\n';
    const reasonMap: Record<string, string> = {
      damaged: 'تالف',
      expired: 'منتهي الصلاحية',
      wrong_item: 'صنف خاطئ',
      customer_choice: 'رغبة العميل',
      other: 'أخرى',
    };
    returns.forEach((r) => {
      const dateStr = new Date(r.createdAt).toLocaleString('ar-SA');
      const reasonStr = reasonMap[r.reason] || r.reason;
      csv += `"${r.returnNumber}","${dateStr}","${r.originalInvoiceNumber || '-'}","${r.productName}","${r.barcode}",${r.quantity},${r.refundUnitPrice},${r.refundTotal},"${reasonStr}","${r.actionTaken === 'restock' ? 'إعادة للمخزن' : 'إتلاف'}","${r.cashierName}","${r.notes || ''}"\n`;
    });
    return csv;
  }

}

export { DbSettingsService };
