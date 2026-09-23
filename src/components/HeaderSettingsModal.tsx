import { type FormEvent, type ChangeEvent, type RefObject } from 'react';
import {
  Settings,
  X,
  CheckCircle2,
  Sun,
  Moon,
  Store,
  Printer,
  Database,
  Download,
  Upload,
  Mail,
  FileSpreadsheet,
  CalendarDays,
  Code2,
  Users,
  Building2,
  KeyRound,
  RefreshCw,
  Save,
} from 'lucide-react';
import { StoreSettings, UserAccount } from '../types';

const BACKUP_SECTIONS: { key: string; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'sales', label: 'المبيعات' },
  { key: 'products', label: 'المنتجات' },
  { key: 'stock_audit', label: 'حركات المخزون' },
  { key: 'suppliers', label: 'الموردين' },
  { key: 'customers', label: 'العملاء' },
  { key: 'returns', label: 'المرتجعات' },
  { key: 'valuation', label: 'تقييم المخزون' },
];

interface HeaderSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  localSettings: StoreSettings;
  setLocalSettings: (s: StoreSettings) => void;
  saveSuccessMsg: boolean;
  handleSaveSettings: (e: FormEvent) => void;
  handleExportBackup: () => void;
  handleImportBackup: (e: ChangeEvent<HTMLInputElement>) => void;
  importFileInputRef: RefObject<HTMLInputElement | null>;
  csvRange: 'today' | 'week' | 'month' | 'custom';
  setCsvRange: (r: 'today' | 'week' | 'month' | 'custom') => void;
  csvDateFrom: string;
  setCsvDateFrom: (v: string) => void;
  csvDateTo: string;
  setCsvDateTo: (v: string) => void;
  csvSections: string[];
  toggleCsvSection: (key: string) => void;
  csvMsg: string;
  handleDownloadCsvBackup: () => void;
  toggleAutoBackupSection: (key: string) => void;
  isAdmin: boolean;
  onOpenBranches?: () => void;
  onOpenUsers?: () => void;
  onOpenChangePassword: () => void;
  currentUser: UserAccount | null;
  handleFullResyncFromCloud: () => void;
  isResyncing: boolean;
  onOpenSqlModal: () => void;
}

