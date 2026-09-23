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
import { DbInventoryService } from './db-inventory';
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

class DbCustomersService extends DbInventoryService {
  getCustomers(): Customer[] {
    return this.inMemoryCustomers;
  }

  getCustomerById(id: string): Customer | undefined {
    return this.inMemoryCustomers.find((c) => c.id === id);
  }

  setCustomers(customers: Customer[]) {
    this.inMemoryCustomers = customers;
    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
    this.notify();
  }

  saveCustomer(customer: { id?: string; name: string; phone?: string; notes?: string; currentDebt?: number }): Customer {
    const now = new Date().toISOString();
    const cleanName = (customer.name || '').trim();
    if (!cleanName) {
      throw new Error('اسم الزبون مطلوب');
    }

    let savedCustomer: Customer;
    if (customer.id) {
      const idx = this.inMemoryCustomers.findIndex((c) => c.id === customer.id);
      if (idx !== -1) {
        savedCustomer = {
          ...this.inMemoryCustomers[idx],
          name: cleanName,
          phone: customer.phone?.trim() || undefined,
          notes: customer.notes?.trim() || undefined,
          currentDebt: Number(customer.currentDebt ?? this.inMemoryCustomers[idx].currentDebt) || 0,
          updatedAt: now,
        };
        this.inMemoryCustomers[idx] = savedCustomer;
      } else {
        savedCustomer = {
          id: customer.id,
          name: cleanName,
          phone: customer.phone?.trim() || undefined,
          notes: customer.notes?.trim() || undefined,
          currentDebt: Number(customer.currentDebt) || 0,
          createdAt: now,
          updatedAt: now,
        };
        this.inMemoryCustomers.unshift(savedCustomer);
      }
    } else {
      savedCustomer = {
        id: 'cust-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        phone: customer.phone?.trim() || undefined,
        notes: customer.notes?.trim() || undefined,
        currentDebt: Number(customer.currentDebt) || 0,
        createdAt: now,
        updatedAt: now,
      };
      this.inMemoryCustomers.unshift(savedCustomer);
    }

    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncCustomer(savedCustomer);
        await supabase.broadcastEvent('CUSTOMER_UPSERT', savedCustomer);
      },
      { type: 'CUSTOMER_UPSERT', data: savedCustomer }
    );

    return savedCustomer;
  }

  deleteCustomer(id: string): boolean {
    const prevLen = this.inMemoryCustomers.length;
    this.inMemoryCustomers = this.inMemoryCustomers.filter((c) => c.id !== id);
    const changed = this.inMemoryCustomers.length !== prevLen;
    if (changed) {
      this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
      this.notify();
      this.triggerCloudSync(
        async (supabase) => {
          await supabase.deleteCustomer(id);
          await supabase.broadcastEvent('CUSTOMER_DELETE', { id });
        },
        { type: 'CUSTOMER_DELETE', data: { id } }
      );
    }
    return changed;
  }

  applyCloudUpsertCustomer(customer: Customer) {
    if (!customer || !customer.id || !customer.name) return;
    const idx = this.inMemoryCustomers.findIndex((c) => c.id === customer.id);
    if (idx !== -1) {
      this.inMemoryCustomers[idx] = {
        ...this.inMemoryCustomers[idx],
        ...customer,
      };
    } else {
      this.inMemoryCustomers.unshift(customer);
    }
    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
    this.notify();
  }

  applyCloudDeleteCustomer(customerId: string) {
    const prevLen = this.inMemoryCustomers.length;
    this.inMemoryCustomers = this.inMemoryCustomers.filter((c) => c.id !== customerId);
    if (this.inMemoryCustomers.length !== prevLen) {
      this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
      this.notify();
    }
  }

  // ==== سجل حركات الديون Debt Transactions ====
  getDebtTransactions(customerId?: string): DebtTransaction[] {
    if (customerId) {
      return this.inMemoryDebtTransactions.filter((tx) => tx.customerId === customerId);
    }
    return this.inMemoryDebtTransactions;
  }

  setDebtTransactions(transactions: DebtTransaction[]) {
    this.inMemoryDebtTransactions = transactions;
    this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
    this.notify();
  }

  addDebtTransaction(tx: Omit<DebtTransaction, 'id' | 'createdAt'>): DebtTransaction {
    const now = new Date().toISOString();
    const newTx: DebtTransaction = {
      ...tx,
      id: 'dtx-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: now,
      isSynced: false,
    };

    this.inMemoryDebtTransactions.unshift(newTx);
    this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        const synced = await supabase.syncDebtTransaction(newTx);
        if (synced) {
          this.markDebtTxAsSynced(newTx.id);
        }
        await supabase.broadcastEvent('DEBT_TX_CREATE', newTx);
      },
      { type: 'DEBT_TX_CREATE', data: newTx }
    );

    return newTx;
  }

  applyCloudInsertDebtTransaction(tx: DebtTransaction) {
    const idx = this.inMemoryDebtTransactions.findIndex((t) => t.id === tx.id);
    if (idx === -1) {
      this.inMemoryDebtTransactions.unshift({ ...tx, isSynced: true });
      this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
      this.notify();
    }
  }

  markDebtTxAsSynced(txId: string) {
    const idx = this.inMemoryDebtTransactions.findIndex((t) => t.id === txId);
    if (idx !== -1) {
      this.inMemoryDebtTransactions[idx].isSynced = true;
      this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
      this.notify();
    }
  }

  // تسديد دين / دفعة من العميل
  applyCustomerPayment(
    customerId: string, 
    paymentAmount: number, 
    notes?: string, 
    cashierName?: string
  ): { customer: Customer; transaction: DebtTransaction } {
    const custIdx = this.inMemoryCustomers.findIndex((c) => c.id === customerId);
    if (custIdx === -1) {
      throw new Error('الزبون غير موجود');
    }

    const currentCust = this.inMemoryCustomers[custIdx];
    const newBalance = Math.max(0, currentCust.currentDebt - paymentAmount);
    
    // تحديث رصيد العميل
    const updatedCust: Customer = {
      ...currentCust,
      currentDebt: newBalance,
      updatedAt: new Date().toISOString(),
    };
    this.inMemoryCustomers[custIdx] = updatedCust;
    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);

    // إضافة حركة سداد
    const tx = this.addDebtTransaction({
      customerId: currentCust.id,
      customerName: currentCust.name,
      type: 'payment',
      amount: paymentAmount,
      notes: notes || 'سداد دفعة من الحساب',
      remainingBalance: newBalance,
      cashierName: cashierName || this.inMemorySettings.activeCashier,
    });

    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncCustomer(updatedCust);
        await supabase.broadcastEvent('CUSTOMER_UPSERT', updatedCust);
      },
      { type: 'CUSTOMER_UPSERT', data: updatedCust }
    );

    return { customer: updatedCust, transaction: tx };
  }

  // ==== إدارة المبيعات Sales ====
  mergeCloudCustomers(cloudCustomers: Customer[]) {
    const cloudMap = new Map(cloudCustomers.map((c) => [c.id, c]));
    const localById = new Map(this.inMemoryCustomers.map((c) => [c.id, c]));
    const merged: Customer[] = [];

    for (const cc of cloudCustomers) {
      const local = localById.get(cc.id);
      if (local && !local.isSynced) {
        merged.push(local);
      } else {
        merged.push({ ...cc });
      }
    }
    for (const lc of this.inMemoryCustomers) {
      if (!cloudMap.has(lc.id)) merged.push(lc);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.inMemoryCustomers = merged;
    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
    this.notify();
  }

  mergeCloudDebtTransactions(cloudDebt: DebtTransaction[]) {
    const cloudMap = new Map(cloudDebt.map((d) => [d.id, d]));
    const localById = new Map(this.inMemoryDebtTransactions.map((d) => [d.id, d]));
    const merged: DebtTransaction[] = [];

    for (const cd of cloudDebt) {
      const local = localById.get(cd.id);
      if (local && !local.isSynced) {
        merged.push(local);
      } else {
        merged.push({ ...cd });
      }
    }
    for (const ld of this.inMemoryDebtTransactions) {
      if (!cloudMap.has(ld.id)) merged.push(ld);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    this.inMemoryDebtTransactions = merged;
    this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
    this.notify();
  }

}

export { DbCustomersService };
