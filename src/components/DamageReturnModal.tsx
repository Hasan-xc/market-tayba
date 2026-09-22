import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  PackageMinus,
  PackageX,
  Truck,
  Factory,
  Check,
  Building2,
  AlertCircle,
  Coins
} from 'lucide-react';
import { Product, Branch, UserAccount } from '../types';
import { dbService } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
  branches?: Branch[];
  currentUser?: UserAccount | null;
  onSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

const DAMAGE_REASONS = ['تالف', 'كسر', 'منتهي الصلاحية'];

export const DamageReturnModal: React.FC<Props> = ({
  isOpen,
  onClose,
  product,
  branches: propsBranches,
  currentUser,
  onSuccess,
  showToast,
}) => {
  const branches = propsBranches || dbService.getBranches();
  const [actionType, setActionType] = useState<'damage' | 'vendor_return'>('damage');
  const [damageReason, setDamageReason] = useState<string>(DAMAGE_REASONS[0]);
  const [supplierId, setSupplierId] = useState<string>('');
  const [targetBranchId, setTargetBranchId] = useState<string>('');
  const [qty, setQty] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const suppliers = useMemo(() => {
    return isOpen ? dbService.getSuppliers() : [];
  }, [isOpen]);

  // تهيئة القيم الافتراضية عند كل فتح للنافذة
  useEffect(() => {
    if (!isOpen || !product) return;
    setActionType('damage');
    setDamageReason(DAMAGE_REASONS[0]);
    setQty('1');
    setNotes('');
    const active = dbService.getActiveBranchId();
    const resolved = active && active !== 'all' ? active : (branches[0]?.id || 'branch-main');
    setTargetBranchId(resolved);
    setSupplierId(suppliers[0]?.id || '');
  }, [isOpen, product?.id]);

  const branchStock = useMemo(() => {
    if (!product || !targetBranchId) return 0;
    const bq = dbService.ensureBranchQuantities(product);
    return Number(bq[targetBranchId] ?? 0);
  }, [product, targetBranchId]);

  const branchName = branches.find((b) => b.id === targetBranchId)?.name || 'الفرع المحدد';
  const qtyNum = parseFloat(qty) || 0;
  const supplierCredit = useMemo(() => {
    if (actionType !== 'vendor_return' || !product) return 0;
    return qtyNum * (Number(product.purchasePrice) || 0);
  }, [actionType, product, qtyNum]);

  if (!isOpen || !product) return null;

  const handleExecute = (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetBranchId || targetBranchId === 'all') {
      showToast('يرجى تحديد الفرع الذي سيُخصم منه الرصيد', 'warn');
      return;
    }
    if (qtyNum <= 0) {
      showToast('يرجى إدخال كمية صالحة أكبر من الصفر', 'warn');
      return;
    }
    if (qtyNum > branchStock) {
      showToast(`الكمية المطلوبة (${qtyNum}) تتجاوز رصيد ${branchName} المتاح (${branchStock})`, 'error');
      return;
    }
    if (actionType === 'vendor_return' && !supplierId) {
      showToast('يرجى اختيار المورد المراد إرجاع الكمية إليه', 'warn');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = dbService.recordDamageOrVendorReturn({
        productId: product.id,
        type: actionType,
        quantity: qtyNum,
        branchId: targetBranchId,
        damageReason: actionType === 'damage' ? damageReason : undefined,
        notes: notes.trim() || undefined,
        supplierId: actionType === 'vendor_return' ? supplierId : undefined,
        performedBy: currentUser?.name,
      });

      if (!res.success) {
        showToast(res.message, 'error');
        setIsSubmitting(false);
        return;
      }

      showToast(res.message, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast('فشل تنفيذ العملية: ' + (err?.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-right overflow-hidden my-6">
        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-600 dark:text-amber-400 border border-amber-600/20">
              <PackageMinus className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">إتلاف / إرجاع للمصنع</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">خصم من رصيد الفرع مع تسجيل الحركة في سجل حركات المخزن</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleExecute} className="p-5 space-y-4 text-xs max-h-[72vh] overflow-y-auto">
          {/* كرت الصنف */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                <PackageX className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">{product.name}</h4>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">باركود: {product.barcode} • الوحدة: {product.unit || 'حبة'}</p>
              </div>
            </div>
            <div className="text-left font-mono">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                إجمالي: <span className="text-amber-600 dark:text-amber-400 font-black">{product.quantity}</span>
              </div>
            </div>
          </div>

          {/* نوع الإجراء */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">نوع الإجراء</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setActionType('damage')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  actionType === 'damage'
                    ? 'bg-purple-600 text-white border-purple-600 shadow-xs ring-2 ring-purple-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <PackageMinus className="h-4 w-4" />
                <span>تالف / رمي</span>
              </button>
              <button
                type="button"
                onClick={() => setActionType('vendor_return')}
                className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  actionType === 'vendor_return'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Factory className="h-4 w-4" />
                <span>إرجاع للمصنع / المورد</span>
              </button>
            </div>
          </div>

          {/* سبب التلف الفرعي */}
          {actionType === 'damage' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">سبب التلف</label>
              <div className="flex flex-wrap gap-1.5">
                {DAMAGE_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setDamageReason(r)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer border ${
                      damageReason === r
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* اختيار المورد */}
          {actionType === 'vendor_return' && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                المورد المراد الإرجاع إليه
              </label>
              {suppliers.length === 0 ? (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>لا يوجد موردون مسجلون. أضف مورداً من شاشة الموردين أولاً.</span>
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-indigo-600 focus:outline-none appearance-none"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.company ? `— ${s.company}` : ''}
                      </option>
                    ))}
                  </select>
                  <Truck className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              )}
            </div>
          )}

          {/* اختيار الفرع */}
          {branches.length > 1 && (
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">الفرع الذي سيُخصم منه الرصيد</label>
              <div className="relative">
                <select
                  value={targetBranchId}
                  onChange={(e) => setTargetBranchId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none appearance-none"
                >
                  {branches.map((b) => {
                    const bQty = Number(dbService.ensureBranchQuantities(product)[b.id] ?? 0);
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.isMain ? '(رئيسي)' : ''} — [متوفر: {bQty}]
                      </option>
                    );
                  })}
                </select>
                <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          )}

          {/* الكمية */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                الكمية ({product.unit || 'حبة'}) — رصيد {branchName}: {branchStock}
              </label>
              {branchStock > 0 && (
                <button
                  type="button"
                  onClick={() => setQty(branchStock.toString())}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 hover:bg-amber-200 cursor-pointer"
                >
                  الكل ({branchStock})
                </button>
              )}
            </div>
            <input
              type="number"
              min="0.5"
              max={branchStock}
              step="0.5"
              required
              placeholder="1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-mono text-sm font-bold text-slate-900 dark:text-white focus:border-amber-600 focus:outline-none"
            />
            {qtyNum > branchStock && (
              <p className="text-[11px] text-rose-500 font-bold mt-1">⚠️ الكمية تتجاوز الرصيد المتاح في {branchName}!</p>
            )}
          </div>

          {/* المستحق للمورد */}
          {actionType === 'vendor_return' && supplierId && supplierCredit > 0 && (
            <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 flex items-center justify-between text-indigo-700 dark:text-indigo-300">
              <span className="font-bold flex items-center gap-1.5">
                <Coins className="h-4 w-4" />
                المستحق للمتجر لدى المورد:
              </span>
              <span className="font-mono font-black text-sm">
                {supplierCredit.toFixed(2)} {dbService.getSettings().currency}
              </span>
            </div>
          )}

          {/* ملاحظات */}
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">ملاحظات (اختياري)</label>
            <input
              type="text"
              placeholder="مثال: رقم إذن الإرجاع، تفاصيل التلف..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
            />
          </div>

          {/* أزرار التنفيذ */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting || branchStock <= 0 || (actionType === 'vendor_return' && !supplierId)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white shadow-md transition cursor-pointer ${
                isSubmitting || branchStock <= 0 || (actionType === 'vendor_return' && !supplierId)
                  ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  : actionType === 'damage'
                    ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-950/20'
                    : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-950/20'
              }`}
            >
              <Check className="h-4 w-4" />
              <span>{isSubmitting ? 'جاري التسجيل وخصم الرصيد...' : actionType === 'damage' ? 'تأكيد الإتلاف وخصم الرصيد' : 'تأكيد الإرجاع للمورد'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
