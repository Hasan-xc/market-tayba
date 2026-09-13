import { useState, useRef, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Barcode, 
  Search, 
  Camera, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  ShoppingBag, 
  X, 
  Percent, 
  Sparkles, 
  Check, 
  AlertCircle,
  RotateCcw,
  Zap,
  Tag,
  PauseCircle,
  PlayCircle,
  Clock,
  UserCheck,
  UserPlus,
  Users,
  FileText,
  Printer,
  Eye,
  ChevronDown,
  Building2
} from 'lucide-react';
import { Product, CartItem, SaleTransaction, StoreSettings, ParkedCart, Customer, UserAccount } from '../types';
import { dbService } from '../services/db';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { matchProductSearch, normalizeArabicText } from '../utils/search';
import { SoundService } from '../utils/audio';

interface Props {
  settings: StoreSettings;
  products: Product[];
  currentUser?: UserAccount | null;
  onDataChange: () => void;
  showToast: (msg: string, type?: 'success' | 'error' | 'warn' | 'info') => void;
}

export const POS = ({ settings, products, currentUser, onDataChange, showToast }: Props) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'credit'>('cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isInlineAddCustomer, setIsInlineAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [cashTendered, setCashTendered] = useState<string>('');
  const [globalDiscount, setGlobalDiscount] = useState<number>(0);
  const [completedSale, setCompletedSale] = useState<SaleTransaction | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [selectedDiscountPercent, setSelectedDiscountPercent] = useState<number | null>(null);
  const [isParkedCartsModalOpen, setIsParkedCartsModalOpen] = useState(false);
  const [visibleProductCount, setVisibleProductCount] = useState(60);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const parkedCarts = dbService.getParkedCarts();
  const customers = dbService.getCustomers();
  const isSoundEnabled = settings.soundEnabled !== false;

  // تحديد الفرع النشط بدقة ونظام عزل المخزون
  const branches = dbService.getBranches();
  const isAdmin = currentUser?.role === 'admin';
  const activeBranchId = !isAdmin
    ? (currentUser?.branchId || 'branch-main')
    : (dbService.getActiveBranchId() === 'all' ? 'branch-main' : dbService.getActiveBranchId());
  const activeBranch = branches.find((b) => b.id === activeBranchId) || branches[0] || { id: 'branch-main', name: 'الفرع الرئيسي' };

  // عزل المنتجات: عرض منتجات هذا الفرع فقط حتى لا تظهر منتجات الفروع الأخرى بحالة نفد
  const branchProducts = useMemo(() => {
    return products.filter((p) => dbService.isProductInBranch(p, activeBranchId));
  }, [products, activeBranchId]);

  // استخراج الفئات الخاصة بمنتجات هذا الفرع
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(branchProducts.map((p) => p.category || 'عام')))];
  }, [branchProducts]);

  // قائمة الأصناف السريعة (Quick Picks) - المتوفرة في هذا الفرع حصراً
  const quickPickProducts = useMemo(() => {
    return branchProducts.filter((p) => dbService.getProductStock(p, activeBranchId) > 0).slice(0, 10);
  }, [branchProducts, activeBranchId]);

  // حساب الإجماليات
  const cartSubtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const netTotal = Math.max(0, cartSubtotal - globalDiscount);
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const numericCashTendered = parseFloat(cashTendered) || 0;
  const changeDue = Math.max(0, numericCashTendered - netTotal);

  // العملاء المفلترون للاختيار السريع
  const filteredCustomers = useMemo(() => {
    if (!customerSearchQuery.trim()) return customers;
    const norm = normalizeArabicText(customerSearchQuery);
    return customers.filter((c) => {
      const cNorm = normalizeArabicText(c.name);
      return cNorm.includes(norm) || (c.phone && c.phone.includes(customerSearchQuery.trim()));
    });
  }, [customers, customerSearchQuery]);

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // تطبيق نسبة الخصم
  const applyPercentDiscount = (percent: number) => {
    setSelectedDiscountPercent(percent);
    const discountVal = (cartSubtotal * percent) / 100;
    setGlobalDiscount(Math.round(discountVal * 100) / 100);
  };

  // إلغاء الخصم
  const clearDiscount = () => {
    setSelectedDiscountPercent(null);
    setGlobalDiscount(0);
  };

  // تعديل المبلغ الصافي يدوياً
  const handleManualNetTotalChange = (valStr: string) => {
    setSelectedDiscountPercent(null);
    if (valStr === '') {
      setGlobalDiscount(0);
      return;
    }
    const val = parseFloat(valStr);
    if (isNaN(val) || val < 0) return;
    const diff = Math.max(0, cartSubtotal - val);
    setGlobalDiscount(Math.round(diff * 100) / 100);
  };

  // إضافة منتج للسلة بالاعتماد على مخزون الفرع الحالي
  const addToCart = (product: Product, quantityToAdd = 1) => {
    const branchStock = dbService.getProductStock(product, activeBranchId);
    if (branchStock <= 0) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast(`المنتج "${product.name}" نفد من مخزن فرع (${activeBranch.name})`, 'warn');
      return;
    }

    setCart((prevCart) => {
      const existingIndex = prevCart.findIndex((item) => item.product.id === product.id);

      if (existingIndex !== -1) {
        const existingItem = prevCart[existingIndex];
        const newQty = existingItem.quantity + quantityToAdd;

        if (newQty > branchStock) {
          if (isSoundEnabled) SoundService.playWarning();
          showToast(`الكمية المتاحة في مخزن الفرع الحالي فقط ${branchStock} ${product.unit || 'حبة'}`, 'warn');
          return prevCart;
        }

        const updated = [...prevCart];
        const itemTotal = (existingItem.unitPrice - existingItem.discount) * newQty;
        updated[existingIndex] = {
          ...existingItem,
          quantity: newQty,
          total: Math.max(0, itemTotal),
        };
        if (isSoundEnabled) SoundService.playScanSuccess();
        return updated;
      } else {
        const itemTotal = product.salePrice * quantityToAdd;
        if (isSoundEnabled) SoundService.playScanSuccess();
        return [
          {
            product,
            quantity: quantityToAdd,
            unitPrice: product.salePrice,
            discount: 0,
            total: itemTotal,
          },
          ...prevCart,
        ];
      }
    });
  };

  // تعديل كمية الصنف بالسلة
  const updateItemQuantity = (productId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.product.id === productId) {
          // مهم: الفحص على مخزون فرع البيع الحالي (وليس مجموع كل الفروع)
          const branchStock = dbService.getProductStock(item.product, activeBranchId);
          if (newQty > branchStock) {
            if (isSoundEnabled) SoundService.playWarning();
            showToast(`الكمية المتاحة في مخزن الفرع فقط ${branchStock} ${item.product.unit || 'حبة'}`, 'warn');
            return item;
          }
          const itemTotal = (item.unitPrice - item.discount) * newQty;
          return {
            ...item,
            quantity: newQty,
            total: Math.max(0, itemTotal),
          };
        }
        return item;
      });
    });
  };

  // حذف صنف من السلة
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product.id !== productId));
  };

  // تفريغ السلة
  const clearCart = () => {
    if (cart.length === 0) return;
    setCart([]);
    setGlobalDiscount(0);
    setCashTendered('');
    showToast('تم تفريغ السلة', 'info');
  };

  // تعليق السلة (Park/Hold Cart)
  const handleHoldCurrentCart = () => {
    if (cart.length === 0) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast('السلة فارغة، لا يوجد ما يمكن تعليقه', 'warn');
      return;
    }

    const defaultName = `سلة عميل #${parkedCarts.length + 1} (${totalItemsCount} صنف)`;
    const parked = dbService.parkCart({
      name: defaultName,
      items: [...cart],
      subtotal: cartSubtotal,
      discount: globalDiscount,
      cashierName: settings.activeCashier,
    });

    if (isSoundEnabled) SoundService.playHoldCart();
    showToast(`تم تعليق السلة: ${parked.name}`, 'success');

    setCart([]);
    setGlobalDiscount(0);
    setCashTendered('');
    onDataChange();
  };

  // استعادة سلة معلقة
  const handleRestoreParkedCart = (parked: ParkedCart) => {
    if (cart.length > 0) {
      dbService.parkCart({
        name: `سلة عميل سابقة (${cart.length} أصناف)`,
        items: [...cart],
        subtotal: cartSubtotal,
        discount: globalDiscount,
        cashierName: settings.activeCashier,
      });
    }

    setCart(parked.items);
    setGlobalDiscount(parked.discount || 0);
    dbService.deleteParkedCart(parked.id);
    setIsParkedCartsModalOpen(false);
    onDataChange();
    if (isSoundEnabled) SoundService.playScanSuccess();
    showToast(`تمت استعادة سلة: ${parked.name}`, 'success');
  };

  // حذف سلة معلقة
  const handleDeleteParkedCart = (id: string) => {
    dbService.deleteParkedCart(id);
    onDataChange();
    showToast('تم حذف السلة المعلقة', 'info');
  };

  // إضافة بالباركود أو الاسم
  const handleBarcodeSubmit = (e?: FormEvent) => {
    if (e) e.preventDefault();
    const query = barcodeInput.trim();
    if (!query) return;

    const exactByBarcode = branchProducts.find((p) => p.barcode === query);
    if (exactByBarcode) {
      addToCart(exactByBarcode);
      showToast(`تمت إضافة: ${exactByBarcode.name}`, 'success');
      setBarcodeInput('');
      return;
    }

    // إذا كان الباركود موجوداً في فرع آخر، تنبيه الكاشير
    const inOtherBranch = products.find((p) => p.barcode === query);
    if (inOtherBranch) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast(`الصنف "${inOtherBranch.name}" مسجل بفرع (${inOtherBranch.branchName || 'آخر'}) وغير متوفر في نقطة بيع (${activeBranch.name})`, 'warn');
      return;
    }

    const matchedProducts = branchProducts.filter((p) => matchProductSearch(p, query));
    if (matchedProducts.length > 0) {
      const targetProduct = matchedProducts[0];
      addToCart(targetProduct);
      showToast(`تمت إضافة: ${targetProduct.name}`, 'success');
      setBarcodeInput('');
    } else {
      if (isSoundEnabled) SoundService.playWarning();
      showToast(`لم يتم العثور على صنف في مخزن (${activeBranch.name}) بالباركود أو الاسم: "${query}"`, 'warn');
    }
  };

  // إضافة بالباركود عبر الكاميرا
  const handleScanBarcode = (scannedCode: string) => {
    const product = branchProducts.find((p) => p.barcode === scannedCode);
    if (product) {
      addToCart(product);
      showToast(`تمت إضافة: ${product.name}`, 'success');
    } else {
      const inOther = products.find((p) => p.barcode === scannedCode);
      if (inOther) {
        if (isSoundEnabled) SoundService.playWarning();
        showToast(`الصنف "${inOther.name}" مخصص لفرع (${inOther.branchName || 'آخر'}) وليس فرع (${activeBranch.name})`, 'warn');
      } else {
        if (isSoundEnabled) SoundService.playWarning();
        showToast(`باركود غير مسجل في مخزون الفرع: ${scannedCode}`, 'warn');
      }
    }
  };

  // حفظ زبون سريع داخل مودال الدفع
  const handleQuickAddCustomer = (e: FormEvent) => {
    e.preventDefault();
    const cleanName = newCustomerName.trim();
    if (!cleanName) {
      showToast('يرجى كتابة اسم الزبون', 'warn');
      return;
    }

    const saved = dbService.saveCustomer({
      name: cleanName,
      phone: newCustomerPhone.trim() || undefined,
      currentDebt: 0,
    });

    setSelectedCustomerId(saved.id);
    setIsInlineAddCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    onDataChange();
    showToast(`تمت إضافة الزبون "${saved.name}" بنجاح`, 'success');
  };

  // إتمام عملية البيع
  const handleCheckout = () => {
    if (cart.length === 0) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast('السلة فارغة!', 'warn');
      return;
    }

    if (paymentMethod === 'credit' && !selectedCustomerId) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast('يرجى اختيار اسم الزبون لتقييد الفاتورة على حسابه بالآجل', 'warn');
      return;
    }

    if (paymentMethod === 'cash' && numericCashTendered > 0 && numericCashTendered < netTotal) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast('المبلغ المدفوع أقل من إجمالي الفاتورة', 'warn');
      return;
    }

    try {
      const saleItems = cart.map((item) => {
        const itemProfit = (item.unitPrice - item.product.purchasePrice - item.discount) * item.quantity;
        return {
          productId: item.product.id,
          barcode: item.product.barcode,
          productName: item.product.name,
          quantity: item.quantity,
          purchasePrice: item.product.purchasePrice,
          unitPrice: item.unitPrice,
          discount: item.discount,
          total: item.total,
          profit: itemProfit,
        };
      });

      const totalProfit = saleItems.reduce((sum, item) => sum + item.profit, 0) - globalDiscount;

      const cust = selectedCustomer;

      const newSale = dbService.addSale({
        items: saleItems,
        subtotal: cartSubtotal,
        discountTotal: globalDiscount,
        netTotal: netTotal,
        totalProfit: totalProfit,
        paymentMethod: paymentMethod,
        cashTendered: paymentMethod === 'cash' ? (numericCashTendered || netTotal) : netTotal,
        changeDue: paymentMethod === 'cash' ? (changeDue || 0) : 0,
        cashierName: currentUser ? currentUser.name : (settings.activeCashier || 'كاشير'),
        branchId: activeBranch.id,
        branchName: activeBranch.name,
        customerId: paymentMethod === 'credit' && cust ? cust.id : undefined,
        customerName: paymentMethod === 'credit' && cust ? cust.name : undefined,
      });

      if (isSoundEnabled) SoundService.playCheckoutSuccess();

      showToast(
        paymentMethod === 'credit' && cust
          ? `تم تسجيل الفاتورة بنجاح على حساب: ${cust.name}`
          : `تم إتمام الفاتورة بنجاح: ${newSale.invoiceNumber}`,
        'success'
      );

      setCompletedSale(newSale);
      setIsCheckoutOpen(false);
      setSelectedCustomerId('');
      
      // تفريغ السلة
      setCart([]);
      setGlobalDiscount(0);
      setCashTendered('');
      onDataChange();

      // التحقق من خيارات الطباعة المباشرة والمعاينة الذكية
      const shouldAutoPrint = Boolean(settings.autoPrintReceipt);
      const shouldSkipModal = Boolean(settings.skipReceiptPreviewModal);

      if (shouldAutoPrint) {
        setIsReceiptOpen(true);
        setTimeout(() => {
          window.print();
          if (shouldSkipModal) {
            setTimeout(() => {
              setIsReceiptOpen(false);
            }, 600);
          }
        }, 350);
      } else if (!shouldSkipModal) {
        setIsReceiptOpen(true);
      } else {
        setIsReceiptOpen(false);
      }
    } catch (e: any) {
      if (isSoundEnabled) SoundService.playWarning();
      showToast('خطأ في إتمام العملية: ' + e.message, 'error');
    }
  };

  // فلترة المنتجات مع كاشينج سريع - محصور بمنتجات الفرع الحالي حصراً
  const filteredProducts = useMemo(() => {
    return branchProducts.filter((p) => {
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      const matchesQuery = matchProductSearch(p, barcodeInput);
      return matchesCategory && matchesQuery;
    });
  }, [branchProducts, selectedCategory, barcodeInput]);

  // إعادة ضبط عدد المعروض عند تغيير البحث أو التصنيف
  useEffect(() => {
    setVisibleProductCount(60);
  }, [barcodeInput, selectedCategory]);

  // المنتجات المعروضة حالياً لتحقيق أعلى سرعة استجابة مع آلاف الأصناف
  const displayedProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleProductCount);
  }, [filteredProducts, visibleProductCount]);

  return (
    <div className="flex flex-col gap-3.5 pb-16 animate-fade-in max-w-5xl mx-auto font-['Cairo',sans-serif]">
      {/* شريط تعريف الفرع والعزل التام للمخزون */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 rounded-2xl bg-slate-900 text-white text-xs border border-slate-800 shadow-md">
        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-slate-300">فرع البيع:</span>
          <span className="font-black text-emerald-400 text-sm">{activeBranch.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 font-bold">
            مخزون مستقل معزول
          </span>
        </div>
        <div className="text-[11px] text-slate-300 flex items-center gap-2">
          <span>الأصناف المتوفرة لهذا الفرع:</span>
          <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md font-mono border border-slate-700">
            {branchProducts.length}
          </span>
        </div>
      </div>

      {/* ================= 1. مربع السلة في أعلى الصفحة ================= */}
      <div className="w-full">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-lg flex flex-col overflow-hidden">
          {/* رأس السلة */}
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-3.5 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-400/30">
                <ShoppingBag className="h-4 w-4" />
              </div>
              <span className="font-bold text-sm tracking-wide">السلة</span>
              {cart.length > 0 && (
                <span className="text-[11px] font-mono bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  {totalItemsCount}
                </span>
              )}

              {/* زر عرض السلات المعلقة */}
              {parkedCarts.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsParkedCartsModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 px-2.5 py-1 text-[11px] font-bold text-amber-300 hover:bg-amber-500/30 transition cursor-pointer"
                  title="استعراض السلات المعلقة"
                >
                  <PauseCircle className="h-3.5 w-3.5 text-amber-400" />
                  <span>معلقة ({parkedCarts.length})</span>
                </button>
              )}
            </div>

            {/* أزرار الإجراءات */}
            <div className="flex items-center gap-1.5">
              {cart.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={handleHoldCurrentCart}
                    className="flex items-center gap-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 px-2.5 py-1 text-[11px] font-bold text-amber-300 transition cursor-pointer"
                    title="تعليق السلة مؤقتاً"
                  >
                    <PauseCircle className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">تعليق</span>
                  </button>

                  <button
                    type="button"
                    id="posClearCartBtn"
                    onClick={clearCart}
                    className="flex items-center gap-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 px-2 py-1 text-[11px] font-bold text-rose-300 transition cursor-pointer"
                    title="تفريغ السلة"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="hidden sm:inline">تفريغ</span>
                  </button>
                </>
              )}

              {/* زر قارئ الباركود بالكاميرا */}
              <button
                type="button"
                id="openCameraScannerBtn"
                onClick={() => setIsScannerOpen(true)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 px-2.5 sm:px-3 py-1.5 text-xs font-black text-slate-950 shadow-xs transition cursor-pointer shrink-0"
                title="فتح كاميرا قارئ الباركود"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>باركود</span>
              </button>
            </div>
          </div>

          {/* شريط الإشعار بالفاتورة الأخيرة مع خيارات المعاينة والطباعة */}
          {completedSale && !isReceiptOpen && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/60 px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 text-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping shrink-0" />
                <span className="font-bold text-slate-800 dark:text-slate-200">
                  آخر فاتورة تم إتمامها: #{completedSale.invoiceNumber} ({completedSale.netTotal.toFixed(2)} {settings.currency})
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsReceiptOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition cursor-pointer text-[11px]"
                >
                  <Eye className="h-3 w-3" />
                  <span>معاينة الفاتورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsReceiptOpen(true);
                    setTimeout(() => window.print(), 200);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold transition cursor-pointer text-[11px]"
                >
                  <Printer className="h-3 w-3 text-emerald-400" />
                  <span>طباعة سريعة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCompletedSale(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                  title="إغلاق هذا الشريط"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* قائمة الأصناف بالسلة */}
          <div className="p-2.5 space-y-1.5 min-h-[90px] max-h-[260px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-slate-500 text-center space-y-1.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400">
                  <ShoppingBag className="h-4 w-4" />
                </div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">السلة فارغة حالياً</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500">امسح الباركود أو انقر على أي صنف لإضافته</p>
              </div>
            ) : (
              cart.map((item, idx) => (
                <div key={`cart-item-${item.product.id || item.product.barcode || idx}-${idx}`} className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 text-xs">
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="font-bold text-slate-900 dark:text-white truncate">{item.product.name}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {item.unitPrice.toFixed(2)} × {item.quantity} = <b className="text-slate-800 dark:text-emerald-400 font-bold">{item.total.toFixed(2)} {settings.currency}</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.product.id, item.quantity - 1)}
                      className="flex h-5 w-5 items-center justify-center rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 shadow-xs cursor-pointer text-xs"
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="w-5 text-center font-mono font-bold text-xs text-slate-900 dark:text-white">
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => updateItemQuantity(item.product.id, item.quantity + 1)}
                      className="flex h-5 w-5 items-center justify-center rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 shadow-xs cursor-pointer text-xs"
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeFromCart(item.product.id)}
                    className="p-1 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 rounded-md hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer shrink-0"
                    title="حذف من السلة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* ذيل السلة والدفع */}
          <div className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/70 p-2.5 sm:p-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-baseline gap-1.5">
                <span className="font-bold text-slate-600 dark:text-slate-400">المجموع:</span>
                <span className="font-mono font-black text-sm text-slate-900 dark:text-white">
                  {cartSubtotal.toFixed(2)}
                </span>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">{settings.currency}</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-0.5">
                  <Percent className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                  خصم:
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={globalDiscount || ''}
                  placeholder="0"
                  onChange={(e) => setGlobalDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-14 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-0.5 px-1.5 text-center font-mono font-bold text-xs focus:border-emerald-600 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="button"
              id="openCheckoutModalBtn"
              disabled={cart.length === 0}
              onClick={() => setIsCheckoutOpen(true)}
              className={`w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs sm:text-sm font-bold shadow-md transition cursor-pointer ${
                cart.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white shadow-emerald-600/20'
              }`}
            >
              <Banknote className="h-4 w-4" />
              <span>دفع الفاتورة ({netTotal.toFixed(2)} {settings.currency})</span>
            </button>
          </div>
        </div>
      </div>

      {/* ================= 2. الأصناف السريعة (Quick Picks) ================= */}
      {quickPickProducts.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              أصناف سريعة بنقرة واحدة:
            </span>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {quickPickProducts.map((p) => {
              const inCart = cart.find((item) => item.product.id === p.id);
              return (
                <button
                  key={`quick-${p.id}`}
                  type="button"
                  onClick={() => addToCart(p)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold whitespace-nowrap transition cursor-pointer shrink-0 shadow-2xs ${
                    inCart
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-slate-50 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <span>{p.name}</span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400 font-black">
                    {p.salePrice.toFixed(2)}
                  </span>
                  {inCart && (
                    <span className="h-4 w-4 rounded-full bg-emerald-700 dark:bg-emerald-600 text-white text-[10px] flex items-center justify-center font-mono">
                      {inCart.quantity}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ================= 3. قسم البحث وقائمة المنتجات ================= */}
      <div className="w-full space-y-2.5">
        <div className="bg-white dark:bg-slate-900 p-2 sm:p-2.5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-xs">
          <form onSubmit={handleBarcodeSubmit} className="relative flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <input
                ref={barcodeInputRef}
                type="text"
                id="posBarcodeInput"
                placeholder="ابحث بالاسم أو اكتب الباركود..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/70 hover:bg-white dark:hover:bg-slate-800 focus:bg-white dark:focus:bg-slate-800 py-2 pr-9 pl-9 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-emerald-600 focus:outline-none transition"
              />
              {barcodeInput && (
                <button
                  type="button"
                  onClick={() => setBarcodeInput('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                  title="مسح البحث"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {barcodeInput.trim() && (
              <button
                type="submit"
                id="posAddBarcodeBtn"
                className="rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 px-3.5 py-2 text-xs font-bold text-white transition shrink-0 cursor-pointer"
              >
                إضافة
              </button>
            )}
          </form>
        </div>

        {/* فئات المنتجات */}
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          {categories.map((cat, idx) => (
            <button
              key={`pos-cat-${cat}-${idx}`}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-xl px-3 py-1 font-bold text-xs transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 dark:bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {cat === 'all' ? '📦 الكل' : cat}
            </button>
          ))}
        </div>

        {/* شبكة بطاقات المنتجات */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-[480px] overflow-y-auto pr-0.5">
          {displayedProducts.map((p, idx) => {
            const branchStock = dbService.getProductStock(p, activeBranchId);
            const isOutOfStock = branchStock <= 0;
            const isLowStock = !isOutOfStock && branchStock <= p.minQuantityAlert;
            const inCart = cart.find((item) => item.product.id === p.id);

            return (
              <div
                key={`pos-product-${p.id || p.barcode}-${idx}`}
                onClick={() => !isOutOfStock && addToCart(p)}
                className={`group relative flex flex-col justify-between rounded-xl border p-2 text-right transition cursor-pointer select-none ${
                  isOutOfStock
                    ? 'border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/60 opacity-60 cursor-not-allowed'
                    : inCart
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 shadow-xs ring-1 ring-emerald-600/30'
                    : 'border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500 dark:hover:border-emerald-500 hover:shadow-xs'
                }`}
              >
                {inCart && (
                  <span className="absolute -top-1.5 -left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-700 dark:bg-emerald-600 text-[10px] font-black text-white font-mono shadow-xs">
                    {inCart.quantity}
                  </span>
                )}

                <div>
                  <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 font-mono line-clamp-1">{p.barcode}</div>
                  <h4 className="font-bold text-[11px] text-slate-800 dark:text-slate-100 line-clamp-2 leading-tight mt-0.5 min-h-[1.75rem]">
                    {p.name}
                  </h4>
                </div>

                <div className="mt-1.5 pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-baseline justify-between">
                  <span
                    className={`text-[9px] font-medium ${
                      isOutOfStock
                        ? 'text-rose-600 dark:text-rose-400 font-bold'
                        : isLowStock
                        ? 'text-amber-600 dark:text-amber-400 font-bold'
                        : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {isOutOfStock ? 'نفد' : `متاح: ${branchStock}`}
                  </span>

                  <div>
                    <span className="font-mono font-black text-xs text-emerald-800 dark:text-emerald-400">
                      {p.salePrice.toFixed(2)}
                    </span>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 mr-0.5">{settings.currency}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* زر إظهار المزيد من المنتجات لدعم آلاف الأصناف بسرعة فائقة */}
        {filteredProducts.length > visibleProductCount && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setVisibleProductCount((prev) => prev + 60)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
            >
              <ChevronDown className="h-4 w-4 text-emerald-500" />
              <span>عرض المزيد من الأصناف (+60) • المتبقي {filteredProducts.length - visibleProductCount} صنف</span>
            </button>
            <button
              type="button"
              onClick={() => setVisibleProductCount(filteredProducts.length)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-bold transition cursor-pointer"
            >
              عرض الكل ({filteredProducts.length})
            </button>
          </div>
        )}
      </div>

      {/* ================= نافذة إتمام الدفع (Checkout Modal) ================= */}
      {isCheckoutOpen && (
        <div id="checkoutModal" className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-3 sm:p-4 sm:pt-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] mt-1">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-emerald-400" />
                <h3 className="font-bold text-sm">إتمام عملية البيع والدفع</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCheckoutOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3 overflow-y-auto text-xs">
              {/* خيارات طرق الدفع (نقدي / شبكة / آجل ديون) */}
              <div>
                <label className="text-slate-600 dark:text-slate-400 font-bold block mb-1.5">اختر طريقة الدفع:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    id="payMethodCashBtn"
                    onClick={() => setPaymentMethod('cash')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-600/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>نقدي (كاش)</span>
                  </button>

                  <button
                    type="button"
                    id="payMethodCardBtn"
                    onClick={() => setPaymentMethod('card')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                      paymentMethod === 'card'
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-300 shadow-xs ring-2 ring-emerald-600/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                    <span>شبكة / مدى</span>
                  </button>

                  <button
                    type="button"
                    id="payMethodCreditBtn"
                    onClick={() => setPaymentMethod('credit')}
                    className={`flex flex-col items-center justify-center gap-1 py-2 px-1 rounded-xl border font-bold transition cursor-pointer ${
                      paymentMethod === 'credit'
                        ? 'border-rose-600 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-300 shadow-xs ring-2 ring-rose-600/20'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60'
                    }`}
                  >
                    <FileText className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <span>آجل (دين)</span>
                  </button>
                </div>
              </div>

              {/* في حال اختيار البيع بالآجل (Credit / Debt) */}
              {paymentMethod === 'credit' && (
                <div className="rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 p-3 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900 dark:text-rose-300 text-xs flex items-center gap-1">
                      <Users className="h-3.5 w-3.5 text-rose-700 dark:text-rose-400" />
                      تحديد الزبون المدين:
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsInlineAddCustomer(!isInlineAddCustomer)}
                      className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-0.5 cursor-pointer"
                    >
                      <Plus className="h-3 w-3" />
                      {isInlineAddCustomer ? 'اختيار من القائمة' : 'زبون جديد +'}
                    </button>
                  </div>

                  {isInlineAddCustomer ? (
                    <form onSubmit={handleQuickAddCustomer} className="space-y-2 bg-white dark:bg-slate-800 p-2.5 rounded-xl border border-rose-200 dark:border-rose-800/60">
                      <div>
                        <input
                          type="text"
                          required
                          placeholder="اسم الزبون (مطلوب)"
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1.5 text-xs font-bold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <div>
                        <input
                          type="tel"
                          placeholder="رقم الهاتف (اختياري)"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 p-1.5 text-xs font-mono text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-emerald-600"
                        />
                      </div>
                      <button
                        type="submit"
                        className="w-full py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition cursor-pointer"
                      >
                        حفظ واختيار الزبون
                      </button>
                    </form>
                  ) : (
                    <div className="space-y-1.5">
                      <input
                        type="text"
                        placeholder="ابحث باسم الزبون..."
                        value={customerSearchQuery}
                        onChange={(e) => setCustomerSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-rose-600"
                      />
                      <div className="max-h-28 overflow-y-auto divide-y divide-rose-100 dark:divide-rose-900/40 rounded-lg border border-rose-100 dark:border-rose-900/50 bg-white dark:bg-slate-800">
                        {filteredCustomers.length === 0 ? (
                          <div className="p-2 text-center text-slate-400 dark:text-slate-500 text-[11px]">
                            لا يوجد زبون مطابق. اضغط "زبون جديد +" لإضافته.
                          </div>
                        ) : (
                          filteredCustomers.map((c) => (
                            <div
                              key={c.id}
                              onClick={() => setSelectedCustomerId(c.id)}
                              className={`p-2 flex items-center justify-between cursor-pointer text-[11px] ${
                                selectedCustomerId === c.id
                                  ? 'bg-rose-100 dark:bg-rose-950/80 text-rose-900 dark:text-rose-200 font-bold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/50 text-slate-800 dark:text-slate-200'
                              }`}
                            >
                              <span>{c.name}</span>
                              <span className="font-mono text-rose-700 dark:text-rose-400 font-bold">
                                دين سابق: {c.currentDebt.toFixed(2)} {settings.currency}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {selectedCustomer && !isInlineAddCustomer && (
                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-rose-200 dark:border-rose-800/60 text-[11px] space-y-0.5">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">الزبون المحدد:</span>
                        <strong className="text-slate-900 dark:text-white">{selectedCustomer.name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400">الدين الحالي:</span>
                        <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                          {selectedCustomer.currentDebt.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 font-bold text-rose-900 dark:text-rose-300">
                        <span>الرصيد بعد هذه الفاتورة:</span>
                        <span className="font-mono">
                          {(selectedCustomer.currentDebt + netTotal).toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* قسم الخصم */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/50 p-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    <Tag className="h-3.5 w-3.5 text-amber-500" />
                    <span>تطبيق خصم سريع:</span>
                  </div>
                  {globalDiscount > 0 && (
                    <button
                      type="button"
                      onClick={clearDiscount}
                      className="text-[10px] text-rose-600 dark:text-rose-400 font-bold hover:underline cursor-pointer"
                    >
                      إلغاء الخصم (0)
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-5 gap-1">
                  {[5, 10, 15, 20, 25].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyPercentDiscount(pct)}
                      className={`py-1.5 px-0.5 rounded-lg font-mono font-bold text-[11px] transition border cursor-pointer ${
                        selectedDiscountPercent === pct
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs ring-1 ring-amber-600/30'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      %{pct}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/80 dark:border-slate-700/80">
                  <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium shrink-0">أو خصم بمبلغ:</span>
                  <div className="relative flex-1">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max={cartSubtotal}
                      placeholder="0.00"
                      value={globalDiscount > 0 ? globalDiscount : ''}
                      onChange={(e) => {
                        setSelectedDiscountPercent(null);
                        const val = parseFloat(e.target.value) || 0;
                        setGlobalDiscount(Math.min(cartSubtotal, Math.max(0, val)));
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white py-1 pr-2.5 pl-10 text-[11px] font-mono font-bold focus:border-emerald-600 focus:outline-none"
                    />
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 dark:text-slate-400 font-bold pointer-events-none">
                      {settings.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* حساب المبلغ الصافي */}
              <div className="rounded-xl bg-slate-900 p-3 text-white space-y-1.5 border border-slate-800 shadow-inner">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>المجموع الأصلي ({totalItemsCount} قطع):</span>
                  <span className="font-mono text-slate-300 font-bold">{cartSubtotal.toFixed(2)} {settings.currency}</span>
                </div>

                {globalDiscount > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-rose-400 font-bold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/40">
                    <span>الخصم {selectedDiscountPercent ? `(%${selectedDiscountPercent})` : ''}:</span>
                    <span className="font-mono">-{globalDiscount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}

                <div className="pt-1.5 border-t border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-emerald-400">
                      المبلغ النهائي المطلوب للدفع:
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={netTotal > 0 ? netTotal : (cartSubtotal === 0 ? '' : '0')}
                      onChange={(e) => handleManualNetTotalChange(e.target.value)}
                      className="w-full rounded-xl bg-slate-950 border-2 border-emerald-500/80 py-2 pr-3 pl-14 text-center font-mono font-black text-2xl text-emerald-400 focus:border-emerald-400 focus:outline-none"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 pointer-events-none">
                      {settings.currency}
                    </span>
                  </div>
                </div>
              </div>

              {/* زر تأكيد وطباعة الفاتورة */}
              <button
                type="button"
                id="confirmCheckoutBtn"
                onClick={handleCheckout}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 active:scale-[0.98] transition cursor-pointer"
              >
                <Check className="h-4 w-4" />
                <span>
                  {paymentMethod === 'credit'
                    ? 'تسجيل الفاتورة على حساب العميل بالآجل'
                    : 'تأكيد العملية وطباعة الفاتورة'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= نافذة السلات المعلقة (Parked Carts Modal) ================= */}
      {isParkedCartsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-4 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-amber-400" />
                <h3 className="font-bold text-sm">السلات المعلقة مؤقتاً ({parkedCarts.length})</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsParkedCartsModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto">
              {parkedCarts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
                  لا توجد سلات معلقة حالياً
                </div>
              ) : (
                parkedCarts.map((p) => {
                  const heldDate = new Date(p.heldAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={p.id}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                          <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          <span>{p.name}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {heldDate}
                          </span>
                          <span>•</span>
                          <span>الكاشير: {p.cashierName}</span>
                          <span>•</span>
                          <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                            {(p.subtotal - (p.discount || 0)).toFixed(2)} {settings.currency}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-sm">
                          {p.items.map((it) => `${it.product.name} (x${it.quantity})`).join(', ')}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRestoreParkedCart(p)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                        >
                          <PlayCircle className="h-3.5 w-3.5" />
                          <span>استعادة</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteParkedCart(p.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          title="حذف السلة"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ماسح الباركود المستمر للبيع */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBarcode}
        title="ماسح باركود البيع المستمر"
        autoCloseOnScan={false}
      />

      {/* مودال الفاتورة الحرارية */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        sale={completedSale}
        settings={settings}
        onNewSale={() => {
          setIsReceiptOpen(false);
        }}
      />
    </div>
  );
};