export const HeaderSettingsModal = ({
  isOpen,
  onClose,
  localSettings,
  setLocalSettings,
  saveSuccessMsg,
  handleSaveSettings,
  handleExportBackup,
  handleImportBackup,
  importFileInputRef,
  csvRange,
  setCsvRange,
  csvDateFrom,
  setCsvDateFrom,
  csvDateTo,
  setCsvDateTo,
  csvSections,
  toggleCsvSection,
  csvMsg,
  handleDownloadCsvBackup,
  toggleAutoBackupSection,
  isAdmin,
  onOpenBranches,
  onOpenUsers,
  onOpenChangePassword,
  currentUser,
  handleFullResyncFromCloud,
  isResyncing,
  onOpenSqlModal,
}: HeaderSettingsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-4 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold text-sm">إعدادات المتجر والمزامنة السحابية</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSaveSettings} className="p-4 space-y-4 overflow-y-auto text-xs">
          {saveSuccessMsg && (
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-xl flex items-center gap-2 font-bold animate-fade-in">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>تم حفظ الإعدادات وتحديث النظام بنجاح!</span>
            </div>
          )}

          {/* مظهر النظام والمود */}
          <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Sun className="h-4 w-4 text-amber-500" />
              مظهر النظام (المود النهاري / الليلي)
            </h4>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, theme: 'light' })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  localSettings.theme === 'light'
                    ? 'bg-amber-400 text-slate-950 border-amber-500 font-black shadow-xs ring-2 ring-amber-400/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Sun className="h-4 w-4 text-amber-500" />
                <span>نهاري (أبيض)</span>
              </button>
              <button
                type="button"
                onClick={() => setLocalSettings({ ...localSettings, theme: 'dark' })}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  localSettings.theme !== 'light'
                    ? 'bg-indigo-600 text-white border-indigo-500 font-black shadow-xs ring-2 ring-indigo-500/20'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <Moon className="h-4 w-4 text-indigo-400" />
                <span>ليلي (داكن)</span>
              </button>
            </div>
          </div>

          {/* معلومات المحل */}
          <div className="space-y-2.5">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Store className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              بيانات المتجر والفاتورة
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">اسم المحل / المتجر:</label>
                <input
                  type="text"
                  value={localSettings.storeName}
                  onChange={(e) => setLocalSettings({ ...localSettings, storeName: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">هاتف التواصل:</label>
                <input
                  type="text"
                  value={localSettings.storePhone}
                  onChange={(e) => setLocalSettings({ ...localSettings, storePhone: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">الرقم الضريبي (ZATCA):</label>
                <input
                  type="text"
                  value={localSettings.storeVatNumber || ''}
                  placeholder="300123456700003"
                  onChange={(e) => setLocalSettings({ ...localSettings, storeVatNumber: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">العملة:</label>
                <input
                  type="text"
                  value={localSettings.currency}
                  onChange={(e) => setLocalSettings({ ...localSettings, currency: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-1">العنوان:</label>
              <input
                type="text"
                value={localSettings.storeAddress}
                onChange={(e) => setLocalSettings({ ...localSettings, storeAddress: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-1">رسالة تذييل الفاتورة:</label>
              <input
                type="text"
                value={localSettings.receiptFooterMessage}
                onChange={(e) => setLocalSettings({ ...localSettings, receiptFooterMessage: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* إعدادات الطباعة السريعة وتجربة الكاشير */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Printer className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              خيارات الطباعة السريعة والمعاينة
            </h4>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoPrintReceipt ?? false}
                  onChange={(e) => setLocalSettings({ ...localSettings, autoPrintReceipt: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">طباعة الإيصال آلياً فور إتمام الفاتورة (Auto Print)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">إرسال أمر الطباعة للطابعة الحرارية تلقائياً فورياً بدون انتظار</span>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.skipReceiptPreviewModal ?? false}
                  onChange={(e) => setLocalSettings({ ...localSettings, skipReceiptPreviewModal: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">تخطي نافذة المعاينة المنبثقة (بيع صاروخي بدون توقف)</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">عدم حجب الشاشة بالمعاينة مع بقاء شريط الفاتورة الأخيرة لمعاينتها متى رغبت</span>
                </div>
              </label>
            </div>
          </div>

          {/* النسخ الاحتياطي اليدوي والتصدير / الاستيراد */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Database className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              النسخ الاحتياطي اليدوي وحفظ البيانات
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              تصدير ملف يحتوي على كامل المنتجات، الفواتير، العملاء، الموردين، والورديات بأمان.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 text-xs font-bold transition cursor-pointer active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span>تصدير ملف JSON</span>
              </button>

              <button
                type="button"
                onClick={() => importFileInputRef.current?.click()}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-bold transition cursor-pointer active:scale-95"
              >
                <Upload className="h-3.5 w-3.5" />
                <span>استيراد ملف JSON</span>
              </button>
              <input
                ref={importFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportBackup}
                className="hidden"
              />
            </div>
          </div>

          {/* البريد الإلكتروني المخصص للنسخ الاحتياطي */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              النسخ الاحتياطي التلقائي عبر البريد
            </h4>
            <div>
              <label className="text-slate-600 dark:text-slate-400 block mb-1">البريد الإلكتروني لاستلام النسخ الاحتياطية:</label>
              <input
                type="email"
                value={localSettings.backupEmail || ''}
                placeholder="market@example.com"
                onChange={(e) => setLocalSettings({ ...localSettings, backupEmail: e.target.value })}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
              />
            </div>
          </div>

          {/* النسخ الاحتياطي وتصدير البيانات (CSV) — يدوي + تلقائي مجدول */}
          <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              النسخ الاحتياطي وتصدير البيانات (CSV)
            </h4>

            {/* نسخ يدوي */}
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 block text-[11px] flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                نسخ يدوي — تنزيل ملفات CSV منفصلة
              </span>
              <div className={csvRange === 'custom' ? 'grid grid-cols-1 sm:grid-cols-3 gap-2' : 'grid grid-cols-1 sm:grid-cols-2 gap-2'}>
                <div>
                  <label className="text-slate-600 dark:text-slate-400 block mb-1">نطاق التاريخ:</label>
                  <select
                    value={csvRange}
                    onChange={(e) => setCsvRange(e.target.value as 'today' | 'week' | 'month' | 'custom')}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="today">اليوم</option>
                    <option value="week">آخر أسبوع</option>
                    <option value="month">آخر شهر</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>
                {csvRange === 'custom' && (
                  <>
                    <div>
                      <label className="text-slate-600 dark:text-slate-400 block mb-1">من تاريخ:</label>
                      <input
                        type="date"
                        value={csvDateFrom}
                        onChange={(e) => setCsvDateFrom(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-slate-600 dark:text-slate-400 block mb-1">إلى تاريخ:</label>
                      <input
                        type="date"
                        value={csvDateTo}
                        onChange={(e) => setCsvDateTo(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">الأقسام المطلوب تصديرها:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {BACKUP_SECTIONS.map((opt) => (
                    <label key={opt.key} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={csvSections.includes(opt.key)}
                        onChange={() => toggleCsvSection(opt.key)}
                        className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0"
                      />
                      <span className="font-bold">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={handleDownloadCsvBackup}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm shadow-emerald-950/20 transition cursor-pointer active:scale-95"
              >
                <Download className="h-3.5 w-3.5" />
                <span>تنزيل نسخة الآن</span>
              </button>
              {csvMsg && (
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">{csvMsg}</p>
              )}
            </div>

            {/* نسخ تلقائي مجدول */}
            <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 space-y-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.autoBackupEnabled ?? false}
                  onChange={(e) => setLocalSettings({ ...localSettings, autoBackupEnabled: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 shrink-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-slate-800 dark:text-slate-200 block">تفعيل النسخ التلقائي المجدول</span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">فحص محلي عند فتح التطبيق — عند الاستحقاق تُنزَّل الملفات تلقائياً</span>
                </div>
              </label>

              {/* توضيح حدود الميزة (المسار أ بدون خادم) */}
              <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg p-2 flex items-start gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>الإرسال حاليًا تنزيل محلي + فتح البريد بملخص نصي دون مرفقات تلقائية — الإرفاق الفعلي يتطلب ربط خدمة بريد خارجية لاحقًا.</span>
              </p>

              {(localSettings.autoBackupEnabled ?? false) && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-slate-600 dark:text-slate-400 block mb-1">تكرار النسخة:</label>
                      <select
                        value={localSettings.autoBackupFrequency || 'weekly'}
                        onChange={(e) => setLocalSettings({ ...localSettings, autoBackupFrequency: e.target.value as 'daily' | 'weekly' | 'monthly' })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      >
                        <option value="daily">يومي</option>
                        <option value="weekly">أسبوعي</option>
                        <option value="monthly">شهري</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-slate-600 dark:text-slate-400 block mb-1">البريد المستلم للملخص:</label>
                      <input
                        type="email"
                        value={localSettings.backupEmail || ''}
                        placeholder="market@example.com"
                        onChange={(e) => setLocalSettings({ ...localSettings, backupEmail: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-2 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-slate-600 dark:text-slate-400 block mb-1">أقسام النسخة التلقائية:</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {BACKUP_SECTIONS.map((opt) => (
                        <label key={`auto-${opt.key}`} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={(localSettings.autoBackupSections || ['all']).includes(opt.key)}
                            onChange={() => toggleAutoBackupSection(opt.key)}
                            className="rounded text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 shrink-0"
                          />
                          <span className="font-bold">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* إعدادات السحابة والمزامنة */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Database className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
              اتصال Supabase السحابي
            </h4>
            <div className="space-y-2">
              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">رابط المشروع (Supabase URL):</label>
                <input
                  type="text"
                  value={localSettings.supabaseUrl || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, supabaseUrl: e.target.value })}
                  placeholder="https://xyzcompany.supabase.co"
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-600 dark:text-slate-400 block mb-1">مفتاح الوصول (Anon Key):</label>
                <input
                  type="password"
                  value={localSettings.supabaseAnonKey || ''}
                  onChange={(e) => setLocalSettings({ ...localSettings, supabaseAnonKey: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 font-mono text-xs text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-800 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <button
                type="button"
                onClick={onOpenSqlModal}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold transition border border-slate-200 dark:border-slate-700 cursor-pointer active:scale-95"
              >
                <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>عرض ونسخ كود SQL لـ Supabase</span>
              </button>
            </div>
          </div>

          {/* إدارة الفروع والمستخدمين في الإعدادات */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              المستخدمون والفروع (Multi-Branch)
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {isAdmin && onOpenBranches && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenBranches();
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 text-xs font-bold transition border border-blue-200 dark:border-blue-800 cursor-pointer active:scale-95"
                >
                  <Building2 className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  <span>إدارة الفروع</span>
                </button>
              )}
              {isAdmin && onOpenUsers && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenUsers();
                  }}
                  className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition border border-emerald-200 dark:border-emerald-800 cursor-pointer active:scale-95"
                >
                  <Users className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>إدارة المستخدمين</span>
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenChangePassword();
              }}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-300 text-xs font-bold transition border border-amber-200 dark:border-amber-800 cursor-pointer active:scale-95"
            >
              <KeyRound className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              <span>تغيير كلمة المرور الخاصة بحسابي ({currentUser?.name || 'أحمد'})</span>
            </button>
          </div>

          {/* قسم متقدم: إعادة مزامنة كاملة من السحابة (تصفير الكاش المحلي) */}
          <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              إعادة مزامنة كاملة من السحابة (أداة متقدمة)
            </h4>
            <p className="text-[11px] leading-snug text-slate-500 dark:text-slate-400">
              تصفير الكاش المحلي القديم للمنتجات والعملاء والموردين وحركات المخزون والتحويلات، ثم إعادة سحبهم فوراً من Supabase.
              المبيعات والمرتجعات والديون والورديات لن تتأثر إطلاقاً، ولا يُحذف أي شيء من السحابة.
            </p>
            <button
              type="button"
              onClick={handleFullResyncFromCloud}
              disabled={isResyncing}
              className={`w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 border ${
                isResyncing
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                  : 'bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900/60'
              }`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isResyncing ? 'animate-spin' : ''}`} />
              <span>{isResyncing ? 'جاري تصفير الكاش وإعادة السحب...' : 'إعادة مزامنة كاملة من السحابة'}</span>
            </button>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">
              تنفيذ يدوي فقط — الزر يرفض العمل إذا كان طابور الأوفلاين يحتوي عمليات غير متزامنة.
            </p>
          </div>

          {/* زر الحفظ */}
          <div className="pt-2">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 font-bold text-white shadow-md active:scale-[0.99] transition cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>حفظ التغييرات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
