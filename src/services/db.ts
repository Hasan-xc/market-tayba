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
import { hashPin, hashPassword, isHashedValue, verifySecret } from '../utils/crypto';

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

type DBListener = () => void;

const STORAGE_KEYS = {
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
    | 'DEBT_TX_CREATE' 
    | 'SETTINGS_SAVE'
    | 'STOCK_AUDIT_CREATE';
  data: any;
  timestamp: string;
}

class CloudBackedDatabase {
  private inMemoryProducts: Product[] = [];
  private inMemorySales: SaleTransaction[] = [];
  private inMemoryReturns: ReturnRecord[] = [];
  private inMemoryParkedCarts: ParkedCart[] = [];
  private inMemoryCustomers: Customer[] = [];
  private inMemoryDebtTransactions: DebtTransaction[] = [];
  private inMemorySuppliers: Supplier[] = [];
  private inMemoryStockAuditLogs: StockAuditLog[] = [];
  private inMemoryShifts: CashDrawerShift[] = [];
  private inMemoryBranches: Branch[] = [...DEFAULT_BRANCHES];
  private inMemoryUsers: UserAccount[] = [...DEFAULT_USERS];
  private inMemoryTransfers: StockTransfer[] = [];
  private currentAuthUser: UserAccount | null = null;
  private inMemorySettings: StoreSettings = { ...DEFAULT_SETTINGS };
  private offlineQueue: OfflineMutation[] = [];
  private listeners: Set<DBListener> = new Set();

  private readyPromise: Promise<void>;

  constructor() {
    this.loadFromLocalStorage();
    this.normalizeBranchInventories();
    // ترحيلات القيم الحساسة (PIN/كلمات المرور) — يجب اكتمالها قبل عرض واجهة الدخول.
    // main.tsx ينتظر dbReady قبل تركيب التطبيق، فلا يقرأ PinModal/LoginModal
    // أبداً قيمة غير مهاجرة.
    this.readyPromise = this.runMigrations();
  }

  // ==== ترحيلات القيم الحساسة عند التحميل ====
  private async runMigrations(): Promise<void> {
    await this.migrateSecurityPinHash();
    await this.migrateUserPasswordHashes();
    await this.migrateForcePasswordChangeForDefaultPassword();
  }

  /** وعد جهوزية القاعدة: يكتمل بعد انتهاء جميع ترحيلات التحميل */
  get ready(): Promise<void> {
    return this.readyPromise;
  }

