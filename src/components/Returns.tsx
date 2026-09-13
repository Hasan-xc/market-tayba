import { useState } from 'react';
import { RotateCcw, Search, AlertCircle, CheckCircle2, Package, Tag, User, FileText, Trash2, Camera, ArrowRight, Printer } from 'lucide-react';
import { Product, ReturnReason, ReturnRecord, StoreSettings } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { matchProductSearch } from '../utils/search';

interface Props {
  settings: StoreSettings;
  products: Product[];
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn') => void;
}

const REASON_OPTIONS: { id: ReturnReason; label: string; desc: string; defaultAction: 'restock' | 'scrap' }[] = [
  { id: 'damaged', label: 'تالف أو به عيب مصنعي', desc: 'سيتم تسجيله كخسارة ولن يعود للبيع', defaultAction: 'scrap' },
  { id: 'expired', label: 'منتهي الصلاحية أو تالف بالتخزين', desc: 'إتلاف الصنف فوراً', defaultAction: 'scrap' },
  { id: 'wrong_item', label: 'خطأ في الشراء من العميل', desc: 'المنتج بحالة سليمة ويعاد للمخزن', defaultAction: 'restock' },
  { id: 'customer_choice', label: 'رغبة العميل (سليم تماماً)', desc: 'المنتج بحالة ممتازة ويعاد للمخزون للبيع', defaultAction: 'restock' },
  { id: 'other', label: 'سبب آخر (توضيح بالملاحظات)', desc: 'يرجى كتابة السبب في خانة الملاحظات', defaultAction: 'restock' },
];

