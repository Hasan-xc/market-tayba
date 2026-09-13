import { useState, type FormEvent } from 'react';
import { Building2, Plus, Edit2, Trash2, Check, X, MapPin, Phone, CheckCircle2, Shield } from 'lucide-react';
import { dbService } from '../services/db';
import { Branch } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onBranchesChange?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const BranchManagementModal = ({ isOpen, onClose, onBranchesChange, showToast }: Props) => {
  const [branches, setBranches] = useState<Branch[]>(dbService.getBranches());
  const [activeBranchId, setActiveBranchId] = useState<string>(dbService.getActiveBranchId());
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);

  if (!isOpen) return null;

  const refreshList = () => {
    setBranches(dbService.getBranches());
    setActiveBranchId(dbService.getActiveBranchId());
    if (onBranchesChange) onBranchesChange();
  };

  const handleSelectActiveBranch = (branchId: string) => {
    dbService.setActiveBranchId(branchId);
    setActiveBranchId(branchId);
    refreshList();
    if (showToast) {
      const b = branches.find((item) => item.id === branchId);
      showToast(branchId === 'all' ? 'تم التبديل إلى: جميع الفروع' : `تم تعيين الفرع النشط: ${b?.name}`, 'success');
    }
  };

  const handleOpenAdd = () => {
    const nextCode = `BR-0${branches.length + 1}`;
    setEditingBranch({
      name: '',
      code: nextCode,
      phone: '',
      address: '',
      isMain: false,
    });
    setIsEditing(true);
  };

  const handleOpenEdit = (b: Branch) => {
    setEditingBranch({ ...b });
    setIsEditing(true);
  };

  const handleDelete = (b: Branch) => {
    if (b.isMain) {
      alert('لا يمكن حذف الفرع الرئيسي للمتجر');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف فرع "${b.name}"؟`)) {
      try {
        dbService.deleteBranch(b.id);
        refreshList();
        if (showToast) showToast(`تم حذف فرع "${b.name}" بنجاح`, 'info');
      } catch (err: any) {
        alert(err.message || 'فشل حذف الفرع');
      }
    }
  };

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (!editingBranch || !editingBranch.name?.trim()) return;

    dbService.saveBranch(editingBranch as any);
    refreshList();
    setIsEditing(false);
    setEditingBranch(null);
    if (showToast) showToast('تم حفظ بيانات الفرع بنجاح', 'success');
  };

  const allSales = dbService.getSales();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs font-['Cairo',sans-serif]" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20 shadow-xs">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">إدارة الفروع (Multi-Branch)</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">إدارة فروع المتجر والتبديل بين الفروع للمبيعات والمخزون</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action bar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-600 dark:text-slate-400">عرض العمليات:</span>
            <button
              type="button"
              onClick={() => handleSelectActiveBranch('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeBranchId === 'all'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              🏢 جميع الفروع مجمعة
            </button>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فرع جديد</span>
          </button>
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {branches.map((b) => {
            const isSelected = activeBranchId === b.id;
            const branchSalesCount = allSales.filter((s) => (s.branchId || 'branch-main') === b.id).length;
            const branchSalesTotal = allSales
              .filter((s) => (s.branchId || 'branch-main') === b.id)
              .reduce((sum, s) => sum + s.netTotal, 0);

            return (
              <div
                key={b.id}
                className={`p-4 rounded-2xl border transition-all ${
                  isSelected
                    ? 'border-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20 shadow-md ring-1 ring-emerald-500/30'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">{b.name}</h4>
                      {b.isMain && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 font-bold text-[10px] flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          الفرع الرئيسي
                        </span>
                      )}
                      {b.code && (
                        <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 font-bold">
                          {b.code}
                        </span>
                      )}
                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-black text-[10px] flex items-center gap-1 shadow-2xs">
                          <CheckCircle2 className="w-3 h-3" />
                          الفرع النشط حالياً
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {b.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {b.phone}
                        </span>
                      )}
                      {b.address && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {b.address}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      المبيعات المسجلة: <span className="font-black text-slate-800 dark:text-slate-200">{branchSalesCount} فاتورة</span> | إجمالي القيمة: <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono">{branchSalesTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 self-end sm:self-center">
                    {!isSelected && (
                      <button
                        type="button"
                        onClick={() => handleSelectActiveBranch(b.id)}
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-600 hover:text-white dark:bg-slate-800 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        التعيين كفرع حالي
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(b)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition cursor-pointer"
                      title="تعديل بيانات الفرع"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!b.isMain && (
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                        title="حذف الفرع"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 font-bold text-xs transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>

        {/* Submodal for Add/Edit Branch */}
        {isEditing && editingBranch && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  {editingBranch.id ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
                </h4>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الفرع *
                  </label>
                  <input
                    type="text"
                    value={editingBranch.name || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, name: e.target.value })}
                    placeholder="مثال: فرع حي النزهة، الفرع الثاني"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    كود الفرع
                  </label>
                  <input
                    type="text"
                    value={editingBranch.code || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, code: e.target.value })}
                    placeholder="مثال: BR-02"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم هاتف الفرع
                  </label>
                  <input
                    type="text"
                    value={editingBranch.phone || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                    placeholder="مثال: 0501234567"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    العنوان / الموقع
                  </label>
                  <input
                    type="text"
                    value={editingBranch.address || ''}
                    onChange={(e) => setEditingBranch({ ...editingBranch, address: e.target.value })}
                    placeholder="مثال: الرياض - شارع الملك فهد"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>حفظ الفرع</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
