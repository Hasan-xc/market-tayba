import { useState, useMemo, type FormEvent } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Calendar, 
  CreditCard, 
  Receipt, 
  Banknote, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Trash2, 
  Edit, 
  X, 
  UserCheck, 
  DollarSign, 
  FileText, 
  UserPlus, 
  ChevronLeft,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  Download
} from 'lucide-react';
import { Customer, DebtTransaction, StoreSettings } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { normalizeArabicText, normalizeDigits } from '../utils/search';
import { SoundService } from '../utils/audio';
import { roundMoney } from '../utils/money';

interface Props {
  settings: StoreSettings;
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const CustomersDebts = ({ settings, onDataChange, showToast }: Props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  
  // حقول إضافة/تعديل العميل
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');
  const [initialDebt, setInitialDebt] = useState('');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const customers = dbService.getCustomers();
  const allDebtTransactions = dbService.getDebtTransactions();
  const isSoundEnabled = settings.soundEnabled !== false;

  // إحصائيات الديون العامة
  const totalOutstandingDebt = useMemo(() => {
    return roundMoney(customers.reduce((sum, c) => sum + (c.currentDebt || 0), 0));
  }, [customers]);

  const totalDebtorsCount = useMemo(() => {
    return customers.filter((c) => (c.currentDebt || 0) > 0).length;
  }, [customers]);

  // تصفية العملاء حسب البحث
  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const normQ = normalizeArabicText(searchQuery);
    const digQ = normalizeDigits(searchQuery);

    return customers.filter((c) => {
      const normName = normalizeArabicText(c.name || '');
      const normPhone = normalizeDigits(c.phone || '');
      return (
        normName.includes(normQ) ||
        normPhone.includes(digQ) ||
        (c.phone && c.phone.includes(searchQuery.trim()))
      );
    });
  }, [customers, searchQuery]);

  // الزبون المحدد حالياً
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // سجل حركات الزبون المحدد
  const customerTransactions = useMemo(() => {
    if (!selectedCustomerId) return [];
    return allDebtTransactions
      .filter((tx) => tx.customerId === selectedCustomerId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [allDebtTransactions, selectedCustomerId]);

  // حفظ عميل جديد أو تعديل
  const handleSaveCustomer = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = customerName.trim();
    if (!cleanName) {
      showToast('يرجى إدخال اسم العميل', 'warn');
      return;
    }

    try {
      const initDebt = roundMoney(Math.max(0, parseFloat(initialDebt) || 0));
      const saved = dbService.saveCustomer({
        id: editingCustomer ? editingCustomer.id : undefined,
        name: cleanName,
        phone: customerPhone.trim() || undefined,
        notes: customerNotes.trim() || undefined,
        currentDebt: editingCustomer ? editingCustomer.currentDebt : initDebt,
      });

      // إذا كان هناك رصيد افتتاحي لعميل جديد
      if (!editingCustomer && initDebt > 0) {
        dbService.addDebtTransaction({
          customerId: saved.id,
          customerName: saved.name,
          type: 'sale_credit',
          amount: initDebt,
          notes: 'رصيد دين افتتاحي سابق',
          remainingBalance: initDebt,
          cashierName: settings.activeCashier,
        });
      }

      if (isSoundEnabled) SoundService.playScanSuccess();
      showToast(editingCustomer ? 'تم تعديل بيانات العميل بنجاح' : 'تمت إضافة العميل بنجاح', 'success');
      
      setIsAddCustomerOpen(false);
      setEditingCustomer(null);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerNotes('');
      setInitialDebt('');
      setSelectedCustomerId(saved.id);
      onDataChange();
    } catch (err: any) {
      showToast(err?.message || 'تعذر حفظ العميل', 'error');
    }
  };

  // حذف عميل
  const handleDeleteCustomer = (customer: Customer) => {
    if (customer.currentDebt > 0) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast(`لا يمكن حذف العميل لأن عليه دين قائم قدره ${customer.currentDebt.toFixed(2)} ${settings.currency}`, 'warn');
      return;
    }

    if (confirm(`هل أنت متأكد من حذف العميل "${customer.name}"؟`)) {
      dbService.deleteCustomer(customer.id);
      if (selectedCustomerId === customer.id) {
        setSelectedCustomerId(null);
      }
      onDataChange();
      showToast('تم حذف العميل بنجاح', 'info');
    }
  };

  // تسديد دفعة أو الدين بالكامل
  const handleApplyPayment = (e?: FormEvent, isFullBalance = false) => {
    if (e) e.preventDefault();
    if (!selectedCustomer) return;

    const currentDebt = selectedCustomer.currentDebt || 0;
    if (currentDebt <= 0) {
      showToast('العميل ليس عليه أي ديون مسجلة', 'info');
      return;
    }

    const amount = isFullBalance ? currentDebt : roundMoney(Math.max(0, parseFloat(paymentAmount) || 0));

    if (amount <= 0) {
      showToast('يرجى إدخال مبلغ سداد صحيح', 'warn');
      return;
    }

    if (amount > currentDebt) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast(`مبلغ السداد أكبر من الدين الحالي (${currentDebt.toFixed(2)} ${settings.currency})`, 'warn');
      return;
    }

    try {
      const res = dbService.applyCustomerPayment(
        selectedCustomer.id,
        amount,
        paymentNotes.trim() || (isFullBalance ? 'تسديد الدين بالكامل' : 'تسديد دفعة نقدية'),
        settings.activeCashier
      );

      if (isSoundEnabled) SoundService.playCheckoutSuccess();
      showToast(
        isFullBalance
          ? `تم تسديد كامل دين "${selectedCustomer.name}" بنجاح!`
          : `تم خصم ${amount.toFixed(2)} ${settings.currency} من حساب "${selectedCustomer.name}"`,
        'success'
      );

      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentNotes('');
      onDataChange();
    } catch (err: any) {
      showToast(err?.message || 'تعذر تسجيل عملية السداد', 'error');
    }
  };

  // تصدير كشف حساب العميل
  const handleExportCustomerStatement = () => {
    if (!selectedCustomer) return;
    const lines = [
      `كشف حساب عميل: ${selectedCustomer.name}`,
      `هاتف: ${selectedCustomer.phone || 'غير مسجل'}`,
      `إجمالي الدين الحالي: ${selectedCustomer.currentDebt.toFixed(2)} ${settings.currency}`,
      `تاريخ التقرير: ${new Date().toLocaleString('ar-SA')}`,
      '----------------------------------------',
      'التاريخ | النوع | المبلغ | الرصيد المتبقي | الملاحظات',
      ...customerTransactions.map((t) => {
        const d = new Date(t.createdAt).toLocaleDateString('ar-SA');
        const typeStr = t.type === 'sale_credit' ? 'فاتورة آجل' : 'دفعة سداد';
        return `${d} | ${typeStr} | ${t.amount.toFixed(2)} | ${t.remainingBalance.toFixed(2)} | ${t.notes || '-'}`;
      }),
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `statement_${selectedCustomer.name.replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="space-y-4 font-['Cairo',sans-serif]">
      {/* 1. بطاقات الإحصائيات العلوية */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* إجمالي الديون في السوق */}
        <div className="rounded-2xl bg-gradient-to-br from-rose-600 to-rose-700 p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-100">إجمالي الديون في السوق</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-xs">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black font-mono">
              {totalOutstandingDebt.toFixed(2)}
            </span>
            <span className="text-xs font-bold text-rose-200">{settings.currency}</span>
          </div>
          <p className="mt-1 text-[11px] text-rose-100/90 font-medium">
            مجموع المبالغ الآجلة المستحقة على الزبائن
          </p>
        </div>

        {/* عدد المدينين القائمين */}
        <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 p-4 text-white shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-100">عدد العملاء المدينين</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 text-white backdrop-blur-xs">
              <Users className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl sm:text-3xl font-black font-mono">
              {totalDebtorsCount}
            </span>
            <span className="text-xs font-bold text-amber-100">عميل مدين</span>
          </div>
          <p className="mt-1 text-[11px] text-amber-100/90 font-medium">
            من إجمالي {customers.length} عميل مسجل في المتجر
          </p>
        </div>

        {/* زر الإضافة السريع */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-4 shadow-xs flex flex-col justify-between text-slate-900 dark:text-white">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">إدارة حسابات العملاء</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
              <UserPlus className="h-5 w-5" />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setCustomerName('');
              setCustomerPhone('');
              setCustomerNotes('');
              setInitialDebt('');
              setIsAddCustomerOpen(true);
            }}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-700/20 active:scale-[0.99] transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة عميل جديد</span>
          </button>
        </div>
      </div>

      {/* 2. منطقة البحث وقائمة العملاء + تفاصيل العميل */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* القائمة اليمنى: قائمة العملاء والبحث */}
        <div className="lg:col-span-5 space-y-3">
          {/* شريط البحث */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم الزبون أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-2.5 pr-9 pl-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none shadow-xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* قائمة العملاء */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs overflow-hidden max-h-[600px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
            {filteredCustomers.length === 0 ? (
              <div className="p-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                {searchQuery ? 'لا يوجد عملاء يطابقون البحث' : 'لا يوجد عملاء مسجلون حالياً. أضف عميلاً جديداً.'}
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = selectedCustomerId === c.id;
                const hasDebt = (c.currentDebt || 0) > 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedCustomerId(c.id)}
                    className={`p-3.5 flex items-center justify-between transition cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-r-4 border-emerald-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm ${
                          hasDebt
                            ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40'
                            : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40'
                        }`}
                      >
                        {c.name.slice(0, 1)}
                      </div>
                      <div>
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white">{c.name}</h4>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                          {c.phone ? (
                            <span className="flex items-center gap-1 font-mono">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {c.phone}
                            </span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-500">بدون هاتف</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <div
                        className={`font-mono font-black text-xs ${
                          hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                        }`}
                      >
                        {c.currentDebt.toFixed(2)} {settings.currency}
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                        {hasDebt ? 'مطلوب سداد' : 'خالص الذمة'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* القائمة اليسرى: ملف وتفاصيل الزبون المحدد */}
        <div className="lg:col-span-7">
          {selectedCustomer ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 sm:p-5 shadow-xs space-y-4">
              {/* Header تفاصيل الزبون */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600 text-white font-black text-lg shadow-sm">
                    {selectedCustomer.name.slice(0, 1)}
                  </div>
                  <div>
                    <h3 className="font-black text-base text-slate-900 dark:text-white">{selectedCustomer.name}</h3>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {selectedCustomer.phone && (
                        <span className="font-mono text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          {selectedCustomer.phone}
                        </span>
                      )}
                      <span>
                        مسجل منذ: {new Date(selectedCustomer.createdAt).toLocaleDateString('ar-SA')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* أزرار الإجراءات على العميل */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCustomerStatement}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    title="تصدير كشف الحساب"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCustomer(selectedCustomer);
                      setCustomerName(selectedCustomer.name);
                      setCustomerPhone(selectedCustomer.phone || '');
                      setCustomerNotes(selectedCustomer.notes || '');
                      setIsAddCustomerOpen(true);
                    }}
                    className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition cursor-pointer"
                    title="تعديل بيانات العميل"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCustomer(selectedCustomer)}
                    className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 transition cursor-pointer"
                    title="حذف العميل"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* بطاقة الرصيد وسرعة السداد */}
              <div className="rounded-2xl bg-slate-900 border border-slate-800 text-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs text-slate-400 font-bold block mb-1">الرصيد القائم الحالي (الدين):</span>
                  <div className="flex items-baseline gap-1.5">
                    <span
                      className={`text-3xl font-black font-mono ${
                        selectedCustomer.currentDebt > 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {selectedCustomer.currentDebt.toFixed(2)}
                    </span>
                    <span className="text-sm font-bold text-slate-300">{settings.currency}</span>
                  </div>
                </div>

                {/* أزرار السداد */}
                {selectedCustomer.currentDebt > 0 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentAmount('');
                        setPaymentNotes('');
                        setIsPaymentModalOpen(true);
                      }}
                      className="px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <DollarSign className="h-4 w-4" />
                      <span>تسديد جزء من المبلغ</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPayment(undefined, true)}
                      className="px-3.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold shadow-md transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>تسديد الدين بالكامل</span>
                    </button>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>الحساب مسدد بالكامل</span>
                  </div>
                )}
              </div>

              {/* سجل الحركات والفواتير السابقة */}
              <div className="space-y-2.5 pt-2">
                <h4 className="font-bold text-xs text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Receipt className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                  <span>سجل الحركات والفواتير ({customerTransactions.length})</span>
                </h4>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 max-h-[360px] overflow-y-auto">
                  {customerTransactions.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-xs">
                      لا توجد حركات مسجلة لهذا العميل بعد
                    </div>
                  ) : (
                    customerTransactions.map((tx) => {
                      const isCredit = tx.type === 'sale_credit';
                      const formattedDate = new Date(tx.createdAt).toLocaleString('ar-SA', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      });

                      return (
                        <div key={tx.id} className="p-3 flex items-center justify-between text-xs hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                                isCredit
                                  ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400'
                                  : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {isCredit ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200">
                                {isCredit ? 'فاتورة بيع آجل' : 'دفعة سداد نقدية'}
                                {tx.invoiceNumber && (
                                  <span className="mr-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                                    (#{tx.invoiceNumber})
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                                <span>{formattedDate}</span>
                                <span>•</span>
                                <span>الكاشير: {tx.cashierName}</span>
                                {tx.notes && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">{tx.notes}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-left">
                            <div
                              className={`font-mono font-bold ${
                                isCredit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                              }`}
                            >
                              {isCredit ? '+' : '-'}
                              {tx.amount.toFixed(2)} {settings.currency}
                            </div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              المتبقي: {tx.remainingBalance.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center text-slate-400 dark:text-slate-500 text-xs flex flex-col items-center justify-center">
              <Users className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
              <p className="font-bold text-slate-600 dark:text-slate-300 text-sm">اختر عميلاً لعرض كشف الحساب وسجل الديون</p>
              <p className="text-slate-400 dark:text-slate-500 mt-1">أو أضف عميلاً جديداً من القائمة</p>
            </div>
          )}
        </div>
      </div>

      {/* ================= مودال إضافة / تعديل عميل ================= */}
      {isAddCustomerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">
                  {editingCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCustomerOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="p-4 space-y-3 text-xs">
              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">اسم العميل (مطلوب):</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: أحمد محمد"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">رقم الهاتف (اختياري):</label>
                <input
                  type="tel"
                  placeholder="05xxxxxxxx"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              {!editingCustomer && (
                <div>
                  <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">
                    رصيد دين سابق / افتتاحي (إن وجد):
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0.00"
                      value={initialDebt}
                      onChange={(e) => setInitialDebt(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 pl-12 font-mono font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 font-bold pointer-events-none">
                      {settings.currency}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">ملاحظات إضافية:</label>
                <textarea
                  rows={2}
                  placeholder="موقع السكن، عنوان العمل، إلخ..."
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2.5 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md active:scale-[0.99] transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{editingCustomer ? 'حفظ التعديلات' : 'إضافة العميل'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(false)}
                  className="px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= مودال تسديد دفعة مخصصة ================= */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">تسديد دفعة من الحساب</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => handleApplyPayment(e, false)} className="p-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-1">
                <div className="text-slate-600 dark:text-slate-300">العميل: <strong className="text-slate-900 dark:text-white">{selectedCustomer.name}</strong></div>
                <div className="text-slate-600 dark:text-slate-300">
                  إجمالي الدين الحالي: <strong className="text-rose-600 dark:text-rose-400 font-mono">{selectedCustomer.currentDebt.toFixed(2)} {settings.currency}</strong>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">المبلغ المراد سداده:</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.5"
                    min="0.1"
                    max={selectedCustomer.currentDebt}
                    required
                    placeholder="0.00"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full rounded-xl border-2 border-emerald-600 bg-white dark:bg-slate-800 p-2.5 pl-12 font-mono font-black text-lg text-slate-900 dark:text-white focus:outline-none"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 font-bold pointer-events-none">
                    {settings.currency}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-slate-700 dark:text-slate-300 font-bold block mb-1">ملاحظات السداد (اختياري):</label>
                <input
                  type="text"
                  placeholder="دفعة نقدية، تحويل بنكي، إلخ..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 py-2.5 text-xs font-bold text-white shadow-md active:scale-[0.99] transition cursor-pointer"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد السداد والخصم</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
