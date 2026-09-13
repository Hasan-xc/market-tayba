import React, { useState, useMemo } from 'react';
import { 
  FileText, 
  Printer, 
  X, 
  Calendar, 
  User, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  ArrowDownLeft, 
  Percent, 
  Layers, 
  CheckCircle2, 
  Building2,
  DollarSign,
  Store
} from 'lucide-react';
import { SaleTransaction, ReturnRecord, StoreSettings, ZReportData } from '../types';
import { dbService } from '../services/db';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sales: SaleTransaction[];
  returns: ReturnRecord[];
  settings: StoreSettings;
}

export const ZReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  sales,
  returns,
  settings,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    // التاريخ المحلي (وليس UTC) ليتطابق مع مفتاح فلترة الفواتير
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [selectedCashier, setSelectedCashier] = useState<string>('all');
  
  const currentUser = dbService.getCurrentUser();
  const branches = dbService.getBranches();
  
  // فرع الزي رابور: الكاشير مقيد بفرعه، بينما المدير يرى كل الفروع أو يختار فرعاً معيناً
  const [selectedBranch, setSelectedBranch] = useState<string>(() => {
    if (currentUser && currentUser.role === 'cashier' && currentUser.branchId) {
      return currentUser.branchId;
    }
    return 'all';
  });

  const activeBranchObj = branches.find((b) => b.id === selectedBranch);

  const reportData: ZReportData = useMemo(() => {
    // مفتاح التاريخ المحلي (وليس UTC) حتى لا تنزلق فواتير الصباح الباكر ليوم سابق
    const localDateKey = (iso: string) => {
      const d = new Date(iso);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Filter sales by date, cashier, and branch
    const filteredSales = sales.filter((s) => {
      if (s.status === 'refunded') return false;
      const sDate = localDateKey(s.createdAt);
      const matchDate = sDate === selectedDate;
      const matchCashier = selectedCashier === 'all' || s.cashierName === selectedCashier;
      const sBranch = s.branchId || 'branch-main';
      const matchBranch = selectedBranch === 'all' || sBranch === selectedBranch;
      return matchDate && matchCashier && matchBranch;
    });

    // Filter returns by date, cashier, and branch
    const filteredReturns = returns.filter((r) => {
      const rDate = localDateKey(r.createdAt);
      const matchDate = rDate === selectedDate;
      const matchCashier = selectedCashier === 'all' || r.cashierName === selectedCashier;
      const rBranch = r.branchId || 'branch-main';
      const matchBranch = selectedBranch === 'all' || rBranch === selectedBranch;
      return matchDate && matchCashier && matchBranch;
    });

    let grossSales = 0;
    let totalDiscounts = 0;
    let netSales = 0;
    let totalProfit = 0;
    let totalCost = 0;
    let totalItems = 0;
    let totalVat = 0;

    const payments = {
      cash: 0,
      card: 0,
      bankTransfer: 0,
      credit: 0,
      split: 0,
    };

    const cashierMap: Record<string, { cashierName: string; invoicesCount: number; salesTotal: number; profitTotal: number }> = {};
    const branchMap: Record<string, { branchId: string; branchName: string; invoicesCount: number; salesTotal: number; profitTotal: number }> = {};

    filteredSales.forEach((s) => {
      grossSales += s.subtotal;
      totalDiscounts += s.discountTotal;
      netSales += s.netTotal;
      totalProfit += s.totalProfit;
      totalVat += s.taxAmount || 0;

      const itemsQty = s.items.reduce((sum, item) => sum + item.quantity, 0);
      totalItems += itemsQty;

      const saleCost = s.items.reduce((sum, item) => sum + (item.purchasePrice * item.quantity), 0);
      totalCost += saleCost;

      // Payment breakdown
      if (s.paymentMethod === 'cash') payments.cash += s.netTotal;
      else if (s.paymentMethod === 'card') payments.card += s.netTotal;
      else if (s.paymentMethod === 'bank_transfer') payments.bankTransfer += s.netTotal;
      else if (s.paymentMethod === 'credit') payments.credit += s.netTotal;
      else if (s.paymentMethod === 'split') {
        payments.split += s.netTotal;
        if (s.splitPayments) {
          payments.cash += s.splitPayments.cash || 0;
          payments.card += s.splitPayments.card || 0;
          payments.bankTransfer += s.splitPayments.bankTransfer || 0;
        }
      }

      // Cashier breakdown
      const cName = s.cashierName || 'غير محدد';
      if (!cashierMap[cName]) {
        cashierMap[cName] = { cashierName: cName, invoicesCount: 0, salesTotal: 0, profitTotal: 0 };
      }
      cashierMap[cName].invoicesCount += 1;
      cashierMap[cName].salesTotal += s.netTotal;
      cashierMap[cName].profitTotal += s.totalProfit;

      // Branch breakdown
      const bId = s.branchId || 'branch-main';
      const bName = s.branchName || (bId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');
      if (!branchMap[bId]) {
        branchMap[bId] = { branchId: bId, branchName: bName, invoicesCount: 0, salesTotal: 0, profitTotal: 0 };
      }
      branchMap[bId].invoicesCount += 1;
      branchMap[bId].salesTotal += s.netTotal;
      branchMap[bId].profitTotal += s.totalProfit;
    });

    const totalReturnsCount = filteredReturns.length;
    const totalReturnsAmount = filteredReturns.reduce((sum, r) => sum + r.refundTotal, 0);

    const profitMarginPercent = netSales > 0 ? (totalProfit / netSales) * 100 : 0;

    return {
      reportDate: selectedDate,
      generatedAt: new Date().toISOString(),
      cashierFilter: selectedCashier !== 'all' ? selectedCashier : undefined,
      branchFilter: selectedBranch !== 'all' ? selectedBranch : undefined,
      branchName: selectedBranch !== 'all' ? (activeBranchObj?.name || 'فرع محدد') : 'جميع الفروع (شامل)',
      totalInvoicesCount: filteredSales.length,
      totalItemsSoldCount: totalItems,
      grossSalesAmount: grossSales,
      totalDiscountsAmount: totalDiscounts,
      totalVatAmount: totalVat,
      netSalesAmount: netSales,
      totalCostOfGoods: totalCost,
      netProfitAmount: totalProfit,
      profitMarginPercent,
      paymentBreakdown: payments,
      totalReturnsCount,
      totalReturnsAmount,
      cashierSummaries: Object.values(cashierMap),
      branchSummaries: Object.values(branchMap),
    };
  }, [sales, returns, selectedDate, selectedCashier, selectedBranch, activeBranchObj]);

  if (!isOpen) return null;

  const handlePrintZReport = () => {
    window.print();
  };

  const cashiersList = settings.cashiers || ['الكاشير'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-3xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header (No Print) */}
        <div className="no-print flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">تقرير الإغلاق المالي واليومي (Z-Report)</h3>
              <p className="text-xs text-slate-400">ملخص المبيعات، التدفق النقدي، المرتجعات، وصافي الأرباح لختام اليوم</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Filter Controls Bar (No Print) */}
        <div className="no-print p-4 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            {/* تاريخ اليوم */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-300">التاريخ:</span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-white focus:outline-none font-mono cursor-pointer"
              />
            </div>

            {/* فلتر الفرع (للمدير يرى جميع الفروع أو يختار فرعاً بعينه) */}
            {(!currentUser || currentUser.role === 'admin') ? (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
                <Store className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-slate-300">الفرع:</span>
                <select
                  value={selectedBranch}
                  onChange={(e) => setSelectedBranch(e.target.value)}
                  className="bg-transparent text-white focus:outline-none cursor-pointer font-bold"
                >
                  <option value="all" className="bg-slate-900">🏢 جميع الفروع (التقرير المجمّع)</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id} className="bg-slate-900">
                      🏪 {b.name} {b.isMain ? '(الرئيسي)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
                <Store className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-slate-300">الفرع:</span>
                <span className="text-emerald-400 font-bold">{activeBranchObj?.name || 'فرع الكاشير'}</span>
              </div>
            )}

            {/* فلتر الكاشير */}
            <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700 rounded-xl px-3 py-1.5">
              <User className="h-3.5 w-3.5 text-slate-400" />
              <span className="text-slate-300">الكاشير:</span>
              <select
                value={selectedCashier}
                onChange={(e) => setSelectedCashier(e.target.value)}
                className="bg-transparent text-white focus:outline-none cursor-pointer"
              >
                <option value="all" className="bg-slate-900">جميع الكاشيرية</option>
                {cashiersList.map((c) => (
                  <option key={c} value={c} className="bg-slate-900">{c}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handlePrintZReport}
            className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer active:scale-95 shadow-lg shadow-amber-900/30"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة تقرير Z (حراري 80mm)</span>
          </button>
        </div>

        {/* Report Content Container (Prints cleanly) */}
        <div className="p-5 space-y-5 overflow-y-auto print:bg-white print:text-black print:p-2">
          {/* Printable Receipt Paper Container */}
          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 print:border-none print:p-2 print:bg-white print:text-black">
            {/* Header */}
            <div className="text-center pb-4 border-b border-slate-800 print:border-slate-300 space-y-1">
              <h2 className="text-lg font-black text-white print:text-black">{settings.storeName}</h2>
              <div className="text-xs text-amber-400 print:text-slate-700 font-bold">
                *** تقرير الإغلاق المالي واليومي (Z-REPORT) ***
              </div>
              <div className="inline-block bg-slate-800 print:bg-slate-100 text-emerald-400 print:text-emerald-800 text-xs font-bold px-3 py-0.5 rounded-full border border-slate-700 print:border-slate-300 mt-1">
                نطاق التقرير: {reportData.branchName}
              </div>
              <div className="text-[11px] text-slate-400 print:text-slate-600 font-mono mt-1">
                تاريخ الوردية: {selectedDate} • وقت الاستخراج: {new Date().toLocaleTimeString('ar-SA')}
              </div>
              {selectedCashier !== 'all' && (
                <div className="text-xs text-slate-300 print:text-black font-bold">
                  الكاشير المحدد: {selectedCashier}
                </div>
              )}
            </div>

            {/* Core Financial Numbers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-4 border-b border-slate-800 print:border-slate-300">
              <div className="bg-slate-900/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <div className="text-[11px] text-slate-400 print:text-slate-600">إجمالي المبيعات</div>
                <div className="text-base font-black font-mono text-white print:text-black mt-1">
                  {reportData.netSalesAmount.toFixed(2)} {settings.currency}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{reportData.totalInvoicesCount} فاتورة</div>
              </div>

              <div className="bg-slate-900/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <div className="text-[11px] text-slate-400 print:text-slate-600">صافي الأرباح</div>
                <div className="text-base font-black font-mono text-emerald-400 print:text-emerald-700 mt-1">
                  {reportData.netProfitAmount.toFixed(2)} {settings.currency}
                </div>
                <div className="text-[10px] text-emerald-400/80 font-mono">هامش: {reportData.profitMarginPercent.toFixed(1)}%</div>
              </div>

              <div className="bg-slate-900/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <div className="text-[11px] text-slate-400 print:text-slate-600">تكلفة البضاعة المباعة</div>
                <div className="text-base font-black font-mono text-slate-300 print:text-slate-800 mt-1">
                  {reportData.totalCostOfGoods.toFixed(2)} {settings.currency}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">{reportData.totalItemsSoldCount} قطعة</div>
              </div>

              <div className="bg-slate-900/80 print:bg-slate-50 p-3 rounded-xl border border-slate-800 print:border-slate-200">
                <div className="text-[11px] text-slate-400 print:text-slate-600">المرتجعات والخصومات</div>
                <div className="text-base font-black font-mono text-rose-400 print:text-rose-700 mt-1">
                  {reportData.totalReturnsAmount.toFixed(2)} {settings.currency}
                </div>
                <div className="text-[10px] text-slate-500 font-mono">خصومات: {reportData.totalDiscountsAmount.toFixed(2)}</div>
              </div>
            </div>

            {/* Detailed Payment Breakdown */}
            <div className="py-4 border-b border-slate-800 print:border-slate-300 space-y-2">
              <div className="text-xs font-bold text-slate-300 print:text-black flex items-center justify-between">
                <span>تفصيل المبالغ حسب وسيلة الدفع:</span>
                <span className="font-mono text-[11px] text-slate-400">Payment Breakdown</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 print:bg-slate-100 font-mono">
                  <span className="text-slate-300 print:text-slate-800 font-sans flex items-center gap-1.5">
                    <Banknote className="h-3.5 w-3.5 text-emerald-400 print:text-emerald-700" />
                    المقبوضات النقدية (الكاش):
                  </span>
                  <span className="font-bold text-emerald-400 print:text-emerald-800">
                    {reportData.paymentBreakdown.cash.toFixed(2)} {settings.currency}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 print:bg-slate-100 font-mono">
                  <span className="text-slate-300 print:text-slate-800 font-sans flex items-center gap-1.5">
                    <CreditCard className="h-3.5 w-3.5 text-sky-400 print:text-sky-700" />
                    مدفوعات الشبكة / البطاقات (Card):
                  </span>
                  <span className="font-bold text-sky-400 print:text-sky-800">
                    {reportData.paymentBreakdown.card.toFixed(2)} {settings.currency}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 print:bg-slate-100 font-mono">
                  <span className="text-slate-300 print:text-slate-800 font-sans flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-purple-400 print:text-purple-700" />
                    التحويلات البنكية (Bank Transfer):
                  </span>
                  <span className="font-bold text-purple-400 print:text-purple-800">
                    {reportData.paymentBreakdown.bankTransfer.toFixed(2)} {settings.currency}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/60 print:bg-slate-100 font-mono">
                  <span className="text-slate-300 print:text-slate-800 font-sans flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-amber-400 print:text-amber-700" />
                    المبيعات الآجلة (ديون على الحساب):
                  </span>
                  <span className="font-bold text-amber-400 print:text-amber-800">
                    {reportData.paymentBreakdown.credit.toFixed(2)} {settings.currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Branch Breakdown Table (Shown when all branches or multiple branches have data) */}
            {reportData.branchSummaries && reportData.branchSummaries.length > 0 && selectedBranch === 'all' && (
              <div className="pt-4 border-t border-slate-800 print:border-slate-300 space-y-2">
                <div className="text-xs font-bold text-slate-300 print:text-black flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-400 print:text-slate-800">
                    <Store className="h-3.5 w-3.5" />
                    <span>مبيعات وأرباح الفروع (التقرير الإداري المجمّع):</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">Branches Breakdown</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-right">
                    <thead>
                      <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600">
                        <th className="py-1">اسم الفرع</th>
                        <th className="py-1 text-center">عدد الفواتير</th>
                        <th className="py-1 text-center">إجمالي المبيعات</th>
                        <th className="py-1 text-center">صافي الأرباح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                      {reportData.branchSummaries.map((b, i) => (
                        <tr key={`branch-sum-${i}`} className="font-mono">
                          <td className="py-2 font-sans font-bold text-white print:text-black flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{b.branchName}</span>
                          </td>
                          <td className="py-2 text-center text-slate-300 print:text-black">{b.invoicesCount} فاتورة</td>
                          <td className="py-2 text-center text-emerald-400 print:text-emerald-800 font-bold">
                            {b.salesTotal.toFixed(2)} {settings.currency}
                          </td>
                          <td className="py-2 text-center text-amber-400 print:text-amber-800 font-bold">
                            {b.profitTotal.toFixed(2)} {settings.currency}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Cashiers Summary Table */}
            {reportData.cashierSummaries.length > 0 && (
              <div className="pt-4 border-t border-slate-800 print:border-slate-300 space-y-2">
                <div className="text-xs font-bold text-slate-300 print:text-black">
                  إنتاجية ومبيعات الكاشيرية:
                </div>
                <table className="w-full text-xs text-right">
                  <thead>
                    <tr className="border-b border-slate-800 print:border-slate-300 text-slate-400 print:text-slate-600">
                      <th className="py-1">الكاشير</th>
                      <th className="py-1">الفواتير</th>
                      <th className="py-1">إجمالي المبيعات</th>
                      <th className="py-1">الأرباح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 print:divide-slate-200">
                    {reportData.cashierSummaries.map((c, i) => (
                      <tr key={i} className="font-mono">
                        <td className="py-1.5 font-sans font-bold text-white print:text-black">{c.cashierName}</td>
                        <td className="py-1.5 text-slate-300 print:text-black">{c.invoicesCount}</td>
                        <td className="py-1.5 text-emerald-400 print:text-emerald-800 font-bold">{c.salesTotal.toFixed(2)}</td>
                        <td className="py-1.5 text-slate-400 print:text-slate-600">{c.profitTotal.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer */}
            <div className="text-center pt-6 border-t border-slate-800 print:border-slate-300 text-[10px] text-slate-500 print:text-slate-600">
              تم إنشاء هذا التقرير تلقائياً بواسطة نظام ماركت طيبه لإدارة نقاط البيع والمخازن • ختام الوردية
            </div>
          </div>
        </div>

        {/* Modal Footer (No print) */}
        <div className="no-print px-5 py-3 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between">
          <span className="text-xs text-slate-400 font-mono">Z-Report End of Day Batch</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
