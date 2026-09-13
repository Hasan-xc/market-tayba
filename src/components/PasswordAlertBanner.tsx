import { ShieldAlert, KeyRound, ArrowLeft, X } from 'lucide-react';
import { UserAccount } from '../types';

interface Props {
  user: UserAccount | null;
  onOpenChangePassword: () => void;
  onDismiss: () => void;
}

export const PasswordAlertBanner = ({ user, onOpenChangePassword, onDismiss }: Props) => {
  if (!user || !user.mustChangePassword) return null;

  return (
    <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-orange-500 text-white shadow-md font-['Cairo',sans-serif] px-4 py-2.5 transition-all animate-fade-in select-none">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2.5 text-right w-full sm:w-auto">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-xs text-white">
            <ShieldAlert className="h-4 w-4 animate-bounce" />
          </div>
          <div className="text-xs sm:text-sm">
            <span className="font-black underline decoration-white/40">تنبيه أمان هام:</span> حسابك (<span className="font-bold">{user.name}</span>) يستخدم كلمة المرور الافتراضية (<code className="font-mono bg-black/20 px-1.5 py-0.5 rounded font-bold">12345</code>). يُرجى تغييرها لحماية بيانات المتجر والمخزون.
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end shrink-0">
          <button
            type="button"
            onClick={onOpenChangePassword}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-amber-900 hover:bg-amber-50 font-black text-xs shadow-sm transition active:scale-95 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5 text-amber-700" />
            <span>تغيير كلمة المرور الآن</span>
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-xl text-white/80 hover:text-white hover:bg-white/20 transition cursor-pointer"
            title="إخفاء التنبيه مؤقتاً"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
