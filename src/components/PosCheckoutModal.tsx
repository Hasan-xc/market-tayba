import type { FormEvent } from 'react';
import {
  Banknote,
  X,
  ShoppingBag,
  Pencil,
  Check,
  Plus,
  CreditCard,
  FileText,
  Users,
  Tag,
} from 'lucide-react';
import { CartItem, StoreSettings, Customer } from '../types';
import { roundMoney } from '../utils/money';

interface PosCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: StoreSettings;
  cart: CartItem[];
  cartSubtotal: number;
  netTotal: number;
  totalItemsCount: number;
  paymentMethod: 'cash' | 'card' | 'credit';
  setPaymentMethod: (m: 'cash' | 'card' | 'credit') => void;
  selectedCustomerId: string;
  setSelectedCustomerId: (id: string) => void;
  customerSearchQuery: string;
  setCustomerSearchQuery: (q: string) => void;
  isInlineAddCustomer: boolean;
  setIsInlineAddCustomer: (b: boolean) => void;
  newCustomerName: string;
  setNewCustomerName: (v: string) => void;
  newCustomerPhone: string;
  setNewCustomerPhone: (v: string) => void;
  handleQuickAddCustomer: (e: FormEvent) => void;
  filteredCustomers: Customer[];
  selectedCustomer: Customer | null;
  editingPriceId: string | null;
  editingPriceVal: string;
  setEditingPriceVal: (v: string) => void;
  setEditingPriceId: (id: string | null) => void;
  commitPriceEdit: (item: CartItem) => void;
  startPriceEdit: (item: CartItem) => void;
  selectedDiscountPercent: number | null;
  applyPercentDiscount: (pct: number) => void;
  clearDiscount: () => void;
  globalDiscount: number;
  setGlobalDiscount: (v: number) => void;
  setSelectedDiscountPercent: (v: number | null) => void;
  handleManualNetTotalChange: (v: string) => void;
  handleCheckout: () => void;
}

