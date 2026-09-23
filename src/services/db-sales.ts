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
import { roundMoney } from '../utils/money';
import {
  hashPin,
  hashPassword,
  isHashedValue,
  isAlreadyHashed,
  verifySecret,
  hashEqualsKnown,
} from '../utils/crypto';
import { DbCustomersService } from './db-customers';
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

class DbSalesService extends DbCustomersService {
  getSales(branchId?: string, user?: UserAccount | null): SaleTransaction[] {
    const activeUser = user || this.currentAuthUser;
    if (activeUser && activeUser.role !== 'admin') {
      const cashierBranch = activeUser.branchId || 'branch-main';
      return this.inMemorySales.filter((s) => s.branchId === cashierBranch);
    }

    const targetBranch = branchId !== undefined ? branchId : this.getActiveBranchId();
    if (targetBranch && targetBranch !== 'all') {
      return this.inMemorySales.filter((s) => s.branchId === targetBranch);
    }

    return this.inMemorySales;
  }

  getAllRawSales(): SaleTransaction[] {
    return this.inMemorySales;
  }

  addSale(sale: Omit<SaleTransaction, 'id' | 'invoiceNumber' | 'createdAt'>): SaleTransaction {
    const count = this.inMemorySales.length + 1001;
    const now = new Date().toISOString();
    const invoiceNumber = `INV-${count}`;

    const activeBranch = this.getActiveBranch();
    const branchId = sale.branchId || (activeBranch ? activeBranch.id : 'branch-main');
    const branchName = sale.branchName || (activeBranch ? activeBranch.name : 'الفرع الرئيسي');
    // (Fix 3) حماية دفاعية: 'all'/'multi'/فارغ ليس فرعاً حقيقياً — الخصم من مفتاح
    // وهمي bq['all'] لا يمس المخزون الفعلي إطلاقاً، فنُطبّعه على الفرع الرئيسي
    const deductBranchId = branchId && branchId !== 'all' && branchId !== 'multi' ? branchId : 'branch-main';

    const newSale: SaleTransaction = {
      ...sale,
      id: 'sale-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      invoiceNumber,
      branchId,
      branchName,
      createdAt: now,
      isSynced: false,
    };

    // إنقاص المخزون من الفرع الذي أجرى عملية البيع حصراً
    for (const item of sale.items) {
      const pIdx = this.inMemoryProducts.findIndex((p) => p.id === item.productId);
      if (pIdx !== -1) {
        const prod = this.inMemoryProducts[pIdx];
        const bq = this.ensureBranchQuantities(prod);
        const prevBranchQty = bq[deductBranchId] ?? 0;
        const newBranchQty = Math.max(0, prevBranchQty - item.quantity);
        bq[deductBranchId] = newBranchQty;
        prod.branchQuantities = bq;
        const totalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
        prod.quantity = totalQty;
        prod.updatedAt = now;

        this.addStockAuditLog({
          productId: item.productId,
          barcode: item.barcode,
          productName: item.productName,
          type: 'sale',
          quantityDelta: -item.quantity,
          previousQuantity: prevBranchQty,
          newQuantity: newBranchQty,
          reason: `بيع في فاتورة #${invoiceNumber} (${branchName})`,
          performedBy: `${sale.cashierName} - ${branchName}`,
        });
      }
    }

    // إذا كانت الفاتورة بالآجل (Credit/Debt)، نحدّث حساب الزبون وننشئ حركة دين
    if (sale.paymentMethod === 'credit' && sale.customerId) {
      const custIdx = this.inMemoryCustomers.findIndex((c) => c.id === sale.customerId);
      if (custIdx !== -1) {
        const cust = this.inMemoryCustomers[custIdx];
        const newBalance = roundMoney(cust.currentDebt + sale.netTotal);
        const updatedCust: Customer = {
          ...cust,
          currentDebt: newBalance,
          updatedAt: now,
        };
        this.inMemoryCustomers[custIdx] = updatedCust;
        this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);

        // إنشاء حركة دين مرتبطة بالفاتورة
        this.addDebtTransaction({
          customerId: cust.id,
          customerName: cust.name,
          type: 'sale_credit',
          amount: sale.netTotal,
          invoiceId: newSale.id,
          invoiceNumber: newSale.invoiceNumber,
          notes: `فاتورة مبيعات آجل #${invoiceNumber}`,
          remainingBalance: newBalance,
          cashierName: sale.cashierName,
        });

        this.triggerCloudSync(
          async (supabase) => {
            await supabase.syncCustomer(updatedCust);
            await supabase.broadcastEvent('CUSTOMER_UPSERT', updatedCust);
          },
          { type: 'CUSTOMER_UPSERT', data: updatedCust }
        );
      }
    }

