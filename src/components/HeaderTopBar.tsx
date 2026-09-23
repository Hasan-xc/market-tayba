import {
  Menu,
  X,
  ShoppingCart,
  Building2,
  ChevronDown,
  Check,
  User,
  KeyRound,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { StoreSettings, UserAccount, Branch } from '../types';

interface HeaderTopBarProps {
  settings: StoreSettings;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
  isOnline: boolean;
  isAdmin: boolean;
  branches: Branch[];
  activeBranchId: string;
  activeBranch: { id: string; name: string };
  isBranchDropdownOpen: boolean;
  setIsBranchDropdownOpen: (open: boolean) => void;
  handleSwitchBranch: (bId: string) => void;
  currentUser: UserAccount | null;
  isUserMenuOpen: boolean;
  setIsUserMenuOpen: (open: boolean) => void;
  onOpenLogin: () => void;
  onOpenChangePassword: () => void;
  onOpenUsers?: () => void;
  onOpenBranches?: () => void;
  onLogout: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const HeaderTopBar = ({
  settings,
  isMenuOpen,
  setIsMenuOpen,
  isOnline,
  isAdmin,
  branches,
  activeBranchId,
  activeBranch,
  isBranchDropdownOpen,
  setIsBranchDropdownOpen,
  handleSwitchBranch,
  currentUser,
  isUserMenuOpen,
  setIsUserMenuOpen,
  onOpenLogin,
  onOpenChangePassword,
  onOpenUsers,
  onOpenBranches,
  onLogout,
  activeTab,
  onTabChange,
}: HeaderTopBarProps) => {
  return (
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
  );
};