export const PosCheckoutModal = ({
  isOpen,
  onClose,
  settings,
  cart,
  cartSubtotal,
  netTotal,
  totalItemsCount,
  paymentMethod,
  setPaymentMethod,
  selectedCustomerId,
  setSelectedCustomerId,
  customerSearchQuery,
  setCustomerSearchQuery,
  isInlineAddCustomer,
  setIsInlineAddCustomer,
  newCustomerName,
  setNewCustomerName,
  newCustomerPhone,
  setNewCustomerPhone,
  handleQuickAddCustomer,
  filteredCustomers,
  selectedCustomer,
  editingPriceId,
  editingPriceVal,
  setEditingPriceVal,
  setEditingPriceId,
  commitPriceEdit,
  startPriceEdit,
  selectedDiscountPercent,
  applyPercentDiscount,
  clearDiscount,
  globalDiscount,
  setGlobalDiscount,
  setSelectedDiscountPercent,
  handleManualNetTotalChange,
  handleCheckout,
}: PosCheckoutModalProps) => {
  if (!isOpen) return null;

  return (
    <div id="checkoutModal" className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-3 sm:p-4 sm:pt-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] mt-1">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold text-sm">إتمام عملية البيع والدفع</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto text-xs">
          {/* مراجعة السلة: كل ما يشتريه الزبون مع إمكانية تعديل سعر أي صنف */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-2.5">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShoppingBag className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  معاينة السلة ({totalItemsCount} قطعة):
                </label>
                <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                  <Pencil className="h-2.5 w-2.5" />
                  اضغط السعر لتعديله
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/60 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60">
                {cart.map((item, idx) => (
                  <div key={`review-item-${item.product.id || idx}-${idx}`} className="px-2 py-1.5 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                        {item.product.name}
                        <span className="text-[9px] text-slate-400 font-mono mr-1">× {item.quantity}</span>
                      </div>
                      {editingPriceId === item.product.id ? (
                        <div className="flex items-center gap-1 mt-0.5">
                          <input
                            type="number"
                            step="0.25"
                            min="0"
                            autoFocus
                            value={editingPriceVal}
                            onChange={(e) => setEditingPriceVal(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitPriceEdit(item);
                              if (e.key === 'Escape') setEditingPriceId(null);
                            }}
                            className="w-16 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 py-0.5 px-1 text-center font-mono text-[10px] font-bold text-slate-900 dark:text-white focus:outline-none"
                          />
                          <span className="text-[9px] text-slate-400">{settings.currency}</span>
                          <button
                            type="button"
                            onClick={() => commitPriceEdit(item)}
                            className="p-0.5 text-emerald-600 dark:text-emerald-400 cursor-pointer"
                            title="تأكيد السعر"
                          >
                            <Check className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startPriceEdit(item)}
                          className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                          title="اضغط لتعديل سعر هذا الصنف"
                        >
                          <Pencil className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                          <span>
                            {item.unitPrice.toFixed(2)} ={' '}
                            <b className={item.unitPrice !== item.product.salePrice ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-emerald-400 font-bold'}>
                              {item.total.toFixed(2)} {settings.currency}
                            </b>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* خيارات طرق الدفع (نقدي / شبكة / آجل ديون) */}
          <div>
            <label className="text-slate-600 dark:text-slate-400 font-bold block mb-1.5">اختر طريقة الدفع:</label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                id="payMethodCashBtn"
                onClick={() => setPaymentMethod('cash')}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-600/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>نقدي (كاش)</span>
              </button>

              <button
                type="button"
                id="payMethodCardBtn"
                onClick={() => setPaymentMethod('card')}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                  paymentMethod === 'card'
                    ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-600/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>شبكة / مدى</span>
              </button>

              <button
                type="button"
                id="payMethodCreditBtn"
                onClick={() => setPaymentMethod('credit')}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                  paymentMethod === 'credit'
                    ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-300 shadow-xs ring-2 ring-rose-600/20'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                }`}
              >
                <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <span>آجل (دين)</span>
              </button>
            </div>
          </div>

          {/* في حال اختيار البيع بالآجل (Credit / Debt) */}
          {paymentMethod === 'credit' && (
            <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 space-y-2.5 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-rose-900 dark:text-rose-300 text-xs flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
                  تحديد الزبون المدين:
                </span>
                <button
                  type="button"
                  onClick={() => setIsInlineAddCustomer(!isInlineAddCustomer)}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  {isInlineAddCustomer ? 'اختيار من القائمة' : 'زبون جديد +'}
                </button>
              </div>

              {isInlineAddCustomer ? (
                <form onSubmit={handleQuickAddCustomer} className="space-y-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60">
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="اسم الزبون (مطلوب)"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1.5 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <div>
                    <input
                      type="tel"
                      placeholder="رقم الهاتف (اختياري)"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer"
                  >
                    حفظ واختيار الزبون
                  </button>
                </form>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    placeholder="ابحث باسم الزبون..."
                    value={customerSearchQuery}
                    onChange={(e) => setCustomerSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-600"
                  />
                  <div className="max-h-28 overflow-y-auto divide-y divide-rose-100 dark:divide-rose-900/40 rounded-lg border border-rose-100 dark:border-rose-900/50 bg-white dark:bg-slate-800">
                    {filteredCustomers.length === 0 ? (
                      <div className="p-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                        لا يوجد زبون مطابق. اضغط "زبون جديد +" لإضافته.
                      </div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <div
                          key={c.id}
                          onClick={() => setSelectedCustomerId(c.id)}
                          className={`p-2 flex items-center justify-between cursor-pointer text-[11px] ${
                            selectedCustomerId === c.id
                              ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 font-bold'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <span>{c.name}</span>
                          <span className="font-mono text-rose-700 dark:text-rose-400 font-bold">
                            دين سابق: {c.currentDebt.toFixed(2)} {settings.currency}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {selectedCustomer && !isInlineAddCustomer && (
                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-800/60 text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">الزبون المحدد:</span>
                    <strong className="text-slate-900 dark:text-white">{selectedCustomer.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">الدين الحالي:</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {selectedCustomer.currentDebt.toFixed(2)} {settings.currency}
                    </span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 font-bold text-rose-900 dark:text-rose-300">
                    <span>الرصيد بعد هذه الفاتورة:</span>
                    <span className="font-mono">
                      {(selectedCustomer.currentDebt + netTotal).toFixed(2)} {settings.currency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* قسم الخصم */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                <Tag className="h-3.5 w-3.5 text-amber-500" />
                <span>تطبيق خصم سريع:</span>
              </div>
              {globalDiscount > 0 && (
                <button
                  type="button"
                  onClick={clearDiscount}
                  className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                >
                  إلغاء الخصم (0)
                </button>
              )}
            </div>

            <div className="grid grid-cols-5 gap-1">
              {[5, 10, 15, 20, 25].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => applyPercentDiscount(pct)}
                  className={`py-1.5 px-0.5 rounded-lg font-mono font-bold text-[11px] transition border cursor-pointer ${
                    selectedDiscountPercent === pct
                      ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-600/30'
                      : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  %{pct}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
              <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium shrink-0">أو خصم بمبلغ:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={cartSubtotal}
                  placeholder="0.00"
                  value={globalDiscount > 0 ? globalDiscount : ''}
                  onChange={(e) => {
                    setSelectedDiscountPercent(null);
                    const val = parseFloat(e.target.value) || 0;
                    setGlobalDiscount(roundMoney(Math.min(cartSubtotal, Math.max(0, val))));
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-1 pr-2.5 pl-10 text-[11px] font-mono font-bold focus:border-emerald-600 focus:outline-none"
                />
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 dark:text-slate-400 font-bold pointer-events-none">
                  {settings.currency}
                </span>
              </div>
            </div>
          </div>

          {/* حساب المبلغ الصافي */}
          <div className="rounded-xl bg-slate-900 p-3 text-white space-y-1.5 border border-slate-800 shadow-inner">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>المجموع الأصلي ({totalItemsCount} قطع):</span>
              <span className="font-mono text-slate-300 font-bold">{cartSubtotal.toFixed(2)} {settings.currency}</span>
            </div>

            {globalDiscount > 0 && (
              <div className="flex items-center justify-between text-[11px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                <span>الخصم {selectedDiscountPercent ? `(%${selectedDiscountPercent})` : ''}:</span>
                <span className="font-mono">-{globalDiscount.toFixed(2)} {settings.currency}</span>
              </div>
            )}

            <div className="pt-1.5 border-t border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-emerald-400">
                  المبلغ النهائي المطلوب للدفع:
                </label>
              </div>

              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={netTotal > 0 ? netTotal : (cartSubtotal === 0 ? '' : '0')}
                  onChange={(e) => handleManualNetTotalChange(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border-2 border-emerald-500/80 py-2 pr-3 pl-14 text-center font-mono font-black text-2xl text-emerald-400 focus:border-emerald-400 focus:outline-none"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                  {settings.currency}
                </span>
              </div>
            </div>
          </div>

          {/* زر تأكيد وطباعة الفاتورة */}
          <button
            type="button"
            id="confirmCheckoutBtn"
            onClick={handleCheckout}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 active:scale-[0.98] transition cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>
              {paymentMethod === 'credit'
                ? 'تسجيل الفاتورة على حساب العميل بالآجل'
                : 'تأكيد العملية وطباعة الفاتورة'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};