  // ==== تحميل وحفظ في التخزين المحلي الآمن ====
  private loadFromLocalStorage() {
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

  private persist(key: string, data: any) {
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
  private async migrateSecurityPinHash(): Promise<void> {
    try {
      const current = this.inMemorySettings.securityPin;
      if (current && !isHashedValue(current)) {
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
  private async migrateUserPasswordHashes(): Promise<void> {
    try {
      let changed = false;
      const migrated = await Promise.all(
        this.inMemoryUsers.map(async (u) => {
          if (u.password && !isHashedValue(u.password)) {
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
  private async migrateForcePasswordChangeForDefaultPassword(): Promise<void> {
    try {
      const defaultHash = await hashPassword('12345');
      let changed = false;
      this.inMemoryUsers = this.inMemoryUsers.map((u) => {
        if ((u.password === '12345' || u.password === defaultHash) && !u.mustChangePassword) {
          changed = true;
          return { ...u, mustChangePassword: true };
        }
        return u;
      });
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
  private persistUsersAfterHash(userWithPlainPass: UserAccount): void {
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
  private async triggerCloudSync(
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

  private enqueueOfflineMutation(type: OfflineMutation['type'], data: any) {
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
  isProductInBranch(product: Product, branchId?: string): boolean {
    if (!product) return false;
    const targetBranch = branchId || this.getActiveBranchId();
    if (!targetBranch || targetBranch === 'all') return true;

    // 1. إذا كان الصنف مسجلاً لهذا الفرع تحديداً
    let prodBranch = product.branchId;
    if (!prodBranch) {
      const cleanName = (product.name || '').trim();
      const cleanBarcode = (product.barcode || '').trim();
      if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
        prodBranch = 'branch-sharshi';
      } else {
        prodBranch = 'branch-main';
      }
    }
    if (prodBranch === targetBranch) {
      return true;
    }

    // 2. إذا كان الصنف مشتركاً بين الفروع
    if (product.branchId === 'all' || product.branchId === 'multi') {
      return true;
    }

    // 3. إذا كان الصنف لديه كمية موجبة فعلية أكبر من الصفر تم تحويلها أو إدخالها لهذا الفرع
    const bq = product.branchQuantities;
    if (bq && typeof bq === 'object' && typeof bq[targetBranch] === 'number' && bq[targetBranch] > 0) {
      return true;
    }

    // لا ينتمي لهذا الفرع إطلاقاً، وبالتالي لا يظهر فيه برصيد 0 ولا يسبب تنبيهاً كاذباً بنفاد المخزون
    return false;
  }

  // تنظيف وإصلاح استقلالية أرصدة الفروع (Branch Inventory Isolation Normalizer)
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
  getProducts(branchId?: string, user?: UserAccount | null): Product[] {
    const activeUser = user || this.currentAuthUser;
    // الكاشير مقيد فقط بمخزون فرعه المخصص دون سواه
    if (activeUser && activeUser.role !== 'admin') {
      const cashierBranch = activeUser.branchId || 'branch-main';
      return this.inMemoryProducts.filter((p) => this.isProductInBranch(p, cashierBranch));
    }

    const targetBranch = branchId !== undefined ? branchId : this.getActiveBranchId();
    if (targetBranch && targetBranch !== 'all') {
      return this.inMemoryProducts.filter((p) => this.isProductInBranch(p, targetBranch));
    }

    return this.inMemoryProducts;
  }

  // الحصول على كافة المنتجات الخام دون فلترة (للاستخدامات الداخلية والحفظ)
  getAllRawProducts(): Product[] {
    return this.inMemoryProducts;
  }

  getProductById(productId: string, branchId?: string, user?: UserAccount | null): Product | undefined {
    const activeUser = user || this.currentAuthUser;
    const targetBranch = activeUser && activeUser.role !== 'admin'
      ? (activeUser.branchId || 'branch-main')
      : branchId;

    const prod = this.inMemoryProducts.find((p) => p.id === productId);
    if (!prod) return undefined;
    if (targetBranch && targetBranch !== 'all' && !this.isProductInBranch(prod, targetBranch)) {
      return undefined;
    }
    return prod;
  }

  getProductByBarcode(barcode: string, branchId?: string, user?: UserAccount | null): Product | undefined {
    const clean = barcode.trim();
    const activeUser = user || this.currentAuthUser;
    const targetBranch = activeUser && activeUser.role !== 'admin'
      ? (activeUser.branchId || 'branch-main')
      : branchId;

    const prod = this.inMemoryProducts.find((p) => p.barcode === clean);
    if (!prod) return undefined;
    if (targetBranch && targetBranch !== 'all' && !this.isProductInBranch(prod, targetBranch)) {
      return undefined;
    }
    return prod;
  }

  setProducts(products: Product[]) {
    const seen = new Set<string>();
    const uniqueProducts: Product[] = [];
    // (Fix 1) الأصناف التي نسختها المحلية أحدث من نسخة السحابة — تُدفع للسحابة لاحقاً
    const fresherLocal: Product[] = [];
    for (const p of products) {
      if (!p) continue;
      const cleanBarcode = (p.barcode || '').trim();
      const cleanName = (p.name || '').trim();
      const key = cleanBarcode || (p.id || '').trim();
      if (key && !seen.has(key)) {
        seen.add(key);

        // الحفاظ على بيانات الفرع المسجلة محلياً في حال لم تكن واردة من السحابة
        const existing = this.inMemoryProducts.find(
          (ep) => (ep.id && ep.id === p.id) || (ep.barcode && ep.barcode.trim() === cleanBarcode)
        );

        // (Fix 1) حماية الطمس الرجعي: إذا كانت النسخة المحلية أحدث زمنياً فهي تفوز
        // — لا تُستبدل كمية مخزّن خُصمت ببيعٍ حقيقي بلقطة سحابية قديمة
        if (existing) {
          const localT = Date.parse(existing.updatedAt || '') || 0;
          const cloudT = Date.parse(p.updatedAt || '') || 0;
          if (localT && cloudT && localT > cloudT) {
            uniqueProducts.push(existing);
            fresherLocal.push(existing);
            continue;
          }
        }

        let resolvedBranchId = p.branchId || existing?.branchId;
        if (!resolvedBranchId) {
          if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
            resolvedBranchId = 'branch-sharshi';
          } else {
            resolvedBranchId = 'branch-main';
          }
        }

        const branchObj = this.inMemoryBranches.find((b) => b.id === resolvedBranchId);
        const resolvedBranchName = 
          p.branchName || 
          existing?.branchName || 
          branchObj?.name || 
          (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

        const totalQty = p.quantity !== undefined ? p.quantity : (existing?.quantity || 0);
        let resolvedBq: Record<string, number> = {};

        if (p.branchQuantities && typeof p.branchQuantities === 'object' && Object.keys(p.branchQuantities).length > 0) {
          resolvedBq = { ...p.branchQuantities };
        } else if (existing?.branchQuantities && Object.keys(existing.branchQuantities).length > 0) {
          resolvedBq = { ...existing.branchQuantities };
        } else {
          resolvedBq = { [resolvedBranchId]: totalQty };
        }

        // (Fix) مصدر حقيقة واحد: موازنة الأرصدة مع كمية الصف عند التعارض (ترميز عتيق)
        {
          const bqSum = Object.values(resolvedBq).reduce((s, q) => s + (Number(q) || 0), 0);
          if (Math.abs(bqSum - totalQty) > 0.001) {
            const rebalanced: Record<string, number> = {};
            let othersSum = 0;
            for (const [bId, q] of Object.entries(resolvedBq)) {
              if (bId !== resolvedBranchId && Number(q) > 0) { rebalanced[bId] = Number(q); othersSum += Number(q); }
            }
            rebalanced[resolvedBranchId] = Math.max(0, totalQty - othersSum);
            resolvedBq = rebalanced;
          }
        }

        uniqueProducts.push({
          ...p,
          barcode: cleanBarcode,
          name: cleanName,
          quantity: totalQty,
          branchId: resolvedBranchId,
          branchName: resolvedBranchName,
          branchQuantities: resolvedBq,
          assignedBranchIds: [resolvedBranchId],
        });
      }
    }
    // (Fix 1) الأصناف المحلية الغائبة عن لقطة السحابة (لم تُزامن بعد) تبقى حية —
    // setProducts دمج بالمعرف وليس استبدالاً عمياءً للقائمة
    for (const lp of this.inMemoryProducts) {
      const lkey = (lp.barcode || '').trim() || (lp.id || '').trim();
      if (lkey && !seen.has(lkey)) {
        uniqueProducts.push(lp);
        fresherLocal.push(lp);
      }
    }

    this.inMemoryProducts = uniqueProducts;
    this.normalizeBranchInventories();
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();

    // (Fix 1) ادفع النسخ المحلية الأحدث للسحابة حتى لا تبقى قديمة هناك
    if (fresherLocal.length) {
      const targets = [...fresherLocal];
      this.triggerCloudSync(async (supabase) => {
        for (const p of targets) {
          await supabase.syncProduct(p);
        }
      });
    }
  }

  applyCloudUpsertProduct(product: Product) {
    if (!product || !product.name?.trim() || !product.barcode?.trim()) return;
    const cleanBarcode = product.barcode.trim();
    const cleanName = product.name.trim();
    const idx = this.inMemoryProducts.findIndex((p) => p.id === product.id || p.barcode === cleanBarcode);

    if (idx !== -1) {
      const existing = this.inMemoryProducts[idx];

      // (Fix 1) صدى سحابي بلقطة أقدم من سجلاتنا المحلية؟ نرفض الطمس وندفع نسختنا
      const localT = Date.parse(existing.updatedAt || '') || 0;
      const cloudT = Date.parse(product.updatedAt || '') || 0;
      if (localT && cloudT && localT > cloudT) {
        const localFresher = existing;
        this.triggerCloudSync(async (supabase) => {
          await supabase.syncProduct(localFresher);
        });
        return;
      }

      let mergedBranchId = product.branchId || existing.branchId;
      if (!mergedBranchId) {
        mergedBranchId = (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') ? 'branch-sharshi' : 'branch-main';
      }
      const branchObj = this.inMemoryBranches.find((b) => b.id === mergedBranchId);
      const mergedBranchName = 
        product.branchName || 
        existing.branchName || 
        branchObj?.name || 
        (mergedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

      const totalQty = product.quantity !== undefined ? product.quantity : existing.quantity;
      let mergedBranchQuantities = 
        (product.branchQuantities && Object.keys(product.branchQuantities).length > 0) 
          ? product.branchQuantities 
          : (existing.branchQuantities || { [mergedBranchId]: totalQty });

      // (Fix) مصدر حقيقة واحد: إن اختلفت الأرصدة المدمجة (بما فيها الترميز العتيق
      // داخل image_url) عن كمية الصف السحابية — الكمية هي المرجع، ويُعاد موازنة
      // الفرع الأساسي مع صون أرصدة الفروع الأخرى الموجبة
      const bqSum = Object.values(mergedBranchQuantities).reduce((s, q) => s + (Number(q) || 0), 0);
      if (Math.abs(bqSum - totalQty) > 0.001) {
        const rebalanced: Record<string, number> = {};
        let othersSum = 0;
        for (const [bId, q] of Object.entries(mergedBranchQuantities)) {
          if (bId !== mergedBranchId && Number(q) > 0) { rebalanced[bId] = Number(q); othersSum += Number(q); }
        }
        rebalanced[mergedBranchId] = Math.max(0, totalQty - othersSum);
        mergedBranchQuantities = rebalanced;
      }

      this.inMemoryProducts[idx] = {
        ...existing,
        ...product,
        barcode: cleanBarcode,
        name: cleanName,
        quantity: totalQty,
        branchId: mergedBranchId,
        branchName: mergedBranchName,
        branchQuantities: mergedBranchQuantities,
        assignedBranchIds: [mergedBranchId],
      };
    } else {
      let resolvedBranchId = product.branchId;
      if (!resolvedBranchId) {
        resolvedBranchId = (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') ? 'branch-sharshi' : 'branch-main';
      }
      const branchObj = this.inMemoryBranches.find((b) => b.id === resolvedBranchId);
      const resolvedBranchName = 
        product.branchName || 
        branchObj?.name || 
        (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

      const totalQty = product.quantity || 0;
      const resolvedBq = 
        (product.branchQuantities && Object.keys(product.branchQuantities).length > 0)
          ? product.branchQuantities
          : { [resolvedBranchId]: totalQty };

      this.inMemoryProducts.unshift({
        ...product,
        barcode: cleanBarcode,
        name: cleanName,
        quantity: totalQty,
        branchId: resolvedBranchId,
        branchName: resolvedBranchName,
        branchQuantities: resolvedBq,
        assignedBranchIds: [resolvedBranchId],
      });
    }
    this.normalizeBranchInventories();
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();
  }

  applyCloudDeleteProduct(productId: string, barcode?: string) {
    const prevLen = this.inMemoryProducts.length;
    this.inMemoryProducts = this.inMemoryProducts.filter((p) => {
      if (productId && p.id === productId) return false;
      if (barcode && p.barcode === barcode.trim()) return false;
      return true;
    });
    if (this.inMemoryProducts.length !== prevLen) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
      this.notify();
    }
  }

  saveProduct(product: Partial<Product> & { barcode: string; name: string }): Product {
    const now = new Date().toISOString();
    const cleanBarcode = (product.barcode || '').trim();
    const cleanName = (product.name || '').trim();

    if (!cleanBarcode || !cleanName) {
      throw new Error('الباركود واسم الصنف مطلوبان');
    }

    // البحث عن الصنف لتحديد ما إذا كان جديداً أو موجوداً سابقاً لتسجيل تدقيق المخزون بدقة
    const existingIndex = product.id 
      ? this.inMemoryProducts.findIndex((p) => p.id === product.id)
      : this.inMemoryProducts.findIndex((p) => p.barcode === cleanBarcode);

    const isNew = existingIndex === -1;
    const previousProd = !isNew ? this.inMemoryProducts[existingIndex] : null;
    const previousQty = previousProd ? previousProd.quantity : 0;
    const previousPurchase = previousProd ? previousProd.purchasePrice : 0;
    const previousSale = previousProd ? previousProd.salePrice : 0;

    // إدارة رصيد الفروع المستقل (Multi-Branch Isolated Stock)
    const activeBranchId = this.getActiveBranchId();
    const existingBranchId = existingIndex !== -1 ? this.inMemoryProducts[existingIndex].branchId : undefined;
    const finalBranchId = product.branchId || existingBranchId || (activeBranchId !== 'all' ? activeBranchId : 'branch-main');
    const branchObj = this.inMemoryBranches.find((b) => b.id === finalBranchId);
    const branchName = branchObj ? branchObj.name : (finalBranchId === 'all' ? 'جميع الفروع' : (finalBranchId === 'branch-main' ? 'الفرع الرئيسي' : finalBranchId));

    let bq: Record<string, number> = {};

    if (product.branchQuantities && typeof product.branchQuantities === 'object' && Object.keys(product.branchQuantities).length > 0) {
      bq = { ...product.branchQuantities };
    } else if (existingIndex !== -1) {
      bq = this.ensureBranchQuantities(this.inMemoryProducts[existingIndex]);
      if (product.quantity !== undefined) {
        const targetBranchKey = finalBranchId === 'all' ? (this.inMemoryProducts[existingIndex].branchId || 'branch-main') : finalBranchId;
        bq[targetBranchKey] = Math.max(0, Number(product.quantity) || 0);
      }
    } else {
      const targetBranchKey = finalBranchId === 'all' ? 'branch-main' : finalBranchId;
      bq = {
        [targetBranchKey]: Math.max(0, Number(product.quantity) || 0),
      };
    }

    // تنظيف أرصدة الفروع حتى لا يظهر رصيد 0 لفروع أخرى لا ينتمي إليها الصنف إطلاقاً
    if (finalBranchId !== 'all' && finalBranchId !== 'multi') {
      const cleanBq: Record<string, number> = {
        [finalBranchId]: Math.max(0, Number(bq[finalBranchId] ?? product.quantity ?? 0)),
      };
      // نحتفظ فقط بالفروع الأخرى إذا كان لها رصيد فعلي موجب سابقاً (كتحويل مخزني مثلاً)
      Object.entries(bq).forEach(([bKey, val]) => {
        if (bKey !== finalBranchId && typeof val === 'number' && val > 0) {
          cleanBq[bKey] = val;
        }
      });
      bq = cleanBq;
    }

    const calculatedTotalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    const finalAssignedBranchIds = finalBranchId === 'all' 
      ? (product.assignedBranchIds || this.inMemoryBranches.map((b) => b.id))
      : [finalBranchId];

    let savedProduct: Product;
    if (product.id) {
      if (existingIndex !== -1) {
        savedProduct = {
          ...this.inMemoryProducts[existingIndex],
          ...product,
          barcode: cleanBarcode,
          name: cleanName,
          category: (product.category || this.inMemoryProducts[existingIndex].category || 'عام').trim(),
          purchasePrice: Number(product.purchasePrice ?? this.inMemoryProducts[existingIndex].purchasePrice) || 0,
          salePrice: Number(product.salePrice ?? this.inMemoryProducts[existingIndex].salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert ?? this.inMemoryProducts[existingIndex].minQuantityAlert) || 5,
          unit: product.unit || this.inMemoryProducts[existingIndex].unit || 'حبة',
          updatedAt: now,
        };
        this.inMemoryProducts[existingIndex] = savedProduct;
      } else {
        savedProduct = {
          id: product.id,
          barcode: cleanBarcode,
          name: cleanName,
          category: product.category?.trim() || 'عام',
          purchasePrice: Number(product.purchasePrice) || 0,
          salePrice: Number(product.salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert) || 5,
          unit: product.unit || 'حبة',
          imageUrl: product.imageUrl,
          createdAt: now,
          updatedAt: now,
        };
        this.inMemoryProducts.unshift(savedProduct);
      }
    } else {
      if (existingIndex !== -1) {
        savedProduct = {
          ...this.inMemoryProducts[existingIndex],
          ...product,
          barcode: cleanBarcode,
          name: cleanName,
          category: (product.category || this.inMemoryProducts[existingIndex].category || 'عام').trim(),
          purchasePrice: Number(product.purchasePrice ?? this.inMemoryProducts[existingIndex].purchasePrice) || 0,
          salePrice: Number(product.salePrice ?? this.inMemoryProducts[existingIndex].salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert ?? this.inMemoryProducts[existingIndex].minQuantityAlert) || 5,
          unit: product.unit || this.inMemoryProducts[existingIndex].unit || 'حبة',
          updatedAt: now,
        };
        this.inMemoryProducts[existingIndex] = savedProduct;
      } else {
        savedProduct = {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          barcode: cleanBarcode,
          name: cleanName,
          category: product.category?.trim() || 'عام',
          purchasePrice: Number(product.purchasePrice) || 0,
          salePrice: Number(product.salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert) || 5,
          unit: product.unit || 'حبة',
          imageUrl: product.imageUrl,
          createdAt: now,
          updatedAt: now,
        };
        this.inMemoryProducts.unshift(savedProduct);
      }
    }

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    // تسجيل حركة المخزون في سجل التدقيق (Stock Audit Trail)
    const newQty = savedProduct.quantity;
    const qtyDelta = newQty - previousQty;
    const currentActor = this.inMemorySettings.activeCashier || 'المشرف';

    if (isNew) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: 'product_created',
        quantityDelta: newQty,
        previousQuantity: 0,
        newQuantity: newQty,
        reason: `إضافة منتج جديد إلى المخزون (سعر البيع: ${savedProduct.salePrice} ${this.inMemorySettings.currency})`,
        performedBy: currentActor,
      });
    } else if (qtyDelta !== 0) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: qtyDelta > 0 ? 'purchase' : 'manual_adjustment',
        quantityDelta: qtyDelta,
        previousQuantity: previousQty,
        newQuantity: newQty,
        reason: qtyDelta > 0 
          ? `زيادة كمية المخزون من ${previousQty} إلى ${newQty} (توريد / تعديل)`
          : `إنقاص كمية المخزون من ${previousQty} إلى ${newQty} (تعديل جردي)`,
        performedBy: currentActor,
      });
    } else if (previousSale !== savedProduct.salePrice || previousPurchase !== savedProduct.purchasePrice) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: 'price_update',
        quantityDelta: 0,
        previousQuantity: previousQty,
        newQuantity: newQty,
        reason: `تحديث أسعار الصنف (شراء: ${savedProduct.purchasePrice}، بيع: ${savedProduct.salePrice})`,
        performedBy: currentActor,
      });
    }

    this.notify();

    // مزامنة فورية في الخلفية مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(savedProduct);
        await supabase.broadcastEvent('PRODUCT_UPSERT', savedProduct);
      },
      { type: 'PRODUCT_UPSERT', data: savedProduct }
    );

    return savedProduct;
  }

  deleteProduct(id: string, barcode?: string): boolean {
    const cleanBarcode = barcode?.trim();
    const targetProduct = this.inMemoryProducts.find((p) => (id && p.id === id) || (cleanBarcode && p.barcode === cleanBarcode));
    const targetId = id || targetProduct?.id || '';
    const targetBarcode = cleanBarcode || targetProduct?.barcode || '';

    // تسجيل حركة الحذف في سجل تدقيق المخزون قبل الحذف
    if (targetProduct) {
      this.addStockAuditLog({
        productId: targetProduct.id,
        barcode: targetProduct.barcode,
        productName: targetProduct.name,
        type: 'product_deleted',
        quantityDelta: -targetProduct.quantity,
        previousQuantity: targetProduct.quantity,
        newQuantity: 0,
        reason: `حذف الصنف نهائياً من قاعدة بيانات المخزون`,
        performedBy: this.inMemorySettings.activeCashier || 'المشرف',
      });
    }

    const prevLen = this.inMemoryProducts.length;
    this.inMemoryProducts = this.inMemoryProducts.filter((p) => {
      if (targetId && p.id === targetId) return false;
      if (targetBarcode && p.barcode === targetBarcode) return false;
      return true;
    });
    const changed = this.inMemoryProducts.length !== prevLen;

    if (changed || targetId || targetBarcode) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
      this.notify();
      this.triggerCloudSync(
        async (supabase) => {
          await supabase.deleteProduct(targetId, targetBarcode);
          await supabase.broadcastEvent('PRODUCT_DELETE', { id: targetId, barcode: targetBarcode });
        },
        { type: 'PRODUCT_DELETE', data: { id: targetId, barcode: targetBarcode } }
      );
    }
    return changed;
  }

  ensureBranchQuantities(product: Product): Record<string, number> {
    if (product.branchQuantities && typeof product.branchQuantities === 'object' && Object.keys(product.branchQuantities).length > 0) {
      return { ...product.branchQuantities };
    }
    const defaultBranchId = product.branchId || 'branch-main';
    return {
      [defaultBranchId]: Math.max(0, Number(product.quantity) || 0),
    };
  }

  getProductStock(product: Product, branchId?: string): number {
    if (!product) return 0;
    const targetBranch = branchId || this.getActiveBranchId();
    const bq = this.ensureBranchQuantities(product);

    if (targetBranch === 'all') {
      return Object.values(bq).reduce((sum, q) => sum + (Number(q) || 0), 0);
    }

    return Number(bq[targetBranch] ?? 0);
  }

  setProductBranchStock(
    productId: string,
    branchId: string,
    newQuantity: number,
    reason?: string,
    performedBy?: string
  ): Product | null {
    const index = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (index === -1) return null;

    const prod = this.inMemoryProducts[index];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = bq[branchId] ?? 0;
    const cleanQty = Math.max(0, Number(newQuantity) || 0);
    const delta = cleanQty - prevBranchQty;

    bq[branchId] = cleanQty;
    prod.branchQuantities = bq;
    const totalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.quantity = totalQty;
    prod.updatedAt = new Date().toISOString();

    const branch = this.inMemoryBranches.find((b) => b.id === branchId);
    const branchName = branch ? branch.name : (branchId === 'branch-main' ? 'الفرع الرئيسي' : branchId);

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    if (delta !== 0) {
      this.addStockAuditLog({
        productId: prod.id,
        barcode: prod.barcode,
        productName: prod.name,
        type: delta > 0 ? 'purchase' : 'manual_adjustment',
        quantityDelta: delta,
        previousQuantity: prevBranchQty,
        newQuantity: cleanQty,
        reason: reason || `تعديل جرد فرع (${branchName}): من ${prevBranchQty} إلى ${cleanQty}`,
        performedBy: performedBy || this.inMemorySettings.activeCashier,
      });
    }

    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    return prod;
  }

  updateBranchStock(
    productId: string,
    branchId: string,
    quantityChange: number,
    reason?: string,
    performedBy?: string,
    logType?: StockAuditLog['type']
  ): Product | null {
    const index = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (index === -1) return null;

    const prod = this.inMemoryProducts[index];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = bq[branchId] ?? 0;
    const newBranchQty = Math.max(0, prevBranchQty + quantityChange);

    return this.setProductBranchStock(
      productId,
      branchId,
      newBranchQty,
      reason || (quantityChange > 0 ? 'توريد بضاعة للفرع' : 'تسوية عجز/تعديل فرع'),
      performedBy
    );
  }

  updateStock(
    productId: string, 
    quantityChange: number, 
    reason?: string, 
    performedBy?: string, 
    logType?: StockAuditLog['type'],
    branchId?: string
  ): Product | null {
    const targetBranch = branchId || (this.getActiveBranchId() === 'all' ? 'branch-main' : this.getActiveBranchId());
    return this.updateBranchStock(
      productId,
      targetBranch,
      quantityChange,
      reason,
      performedBy,
      logType
    );
  }

  // ==== إتلاف المخزون / الإرجاع للمصنع (Damage & Vendor Return) ====
  recordDamageOrVendorReturn(params: {
    productId: string;
    type: 'damage' | 'vendor_return';
    quantity: number;
    branchId?: string;
    damageReason?: string; // تالف / كسر / منتهي الصلاحية
    notes?: string;
    supplierId?: string;
    performedBy?: string;
  }): { success: boolean; message: string; log?: StockAuditLog } {
    const { productId, type, damageReason, notes, supplierId } = params;

    const prodIndex = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (prodIndex === -1) {
      return { success: false, message: 'الصنف غير موجود في النظام' };
    }

    const qty = Number(params.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, message: 'يرجى إدخال كمية صالحة أكبر من الصفر' };
    }

    const targetBranchId = params.branchId || this.getActiveBranchId();
    if (!targetBranchId || targetBranchId === 'all') {
      return { success: false, message: 'يرجى تحديد الفرع الذي سيُخصم منه الرصيد' };
    }

    const prod = this.inMemoryProducts[prodIndex];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = Number(bq[targetBranchId] ?? 0);
    if (qty > prevBranchQty) {
      return {
        success: false,
        message: `الكمية المطلوبة (${qty}) تتجاوز رصيد الفرع الحالي (${prevBranchQty})`,
      };
    }

    const newBranchQty = Math.max(0, prevBranchQty - qty);
    bq[targetBranchId] = newBranchQty;
    prod.branchQuantities = bq;
    prod.quantity = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.updatedAt = new Date().toISOString();

    const branch = this.inMemoryBranches.find((b) => b.id === targetBranchId);
    const branchName = branch ? branch.name : targetBranchId;
    const actor = params.performedBy || this.inMemorySettings.activeCashier || 'مدير النظام';

    let reason: string;
    if (type === 'vendor_return') {
      const supplier = supplierId ? this.getSupplierById(supplierId) : undefined;
      reason = `إرجاع للمصنع/المورد: ${supplier ? supplier.name : 'غير محدد'} — من فرع ${branchName}`;
    } else {
      reason = `إتلاف/تالف (${damageReason || 'تالف'}) — من فرع ${branchName}`;
    }
    if (notes && notes.trim()) {
      reason += ` — ${notes.trim()}`;
    }

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    const log = this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type,
      quantityDelta: -qty,
      previousQuantity: prevBranchQty,
      newQuantity: newBranchQty,
      reason,
      performedBy: actor,
    });

    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    // إرجاع للمورد: المستحق للمتجر لدى المورد = الكمية المرجعة × سعر شراء الصنف.
    // saveSupplier تستبدل الكائن كاملاً وليست تراكمية، لذلك نقرأ الرصيد الحالي ونضيف الفرق قبل الحفظ.
    if (type === 'vendor_return' && supplierId) {
      const supplier = this.getSupplierById(supplierId);
      if (supplier) {
        const creditAmount = qty * (Number(prod.purchasePrice) || 0);
        this.saveSupplier({
          ...supplier,
          balance: (Number(supplier.balance) || 0) + creditAmount,
        });
      }
    }

    return {
      success: true,
      message:
        type === 'vendor_return'
          ? 'تم إرجاع الكمية للمورد وتحديث المستحقات بنجاح'
          : 'تم تسجيل عملية الإتلاف وخصم الرصيد بنجاح',
      log,
    };
  }

  // ==== التحويلات المخزنية بين الفروع (Inter-Branch Stock Transfers) ====
  getStockTransfers(): StockTransfer[] {
    return this.inMemoryTransfers;
  }

  transferStock(params: {
    sourceBranchId: string;
    targetBranchId: string;
    productId: string;
    quantity: number;
    notes?: string;
    performedBy?: string;
  }): { success: boolean; transfer?: StockTransfer; error?: string } {
    const { sourceBranchId, targetBranchId, productId, quantity, notes, performedBy } = params;

    if (!sourceBranchId || !targetBranchId) {
      return { success: false, error: 'يرجى تحديد فرع المصدر وفرع الوجهة' };
    }
    if (sourceBranchId === targetBranchId) {
      return { success: false, error: 'لا يمكن التحويل لنفس الفرع، يرجى اختيار فرعين مختلفين' };
    }
    const cleanQty = Number(quantity);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      return { success: false, error: 'يرجى إدخال كمية تحويل صالحة أكبر من الصفر' };
    }

    const prodIndex = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (prodIndex === -1) {
      return { success: false, error: 'الصنف المطلوب تحويله غير موجود في النظام' };
    }

    const prod = this.inMemoryProducts[prodIndex];
    const bq = this.ensureBranchQuantities(prod);
    const sourceCurrentStock = bq[sourceBranchId] ?? 0;

    if (sourceCurrentStock < cleanQty) {
      return {
        success: false,
        error: `الرصيد في فرع المصدر لا يكفي! المتوفر: ${sourceCurrentStock} ${prod.unit || 'حبة'} فقط، بينما الكمية المطلوبة للتحويل: ${cleanQty}`,
      };
    }

    const sourceBranch = this.inMemoryBranches.find((b) => b.id === sourceBranchId);
    const targetBranch = this.inMemoryBranches.find((b) => b.id === targetBranchId);
    const sourceName = sourceBranch?.name || 'فرع المصدر';
    const targetName = targetBranch?.name || 'فرع الاستلام';
    const actor = performedBy || this.inMemorySettings.activeCashier || 'مدير النظام';

    // إنقاص المخزون من فرع المصدر
    const prevSource = sourceCurrentStock;
    const newSource = prevSource - cleanQty;
    bq[sourceBranchId] = newSource;

    // زيادة المخزون في فرع الاستلام
    const prevTarget = bq[targetBranchId] ?? 0;
    const newTarget = prevTarget + cleanQty;
    bq[targetBranchId] = newTarget;

    prod.branchQuantities = bq;
    if (!prod.assignedBranchIds) {
      prod.assignedBranchIds = [prod.branchId || 'branch-main'];
    }
    if (!prod.assignedBranchIds.includes(targetBranchId)) {
      prod.assignedBranchIds.push(targetBranchId);
    }
    prod.quantity = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.updatedAt = new Date().toISOString();

    const now = new Date().toISOString();
    const count = this.inMemoryTransfers.length + 1001;
    const transferNumber = `TRF-${count}`;

    const newTransfer: StockTransfer = {
      id: 'trf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      transferNumber,
      sourceBranchId,
      sourceBranchName: sourceName,
      targetBranchId,
      targetBranchName: targetName,
      items: [
        {
          productId: prod.id,
          barcode: prod.barcode,
          productName: prod.name,
          quantity: cleanQty,
        },
      ],
      totalQuantity: cleanQty,
      status: 'completed',
      notes: notes?.trim() || undefined,
      transferredBy: actor,
      createdAt: now,
      isSynced: false,
    };

    this.inMemoryTransfers.unshift(newTransfer);
    this.persist(STORAGE_KEYS.TRANSFERS, this.inMemoryTransfers);
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    // تسجيل حركتي تدقيق للمخزون (حركة خروج وحركة دخول)
    this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type: 'transfer_out',
      quantityDelta: -cleanQty,
      previousQuantity: prevSource,
      newQuantity: newSource,
      reason: `تحويل مخزني صادر إلى (${targetName}) - سند #${transferNumber}`,
      performedBy: actor,
    });

    this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type: 'transfer_in',
      quantityDelta: cleanQty,
      previousQuantity: prevTarget,
      newQuantity: newTarget,
      reason: `استلام تحويل مخزني وارد من (${sourceName}) - سند #${transferNumber}`,
      performedBy: actor,
    });

    this.notify();

    // مزامنة فورية مع السحابة
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    return { success: true, transfer: newTransfer };
  }

  // ==== إدارة العملاء والديون Customers & Debts ====
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
        const newBalance = cust.currentDebt + sale.netTotal;
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

  mergeCloudStockAuditLogs(cloudLogs: StockAuditLog[]) {
    const cloudMap = new Map(cloudLogs.map((l) => [l.id, l]));
    const localById = new Map(this.inMemoryStockAuditLogs.map((l) => [l.id, l]));
    const merged: StockAuditLog[] = [];

    for (const cl of cloudLogs) {
      const local = localById.get(cl.id);
      if (local && !local.id) {
        merged.push(local);
      } else {
        merged.push({
          ...cl,
          reason: cl.reason || local?.reason,
          performedBy: cl.performedBy || local?.performedBy || 'النظام',
        });
      }
    }
    for (const ll of this.inMemoryStockAuditLogs) {
      if (!cloudMap.has(ll.id)) merged.push(ll);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (merged.length > 2000) merged.length = 2000;
    this.inMemoryStockAuditLogs = merged;
    this.persist(STORAGE_KEYS.STOCK_AUDIT, this.inMemoryStockAuditLogs);
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
        const newBalance = Math.max(0, cust.currentDebt - sale.netTotal);
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
  getStockAuditLogs(productId?: string): StockAuditLog[] {
    if (productId) {
      return this.inMemoryStockAuditLogs.filter((log) => log.productId === productId);
    }
    return this.inMemoryStockAuditLogs;
  }

  addStockAuditLog(log: Omit<StockAuditLog, 'id' | 'createdAt'>): StockAuditLog {
    const newLog: StockAuditLog = {
      ...log,
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    this.inMemoryStockAuditLogs.unshift(newLog);
    // Keep max 2000 log records locally
    if (this.inMemoryStockAuditLogs.length > 2000) {
      this.inMemoryStockAuditLogs = this.inMemoryStockAuditLogs.slice(0, 2000);
    }
    this.persist(STORAGE_KEYS.STOCK_AUDIT, this.inMemoryStockAuditLogs);
    this.notify();

    // مزامنة فورية في الخلفية مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncStockAuditLog?.(newLog);
        await supabase.broadcastEvent('STOCK_AUDIT_CREATE', newLog);
      },
      { type: 'STOCK_AUDIT_CREATE', data: newLog }
    );

    return newLog;
  }

  // ==== إدارة الموردين (Suppliers) ====
  getSuppliers(): Supplier[] {
    return this.inMemorySuppliers;
  }

  getSupplierById(id: string): Supplier | undefined {
    return this.inMemorySuppliers.find((s) => s.id === id);
  }

  saveSupplier(supplier: { id?: string; name: string; company?: string; phone?: string; address?: string; balance?: number; notes?: string }): Supplier {
    const cleanName = (supplier.name || '').trim();
    if (!cleanName) throw new Error('اسم المورد مطلوب');

    const now = new Date().toISOString();
    let saved: Supplier;

    if (supplier.id) {
      const idx = this.inMemorySuppliers.findIndex((s) => s.id === supplier.id);
      if (idx !== -1) {
        saved = {
          ...this.inMemorySuppliers[idx],
          name: cleanName,
          company: supplier.company?.trim(),
          phone: supplier.phone?.trim(),
          address: supplier.address?.trim(),
          balance: Number(supplier.balance ?? this.inMemorySuppliers[idx].balance) || 0,
          notes: supplier.notes?.trim(),
        };
        this.inMemorySuppliers[idx] = saved;
      } else {
        saved = {
          id: supplier.id,
          name: cleanName,
          company: supplier.company?.trim(),
          phone: supplier.phone?.trim(),
          address: supplier.address?.trim(),
          balance: Number(supplier.balance) || 0,
          notes: supplier.notes?.trim(),
          createdAt: now,
        };
        this.inMemorySuppliers.unshift(saved);
      }
    } else {
      saved = {
        id: 'sup-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        company: supplier.company?.trim(),
        phone: supplier.phone?.trim(),
        address: supplier.address?.trim(),
        balance: Number(supplier.balance) || 0,
        notes: supplier.notes?.trim(),
        createdAt: now,
      };
      this.inMemorySuppliers.unshift(saved);
    }

    this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
    this.notify();
    return saved;
  }

  deleteSupplier(id: string): boolean {
    const prevLen = this.inMemorySuppliers.length;
    this.inMemorySuppliers = this.inMemorySuppliers.filter((s) => s.id !== id);
    const changed = this.inMemorySuppliers.length !== prevLen;
    if (changed) {
      this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
      this.notify();
    }
    return changed;
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
  getSettings(): StoreSettings {
    return this.inMemorySettings;
  }

  saveSettings(settings: Partial<StoreSettings>): StoreSettings {
    this.inMemorySettings = { ...this.inMemorySettings, ...settings };

    // تطبيع: أي securityPin وارد كنص صريح يُهاش قبل الحفظ (حماسة ذاتية).
    // نؤجل حفظ الإعدادات حتى اكتمال الهاش حتى لا يُكتب النص الصريح على الإطلاق.
    const incomingPin = this.inMemorySettings.securityPin;
    if (incomingPin && !isHashedValue(incomingPin)) {
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
  private randomTempPassword(): string {
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
    if (savedUser.password && !isHashedValue(savedUser.password)) {
      this.persistUsersAfterHash(savedUser);
    } else {
      this.persist(STORAGE_KEYS.USERS, this.inMemoryUsers);
    }
    this.inMemorySettings.users = this.inMemoryUsers;
    this.inMemorySettings.cashiers = this.inMemoryUsers.map((u) => u.name);
    if (isHashedValue(savedUser.password)) {
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
    if (incomingPin && !isHashedValue(incomingPin)) {
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
  private isWithinDateRange(isoDate: string, range?: { dateFrom?: string; dateTo?: string }): boolean {
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

export const dbService = new CloudBackedDatabase();
/** وعد جهوزية القاعدة: يكتمل بعد ترحيلات PIN وكلمات المرور — main.tsx ينتظره قبل التركيب */
export const dbReady = dbService.ready;

