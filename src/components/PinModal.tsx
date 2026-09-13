import { useRef, useState } from 'react';
import { Lock, Delete, ArrowRight, Shield } from 'lucide-react';
import { StoreSettings } from '../types';
import { hashPin, isHashedValue } from '../utils/crypto';

interface Props {
  isOpen: boolean;
  onUnlock: () => void;
  settings: StoreSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn') => void;
}

export const PinModal = ({ isOpen, onUnlock, settings, showToast }: Props) => {
  const [pin, setPin] = useState('');
  // قفل أثناء التحقق غير المتزامن حتى لا تتراكم ضغطات أثناء مقارنة الهاش
  const isCheckingRef = useRef(false);

  if (!isOpen) return null;

  const handleKeyPress = (digit: string) => {
    if (isCheckingRef.current) return;
    // تصميم ثابت 4 خانات (نفس السلوك الفعلي السابق: كانت المقارنة تفشل وتُمسح
    // عند الخانة الرابعة لأي رمز أطول، والنقاط في الواجهة 4 فقط)
    if (pin.length >= 4) return;

    const nextPin = pin + digit;
    setPin(nextPin);

    if (nextPin.length === 4) {
      isCheckingRef.current = true;
      void (async () => {
        const stored = settings.securityPin || '';
        // القيمة المخزنة بعد الترحيل هاش (64 hex). نُبقي مساراً انتقالياً للنص الصريح
        // يغطي: القيمة الفارغة (افتراضي 1234) ولحظة ما قبل انتهاء الترحيل.
        let isMatch: boolean;
        if (isHashedValue(stored)) {
          isMatch = (await hashPin(nextPin)) === stored;
        } else {
          isMatch = nextPin === (stored || '1234');
        }

        if (isMatch) {
          setTimeout(() => {
            onUnlock();
            setPin('');
            isCheckingRef.current = false;
          }, 150);
        } else {
          setTimeout(() => {
            showToast('رمز الدخول غير صحيح', 'error');
            setPin('');
            isCheckingRef.current = false;
          }, 300);
        }
      })();
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <div id="pinLockModal" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-xs rounded-3xl bg-slate-900 border border-slate-800 p-6 text-center text-white shadow-2xl space-y-5">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          <Lock className="h-7 w-7" />
        </div>

        <div>
          <h2 className="text-lg font-bold font-['Cairo'] text-white">نظام كاشير {settings.storeName}</h2>
          <p className="text-xs text-slate-400 mt-0.5">أدخل رمز الدخول (الافتراضي: 1234)</p>
        </div>

        {/* PIN Dots */}
        <div className="flex justify-center gap-3 py-2">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`h-4 w-4 rounded-full border-2 transition-all ${
                pin.length > idx
                  ? 'border-emerald-400 bg-emerald-400 scale-110 shadow-[0_0_10px_#34d399]'
                  : 'border-slate-700 bg-slate-800'
              }`}
            />
          ))}
        </div>

        {/* Number Keypad */}
        <div className="grid grid-cols-3 gap-2.5 font-mono text-lg font-bold">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="h-13 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700/60 text-white transition flex items-center justify-center"
            >
              {num}
            </button>
          ))}
          <button
            onClick={() => setPin('')}
            className="h-13 rounded-2xl bg-slate-800/40 hover:bg-slate-800 active:scale-95 text-slate-400 text-xs font-sans font-bold flex items-center justify-center"
          >
            مسح
          </button>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-13 rounded-2xl bg-slate-800/80 hover:bg-slate-700 active:scale-95 border border-slate-700/60 text-white transition flex items-center justify-center"
          >
            0
          </button>
          <button
            onClick={handleBackspace}
            className="h-13 rounded-2xl bg-slate-800/40 hover:bg-slate-800 active:scale-95 text-slate-400 flex items-center justify-center"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
