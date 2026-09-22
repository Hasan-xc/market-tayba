import React, { useState, useMemo, useEffect } from 'react';
import { 
  X, 
  ArrowLeftRight, 
  Search, 
  Building2, 
  Package, 
  Check, 
  AlertCircle, 
  History, 
  Calendar, 
  User, 
  FileText 
} from 'lucide-react';
import { Product, Branch, StockTransfer, UserAccount } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  branches?: Branch[];
  currentUser?: UserAccount | null;
  initialProductId?: string;
  onTransferSuccess: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const StockTransferModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  branches: propsBranches,
  currentUser,
  initialProductId,
  onTransferSuccess,
  showToast,
}) => {
  const branches = propsBranches || dbService.getBranches();
  const [activeTab, setActiveTab] = useState<'transfer' | 'history'>('transfer');
  const [selectedProductId, setSelectedProductId] = useState<string>(initialProductId || '');
  const [productSearch, setProductSearch] = useState<string>('');
  const [fromBranchId, setFromBranchId] = useState<string>('');
  const [toBranchId, setToBranchId] = useState<string>('');
  const [transferQty, setTransferQty] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // تحديث المنتج الافتراضي عند فتح النافذة
  useEffect(() => {
    if (initialProductId) {
      setSelectedProductId(initialProductId);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [initialProductId, products]);

  // تهيئة الفروع الافتراضية
  useEffect(() => {
    if (branches.length === 0) return;
    // الفرع النشط قد يكون وهمياً ('all' = جميع الفروع مجمعة للمدير) — ليس فرعاً حقيقياً
    // يمكن التحويل منه، فالاستمرار به يجعل "المتوفر" 0 خطأً والقائمة تعرض أول خيار بصرياً.
    // الحل: اعتماد أول فرع حقيقي من القائمة عند غياب فرع نشط فعلي.
    const active = dbService.getActiveBranch();
    const activeIsReal =
      !!active && active.id !== 'all' && active.id !== 'multi' && branches.some((b) => b.id === active.id);
    const defaultFrom = activeIsReal ? active.id : branches[0].id;
    setFromBranchId(defaultFrom);
    const other = branches.find((b) => b.id !== defaultFrom);
    setToBranchId(other ? other.id : '');
  }, [branches, isOpen]);

  // المنتج المختار حالياً
  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || null;
  }, [products, selectedProductId]);

  // المخزون المتاح في فرع المصدر
  const sourceStock = useMemo(() => {
    if (!selectedProduct || !fromBranchId) return 0;
    const bq = dbService.ensureBranchQuantities(selectedProduct);
    return bq[fromBranchId] ?? 0;
  }, [selectedProduct, fromBranchId]);

  // المخزون المتاح في فرع الوجهة
  const targetStock = useMemo(() => {
    if (!selectedProduct || !toBranchId) return 0;
    const bq = dbService.ensureBranchQuantities(selectedProduct);
    return bq[toBranchId] ?? 0;
  }, [selectedProduct, toBranchId]);

  // تصفية المنتجات للبحث السريع
  const searchResults = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const q = productSearch.trim().toLowerCase();
    return products.filter((p) => 
      p.name.toLowerCase().includes(q) || 
      p.barcode.toLowerCase().includes(q)
    ).slice(0, 25);
  }, [products, productSearch]);

  // قائمة سجلات التحويل السابقة
  const transferHistory: StockTransfer[] = useMemo(() => {
    return dbService.getStockTransfers();
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleExecuteTransfer = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProduct) {
      showToast('يرجى اختيار الصنف المراد تحويله', 'warn');
      return;
    }

    if (!fromBranchId || !toBranchId) {
      showToast('يرجى تحديد فرع المصدر وفرع الوجهة', 'warn');
      return;
    }

    if (fromBranchId === toBranchId) {
      showToast('لا يمكن التحويل إلى نفس الفرع، اختر فرعين مختلفين', 'warn');
      return;
    }

    const qty = parseFloat(transferQty) || 0;
    if (qty <= 0) {
      showToast('يرجى إدخال كمية صالحة أكبر من الصفر', 'warn');
      return;
    }

    if (qty > sourceStock) {
      showToast(`الكمية المطلوبة (${qty}) تتجاوز المخزون المتاح في فرع المصدر (${sourceStock})`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const fromBranch = branches.find((b) => b.id === fromBranchId);
      const toBranch = branches.find((b) => b.id === toBranchId);

      const res = dbService.transferStock({
        productId: selectedProduct.id,
        sourceBranchId: fromBranchId,
        targetBranchId: toBranchId,
        quantity: qty,
        notes: notes.trim() || undefined,
        performedBy: currentUser?.name,
      });

      if (!res.success) {
        showToast(res.error || 'فشلت عملية التحويل', 'error');
        setIsSubmitting(false);
        return;
      }

      // مزامنة المنتج المحدث وسند التحويل إلى Supabase
      if (navigator.onLine && SupabaseService.isConfigured()) {
        const updatedProd = dbService.getProductById(selectedProduct.id);
        if (updatedProd) {
          SupabaseService.syncProduct(updatedProd).catch((err) =>
            console.warn('Failed to sync transferred product to Supabase:', err)
          );
        }
        if (res.transfer) {
          SupabaseService.syncStockTransfer(res.transfer).catch((err) =>
            console.warn('Failed to sync stock transfer to Supabase:', err)
          );
        }
      }

      showToast(
        `تم تحويل ${qty} ${selectedProduct.unit || 'حبة'} من "${fromBranch?.name}" إلى "${toBranch?.name}" بنجاح`,
        'success'
      );

      onTransferSuccess();
      setTransferQty('1');
      setNotes('');
      setActiveTab('history');
    } catch (err: any) {
      showToast('فشل إتمام التحويل: ' + (err?.message || err), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 text-right overflow-hidden my-6">
        
        {/* رأس النافذة */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 border border-emerald-600/20">
              <ArrowLeftRight className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-white">التحويل المخزني بين الفروع</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">نقل الكميات من مخزن فرع إلى آخر مع تسجيل كامل في القيود وسجل الحركات</p>
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

        {/* التبويبات */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'transfer'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>تحويل جديد</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-3 font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <History className="h-3.5 w-3.5" />
            <span>سجل التحويلات السابقة ({transferHistory.length})</span>
          </button>
        </div>

        {/* محتوى التبويب */}
        <div className="p-5 max-h-[72vh] overflow-y-auto">
          {activeTab === 'transfer' ? (
            <form onSubmit={handleExecuteTransfer} className="space-y-4 text-xs">
              
              {/* فحص وجود فرعين على الأقل */}
              {branches.length < 2 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    لديك فرع واحد فقط حالياً. يرجى الذهاب إلى <b>إدارة الفروع</b> وإضافة فرع ثانٍ لتتمكن من نقل المخزون بينهما.
                  </span>
                </div>
              )}

              {/* اختيار الصنف */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1.5">
                  1. اختيار الصنف المراد تحويله
                </label>
                
                <div className="relative mb-2">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم أو الباركود لتغيير الصنف..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 pr-8 pl-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>

                {productSearch.trim() && (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 mb-2 divide-y divide-slate-100 dark:divide-slate-700">
                    {searchResults.length === 0 ? (
                      <p className="p-2 text-center text-slate-400 text-xs">لا توجد نتائج مطابقة</p>
                    ) : (
                      searchResults.map((p) => (
                        <div
                          key={`search-res-${p.id}`}
                          onClick={() => {
                            setSelectedProductId(p.id);
                            setProductSearch('');
                          }}
                          className={`p-2 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 cursor-pointer flex items-center justify-between transition ${
                            selectedProductId === p.id ? 'bg-emerald-50 dark:bg-emerald-950/60 font-bold text-emerald-800 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div>
                            <span className="font-bold">{p.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono mr-2">[{p.barcode}]</span>
                          </div>
                          <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">إجمالي: {p.quantity}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {/* كرت الصنف المختار */}
                {selectedProduct && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                        <Package className="h-4 w-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 dark:text-white text-xs">{selectedProduct.name}</h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">باركود: {selectedProduct.barcode} • الوحدة: {selectedProduct.unit || 'حبة'}</p>
                      </div>
                    </div>
                    <div className="text-left font-mono">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        المجموع الكلي: <span className="text-emerald-600 dark:text-emerald-400 font-black">{selectedProduct.quantity}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* تحديد الفروع (المصدر والوجهة) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                
                {/* فرع المصدر */}
                <div className="p-3.5 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5 text-xs">
                      <Building2 className="h-3.5 w-3.5" />
                      من فرع (المصدر - الخروج)
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
                      المتوفر: {sourceStock}
                    </span>
                  </div>

                  <select
                    value={fromBranchId}
                    onChange={(e) => setFromBranchId(e.target.value)}
                    className="w-full rounded-xl border border-rose-200 dark:border-rose-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    {branches.map((b) => {
                      const qtyInB = selectedProduct ? (dbService.ensureBranchQuantities(selectedProduct)[b.id] ?? 0) : 0;
                      return (
                        <option key={`from-${b.id}`} value={b.id}>
                          {b.name} {b.isMain ? '(رئيسي)' : ''} — [متوفر: {qtyInB}]
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* فرع الوجهة */}
                <div className="p-3.5 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5 text-xs">
                      <Building2 className="h-3.5 w-3.5" />
                      إلى فرع (الوجهة - الدخول)
                    </span>
                    <span className="text-[10px] font-mono font-bold bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300">
                      الحالي: {targetStock}
                    </span>
                  </div>

                  <select
                    value={toBranchId}
                    onChange={(e) => setToBranchId(e.target.value)}
                    className="w-full rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {branches.map((b) => {
                      const qtyInB = selectedProduct ? (dbService.ensureBranchQuantities(selectedProduct)[b.id] ?? 0) : 0;
                      return (
                        <option key={`to-${b.id}`} value={b.id} disabled={b.id === fromBranchId}>
                          {b.name} {b.isMain ? '(رئيسي)' : ''} — [حالي: {qtyInB}] {b.id === fromBranchId ? '(المصدر)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* الكمية المراد تحويلها */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="font-bold text-slate-700 dark:text-slate-300 text-xs">
                    الكمية المراد تحويلها ({selectedProduct?.unit || 'حبة'})
                  </label>
                  {sourceStock > 0 && (
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTransferQty(Math.ceil(sourceStock / 2).toString())}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                      >
                        نصف الكمية ({Math.ceil(sourceStock / 2)})
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransferQty(sourceStock.toString())}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-200 cursor-pointer"
                      >
                        الكل ({sourceStock})
                      </button>
                    </div>
                  )}
                </div>
                
                <input
                  type="number"
                  min="0.5"
                  max={sourceStock}
                  step="0.5"
                  required
                  placeholder="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-2 px-3 font-mono text-sm font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                />

                {parseFloat(transferQty) > sourceStock && (
                  <p className="text-[11px] text-rose-500 font-bold mt-1">
                    ⚠️ الكمية المطلوبة تتجاوز المخزون المتوفر في فرع المصدر!
                  </p>
                )}
              </div>

              {/* سبب أو ملاحظات التحويل */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-xs mb-1">
                  سبب أو ملاحظات التحويل (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: تعويض نقص مخزون، إعادة موازنة، طلب زبون خاص..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 px-3 text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {/* زر التنفيذ */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                <button
                  type="submit"
                  disabled={isSubmitting || sourceStock <= 0 || fromBranchId === toBranchId || branches.length < 2}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-white shadow-md transition cursor-pointer ${
                    sourceStock <= 0 || fromBranchId === toBranchId || branches.length < 2
                      ? 'bg-slate-300 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-950/20'
                  }`}
                >
                  <Check className="h-4 w-4" />
                  <span>{isSubmitting ? 'جاري التحويل وتحديث الأرصدة...' : 'تأكيد وإتمام التحويل المخزني'}</span>
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
          ) : (
            /* سجل التحويلات */
            <div className="space-y-3">
              {transferHistory.length === 0 ? (
                <div className="py-12 text-center text-slate-400 dark:text-slate-500">
                  <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="font-bold">لا توجد عمليات تحويل مسجلة حتى الآن</p>
                  <p className="text-[11px] mt-1">عند إجراء أي مناقلة بين الفروع ستظهر تفاصيلها الدقيقة هنا</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 text-xs">
                  {transferHistory.map((th) => {
                    const firstItem = th.items?.[0];
                    return (
                      <div key={th.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            {firstItem?.productName || 'صنف محول'}
                          </span>
                          <span className="font-mono text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            {th.totalQuantity || firstItem?.quantity || 0} قطعة
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                          <div className="flex items-center gap-1.5">
                            <span className="text-rose-600 dark:text-rose-400 font-bold">{th.sourceBranchName}</span>
                            <span className="text-slate-400">←</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{th.targetBranchName}</span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span>{th.transferredBy}</span>
                            <span>•</span>
                            <span>{new Date(th.createdAt).toLocaleString('ar-SA')}</span>
                          </div>
                        </div>

                      {th.notes && (
                        <p className="text-[10px] text-slate-400 italic mt-1 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-md">
                          ملاحظة: {th.notes}
                        </p>
                      )}
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
