import { useState, type FormEvent } from 'react';
import { Users, Plus, KeyRound, Trash2, Check, X, Shield, UserCheck, AlertCircle } from 'lucide-react';
import { dbService } from '../services/db';
import { UserAccount, UserRole } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUsersChange?: () => void;
  showToast?: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const UsersManagementModal = ({ isOpen, onClose, onUsersChange, showToast }: Props) => {
  const [users, setUsers] = useState<UserAccount[]>(dbService.getUsers());
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({
    username: '',
    name: '',
    password: '12345',
    role: 'cashier' as UserRole,
    branchId: 'branch-main',
  });
  const [error, setError] = useState('');

  const branches = dbService.getBranches();

  if (!isOpen) return null;

  const refreshList = () => {
    setUsers(dbService.getUsers());
    if (onUsersChange) onUsersChange();
  };

  const handleAddUser = (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUsername = newUser.username.trim().toLowerCase();
    if (!cleanUsername) {
      setError('يرجى كتابة اسم المستخدم');
      return;
    }

    if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
      setError('اسم المستخدم هذا موجود بالفعل، يرجى اختيار اسم مستخدم آخر');
      return;
    }

    const branch = branches.find((b) => b.id === newUser.branchId);

    dbService.saveUser({
      username: cleanUsername,
      name: newUser.name.trim() || cleanUsername,
      password: newUser.password.trim() || '12345',
      role: newUser.role,
      branchId: newUser.branchId,
      branchName: branch ? branch.name : 'الفرع الرئيسي',
      mustChangePassword: true,
    });

    refreshList();
    setIsAdding(false);
    setNewUser({
      username: '',
      name: '',
      password: '12345',
      role: 'cashier',
      branchId: 'branch-main',
    });
    if (showToast) showToast('تم إضافة المستخدم بنجاح مع كلمة المرور الافتراضية 12345', 'success');
  };

  const handleResetPassword = (u: UserAccount) => {
    if (confirm(`هل تريد إعادة تعيين كلمة مرور "${u.name}" إلى الافتراضية (12345)؟`)) {
      // saveUser وحده يكفي: يخزن الهاش (طبقة db تهاش قبل الحفظ) ويعيد تفعيل
      // إلزام تغيير كلمة المرور. الاستدعاءان السابقان كانا يكتبان مرتين.
      dbService.saveUser({
        ...u,
        password: '12345',
        mustChangePassword: true,
      });
      refreshList();
      if (showToast) showToast(`تمت استعادة كلمة المرور للمستخدم ${u.name} إلى 12345`, 'info');
    }
  };

  const handleDeleteUser = (u: UserAccount) => {
    if (u.username === 'ahmed') {
      alert('لا يمكن حذف حساب المدير الرئيسي (ahmed)');
      return;
    }
    if (confirm(`هل أنت متأكد من حذف حساب "${u.name}"؟`)) {
      try {
        dbService.deleteUser(u.id);
        refreshList();
        if (showToast) showToast(`تم حذف المستخدم ${u.name}`, 'info');
      } catch (err: any) {
        alert(err.message || 'فشل حذف المستخدم');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs font-['Cairo',sans-serif]" dir="rtl">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center border border-emerald-500/20 shadow-xs">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">إدارة المستخدمين والكاشيرات</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">حسابات تسجيل الدخول، الصلاحيات، وربط الموظفين بالفروع</p>
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
        <div className="py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800/60">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
            عدد الحسابات النشطة: <span className="font-mono text-emerald-600 dark:text-emerald-400">{users.length}</span>
          </span>
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مستخدم جديد</span>
          </button>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto py-3 space-y-3">
          {users.map((u) => {
            const isRootAdmin = u.username === 'ahmed';
            const userBranch = branches.find((b) => b.id === u.branchId)?.name || u.branchName || 'الفرع الرئيسي';

            return (
              <div
                key={u.id}
                className="p-3.5 sm:p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850 hover:border-slate-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white">{u.name}</h4>
                    <span className="font-mono text-xs bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400 font-bold">
                      @{u.username}
                    </span>
                    {u.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-[10px] font-bold flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        مدير نظام
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold flex items-center gap-1">
                        <UserCheck className="w-3 h-3" />
                        كاشير نقطة بيع
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      الفرع: <span className="font-bold text-slate-700 dark:text-slate-300">{u.branchId === 'all' ? 'جميع الفروع' : userBranch}</span>
                    </span>
                    {u.mustChangePassword && (
                      <span className="text-amber-600 dark:text-amber-400 font-bold text-[11px]">
                        ⚠️ يستخدم كلمة المرور الافتراضية (12345)
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleResetPassword(u)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 dark:text-amber-300 text-xs font-bold transition cursor-pointer"
                    title="إعادة تعيين كلمة المرور إلى 12345"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>إعادة تعيين لـ 12345</span>
                  </button>
                  {!isRootAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="حذف المستخدم"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
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

        {/* Modal for adding user */}
        {isAdding && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
            <div className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 animate-fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-black text-slate-900 dark:text-white">إضافة مستخدم أو كاشير جديد</h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && (
                <div className="mt-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleAddUser} className="mt-4 space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم المستخدم لتسجيل الدخول (Username بالإنجليزية أو أرقام) *
                  </label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value.toLowerCase().replace(/\s+/g, '') })}
                    placeholder="مثال: khalid, cashier2"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الاسم الظاهر (في الفواتير والتقارير) *
                  </label>
                  <input
                    type="text"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="مثال: خالد العتيبي، كاشير المساء"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الصلاحية (الدور)
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="cashier">كاشير (البيع وإصدار الفواتير والمرتجعات)</option>
                    <option value="admin">مدير نظام (تحكم كامل بجميع الإعدادات والتقارير)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الفرع التابع له
                  </label>
                  <select
                    value={newUser.branchId}
                    onChange={(e) => setNewUser({ ...newUser, branchId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    {newUser.role === 'admin' && <option value="all">جميع الفروع</option>}
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.isMain ? '(الرئيسي)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-slate-700 dark:text-slate-300">
                      كلمة المرور الأولية
                    </label>
                    <span className="text-[10px] text-slate-400">الافتراضية: 12345</span>
                  </div>
                  <input
                    type="text"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="12345"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    سيُطلب من المستخدم تغيير كلمة المرور فور أول تسجيل دخول.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="px-3 py-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>إنشاء الحساب</span>
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
