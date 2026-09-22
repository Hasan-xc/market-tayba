import React, { useState, useMemo, useEffect } from 'react';
import { X, Scale, Coins, Check, AlertCircle } from 'lucide-react';
import { Product } from '../types';
import { dbService } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  activeBranchId?: string;
  onConfirm: (quantity: number) => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

/**
 * نافذة بيع المنتجات بالوزن/بكمية حرة (بدون باركود مطبوع):
 * طريقتان للإدخال — وزن مباشر بالكيلو/الوحدة، أو مبلغ حر يحسب الوزن تلقائياً
 * (الوزن = المبلغ ÷ سعر الكيلو) — لأن الكاشير أحياناً يعرف الوزن وأحياناً المبلغ فقط.
 */
export const WeightEntryModal: React.FC<Props> = ({
  isOpen,
  onClose,
  product,
  activeBranchId,
  onConfirm,
  showToast,
}) => {
  const [mode, setMode] = useState<'weight' | 'amount'>('weight');
  const [weightInput, setWeightInput] = useState('');
  const [amountInput, setAmountInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode('weight');
      setWeightInput('');
      setAmountInput('');
    }
  }, [isOpen, product?.id]);

  const branchStock = useMemo(() => {
    if (!product) return 0;
    return dbService.getProductStock(product, activeBranchId);
  }, [product, activeBranchId]);

  const unitLabel = product?.unit || 'كجم';
  const price = product ? Number(product.salePrice) || 0 : 0;

  const weightNum = parseFloat(weightInput) || 0;
  const amountNum = parseFloat(amountInput) || 0;
  // الوزن المحسوب من المبلغ يُقرَّب لثلاث خانات عشرية لتجنب بقايا الفاصلة العائمة
  const computedWeight = price > 0 ? Math.round((amountNum / price) * 1000) / 1000 : 0;
  const effectiveWeight = mode === 'weight' ? weightNum : computedWeight;
  const total = Math.round(effectiveWeight * price * 100) / 100;

  if (!isOpen || !product) return null;

  const handleConfirm = () => {
    if (effectiveWeight <= 0) {
      showToast(mode === 'weight' ? 'يرجى إدخال وزن صحيح أكبر من الصفر' : 'يرجى إدخال مبلغ صحيح أكبر من الصفر', 'warn');
      return;
    }
    if (effectiveWeight > branchStock) {
      showToast(`الوزن المطلوب (${effectiveWeight} ${unitLabel}) يتجاوز المتوفر في مخزن الفرع (${branchStock} ${unitLabel})`, 'error');
      return;
    }
    onConfirm(effectiveWeight);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-right overflow-hidden">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600/10 text-amber-600 dark:text-amber-400 border border-amber-600/20">
              <Scale className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900 dark:text-white">بيع بالوزن</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{product.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="p-4 space-y-3 text-xs">
          {/* طريقة الإدخال */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode('weight')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                mode === 'weight'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Scale className="h-3.5 w-3.5" />
              <span>بالوزن ({unitLabel})</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('amount')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                mode === 'amount'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-xs ring-2 ring-amber-500/20'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <Coins className="h-4 w-4" />
              <span>بالمبلغ الحر</span>
            </button>
          </div>

          {/* حقل الوزن المباشر */}
          {mode === 'weight' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                أدخل الوزن ({unitLabel}) — المتوفر: {branchStock}
              </label>
              <input
                type="number"
                min="0.001"
                max={branchStock}
                step="0.001"
                autoFocus
                required
                placeholder="0.35"
                value={weightInput}
                onChange={(e) => setWeightInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 font-mono text-base font-bold text-slate-900 dark:text-white focus:border-amber-600 focus:outline-none"
              />
            </div>
          )}

          {/* المبلغ الحر */}
          {mode === 'amount' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                أدخل المبلغ الذي طلبه الزبون — الوزن يُحسب تلقائياً (المبلغ ÷ {price} ريال/{unitLabel})
              </label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                autoFocus
                required
                placeholder="20"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-3 font-mono text-base font-bold text-slate-900 dark:text-white focus:border-amber-600 focus:outline-none"
              />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 font-mono">
                الوزن المحسوب: <span className="font-black text-amber-600 dark:text-amber-400">{computedWeight} {unitLabel}</span>
              </p>
            </div>
          )}

          {/* الإجمالي */}
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between text-amber-800 dark:text-amber-300">
            <span className="font-bold text-xs">الإجمالي:</span>
            <span className="font-mono font-black text-lg">{total.toFixed(2)} {dbService.getSettings().currency}</span>
          </div>

          {effectiveWeight > branchStock && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              الوزن المطلوب يتجاوز المتوفر في المخزن ({branchStock} {unitLabel})
            </div>
          )}

          {/* أزرار التنفيذ */}
          <div className="pt-2 flex gap-2">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={effectiveWeight <= 0 || effectiveWeight > branchStock}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white shadow-md transition cursor-pointer ${
                effectiveWeight <= 0 || effectiveWeight > branchStock
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-950/20'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>إضافة للسلة</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};