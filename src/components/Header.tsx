import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from 'react';
import { 
  ShoppingBag, 
  LayoutDashboard, 
  Package, 
  RotateCcw, 
  FileText, 
  Lock, 
  Menu, 
  X, 
  ChevronLeft, 
  Settings, 
  Volume2, 
  VolumeX, 
  Cloud, 
  CloudOff, 
  Database, 
  Save, 
  Mail, 
  Store, 
  CheckCircle2, 
  RefreshCw,
  Sparkles,
  Users,
  Truck,
  ClipboardList,
  Barcode,
  Zap,
  Sun,
  Moon,
  Code2,
  Copy,
  Check,
  ShoppingCart,
  Scale,
  Printer,
  Download,
  Upload,
  Building2,
  LogOut,
  KeyRound,
  UserCheck,
  User,
  ChevronDown,
  FileSpreadsheet,
  CalendarDays,
  Smartphone,
  PackageMinus
} from 'lucide-react';
import { StoreSettings, UserAccount, Branch } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { BackupService } from '../services/backup';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const BACKUP_SECTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'sales', label: 'المبيعات' },
  { key: 'products', label: 'المنتجات' },
  { key: 'stock_audit', label: 'حركات المخزون' },
  { key: 'suppliers', label: 'الموردين' },
  { key: 'customers', label: 'العملاء' },
  { key: 'returns', label: 'المرتجعات' },
  { key: 'valuation', label: 'تقييم المخزون' },
];

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
  onOpenCashDrawer
}: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [isCopiedSql, setIsCopiedSql] = useState(false);
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
      <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-slate-800 select-none font-['Cairo',sans-serif]">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Right: Hamburger Button & Store Name (Store name on top, green badge directly below) */}
            <div className="flex items-center gap-3">
              {/* زر القائمة الجانبية */}
              <button
                id="hamburger-menu-btn"
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`flex items-center justify-center h-10 w-10 rounded-xl transition-all duration-200 active:scale-90 cursor-pointer shadow-sm ${
                  isMenuOpen
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-900/40'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/40'
                }`}
                title={isMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة الرئيسية'}
                aria-label="القائمة"
              >
                {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>

              {/* اسم المحل أولاً وتحته حالة الاتصال مباشرة */}
              <div className="flex flex-col justify-center">
                <h1 className="font-black text-base sm:text-lg tracking-tight text-white leading-tight">
                  {settings.storeName || 'ماركت طيبه'}
                </h1>
                <div className="flex items-center gap-1.5 mt-0.5">
                  {isOnline ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      نشط
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                      غير نشط
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Left: Branch Selector, User Profile & Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Branch Selector Dropdown */}
              <div className="relative">
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-bold text-slate-200 transition cursor-pointer shadow-xs"
                    title="الفرع النشط - انقر للتبديل أو الإدارة"
                  >
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span className="max-w-[130px] truncate">{activeBranch.name}</span>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ) : (
                  <div
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/60 border border-slate-700/60 text-xs font-bold text-slate-300 shadow-xs"
                    title="الفرع التابع له"
                  >
                    <Building2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="max-w-[130px] truncate">{activeBranch.name}</span>
                  </div>
                )}

                {/* Branch Dropdown Menu */}
                {isAdmin && isBranchDropdownOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2 z-50 animate-fade-in text-slate-900 dark:text-white text-xs">
                    <div className="px-2 py-1 text-[11px] font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800 mb-1">
                      تبديل الفرع النشط:
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSwitchBranch('all')}
                      className={`w-full text-right px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between cursor-pointer transition ${
                        activeBranchId === 'all'
                          ? 'bg-emerald-600 text-white font-black'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>🏢 جميع الفروع مجمعة</span>
                      {activeBranchId === 'all' && <Check className="w-3.5 h-3.5" />}
                    </button>
                    {branches.map((b) => {
                      const isCurr = activeBranchId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSwitchBranch(b.id)}
                          className={`w-full text-right px-2.5 py-1.5 rounded-xl font-bold flex items-center justify-between cursor-pointer transition ${
                            isCurr
                              ? 'bg-emerald-600 text-white font-black'
                              : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{b.name}</span>
                          </div>
                          {isCurr && <Check className="w-3.5 h-3.5 shrink-0" />}
                        </button>
                      );
                    })}
                    {onOpenBranches && (
                      <div className="pt-1.5 mt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBranchDropdownOpen(false);
                            onOpenBranches();
                          }}
                          className="w-full text-right px-2.5 py-1.5 rounded-xl font-black text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 flex items-center gap-1.5 cursor-pointer"
                        >
                          <Settings className="w-3.5 h-3.5" />
                          <span>إدارة الفروع (إضافة / تعديل)...</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* User Profile Pill / Menu */}
              <div className="relative">
                {currentUser ? (
                  <button
                    type="button"
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-xs font-bold text-white transition cursor-pointer shadow-xs"
                    title="الحساب الحالي"
                  >
                    <div className="w-6 h-6 rounded-lg bg-emerald-600/30 text-emerald-400 flex items-center justify-center font-black text-[11px] border border-emerald-500/20">
                      {currentUser.name.charAt(0) || 'U'}
                    </div>
                    <span className="hidden md:inline font-bold max-w-[100px] truncate">{currentUser.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono hidden sm:inline">
                      {isAdmin ? 'مدير' : 'كاشير'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-slate-400" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onOpenLogin}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black shadow-md cursor-pointer transition"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>دخول</span>
                  </button>
                )}

                {/* User Dropdown */}
                {currentUser && isUserMenuOpen && (
                  <div className="absolute left-0 mt-2 w-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 z-50 animate-fade-in text-slate-900 dark:text-white text-xs">
                    <div className="px-2 py-1.5 border-b border-slate-100 dark:border-slate-800 mb-1.5">
                      <div className="font-black text-sm text-slate-900 dark:text-white">{currentUser.name}</div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <span className="font-mono">@{currentUser.username}</span>
                        <span>•</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {isAdmin ? 'مدير النظام' : 'كاشير نقطة البيع'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 mt-1">
                        الفرع: <span className="font-bold text-slate-600 dark:text-slate-300">{activeBranch.name}</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          onOpenChangePassword();
                        }}
                        className="w-full text-right px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-2 cursor-pointer transition"
                      >
                        <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                        <span>تغيير كلمة المرور</span>
                      </button>

                      {isAdmin && onOpenUsers && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenUsers();
                          }}
                          className="w-full text-right px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-2 cursor-pointer transition"
                        >
                          <Users className="w-3.5 h-3.5 text-emerald-500" />
                          <span>إدارة المستخدمين والكاشيرات</span>
                        </button>
                      )}

                      {isAdmin && onOpenBranches && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onOpenBranches();
                          }}
                          className="w-full text-right px-2.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold flex items-center gap-2 cursor-pointer transition"
                        >
                          <Building2 className="w-3.5 h-3.5 text-blue-500" />
                          <span>إدارة الفروع (Multi-Branch)</span>
                        </button>
                      )}

                      <div className="pt-1 mt-1 border-t border-slate-100 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => {
                            setIsUserMenuOpen(false);
                            onLogout();
                          }}
                          className="w-full text-right px-2.5 py-1.5 rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-bold flex items-center gap-2 cursor-pointer transition"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>تسجيل الخروج / تبديل المستخدم</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* زر سلة التسوق للانتقال الفوري للكاشير */}
              <button
                type="button"
                id="headerQuickPosBtn"
                onClick={() => onTabChange('pos')}
                className={`flex items-center justify-center h-10 w-10 sm:h-11 sm:w-11 rounded-xl transition-all active:scale-95 cursor-pointer shadow-md ${
                  activeTab === 'pos'
                    ? 'bg-emerald-600 text-white shadow-emerald-950/50 ring-2 ring-emerald-400/60'
                    : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 hover:border-emerald-400/50'
                }`}
                title="الذهاب الفوري إلى الكاشير"
                aria-label="الكاشير"
              >
                <ShoppingCart className="h-5 w-5 sm:h-6 sm:w-6" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* نافذة القائمة الجانبية (Drawer) */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex select-none font-['Cairo',sans-serif]" dir="rtl">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs transition-opacity animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />

          {/* Drawer from Right */}
          <div className="relative w-76 max-w-[86vw] bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border-l border-slate-200 dark:border-slate-800 h-full flex flex-col z-10 animate-fade-in">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 dark:bg-emerald-600/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-xs">
                  <Store className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    {settings.storeName || 'ماركت طيبه'}
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">نظام المبيعات والمخزن</span>
                </div>
              </div>

              {/* أزرار رأس القائمة: زر الصوت بجانب اسم المتجر + زر الإغلاق */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  id="drawerSoundToggleBtn"
                  onClick={toggleSound}
                  className={`flex items-center justify-center h-8 w-8 rounded-xl border transition active:scale-90 cursor-pointer ${
                    settings.soundEnabled !== false
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700'
                  }`}
                  title={settings.soundEnabled !== false ? 'المؤثرات الصوتية مفعلة (انقر للكتم)' : 'المؤثرات الصوتية مكتومة (انقر للتشغيل)'}
                  aria-label="تبديل المؤثرات الصوتية"
                >
                  {settings.soundEnabled !== false ? (
                    <Volume2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <VolumeX className="h-4 w-4 text-slate-400" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-slate-800 transition active:scale-90 cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* محوّل المود الليلي والنهاري داخل القائمة الجانبية (Theme Switcher) */}
            <div className="p-3 bg-slate-100/70 dark:bg-slate-950/90 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-1.5 px-0.5">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                  {settings.theme === 'light' ? (
                    <Sun className="h-3.5 w-3.5 text-amber-500" />
                  ) : (
                    <Moon className="h-3.5 w-3.5 text-indigo-400" />
                  )}
                  مظهر التطبيق:
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-emerald-600 dark:text-emerald-400">
                  {settings.theme === 'light' ? 'نهاري' : 'ليلي'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs">
                <button
                  type="button"
                  id="drawerThemeLightBtn"
                  onClick={() => toggleTheme('light')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settings.theme === 'light'
                      ? 'bg-amber-400 text-slate-950 shadow-xs font-black ring-1 ring-amber-300'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Sun className={`h-3.5 w-3.5 ${settings.theme === 'light' ? 'text-slate-950' : 'text-amber-500'}`} />
                  <span>نهاري</span>
                </button>
                <button
                  type="button"
                  id="drawerThemeDarkBtn"
                  onClick={() => toggleTheme('dark')}
                  className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    settings.theme !== 'light'
                      ? 'bg-indigo-600 text-white shadow-xs font-black ring-1 ring-indigo-400'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Moon className={`h-3.5 w-3.5 ${settings.theme !== 'light' ? 'text-white' : 'text-indigo-400'}`} />
                  <span>ليلي</span>
                </button>
              </div>
            </div>

            {/* بطاقة الحساب الحالي والفرع داخل القائمة الجانبية */}
            {currentUser && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-xs border border-emerald-500/30">
                      {currentUser.name.charAt(0) || 'U'}
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                        {currentUser.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                        @{currentUser.username} • {isAdmin ? 'مدير النظام' : 'كاشير نقطة البيع'}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {activeBranch.name}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenChangePassword();
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold cursor-pointer transition"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>تغيير المرور</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onLogout();
                    }}
                    className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-bold cursor-pointer transition"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>خروج</span>
                  </button>
                </div>
              </div>
            )}

            {/* Menu Items */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavClick(item.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 text-right group cursor-pointer ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 font-black scale-[1.01]'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition shrink-0 ${
                        isActive 
                          ? 'bg-white/20 text-white' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 group-hover:text-emerald-700 dark:group-hover:text-emerald-400'
                      }`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-xs sm:text-sm font-bold leading-tight">{item.label}</span>
                        {item.subtitle && (
                          <span className={`text-[10px] font-normal leading-tight mt-0.5 ${isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {typeof item.countBadge === 'number' && item.countBadge > 0 && (
                        <span className="flex h-5 min-w-5 px-1.5 items-center justify-center rounded-full bg-rose-600 text-white font-mono font-black text-[10px] shadow-xs animate-pulse">
                          {item.countBadge}
                        </span>
                      )}
                      <ChevronLeft className={`h-4 w-4 transition ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`} />
                    </div>
                  </button>
                );
              })}

              {/* بند فرعي أسفل التقارير مباشرة: تقرير الإتلاف وإرجاع المورد (نفس شاشة حركات المخزن مفلترة مسبقاً) */}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleNavClick('audit-damage')}
                  className={`w-full flex items-center justify-between mr-5 px-3 py-1.5 rounded-xl transition-all duration-150 text-right group cursor-pointer ${
                    activeTab === 'audit-damage'
                      ? 'bg-gradient-to-l from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25 font-black'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-700 dark:hover:text-purple-400 active:scale-[0.99]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className={`flex h-6 w-6 items-center justify-center rounded-lg transition shrink-0 ${
                      activeTab === 'audit-damage'
                        ? 'bg-white/20 text-white'
                        : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                    }`}>
                      <PackageMinus className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex flex-col text-right">
                      <span className="text-[11px] font-bold leading-tight">تقرير الإتلاف وإرجاع المورد</span>
                      <span className={`text-[10px] font-normal leading-tight mt-0.5 ${activeTab === 'audit-damage' ? 'text-purple-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        حركات التالف والمرتجع للموردين
                      </span>
                    </div>
                  </div>
                  <ChevronLeft className={`h-3.5 w-3.5 transition ${activeTab === 'audit-damage' ? 'text-white' : 'text-purple-400 dark:text-purple-600'}`} />
                </button>
              )}

              {/* زر الإعدادات العامة للمتجر والسحابة أسفل التقارير في قائمة البرغر */}
              <button
                type="button"
                id="drawerSettingsBtn"
                onClick={() => {
                  setIsMenuOpen(false);
                  setIsSettingsOpen(true);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-150 text-right group cursor-pointer text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:text-emerald-700 dark:hover:text-emerald-400 active:scale-[0.99]"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-950 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition shrink-0">
                    <Settings className="h-4 w-4" />
                  </div>
                  <div className="flex flex-col text-right">
                    <span className="text-xs sm:text-sm font-bold leading-tight">الإعدادات العامة</span>
                    <span className="text-[10px] font-normal leading-tight mt-0.5 text-slate-400 dark:text-slate-500">
                      بيانات المحل، الطابعة، والمزامنة السحابية
                    </span>
                  </div>
                </div>
                <ChevronLeft className="h-4 w-4 text-slate-400 dark:text-slate-600 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition" />
              </button>

              {/* أدوات سريعة وإضافية */}
              <div className="pt-2.5 mt-2 border-t border-slate-200 dark:border-slate-800 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 block mb-0.5">أدوات مساعدة:</span>

                {onOpenCashDrawer && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenCashDrawer();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Scale className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>جرد الصندوق وكشف العجز/الفائض</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}

                {onOpenBarcodeStudio && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenBarcodeStudio();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-emerald-700 dark:hover:text-emerald-400 transition text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Barcode className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>طباعة الباركود</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}

                {onOpenZReport && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenZReport();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 transition text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      <span>تقرير Z اليومي</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}

                {onOpenScannerTest && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenScannerTest();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-amber-600 dark:hover:text-amber-400 transition text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span>فحص قارئ الباركود</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}

                {onOpenOfflineQueue && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false);
                      onOpenOfflineQueue();
                    }}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-sky-600 dark:hover:text-sky-400 transition text-xs font-bold text-right cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Cloud className="h-3.5 w-3.5 text-sky-500" />
                      <span>طابور المزامنة</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                )}

                {/* زر تثبيت التطبيق على الجهاز (PWA) — يظهر فقط عندما يدعم المتصفح التثبيت */}
                {installPromptEvent && (
                  <button
                    type="button"
                    onClick={handleInstallApp}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition text-xs font-bold text-right cursor-pointer border border-emerald-200 dark:border-emerald-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <Smartphone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>تثبيت التطبيق على الجهاز</span>
                    </div>
                    <ChevronLeft className="h-3.5 w-3.5 text-emerald-400" />
                  </button>
                )}

                {/* روابط إدارة الفروع والمستخدمين للمدير */}
                {isAdmin && (
                  <>
                    <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-slate-800/60">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 px-2 block mb-1">إدارة المنظومة:</span>
                    </div>

                    {onOpenBranches && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenBranches();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition text-xs font-bold text-right cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="h-3.5 w-3.5 text-blue-500" />
                          <span>إدارة الفروع (Multi-Branch)</span>
                        </div>
                        <ChevronLeft className="h-3.5 w-3.5 text-blue-400" />
                      </button>
                    )}

                    {onOpenUsers && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onOpenUsers();
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition text-xs font-bold text-right cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="h-3.5 w-3.5 text-emerald-500" />
                          <span>إدارة المستخدمين والصلاحيات</span>
                        </div>
                        <ChevronLeft className="h-3.5 w-3.5 text-emerald-400" />
                      </button>
                    )}
                  </>
                )}
              </div>
            </nav>

            {/* Drawer Footer */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                <span className={`text-[11px] font-bold ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                  {isOnline ? 'نشط' : 'غير نشط'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onLockApp();
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-slate-800 rounded-lg transition text-xs font-bold border border-amber-300 dark:border-amber-400/20 active:scale-95 cursor-pointer"
                title="قفل الشاشة"
              >
                <Lock className="h-3.5 w-3.5" />
                <span>قفل</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* مودال إعدادات المتجر والسحابة الموحدة (Unified Store & Cloud Settings Modal) */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-4 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">إعدادات المتجر والمزامنة السحابية</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="p-4 space-y-4 overflow-y-auto text-xs">
              {saveSuccessMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2 font-bold animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>تم حفظ الإعدادات وتحديث النظام بنجاح!</span>
                </div>
              )}

              {/* مظهر النظام والمود */}
              <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Sun className="h-4 w-4 text-amber-500" />
                  مظهر النظام (المود النهاري / الليلي)
                </h4>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      localSettings.theme === 'light'
                        ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-xs ring-2 ring-amber-400/20'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Sun className="h-4 w-4 text-amber-500" />
                    <span>نهاري (أبيض)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                      localSettings.theme !== 'light'
                        ? 'bg-indigo-600 text-white border-indigo-500 font-black shadow-xs ring-2 ring-indigo-500/20'
                        : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <Moon className="h-4 w-4 text-indigo-400" />
                    <span>ليلي (داكن)</span>
                  </button>
                </div>
              </div>

              {/* معلومات المحل */}
              <div className="space-y-2.5">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Store className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  بيانات المتجر والفاتورة
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">اسم المحل / المتجر:</label>
                    <input
                      type="text"
                      value={localSettings.storeName}
                      onChange={(e) => setLocalSettings({ ...localSettings, storeName: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">هاتف التواصل:</label>
                    <input
                      type="text"
                      value={localSettings.storePhone}
                      onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">الرقم الضريبي (ZATCA):</label>
                    <input
                      type="text"
                      value={localSettings.storeVatNumber || ''}
                      placeholder="300123456700003"
                      onChange={(e) => setLocalSettings({ ...localSettings, storeVatNumber: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">العملة:</label>
                    <input
                      type="text"
                      value={localSettings.currency}
                      onChange={(e) => setLocalSettings({ ...localSettings, currency: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">العنوان:</label>
                  <input
                    type="text"
                    value={localSettings.storeAddress}
                    onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">رسالة تذييل الفاتورة:</label>
                  <input
                    type="text"
                    value={localSettings.receiptFooterMessage}
                    onChange={(e) => setLocalSettings({ ...localSettings, receiptFooterMessage: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* إعدادات الطباعة السريعة وتجربة الكاشير */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Printer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  خيارات الطباعة السريعة والمعاينة
                </h4>
                <div className="space-y-2">
                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.autoPrintReceipt ?? false}
                      onChange={(e) => setLocalSettings({ ...localSettings, autoPrintReceipt: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">طباعة الإيصال آلياً فور إتمام الفاتورة (Auto Print)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">إرسال أمر الطباعة للطابعة الحرارية تلقائياً فورياً بدون انتظار</span>
                    </div>
                  </label>

                  <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.skipReceiptPreviewModal ?? false}
                      onChange={(e) => setLocalSettings({ ...localSettings, skipReceiptPreviewModal: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">تخطي نافذة المعاينة المنبثقة (بيع صاروخي بدون توقف)</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">عدم حجب الشاشة بالمعاينة مع بقاء شريط الفاتورة الأخيرة لمعاينتها متى رغبت</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* النسخ الاحتياطي اليدوي والتصدير / الاستيراد */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  النسخ الاحتياطي اليدوي وحفظ البيانات
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  تصدير ملف يحتوي على كامل المنتجات، الفواتير، العملاء، الموردين، والورديات بأمان.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleExportBackup}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold transition cursor-pointer active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تصدير ملف JSON</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                    className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>استيراد ملف JSON</span>
                  </button>
                  <input
                    ref={importFileInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportBackup}
                    className="hidden"
                  />
                </div>
              </div>

              {/* البريد الإلكتروني المخصص للنسخ الاحتياطي */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                  النسخ الاحتياطي التلقائي عبر البريد
                </h4>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">البريد الإلكتروني لاستلام النسخ الاحتياطية:</label>
                  <input
                    type="email"
                    value={localSettings.backupEmail || ''}
                    placeholder="market@example.com"
                    onChange={(e) => setLocalSettings({ ...localSettings, backupEmail: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* النسخ الاحتياطي وتصدير البيانات (CSV) — يدوي + تلقائي مجدول */}
              <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  النسخ الاحتياطي وتصدير البيانات (CSV)
                </h4>

                {/* نسخ يدوي */}
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] flex items-center gap-1.5">
                    <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    نسخ يدوي — تنزيل ملفات CSV منفصلة
                  </span>
                  <div className={csvRange === 'custom' ? 'grid grid-cols-1 sm:grid-cols-3 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
                    <div>
                      <label className="text-slate-600 dark:text-slate-400 block mb-1">نطاق التاريخ:</label>
                      <select
                        value={csvRange}
                        onChange={(e) => setCsvRange(e.target.value as 'today' | 'week' | 'month' | 'custom')}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="today">اليوم</option>
                        <option value="week">آخر أسبوع</option>
                        <option value="month">آخر شهر</option>
                        <option value="custom">مخصص</option>
                      </select>
                    </div>
                    {csvRange === 'custom' && (
                      <>
                        <div>
                          <label className="text-slate-600 dark:text-slate-400 block mb-1">من تاريخ:</label>
                          <input
                            type="date"
                            value={csvDateFrom}
                            onChange={(e) => setCsvDateFrom(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-slate-600 dark:text-slate-400 block mb-1">إلى تاريخ:</label>
                          <input
                            type="date"
                            value={csvDateTo}
                            onChange={(e) => setCsvDateTo(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">الأقسام المطلوب تصديرها:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BACKUP_SECTIONS.map((opt) => (
                        <label key={opt.key} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={csvSections.includes(opt.key)}
                            onChange={() => toggleCsvSection(opt.key)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0"
                          />
                          <span className="font-bold">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadCsvBackup}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-950/20 transition cursor-pointer active:scale-95"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>تنزيل نسخة الآن</span>
                  </button>
                  {csvMsg && (
                    <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{csvMsg}</p>
                  )}
                </div>

                {/* نسخ تلقائي مجدول */}
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={localSettings.autoBackupEnabled ?? false}
                      onChange={(e) => setLocalSettings({ ...localSettings, autoBackupEnabled: e.target.checked })}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-slate-800 dark:text-slate-200 block">تفعيل النسخ التلقائي المجدول</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">فحص محلي عند فتح التطبيق — عند الاستحقاق تُنزَّل الملفات تلقائياً</span>
                    </div>
                  </label>

                  {/* توضيح حدود الميزة (المسار أ بدون خادم) */}
                  <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg p-2 flex items-start gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>الإرسال حاليًا تنزيل محلي + فتح البريد بملخص نصي دون مرفقات تلقائية — الإرفاق الفعلي يتطلب ربط خدمة بريد خارجية لاحقًا.</span>
                  </p>

                  {(localSettings.autoBackupEnabled ?? false) && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-slate-600 dark:text-slate-400 block mb-1">تكرار النسخة:</label>
                          <select
                            value={localSettings.autoBackupFrequency || 'weekly'}
                            onChange={(e) => setLocalSettings({ ...localSettings, autoBackupFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                          >
                            <option value="daily">يومي</option>
                            <option value="weekly">أسبوعي</option>
                            <option value="monthly">شهري</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-slate-600 dark:text-slate-400 block mb-1">البريد المستلم للملخص:</label>
                          <input
                            type="email"
                            value={localSettings.backupEmail || ''}
                            placeholder="market@example.com"
                            onChange={(e) => setLocalSettings({ ...localSettings, backupEmail: e.target.value })}
                            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-slate-600 dark:text-slate-400 block mb-1">أقسام النسخة التلقائية:</label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {BACKUP_SECTIONS.map((opt) => (
                            <label key={`auto-${opt.key}`} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={(localSettings.autoBackupSections || ['all']).includes(opt.key)}
                                onChange={() => toggleAutoBackupSection(opt.key)}
                                className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0"
                              />
                              <span className="font-bold">{opt.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* إعدادات السحابة والمزامنة */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  اتصال Supabase السحابي
                </h4>
                <div className="space-y-2">
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">رابط المشروع (Supabase URL):</label>
                    <input
                      type="text"
                      value={localSettings.supabaseUrl || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, supabaseUrl: e.target.value })}
                      placeholder="https://xyzcompany.supabase.co"
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">مفتاح الوصول (Anon Key):</label>
                    <input
                      type="password"
                      value={localSettings.supabaseAnonKey || ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, supabaseAnonKey: e.target.value })}
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSqlModalOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95"
                  >
                    <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>عرض ونسخ كود SQL لـ Supabase</span>
                  </button>
                </div>
              </div>

              {/* إدارة الفروع والمستخدمين في الإعدادات */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  المستخدمون والفروع (Multi-Branch)
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {isAdmin && onOpenBranches && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenBranches();
                      }}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition border border-blue-200 dark:border-blue-800 cursor-pointer active:scale-95"
                    >
                      <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      <span>إدارة الفروع</span>
                    </button>
                  )}
                  {isAdmin && onOpenUsers && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsSettingsOpen(false);
                        onOpenUsers();
                      }}
                      className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition border border-emerald-200 dark:border-emerald-800 cursor-pointer active:scale-95"
                    >
                      <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>إدارة المستخدمين</span>
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsOpen(false);
                    onOpenChangePassword();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold transition border border-amber-200 dark:border-amber-800 cursor-pointer active:scale-95"
                >
                  <KeyRound className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  <span>تغيير كلمة المرور الخاصة بحسابي ({currentUser?.name || 'أحمد'})</span>
                </button>
              </div>

              {/* زر الحفظ */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 font-bold text-white shadow-md active:scale-[0.99] transition cursor-pointer"
                >
                  <Save className="h-4 w-4" />
                  <span>حفظ التغييرات</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال عرض ونسخ كود SQL الخاص بسوبابيز */}
      {isSqlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">كود SQL لإنشاء جداول قاعدة بيانات Supabase</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSqlModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 leading-relaxed">
                <strong>طريقة الاستخدام:</strong> انسخ الكود أدناه والصقه في{' '}
                <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">Supabase Dashboard → SQL Editor → New Query → Run</span>
                {' '}ليتم إنشاء وتجهيز جميع الجداول مع تفعيل المزامنة اللحظية (Realtime).
              </div>

              <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-[380px] leading-normal" dir="ltr">
                <button
                  type="button"
                  onClick={() => {
                    const sql = document.getElementById('supabase-sql-code-block')?.innerText || '';
                    navigator.clipboard.writeText(sql);
                    setIsCopiedSql(true);
                    setTimeout(() => setIsCopiedSql(false), 2000);
                  }}
                  className="sticky top-0 float-right mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-['Cairo'] text-xs shadow-md transition cursor-pointer"
                >
                  {isCopiedSql ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>تم النسخ بنجاح!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>نسخ الكود بالكامل</span>
                    </>
                  )}
                </button>
                <pre id="supabase-sql-code-block" className="whitespace-pre font-mono text-emerald-400">
{`-- 1. إنشاء الجداول الأساسية
CREATE TABLE IF NOT EXISTS public.products (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.sales (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.returns (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.customers (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.debt_transactions (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.store_settings (id TEXT PRIMARY KEY DEFAULT 'main_store_config', updated_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.suppliers (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.branches (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());
CREATE TABLE IF NOT EXISTS public.app_users (id TEXT PRIMARY KEY, created_at TIMESTAMPTZ DEFAULT NOW());

-- 2. إضافة جميع الأعمدة تلقائياً لضمان عدم حدوث خطأ column does not exist
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_main BOOLEAN DEFAULT false;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'cashier';
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT true;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'عام';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity_alert NUMERIC(12, 2) DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'حبة';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS net_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_profit NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_tendered NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS change_due NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS quantity_sold NUMERIC(12, 2) DEFAULT 1;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS profit NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS return_number TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS original_invoice_number TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 1;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_unit_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS custom_reason_text TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS action_taken TEXT DEFAULT 'restock';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS current_debt NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';

ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_phone TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_address TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_vat_number TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ريال';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS backup_email TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS receipt_footer_message TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS security_pin TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS cashiers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS active_cashier TEXT;

ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. فهارس السرعة
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON public.sales (invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debt_customer_id ON public.debt_transactions (customer_id);

-- 4. سياسات الأمان RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access Products" ON public.products;
DROP POLICY IF EXISTS "Public Access Sales" ON public.sales;
DROP POLICY IF EXISTS "Public Access Returns" ON public.returns;
DROP POLICY IF EXISTS "Public Access Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Access Debt" ON public.debt_transactions;
DROP POLICY IF EXISTS "Public Access Settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public Access Suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public Access Branches" ON public.branches;
DROP POLICY IF EXISTS "Public Access App Users" ON public.app_users;

CREATE POLICY "Public Access Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Debt" ON public.debt_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Branches" ON public.branches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access App Users" ON public.app_users FOR ALL USING (true) WITH CHECK (true);

-- 5. تفعيل Realtime المباشر
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.products, 
            public.sales, 
            public.returns, 
            public.customers, 
            public.debt_transactions, 
            public.store_settings,
            public.suppliers,
            public.branches,
            public.app_users;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;`}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsSqlModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
