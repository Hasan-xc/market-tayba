import { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  FileSpreadsheet, 
  User, 
  Barcode, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  AlertTriangle,
  RotateCcw,
  PackagePlus,
  Trash2,
  Tag,
  Boxes,
  PackageMinus,
  Truck
} from 'lucide-react';
import { StockAuditLog, StoreSettings } from '../types';
import { dbService } from '../services/db';

interface Props {
  settings: StoreSettings;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const StockAuditView = ({ settings, showToast }: Props) => {
  const [logs, setLogs] = useState<StockAuditLog[]>(dbService.getStockAuditLogs());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // الاستماع التلقائي المباشر لأي حركة مخزون جديدة
  useEffect(() => {
    const unsubscribe = dbService.subscribe(() => {
      setLogs(dbService.getStockAuditLogs());
    });
    return () => unsubscribe();
  }, []);

  const refreshLogs = () => {
    setLogs(dbService.getStockAuditLogs());
    showToast('تم تحديث سجل حركات المخزون', 'info');
  };

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // فلترة بنوع الحركة
      if (selectedType !== 'all' && log.type !== selectedType) {
        return false;
      }

      // فلترة بالتاريخ
      if (dateFilter !== 'all') {
        const logDate = new Date(log.createdAt);
        const now = new Date();
        if (dateFilter === 'today') {
          if (logDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'week') {
          const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (logDate < sevenDaysAgo) return false;
        } else if (dateFilter === 'month') {
          const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (logDate < thirtyDaysAgo) return false;
        }
      }

      // فلترة بنص البحث
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim();
        const matchName = log.productName.toLowerCase().includes(term);
        const matchBarcode = log.barcode.includes(term);
        const matchReason = (log.reason || '').toLowerCase().includes(term);
        const matchCashier = (log.performedBy || '').toLowerCase().includes(term);
        if (!matchName && !matchBarcode && !matchReason && !matchCashier) return false;
      }

      return true;
    });
  }, [logs, selectedType, dateFilter, searchTerm]);

  const handleExportCSV = () => {
    const csv = dbService.exportStockAuditCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `stock-audit-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('تم تصدير سجل حركات المخزون بصيغة CSV بنجاح', 'success');
  };

  const getTypeBadge = (type: StockAuditLog['type']) => {
    switch (type) {
      case 'product_created':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
            <PackagePlus className="h-3.5 w-3.5" />
            إضافة صنف جديد
          </span>
        );
      case 'product_deleted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
            <Trash2 className="h-3.5 w-3.5" />
            حذف صنف نهائياً
          </span>
        );
      case 'price_update':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
            <Tag className="h-3.5 w-3.5" />
            تعديل أسعار
          </span>
        );
      case 'sale':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
            <ArrowDownLeft className="h-3.5 w-3.5" />
            بيع فاتورة
          </span>
        );
      case 'purchase':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50">
            <ArrowUpRight className="h-3.5 w-3.5" />
            توريد / شراء
          </span>
        );
      case 'return':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-900/50">
            <RotateCcw className="h-3.5 w-3.5" />
            إرجاع مستودع
          </span>
        );
      case 'manual_adjustment':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50">
            <RefreshCw className="h-3.5 w-3.5" />
            تعديل جردي
          </span>
        );
      case 'scrap':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
            <AlertTriangle className="h-3.5 w-3.5" />
            تالف / إتلاف
          </span>
        );
      case 'damage':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-900/50">
            <PackageMinus className="h-3.5 w-3.5" />
            إتلاف / تالف
          </span>
        );
      case 'vendor_return':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50">
            <Truck className="h-3.5 w-3.5" />
            إرجاع للمورد
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {type}
          </span>
        );
    }
  };

  // إحصائيات سريعة
  const stats = useMemo(() => {
    let salesCount = 0;
    let purchasesCount = 0;
    let additionsCount = 0;
    let deletionsCount = 0;

    logs.forEach((l) => {
      if (l.type === 'sale') salesCount++;
      else if (l.type === 'purchase') purchasesCount++;
      else if (l.type === 'product_created') additionsCount++;
      else if (l.type === 'product_deleted') deletionsCount++;
    });

    return { salesCount, purchasesCount, additionsCount, deletionsCount, total: logs.length };
  }, [logs]);

  return (
    <div className="space-y-5 select-none font-['Cairo',sans-serif] animate-fade-in pb-16" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-black">سجل تدقيق وحركات المخزون الشامل</h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              تتبع آلي وفوري لأي حركة إضافة أصناف، بيع، شراء وتوريد، تعديل جردي، أو حذف صنف
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={refreshLogs}
            className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 transition cursor-pointer"
            title="تحديث البيانات"
          >
            <RefreshCw className="h-4 w-4" />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md shadow-emerald-950/40 transition cursor-pointer active:scale-95"
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>تصدير Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>إجمالي الحركات</span>
            <Boxes className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white mt-1 font-mono">{stats.total}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">مسجلة في السجل</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
            <span>أصناف مضافة جديدة</span>
            <PackagePlus className="h-4 w-4" />
          </div>
          <div className="text-xl font-black text-emerald-700 dark:text-emerald-400 mt-1 font-mono">{stats.additionsCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">تم تسجيلها بالمخزن</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-xs text-rose-600 dark:text-rose-400">
            <span>حركات البيع</span>
            <ArrowDownLeft className="h-4 w-4" />
          </div>
          <div className="text-xl font-black text-rose-700 dark:text-rose-400 mt-1 font-mono">{stats.salesCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">صرف مبيعات كاشير</div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div className="flex items-center justify-between text-xs text-amber-600 dark:text-amber-400">
            <span>أصناف محذوفة</span>
            <Trash2 className="h-4 w-4" />
          </div>
          <div className="text-xl font-black text-amber-700 dark:text-amber-400 mt-1 font-mono">{stats.deletionsCount}</div>
          <div className="text-[10px] text-slate-400 mt-0.5">حذف من النظام</div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center gap-3 transition-colors">
        {/* Search */}
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث باسم الصنف، الباركود، المسؤول، أو سبب الحركة..."
            className="w-full pl-4 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Type Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'all'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            الكل ({logs.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('sale')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'sale'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            مبيعات
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('product_created')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'product_created'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            إضافة أصناف
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('purchase')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'purchase'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            توريد
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('return')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'return'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            مرتجع
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('manual_adjustment')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'manual_adjustment'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            تعديل جردي
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('product_deleted')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'product_deleted'
                ? 'bg-rose-700 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            حذف أصناف
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('damage')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'damage'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            إتلاف
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('vendor_return')}
            className={`px-3 py-2 rounded-xl text-xs font-bold shrink-0 transition cursor-pointer ${
              selectedType === 'vendor_return'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            إرجاع مورد
          </button>
        </div>

        {/* Date Filter */}
        <div className="flex items-center gap-1.5 w-full md:w-auto shrink-0">
          {(['all', 'today', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              type="button"
              onClick={() => setDateFilter(period)}
              className={`px-2.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                dateFilter === period
                  ? 'bg-slate-800 dark:bg-slate-700 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {period === 'all' ? 'كافة الفترات' : period === 'today' ? 'اليوم' : period === 'week' ? '7 أيام' : '30 يوماً'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm transition-colors">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <ClipboardList className="h-12 w-12 mx-auto mb-3 text-slate-300 dark:text-slate-600" />
            <p className="font-bold text-base text-slate-700 dark:text-slate-300">لا توجد حركات مخزون مسجلة مطابقة للبحث</p>
            <p className="text-xs text-slate-500 mt-1">يتم تسجيل حركات المخزون آلياً عند إضافة أو بيع أو حذف أو تعديل أي صنف</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 uppercase font-bold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-4 py-3.5">التاريخ والوقت</th>
                  <th className="px-4 py-3.5">الصنف</th>
                  <th className="px-4 py-3.5">نوع الحركة</th>
                  <th className="px-4 py-3.5 text-center">الرصيد السابق</th>
                  <th className="px-4 py-3.5 text-center">التغيير (Delta)</th>
                  <th className="px-4 py-3.5 text-center">الرصيد الجديد</th>
                  <th className="px-4 py-3.5">السبب / البيان</th>
                  <th className="px-4 py-3.5">المسؤول</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium text-slate-700 dark:text-slate-300">
                {filteredLogs.map((log) => {
                  const isPositive = log.quantityDelta > 0;
                  const isZero = log.quantityDelta === 0;

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                        {new Date(log.createdAt).toLocaleString('ar-SA')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900 dark:text-white text-sm">{log.productName}</div>
                        <div className="flex items-center gap-1 font-mono text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          <Barcode className="h-3 w-3" />
                          <span>{log.barcode}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{getTypeBadge(log.type)}</td>
                      <td className="px-4 py-3 text-center font-mono text-slate-500 dark:text-slate-400">{log.previousQuantity}</td>
                      <td className="px-4 py-3 text-center whitespace-nowrap font-mono font-black">
                        <span
                          className={`px-2.5 py-1 rounded-md text-xs font-bold inline-block ${
                            isZero
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              : isPositive 
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50' 
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                          }`}
                        >
                          {isPositive ? `+${log.quantityDelta}` : log.quantityDelta}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-black text-slate-900 dark:text-white text-sm">
                        {log.newQuantity}
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={log.reason || ''}>
                        {log.reason || '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{log.performedBy || 'النظام'}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
