import { useState, useEffect } from 'react';
import { dbService } from './services/db';
import { SupabaseService } from './services/supabase';
import { signOutOnline } from './services/auth';
import { Product, StoreSettings, SyncStatus, UserAccount } from './types';
import { Header } from './components/Header';
import { POS } from './components/POS';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { Returns } from './components/Returns';
import { Reports } from './components/Reports';
import { CustomersDebts } from './components/CustomersDebts';
import { SuppliersManagement } from './components/SuppliersManagement';
import { StockAuditView } from './components/StockAuditView';
import { PinModal } from './components/PinModal';
import { BarcodeStudio } from './components/BarcodeStudio';
import { ZReportModal } from './components/ZReportModal';
import { OfflineQueueModal } from './components/OfflineQueueModal';
import { BarcodeHardwareTestModal } from './components/BarcodeHardwareTestModal';
import { CashDrawerModal } from './components/CashDrawerModal';
import { LoginModal } from './components/LoginModal';
import { PasswordChangeModal } from './components/PasswordChangeModal';
import { PasswordAlertBanner } from './components/PasswordAlertBanner';
import { BranchManagementModal } from './components/BranchManagementModal';
import { UsersManagementModal } from './components/UsersManagementModal';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

interface ToastItem {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warn' | 'info';
}

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('pos');
  const [settings, setSettings] = useState<StoreSettings>(dbService.getSettings());
  const [products, setProducts] = useState<Product[]>(dbService.getProducts());
  const [dataVersion, setDataVersion] = useState<number>(Date.now());
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Auth and Multi-Branch state
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(dbService.getCurrentUser());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(!dbService.getCurrentUser());
  const [isPasswordChangeOpen, setIsPasswordChangeOpen] = useState<boolean>(false);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState<boolean>(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState<boolean>(false);
  const [isPasswordAlertDismissed, setIsPasswordAlertDismissed] = useState<boolean>(false);

  // Modals state
  const [isBarcodeStudioOpen, setIsBarcodeStudioOpen] = useState<boolean>(false);
  const [isZReportOpen, setIsZReportOpen] = useState<boolean>(false);
  const [isOfflineQueueOpen, setIsOfflineQueueOpen] = useState<boolean>(false);
  const [isScannerTestOpen, setIsScannerTestOpen] = useState<boolean>(false);
  const [isCashDrawerOpen, setIsCashDrawerOpen] = useState<boolean>(false);

  const isDark = settings.theme !== 'light';

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.classList.remove('light');
      document.body.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.classList.add('light');
    }
  }, [isDark]);

  // تحميل وتحديث البيانات
  const refreshData = () => {
    setProducts(dbService.getProducts());
    setSettings(dbService.getSettings());
    setDataVersion(Date.now());
  };

  useEffect(() => {
    // 1. اشتراك محلي في قاعدة البيانات الداخلية
    const unsubscribeDb = dbService.subscribe(() => {
      refreshData();
    });

    // 2. اشتراك فوري وسريع في تحديثات Supabase Realtime
    const unsubscribeRealtimeUpdate = SupabaseService.onRealtimeUpdate((event) => {
      refreshData();
      if (event.table === 'products' && (event.eventType === 'INSERT' || event.eventType === 'UPDATE')) {
        console.log('Realtime product update received from another device:', event.data?.name);
      }
    });

    // 3. جلب بيانات السحابة الأولية من Supabase
    const loadCloudData = async () => {
      if (SupabaseService.isConfigured()) {
        try {
          await SupabaseService.pullFromSupabase();
        } catch (e) {
          console.warn('Initial cloud pull failed:', e);
        }
        // شفاء تلقائي: سجلات محلية لم تصل السحابة (بِيعت أثناء أوفلاين أو قُطعت مزامنتها
        // بالتحديث) تُدفع فوراً بعد السحب الأولي حتى لا تبقى محلية أبداً
        try {
          const counts = dbService.getUnsyncedCounts();
          if (navigator.onLine && (counts.unsyncedSales > 0 || counts.unsyncedReturns > 0 || counts.unsyncedDebt > 0)) {
            await SupabaseService.syncAll();
          }
        } catch (e) {
          console.warn('Auto-heal sync failed:', e);
        }
      }
      refreshData();
    };
    loadCloudData();

    // 4. تشغيل مزامنة Supabase الحية
    try {
      SupabaseService.startRealtimeSync(() => {
        refreshData();
      });
    } catch (err) {
      console.warn('Supabase realtime startup error:', err);
    }

    // 5. مزامنة عند عودة الاتصال مع Supabase
    const handleOnlineSync = async () => {
      try {
        if (SupabaseService.isConfigured()) {
          const res = await SupabaseService.syncAll();
          if (res.syncedSalesCount > 0 || res.syncedReturnsCount > 0) {
            showToast(`تمت المزامنة بنجاح ورفع ${res.syncedSalesCount} فاتورة!`, 'success');
          }
        }
        refreshData();
      } catch (e) {
        console.warn('Auto sync on online error:', e);
      }
    };

    window.addEventListener('online', handleOnlineSync);

    return () => {
      window.removeEventListener('online', handleOnlineSync);
      unsubscribeDb();
      unsubscribeRealtimeUpdate();
    };
  }, []);

  // نظام إشعارات Toast
  const showToast = (message: string, type: 'success' | 'error' | 'warn' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random();
    const newToast: ToastItem = { id, message, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // معالجة تسجيل الدخول والخروج وكلمة المرور
  const handleLoginSuccess = (user: UserAccount) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    setIsPasswordAlertDismissed(false);
    if (user.role !== 'admin') {
      setActiveTab('pos');
    }
    refreshData();
    showToast(`أهلاً بك يا ${user.name}! تم تسجيل الدخول بنجاح.`, 'success');
    if (user.mustChangePassword) {
      setTimeout(() => {
        setIsPasswordChangeOpen(true);
      }, 500);
    }
  };

  // حماية التبويبات بحسب الصلاحيات: توجيه الكاشير إلى نقطة البيع إذا حاول فتح شاشات الإدارة العامة
  useEffect(() => {
    const adminOnlyTabs = ['dashboard', 'reports', 'suppliers', 'audit'];
    if (currentUser && currentUser.role !== 'admin' && adminOnlyTabs.includes(activeTab)) {
      setActiveTab('pos');
    }
  }, [currentUser, activeTab]);

  const handleLogout = () => {
    dbService.logout();
    signOutOnline().catch(() => {});
    SupabaseService.resetClient();
    setCurrentUser(null);
    setIsLoginModalOpen(true);
    showToast('تم تسجيل الخروج بنجاح', 'info');
  };

  const handlePasswordChanged = () => {
    const updatedUser = dbService.getCurrentUser();
    setCurrentUser(updatedUser);
    setIsPasswordChangeOpen(false);
    refreshData();
    showToast('تم تغيير كلمة المرور بنجاح وحماية حسابك!', 'success');
  };

  const lowStockCount = products.filter((p) => p.quantity <= p.minQuantityAlert).length;
  const unsynced = dbService.getUnsyncedCounts();
  const syncStatus: SyncStatus = {
    isSyncing: false,
    lastSyncedAt: new Date().toLocaleTimeString('ar-SA'),
    pendingSalesCount: unsynced.unsyncedSales,
    pendingReturnsCount: unsynced.unsyncedReturns,
    pendingCustomersCount: 0,
    pendingDebtCount: unsynced.unsyncedDebt,
    isConfigured: SupabaseService.isConfigured(),
  };

  return (
    <div className={`min-h-screen flex flex-col font-['Cairo',sans-serif] transition-colors duration-200 ${
      isDark ? 'dark bg-slate-950 text-slate-100' : 'light bg-slate-100 text-slate-900'
    }`}>
      {/* Toast Notification Box */}
      <div id="toastContainer" className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none max-w-md w-[92%]">
        {toasts.map((t) => {
          let bg = 'bg-slate-900 text-white';
          let Icon = Info;
          if (t.type === 'success') {
            bg = 'bg-emerald-700 text-white shadow-emerald-700/30';
            Icon = CheckCircle2;
          } else if (t.type === 'error') {
            bg = 'bg-rose-700 text-white shadow-rose-700/30';
            Icon = AlertCircle;
          } else if (t.type === 'warn') {
            bg = 'bg-amber-600 text-white shadow-amber-600/30';
            Icon = AlertTriangle;
          }

          return (
            <div
              key={t.id}
              className={`flex items-center justify-between gap-3 p-3.5 rounded-2xl shadow-xl border border-white/10 text-xs font-bold animate-fade-in pointer-events-auto ${bg}`}
            >
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="leading-snug">{t.message}</span>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="opacity-70 hover:opacity-100 p-0.5 rounded-lg cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Main Header */}
      <Header
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        onSettingsUpdate={setSettings}
        onLockApp={() => setIsLocked(true)}
        lowStockCount={lowStockCount}
        onOpenBarcodeStudio={() => setIsBarcodeStudioOpen(true)}
        onOpenZReport={() => setIsZReportOpen(true)}
        onOpenOfflineQueue={() => setIsOfflineQueueOpen(true)}
        onOpenScannerTest={() => setIsScannerTestOpen(true)}
        onOpenCashDrawer={() => setIsCashDrawerOpen(true)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setIsLoginModalOpen(true)}
        onOpenChangePassword={() => setIsPasswordChangeOpen(true)}
        onOpenBranches={() => setIsBranchModalOpen(true)}
        onOpenUsers={() => setIsUsersModalOpen(true)}
      />

      {/* شريط تنبيه الأمان: إلزام تغيير كلمة المرور الافتراضية المؤقتة عند أول دخول */}
      {currentUser && currentUser.mustChangePassword && !isPasswordAlertDismissed && (
        <PasswordAlertBanner
          user={currentUser}
          onOpenChangePassword={() => setIsPasswordChangeOpen(true)}
          onDismiss={() => setIsPasswordAlertDismissed(true)}
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-5">
        {activeTab === 'pos' && (
          <POS
            settings={settings}
            products={products}
            currentUser={currentUser}
            onDataChange={refreshData}
            showToast={showToast}
          />
        )}

        {activeTab === 'dashboard' && (
          <div key={dataVersion}>
            <Dashboard
              settings={settings}
              products={products}
              onNavigate={setActiveTab}
              onDataChange={refreshData}
              showToast={showToast}
            />
          </div>
        )}

        {activeTab === 'inventory' && (
          <Inventory
            settings={settings}
            products={products}
            currentUser={currentUser}
            onDataChange={refreshData}
            showToast={showToast}
          />
        )}

        {activeTab === 'customers' && (
          <div key={dataVersion}>
            <CustomersDebts
              settings={settings}
              onDataChange={refreshData}
              showToast={showToast}
            />
          </div>
        )}

        {activeTab === 'suppliers' && (
          <div key={dataVersion}>
            <SuppliersManagement
              settings={settings}
              onDataChange={refreshData}
              showToast={showToast}
            />
          </div>
        )}

        {activeTab === 'audit' && (
          <div key={dataVersion}>
            <StockAuditView
              settings={settings}
              showToast={showToast}
            />
          </div>
        )}

        {activeTab === 'returns' && (
          <div key={dataVersion}>
            <Returns
              settings={settings}
              products={products}
              onDataChange={refreshData}
              showToast={showToast}
            />
          </div>
        )}

        {activeTab === 'reports' && (
          <div key={dataVersion}>
            <Reports
              settings={settings}
              products={products}
              onDataChange={refreshData}
              showToast={showToast}
            />
          </div>
        )}
      </main>

      {/* PIN Security Modal */}
      <PinModal
        isOpen={isLocked}
        onUnlock={() => setIsLocked(false)}
        settings={settings}
        showToast={showToast}
      />

      {/* Barcode Studio Modal */}
      <BarcodeStudio
        isOpen={isBarcodeStudioOpen}
        onClose={() => setIsBarcodeStudioOpen(false)}
        products={products}
        settings={settings}
      />

      {/* Z-Report Financial Closing Modal */}
      <ZReportModal
        isOpen={isZReportOpen}
        onClose={() => setIsZReportOpen(false)}
        sales={dbService.getSales()}
        returns={dbService.getReturns()}
        settings={settings}
      />

      {/* Offline Sync Queue Inspector Modal */}
      <OfflineQueueModal
        isOpen={isOfflineQueueOpen}
        onClose={() => setIsOfflineQueueOpen(false)}
        syncStatus={syncStatus}
        onSyncComplete={refreshData}
      />

      {/* Hardware Scanner Diagnostic Modal */}
      <BarcodeHardwareTestModal
        isOpen={isScannerTestOpen}
        onClose={() => setIsScannerTestOpen(false)}
        products={products}
      />

      {/* Cash Drawer & Shift Reconciliation Modal */}
      <CashDrawerModal
        isOpen={isCashDrawerOpen}
        onClose={() => setIsCashDrawerOpen(false)}
        settings={settings}
        showToast={showToast}
      />

      {/* مودال تسجيل الدخول — يُفتح عند أول دخول أو عند انقطاع الجلسة (لا دخول تلقائي) */}
      <LoginModal
        isOpen={isLoginModalOpen || !currentUser}
        onClose={() => {
          if (currentUser) setIsLoginModalOpen(false);
        }}
        onLoginSuccess={handleLoginSuccess}
        showCloseBtn={!!currentUser}
      />

      {/* مودال تغيير كلمة المرور لحماية الحساب */}
      <PasswordChangeModal
        isOpen={isPasswordChangeOpen}
        onClose={() => setIsPasswordChangeOpen(false)}
        user={currentUser}
        onSuccess={handlePasswordChanged}
      />

      {/* مودال إدارة الفروع المتعددة (Multi-Branch Management) */}
      <BranchManagementModal
        isOpen={isBranchModalOpen}
        onClose={() => setIsBranchModalOpen(false)}
        onBranchesChange={refreshData}
        showToast={showToast}
      />

      {/* مودال إدارة المستخدمين وصلاحيات الكاشير والمدير */}
      <UsersManagementModal
        isOpen={isUsersModalOpen}
        onClose={() => setIsUsersModalOpen(false)}
        onUsersChange={refreshData}
        showToast={showToast}
      />
    </div>
  );
}
