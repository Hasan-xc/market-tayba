import { useState, useEffect, type FormEvent } from 'react';
import { 
  Coins, 
  X, 
  Play, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  User, 
  Banknote, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  Printer, 
  TrendingUp, 
  TrendingDown,
  Scale
} from 'lucide-react';
import { CashDrawerShift, StoreSettings } from '../types';
import { dbService } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const CashDrawerModal = ({ isOpen, onClose, settings, showToast }: Props) => {
  const [currentShift, setCurrentShift] = useState<CashDrawerShift | null>(null);
  const [shiftsHistory, setShiftsHistory] = useState<CashDrawerShift[]>([]);
  const [activeTab, setActiveTab] = useState<'current' | 'history'>('current');

  // فورم فتح وردية جديدة
  const [openCashierName, setOpenCashierName] = useState(settings.activeCashier || 'الكاشير');
  const [openStartingCash, setOpenStartingCash] = useState('200');
  const [openNotes, setOpenNotes] = useState('');

  // فورم إغلاق الوردية وجرد الدرج
  const [countedCash, setCountedCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  // تحديث البيانات
  const refreshShiftData = () => {
    const active = dbService.getCurrentShift();
    setCurrentShift(active);
    setShiftsHistory(dbService.getShifts());
    if (active) {
      setCountedCash('');
      setCloseNotes('');
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshShiftData();
      setOpenCashierName(settings.activeCashier || 'الكاشير');
    }
  }, [isOpen, settings.activeCashier]);

  if (!isOpen) return null;

  // الحسابات المباشرة للوردية المفتوحة حالياً
  const liveBreakdown = currentShift
    ? dbService.calculateShiftExpectedCash(currentShift.openedAt, currentShift.startingCash)
    : null;

  const enteredCashNum = countedCash ? parseFloat(countedCash) : null;
  const difference = liveBreakdown && enteredCashNum !== null 
    ? Number((enteredCashNum - liveBreakdown.totalExpectedCash).toFixed(2)) 
    : null;

  // التعامل مع فتح وردية جديدة
  const handleOpenShift = (e: FormEvent) => {
    e.preventDefault();
    const startingNum = parseFloat(openStartingCash) || 0;
    try {
      const shift = dbService.openShift(openCashierName, startingNum, openNotes);
      setCurrentShift(shift);
      refreshShiftData();
      showToast(`تم فتح وردية جديدة للكاشير (${shift.cashierName}) برصيد ${shift.startingCash} ${settings.currency}`, 'success');
    } catch (err: any) {
      showToast('تعذر فتح الوردية: ' + (err?.message || err), 'error');
    }
  };

  // التعامل مع إغلاق الوردية وكشف الفوارق
  const handleCloseShift = (e: FormEvent) => {
    e.preventDefault();
    if (!currentShift) return;
    if (enteredCashNum === null || isNaN(enteredCashNum)) {
      showToast('يرجى إدخال المبلغ الفعلي الموجود بالدرج بعد العد', 'error');
      return;
    }

    setIsClosing(true);
    try {
      const closed = dbService.closeShift(currentShift.id, enteredCashNum, closeNotes);
      refreshShiftData();
      setIsClosing(false);

      if (closed.difference === 0) {
        showToast('تم إغلاق الوردية: الصندوق متطابق 100% بدون أي عجز أو فائض!', 'success');
      } else if ((closed.difference || 0) > 0) {
        showToast(`تم إغلاق الوردية: يوجد فائض بالدرج بقيمة +${closed.difference} ${settings.currency}`, 'info');
      } else {
        showToast(`تم إغلاق الوردية: يوجد عجز بالدرج بقيمة ${closed.difference} ${settings.currency}`, 'warn');
      }
    } catch (err: any) {
      setIsClosing(false);
      showToast('تعذر إغلاق الوردية: ' + (err?.message || err), 'error');
    }
  };

  // طباعة تقرير الوردية
  const handlePrintShift = (shift: CashDrawerShift) => {
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) {
      showToast('يرجى السماح بالنوافذ المنبثقة لطباعة التقرير', 'warn');
      return;
    }

    const openDate = new Date(shift.openedAt).toLocaleString('ar-SA');
    const closeDate = shift.closedAt ? new Date(shift.closedAt).toLocaleString('ar-SA') : 'ما زالت مفتوحة';
    const diff = shift.difference ?? 0;
    const diffText = diff === 0 
      ? 'متطابق تماماً (0.00)' 
      : diff > 0 
      ? `فائض (+${diff} ${settings.currency})` 
      : `عجز (${diff} ${settings.currency})`;

    const html = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>تقرير استلام وتسليم الوردية - ${settings.storeName}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 15px; font-size: 13px; color: #111; }
          .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 12px; }
          .title { font-size: 16px; font-weight: bold; margin-bottom: 4px; }
          .store { font-size: 14px; color: #333; margin-bottom: 4px; }
          .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #ccc; }
          .row.total { font-weight: bold; border-top: 1px solid #000; border-bottom: 1px solid #000; font-size: 14px; margin-top: 6px; padding: 6px 0; }
          .diff-box { margin-top: 10px; padding: 8px; border: 2px solid #000; text-align: center; font-size: 14px; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #555; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="store">${settings.storeName}</div>
          <div class="title">تقرير جرد الصندوق والوردية</div>
          <div>الكاشير: ${shift.cashierName}</div>
        </div>

        <div class="row"><span>وقت الفتح:</span><span>${openDate}</span></div>
        <div class="row"><span>وقت الإغلاق:</span><span>${closeDate}</span></div>
        <div class="row"><span>الرصيد الافتتاحي:</span><span>${shift.breakdown.startingCash.toFixed(2)} ${settings.currency}</span></div>
        <div class="row"><span>مبيعات نقدي:</span><span>+${shift.breakdown.cashSales.toFixed(2)} ${settings.currency}</span></div>
        <div class="row"><span>سداد ديون نقدي:</span><span>+${shift.breakdown.debtCollectedCash.toFixed(2)} ${settings.currency}</span></div>
        <div class="row"><span>مرتجعات نقدي:</span><span>-${shift.breakdown.cashReturns.toFixed(2)} ${settings.currency}</span></div>
        
        <div class="row total">
          <span>إجمالي النقد المتوقع بالدرج:</span>
          <span>${shift.expectedCash.toFixed(2)} ${settings.currency}</span>
        </div>

        ${shift.actualCashCounted !== undefined ? `
          <div class="row" style="font-weight: bold; font-size: 14px; margin-top: 4px;">
            <span>المبلغ الفعلي المعدود بالدرج:</span>
            <span>${shift.actualCashCounted.toFixed(2)} ${settings.currency}</span>
          </div>
          <div class="diff-box">
            حالة المطابقة: ${diffText}
          </div>
        ` : ''}

        ${shift.notes ? `<div style="margin-top: 8px; font-size: 11px;">ملاحظات: ${shift.notes}</div>` : ''}

        <div class="footer">
          <div>توقيع الكاشير: ........................</div>
          <div style="margin-top: 10px;">نظام ماركت طيبه لإدارة نقاط البيع</div>
        </div>
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Scale className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">كشف الصندوق والورديات (فحص العجز والفائض)</h3>
              <p className="text-[11px] text-slate-400">مطابقة النقد الفعلي في الدرج مع الحركات المحسوبة آلياً</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-1.5 shrink-0 gap-1 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('current')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'current'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <Coins className="h-3.5 w-3.5" />
            <span>الوردية الحالية والجرد اللحظي</span>
            {currentShift && (
              <span className="h-2 w-2 rounded-full bg-emerald-300 animate-pulse" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold transition cursor-pointer ${
              activeTab === 'history'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>سجل الورديات السابقة ({shiftsHistory.filter((s) => s.status === 'closed').length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'current' ? (
            currentShift && liveBreakdown ? (
              /* شاشة الوردية المفتوحة والجرد */
              <div className="space-y-4">
                {/* بطاقة رأس الوردية */}
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-600 text-white">
                        <CheckCircle2 className="h-3 w-3" />
                        الوردية نشطة ومفتوحة
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        الكاشير: {currentShift.cashierName}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      بدأت: {new Date(currentShift.openedAt).toLocaleString('ar-SA')}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePrintShift(currentShift)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold transition cursor-pointer text-xs shrink-0 self-start sm:self-auto"
                  >
                    <Printer className="h-3.5 w-3.5 text-emerald-600" />
                    <span>طباعة مسودة جرد</span>
                  </button>
                </div>

                {/* تفاصيل التدفق النقدي بالدرج */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block">الرصيد الافتتاحي:</span>
                    <span className="font-mono font-black text-sm text-slate-800 dark:text-slate-100">
                      {liveBreakdown.startingCash.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 mr-0.5">{settings.currency}</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block">مبيعات كاش:</span>
                    <span className="font-mono font-black text-sm text-emerald-600 dark:text-emerald-400">
                      +{liveBreakdown.cashSales.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 mr-0.5">{settings.currency}</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block">سداد ديون كاش:</span>
                    <span className="font-mono font-black text-sm text-sky-600 dark:text-sky-400">
                      +{liveBreakdown.debtCollectedCash.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 mr-0.5">{settings.currency}</span>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-2.5">
                    <span className="text-slate-500 dark:text-slate-400 text-[10px] block">مرتجعات كاش:</span>
                    <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                      -{liveBreakdown.cashReturns.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-400 mr-0.5">{settings.currency}</span>
                  </div>
                </div>

                {/* المبلغ النقدي المتوقع بالدرج */}
                <div className="rounded-2xl border-2 border-slate-900 dark:border-slate-700 bg-slate-950 p-3.5 text-white flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-400 block font-bold">النقد المتوقع والمحسوب بالدرج حالياً:</span>
                    <span className="text-[11px] text-slate-500">
                      (الافتتاحي + المبيعات + سداد الديون - المرتجعات)
                    </span>
                  </div>
                  <div className="text-left">
                    <span className="font-mono font-black text-2xl text-emerald-400">
                      {liveBreakdown.totalExpectedCash.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 mr-1">{settings.currency}</span>
                  </div>
                </div>

                {/* فورم إغلاق الوردية وكشف العجز أو الفائض */}
                <form onSubmit={handleCloseShift} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white text-xs">
                    <Scale className="h-4 w-4 text-amber-500" />
                    <span>إغلاق الوردية وتسليم الصندوق (جرد الدرج):</span>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                      المبلغ الفعلي الموجود بالدرج بعد العد والفرز اليدوي:
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        required
                        placeholder="أدخل إجمالي النقد الذي عددته بالدرج..."
                        value={countedCash}
                        onChange={(e) => setCountedCash(e.target.value)}
                        className="w-full rounded-xl border-2 border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pr-3 pl-14 font-mono font-black text-xl text-slate-900 dark:text-white focus:border-emerald-600 focus:bg-white dark:focus:bg-slate-800 focus:outline-none"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs pointer-events-none">
                        {settings.currency}
                      </span>
                    </div>
                  </div>

                  {/* بطاقة كشف الفارق التفاعلية الفورية */}
                  {difference !== null && (
                    <div className="animate-fade-in">
                      {difference === 0 ? (
                        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 flex items-center gap-2 font-bold">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div>
                            <div>الصندوق متطابق تماماً بنسبة 100%!</div>
                            <div className="text-[11px] font-normal">لا يوجد أي عجز أو فائض بين المحسوب والفعلي (0.00).</div>
                          </div>
                        </div>
                      ) : difference > 0 ? (
                        <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300 flex items-center gap-2 font-bold">
                          <TrendingUp className="h-5 w-5 text-sky-600 shrink-0" />
                          <div>
                            <div>يوجد فائض في الصندوق بقيمة: +{difference.toFixed(2)} {settings.currency}</div>
                            <div className="text-[11px] font-normal">المبلغ المعدود بالدرج أكبر من المبيعات المسجلة.</div>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 flex items-center gap-2 font-bold">
                          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
                          <div>
                            <div>يوجد عجز في الصندوق بقيمة: {difference.toFixed(2)} {settings.currency}</div>
                            <div className="text-[11px] font-normal">المبلغ الفعلي أقل من المتوقع، يرجى مراجعة الفواتير أو الصرفيات.</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">ملاحظات الإغلاق والتسليم (اختياري):</label>
                    <input
                      type="text"
                      placeholder="مثال: تم تسليم العهدة لوردية المساء..."
                      value={closeNotes}
                      onChange={(e) => setCloseNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white text-xs focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isClosing}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-98"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>تأكيد إغلاق الوردية واعتماد التقرير المالي</span>
                  </button>
                </form>
              </div>
            ) : (
              /* شاشة فتح وردية جديدة في حال عدم وجود وردية نشطة */
              <div className="space-y-4 py-3">
                <div className="text-center space-y-1">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-300 dark:border-amber-800/50">
                    <Coins className="h-6 w-6" />
                  </div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">لا توجد وردية مفتوحة حالياً</h4>
                  <p className="text-slate-500 dark:text-slate-400 text-xs max-w-sm mx-auto">
                    لبدء تتبع النقدية وفحص العجز والفائض بدقة، افتح وردية جديدة للكاشير وسجل المبلغ الافتتاحي (الفكة/الصرف) الموجود بالدرج.
                  </p>
                </div>

                <form onSubmit={handleOpenShift} className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 space-y-3 max-w-md mx-auto">
                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">اسم الكاشير المستلم:</label>
                    <input
                      type="text"
                      required
                      value={openCashierName}
                      onChange={(e) => setOpenCashierName(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 font-bold mb-1">
                      الرصيد الافتتاحي بالصندوق (الفكة المبدئية):
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        required
                        value={openStartingCash}
                        onChange={(e) => setOpenStartingCash(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 pr-3 pl-12 font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs pointer-events-none">
                        {settings.currency}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 dark:text-slate-400 mb-1">ملاحظات بداية الوردية (اختياري):</label>
                    <input
                      type="text"
                      placeholder="مثال: استلام وردية الصباح..."
                      value={openNotes}
                      onChange={(e) => setOpenNotes(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-600"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition cursor-pointer active:scale-98"
                  >
                    <Play className="h-4 w-4 fill-current" />
                    <span>فتح الوردية وبدء الدرج الآن</span>
                  </button>
                </form>
              </div>
            )
          ) : (
            /* سجل الورديات السابقة */
            <div className="space-y-3">
              {shiftsHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  لا يوجد سجل ورديات سابقة حتى الآن
                </div>
              ) : (
                shiftsHistory.map((shift) => {
                  const isClosed = shift.status === 'closed';
                  const diff = shift.difference ?? 0;

                  return (
                    <div
                      key={shift.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                          <span>وردية: {shift.cashierName}</span>
                          {isClosed ? (
                            diff === 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                                مطابق تماماً (0.00)
                              </span>
                            ) : diff > 0 ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 dark:bg-sky-950/60 text-sky-700 dark:text-sky-400">
                                فائض (+{diff} {settings.currency})
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                                عجز ({diff} {settings.currency})
                              </span>
                            )
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 animate-pulse">
                              ما زالت نشطة
                            </span>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                          <span>الفتح: {new Date(shift.openedAt).toLocaleTimeString('ar-SA')}</span>
                          {shift.closedAt && (
                            <>
                              <span>•</span>
                              <span>الإغلاق: {new Date(shift.closedAt).toLocaleTimeString('ar-SA')}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>المتوقع: {shift.expectedCash.toFixed(2)} {settings.currency}</span>
                          {shift.actualCashCounted !== undefined && (
                            <>
                              <span>•</span>
                              <span>الفعلي: {shift.actualCashCounted.toFixed(2)} {settings.currency}</span>
                            </>
                          )}
                        </div>

                        {shift.notes && (
                          <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            ملاحظة: {shift.notes}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePrintShift(shift)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold transition cursor-pointer text-[11px] self-end sm:self-auto shrink-0"
                      >
                        <Printer className="h-3 w-3 text-emerald-600" />
                        <span>طباعة التقرير</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
