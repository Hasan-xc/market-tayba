import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  Camera, 
  FileSpreadsheet, 
  Check, 
  X,
  Filter,
  ArrowUpDown,
  Sparkles,
  Barcode as BarcodeIcon,
  ChevronRight,
  ChevronLeft,
  ArrowLeftRight,
  Building2,
  Warehouse,
  History,
  PackageMinus
} from 'lucide-react';
import { Product, StoreSettings, UserAccount, Branch } from '../types';
import { dbService } from '../services/db';
import { SupabaseService } from '../services/supabase';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { StockTransferModal } from './StockTransferModal';
import { DamageReturnModal } from './DamageReturnModal';
import { matchProductSearch } from '../utils/search';

interface Props {
  settings: StoreSettings;
  products: Product[];
  currentUser?: UserAccount | null;
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const Inventory = ({ settings, products, currentUser, onDataChange, showToast }: Props) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferInitialProductId, setTransferInitialProductId] = useState<string | undefined>(undefined);
  const [damageProduct, setDamageProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [newlySavedId, setNewlySavedId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 40;

  // فروع النظام وإعدادات الفرع
  const branches = dbService.getBranches();
  const activeBranch = dbService.getActiveBranch();
  // الفلترة حسب الفرع: نضبطها افتراضياً على الفرع النشط، أو معرف فرع محدد، أو 'all' للمدير
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>(() => {
    if (currentUser && currentUser.role === 'cashier' && currentUser.branchId) {
      return currentUser.branchId;
    }
    return activeBranch.id;
  });

  // مزامنة فلتر الفرع مع الفرع النشط عند تغييره من الهيدر
  useEffect(() => {
    if (currentUser && currentUser.role === 'cashier' && currentUser.branchId) {
      setSelectedBranchFilter(currentUser.branchId);
    } else if (activeBranch.id) {
      setSelectedBranchFilter(activeBranch.id);
    }
  }, [activeBranch.id, currentUser]);

  // إعادة ضبط الصفحة عند تغيير شروط البحث والتصفية
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, onlyLowStock, selectedBranchFilter]);

  // فورم إضافة / تعديل المنتج
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('عام');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [quantity, setQuantity] = useState('10');
  const [minAlert, setMinAlert] = useState('5');
  const [unit, setUnit] = useState('حبة');
  // الفرع المستهدف لإضافة/تعديل المنتج
  const [targetBranchId, setTargetBranchId] = useState<string>('branch-main');

  const categories = ['all', ...Array.from(new Set(products.map((p) => p.category || 'عام')))];

  // ملخص الإتلاف وإرجاع المورد للصنف المفتوح في مودال التعديل (من سجل حركات المخزون الموجود أصلاً)
  const editingDamageSummary = useMemo(() => {
    const pid = editingProduct?.id;
    if (!isEditModalOpen || !pid) return null;
    const logs = dbService.getStockAuditLogs(pid).filter((l) => l.type === 'damage' || l.type === 'vendor_return');
    const damageQty = logs.filter((l) => l.type === 'damage').reduce((s, l) => s + Math.abs(Number(l.quantityDelta) || 0), 0);
    const vendorQty = logs.filter((l) => l.type === 'vendor_return').reduce((s, l) => s + Math.abs(Number(l.quantityDelta) || 0), 0);
    return { damageQty, vendorQty, last: logs[0] || null };
  }, [isEditModalOpen, editingProduct?.id]);

  const generateBarcode = () => {
    // توليد باركود عشوائي فريد يبدأ بـ 628
    const randomSuffix = Math.floor(100000000 + Math.random() * 900000000);
    const newBarcode = `628${randomSuffix}`;
    setBarcode(newBarcode);
    showToast(`تم توليد باركود جديد: ${newBarcode}`, 'info');
  };

  const openAddModal = (prefillBarcode?: string | any) => {
    setEditingProduct(null);
    setBarcode(typeof prefillBarcode === 'string' ? prefillBarcode : '');
    setName('');
    setCategory('عام');
    setPurchasePrice('');
    setSalePrice('');
    setMinAlert('5');
    setUnit('حبة');
    setQuantity('10');

    // تحديد الفرع المستهدف: الفرع المختار حالياً أو الفرع النشط
    const resolvedBranchId = selectedBranchFilter !== 'all' 
      ? selectedBranchFilter 
      : (activeBranch.id !== 'all' ? activeBranch.id : 'branch-main');
    setTargetBranchId(resolvedBranchId);

    setIsEditModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setBarcode(product.barcode);
    setName(product.name);
    setCategory(product.category || 'عام');
    setPurchasePrice(product.purchasePrice.toString());
    setSalePrice(product.salePrice.toString());
    setMinAlert(product.minQuantityAlert.toString());
    setUnit(product.unit || 'حبة');

    const bq = dbService.ensureBranchQuantities(product);
    const prodBranch = product.branchId || 'branch-main';
    setTargetBranchId(prodBranch);

    // إذا كنا نتصفح فرعاً محدداً، نعرض رصيد هذا الفرع، وإلا رصيد الصنف في فرعه
    const branchQty = selectedBranchFilter !== 'all'
      ? (bq[selectedBranchFilter] ?? product.quantity)
      : (bq[prodBranch] ?? product.quantity);

    setQuantity(branchQty.toString());
    setIsEditModalOpen(true);
  };

  const handleSaveProduct = (e: FormEvent) => {
    e.preventDefault();

    const cleanBarcode = barcode.trim();
    const cleanName = name.trim();

    if (!cleanBarcode) {
      showToast('يرجى إدخال أو توليد الباركود', 'warn');
      return;
    }

    if (!cleanName) {
      showToast('يرجى كتابة اسم المنتج', 'warn');
      return;
    }

    const numPurchase = parseFloat(purchasePrice) || 0;
    const numSale = parseFloat(salePrice) || 0;
    const numQty = Math.max(0, parseFloat(quantity) || 0);
    const numAlert = parseInt(minAlert, 10) || 5;

    if (numSale <= 0) {
      showToast('يرجى كتابة سعر بيع صحيح للمنتج', 'warn');
      return;
    }

    if (numPurchase > 0 && numSale < numPurchase) {
      if (!confirm('تنبيه: سعر البيع أقل من سعر الشراء (ستحقق خسارة). هل ترغب بالمتابعة؟')) {
        return;
      }
    }

    try {
      // تحديد الفرع المستهدف للحفظ (عزل مطلق بين الفروع)
      const finalBranch = selectedBranchFilter !== 'all' 
        ? selectedBranchFilter 
        : (editingProduct?.branchId || targetBranchId || (activeBranch.id !== 'all' ? activeBranch.id : 'branch-main'));
      
      const branchObj = branches.find((b) => b.id === finalBranch);
      const finalBranchName = branchObj ? branchObj.name : (finalBranch === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

      const savedProd = dbService.saveProduct({
        id: editingProduct?.id,
        barcode: cleanBarcode,
        name: cleanName,
        category: category.trim() || 'عام',
        purchasePrice: numPurchase,
        salePrice: numSale,
        quantity: numQty,
        branchId: finalBranch,
        branchName: finalBranchName,
        branchQuantities: {
          [finalBranch]: numQty,
        },
        minQuantityAlert: numAlert,
        unit: unit.trim() || 'حبة',
      });

      // رفع فوري وسريع إلى سحابة Supabase
      if (navigator.onLine && SupabaseService.isConfigured()) {
        SupabaseService.syncProduct(savedProd).then((ok) => {
          if (ok) {
            console.log('Product synced to Supabase successfully:', savedProd.name);
          }
        }).catch((err) => console.warn('Supabase product sync error:', err));
      }

      setNewlySavedId(savedProd.id);
      setIsEditModalOpen(false);
      setSearchQuery('');
      setCategoryFilter('all');
      setOnlyLowStock(false);

      showToast(
        editingProduct 
          ? `تم تحديث المنتج "${savedProd.name}" في (${finalBranchName}) بنجاح` 
          : `تمت إضافة الصنف "${savedProd.name}" إلى مخزن (${finalBranchName}) بنجاح (الكمية: ${numQty} ${savedProd.unit || 'حبة'})`,
        'success'
      );

      onDataChange();

      // إزالة وميض التحديد بعد 4 ثواني
      setTimeout(() => setNewlySavedId(null), 4000);
    } catch (e: any) {
      showToast('تعذر حفظ المنتج: ' + (e?.message || e), 'error');
    }
  };

  const handleDeleteProduct = (product: Product) => {
    setProductToDelete(product);
  };

  const confirmExecuteDeleteProduct = () => {
    if (!productToDelete) return;
    const prod = productToDelete;
    
    try {
      // حذف محلي فوري
      dbService.deleteProduct(prod.id, prod.barcode);
      
      // حذف نهائي فوري من Supabase
      if (navigator.onLine && SupabaseService.isConfigured()) {
        SupabaseService.deleteProduct(prod.id, prod.barcode).catch((err) =>
          console.warn('Supabase delete error:', err)
        );
      }

      showToast(`تم حذف الصنف "${prod.name}" نهائياً من المخزون والسحابة`, 'success');
      setProductToDelete(null);
      onDataChange();
    } catch (err: any) {
      showToast('حدث خطأ أثناء الحذف: ' + (err?.message || err), 'error');
    }
  };

  const handleExportCSV = () => {
    const csv = dbService.exportProductsCSV();
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `inventory_products_${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    showToast('تم تصدير ملف المخزون بنجاح', 'success');
  };

  // تصفية المنتجات بالبحث الذكي والفئات والنواقص ومخازن الفروع
  const filteredProducts = products.filter((p) => {
    // عزل تام ومطلق للفرع المختار: إذا تم تحديد فرع، نعرض فقط الأصناف التابعة له
    if (selectedBranchFilter !== 'all') {
      if (!dbService.isProductInBranch(p, selectedBranchFilter)) {
        return false;
      }
    }

    const pStock = selectedBranchFilter === 'all'
      ? p.quantity
      : (dbService.ensureBranchQuantities(p)[selectedBranchFilter] ?? p.quantity ?? 0);

    if (onlyLowStock && pStock > p.minQuantityAlert) return false;
    if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
    return matchProductSearch(p, searchQuery);
  });

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // اسم الفرع المعروض حالياً
  const currentBranchObj = branches.find((b) => b.id === selectedBranchFilter);

  return (
    <div className="space-y-5 animate-fade-in pb-16 font-['Cairo',sans-serif]">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white transition-colors">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
              <Package className="h-4 w-4" />
            </div>
            <h2 className="text-xl font-black">إدارة المخزون والمنتجات</h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            العرض الحالي: <b className="text-emerald-700 dark:text-emerald-400 font-bold">{selectedBranchFilter === 'all' ? '🏢 كل الفروع (المخزن المجمّع للإدارة)' : `🏪 ${currentBranchObj?.name || 'فرع محدد'}`}</b> • الأصناف المعروضة:{' '}
            <b className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</b> من أصل <b className="text-slate-800 dark:text-slate-200">{products.length}</b> صنف
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {/* زر التحويل المخزني بين الفروع */}
          <button
            type="button"
            onClick={() => {
              setTransferInitialProductId(undefined);
              setIsTransferModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-600/30 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-950 px-3.5 py-2.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 transition shadow-xs cursor-pointer"
            title="تحويل كميات من مخزن فرع إلى مخزن فرع آخر"
          >
            <ArrowLeftRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>تحويل مخزني بين الفروع</span>
          </button>

          <button
            type="button"
            onClick={() => openAddModal()}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-950/40 active:scale-95 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة صنف جديد</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 px-3.5 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-200 transition shadow-sm cursor-pointer"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            <span>تصدير Excel/CSV</span>
          </button>
        </div>
      </div>

      {/* شريط اختيار مخزن الفرع المعروض (عرض مخصص لكل فرع أو شامل للمدير) */}
      <div className="flex items-center gap-2 p-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-bold shrink-0 ml-2">
          <Warehouse className="h-4 w-4 text-emerald-600" />
          <span>مخزن العرض:</span>
        </div>

        <button
          type="button"
          onClick={() => setSelectedBranchFilter('all')}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
            selectedBranchFilter === 'all'
              ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" />
          <span>🏢 جميع الفروع (المخزن المجمّع - نظرة الإدارة)</span>
        </button>

        {branches.map((b) => (
          <button
            key={`branch-filter-${b.id}`}
            type="button"
            onClick={() => setSelectedBranchFilter(b.id)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold transition shrink-0 cursor-pointer ${
              selectedBranchFilter === b.id
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <span>{b.name}</span>
            {b.isMain && <span className="text-[10px] bg-emerald-500/20 px-1.5 py-0.2 rounded-full">رئيسي</span>}
          </button>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-2.5 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-xs transition-colors">
        <div className="relative flex-1">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
          <input
            type="text"
            placeholder="ابحث بالحرف أو الاسم (مثل: قه، حليب) أو الباركود أو الفئة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-2 pr-9 pl-8 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="مسح البحث"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
          >
            <option value="all">جميع الفئات ({categories.length - 1})</option>
            {categories.filter((c) => c !== 'all').map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <button
            onClick={() => setOnlyLowStock(!onlyLowStock)}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-2 font-bold transition cursor-pointer ${
              onlyLowStock
                ? 'bg-rose-600 text-white shadow-sm'
                : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>النواقص فقط</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden transition-colors">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
              <tr>
                <th className="py-3 px-4">الصنف والباركود</th>
                <th className="py-3 px-4">الفئة</th>
                <th className="py-3 px-4 text-center">سعر الشراء</th>
                <th className="py-3 px-4 text-center">سعر البيع</th>
                <th className="py-3 px-4 text-center">
                  {selectedBranchFilter === 'all' 
                    ? 'إجمالي المخزون وتوزيعه بالفروع' 
                    : `المخزون في (${currentBranchObj?.name || 'الفرع'})`}
                </th>
                <th className="py-3 px-4 text-center">حد التنبيه</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-slate-500">
                    لا توجد منتجات مطابقة للبحث أو الفلتر
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((p) => {
                  const bq = dbService.ensureBranchQuantities(p);
                  const branchStock = selectedBranchFilter === 'all' 
                    ? p.quantity 
                    : (bq[selectedBranchFilter] ?? 0);

                  const isLow = branchStock <= p.minQuantityAlert;
                  const isOut = branchStock <= 0;
                  const margin = p.salePrice - p.purchasePrice;

                  const isRecentlySaved = p.id === newlySavedId;

                  return (
                    <tr
                      key={p.id}
                      className={`transition duration-200 ${
                        isRecentlySaved
                          ? 'bg-emerald-100/70 dark:bg-emerald-950/70 ring-2 ring-emerald-500 font-medium'
                          : isOut
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : isLow
                          ? 'bg-amber-50/40 dark:bg-amber-950/20'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{p.name}</span>
                          {selectedBranchFilter === 'all' && (
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/60 dark:border-blue-800/50">
                              <Building2 className="w-2.5 h-2.5" />
                              {p.branchName || (p.branchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي')}
                            </span>
                          )}
                          {isRecentlySaved && (
                            <span className="bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-bounce">
                              ✨ تم الحفظ
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 font-mono flex items-center gap-2 mt-0.5">
                          <span>{p.barcode}</span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span>الوحدة: {p.unit || 'حبة'}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="rounded-lg bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-slate-700/60">
                          {p.category || 'عام'}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono font-semibold text-slate-600 dark:text-slate-300">
                        {p.purchasePrice.toFixed(2)} {settings.currency}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="font-mono font-bold text-slate-900 dark:text-white">
                          {p.salePrice.toFixed(2)} {settings.currency}
                        </div>
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">
                          هامش: +{margin.toFixed(2)}
                        </div>
                      </td>

                      {/* عمود الكمية - نظيف ومستقل حسب الفرع الحالي */}
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 font-mono font-bold text-sm">
                          <span
                            className={`${
                              isOut
                                ? 'text-rose-600 dark:text-rose-400 font-black'
                                : isLow
                                ? 'text-amber-600 dark:text-amber-400 font-black'
                                : 'text-slate-800 dark:text-slate-200'
                            }`}
                          >
                            {branchStock}
                          </span>
                          <span className="text-[10px] font-sans font-normal text-slate-400 dark:text-slate-500">
                            {p.unit || 'حبة'}
                          </span>
                        </div>

                        {isLow && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                            {isOut ? '⚠️ نفد المخزون' : '⚠️ أوشك على النفاد'}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-500 dark:text-slate-400">
                        {p.minQuantityAlert}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {/* زر التحويل المخزني السريع لهذا الصنف */}
                          {branches.length > 1 && (
                            <button
                              onClick={() => {
                                setTransferInitialProductId(p.id);
                                setIsTransferModalOpen(true);
                              }}
                              className="p-1.5 text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                              title="مناقلة / تحويل مخزني بين الفروع لهذا الصنف"
                            >
                              <ArrowLeftRight className="h-4 w-4" />
                            </button>
                          )}
                          {/* زر الإتلاف / الإرجاع للمصنع */}
                          <button
                            onClick={() => setDamageProduct(p)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition cursor-pointer"
                            title="إتلاف / إرجاع للمصنع"
                          >
                            <PackageMinus className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition cursor-pointer"
                            title="تعديل"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(p)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* أزرار التنقل بين الصفحات لدعم آلاف الأصناف بأعلى سرعة وسلاسة */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-slate-900 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
            <div>
              عرض <span className="font-bold font-mono text-slate-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</span> إلى{' '}
              <span className="font-bold font-mono text-slate-900 dark:text-white">{Math.min(currentPage * pageSize, filteredProducts.length)}</span> من أصل{' '}
              <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{filteredProducts.length}</span> صنف
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
                <span>السابق</span>
              </button>
              <span className="px-3 py-1 font-bold font-mono text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 rounded-lg">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 dark:hover:bg-slate-700 transition font-bold cursor-pointer"
              >
                <span>التالي</span>
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-3 sm:p-4 sm:pt-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] mt-1 sm:mt-2">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Package className="h-4 w-4 text-emerald-400" />
                {editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد للمخزون'}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-3.5 sm:p-4 space-y-2.5 text-xs overflow-y-auto">
              {/* ملخص الإتلاف وإرجاع المورد لهذا الصنف (يظهر عند التعديل فقط) */}
              {editingProduct && editingDamageSummary && (
                <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 space-y-2">
                  <h4 className="font-bold text-purple-800 dark:text-purple-300 text-[11px] flex items-center gap-1.5">
                    <PackageMinus className="h-3.5 w-3.5" />
                    إتلاف
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-purple-200 dark:border-purple-900/60">
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">إجمالي المتلف (إتلاف)</span>
                      <span className="font-black font-mono text-purple-700 dark:text-purple-300 text-sm">
                        {editingDamageSummary.damageQty} {editingProduct.unit || 'حبة'}
                      </span>
                    </div>
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-900/60">
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">إجمالي المرتجع للمورد</span>
                      <span className="font-black font-mono text-indigo-700 dark:text-indigo-300 text-sm">
                        {editingDamageSummary.vendorQty} {editingProduct.unit || 'حبة'}
                      </span>
                    </div>
                  </div>
                  {editingDamageSummary.last ? (
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 leading-snug bg-white dark:bg-slate-900 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
                      <span className="font-bold">آخر عملية:</span>{' '}
                      {new Date(editingDamageSummary.last.createdAt).toLocaleString('ar-SA')} —{' '}
                      {Math.abs(Number(editingDamageSummary.last.quantityDelta) || 0)} {editingProduct.unit || 'حبة'} —{' '}
                      {editingDamageSummary.last.reason || 'بدون سبب مسجل'}
                    </p>
                  ) : (
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">لا توجد عمليات إتلاف أو إرجاع مسجلة لهذا الصنف.</p>
                  )}
                </div>
              )}

              {/* Barcode & Scan & Auto-generate */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">الباركود (رقم الصنف)</label>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="text-[10px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    title="توليد باركود فريد تلقائياً إذا لم يكن على المنتج باركود"
                  >
                    <Sparkles className="h-3 w-3 text-amber-500" />
                    <span>توليد باركود تلقائي</span>
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    required
                    placeholder="امسح أو اكتب أو ولد باركود..."
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 font-mono text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-2.5 py-1.5 text-xs font-bold text-slate-950 transition cursor-pointer shrink-0"
                    title="مسح بالكاميرا"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>مسح</span>
                  </button>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">اسم المنتج</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: حليب نيدو 2.5 كجم"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-3 text-xs font-medium text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Category & Unit */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">الفئة / القسم</label>
                  <input
                    type="text"
                    placeholder="عام، ألبان، معلبات..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">وحدة القياس</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="حبة">حبة / قطعة</option>
                    <option value="كيس">كيس</option>
                    <option value="علبة">علبة</option>
                    <option value="كرتون">كرتون</option>
                    <option value="طبق">طبق</option>
                    <option value="كجم">كجم</option>
                    <option value="لتر">لتر</option>
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">سعر الشراء (التكلفة)</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    placeholder="0.00"
                    value={purchasePrice}
                    onChange={(e) => setPurchasePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">سعر البيع للزبون</label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    required
                    placeholder="0.00"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* اختيار الفرع يظهر فقط عند تصفح "جميع الفروع" للمدير حتى يحدد لأي فرع يضيف الصنف */}
              {selectedBranchFilter === 'all' && !editingProduct && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1.5">
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px]">
                    الفرع التابع له المنتج (سيضاف الصنف لهذا الفرع):
                  </label>
                  <div className="relative">
                    <select
                      value={targetBranchId}
                      onChange={(e) => setTargetBranchId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 px-3 text-xs font-bold text-slate-900 dark:text-white focus:border-emerald-600 focus:outline-none appearance-none"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isMain ? '(الفرع الرئيسي)' : ''}
                        </option>
                      ))}
                    </select>
                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Quantity & Alert Threshold */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">الكمية المتوفرة بالمخزن</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    placeholder="0"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 text-[11px] mb-1">حد تنبيه النقصان</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="5"
                    value={minAlert}
                    onChange={(e) => setMinAlert(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 py-1.5 px-2.5 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-2.5 text-xs font-bold text-white shadow-sm transition cursor-pointer"
                >
                  <Check className="h-4 w-4" />
                  <span>{editingProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-3 pt-8 sm:p-4 sm:pt-12 bg-slate-950/85 backdrop-blur-sm animate-fade-in overflow-y-auto font-['Cairo',sans-serif]">
          <div className="relative w-full max-w-xs sm:max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 p-5 text-center space-y-3.5 mt-2 sm:mt-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400">
              <Trash2 className="h-6 w-6" />
            </div>

            <div>
              <h3 className="font-bold text-base">تأكيد حذف الصنف</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                هل أنت متأكد من حذف الصنف{' '}
                <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                  "{productToDelete.name}"
                </span>{' '}
                نهائياً من المخزون والسحابة؟
              </p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono">
                الباركود: {productToDelete.barcode} • الكمية الحالية: {productToDelete.quantity}
              </p>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={confirmExecuteDeleteProduct}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 py-2.5 text-xs font-bold text-white shadow-sm shadow-rose-600/30 transition cursor-pointer"
              >
                نعم، احذف نهائياً
              </button>
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition cursor-pointer"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={(code) => {
          setBarcode(code);
          showToast(`تم مسح الباركود بنجاح: ${code}`, 'success');
        }}
        title="تصوير باركود المنتج"
        autoCloseOnScan={true}
      />

      {/* نافذة التحويل والمناقلة المخزنية بين الفروع */}
      <StockTransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        products={products}
        initialProductId={transferInitialProductId}
        currentUser={currentUser}
        onTransferSuccess={() => {
          onDataChange();
        }}
        showToast={showToast}
      />

      {/* نافذة الإتلاف / الإرجاع للمصنع والمورد */}
      <DamageReturnModal
        isOpen={!!damageProduct}
        onClose={() => setDamageProduct(null)}
        product={damageProduct}
        currentUser={currentUser}
        onSuccess={onDataChange}
        showToast={showToast}
      />
    </div>
  );
};
