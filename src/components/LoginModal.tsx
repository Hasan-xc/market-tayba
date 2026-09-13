import { useState, type FormEvent } from 'react';
import { LogIn, User, Lock, Store, Eye, EyeOff, ShieldCheck, AlertCircle, Cloud, CloudOff } from 'lucide-react';
import { dbService } from '../services/db';
import { appLogin } from '../services/auth';
import { UserAccount } from '../types';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  showCloseBtn?: boolean;
}

export const LoginModal = ({ isOpen, onClose, onLoginSuccess, showCloseBtn = false }: Props) => {
  const [username, setUsername] = useState('ahmed');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cloudNote, setCloudNote] = useState<string | null>(null);

  const availableUsers = dbService.getUsers();
  const settings = dbService.getSettings();

  if (!isOpen) return null;

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setCloudNote(null);
    setIsLoading(true);

    setTimeout(async () => {
      const res = await appLogin(username, password);
      setIsLoading(false);
      if (res.success && res.user) {
        // ملاحظة أونلاين غير معطِّلة: JIT/جلسة/مشكلة كلمة مرور قصيرة
        if (res.cloud?.mode === 'jit') {
          setCloudNote('تم إنشاء حسابك السحابي تلقائياً (ترحيل JIT) وتفعيل جلستك.');
        } else if (res.cloud?.mode === 'signin' || res.cloud?.mode === 'already-exists') {
          setCloudNote('جلستك السحابية مفعّلة ومخزنة محلياً.');
        } else if (res.cloud?.reason === 'password-too-short') {
          setCloudNote('كلمة المرور أقصر من 6 خانات — الدخول المحلي يعمل، والترحيل السحابي بانتظار رفعها أو خفض الحد الأدنى.');
        } else if (res.cloud && res.cloud.mode === 'offline-only' && typeof navigator !== 'undefined' && !navigator.onLine) {
          setCloudNote('لا إنترنت — وضع أوفلاين كامل حتى تتصل الشبكة.');
        }
        onLoginSuccess(res.user);
        if (onClose) onClose();
      } else {
        setError(res.error || 'اسم المستخدم أو كلمة المرور غير صحيحة');
      }
    }, 200);
  };

  const selectQuickUser = (user: UserAccount) => {
    // كلمات المرور مخزنة كهاش — لا توجد كلمة حقيقية لملئها.
    // اختيار الحساب يملأ اسم المستخدم فقط، ويجب كتابة كلمة المرور يدوياً.
    setUsername(user.username);
    setPassword('');
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm font-['Cairo',sans-serif]" dir="rtl">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 overflow-hidden animate-fade-in">
        {/* Decorative Top Accent */}
        <div className="absolute top-0 right-0 left-0 h-2 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600" />

        {/* Header */}
        <div className="text-center mt-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-600/15 dark:bg-emerald-600/25 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner mb-3">
            <Store className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
            {settings.storeName || 'ماركت طيبه'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            تسجيل الدخول إلى نقطة البيع وإدارة المخزن
          </p>
        </div>

        {/* Quick User Chips for convenience */}
        {availableUsers.length > 0 && (
          <div className="mt-5 p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-2">
              حسابات الدخول السريعة (انقر للاختيار):
            </span>
            <div className="flex flex-wrap gap-1.5">
              {availableUsers.map((u) => {
                const isSelected = username.toLowerCase() === u.username.toLowerCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => selectQuickUser(u)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs font-black ring-2 ring-emerald-400/40'
                        : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600 hover:border-emerald-400'
                    }`}
                  >
                    <User className="w-3 h-3" />
                    <span>{u.name}</span>
                    <span className="text-[10px] opacity-75">({u.role === 'admin' ? 'مدير' : 'كاشير'})</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              اسم المستخدم (Username)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="مثال: ahmed"
                required
                autoFocus
                className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                كلمة المرور (Password)
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                الافتراضية: 12345
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                required
                className="w-full pr-10 pl-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl text-sm font-black text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition shadow-lg shadow-emerald-700/25 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4" />
              <span>{isLoading ? 'جاري التحقق...' : 'تسجيل الدخول'}</span>
            </button>
          </div>
        </form>

        <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>نظام تسجيل دخول آمن بالكامل</span>
          </div>
          {showCloseBtn && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 font-bold underline cursor-pointer"
            >
              إلغاء
            </button>
          )}
        </div>

        {cloudNote && (
          <div className="mt-3 p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-[11px] font-bold text-sky-700 dark:text-sky-300 flex items-start gap-2 leading-relaxed" dir="rtl">
            {cloudNote.includes('أوفلاين') ? <CloudOff className="w-4 h-4 shrink-0 mt-0.5" /> : <Cloud className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>{cloudNote}</span>
          </div>
        )}
      </div>
    </div>
  );
};
