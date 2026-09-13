import { useState } from 'react';
import { 
  FileText, 
  Calendar, 
  DollarSign, 
  TrendingUp, 
  ShoppingBag, 
  RotateCcw, 
  Download, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  CreditCard, 
  Banknote,
  Building2,
  Search
} from 'lucide-react';
import { Product, SaleTransaction, StoreSettings } from '../types';
import { dbService } from '../services/db';
import { ReceiptModal } from './ReceiptModal';

interface Props {
  settings: StoreSettings;
  products: Product[];
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn') => void;
}

export const Reports = ({ settings, products, onDataChange, showToast }: Props) => {
  const [rangeType, setRangeType] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('today');
  const [customFrom, setCustomFrom] = useState(new Date().toISOString().slice(0, 10));
  const [customTo, setCustomTo] = useState(new Date().toISOString().slice(0, 10));
  const [selectedInvoice, setSelectedInvoice] = useState<SaleTransaction | null>(null);
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [searchInvoiceNumber, setSearchInvoiceNumber] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const branches = dbService.getBranches();
  const allSales = dbService.getSales();
  const allReturns = dbService.getReturns();

  // تصفية حسب التاريخ والفرع
  const getFilteredData = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let fromTime = today.getTime();
    let toTime = today.getTime() + 24 * 60 * 60 * 1000 - 1;

    if (rangeType === 'yesterday') {
      fromTime = today.getTime() - 24 * 60 * 60 * 1000;
      toTime = today.getTime() - 1;
    } else if (rangeType === 'week') {
      fromTime = today.getTime() - 6 * 24 * 60 * 60 * 1000;
      toTime = Date.now();
    } else if (rangeType === 'month') {
      fromTime = today.getTime() - 29 * 24 * 60 * 60 * 1000;
      toTime = Date.now();
    } else if (rangeType === 'custom') {
      fromTime = new Date(customFrom + 'T00:00:00').getTime();
      toTime = new Date(customTo + 'T23:59:59').getTime();
    }

    const filteredSales = allSales.filter((s) => {
      // الفواتير المرتجعة بالكامل تُستبعد من إحصاءات المبيعات (إلا تُحسب مبيعاً ومرتجعاً معاً)
      if (s.status === 'refunded') return false;
      const t = new Date(s.createdAt).getTime();
      const matchRange = t >= fromTime && t <= toTime;
      const matchSearch =
        !searchInvoiceNumber ||
        s.invoiceNumber.toLowerCase().includes(searchInvoiceNumber.toLowerCase()) ||
        s.cashierName.toLowerCase().includes(searchInvoiceNumber.toLowerCase());
      const sBranch = s.branchId || 'branch-main';
      const matchBranch = selectedBranch === 'all' || sBranch === selectedBranch;
      return matchRange && matchSearch && matchBranch;
    });

    const filteredReturns = allReturns.filter((r) => {
      const t = new Date(r.createdAt).getTime();
      const matchRange = t >= fromTime && t <= toTime;
      const rBranch = r.branchId || 'branch-main';
      const matchBranch = selectedBranch === 'all' || rBranch === selectedBranch;
      return matchRange && matchBranch;
    });

    return { filteredSales, filteredReturns };
  };

  const { filteredSales, filteredReturns } = getFilteredData();

  // الحسابات المالية
  const totalGrossSales = filteredSales.reduce((sum, s) => sum + s.subtotal, 0);
  const totalDiscounts = filteredSales.reduce((sum, s) => sum + s.discountTotal, 0);
  const totalNetSales = filteredSales.reduce((sum, s) => sum + s.netTotal, 0);
  const totalProfit = filteredSales.reduce((sum, s) => sum + s.totalProfit, 0);
  const totalRefunds = filteredReturns.reduce((sum, r) => sum + r.refundTotal, 0);

  const cashSalesTotal = filteredSales.filter((s) => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.netTotal, 0);
  const cardSalesTotal = filteredSales.filter((s) => s.paymentMethod === 'card').reduce((sum, s) => sum + s.netTotal, 0);

  // مبيعات الكاشيرية (الأخوة)
  const cashierStats: Record<string, { count: number; total: number; profit: number }> = {};
  filteredSales.forEach((s) => {
    const c = s.cashierName || 'غير محدد';
    if (!cashierStats[c]) cashierStats[c] = { count: 0, total: 0, profit: 0 };
    cashierStats[c].count += 1;
    cashierStats[c].total += s.netTotal;
    cashierStats[c].profit += s.totalProfit;
  });

  const handleExportSalesCSV = () => {
    const csv = dbService.exportSalesCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('تم تصدير تقرير المبيعات', 'success');
  };

  const handleExportReturnsCSV = () => {
    const csv = dbService.exportReturnsCSV();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `returns_report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('تم تصدير تقرير المرتجعات', 'success');
  };

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400">
              <FileText className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-bold font-['Cairo'] text-slate-900 dark:text-white">تقارير المبيعات والأرباح</h2>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleExportSalesCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition font-['Cairo'] cursor-pointer"
            >
              <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>تصدير فواتير (CSV)</span>
            </button>
            <button
              onClick={handleExportReturnsCSV}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition font-['Cairo'] cursor-pointer"
            >
              <Download className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              <span>تصدير مرتجعات</span>
            </button>
          </div>
        </div>

        {/* Branch Filter Tabs */}
        <div className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/60 text-xs overflow-x-auto">
          <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-bold shrink-0">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>الفرع:</span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedBranch('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
              selectedBranch === 'all'
                ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            🏢 جميع الفروع مجمعة
          </button>
          {branches.map((b) => (
            <button
              key={`rep-branch-${b.id}`}
              type="button"
              onClick={() => setSelectedBranch(b.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition shrink-0 cursor-pointer ${
                selectedBranch === b.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
              }`}
            >
              {b.name}
            </button>
          ))}
        </div>

        {/* Range Buttons */}
        <div className="flex flex-wrap items-center gap-2 text-xs font-['Cairo'] font-bold">
          <button
            onClick={() => setRangeType('today')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              rangeType === 'today'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            اليوم
          </button>
          <button
            onClick={() => setRangeType('yesterday')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              rangeType === 'yesterday'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            أمس
          </button>
          <button
            onClick={() => setRangeType('week')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              rangeType === 'week'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            آخر 7 أيام
          </button>
          <button
            onClick={() => setRangeType('month')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              rangeType === 'month'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            آخر 30 يوم
          </button>
          <button
            onClick={() => setRangeType('custom')}
            className={`px-4 py-2 rounded-xl transition cursor-pointer ${
              rangeType === 'custom'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            نطاق مخصص
          </button>

          {rangeType === 'custom' && (
            <div className="flex items-center gap-2 mr-auto text-xs font-sans">
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400">من:</span>
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-slate-500 dark:text-slate-400">إلى:</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white px-2 py-1"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-1 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">صافي المبيعات</span>
          <div className="text-2xl font-black font-mono text-slate-900 dark:text-white">
            {totalNetSales.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400">
            {settings.currency} ({filteredSales.length} فاتورة)
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/40 p-4 shadow-sm space-y-1 transition-colors">
          <span className="text-xs text-emerald-800 dark:text-emerald-400 font-bold font-['Cairo']">صافي الأرباح المحققة</span>
          <div className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-400">
            +{totalProfit.toFixed(2)}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-500 font-mono">
            {settings.currency} ربح خالص
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm space-y-1 transition-colors">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">توزيع الدفع</span>
          <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>💵 نقدي:</span>
              <span>{cashSalesTotal.toFixed(2)} {settings.currency}</span>
            </div>
            <div className="flex justify-between">
              <span>💳 شبكة:</span>
              <span>{cardSalesTotal.toFixed(2)} {settings.currency}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/40 p-4 shadow-sm space-y-1 transition-colors">
          <span className="text-xs text-rose-800 dark:text-rose-400 font-bold font-['Cairo']">المبالغ المسترجعة</span>
          <div className="text-2xl font-black font-mono text-rose-800 dark:text-rose-400">
            -{totalRefunds.toFixed(2)}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-500 font-mono">
            {settings.currency} ({filteredReturns.length} إرجاع)
          </div>
        </div>
      </div>

      {/* Cashiers performance breakdown (The Brotherhood) */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3 transition-colors">
        <h3 className="font-bold text-slate-800 dark:text-white text-sm font-['Cairo']">
          ملخص مبيعات الكاشيرية (الأخوة)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(cashierStats).map(([name, stat]) => (
            <div key={name} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs space-y-1">
              <div className="flex justify-between font-bold text-slate-900 dark:text-white">
                <span>👤 {name}</span>
                <span className="text-slate-500 dark:text-slate-400 font-normal">{stat.count} فاتورة</span>
              </div>
              <div className="flex justify-between text-slate-700 dark:text-slate-300 font-mono pt-1 border-t border-slate-200 dark:border-slate-700">
                <span>المبيعات:</span>
                <b>{stat.total.toFixed(2)} {settings.currency}</b>
              </div>
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-mono">
                <span>الربح:</span>
                <b>+{stat.profit.toFixed(2)} {settings.currency}</b>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Invoices Detailed Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm overflow-hidden space-y-3 p-5 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm font-['Cairo']">
            سجل الفواتير الصادرة ({filteredSales.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder="بحث برقم الفاتورة أو الكاشير..."
              value={searchInvoiceNumber}
              onChange={(e) => setSearchInvoiceNumber(e.target.value)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-1.5 pr-8 pl-3 text-xs focus:border-emerald-600 focus:outline-none"
            />
          </div>
        </div>

        {filteredSales.length === 0 ? (
          <div className="py-12 text-center text-slate-400 dark:text-slate-500 text-xs">
            لا توجد فواتير مسجلة في هذا النطاق الزمني
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredSales.map((sale) => {
              const isExpanded = expandedInvoiceId === sale.id;

              return (
                <div
                  key={sale.id}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition overflow-hidden text-xs"
                >
                  <div
                    onClick={() => setExpandedInvoiceId(isExpanded ? null : sale.id)}
                    className="p-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 rounded-md shadow-xs">
                        {sale.invoiceNumber}
                      </span>
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {sale.items.length} أصناف • {sale.paymentMethod === 'cash' ? '💵 نقدي' : sale.paymentMethod === 'card' ? '💳 شبكة' : sale.paymentMethod === 'credit' ? '📝 آجل' : sale.paymentMethod}
                          </span>
                          {selectedBranch === 'all' && (
                            <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              sale.branchId === 'branch-sharshi'
                                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
                            }`}>
                              <Building2 className="w-2.5 h-2.5" />
                              {sale.branchName || (sale.branchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي')}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {new Date(sale.createdAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })} • الكاشير: {sale.cashierName}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-left">
                        <div className="font-mono font-black text-sm text-slate-900 dark:text-white">
                          {sale.netTotal.toFixed(2)} {settings.currency}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                          ربح: +{sale.totalProfit.toFixed(2)}
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(sale);
                        }}
                        className="p-2 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700 rounded-lg transition cursor-pointer"
                        title="طباعة / عرض الإيصال"
                      >
                        <Printer className="h-4 w-4" />
                      </button>

                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Expanded Items Breakdown */}
                  {isExpanded && (
                    <div className="px-4 pb-3.5 pt-1 border-t border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2">
                      <div className="font-bold text-[11px] text-slate-500 dark:text-slate-400 font-['Cairo']">تفاصيل الأصناف في الفاتورة:</div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sale.items.map((it, idx) => (
                          <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                            <div>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{it.productName}</span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mr-2">
                                ({it.quantity} × {it.unitPrice.toFixed(2)})
                              </span>
                            </div>
                            <div className="font-mono font-bold text-slate-900 dark:text-white">
                              {it.total.toFixed(2)} {settings.currency}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
        sale={selectedInvoice}
        settings={settings}
      />
    </div>
  );
};