export const Returns = ({ settings, products, onDataChange, showToast }: Props) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [returnQty, setReturnQty] = useState(1);
  const [refundPrice, setRefundPrice] = useState<number>(0);
  const [reason, setReason] = useState<ReturnReason>('customer_choice');
  const [customReason, setCustomReason] = useState('');
  const [actionTaken, setActionTaken] = useState<'restock' | 'scrap'>('restock');
  const [originalInvoice, setOriginalInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [filterReason, setFilterReason] = useState<string>('all');

  const returnsList = dbService.getReturns();

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setReturnQty(1);
    setRefundPrice(product.salePrice);
    // ضبط الإجراء التلقائي بناءً على السبب
    const opt = REASON_OPTIONS.find((r) => r.id === reason);
    if (opt) setActionTaken(opt.defaultAction);
  };

  const handleScanBarcode = (barcode: string) => {
    const p = products.find((x) => x.barcode === barcode);
    if (p) {
      handleSelectProduct(p);
      showToast(`تم العثور على الصنف: ${p.name}`, 'success');
    } else {
      showToast('لم يتم العثور على منتج بهذا الباركود في المخزون', 'error');
    }
  };

  const handleReasonChange = (newReason: ReturnReason) => {
    setReason(newReason);
    const opt = REASON_OPTIONS.find((r) => r.id === newReason);
    if (opt) {
      setActionTaken(opt.defaultAction);
    }
  };

  const handleConfirmReturn = () => {
    if (!selectedProduct) {
      showToast('يرجى اختيار المنتج المراد إرجاعه أولاً', 'warn');
      return;
    }

    if (returnQty <= 0) {
      showToast('الكمية المرتجعة يجب أن تكون 1 على الأقل', 'warn');
      return;
    }

    const refundTotal = returnQty * refundPrice;

    try {
      const newReturn = dbService.addReturn({
        productId: selectedProduct.id,
        barcode: selectedProduct.barcode,
        productName: selectedProduct.name,
        quantity: returnQty,
        refundUnitPrice: refundPrice,
        refundTotal: refundTotal,
        reason: reason,
        customReasonText: customReason,
        actionTaken: actionTaken,
        originalInvoiceNumber: originalInvoice.trim() || undefined,
        cashierName: settings.activeCashier,
        notes: notes.trim() || undefined,
      });

      // مزامنة فورية وسريعة مع سحابة Supabase
      if (navigator.onLine && SupabaseService.isConfigured()) {
        SupabaseService.syncReturn(newReturn).then((synced) => {
          if (synced) {
            dbService.markReturnAsSynced(newReturn.id);
            onDataChange();
          }
        }).catch((err) => console.warn('Supabase return sync error:', err));
      }

      showToast(`تم تسجيل المرتجع بنجاح (${newReturn.returnNumber}) وإرجاع ${refundTotal.toFixed(2)} ${settings.currency} للعميل`, 'success');
      
      // تفريغ النموذج
      setSelectedProduct(null);
      setReturnQty(1);
      setOriginalInvoice('');
      setNotes('');
      setCustomReason('');
      onDataChange();
    } catch (e: any) {
      showToast('تعذر تسجيل المرتجع: ' + e.message, 'error');
    }
  };

  // تصفية سجل المرتجعات
  const filteredReturns = returnsList.filter((r) => {
    if (filterReason !== 'all' && r.reason !== filterReason) return false;
    return true;
  });

  const totalRefundsAmount = returnsList.reduce((sum, r) => sum + r.refundTotal, 0);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-l from-rose-900 to-slate-900 p-5 rounded-2xl text-white shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 border border-rose-400/30">
              <RotateCcw className="h-5 w-5" />
            </div>
            <h2 className="text-xl font-bold font-['Cairo']">تسجيل المرتجعات والاستبدال</h2>
          </div>
          <p className="text-xs text-rose-200/80 mt-1">
            تسجيل الأصناف المرتجعة من الزبائن مع ذكر سبب الإرجاع وتحديث المخزون بدقة
          </p>
        </div>
        <div className="flex items-center gap-4 bg-white/10 px-4 py-2 rounded-xl backdrop-blur-sm self-start sm:self-auto">
          <div>
            <div className="text-[11px] text-rose-200">إجمالي المبالغ المسترجعة</div>
            <div className="text-lg font-black font-mono text-white">
              {totalRefundsAmount.toFixed(2)} <span className="text-xs font-sans">{settings.currency}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-white/20" />
          <div>
            <div className="text-[11px] text-rose-200">عدد العمليات</div>
            <div className="text-lg font-black font-mono text-white">{returnsList.length}</div>
          </div>
        </div>
      </div>

      {/* Main Grid: Return Form + Search / List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left/Form Column */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-4 text-slate-900 dark:text-white transition-colors">
            <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm font-['Cairo'] flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
              <Package className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              1. اختيار المنتج المراد إرجاعه
            </h3>

            {/* Product Selector */}
            {!selectedProduct ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="ابحث بالاسم أو الباركود..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2.5 pr-9 pl-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 transition"
                    />
                  </div>
                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 dark:hover:bg-slate-700 border border-slate-800 dark:border-slate-700 transition cursor-pointer"
                  >
                    <Camera className="h-4 w-4 text-amber-400" />
                    <span>مسح بالكاميرا</span>
                  </button>
                </div>

                {/* Quick Results */}
                <div className="max-h-56 overflow-y-auto space-y-1.5 rounded-xl border border-slate-100 dark:border-slate-800 p-1.5 bg-slate-50 dark:bg-slate-800/50">
                  {products
                    .filter((p) => matchProductSearch(p, searchTerm))
                    .slice(0, 10)
                    .map((p) => (
                      <div
                        key={p.id}
                        onClick={() => handleSelectProduct(p)}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-rose-400 dark:hover:border-rose-500 hover:bg-rose-50/50 dark:hover:bg-rose-950/20 cursor-pointer transition"
                      >
                        <div>
                          <div className="font-bold text-xs text-slate-900 dark:text-white">{p.name}</div>
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {p.barcode} • {p.category}
                          </div>
                        </div>
                        <div className="text-left">
                          <div className="font-bold font-mono text-sm text-slate-800 dark:text-slate-200">
                            {p.salePrice.toFixed(2)} {settings.currency}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">المتوفر بالمخزن: {p.quantity}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/30 p-3.5 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <span className="inline-block rounded bg-rose-200/80 dark:bg-rose-900/60 px-2 py-0.5 text-[10px] font-bold text-rose-800 dark:text-rose-200 mb-1">
                      المنتج المحدد للإرجاع
                    </span>
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">{selectedProduct.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">باركود: {selectedProduct.barcode}</p>
                  </div>
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="text-xs font-bold text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 underline cursor-pointer"
                  >
                    تغيير الصنف
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-rose-200/60 dark:border-rose-900/40 text-xs">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">سعر البيع الأصلي:</span>{' '}
                    <b className="font-mono text-slate-900 dark:text-white">{selectedProduct.salePrice.toFixed(2)} {settings.currency}</b>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">الكمية بالمخزن حالياً:</span>{' '}
                    <b className="font-mono text-slate-900 dark:text-white">{selectedProduct.quantity}</b>
                  </div>
                </div>
              </div>
            )}

            {/* Return Details Form */}
            {selectedProduct && (
              <div className="space-y-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm font-['Cairo'] flex items-center gap-2">
                  <Tag className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                  2. تفاصيل الإرجاع والسبب
                </h3>

                {/* Reason Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    سبب الإرجاع <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {REASON_OPTIONS.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer transition text-xs ${
                          reason === opt.id
                            ? 'border-rose-600 dark:border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 shadow-sm font-medium'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                        }`}
                      >
                        <input
                          type="radio"
                          name="returnReason"
                          checked={reason === opt.id}
                          onChange={() => handleReasonChange(opt.id)}
                          className="mt-0.5 text-rose-600 focus:ring-rose-500"
                        />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{opt.label}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{opt.desc}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {reason === 'other' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">اذكر سبب الترجيع بالتفصيل</label>
                    <input
                      type="text"
                      placeholder="اكتب السبب هنا..."
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-xs text-slate-900 dark:text-white focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                    />
                  </div>
                )}

                {/* Quantity and Refund Price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">الكمية المرتجعة</label>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                        className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="1"
                        value={returnQty}
                        onChange={(e) => setReturnQty(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9 flex-1 text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono font-bold text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setReturnQty(returnQty + 1)}
                        className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">سعر الاسترداد للقطعة</label>
                    <input
                      type="number"
                      step="0.25"
                      value={refundPrice}
                      onChange={(e) => setRefundPrice(parseFloat(e.target.value) || 0)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 font-mono font-bold text-sm text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                {/* Inventory Action */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">حالة المخزون بعد الإرجاع</label>
                  <div className="grid grid-cols-2 gap-2">
                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        actionTaken === 'restock'
                          ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="actionTaken"
                        checked={actionTaken === 'restock'}
                        onChange={() => setActionTaken('restock')}
                        className="text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>🔄 إعادة الكمية للمخزون للبيع</span>
                    </label>

                    <label
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition ${
                        actionTaken === 'scrap'
                          ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-300 font-bold'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="actionTaken"
                        checked={actionTaken === 'scrap'}
                        onChange={() => setActionTaken('scrap')}
                        className="text-rose-600 focus:ring-rose-500"
                      />
                      <span>🗑️ إتلاف / هدر (لا يعاد للمخزن)</span>
                    </label>
                  </div>
                </div>

                {/* Invoice number (optional) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">رقم الفاتورة الأصلية (اختياري)</label>
                    <input
                      type="text"
                      placeholder="مثال: INV-1002"
                      value={originalInvoice}
                      onChange={(e) => setOriginalInvoice(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-2 text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">ملاحظات إضافية</label>
                    <input
                      type="text"
                      placeholder="اسم العميل أو تفاصيل أخرى..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white p-2 text-xs"
                    />
                  </div>
                </div>

                {/* Total Refund Box */}
                <div className="flex items-center justify-between rounded-xl bg-slate-900 dark:bg-slate-950 border border-slate-800 p-4 text-white">
                  <div>
                    <span className="text-xs text-slate-400">إجمالي المبلغ المستحق للعميل:</span>
                    <div className="text-xl font-black font-mono text-amber-400">
                      {(returnQty * refundPrice).toFixed(2)} {settings.currency}
                    </div>
                  </div>
                  <button
                    onClick={handleConfirmReturn}
                    className="flex items-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/30 active:scale-95 transition font-['Cairo'] cursor-pointer"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    <span>تأكيد الإرجاع واسترداد المبلغ</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Recent Returns Log */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm space-y-3 text-slate-900 dark:text-white transition-colors">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm font-['Cairo'] flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                سجل المرتجعات السابقة
              </h3>
              <select
                value={filterReason}
                onChange={(e) => setFilterReason(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="all">جميع الأسباب</option>
                <option value="damaged">تالف / عيب</option>
                <option value="expired">منتهي الصلاحية</option>
                <option value="wrong_item">خطأ بالشراء</option>
                <option value="customer_choice">رغبة العميل</option>
              </select>
            </div>

            {filteredReturns.length === 0 ? (
              <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-2">
                <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-400 opacity-60" />
                <p className="text-xs">لا توجد عمليات إرجاع مسجلة</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-0.5">
                {filteredReturns.map((r) => {
                  const reasonObj = REASON_OPTIONS.find((opt) => opt.id === r.reason);
                  return (
                    <div
                      key={r.id}
                      className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/60 p-3 text-xs space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-bold text-slate-900 dark:text-white">{r.productName}</div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                            {r.returnNumber} • {new Date(r.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                        </div>
                        <span className="font-bold font-mono text-sm text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded-lg">
                          -{r.refundTotal.toFixed(2)} {settings.currency}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                        <span className="rounded bg-slate-200/80 dark:bg-slate-700 px-2 py-0.5 text-slate-700 dark:text-slate-300 font-medium">
                          {reasonObj?.label || r.reason}
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          الكمية: <b className="font-mono text-slate-800 dark:text-slate-200">{r.quantity}</b>
                        </span>
                        <span className="text-slate-500 dark:text-slate-400">
                          بواسطة: <b className="text-slate-800 dark:text-slate-200">{r.cashierName}</b>
                        </span>
                      </div>

                      {r.notes && (
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 italic bg-white dark:bg-slate-900 p-1.5 rounded border border-slate-100 dark:border-slate-800">
                          ملاحظة: {r.notes}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal (Single shot / Auto closes upon scan) */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBarcode}
        title="مسح باركود المنتج المرتجع"
        autoCloseOnScan={true}
      />
    </div>
  );
};
