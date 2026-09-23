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
  StockTransfer
} from '../types';
import { hashPin, hashPassword, isHashedValue, isAlreadyHashed, verifySecret, hashEqualsKnown } from '../utils/crypto';

export const DEFAULT_BRANCHES: Branch[] = [
  {
    id: 'branch-main',
    name: 'الفرع الرئيسي',
    code: 'BR-01',
    phone: '0501234567',
    address: 'المقر الرئيسي - ماركت طيبه',
    isMain: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'branch-sharshi',
    name: 'فرع الشارشي',
    code: 'BR-02',
    phone: '0507654321',
    address: 'فرع الشارشي - ماركت طيبه',
    isMain: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

export const DEFAULT_USERS: UserAccount[] = [
  {
    id: 'user-admin',
    username: 'ahmed',
    name: 'أحمد (المدير)',
    password: '12345',
    role: 'admin',
    branchId: 'all',
    branchName: 'جميع الفروع',
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-cashier-1',
    username: 'cashier1',
    name: 'كاشير 1 (الرئيسي)',
    password: '12345',
    role: 'cashier',
    branchId: 'branch-main',
    branchName: 'الفرع الرئيسي',
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-cashier-sharshi',
    username: 'sharshi',
    name: 'كاشير فرع الشارشي',
    password: '12345',
    role: 'cashier',
    branchId: 'branch-sharshi',
    branchName: 'فرع الشارشي',
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

// الحد الأدنى لكلمة المرور (موحد مع حد GoTrue السحابي 6 على اللوحة)
export const MIN_PASSWORD_LENGTH = 6;

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'ماركت طيبه',
  storePhone: '0501234567',
  storeAddress: 'ماركت طيبه - للمواد الغذائية والاستهلاكية',
  storeVatNumber: '300123456700003',
  currency: 'TL',
  backupEmail: 'sm1173124@gmail.com',
  enableAutoWeeklyEmail: true,
  receiptFooterMessage: 'شكراً لزيارتكم ماركت طيبه! نسعد دائماً بخدمتكم.',
  securityPin: '1234',
  cashiers: ['أحمد (المدير)', 'كاشير 1'],
  activeCashier: 'أحمد (المدير)',
  taxRate: 0,
  receiptPaperSize: '80mm',
  soundEnabled: true,
  theme: 'dark',
  currentUserRole: 'admin',
  hardwareScannerDelayThreshold: 55,
  autoPrintReceipt: false,
  skipReceiptPreviewModal: false,
  branches: DEFAULT_BRANCHES,
  activeBranchId: 'all',
  users: DEFAULT_USERS,
  supabaseUrl: 'https://qvfunbtrgdhtqlmjwdzc.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZnVuYnRyZ2RodHFsbWp3ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODczMzIsImV4cCI6MjEwMzY2MzMzMn0.JaP9qfJDQe2pRV3Qa-uN01khLU6Tj1FMb8ktaXghUc4',
};

export const SEED_PRODUCTS: Product[] = [];

export type DBListener = () => void;

export const STORAGE_KEYS = {
  PRODUCTS: 'taibah_pos_products_v3',
  SALES: 'taibah_pos_sales_v3',
  RETURNS: 'taibah_pos_returns_v3',
  SETTINGS: 'taibah_pos_settings_v3',
  PARKED_CARTS: 'taibah_pos_parked_carts_v3',
  CUSTOMERS: 'taibah_pos_customers_v3',
  DEBT_TRANSACTIONS: 'taibah_pos_debt_transactions_v3',
  SUPPLIERS: 'taibah_pos_suppliers_v3',
  STOCK_AUDIT: 'taibah_pos_stock_audit_v3',
  SHIFTS: 'taibah_pos_shifts_v3',
  BRANCHES: 'taibah_pos_branches_v3',
  USERS: 'taibah_pos_users_v3',
  TRANSFERS: 'taibah_pos_transfers_v3',
  AUTH_USER: 'taibah_auth_user_v3',
  OFFLINE_MUTATIONS: 'taibah_pos_offline_mutations_v3',
};

export interface OfflineMutation {
  id: string;
  type: 
    | 'PRODUCT_UPSERT' 
    | 'PRODUCT_DELETE' 
    | 'SALE_CREATE' 
    | 'RETURN_CREATE' 
    | 'CUSTOMER_UPSERT' 
    | 'CUSTOMER_DELETE' 
    | 'SUPPLIER_UPSERT'
    | 'DEBT_TX_CREATE' 
    | 'SETTINGS_SAVE'
    | 'STOCK_AUDIT_CREATE';
  data: any;
  timestamp: string;
}


class DbCore {
  protected inMemoryProducts: Product[] = [];
  protected inMemorySales: SaleTransaction[] = [];
  protected inMemoryReturns: ReturnRecord[] = [];
  protected inMemoryParkedCarts: ParkedCart[] = [];
  protected inMemoryCustomers: Customer[] = [];
  protected inMemoryDebtTransactions: DebtTransaction[] = [];
  protected inMemorySuppliers: Supplier[] = [];
  protected inMemoryStockAuditLogs: StockAuditLog[] = [];
  protected inMemoryShifts: CashDrawerShift[] = [];
  protected inMemoryBranches: Branch[] = [...DEFAULT_BRANCHES];
  protected inMemoryUsers: UserAccount[] = [...DEFAULT_USERS];
  protected inMemoryTransfers: StockTransfer[] = [];
  protected currentAuthUser: UserAccount | null = null;
  protected inMemorySettings: StoreSettings = { ...DEFAULT_SETTINGS };
  protected offlineQueue: OfflineMutation[] = [];
  protected listeners: Set<DBListener> = new Set();

  protected readyPromise: Promise<void>;

  constructor() {
    this.loadFromLocalStorage();
    this.normalizeBranchInventories();
    // ترحيلات القيم الحساسة (PIN/كلمات المرور) — يجب اكتمالها قبل عرض واجهة الدخول.
    // main.tsx ينتظر dbReady قبل تركيب التطبيق، فلا يقرأ PinModal/LoginModal
    // أبداً قيمة غير مهاجرة.
    this.readyPromise = this.runMigrations();
  }

  // ==== ترحيلات القيم الحساسة عند التحميل ====
  protected async runMigrations(): Promise<void> {
    await this.migrateSecurityPinHash();
    await this.migrateUserPasswordHashes();
    await this.migrateForcePasswordChangeForDefaultPassword();
  }

  /** وعد جهوزية القاعدة: يكتمل بعد انتهاء جميع ترحيلات التحميل */
  get ready(): Promise<void> {
    return this.readyPromise;
  }

  // ==== تحميل وحفظ في التخزين المحلي الآمن ====
  protected loadFromLocalStorage() {
    if (typeof window === 'undefined') return;
    try {
      const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (storedSettings) {
        this.inMemorySettings = { ...DEFAULT_SETTINGS, ...JSON.parse(storedSettings) };
      }

      const storedBranches = localStorage.getItem(STORAGE_KEYS.BRANCHES);
      if (storedBranches) {
        this.inMemoryBranches = JSON.parse(storedBranches);
        // التحقق من وجود الفرعين الأساسيين: الرئيسي والشارشي
        const hasMain = this.inMemoryBranches.some((b) => b.id === 'branch-main' || b.isMain);
        if (!hasMain) {
          this.inMemoryBranches.unshift(DEFAULT_BRANCHES[0]);
        }
        const hasSharshi = this.inMemoryBranches.some((b) => b.id === 'branch-sharshi' || (b.name && b.name.includes('الشارشي')));
        if (!hasSharshi) {
          this.inMemoryBranches.push(DEFAULT_BRANCHES[1]);
        }
        this.persist(STORAGE_KEYS.BRANCHES, this.inMemoryBranches);
      } else if (this.inMemorySettings.branches && this.inMemorySettings.branches.length > 0) {
        this.inMemoryBranches = this.inMemorySettings.branches;
      } else {
        this.inMemoryBranches = [...DEFAULT_BRANCHES];
        this.persist(STORAGE_KEYS.BRANCHES, this.inMemoryBranches);
      }

      const storedUsers = localStorage.getItem(STORAGE_KEYS.USERS);
      if (storedUsers) {
        this.inMemoryUsers = JSON.parse(storedUsers);
        const hasAdmin = this.inMemoryUsers.some((u) => u.username === 'ahmed');
        if (!hasAdmin) {
          this.inMemoryUsers.unshift(DEFAULT_USERS[0]);
        }
        const hasSharshiCashier = this.inMemoryUsers.some((u) => u.username === 'sharshi' || u.branchId === 'branch-sharshi');
        if (!hasSharshiCashier) {
          this.inMemoryUsers.push(DEFAULT_USERS[2]);
        }
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
      } else if (this.inMemorySettings.users && this.inMemorySettings.users.length > 0) {
        this.inMemoryUsers = this.inMemorySettings.users;
      } else {
        this.inMemoryUsers = [...DEFAULT_USERS];
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
      }

      const storedAuth = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
      if (storedAuth) {
        this.currentAuthUser = JSON.parse(storedAuth);
      }
      // بلا تسجيل دخول تلقائي: أول فتحة تُفتح صفحة تسجيل الدخول، والجلسة تستمر
      // (تُحفظ أعلاه) حتى يسجّل المستخدم خروجه بنفسه.

      const storedProducts = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
      if (storedProducts) {
        this.inMemoryProducts = JSON.parse(storedProducts);
      }

      const storedSales = localStorage.getItem(STORAGE_KEYS.SALES);
      if (storedSales) {
        this.inMemorySales = JSON.parse(storedSales);
      }

      const storedReturns = localStorage.getItem(STORAGE_KEYS.RETURNS);
      if (storedReturns) {
        this.inMemoryReturns = JSON.parse(storedReturns);
      }

      const storedCarts = localStorage.getItem(STORAGE_KEYS.PARKED_CARTS);
      if (storedCarts) {
        this.inMemoryParkedCarts = JSON.parse(storedCarts);
      }

      const storedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      if (storedCustomers) {
        this.inMemoryCustomers = JSON.parse(storedCustomers);
      }

      const storedDebtTx = localStorage.getItem(STORAGE_KEYS.DEBT_TRANSACTIONS);
      if (storedDebtTx) {
        this.inMemoryDebtTransactions = JSON.parse(storedDebtTx);
      }

      const storedSuppliers = localStorage.getItem(STORAGE_KEYS.SUPPLIERS);
      if (storedSuppliers) {
        this.inMemorySuppliers = JSON.parse(storedSuppliers);
      }

      const storedStockAudit = localStorage.getItem(STORAGE_KEYS.STOCK_AUDIT);
      if (storedStockAudit) {
        this.inMemoryStockAuditLogs = JSON.parse(storedStockAudit);
      }

      const storedShifts = localStorage.getItem(STORAGE_KEYS.SHIFTS);
      if (storedShifts) {
        this.inMemoryShifts = JSON.parse(storedShifts);
      }

      const storedTransfers = localStorage.getItem(STORAGE_KEYS.TRANSFERS);
      if (storedTransfers) {
        this.inMemoryTransfers = JSON.parse(storedTransfers);
      }

      const storedMutations = localStorage.getItem(STORAGE_KEYS.OFFLINE_MUTATIONS);
      if (storedMutations) {
        this.offlineQueue = JSON.parse(storedMutations);
      }
    } catch (e) {
      console.warn('Failed to load local storage state:', e);
    }
  }

  protected persist(key: string, data: any) {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn(`Failed to persist to ${key}:`, e);
    }
  }

  // ==== ترحيل رمز الدخول: من نص صريح إلى هاش (لمرة واحدة عند التحميل) ====
  // إذا كانت القيمة المخزنة نصاً قصيراً (مثل '1234') وليست هاشاً (64 خانة hex)
  // يتم هاشها في مكانها وإعادة حفظها، فيبقى الرمز القديم يعمل شفافاً للمستخدم.
  protected async migrateSecurityPinHash(): Promise<void> {
    try {
      const current = this.inMemorySettings.securityPin;
      if (current && !isAlreadyHashed(current)) {
        this.inMemorySettings = {
          ...this.inMemorySettings,
          securityPin: await hashPin(current),
        };
        this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
        this.notify();
      }
    } catch (e) {
      console.warn('Failed to migrate securityPin to hash:', e);
    }
  }

  // ==== ترحيل كلمات مرور المستخدمين: من نص صريح إلى هاش (لمرة واحدة عند التحميل) ====
  // يغطي الحسابات المخزنة محلياً وكلمات المرور الافتراضية ('12345') المبذورة سابقاً،
  // فيظل الجميع قادرين على الدخول بنفس كلماتهم دون إعادة تعيين.
  protected async migrateUserPasswordHashes(): Promise<void> {
    try {
      let changed = false;
      const migrated = await Promise.all(
        this.inMemoryUsers.map(async (u) => {
          if (u.password && !isAlreadyHashed(u.password)) {
            changed = true;
            return { ...u, password: await hashPassword(u.password) };
          }
          return u;
        })
      );
      if (changed) {
        this.inMemoryUsers = migrated;
        if (this.currentAuthUser) {
          const updatedCurrent = migrated.find((u) => u.id === this.currentAuthUser!.id);
          if (updatedCurrent) this.currentAuthUser = updatedCurrent;
        }
        this.inMemorySettings.users = this.inMemoryUsers;
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
        if (this.currentAuthUser) {
          this.persist(STORAGE_KEYS.AUTH_USER, this.currentAuthUser);
        }
        this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
        this.notify();
      }
    } catch (e) {
      console.warn('Failed to migrate user passwords to hash:', e);
    }
  }

  // ==== إلزام تغيير كلمة المرور لمن لا يزال يستخدم الافتراضية (بلا قفل أي حساب) ====
  // أي جهاز مخزّن فيه كلمة المرور الافتراضية 12345 (نصاً أو هاشاً) يُرفع له علم
  // mustChangePassword دون تغيير كلمة المرور نفسها، فيُجبر على تعيين كلمة خاصة
  // به عند أول تسجيل دخول بعد التحديث — ثم تحل المحل وكلمة 12345 تهلك من الجهاز.
  protected async migrateForcePasswordChangeForDefaultPassword(): Promise<void> {
    try {
      let changed = false;
      const usersWithFlag = await Promise.all(
        this.inMemoryUsers.map(async (u) => {
          if (u.mustChangePassword) return u;
          const isDefault =
            u.password === '12345' ||
            (await hashEqualsKnown(u.password, '12345', 'password'));
          if (isDefault) {
            changed = true;
            return { ...u, mustChangePassword: true };
          }
          return u;
        })
      );
      this.inMemoryUsers = usersWithFlag;
      if (!changed) return;
      const updatedCurrent = this.currentAuthUser
        ? this.inMemoryUsers.find((u) => u.id === this.currentAuthUser!.id)
        : undefined;
      if (updatedCurrent) this.currentAuthUser = updatedCurrent;
      this.inMemorySettings.users = this.inMemoryUsers;
      this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
      this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
      if (this.currentAuthUser) {
        this.persist(STORAGE_KEYS.AUTH_USER, this.currentAuthUser);
      }
      this.notify();
    } catch (e) {
      console.warn('Failed to force password change for default password:', e);
    }
  }

  // هاش كلمة مرور مستخدم (المخزنة نصاً مؤقتاً في الذاكرة) قبل أي حفظ،
  // ثم يستبدلها بالهاش ويكتب التخزين دفعة واحدة — لا يُكتب النص الصريح إطلاقاً.
  protected persistUsersAfterHash(userWithPlainPass: UserAccount): void {
    hashPassword(userWithPlainPass.password)
      .then((hashed) => {
        const idx = this.inMemoryUsers.findIndex((u) => u.id === userWithPlainPass.id);
        if (idx !== -1 && this.inMemoryUsers[idx].password === userWithPlainPass.password) {
          this.inMemoryUsers[idx] = { ...this.inMemoryUsers[idx], password: hashed };
        }
        if (this.currentAuthUser && this.currentAuthUser.id === userWithPlainPass.id) {
          this.currentAuthUser = { ...this.currentAuthUser, password: hashed };
        }
        this.inMemorySettings.users = this.inMemoryUsers;
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
        if (this.currentAuthUser) {
          this.persist(STORAGE_KEYS.AUTH_USER, this.currentAuthUser);
        }
        this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
        this.notify();
      })
      .catch((e) => {
        console.warn('Failed to hash user password:', e);
        // سلوك تدهوري: نحفظ كما هي حتى لا تضيع كلمة المرور الجديدة
        this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
        this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
      });
  }

  // ==== إدارة المستمعين والتحديثات التلقائية ====
  subscribe(listener: DBListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  notify() {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (err) {
        console.error('Error in DB listener:', err);
      }
    });
  }

  // Helper للمزامنة السحابية غير المعطلة مع طابور أوفلاين
  protected async triggerCloudSync(
    action: (supabaseService: typeof import('./supabase').SupabaseService) => Promise<any>,
    offlineFallbackMutation?: { type: OfflineMutation['type']; data: any }
  ) {
    try {
      const { SupabaseService } = await import('./supabase');
      if (SupabaseService.isConfigured() && navigator.onLine) {
        await action(SupabaseService);
      } else if (offlineFallbackMutation) {
        this.enqueueOfflineMutation(offlineFallbackMutation.type, offlineFallbackMutation.data);
      }
    } catch (e) {
      console.warn('Background Supabase cloud action error:', e);
      if (offlineFallbackMutation) {
        this.enqueueOfflineMutation(offlineFallbackMutation.type, offlineFallbackMutation.data);
      }
    }
  }

  protected enqueueOfflineMutation(type: OfflineMutation['type'], data: any) {
    const mutation: OfflineMutation = {
      id: 'mut-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.offlineQueue.push(mutation);
    this.persist(STORAGE_KEYS.OFFLINE_MUTATIONS, this.offlineQueue);
  }

  public getOfflineQueue(): OfflineMutation[] {
    return this.offlineQueue;
  }

  public clearOfflineQueue() {
    this.offlineQueue = [];
    this.persist(STORAGE_KEYS.OFFLINE_MUTATIONS, this.offlineQueue);
  }

  // ==== التحقق من استقلالية وتواجد الصنف في الفرع (Branch Isolation Verification) ====
  normalizeBranchInventories() {
    let changed = false;
    this.inMemoryProducts = this.inMemoryProducts.map((p) => {
      let prodBranch = p.branchId;
      if (!prodBranch) {
        const cleanName = (p.name || '').trim();
        const cleanBarcode = (p.barcode || '').trim();
        if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
          prodBranch = 'branch-sharshi';
        } else {
          prodBranch = 'branch-main';
        }
      }
      const bq = p.branchQuantities || {};
      const cleanedBq: Record<string, number> = {};

      if (prodBranch === 'all' || prodBranch === 'multi') {
        // صنف مشترك: نحتفظ بالكميات المسجلة الموجبة فقط
        Object.entries(bq).forEach(([bId, qty]) => {
          if (typeof qty === 'number' && qty > 0) {
            cleanedBq[bId] = qty;
          }
        });
        if (Object.keys(cleanedBq).length === 0) {
          cleanedBq['branch-main'] = Math.max(0, p.quantity || 0);
        }
      } else {
        // صنف مخصص لفرع محدد:
        // نضع رصيده في فرعه فقط، ولا نحتفظ برصيد 0 في الفروع الأخرى التي لا يتبع لها!
        const ownQty = typeof bq[prodBranch] === 'number' ? bq[prodBranch] : (p.quantity || 0);
        cleanedBq[prodBranch] = Math.max(0, ownQty);

        // نحتفظ فقط بالفروع الأخرى التي تحتوي على رصيد موجب فعلي تم تحويله سابقاً
        Object.entries(bq).forEach(([bId, qty]) => {
          if (bId !== prodBranch && typeof qty === 'number' && qty > 0) {
            cleanedBq[bId] = qty;
          }
        });
      }

      const totalQty = Object.values(cleanedBq).reduce((s, q) => s + q, 0);
      const isBqDifferent = JSON.stringify(cleanedBq) !== JSON.stringify(p.branchQuantities);
      const isBranchDiff = p.branchId !== prodBranch;

      if (isBqDifferent || isBranchDiff || p.quantity !== totalQty) {
        changed = true;
        const branchObj = this.inMemoryBranches.find((b) => b.id === prodBranch);
        return {
          ...p,
          branchId: prodBranch,
          branchName: branchObj ? branchObj.name : (prodBranch === 'branch-main' ? 'الفرع الرئيسي' : prodBranch),
          assignedBranchIds: [prodBranch],
          branchQuantities: cleanedBq,
          quantity: totalQty,
        };
      }
      return p;
    });

    if (changed) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    }
  }

  // ==== إدارة المنتجات Products ====
  wipeLocalCacheForRepull(): { cleared: string[] } {
    const cleared: string[] = [];

    this.inMemoryProducts = [];
    localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
    cleared.push('المنتجات');

    this.inMemoryCustomers = [];
    localStorage.removeItem(STORAGE_KEYS.CUSTOMERS);
    cleared.push('العملاء');

    this.inMemorySuppliers = [];
    localStorage.removeItem(STORAGE_KEYS.SUPPLIERS);
    cleared.push('الموردين');

    this.inMemoryStockAuditLogs = [];
    localStorage.removeItem(STORAGE_KEYS.STOCK_AUDIT);
    cleared.push('حركات المخزون');

    this.inMemoryTransfers = [];
    localStorage.removeItem(STORAGE_KEYS.TRANSFERS);
    cleared.push('سندات التحويل');

    this.notify();
    return { cleared };
  }

  // ==== إدارة السلات المعلقة (Parked Carts) ====
  getParkedCarts(): ParkedCart[] {
    return this.inMemoryParkedCarts;
  }

  parkCart(cart: Omit<ParkedCart, 'id' | 'heldAt'>): ParkedCart {
    const newParked: ParkedCart = {
      ...cart,
      id: 'park-' + Date.now() + '-' + Math.random().toString(36).substring(2, 5),
      heldAt: new Date().toISOString(),
    };
    this.inMemoryParkedCarts.unshift(newParked);
    this.persist(STORAGE_KEYS.PARKED_CARTS, this.inMemoryParkedCarts);
    this.notify();
    return newParked;
  }

  deleteParkedCart(id: string) {
    this.inMemoryParkedCarts = this.inMemoryParkedCarts.filter((c) => c.id !== id);
    this.persist(STORAGE_KEYS.PARKED_CARTS, this.inMemoryParkedCarts);
    this.notify();
  }

  // ==== إدارة الإعدادات Settings ====
  getBranches(): Branch[] {
    return this.inMemoryBranches;
  }

  getActiveBranchId(): string {
    if (this.currentAuthUser && this.currentAuthUser.role !== 'admin') {
      return this.currentAuthUser.branchId || 'branch-main';
    }
    return this.inMemorySettings.activeBranchId || 'all';
  }

  getActiveBranch(): Branch {
    const activeId = this.getActiveBranchId();
    if (activeId === 'all') {
      return {
        id: 'all',
        name: 'جميع الفروع مجمعة',
        code: 'ALL',
        isMain: false,
        createdAt: new Date().toISOString(),
      };
    }
    return this.inMemoryBranches.find((b) => b.id === activeId) || this.inMemoryBranches[0] || {
      id: 'branch-main',
      name: 'الفرع الرئيسي',
      code: 'BR-01',
      isMain: true,
      createdAt: new Date().toISOString(),
    };
  }

  protected isWithinDateRange(isoDate: string, range?: { dateFrom?: string; dateTo?: string }): boolean {
    if (!range || (!range.dateFrom && !range.dateTo)) return true;
    const t = new Date(isoDate).getTime();
    if (Number.isNaN(t)) return true;
    if (range.dateFrom) {
      const from = new Date(range.dateFrom + 'T00:00:00').getTime();
      if (!Number.isNaN(from) && t < from) return false;
    }
    if (range.dateTo) {
      const to = new Date(range.dateTo + 'T23:59:59.999').getTime();
      if (!Number.isNaN(to) && t > to) return false;
    }
    return true;
  }

  resetToDefaultData() {
    this.inMemoryProducts = [...SEED_PRODUCTS];
    this.inMemorySales = [];
    this.inMemoryReturns = [];
    this.inMemoryParkedCarts = [];
    this.inMemoryCustomers = [];
    this.inMemoryDebtTransactions = [];
    this.inMemorySettings = { ...DEFAULT_SETTINGS };
    this.inMemorySettings.users = this.inMemoryUsers;
    this.offlineQueue = [];
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.persist(STORAGE_KEYS.SALES, this.inMemorySales);
    this.persist(STORAGE_KEYS.RETURNS, this.inMemoryReturns);
    this.persist(STORAGE_KEYS.PARKED_CARTS, this.inMemoryParkedCarts);
    this.persist(STORAGE_KEYS.CUSTOMERS, this.inMemoryCustomers);
    this.persist(STORAGE_KEYS.DEBT_TRANSACTIONS, this.inMemoryDebtTransactions);
    this.persist(STORAGE_KEYS.SETTINGS, this.inMemorySettings);
    this.persist(STORAGE_KEYS.OFFLINE_MUTATIONS, this.offlineQueue);
    // DEFAULT_SETTINGS يحتوي PIN وكلمات مرور بنص صريح — أعد الترحيل فوراً
    // حتى تُخزن نسخ الهاش مكانها (ولا يُزامَن إلا الهاش).
    void this.runMigrations();
    this.notify();
    this.triggerCloudSync(async (supabase) => {
      // لا تُزامن القيم الحساسة قبل اكتمال الهاش: أرسل الإعدادات الحالية (المُهاشَرة)
      await this.runMigrations();
      for (const p of SEED_PRODUCTS) {
        await supabase.syncProduct(p);
      }
      await supabase.syncSettings(this.inMemorySettings);
    });
  }
}

export { DbCore };
