import { useState, useRef, useMemo, useEffect, type FormEvent } from 'react';
import { 
  Search, 
  Camera, 
  Trash2, 
  Plus, 
  Minus, 
  Banknote, 
  ShoppingBag, 
  X, 
  Percent, 
  Check, 
  Zap,
  PauseCircle,
  Printer,
  Eye,
  ChevronDown,
  Building2,
  Scale,
  Pencil
} from 'lucide-react';
import { Product, CartItem, SaleTransaction, StoreSettings, ParkedCart, Customer, UserAccount } from '../types';
import { dbService } from '../services/db';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { ReceiptModal } from './ReceiptModal';
import { WeightEntryModal } from './WeightEntryModal';
import { PosCheckoutModal } from './PosCheckoutModal';
import { PosParkedCartsModal } from './PosParkedCartsModal';
import { matchProductSearch, normalizeArabicText } from '../utils/search';
import { SoundService } from '../utils/audio';
import { roundMoney } from '../utils/money';

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
  // منتج الوزن/الكمية الحرة المنتظر إدخال وزنه أو مبلغه قبل إضافته للسلة
  const [weightModalProduct, setWeightModalProduct] = useState<Product | null>(null);
  // تعديل سعر صنف واحد داخل السلة (زيادة/نقصان على سعر البيع الأساسي)
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState('');
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

  // حساب الإجماليات (تقريب مالي قبل التخزين/المقارنة لمنع أخطاء الفاصلة العائمة)
  const cartSubtotal = roundMoney(cart.reduce((sum, item) => sum + item.total, 0));
  const netTotal = roundMoney(Math.max(0, cartSubtotal - globalDiscount));
  const totalItemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const numericCashTendered = parseFloat(cashTendered) || 0;
  const changeDue = roundMoney(Math.max(0, numericCashTendered - netTotal));

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
    setGlobalDiscount(roundMoney(discountVal));
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
    setGlobalDiscount(roundMoney(diff));
  };

  // إضافة منتج للسلة بالاعتماد على مخزون الفرع الحالي
  const addToCart = (product: Product, quantityToAdd = 1, fromWeightModal = false) => {
    // منتجات الوزن/الكمية الحرة: تفتح نافذة إدخال الوزن أو المبلغ بدل الإضافة المباشرة
    if (product.isWeighted && !fromWeightModal) {
      setWeightModalProduct(product);
      return;
    }

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
  // تعديل سعر صنف واحد فقط داخل السلة (بدل الخصم العام على مجموع السلة)
  const updateItemPrice = (productId: string, newUnitPrice: number) => {
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.product.id === productId) {
          const unitPrice = Math.max(0, newUnitPrice);
          return { ...item, unitPrice, total: Math.max(0, (unitPrice - item.discount) * item.quantity) };
        }
        return item;
      })
    );
  };

  const startPriceEdit = (item: CartItem) => {
    setEditingPriceId(item.product.id);
    setEditingPriceVal(String(item.unitPrice));
  };

  const commitPriceEdit = (item: CartItem) => {
    const val = parseFloat(editingPriceVal);
    if (!isNaN(val) && val >= 0) {
      updateItemPrice(item.product.id, val);
    }
    setEditingPriceId(null);
  };

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
          total: roundMoney(item.total),
          profit: roundMoney(itemProfit),
        };
      });

      const totalProfit = roundMoney(saleItems.reduce((sum, item) => sum + item.profit, 0) - globalDiscount);

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
                    {editingPriceId === item.product.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          autoFocus
                          value={editingPriceVal}
                          onChange={(e) => setEditingPriceVal(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitPriceEdit(item);
                            if (e.key === 'Escape') setEditingPriceId(null);
                          }}
                          className="w-16 rounded-md border border-amber-400 bg-amber-50 dark:bg-amber-950/40 py-0.5 px-1 text-center font-mono text-[10px] font-bold text-slate-900 dark:text-white focus:outline-none"
                        />
                        <span className="text-[9px] text-slate-400">{settings.currency}</span>
                        <button
                          type="button"
                          onClick={() => commitPriceEdit(item)}
                          className="p-0.5 text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 cursor-pointer"
                          title="تأكيد السعر"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startPriceEdit(item)}
                        className="text-[10px] text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1 hover:text-amber-600 dark:hover:text-amber-400 transition cursor-pointer"
                        title="اضغط لتعديل سعر هذا الصنف (زيادة أو نقصان)"
                      >
                        <Pencil className="h-2.5 w-2.5 text-slate-400 shrink-0" />
                        <span>
                          {item.unitPrice.toFixed(2)} × {item.quantity} ={' '}
                          <b className={item.unitPrice !== item.product.salePrice ? 'text-amber-600 dark:text-amber-400 font-bold' : 'text-slate-800 dark:text-emerald-400 font-bold'}>
                            {item.total.toFixed(2)} {settings.currency}
                          </b>
                        </span>
                      </button>
                    )}
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
                  {p.isWeighted ? (
                    <div className="text-[9px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Scale className="h-3 w-3" />
                      <span>منتج بالوزن</span>
                    </div>
                  ) : (
                    <div className="text-[9px] font-medium text-slate-400 dark:text-slate-500 font-mono line-clamp-1">{p.barcode}</div>
                  )}
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
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 mr-0.5">
                      {settings.currency}{p.isWeighted ? `/${p.unit || 'كجم'}` : ''}
                    </span>
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
      <PosCheckoutModal
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        settings={settings}
        cart={cart}
        cartSubtotal={cartSubtotal}
        netTotal={netTotal}
        totalItemsCount={totalItemsCount}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        selectedCustomerId={selectedCustomerId}
        setSelectedCustomerId={setSelectedCustomerId}
        customerSearchQuery={customerSearchQuery}
        setCustomerSearchQuery={setCustomerSearchQuery}
        isInlineAddCustomer={isInlineAddCustomer}
        setIsInlineAddCustomer={setIsInlineAddCustomer}
        newCustomerName={newCustomerName}
        setNewCustomerName={setNewCustomerName}
        newCustomerPhone={newCustomerPhone}
        setNewCustomerPhone={setNewCustomerPhone}
        handleQuickAddCustomer={handleQuickAddCustomer}
        filteredCustomers={filteredCustomers}
        selectedCustomer={selectedCustomer}
        editingPriceId={editingPriceId}
        editingPriceVal={editingPriceVal}
        setEditingPriceVal={setEditingPriceVal}
        setEditingPriceId={setEditingPriceId}
        commitPriceEdit={commitPriceEdit}
        startPriceEdit={startPriceEdit}
        selectedDiscountPercent={selectedDiscountPercent}
        applyPercentDiscount={applyPercentDiscount}
        clearDiscount={clearDiscount}
        globalDiscount={globalDiscount}
        setGlobalDiscount={setGlobalDiscount}
        setSelectedDiscountPercent={setSelectedDiscountPercent}
        handleManualNetTotalChange={handleManualNetTotalChange}
        handleCheckout={handleCheckout}
      />

      {/* ================= نافذة السلات المعلقة (Parked Carts Modal) ================= */}
      <PosParkedCartsModal
        isOpen={isParkedCartsModalOpen}
        onClose={() => setIsParkedCartsModalOpen(false)}
        parkedCarts={parkedCarts}
        settings={settings}
        onRestore={handleRestoreParkedCart}
        onDelete={handleDeleteParkedCart}
      />


      {/* ماسح الباركود المستمر للبيع */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScan={handleScanBarcode}
        title="ماسح باركود البيع المستمر"
        autoCloseOnScan={false}
      />

      {/* مودال الفاتورة الحرارية */}
      {/* نافذة بيع المنتجات بالوزن/بكمية حرة (بدون باركود مطبوع) */}
      <WeightEntryModal
        isOpen={!!weightModalProduct}
        onClose={() => setWeightModalProduct(null)}
        product={weightModalProduct}
        activeBranchId={activeBranchId}
        onConfirm={(qty) => {
          if (weightModalProduct) addToCart(weightModalProduct, qty, true);
        }}
        showToast={showToast}
      />

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
