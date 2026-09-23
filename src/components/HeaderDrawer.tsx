import {
  X,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  KeyRound,
  LogOut,
  ChevronLeft,
  Settings,
  PackageMinus,
  Scale,
  Barcode,
  FileText,
  Zap,
  Cloud,
  Smartphone,
  Building2,
  Users,
  Lock,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { StoreSettings, UserAccount } from '../types';

interface NavItem {
  id: string;
  label: string;
  subtitle: string;
  icon: ComponentType<{ className?: string }>;
  countBadge?: number;
}

interface HeaderDrawerProps {
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  settings: StoreSettings;
  toggleSound: () => void;
  toggleTheme: (targetTheme?: 'dark' | 'light') => void;
  currentUser: UserAccount | null;
  isAdmin: boolean;
  activeBranch: { id: string; name: string };
  navItems: NavItem[];
  activeTab: string;
  handleNavClick: (tabId: string) => void;
  isOnline: boolean;
  onLockApp: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  onOpenCashDrawer?: () => void;
  onOpenBarcodeStudio?: () => void;
  onOpenZReport?: () => void;
  onOpenScannerTest?: () => void;
  onOpenOfflineQueue?: () => void;
  canInstall: boolean;
  handleInstallApp: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  onOpenBranches?: () => void;
  onOpenUsers?: () => void;
}

export const HeaderDrawer = ({
  isMenuOpen,
  setIsMenuOpen,
  settings,
  toggleSound,
  toggleTheme,
  currentUser,
  isAdmin,
  activeBranch,
  navItems,
  activeTab,
  handleNavClick,
  isOnline,
  onLockApp,
  onOpenChangePassword,
  onLogout,
  onOpenCashDrawer,
  onOpenBarcodeStudio,
  onOpenZReport,
  onOpenScannerTest,
  onOpenOfflineQueue,
  canInstall,
  handleInstallApp,
  setIsSettingsOpen,
  onOpenBranches,
  onOpenUsers,
}: HeaderDrawerProps) => {
  if (!isMenuOpen) return null;

  return (
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
            <div className="flex h-12 w-12 items-center justify-center rounded-xl overflow-hidden border border-emerald-500/20 shadow-xs bg-white dark:bg-slate-800 shrink-0">
              <img
                src="./icons/icon-192.png"
                alt="لوجو المتجر"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                  (e.currentTarget.parentElement as HTMLElement).classList.add('bg-emerald-600/15', 'dark:bg-emerald-600/25');
                }}
              />
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
            {canInstall && (
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
  );
};
