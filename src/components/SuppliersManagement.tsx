import { useState, useMemo, type FormEvent } from 'react';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Building2, 
  MapPin, 
  FileSpreadsheet, 
  Trash2, 
  Edit3, 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { Supplier, StoreSettings } from '../types';
import { dbService } from '../services/db';

interface Props {
  settings: StoreSettings;
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const SuppliersManagement = ({ settings, onDataChange, showToast }: Props) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(dbService.getSuppliers());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [selectedSupplierForBalance, setSelectedSupplierForBalance] = useState<Supplier | null>(null);
  const [balanceAmount, setBalanceAmount] = useState('');
  const [balanceAction, setBalanceAction] = useState<'pay' | 'add_debt'>('pay');
  const [balanceNotes, setBalanceNotes] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    address: '',
    balance: '0',
    notes: '',
  });

  const refreshSuppliers = () => {
    setSuppliers(dbService.getSuppliers());
    onDataChange();
  };

  const filteredSuppliers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.company && s.company.toLowerCase().includes(term)) ||
        (s.phone && s.phone.includes(term))
    );
  }, [suppliers, searchTerm]);

  const totalOwed = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (s.balance || 0), 0);
  }, [suppliers]);

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      company: '',
      phone: '',
      address: '',
      balance: '0',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditingSupplier(s);
    setFormData({
      name: s.name,
      company: s.company || '',
      phone: s.phone || '',
      address: s.address || '',
      balance: (s.balance || 0).toString(),
      notes: s.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast('يرجى كتابة اسم المورد', 'warn');
      return;
    }

    try {
      dbService.saveSupplier({
        id: editingSupplier ? editingSupplier.id : undefined,
        name: formData.name,
        company: formData.company,
        phone: formData.phone,
        address: formData.address,
        balance: parseFloat(formData.balance) || 0,
        notes: formData.notes,
      });

      showToast(editingSupplier ? 'تم تحديث بيانات المورد' : 'تمت إضافة المورد بنجاح', 'success');
      setIsModalOpen(false);
      refreshSuppliers();
    } catch (err: any) {
      showToast(err.message || 'خطأ في الحفظ', 'error');
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`هل أنت متأكد من حذف المورد "${name}"؟`)) {
      dbService.deleteSupplier(id);
      showToast('تم حذف المورد', 'info');
      refreshSuppliers();
    }
  };

  const handleOpenBalanceModal = (s: Supplier) => {
    setSelectedSupplierForBalance(s);
    setBalanceAmount('');
    setBalanceAction('pay');
    setBalanceNotes('');
    setIsBalanceModalOpen(true);
  };

  const handleBalanceSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierForBalance) return;
    const amt = parseFloat(balanceAmount);
    if (!amt || amt <= 0) {
      showToast('يرجى إدخال مبلغ صحيح', 'warn');
      return;
    }

    const currentBal = selectedSupplierForBalance.balance || 0;
    const newBal = balanceAction === 'pay' ? Math.max(0, currentBal - amt) : currentBal + amt;

    dbService.saveSupplier({
      id: selectedSupplierForBalance.id,
      name: selectedSupplierForBalance.name,
      balance: newBal,
      notes: `${selectedSupplierForBalance.notes || ''} [${balanceAction === 'pay' ? 'سداد دفعة' : 'توريد آجل'}: ${amt} ${settings.currency} - ${balanceNotes || ''}]`.trim(),
    });

    showToast(
      balanceAction === 'pay' ? `تم سداد ${amt} ${settings.currency} للمورد` : `تمت إضافة فاتورة توريد بقيمة ${amt} ${settings.currency}`,
      'success'
    );
    setIsBalanceModalOpen(false);
    refreshSuppliers();
  };

  const handleExportCSV = () => {
    const csv = dbService.exportSuppliersCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `suppliers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف الموردين بصيغة CSV', 'success');
  };

  return (
    <div className="space-y-5 select-none font-['Cairo',sans-serif]" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-l from-emerald-900 to-slate-900 text-white p-5 rounded-2xl border border-emerald-800/40 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
            <Truck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">إدارة الموردين والحسابات الآجلة</h2>
            <p className="text-xs sm:text-sm text-emerald-100/80">سجل شركات التوريد، الفواتير المستحقة، وسداد الدفعات</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold border border-white/20 backdrop-blur-xs transition cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
            <span>تصدير Excel/CSV</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition cursor-pointer active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة مورد جديد</span>
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي الموردين المسجلين</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">{suppliers.length}</span>
            <span className="text-xs text-slate-500">مورد / شركة</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">إجمالي الديون المستحقة للموردين</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {totalOwed.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{settings.currency}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 text-slate-900 dark:text-white shadow-xs transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-bold block mb-1">موردين بحسابات دائنة قائمة</span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {suppliers.filter((s) => (s.balance || 0) > 0).length}
            </span>
            <span className="text-xs text-slate-500">مورد</span>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ابحث عن مورد بالاسم، الشركة، أو رقم الهاتف..."
          className="w-full pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Suppliers Grid / List */}
      {filteredSuppliers.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-2xl border border-slate-200/90 dark:border-slate-800/80 text-slate-500 dark:text-slate-400">
          <Truck className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
          <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا يوجد موردين مطابقين للبحث</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">اضغط على زر "إضافة مورد جديد" لتسجيل أول مورد في المتجر</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map((sup) => {
            const hasDebt = (sup.balance || 0) > 0;
            return (
              <div
                key={sup.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-slate-700 transition rounded-2xl p-4 text-slate-900 dark:text-white flex flex-col justify-between shadow-xs relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-slate-800 text-emerald-700 dark:text-emerald-400 font-black text-sm">
                        {sup.name.slice(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-black text-base text-slate-900 dark:text-white">{sup.name}</h3>
                        {sup.company && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            <Building2 className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            <span>{sup.company}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(sup)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition"
                        title="تعديل المورد"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(sup.id, sup.name)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                        title="حذف المورد"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 py-2 border-y border-slate-100 dark:border-slate-800/80 my-2">
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span className="font-mono">{sup.phone}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                        <span>{sup.address}</span>
                      </div>
                    )}
                    {sup.notes && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 mt-1">"{sup.notes}"</p>
                    )}
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold block">الرصيد المستحق:</span>
                    <span
                      className={`text-base font-black font-mono ${
                        hasDebt ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                    >
                      {(sup.balance || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{settings.currency}</span>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleOpenBalanceModal(sup)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-slate-800 hover:bg-emerald-600 hover:text-white dark:hover:bg-slate-700 text-emerald-700 dark:text-slate-200 rounded-xl text-xs font-bold transition border border-emerald-200 dark:border-slate-700 cursor-pointer"
                  >
                    <DollarSign className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>سداد / توريد</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Supplier Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-md bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base">{editingSupplier ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">اسم المورد أو المندوب *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أحمد عبد الله"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">اسم الشركة أو المصنع</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="مثال: شركة الألبان الوطنية"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">رقم الهاتف</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">العنوان أو المنطقة</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة، الشارع، رقم المستودع"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">الرصيد الدائن الافتتاحي ({settings.currency})</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.balance}
                  onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">ملاحظات إضافية</label>
                <textarea
                  rows={2}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="شروط الدفع، مواعيد التوريد الأسبوعية..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold transition cursor-pointer"
                >
                  {editingSupplier ? 'حفظ التعديلات' : 'إضافة المورد'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Balance Payment / Invoice Modal */}
      {isBalanceModalOpen && selectedSupplierForBalance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/70 dark:bg-slate-950/80 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-base">تسوية حساب: {selectedSupplierForBalance.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsBalanceModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200/90 dark:border-slate-700/60 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">الرصيد الحالي المستحق:</span>
              <span className="font-mono font-black text-sm text-rose-600 dark:text-rose-400">
                {(selectedSupplierForBalance.balance || 0).toFixed(2)} {settings.currency}
              </span>
            </div>

            <form onSubmit={handleBalanceSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setBalanceAction('pay')}
                  className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    balanceAction === 'pay'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ArrowDownLeft className="h-4 w-4" />
                  <span>سداد دفعة للمورد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setBalanceAction('add_debt')}
                  className={`py-2 rounded-xl font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                    balanceAction === 'add_debt'
                      ? 'bg-rose-600 text-white shadow-md'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>فاتورة توريد آجل</span>
                </button>
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">
                  {balanceAction === 'pay' ? 'المبلغ المسدد' : 'قيمة البضاعة المستلمة'} ({settings.currency}) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  value={balanceAmount}
                  onChange={(e) => setBalanceAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-slate-900 dark:text-white font-mono text-base font-bold focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1 font-bold">بيان أو رقم سند / فاتورة</label>
                <input
                  type="text"
                  value={balanceNotes}
                  onChange={(e) => setBalanceNotes(e.target.value)}
                  placeholder="مثال: سند صرف رقم 441 - دفعة نقداً"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-900 dark:text-white text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2.5 rounded-xl font-bold transition cursor-pointer"
                >
                  تأكيد العملية
                </button>
                <button
                  type="button"
                  onClick={() => setIsBalanceModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold transition cursor-pointer"
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
