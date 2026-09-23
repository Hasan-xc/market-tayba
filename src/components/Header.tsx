import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import {
  ShoppingBag,
  LayoutDashboard,
  Package,
  RotateCcw,
  FileText,
  Users,
  Truck,
  ClipboardList,
} from 'lucide-react';
import { StoreSettings, UserAccount } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { BackupService } from '../services/backup';
import { HeaderTopBar } from './HeaderTopBar';
import { HeaderDrawer } from './HeaderDrawer';
import { HeaderSettingsModal } from './HeaderSettingsModal';
import { HeaderSqlModal } from './HeaderSqlModal';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  settings: StoreSettings;
  onSettingsUpdate: (settings: StoreSettings) => void;
  onLockApp: () => void;
  lowStockCount: number;
  currentUser: UserAccount | null;
  onLogout: () => void;
  onOpenLogin: () => void;
  onOpenChangePassword: () => void;
  onOpenBranches?: () => void;
  onOpenUsers?: () => void;
  onOpenBarcodeStudio?: () => void;
  onOpenZReport?: () => void;
  onOpenOfflineQueue?: () => void;
  onOpenScannerTest?: () => void;
  onOpenCashDrawer?: () => void;
}

export const Header = ({
  activeTab,
  onTabChange,
  settings,
  onSettingsUpdate,
  onLockApp,
  lowStockCount,
  currentUser,
  onLogout,
  onOpenLogin,
  onOpenChangePassword,
  onOpenBranches,
  onOpenUsers,
  onOpenBarcodeStudio,
  onOpenZReport,
  onOpenOfflineQueue,
  onOpenScannerTest,
  onOpenCashDrawer,
}: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<StoreSettings>(settings);
  const [realtimeState, setRealtimeState] = useState<string>('connecting');
  const [isSyncing, setIsSyncing] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  // حالة قسم النسخ الاحتياطي وتصدير CSV
  const [csvRange, setCsvRange] = useState<'today' | 'week' | 'month' | 'custom'>('today');
  const [csvDateFrom, setCsvDateFrom] = useState('');
  const [csvDateTo, setCsvDateTo] = useState('');
  const [csvSections, setCsvSections] = useState<string[]>(['all']);
  const [csvMsg, setCsvMsg] = useState('');

  // حالة زر تثبيت التطبيق (PWA)
  const [installPromptEvent, setInstallPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  // حالة زر إعادة المزامنة الكاملة من السحابة (تصفير الكاش المحلي)
  const [isResyncing, setIsResyncing] = useState(false);

  const branches = dbService.getBranches();
  const activeBranchId = dbService.getActiveBranchId();
  const activeBranch = activeBranchId === 'all'
    ? { id: 'all', name: 'جميع الفروع مجمعة' }
    : (branches.find(b => b.id === activeBranchId) || { id: 'branch-main', name: 'الفرع الرئيسي' });
  const isAdmin = currentUser?.role === 'admin';

  const handleSwitchBranch = (bId: string) => {
    dbService.setActiveBranchId(bId);
    setIsBranchDropdownOpen(false);
    onSettingsUpdate(dbService.getSettings());
  };

  const handleExportBackup = () => {
    try {
      const json = dbService.exportFullBackupJSON();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `taybah_market_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('خطأ في تصدير النسخة الاحتياطية: ' + e.message);
    }
  };

  const handleImportBackup = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        if (!text) return;
        const confirmed = window.confirm('هل أنت متأكد من استعادة هذه النسخة الاحتياطية؟ سيتم دمج أو تحديث بيانات النظام والورديات بالكامل.');
        if (!confirmed) return;

        // importFullBackupJSON يعيد كائن نتيجة {success, message} وليس boolean —
        // يجب فحص success صراحة وإلا عومل الفشل كنجاح وأعيد تحميل الصفحة
        const result = dbService.importFullBackupJSON(text);
        if (result && result.success) {
          alert('تمت استعادة النسخة الاحتياطية بنجاح!');
          window.location.reload();
        } else {
          alert('فشلت الاستعادة: ' + (result?.message || 'ملف غير صالح أو تالف.'));
        }
      } catch (err: any) {
        alert('خطأ في قراءة ملف النسخة الاحتياطية: ' + err.message);
      }
    };
    reader.readAsText(file);
    // تفريغ الحقل لاختياره مجدداً لاحقاً
    if (e.target) e.target.value = '';
  };

  // ==== النسخ الاحتياطي وتصدير البيانات (CSV) ====
  const localDateStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const toggleCsvSection = (key: string) => {
    setCsvSections((prev) => {
      if (key === 'all') return prev.includes('all') ? [] : ['all'];
      const withoutAll = prev.filter((k) => k !== 'all');
      return withoutAll.includes(key) ? withoutAll.filter((k) => k !== key) : [...withoutAll, key];
    });
  };

  const toggleAutoBackupSection = (key: string) => {
    const current = localSettings.autoBackupSections || ['all'];
    let next: string[];
    if (key === 'all') {
      next = current.includes('all') ? [] : ['all'];
    } else {
      const withoutAll = current.filter((k) => k !== 'all');
      next = withoutAll.includes(key) ? withoutAll.filter((k) => k !== key) : [...withoutAll, key];
    }
    setLocalSettings({ ...localSettings, autoBackupSections: next });
  };

  const handleDownloadCsvBackup = () => {
    try {
      if (csvSections.length === 0) {
        setCsvMsg('يرجى اختيار قسم واحد على الأقل للتصدير');
        return;
      }
      const today = new Date();
      let dateFrom: string | undefined;
      let dateTo: string | undefined = localDateStr(today);
      if (csvRange === 'today') {
        dateFrom = dateTo;
      } else if (csvRange === 'week') {
        const f = new Date(today);
        f.setDate(f.getDate() - 6);
        dateFrom = localDateStr(f);
      } else if (csvRange === 'month') {
        const f = new Date(today);
        f.setMonth(f.getMonth() - 1);
        dateFrom = localDateStr(f);
      } else {
        dateFrom = csvDateFrom || undefined;
        dateTo = csvDateTo || undefined;
      }
      const count = BackupService.downloadFilteredCSVs(csvSections, dateFrom, dateTo);
      setCsvMsg(`تم تنزيل ${count} ملف CSV بنجاح${dateFrom || dateTo ? ' للنطاق المحدد' : ''}.`);
    } catch (err: any) {
      setCsvMsg('فشل التصدير: ' + (err?.message || err));
    }
  };

  // ==== زر تثبيت التطبيق على الجهاز (PWA Install) ====
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return;

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => setInstallPromptEvent(null);

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      await installPromptEvent.userChoice;
    } catch (err) {
      console.warn('Install prompt failed:', err);
    }
    setInstallPromptEvent(null);
  };

  // ==== إعادة مزامنة كاملة من السحابة (تصفير الكاش المحلي ثم إعادة السحب) ====
  const handleFullResyncFromCloud = async () => {
    // الحارس المدمج: يرفض التنفيذ إذا كان طابور الأوفلاين يحتوي عمليات غير متزامنة
    const queue = dbService.getOfflineQueue();
    if (queue.length > 0) {
      const details = queue
        .map((m) => `• ${m.type} — ${new Date(m.timestamp).toLocaleString('ar-SA')}`)
        .join('\n');
      window.confirm(
        `⚠️ لا يمكن التنفيذ: يوجد ${queue.length} عملية غير متزامنة في طابور الأوفلاين:\n\n${details}\n\n` +
        'افتح «طابور المزامنة» من القائمة الجانبية ووفّر مزامنتها أولاً (أو قرر تجاهلها) ثم أعد المحاولة.'
      );
      return;
    }

    if (!navigator.onLine || !SupabaseService.isConfigured()) {
      alert('لا يمكن التنفيذ بدون اتصال بالإنترنت واتصال Supabase مفعّل.');
      return;
    }

    const confirmed = window.confirm(
      'سيتم مسح البيانات المحلية وإعادة تحميلها من السحابة، المبيعات لن تتأثر.\n\n' +
      '🗑️ سيُمسح ويُسحب من جديد: المنتجات، العملاء، الموردين، حركات المخزون، سندات التحويل.\n' +
      '🔒 لن يُمسّ إطلاقاً: المبيعات، المرتجعات، الديون، الورديات، السلات المعلقة، الإعدادات.\n' +
      '☁️ لن يُحذف أي شيء من Supabase نفسه — العملية محلية فقط.\n\n' +
      'هل تريد المتابعة؟'
    );
    if (!confirmed) return;

    setIsResyncing(true);
    try {
      // 1) دفع الموردين المحليين للسحابة قبل المسح (معظمهم push-only)
      const pushedSuppliers = await SupabaseService.backfillSuppliersToCloud();

      // 2) تصفير الكاش المحلي للكيانات المعتمدة
      const res = dbService.wipeLocalCacheForRepull();

      // 3) إعادة السحب فوراً: products + customers + audit عبر pullFromSupabase
      // (دمج غير مدمِّر — الفواتير المحلية غير المتزامنة محمية بالتصميم)
      const pullResult = await SupabaseService.pullFromSupabase();

      // 4) سحب الموردين والتحويلات (لا توجد لهما سحب في pullFromSupabase)
      const suppliersCount = await SupabaseService.pullSuppliersFromSupabase();
      const transfersCount = await SupabaseService.pullStockTransfersFromSupabase();

      alert(
        'تم تصفير الكاش المحلي وإعادة تحميله من السحابة بنجاح ✅\n\n' +
        `• موردين دُفعوا للسحابة قبل المسح: ${pushedSuppliers}\n` +
        `• منتجات مسحوبة: ${pullResult.productsCount ?? '?'}\n` +
        `• عملاء مسحوبون: ${pullResult.customersCount ?? '?'}\n` +
        `• حركات مخزون مسحوبة: ${pullResult.auditCount ?? '?'}\n` +
        `• موردين مسحوبين: ${suppliersCount}\n` +
        `• تحويلات مسحوبة: ${transfersCount}\n\n` +
        `المُمسوح فعلياً: ${res.cleared.join('، ')}\n` +
        'المبيعات والمرتجعات والديون والورديات لم تُمسّ.'
      );
    } catch (err: any) {
      alert('فشلت إعادة المزامنة: ' + (err?.message || err) + '\nبياناتك المحلية المتبقية (مبيعات وغيرها) سليمة.');
    } finally {
      setIsResyncing(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // استماع لحالة اتصال Supabase الحية
  useEffect(() => {
    const unsub = SupabaseService.onRealtimeStatusChange((status) => {
      setRealtimeState(status);
    });
    return () => unsub();
  }, []);

  const handleNavClick = (tabId: string) => {
    onTabChange(tabId);
    setIsMenuOpen(false);
  };

  const handleSaveSettings = (e: FormEvent) => {
    e.preventDefault();
    dbService.saveSettings(localSettings);
    onSettingsUpdate(localSettings);
    setSaveSuccessMsg(true);
    setTimeout(() => {
      setSaveSuccessMsg(false);
      setIsSettingsOpen(false);
    }, 1200);

    if (navigator.onLine && SupabaseService.isConfigured()) {
      SupabaseService.syncSettings(localSettings).catch(() => {});
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      await SupabaseService.syncAll();
    } catch (e) {
      console.warn('Manual sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSound = () => {
    const updated = {
      ...settings,
      soundEnabled: settings.soundEnabled === false ? true : false,
    };
    dbService.saveSettings(updated);
    onSettingsUpdate(updated);
  };

  const toggleTheme = (targetTheme?: 'dark' | 'light') => {
    const currentTheme = settings.theme || 'dark';
    const newTheme = targetTheme || (currentTheme === 'dark' ? 'light' : 'dark');
    const updated: StoreSettings = {
      ...settings,
      theme: newTheme,
    };
    setLocalSettings(updated);
    dbService.saveSettings(updated);
    onSettingsUpdate(updated);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
  };

  // قائمة التنقل الرئيسية - مسميات عربية رشيقة وموجزة ومخصصة حسب الصلاحية
  const navItems = [
    {
      id: 'pos',
      label: 'الكاشير',
      subtitle: 'البيع السريع',
      icon: ShoppingBag,
    },
    ...(isAdmin ? [{
      id: 'dashboard',
      label: 'لوحة التحكم',
      subtitle: 'الرئيسية والتحليلات العامة',
      icon: LayoutDashboard,
    }] : []),
    {
      id: 'inventory',
      label: 'المخزون',
      subtitle: isAdmin ? 'الأصناف والأسعار والفروع' : `مخزون فرع (${activeBranch.name})`,
      icon: Package,
      countBadge: lowStockCount > 0 ? lowStockCount : undefined,
    },
    {
      id: 'customers',
      label: 'الزبائن والديون',
      subtitle: 'الحسابات الآجلة',
      icon: Users,
    },
    {
      id: 'returns',
      label: 'المرتجعات',
      subtitle: isAdmin ? 'فواتير الاسترجاع' : `مرتجعات فرع (${activeBranch.name})`,
      icon: RotateCcw,
    },
    ...(isAdmin ? [
      {
        id: 'suppliers',
        label: 'الموردون',
        subtitle: 'الذمم والفواتير',
        icon: Truck,
      },
      {
        id: 'audit',
        label: 'حركات المخزن',
        subtitle: 'سجل التدقيق والتتبع',
        icon: ClipboardList,
      },
      {
        id: 'reports',
        label: 'التقارير',
        subtitle: 'المبيعات والأرباح الشاملة',
        icon: FileText,
      }
    ] : [])
  ];

  const isConnected = realtimeState === 'connected';

  return (
    <>
      <HeaderTopBar
        settings={settings}
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        isOnline={isOnline}
        isAdmin={isAdmin}
        branches={branches}
        activeBranchId={activeBranchId}
        activeBranch={activeBranch}
        isBranchDropdownOpen={isBranchDropdownOpen}
        setIsBranchDropdownOpen={setIsBranchDropdownOpen}
        handleSwitchBranch={handleSwitchBranch}
        currentUser={currentUser}
        isUserMenuOpen={isUserMenuOpen}
        setIsUserMenuOpen={setIsUserMenuOpen}
        onOpenLogin={onOpenLogin}
        onOpenChangePassword={onOpenChangePassword}
        onOpenUsers={onOpenUsers}
        onOpenBranches={onOpenBranches}
        onLogout={onLogout}
        activeTab={activeTab}
        onTabChange={onTabChange}
      />

      <HeaderDrawer
        isMenuOpen={isMenuOpen}
        setIsMenuOpen={setIsMenuOpen}
        settings={settings}
        toggleSound={toggleSound}
        toggleTheme={toggleTheme}
        currentUser={currentUser}
        isAdmin={isAdmin}
        activeBranch={activeBranch}
        navItems={navItems}
        activeTab={activeTab}
        handleNavClick={handleNavClick}
        isOnline={isOnline}
        onLockApp={onLockApp}
        onOpenChangePassword={onOpenChangePassword}
        onLogout={onLogout}
        onOpenCashDrawer={onOpenCashDrawer}
        onOpenBarcodeStudio={onOpenBarcodeStudio}
        onOpenZReport={onOpenZReport}
        onOpenScannerTest={onOpenScannerTest}
        onOpenOfflineQueue={onOpenOfflineQueue}
        canInstall={!!installPromptEvent}
        handleInstallApp={handleInstallApp}
        setIsSettingsOpen={setIsSettingsOpen}
        onOpenBranches={onOpenBranches}
        onOpenUsers={onOpenUsers}
      />

      <HeaderSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        localSettings={localSettings}
        setLocalSettings={setLocalSettings}
        saveSuccessMsg={saveSuccessMsg}
        handleSaveSettings={handleSaveSettings}
        handleExportBackup={handleExportBackup}
        handleImportBackup={handleImportBackup}
        importFileInputRef={importFileInputRef}
        csvRange={csvRange}
        setCsvRange={setCsvRange}
        csvDateFrom={csvDateFrom}
        setCsvDateFrom={setCsvDateFrom}
        csvDateTo={csvDateTo}
        setCsvDateTo={setCsvDateTo}
        csvSections={csvSections}
        toggleCsvSection={toggleCsvSection}
        csvMsg={csvMsg}
        handleDownloadCsvBackup={handleDownloadCsvBackup}
        toggleAutoBackupSection={toggleAutoBackupSection}
        isAdmin={isAdmin}
        onOpenBranches={onOpenBranches}
        onOpenUsers={onOpenUsers}
        onOpenChangePassword={onOpenChangePassword}
        currentUser={currentUser}
        handleFullResyncFromCloud={handleFullResyncFromCloud}
        isResyncing={isResyncing}
        onOpenSqlModal={() => setIsSqlModalOpen(true)}
      />

      <HeaderSqlModal
        isOpen={isSqlModalOpen}
        onClose={() => setIsSqlModalOpen(false)}
      />
    </>
  );
};