import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  AlertTriangle, 
  RotateCcw, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight, 
  Calendar, 
  Plus, 
  FileText, 
  CheckCircle2, 
  Sparkles,
  Layers,
  CreditCard,
  Banknote,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  ArrowRight,
  Zap,
  Award,
  Target,
  Users,
  Compass,
  Coins,
  Receipt,
  Percent,
  TrendingDown,
  Building2
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { Product, SaleTransaction, ReturnRecord, StoreSettings } from '../types';
import { dbService } from '../services/db';

interface Props {
  settings: StoreSettings;
  products: Product[];
  onNavigate: (tab: string) => void;
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn') => void;
}

export const Dashboard = ({ settings, products, onNavigate, onDataChange, showToast }: Props) => {
  const [timeFilter, setTimeFilter] = useState<'today' | 'week' | 'month' | 'all'>('week');
  const branches = dbService.getBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>(() => dbService.getActiveBranchId());

  const sales = dbService.getSales();
  const returns = dbService.getReturns();

  // حساب التواريخ
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfWeek = startOfDay - 6 * 24 * 60 * 60 * 1000;
  const startOfMonth = startOfDay - 29 * 24 * 60 * 60 * 1000;

  // المبيعات المصفاة للفترة الحالية والفرع
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      // الفواتير المرتجعة بالكامل تُستبعد من مؤشرات الأداء
      if (s.status === 'refunded') return false;
      const sBranch = s.branchId || 'branch-main';
      if (selectedBranch !== 'all' && sBranch !== selectedBranch) return false;
      const saleTime = new Date(s.createdAt).getTime();
      if (timeFilter === 'today') return saleTime >= startOfDay;
      if (timeFilter === 'week') return saleTime >= startOfWeek;
      if (timeFilter === 'month') return saleTime >= startOfMonth;
      return true;
    });
  }, [sales, timeFilter, selectedBranch, startOfDay, startOfWeek, startOfMonth]);

  // المبيعات للفترة السابقة لحساب نسب النمو
  const previousSales = useMemo(() => {
    const isBranchMatch = (s: SaleTransaction) => {
      const sBranch = s.branchId || 'branch-main';
      return selectedBranch === 'all' || sBranch === selectedBranch;
    };

    if (timeFilter === 'today') {
      const startOfYesterday = startOfDay - 24 * 60 * 60 * 1000;
      return sales.filter((s) => {
        if (!isBranchMatch(s)) return false;
        const t = new Date(s.createdAt).getTime();
        return t >= startOfYesterday && t < startOfDay;
      });
    } else if (timeFilter === 'week') {
      const startOfPrevWeek = startOfWeek - 7 * 24 * 60 * 60 * 1000;
      return sales.filter((s) => {
        if (!isBranchMatch(s)) return false;
        const t = new Date(s.createdAt).getTime();
        return t >= startOfPrevWeek && t < startOfWeek;
      });
    } else if (timeFilter === 'month') {
      const startOfPrevMonth = startOfMonth - 30 * 24 * 60 * 60 * 1000;
      return sales.filter((s) => {
        if (!isBranchMatch(s)) return false;
        const t = new Date(s.createdAt).getTime();
        return t >= startOfPrevMonth && t < startOfMonth;
      });
    }
    return [];
  }, [sales, timeFilter, selectedBranch, startOfDay, startOfWeek, startOfMonth]);

  // المؤشرات الرقمية الحالية
  const totalSalesAmount = filteredSales.reduce((sum, s) => sum + s.netTotal, 0);
  const totalProfitAmount = filteredSales.reduce((sum, s) => sum + s.totalProfit, 0);
  const totalOrdersCount = filteredSales.length;
  const totalItemsSold = filteredSales.reduce((sum, s) => sum + s.items.reduce((iSum, it) => iSum + it.quantity, 0), 0);
  const averageTicket = totalOrdersCount > 0 ? totalSalesAmount / totalOrdersCount : 0;
  const profitMargin = totalSalesAmount > 0 ? (totalProfitAmount / totalSalesAmount) * 100 : 0;

  // نسب النمو
  const prevSalesAmount = previousSales.reduce((sum, s) => sum + s.netTotal, 0);
  const salesGrowthPercent = prevSalesAmount > 0 
    ? ((totalSalesAmount - prevSalesAmount) / prevSalesAmount) * 100 
    : totalSalesAmount > 0 ? 100 : 0;

  // حساب هدف المبيعات التقديري
  const targetSales = timeFilter === 'today' 
    ? Math.max(1000, totalSalesAmount * 1.25)
    : timeFilter === 'week' 
    ? Math.max(5000, totalSalesAmount * 1.2) 
    : Math.max(20000, totalSalesAmount * 1.15);

  const targetCompletionPercent = Math.min(100, Math.round((totalSalesAmount / (targetSales || 1)) * 100));

  // بيانات مخطط المبيعات الزمني
  const timelineData = useMemo(() => {
    if (timeFilter === 'today') {
      const hoursMap: Record<number, { time: string; sales: number; profit: number }> = {};
      for (let h = 8; h <= 23; h++) {
        const label = h > 12 ? `${h - 12}م` : h === 12 ? '12م' : `${h}ص`;
        hoursMap[h] = { time: label, sales: 0, profit: 0 };
      }
      filteredSales.forEach((s) => {
        const d = new Date(s.createdAt);
        const h = d.getHours();
        if (hoursMap[h]) {
          hoursMap[h].sales += s.netTotal;
          hoursMap[h].profit += s.totalProfit;
        }
      });
      return Object.values(hoursMap);
    } else if (timeFilter === 'week') {
      const days = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const result: { dateKey: string; time: string; sales: number; profit: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const targetDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        const dayName = days[targetDate.getDay()];
        const shortDate = `${targetDate.getDate()}/${targetDate.getMonth() + 1}`;
        // مفتاح التاريخ المحلي ليتطابق مع تصنيف الفواتير المحلي (وليس UTC)
        const dateKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
        result.push({ dateKey, time: `${dayName}`, sales: 0, profit: 0 });
      }
      filteredSales.forEach((s) => {
        const sd = new Date(s.createdAt);
        const sKey = `${sd.getFullYear()}-${String(sd.getMonth() + 1).padStart(2, '0')}-${String(sd.getDate()).padStart(2, '0')}`;
        const target = result.find((r) => r.dateKey === sKey);
        if (target) {
          target.sales += s.netTotal;
          target.profit += s.totalProfit;
        }
      });
      return result;
    } else {
      // 4 أسابيع الشهر
      const weeks: { time: string; sales: number; profit: number }[] = [
        { time: 'أسبوع 1', sales: 0, profit: 0 },
        { time: 'أسبوع 2', sales: 0, profit: 0 },
        { time: 'أسبوع 3', sales: 0, profit: 0 },
        { time: 'أسبوع 4', sales: 0, profit: 0 },
      ];
      filteredSales.forEach((s) => {
        const d = new Date(s.createdAt);
        const dayOfMonth = d.getDate();
        const weekIdx = Math.min(3, Math.floor((dayOfMonth - 1) / 7));
        weeks[weekIdx].sales += s.netTotal;
        weeks[weekIdx].profit += s.totalProfit;
      });
      return weeks;
    }
  }, [filteredSales, timeFilter]);

  // بيانات مخطط الحصة وتوزيع الأقسام (Donut / Pie Chart)
  const categoryPieData = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        const prod = products.find((p) => p.id === it.productId || p.barcode === it.barcode);
        const cat = prod?.category || 'عام';
        catMap[cat] = (catMap[cat] || 0) + it.total;
      });
    });

    const colors = ['#f59e0b', '#ef4444', '#f97316', '#38bdf8', '#0284c7', '#34d399', '#a78bfa'];
    const entries = Object.entries(catMap)
      .map(([name, value], idx) => ({
        name,
        value: Math.round(value),
        color: colors[idx % colors.length]
      }))
      .sort((a, b) => b.value - a.value);

    if (entries.length === 0) {
      return [
        { name: 'عام', value: 100, color: '#3b82f6' }
      ];
    }
    return entries.slice(0, 6);
  }, [filteredSales, products]);

  // المنتجات الأكثر طلباً ومبيعاً (League Table)
  const topProductsList = useMemo(() => {
    const map: Record<string, { id: string; name: string; qty: number; revenue: number; profit: number }> = {};
    filteredSales.forEach((s) => {
      s.items.forEach((it) => {
        if (!map[it.productId]) {
          map[it.productId] = {
            id: it.productId,
            name: it.productName,
            qty: 0,
            revenue: 0,
            profit: 0
          };
        }
        map[it.productId].qty += it.quantity;
        map[it.productId].revenue += it.total;
        map[it.productId].profit += it.profit;
      });
    });

    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 4);
  }, [filteredSales]);

  // بيانات مقارنة المبيعات والأرباح والتكاليف (Production Bar Chart)
  const financialBarsData = useMemo(() => {
    const cost = Math.max(0, totalSalesAmount - totalProfitAmount);
    return [
      { name: 'المبيعات', value: Math.round(totalSalesAmount), fill: '#10b981' },
      { name: 'التكاليف', value: Math.round(cost), fill: '#0284c7' },
      { name: 'الأرباح', value: Math.round(totalProfitAmount), fill: '#f59e0b' }
    ];
  }, [totalSalesAmount, totalProfitAmount]);

  // حساب المخزون والنواقص
  const lowStockProducts = products.filter((p) => p.quantity <= p.minQuantityAlert);

  const handleQuickRestock = (productId: string, amount: number) => {
    dbService.updateStock(productId, amount);
    onDataChange();
    showToast(`تمت زيادة كمية الصنف بمقدار +${amount}`, 'success');
  };

  return (
    <div id="dashboard-container" className="space-y-5 animate-fade-in pb-16 max-w-7xl mx-auto font-['Cairo',sans-serif]">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 p-5 text-center sm:text-right">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {settings.storeName}
            </h2>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-0.5 text-xs text-emerald-300 font-bold">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
              <span>لوحة التحليلات والإحصائيات المتقدمة</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Selector Tabs */}
            <div className="flex bg-slate-800/90 p-1 rounded-xl text-xs font-bold gap-1 border border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedBranch('all')}
                className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1 ${
                  selectedBranch === 'all' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                <span>جميع الفروع</span>
              </button>
              {branches.map((b) => (
                <button
                  key={`dash-b-${b.id}`}
                  type="button"
                  onClick={() => setSelectedBranch(b.id)}
                  className={`px-2.5 py-1.5 rounded-lg transition cursor-pointer ${
                    selectedBranch === b.id ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>

            {/* Period Filter Tabs */}
            <div className="flex bg-slate-800/90 p-1 rounded-xl text-xs font-bold gap-1 self-center sm:self-auto border border-slate-700">
              <button
                onClick={() => setTimeFilter('today')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeFilter === 'today' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                اليوم
              </button>
              <button
                onClick={() => setTimeFilter('week')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeFilter === 'week' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                آخر 7 أيام
              </button>
              <button
                onClick={() => setTimeFilter('month')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeFilter === 'month' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                آخر 30 يوم
              </button>
              <button
                onClick={() => setTimeFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  timeFilter === 'all' ? 'bg-emerald-500 text-slate-950 font-black shadow-xs' : 'text-slate-300 hover:text-white'
                }`}
              >
                الكل
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Top Row (3 Grid Cards Matching the Reference Design) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Goal / Gauge Card */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400">
                <Target className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">الهدف المالي (Goal)</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
              المستهدف: {targetSales.toLocaleString('ar-SA')} {settings.currency}
            </span>
          </div>

          <div className="py-4 flex flex-col items-center justify-center">
            {/* Custom Half-Circle Gauge representation */}
            <div className="relative w-44 h-24 flex items-end justify-center overflow-hidden">
              <div className="absolute top-0 w-44 h-44 rounded-full border-[18px] border-slate-100 dark:border-slate-800 border-t-amber-500 border-r-amber-500 -rotate-45" />
              <div className="text-center pb-1">
                <div className="text-3xl font-black font-mono text-slate-900 dark:text-white">
                  {totalSalesAmount.toLocaleString('ar-SA')}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                  {targetCompletionPercent}% من الهدف
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
            <span>0</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">{targetSales.toLocaleString('ar-SA')} {settings.currency}</span>
          </div>
        </div>

        {/* Card 2: Sales Timeline Trend */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400">
                <Activity className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">حركة المبيعات (Timeline)</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-bold">معدل البيع</span>
          </div>

          <div className="h-40 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f87171" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f87171" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 2" stroke="#334155" opacity={0.25} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="rounded-xl border border-slate-700 bg-slate-900 text-white p-2 text-xs shadow-xl font-['Cairo']">
                          <p className="font-bold">{label}</p>
                          <p className="text-rose-400 font-mono">{Number(payload[0]?.value || 0).toFixed(2)} {settings.currency}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="sales" stroke="#ef4444" strokeWidth={2.5} fill="url(#coralGrad)" dot={{ r: 3, fill: '#ef4444' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2">
            <span>إجمالي الفواتير: <b className="text-slate-800 dark:text-slate-200 font-mono">{totalOrdersCount}</b></span>
            <span>متوسط الطلب: <b className="text-emerald-700 dark:text-emerald-400 font-mono">{averageTicket.toFixed(1)} {settings.currency}</b></span>
          </div>
        </div>

        {/* Card 3: Pie Chart of Sales Distribution */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-400">
                <PieChartIcon className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">توزيع المبيعات والأقسام</span>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300">{totalOrdersCount} طلب</span>
          </div>

          <div className="h-40 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={30}
                  outerRadius={55}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryPieData.map((entry, index) => (
                    <Cell key={`pie-c-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: number) => [`${val} ${settings.currency}`, 'المبيعات']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] border-t border-slate-100 dark:border-slate-800 pt-2">
            {categoryPieData.slice(0, 4).map((c, idx) => (
              <div key={idx} className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="text-slate-600 dark:text-slate-400 font-medium">{c.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Bottom Row (3 Grid Cards Matching the Reference Design) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 4: Top Performing Products (League Table) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400">
                <Award className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">قائمة المتصدرين (Top Performing)</span>
            </div>
            <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">المنتجات الأكثر دخلاً</span>
          </div>

          <div className="space-y-3 py-2">
            {topProductsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                لا توجد مبيعات في هذه الفترة حتى الآن
              </div>
            ) : (
              topProductsList.map((prod, idx) => (
                <div key={prod.id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-700 dark:text-slate-300 font-mono">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate max-w-[110px]" title={prod.name}>
                      {prod.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-16 h-4 flex items-center">
                      <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, (prod.qty / (topProductsList[0]?.qty || 1)) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-400">
                      {prod.revenue.toFixed(0)} {settings.currency}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-2 text-center">
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-300 flex items-center justify-center gap-1 w-full cursor-pointer"
            >
              <span>إدارة قائمة المنتجات والمخزون</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Card 5: Production / Distribution Bar Chart */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400">
                <Layers className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">التوزيع المالي (Financial Split)</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono font-bold">
              {profitMargin.toFixed(1)}% هامش ربح
            </span>
          </div>

          <div className="h-40 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={financialBarsData}
                margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="2 2" stroke="#334155" opacity={0.25} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#cbd5e1' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip
                  formatter={(val: number) => [`${val} ${settings.currency}`, 'المبلغ']}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {financialBarsData.map((entry, index) => (
                    <Cell key={`bar-c-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex items-center justify-around text-[10px] border-t border-slate-100 dark:border-slate-800 pt-2 font-bold text-slate-600 dark:text-slate-400">
            <span className="text-emerald-700 dark:text-emerald-400">■ مبيعات</span>
            <span className="text-sky-700 dark:text-sky-400">■ تكاليف</span>
            <span className="text-amber-700 dark:text-amber-400">■ أرباح</span>
          </div>
        </div>

        {/* Card 6: Total Sales Revenue & Growth (Big Highlight Card) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <div className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400">
                <DollarSign className="h-4 w-4" />
              </div>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">إجمالي الإيرادات (Sales Revenue)</span>
            </div>
            <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">صافي البيع</span>
          </div>

          <div className="py-2 space-y-3">
            <div>
              <div className="text-3xl font-black font-mono text-emerald-950 dark:text-emerald-400">
                {totalSalesAmount.toLocaleString('ar-SA')} <span className="text-base font-normal text-slate-600 dark:text-slate-400">{settings.currency}</span>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                الهدف التقديري: <b className="font-mono text-slate-700 dark:text-slate-300">{targetSales.toLocaleString('ar-SA')} {settings.currency}</b>
              </div>
            </div>

            {/* Big Growth Badge */}
            <div className={`p-3 rounded-xl flex items-center justify-between text-white ${
              salesGrowthPercent >= 0 ? 'bg-emerald-600' : 'bg-rose-600'
            }`}>
              <div className="flex items-center gap-2 font-bold text-xs">
                {salesGrowthPercent >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                <span>مقارنة بالفترة السابقة</span>
              </div>
              <div className="font-mono font-black text-lg">
                {salesGrowthPercent >= 0 ? '+' : ''}{salesGrowthPercent.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-2 font-mono">
            <span>الأرباح المحققة:</span>
            <span className="font-bold text-emerald-700 dark:text-emerald-400">+{totalProfitAmount.toFixed(2)} {settings.currency}</span>
          </div>
        </div>
      </div>

      {/* 4. Stock Alerts Summary Box */}
      {lowStockProducts.length > 0 && (
        <div className="rounded-2xl border border-amber-200/90 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-amber-100 dark:border-amber-900/40 pb-2">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-400">
                <AlertTriangle className="h-3.5 w-3.5" />
              </div>
              <h3 className="font-bold text-slate-900 dark:text-white text-xs">
                نواقص المخزون والتنبيهات السريعة ({lowStockProducts.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-amber-800 dark:text-amber-400 hover:text-amber-950 dark:hover:text-amber-300 flex items-center gap-1 cursor-pointer"
            >
              <span>فتح المخزن</span>
              <ArrowRight className="h-3 w-3" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {lowStockProducts.slice(0, 3).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-2 rounded-xl border border-amber-100 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white truncate max-w-[130px]">{p.name}</div>
                  <div className="text-[11px] text-amber-800 dark:text-amber-400 font-mono">
                    المتبقي: <b className="text-rose-600 dark:text-rose-400 font-bold">{p.quantity}</b> {p.unit || 'حبة'}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => handleQuickRestock(p.id, 10)}
                    className="rounded-lg bg-amber-50 dark:bg-slate-800 border border-amber-200 dark:border-amber-800/60 px-2 py-1 text-[11px] font-bold text-slate-800 dark:text-slate-200 hover:bg-amber-100 dark:hover:bg-slate-700 transition cursor-pointer"
                  >
                    +10
                  </button>
                  <button
                    onClick={() => handleQuickRestock(p.id, 25)}
                    className="rounded-lg bg-amber-600 dark:bg-amber-500 px-2 py-1 text-[11px] font-bold text-white hover:bg-amber-700 dark:hover:bg-amber-600 transition cursor-pointer"
                  >
                    +25
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
