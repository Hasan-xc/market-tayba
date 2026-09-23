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
import { DbSettingsService } from './db-settings';
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

class DbUsersService extends DbSettingsService {
  getCurrentUser(): UserAccount | null {
    return this.currentAuthUser;
  }

  getUsers(): UserAccount[] {
    return this.inMemoryUsers;
  }

  async login(username: string, password: string): Promise<{ success: boolean; user?: UserAccount; error?: string }> {
    const cleanUser = (username || '').trim().toLowerCase();
    const cleanPass = (password || '').trim();

    // البحث بالاسم أولاً ثم التحقق من كلمة المرور بالهاش.
    // المسار الانتقالي (نص صريح مخزن) يغطي نافذة ما قبل اكتمال الترحيل.
    const candidates = this.inMemoryUsers.filter((u) => u.username.toLowerCase() === cleanUser);
    for (const user of candidates) {
      if (await verifySecret(cleanPass, user.password, 'password')) {
        this.currentAuthUser = user;
        this.persist(STORAGE_KEYS.AUTH_USER, user);

        // تحديث الكاشير النشط والصلاحية في الإعدادات
        this.inMemorySettings.activeCashier = user.name;
        this.inMemorySettings.currentUserRole = user.role;
        if (user.branchId && user.branchId !== 'all') {
          this.inMemorySettings.activeBranchId = user.branchId;
        }
        this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);

        this.notify();
        return { success: true, user };
      }
    }

    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  }

  /**
   * تحديث خريطة Auth المحلية (auth_uid) لمستخدم — يلتقط تأثير best-effort
   * من طبقة S3 دون أن يغيّر أياً من بيانات اعتماد الدخول أو الخريطة السحابية.
   */
  updateUserCloudMapping(username: string, authUid?: string): void {
    const cleanUser = (username || '').trim().toLowerCase();
    const user = this.inMemoryUsers.find((u) => u.username.toLowerCase() === cleanUser);
    if (user) {
      user.authUid = authUid || user.authUid;
      this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
      this.inMemorySettings.users = this.inMemoryUsers;
      if (this.currentAuthUser && this.currentAuthUser.username.toLowerCase() === cleanUser) {
        this.currentAuthUser = user;
        this.persist(STORAGE_KEYS.AUTH_USER, user);
      }
      this.notify();
    }
  }

  logout() {
    this.currentAuthUser = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.AUTH_USER);
    }
    this.notify();
  }

  /** تحقق موحد من صلاحية كلمة مرور جديدة (≥6 خانات وليست الافتراضية 12345) */
  isValidNewPassword(password: string): { ok: boolean; message?: string } {
    const clean = (password || '').trim();
    if (!clean || clean.length < MIN_PASSWORD_LENGTH) {
      return { ok: false, message: `كلمة المرور يجب أن تتكون من ${MIN_PASSWORD_LENGTH} خانات على الأقل` };
    }
    if (clean === '12345') {
      return { ok: false, message: 'لا يمكن استخدام كلمة المرور الافتراضية (12345) ككلمة سر جديدة' };
    }
    return { ok: true };
  }

  changePassword(userId: string, newPassword: string): { success: boolean; message: string } {
    const check = this.isValidNewPassword(newPassword);
    if (!check.ok) {
      return { success: false, message: check.message! };
    }
    const cleanPass = (newPassword || '').trim();

    const idx = this.inMemoryUsers.findIndex((u) => u.id === userId);
    if (idx === -1) {
      return { success: false, message: 'المستخدم غير موجود' };
    }

    const updatedUser: UserAccount = {
      ...this.inMemoryUsers[idx],
      password: cleanPass,
      mustChangePassword: false,
    };

    this.inMemoryUsers[idx] = updatedUser;

    if (this.currentAuthUser && this.currentAuthUser.id === userId) {
      this.currentAuthUser = updatedUser;
    }

    this.inMemorySettings.users = this.inMemoryUsers;
    this.notify();

    // الهاش قبل أي حفظ — يستبدل النص الصريح بالهاش ثم يكتب التخزين دفعة واحدة
    this.persistUsersAfterHash(updatedUser);

    return { success: true, message: 'تم تغيير كلمة المرور بنجاح' };
  }

  /** كلمة مرور مؤقتة عشوائية للصفوف المنشأة بدون كلمة مرور (لا افتراضي معروف) */
  protected randomTempPassword(): string {
    return 'tp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 10);
  }

  saveUser(user: Partial<UserAccount> & { username: string; name: string }): UserAccount {
    const now = new Date().toISOString();
    const cleanUsername = user.username.trim().toLowerCase();
    const cleanName = user.name.trim();

    let savedUser: UserAccount;
    if (user.id) {
      const idx = this.inMemoryUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        savedUser = {
          ...this.inMemoryUsers[idx],
          ...user,
          username: cleanUsername,
          name: cleanName,
          password: user.password ? user.password.trim() : this.inMemoryUsers[idx].password,
        };
        this.inMemoryUsers[idx] = savedUser;
      } else {
        savedUser = {
          id: user.id,
          username: cleanUsername,
          name: cleanName,
          password: user.password ? user.password.trim() : this.randomTempPassword(),
          role: user.role || 'cashier',
          branchId: user.branchId || 'branch-main',
          branchName: user.branchName,
          mustChangePassword: user.mustChangePassword ?? true,
          createdAt: now,
        };
        this.inMemoryUsers.push(savedUser);
      }
    } else {
      savedUser = {
        id: 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        username: cleanUsername,
        name: cleanName,
        password: user.password ? user.password.trim() : this.randomTempPassword(),
        role: user.role || 'cashier',
        branchId: user.branchId || 'branch-main',
        branchName: user.branchName,
        mustChangePassword: true,
        createdAt: now,
      };
      this.inMemoryUsers.push(savedUser);
    }

    // إذا كانت كلمة المرور الفعلية نصاً صريحاً (جديدة أو افتراضية): هاش قبل أي حفظ.
    // أما إن كانت هاشاً جاهزاً (تعديل دون تغيير كلمة المرور): حفظ مباشر كالسابق.
    if (savedUser.password && !isAlreadyHashed(savedUser.password)) {
      this.persistUsersAfterHash(savedUser);
    } else {
      this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
    }
    this.inMemorySettings.users = this.inMemoryUsers;
    this.inMemorySettings.cashiers = this.inMemoryUsers.map((u) => u.name);
    if (isAlreadyHashed(savedUser.password)) {
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    }
    this.notify();
    return savedUser;
  }

  deleteUser(userId: string): boolean {
    const user = this.inMemoryUsers.find((u) => u.id === userId);
    if (user && user.username === 'ahmed') {
      throw new Error('لا يمكن حذف حساب المدير الرئيسي (ahmed)');
    }

    const prevLen = this.inMemoryUsers.length;
    this.inMemoryUsers = this.inMemoryUsers.filter((u) => u.id !== userId);
    const changed = this.inMemoryUsers.length !== prevLen;
    if (changed) {
      this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
      this.inMemorySettings.users = this.inMemoryUsers;
      this.inMemorySettings.cashiers = this.inMemoryUsers.map((u) => u.name);
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
      this.notify();
    }
    return changed;
  }

  // ==== إدارة الفروع Multi-Branch Management ====
  exportFullBackupJSON(): string {
    const backupData = {
      version: '3.4',
      exportedAt: new Date().toISOString(),
      store: this.getSettings(),
      branches: this.getBranches(),
      users: this.getUsers(),
      products: this.getProducts(),
      sales: this.getSales(),
      returns: this.getReturns(),
      transfers: this.getStockTransfers(),
      customers: this.getCustomers(),
      debtTransactions: this.getDebtTransactions(),
      suppliers: this.getSuppliers(),
      stockAuditLogs: this.getStockAuditLogs(),
      parkedCarts: this.getParkedCarts(),
      shifts: this.getShifts(),
    };
    return JSON.stringify(backupData, null, 2);
  }

  importFullBackupJSON(jsonString: string): { 
    success: boolean; 
    message: string; 
    counts?: { products: number; sales: number; returns: number; customers: number; debtTransactions: number; suppliers: number; shifts?: number; branches?: number; users?: number; transfers?: number } 
  } {
    try {
      const data = JSON.parse(jsonString);
      if (!data.products || !Array.isArray(data.products)) {
        throw new Error('الملف لا يحتوي على بيانات منتجات صالحة');
      }

      if (data.store) {
        this.saveSettings(data.store);
      }
      if (Array.isArray(data.branches) && data.branches.length > 0) {
        this.inMemoryBranches = data.branches;
        this.persist(STORAGE_KEYS.BRANCHES, this.inMemoryBranches);
      }
      if (Array.isArray(data.users) && data.users.length > 0) {
        this.inMemoryUsers = data.users;
        // النسخ الاحتياطية القديمة قد تحتوي كلمات مرور نصية — هاش فوري قبل الاستمرار
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
        void this.migrateUserPasswordHashes();
      }
      if (Array.isArray(data.products)) {
        this.setProducts(data.products);
      }
      if (Array.isArray(data.sales)) {
        this.setSales(data.sales);
      }
      if (Array.isArray(data.returns)) {
        this.setReturns(data.returns);
      }
      if (Array.isArray(data.transfers)) {
        this.inMemoryTransfers = data.transfers;
        this.persist(STORAGE_KEYS.TRANSFERS, this.inMemoryTransfers);
      }
      if (Array.isArray(data.customers)) {
        this.setCustomers(data.customers);
      }
      if (Array.isArray(data.debtTransactions)) {
        this.setDebtTransactions(data.debtTransactions);
      }
      if (Array.isArray(data.suppliers)) {
        this.inMemorySuppliers = data.suppliers;
        this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
      }
      if (Array.isArray(data.stockAuditLogs)) {
        this.inMemoryStockAuditLogs = data.stockAuditLogs;
        this.persist(STORAGE_KEYS.STOCK_AUDIT, this.inMemoryStockAuditLogs);
      }
      if (Array.isArray(data.parkedCarts)) {
        this.inMemoryParkedCarts = data.parkedCarts;
        this.persist(STORAGE_KEYS.PARKED_CARTS, this.inMemoryParkedCarts);
      }
      if (Array.isArray(data.shifts)) {
        this.inMemoryShifts = data.shifts;
        this.persist(STORAGE_KEYS.SHIFTS, this.inMemoryShifts);
      }

      this.triggerCloudSync(async (supabase) => {
        await supabase.syncAll();
      });

      return {
        success: true,
        message: 'تم استيراد النسخة الاحتياطية بنجاح وتحديث كافة البيانات في النظام',
        counts: {
          products: data.products?.length || 0,
          sales: data.sales?.length || 0,
          returns: data.returns?.length || 0,
          customers: data.customers?.length || 0,
          debtTransactions: data.debtTransactions?.length || 0,
          suppliers: data.suppliers?.length || 0,
          shifts: data.shifts?.length || 0,
          branches: data.branches?.length || 0,
          users: data.users?.length || 0,
        },
      };
    } catch (e: any) {
      return {
        success: false,
        message: 'فشل استيراد النسخة: ' + (e.message || 'خطأ في معالجة الملف'),
      };
    }
  }

  // فلترة اختيارية بنطاق تاريخي على createdAt (صيغة yyyy-mm-dd) — تُستخدم في كل دوال التصدير
}

export { DbUsersService };
