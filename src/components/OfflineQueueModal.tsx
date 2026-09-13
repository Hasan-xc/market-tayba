import React, { useState } from 'react';
import { 
  Cloud, 
  CloudOff, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Receipt, 
  RotateCcw, 
  Users, 
  Database,
  ArrowRight
} from 'lucide-react';
import { SyncStatus, SaleTransaction, ReturnRecord, Customer, DebtTransaction } from '../types';
import { SupabaseService } from '../services/supabase';
import { dbService } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus;
  onSyncComplete?: () => void;
}

export const OfflineQueueModal: React.FC<Props> = ({
  isOpen,
  onClose,
  syncStatus,
  onSyncComplete,
}) => {
  const [isSyncingLocal, setIsSyncingLocal] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) return null;

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  const unsyncedCounts = dbService.getUnsyncedCounts();
  const sales = dbService.getSales().filter((s) => !s.isSynced);
  const returns = dbService.getReturns().filter((r) => !r.isSynced);
  const debts = dbService.getDebtTransactions().filter((d) => !d.isSynced);
  const offlineMutations = dbService.getOfflineQueue();

  const handleTriggerSync = async () => {
    setIsSyncingLocal(true);
    setSyncFeedback(null);
    try {
      if (!isOnline) {
        setSyncFeedback({
          success: false,
          message: 'الجهاز غير متصل بالإنترنت حالياً. سيتم حفظ العمليات محلياً ومزامنتها تلقائياً عند عودة الاتصال.',
        });
        setIsSyncingLocal(false);
        return;
      }

      const res = await SupabaseService.syncAll();
      setSyncFeedback({
        success: res.success,
        message: res.message,
      });
      if (onSyncComplete) onSyncComplete();
    } catch (e: any) {
      setSyncFeedback({
        success: false,
        message: 'فشلت المزامنة: ' + (e.message || 'خطأ غير معروف في الاتصال بالسحابة'),
      });
    } finally {
      setIsSyncingLocal(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              isOnline 
                ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
            }`}>
              {isOnline ? <Cloud className="h-5 w-5" /> : <CloudOff className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-white">إدارة طابور المزامنة والعمل أوفلاين (Offline Sync Queue)</h3>
              <p className="text-xs text-slate-400">مراقبة العمليات المحلية المعلقة ومزامنتها لحظياً مع Supabase</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Connection Status Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">حالة الاتصال بالشبكة:</span>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className={`h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
                <span className={isOnline ? 'text-emerald-400' : 'text-rose-400'}>
                  {isOnline ? 'متصل بالإنترنت 🟢' : 'غير متصل (أوفلاين) 🔴'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-between">
              <span className="text-xs text-slate-300">قاعدة بيانات Supabase:</span>
              <div className="flex items-center gap-2 text-xs font-bold">
                {syncStatus.isConfigured ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    مربوطة ومفعلة
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    غير مهيأة
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sync Result Feedback */}
          {syncFeedback && (
            <div className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              syncFeedback.success 
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            }`}>
              {syncFeedback.success ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              )}
              <span>{syncFeedback.message}</span>
            </div>
          )}

          {/* Summary Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Receipt className="h-3 w-3 text-sky-400" />
                فواتير معلقة
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {unsyncedCounts.unsyncedSales}
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <RotateCcw className="h-3 w-3 text-amber-400" />
                مرتجعات معلقة
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {unsyncedCounts.unsyncedReturns}
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Users className="h-3 w-3 text-emerald-400" />
                حركات ديون
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {unsyncedCounts.unsyncedDebt}
              </div>
            </div>

            <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/60 text-center">
              <div className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
                <Database className="h-3 w-3 text-purple-400" />
                طابور التعديلات
              </div>
              <div className="text-lg font-bold font-mono text-white mt-1">
                {unsyncedCounts.offlineQueueCount}
              </div>
            </div>
          </div>

          {/* Details List */}
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-300">العمليات المحلية المنتظرة للمزامنة:</div>
            
            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {sales.length === 0 && returns.length === 0 && debts.length === 0 && offlineMutations.length === 0 ? (
                <div className="text-center py-8 bg-slate-800/30 rounded-xl border border-dashed border-slate-700/60 text-xs text-slate-400">
                  <CheckCircle2 className="h-6 w-6 text-emerald-400 mx-auto mb-1.5" />
                  جميع البيانات متطابقة ومزامنة بنسبة 100% مع السحابة. لا توجد عمليات معلقة.
                </div>
              ) : (
                <>
                  {sales.map((s) => (
                    <div key={s.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 text-[10px] font-bold">فاتورة</span>
                        <span className="font-mono font-bold text-white">{s.invoiceNumber}</span>
                        <span className="text-slate-400">• {s.netTotal.toFixed(2)} TL</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                        بانتظار الرفع
                      </span>
                    </div>
                  ))}

                  {returns.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 text-[10px] font-bold">إرجاع</span>
                        <span className="font-mono font-bold text-white">{r.returnNumber}</span>
                        <span className="text-slate-400">• {r.refundTotal.toFixed(2)} TL</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                        بانتظار الرفع
                      </span>
                    </div>
                  ))}

                  {debts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-400 text-[10px] font-bold">دين/سداد</span>
                        <span className="font-bold text-white">{d.customerName}</span>
                        <span className="text-slate-400">• {d.amount.toFixed(2)} TL ({d.type === 'payment' ? 'سداد' : 'آجل'})</span>
                      </div>
                      <span className="text-[10px] text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/40">
                        بانتظار الرفع
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {syncStatus.lastSyncedAt ? (
              <span>آخر مزامنة ناجحة: {new Date(syncStatus.lastSyncedAt).toLocaleTimeString('ar-SA')}</span>
            ) : (
              <span>يتم الفحص والمزامنة التلقائية كل 20 ثانية</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
            >
              إغلاق
            </button>
            <button
              onClick={handleTriggerSync}
              disabled={isSyncingLocal || !isOnline}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncingLocal ? 'animate-spin' : ''}`} />
              <span>{isSyncingLocal ? 'جارٍ الرفع والمزامنة...' : 'مزامنة فورية الآن'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