    this.inMemorySales.unshift(newSale);
    this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();

    // مزامنة في الخلفية مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        const synced = await supabase.syncSale(newSale);
        if (synced) {
          this.markSaleAsSynced(newSale.id);
        }
        for (const item of sale.items) {
          const prod = this.getProductById(item.productId);
          if (prod) {
            await supabase.syncProduct(prod);
          }
        }
        await supabase.broadcastEvent('SALE_CREATED', newSale);
      },
      { type: 'SALE_CREATE', data: newSale }
    );

    return newSale;
  }

  applyCloudInsertSale(sale: SaleTransaction) {
    const idx = this.inMemorySales.findIndex((s) => s.id === sale.id || s.invoiceNumber === sale.invoiceNumber);
    if (idx === -1) {
      this.inMemorySales.unshift({ ...sale, isSynced: true });
      this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
      this.notify();
    }
  }

  // ==== إدارة المرتجعات Returns ====
  getReturns(branchId?: string, user?: UserAccount | null): ReturnRecord[] {
    const activeUser = user || this.currentAuthUser;
    if (activeUser && activeUser.role !== 'admin') {
      const cashierBranch = activeUser.branchId || 'branch-main';
      return this.inMemoryReturns.filter((r) => r.branchId === cashierBranch);
    }

    const targetBranch = branchId !== undefined ? branchId : this.getActiveBranchId();
    if (targetBranch && targetBranch !== 'all') {
      return this.inMemoryReturns.filter((r) => r.branchId === targetBranch);
    }

    return this.inMemoryReturns;
  }

  getAllRawReturns(): ReturnRecord[] {
    return this.inMemoryReturns;
  }

  addReturn(record: Omit<ReturnRecord, 'id' | 'returnNumber' | 'createdAt'>): ReturnRecord {
    const count = this.inMemoryReturns.length + 101;
    const now = new Date().toISOString();
    const returnNumber = `RET-${count}`;

    const activeBranch = this.getActiveBranch();
    const branchId = record.branchId || (activeBranch ? activeBranch.id : 'branch-main');
    const branchName = record.branchName || (activeBranch ? activeBranch.name : 'الفرع الرئيسي');

    const newReturn: ReturnRecord = {
      ...record,
      id: 'ret-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      returnNumber,
      branchId,
      branchName,
      createdAt: now,
      isSynced: false,
    };

    if (record.actionTaken === 'restock') {
      const pIdx = this.inMemoryProducts.findIndex((p) => p.id === record.productId);
      if (pIdx !== -1) {
        const prod = this.inMemoryProducts[pIdx];
        const bq = this.ensureBranchQuantities(prod);
        const prevBranchQty = bq[branchId] ?? 0;
        const newBranchQty = prevBranchQty + record.quantity;
        bq[branchId] = newBranchQty;
        prod.branchQuantities = bq;
        const totalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
        prod.quantity = totalQty;
        prod.updatedAt = now;

        this.addStockAuditLog({
          productId: record.productId,
          barcode: record.barcode,
          productName: record.productName,
          type: 'return',
          quantityDelta: record.quantity,
          previousQuantity: prevBranchQty,
          newQuantity: newBranchQty,
          reason: `إرجاع صنف (${record.reason}) - إشعار إرجاع #${returnNumber} (${branchName})`,
          performedBy: `${record.cashierName} - ${branchName}`,
        });
      }
    } else {
      const pIdx = this.inMemoryProducts.findIndex((p) => p.id === record.productId);
      const prod = pIdx !== -1 ? this.inMemoryProducts[pIdx] : null;
      const bq = prod ? this.ensureBranchQuantities(prod) : {};
      const curBranchQty = prod ? (bq[branchId] ?? 0) : 0;
      this.addStockAuditLog({
        productId: record.productId,
        barcode: record.barcode,
        productName: record.productName,
        type: 'scrap',
        quantityDelta: 0,
        previousQuantity: curBranchQty,
        newQuantity: curBranchQty,
        reason: `إرجاع تالف دون إضافة للمخزون (${record.reason}) - إشعار #${returnNumber} (${branchName})`,
        performedBy: `${record.cashierName} - ${branchName}`,
      });
    }

    this.inMemoryReturns.unshift(newReturn);
    this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();

    // مزامنة مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        const synced = await supabase.syncReturn(newReturn);
        if (synced) {
          this.markReturnAsSynced(newReturn.id);
        }
        if (record.actionTaken === 'restock') {
          const prod = this.getProductById(record.productId);
          if (prod) {
            await supabase.syncProduct(prod);
          }
        }
        await supabase.broadcastEvent('RETURN_CREATED', newReturn);
      },
      { type: 'RETURN_CREATE', data: newReturn }
    );

    return newReturn;
  }

  applyCloudInsertReturn(returnRecord: ReturnRecord) {
    const idx = this.inMemoryReturns.findIndex((r) => r.id === returnRecord.id || r.returnNumber === returnRecord.returnNumber);
    if (idx === -1) {
      this.inMemoryReturns.unshift({ ...returnRecord, isSynced: true });
      this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
      this.notify();
    }
  }

  markSaleAsSynced(saleId: string) {
    const idx = this.inMemorySales.findIndex((s) => s.id === saleId);
    if (idx !== -1) {
      this.inMemorySales[idx].isSynced = true;
      this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
      this.notify();
    }
  }

  markReturnAsSynced(returnId: string) {
    const idx = this.inMemoryReturns.findIndex((r) => r.id === returnId);
    if (idx !== -1) {
      this.inMemoryReturns[idx].isSynced = true;
      this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
      this.notify();
    }
  }

  setSales(sales: SaleTransaction[]) {
    this.inMemorySales = sales;
    this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
    this.notify();
  }

  // ==== دمج لقطة السحابة مع السجلات المحلية (حماية غير-المتزامن) ====
  // أي دفعة سحابية (سحب أولي / إقلاع) يجب أن تمر من هنا وليس من set* الاستبدالية:
  // سجل محلي لم يصل السحابة بعد (isSynced=false) هو الأحدث ويجب أن يصان،
  // وإلا مُحيت الفواتير المباعة أوفلاين/أثناء التحديث بمجرد إعادة فتح التطبيق.

  mergeCloudSales(cloudSales: SaleTransaction[]) {
    const cloudMap = new Map(cloudSales.map((s) => [s.id, s]));
    const localById = new Map(this.inMemorySales.map((s) => [s.id, s]));
    const merged: SaleTransaction[] = [];

    for (const cs of cloudSales) {
      const local = localById.get(cs.id);
      if (local && !local.isSynced) {
        // نسخة محلية أحدث لم تصل السحابة — تبقى هي (تُدفع لاحقاً)
        merged.push(local);
      } else {
        // نسخة السحابة مرجع — مع صون الحقول المحلية الغائبة عن صف السحابة
        merged.push({
          ...cs,
          branchId: cs.branchId || local?.branchId,
          branchName: cs.branchName || local?.branchName,
          status: cs.status || local?.status,
          splitPayments: cs.splitPayments || local?.splitPayments,
          taxAmount: cs.taxAmount ?? local?.taxAmount,
        });
      }
    }
    // المحلية الغائبة عن السحابة (غير متزامنة أو جديدة) تبقى حية
    for (const ls of this.inMemorySales) {
      if (!cloudMap.has(ls.id)) merged.push(ls);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.inMemorySales = merged;
    this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
    this.notify();
  }

  mergeCloudReturns(cloudReturns: ReturnRecord[]) {
    const cloudMap = new Map(cloudReturns.map((r) => [r.id, r]));
    const localById = new Map(this.inMemoryReturns.map((r) => [r.id, r]));
    const merged: ReturnRecord[] = [];

    for (const cr of cloudReturns) {
      const local = localById.get(cr.id);
      if (local && !local.isSynced) {
        merged.push(local);
      } else {
        merged.push({
          ...cr,
          branchId: cr.branchId || local?.branchId,
          branchName: cr.branchName || local?.branchName,
        });
      }
    }
    for (const lr of this.inMemoryReturns) {
      if (!cloudMap.has(lr.id)) merged.push(lr);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.inMemoryReturns = merged;
    this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
    this.notify();
  }

  setReturns(returns: ReturnRecord[]) {
    this.inMemoryReturns = returns;
    this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
    this.notify();
  }

  getUnsyncedCounts(): { unsyncedSales: number; unsyncedReturns: number; unsyncedDebt: number; offlineQueueCount: number } {
    return {
      unsyncedSales: this.inMemorySales.filter((s) => !s.isSynced).length,
      unsyncedReturns: this.inMemoryReturns.filter((r) => !r.isSynced).length,
      unsyncedDebt: this.inMemoryDebtTransactions.filter((d) => !d.isSynced).length,
      offlineQueueCount: this.offlineQueue.length,
    };
  }

  // ==== إرجاع فاتورة بيع بالكامل (Full Invoice Refund) ====
  refundSale(
    saleId: string, 
    reason: ReturnReason = 'customer_choice', 
    cashierName?: string, 
    notes?: string
  ): { success: boolean; refundedSale: SaleTransaction; createdReturns: ReturnRecord[] } {
    const saleIndex = this.inMemorySales.findIndex((s) => s.id === saleId);
    if (saleIndex === -1) {
      throw new Error('الفاتورة غير موجودة');
    }

    const sale = this.inMemorySales[saleIndex];
    if (sale.status === 'refunded') {
      throw new Error('هذه الفاتورة تم إرجاعها مسبقاً');
    }

    const now = new Date().toISOString();
    const createdReturns: ReturnRecord[] = [];

    // 1. إنشاء إشعار إرجاع لكل صنف في الفاتورة وإعادة المخزون
    for (const item of sale.items) {
      const returnRec = this.addReturn({
        originalInvoiceNumber: sale.invoiceNumber,
        productId: item.productId,
        barcode: item.barcode,
        productName: item.productName,
        quantity: item.quantity,
        refundUnitPrice: item.unitPrice,
        refundTotal: item.total,
        reason,
        actionTaken: 'restock',
        cashierName: cashierName || this.inMemorySettings.activeCashier,
        notes: notes || `إرجاع كامل للفاتورة #${sale.invoiceNumber}`,
      });
      createdReturns.push(returnRec);
    }

    // 2. إذا كانت الفاتورة بالأجل، يتم خصم قيمتها من رصيد دين العميل
    if (sale.paymentMethod === 'credit' && sale.customerId) {
      const custIdx = this.inMemoryCustomers.findIndex((c) => c.id === sale.customerId);
      if (custIdx !== -1) {
        const cust = this.inMemoryCustomers[custIdx];
        const newBalance = roundMoney(Math.max(0, cust.currentDebt - sale.netTotal));
        this.inMemoryCustomers[custIdx] = {
          ...cust,
          currentDebt: newBalance,
          updatedAt: now,
        };
        this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);

        this.addDebtTransaction({
          customerId: cust.id,
          customerName: cust.name,
          type: 'payment',
          amount: sale.netTotal,
          invoiceId: sale.id,
          invoiceNumber: sale.invoiceNumber,
          notes: `إلغاء وإرجاع فاتورة آجل #${sale.invoiceNumber}`,
          remainingBalance: newBalance,
          cashierName: cashierName || this.inMemorySettings.activeCashier,
        });
      }
    }

    // 3. تحديث حالة الفاتورة كـ refunded
    this.inMemorySales[saleIndex] = {
      ...sale,
      status: 'refunded',
      refundedAt: now,
    };

    this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
    this.notify();

    return {
      success: true,
      refundedSale: this.inMemorySales[saleIndex],
      createdReturns,
    };
  }

  // ==== سجل حركات وتدقيق المخزون (Stock Audit Logs) ====
}

export { DbSalesService };
