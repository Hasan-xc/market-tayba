import {
  Product,
  SaleTransaction,
  ReturnRecord,
  StoreSettings,
  ParkedCart,
  Customer,
  DebtTransaction,
  Supplier,
  StockAuditLog,
  UserAccount,
  UserRole,
  ReturnReason,
  CashDrawerShift,
  Branch,
  StockTransfer,
} from '../types';
import {
  hashPin,
  hashPassword,
  isHashedValue,
  isAlreadyHashed,
  verifySecret,
  hashEqualsKnown,
} from '../utils/crypto';
import {
  DbCore,
  DEFAULT_BRANCHES,
  DEFAULT_USERS,
  MIN_PASSWORD_LENGTH,
  DEFAULT_SETTINGS,
  SEED_PRODUCTS,
  STORAGE_KEYS,
  OfflineMutation,
  DBListener,
} from './db-core';

class DbInventoryService extends DbCore {
  isProductInBranch(product: Product, branchId?: string): boolean {
    if (!product) return false;
    const targetBranch = branchId || this.getActiveBranchId();
    if (!targetBranch || targetBranch === 'all') return true;

    // 1. إذا كان الصنف مسجلاً لهذا الفرع تحديداً
    let prodBranch = product.branchId;
    if (!prodBranch) {
      const cleanName = (product.name || '').trim();
      const cleanBarcode = (product.barcode || '').trim();
      if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
        prodBranch = 'branch-sharshi';
      } else {
        prodBranch = 'branch-main';
      }
    }
    if (prodBranch === targetBranch) {
      return true;
    }

    // 2. إذا كان الصنف مشتركاً بين الفروع
    if (product.branchId === 'all' || product.branchId === 'multi') {
      return true;
    }

    // 3. إذا كان الصنف لديه كمية موجبة فعلية أكبر من الصفر تم تحويلها أو إدخالها لهذا الفرع
    const bq = product.branchQuantities;
    if (bq && typeof bq === 'object' && typeof bq[targetBranch] === 'number' && bq[targetBranch] > 0) {
      return true;
    }

    // لا ينتمي لهذا الفرع إطلاقاً، وبالتالي لا يظهر فيه برصيد 0 ولا يسبب تنبيهاً كاذباً بنفاد المخزون
    return false;
  }

  // تنظيف وإصلاح استقلالية أرصدة الفروع (Branch Inventory Isolation Normalizer)
  getProducts(branchId?: string, user?: UserAccount | null): Product[] {
    const activeUser = user || this.currentAuthUser;
    // الكاشير مقيد فقط بمخزون فرعه المخصص دون سواه
    if (activeUser && activeUser.role !== 'admin') {
      const cashierBranch = activeUser.branchId || 'branch-main';
      return this.inMemoryProducts.filter((p) => this.isProductInBranch(p, cashierBranch));
    }

    const targetBranch = branchId !== undefined ? branchId : this.getActiveBranchId();
    if (targetBranch && targetBranch !== 'all') {
      return this.inMemoryProducts.filter((p) => this.isProductInBranch(p, targetBranch));
    }

    return this.inMemoryProducts;
  }

  // الحصول على كافة المنتجات الخام دون فلترة (للاستخدامات الداخلية والحفظ)
  getAllRawProducts(): Product[] {
    return this.inMemoryProducts;
  }

  getProductById(productId: string, branchId?: string, user?: UserAccount | null): Product | undefined {
    const activeUser = user || this.currentAuthUser;
    const targetBranch = activeUser && activeUser.role !== 'admin'
      ? (activeUser.branchId || 'branch-main')
      : branchId;

    const prod = this.inMemoryProducts.find((p) => p.id === productId);
    if (!prod) return undefined;
    if (targetBranch && targetBranch !== 'all' && !this.isProductInBranch(prod, targetBranch)) {
      return undefined;
    }
    return prod;
  }

  getProductByBarcode(barcode: string, branchId?: string, user?: UserAccount | null): Product | undefined {
    const clean = barcode.trim();
    const activeUser = user || this.currentAuthUser;
    const targetBranch = activeUser && activeUser.role !== 'admin'
      ? (activeUser.branchId || 'branch-main')
      : branchId;

    const prod = this.inMemoryProducts.find((p) => p.barcode === clean);
    if (!prod) return undefined;
    if (targetBranch && targetBranch !== 'all' && !this.isProductInBranch(prod, targetBranch)) {
      return undefined;
    }
    return prod;
  }

  setProducts(products: Product[]) {
    const seen = new Set<string>();
    const uniqueProducts: Product[] = [];
    // (Fix 1) الأصناف التي نسختها المحلية أحدث من نسخة السحابة — تُدفع للسحابة لاحقاً
    const fresherLocal: Product[] = [];
    for (const p of products) {
      if (!p) continue;
      const cleanBarcode = (p.barcode || '').trim();
      const cleanName = (p.name || '').trim();
      const key = cleanBarcode || (p.id || '').trim();
      if (key && !seen.has(key)) {
        seen.add(key);

        // الحفاظ على بيانات الفرع المسجلة محلياً في حال لم تكن واردة من السحابة
        const existing = this.inMemoryProducts.find(
          (ep) => (ep.id && ep.id === p.id) || (ep.barcode && ep.barcode.trim() === cleanBarcode)
        );

        // (Fix 1) حماية الطمس الرجعي: إذا كانت النسخة المحلية أحدث زمنياً فهي تفوز
        // — لا تُستبدل كمية مخزّن خُصمت ببيعٍ حقيقي بلقطة سحابية قديمة
        if (existing) {
          const localT = Date.parse(existing.updatedAt || '') || 0;
          const cloudT = Date.parse(p.updatedAt || '') || 0;
          if (localT && cloudT && localT > cloudT) {
            uniqueProducts.push(existing);
            fresherLocal.push(existing);
            continue;
          }
        }

        let resolvedBranchId = p.branchId || existing?.branchId;
        if (!resolvedBranchId) {
          if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
            resolvedBranchId = 'branch-sharshi';
          } else {
            resolvedBranchId = 'branch-main';
          }
        }

        const branchObj = this.inMemoryBranches.find((b) => b.id === resolvedBranchId);
        const resolvedBranchName = 
          p.branchName || 
          existing?.branchName || 
          branchObj?.name || 
          (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

        const totalQty = p.quantity !== undefined ? p.quantity : (existing?.quantity || 0);
        let resolvedBq: Record<string, number> = {};

        if (p.branchQuantities && typeof p.branchQuantities === 'object' && Object.keys(p.branchQuantities).length > 0) {
          resolvedBq = { ...p.branchQuantities };
        } else if (existing?.branchQuantities && Object.keys(existing.branchQuantities).length > 0) {
          resolvedBq = { ...existing.branchQuantities };
        } else {
          resolvedBq = { [resolvedBranchId]: totalQty };
        }

        // (Fix) مصدر حقيقة واحد: موازنة الأرصدة مع كمية الصف عند التعارض (ترميز عتيق)
        {
          const bqSum = Object.values(resolvedBq).reduce((s, q) => s + (Number(q) || 0), 0);
          if (Math.abs(bqSum - totalQty) > 0.001) {
            const rebalanced: Record<string, number> = {};
            let othersSum = 0;
            for (const [bId, q] of Object.entries(resolvedBq)) {
              if (bId !== resolvedBranchId && Number(q) > 0) { rebalanced[bId] = Number(q); othersSum += Number(q); }
            }
            rebalanced[resolvedBranchId] = Math.max(0, totalQty - othersSum);
            resolvedBq = rebalanced;
          }
        }

        uniqueProducts.push({
          ...p,
          barcode: cleanBarcode,
          name: cleanName,
          quantity: totalQty,
          branchId: resolvedBranchId,
          branchName: resolvedBranchName,
          branchQuantities: resolvedBq,
          assignedBranchIds: [resolvedBranchId],
        });
      }
    }
    // (Fix 1) الأصناف المحلية الغائبة عن لقطة السحابة (لم تُزامن بعد) تبقى حية —
    // setProducts دمج بالمعرف وليس استبدالاً عمياءً للقائمة
    for (const lp of this.inMemoryProducts) {
      const lkey = (lp.barcode || '').trim() || (lp.id || '').trim();
      if (lkey && !seen.has(lkey)) {
        uniqueProducts.push(lp);
        fresherLocal.push(lp);
      }
    }

    this.inMemoryProducts = uniqueProducts;
    this.normalizeBranchInventories();
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();

    // (Fix 1) ادفع النسخ المحلية الأحدث للسحابة حتى لا تبقى قديمة هناك
    if (fresherLocal.length) {
      const targets = [...fresherLocal];
      this.triggerCloudSync(async (supabase) => {
        for (const p of targets) {
          await supabase.syncProduct(p);
        }
      });
    }
  }

  applyCloudUpsertProduct(product: Product) {
    if (!product || !product.name?.trim() || !product.barcode?.trim()) return;
    const cleanBarcode = product.barcode.trim();
    const cleanName = product.name.trim();
    const idx = this.inMemoryProducts.findIndex((p) => p.id === product.id || p.barcode === cleanBarcode);

    if (idx !== -1) {
      const existing = this.inMemoryProducts[idx];

      // (Fix 1) صدى سحابي بلقطة أقدم من سجلاتنا المحلية؟ نرفض الطمس وندفع نسختنا
      const localT = Date.parse(existing.updatedAt || '') || 0;
      const cloudT = Date.parse(product.updatedAt || '') || 0;
      if (localT && cloudT && localT > cloudT) {
        const localFresher = existing;
        this.triggerCloudSync(async (supabase) => {
          await supabase.syncProduct(localFresher);
        });
        return;
      }

      let mergedBranchId = product.branchId || existing.branchId;
      if (!mergedBranchId) {
        mergedBranchId = (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') ? 'branch-sharshi' : 'branch-main';
      }
      const branchObj = this.inMemoryBranches.find((b) => b.id === mergedBranchId);
      const mergedBranchName = 
        product.branchName || 
        existing.branchName || 
        branchObj?.name || 
        (mergedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

      const totalQty = product.quantity !== undefined ? product.quantity : existing.quantity;
      let mergedBranchQuantities = 
        (product.branchQuantities && Object.keys(product.branchQuantities).length > 0) 
          ? product.branchQuantities 
          : (existing.branchQuantities || { [mergedBranchId]: totalQty });

      // (Fix) مصدر حقيقة واحد: إن اختلفت الأرصدة المدمجة (بما فيها الترميز العتيق
      // داخل image_url) عن كمية الصف السحابية — الكمية هي المرجع، ويُعاد موازنة
      // الفرع الأساسي مع صون أرصدة الفروع الأخرى الموجبة
      const bqSum = Object.values(mergedBranchQuantities).reduce((s, q) => s + (Number(q) || 0), 0);
      if (Math.abs(bqSum - totalQty) > 0.001) {
        const rebalanced: Record<string, number> = {};
        let othersSum = 0;
        for (const [bId, q] of Object.entries(mergedBranchQuantities)) {
          if (bId !== mergedBranchId && Number(q) > 0) { rebalanced[bId] = Number(q); othersSum += Number(q); }
        }
        rebalanced[mergedBranchId] = Math.max(0, totalQty - othersSum);
        mergedBranchQuantities = rebalanced;
      }

      this.inMemoryProducts[idx] = {
        ...existing,
        ...product,
        barcode: cleanBarcode,
        name: cleanName,
        quantity: totalQty,
        branchId: mergedBranchId,
        branchName: mergedBranchName,
        branchQuantities: mergedBranchQuantities,
        assignedBranchIds: [mergedBranchId],
      };
    } else {
      let resolvedBranchId = product.branchId;
      if (!resolvedBranchId) {
        resolvedBranchId = (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') ? 'branch-sharshi' : 'branch-main';
      }
      const branchObj = this.inMemoryBranches.find((b) => b.id === resolvedBranchId);
      const resolvedBranchName = 
        product.branchName || 
        branchObj?.name || 
        (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

      const totalQty = product.quantity || 0;
      const resolvedBq = 
        (product.branchQuantities && Object.keys(product.branchQuantities).length > 0)
          ? product.branchQuantities
          : { [resolvedBranchId]: totalQty };

      this.inMemoryProducts.unshift({
        ...product,
        barcode: cleanBarcode,
        name: cleanName,
        quantity: totalQty,
        branchId: resolvedBranchId,
        branchName: resolvedBranchName,
        branchQuantities: resolvedBq,
        assignedBranchIds: [resolvedBranchId],
      });
    }
    this.normalizeBranchInventories();
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
    this.notify();
  }

  applyCloudDeleteProduct(productId: string, barcode?: string) {
    const prevLen = this.inMemoryProducts.length;
    this.inMemoryProducts = this.inMemoryProducts.filter((p) => {
      if (productId && p.id === productId) return false;
      if (barcode && p.barcode === barcode.trim()) return false;
      return true;
    });
    if (this.inMemoryProducts.length !== prevLen) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
      this.notify();
    }
  }

  saveProduct(product: Partial<Product> & { barcode: string; name: string }): Product {
    const now = new Date().toISOString();
    const cleanBarcode = (product.barcode || '').trim();
    const cleanName = (product.name || '').trim();

    if (!cleanBarcode || !cleanName) {
      throw new Error('الباركود واسم الصنف مطلوبان');
    }

    // البحث عن الصنف لتحديد ما إذا كان جديداً أو موجوداً سابقاً لتسجيل تدقيق المخزون بدقة
    const existingIndex = product.id 
      ? this.inMemoryProducts.findIndex((p) => p.id === product.id)
      : this.inMemoryProducts.findIndex((p) => p.barcode === cleanBarcode);

    const isNew = existingIndex === -1;
    const previousProd = !isNew ? this.inMemoryProducts[existingIndex] : null;
    const previousQty = previousProd ? previousProd.quantity : 0;
    const previousPurchase = previousProd ? previousProd.purchasePrice : 0;
    const previousSale = previousProd ? previousProd.salePrice : 0;

    // إدارة رصيد الفروع المستقل (Multi-Branch Isolated Stock)
    const activeBranchId = this.getActiveBranchId();
    const existingBranchId = existingIndex !== -1 ? this.inMemoryProducts[existingIndex].branchId : undefined;
    const finalBranchId = product.branchId || existingBranchId || (activeBranchId !== 'all' ? activeBranchId : 'branch-main');
    const branchObj = this.inMemoryBranches.find((b) => b.id === finalBranchId);
    const branchName = branchObj ? branchObj.name : (finalBranchId === 'all' ? 'جميع الفروع' : (finalBranchId === 'branch-main' ? 'الفرع الرئيسي' : finalBranchId));

    let bq: Record<string, number> = {};

    if (product.branchQuantities && typeof product.branchQuantities === 'object' && Object.keys(product.branchQuantities).length > 0) {
      bq = { ...product.branchQuantities };
    } else if (existingIndex !== -1) {
      bq = this.ensureBranchQuantities(this.inMemoryProducts[existingIndex]);
      if (product.quantity !== undefined) {
        const targetBranchKey = finalBranchId === 'all' ? (this.inMemoryProducts[existingIndex].branchId || 'branch-main') : finalBranchId;
        bq[targetBranchKey] = Math.max(0, Number(product.quantity) || 0);
      }
    } else {
      const targetBranchKey = finalBranchId === 'all' ? 'branch-main' : finalBranchId;
      bq = {
        [targetBranchKey]: Math.max(0, Number(product.quantity) || 0),
      };
    }

    // تنظيف أرصدة الفروع حتى لا يظهر رصيد 0 لفروع أخرى لا ينتمي إليها الصنف إطلاقاً
    if (finalBranchId !== 'all' && finalBranchId !== 'multi') {
      const cleanBq: Record<string, number> = {
        [finalBranchId]: Math.max(0, Number(bq[finalBranchId] ?? product.quantity ?? 0)),
      };
      // نحتفظ فقط بالفروع الأخرى إذا كان لها رصيد فعلي موجب سابقاً (كتحويل مخزني مثلاً)
      Object.entries(bq).forEach(([bKey, val]) => {
        if (bKey !== finalBranchId && typeof val === 'number' && val > 0) {
          cleanBq[bKey] = val;
        }
      });
      bq = cleanBq;
    }

    const calculatedTotalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    const finalAssignedBranchIds = finalBranchId === 'all' 
      ? (product.assignedBranchIds || this.inMemoryBranches.map((b) => b.id))
      : [finalBranchId];

    let savedProduct: Product;
    if (product.id) {
      if (existingIndex !== -1) {
        savedProduct = {
          ...this.inMemoryProducts[existingIndex],
          ...product,
          barcode: cleanBarcode,
          name: cleanName,
          category: (product.category || this.inMemoryProducts[existingIndex].category || 'عام').trim(),
          purchasePrice: Number(product.purchasePrice ?? this.inMemoryProducts[existingIndex].purchasePrice) || 0,
          salePrice: Number(product.salePrice ?? this.inMemoryProducts[existingIndex].salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert ?? this.inMemoryProducts[existingIndex].minQuantityAlert) || 5,
          unit: product.unit || this.inMemoryProducts[existingIndex].unit || 'حبة',
          updatedAt: now,
        };
        this.inMemoryProducts[existingIndex] = savedProduct;
      } else {
        savedProduct = {
          id: product.id,
          barcode: cleanBarcode,
          name: cleanName,
          category: product.category?.trim() || 'عام',
          purchasePrice: Number(product.purchasePrice) || 0,
          salePrice: Number(product.salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert) || 5,
          unit: product.unit || 'حبة',
          imageUrl: product.imageUrl,
          createdAt: now,
          updatedAt: now,
        };
        this.inMemoryProducts.unshift(savedProduct);
      }
    } else {
      if (existingIndex !== -1) {
        savedProduct = {
          ...this.inMemoryProducts[existingIndex],
          ...product,
          barcode: cleanBarcode,
          name: cleanName,
          category: (product.category || this.inMemoryProducts[existingIndex].category || 'عام').trim(),
          purchasePrice: Number(product.purchasePrice ?? this.inMemoryProducts[existingIndex].purchasePrice) || 0,
          salePrice: Number(product.salePrice ?? this.inMemoryProducts[existingIndex].salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert ?? this.inMemoryProducts[existingIndex].minQuantityAlert) || 5,
          unit: product.unit || this.inMemoryProducts[existingIndex].unit || 'حبة',
          updatedAt: now,
        };
        this.inMemoryProducts[existingIndex] = savedProduct;
      } else {
        savedProduct = {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
          barcode: cleanBarcode,
          name: cleanName,
          category: product.category?.trim() || 'عام',
          purchasePrice: Number(product.purchasePrice) || 0,
          salePrice: Number(product.salePrice) || 0,
          branchId: finalBranchId,
          branchName,
          assignedBranchIds: finalAssignedBranchIds,
          branchQuantities: bq,
          quantity: calculatedTotalQty,
          minQuantityAlert: Number(product.minQuantityAlert) || 5,
          unit: product.unit || 'حبة',
          imageUrl: product.imageUrl,
          createdAt: now,
          updatedAt: now,
        };
        this.inMemoryProducts.unshift(savedProduct);
      }
    }

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    // تسجيل حركة المخزون في سجل التدقيق (Stock Audit Trail)
    const newQty = savedProduct.quantity;
    const qtyDelta = newQty - previousQty;
    const currentActor = this.inMemorySettings.activeCashier || 'المشرف';

    if (isNew) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: 'product_created',
        quantityDelta: newQty,
        previousQuantity: 0,
        newQuantity: newQty,
        reason: `إضافة منتج جديد إلى المخزون (سعر البيع: ${savedProduct.salePrice} ${this.inMemorySettings.currency})`,
        performedBy: currentActor,
      });
    } else if (qtyDelta !== 0) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: qtyDelta > 0 ? 'purchase' : 'manual_adjustment',
        quantityDelta: qtyDelta,
        previousQuantity: previousQty,
        newQuantity: newQty,
        reason: qtyDelta > 0 
          ? `زيادة كمية المخزون من ${previousQty} إلى ${newQty} (توريد / تعديل)`
          : `إنقاص كمية المخزون من ${previousQty} إلى ${newQty} (تعديل جردي)`,
        performedBy: currentActor,
      });
    } else if (previousSale !== savedProduct.salePrice || previousPurchase !== savedProduct.purchasePrice) {
      this.addStockAuditLog({
        productId: savedProduct.id,
        barcode: savedProduct.barcode,
        productName: savedProduct.name,
        type: 'price_update',
        quantityDelta: 0,
        previousQuantity: previousQty,
        newQuantity: newQty,
        reason: `تحديث أسعار الصنف (شراء: ${savedProduct.purchasePrice}، بيع: ${savedProduct.salePrice})`,
        performedBy: currentActor,
      });
    }

    this.notify();

    // مزامنة فورية في الخلفية مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(savedProduct);
        await supabase.broadcastEvent('PRODUCT_UPSERT', savedProduct);
      },
      { type: 'PRODUCT_UPSERT', data: savedProduct }
    );

    return savedProduct;
  }

  deleteProduct(id: string, barcode?: string): boolean {
    const cleanBarcode = barcode?.trim();
    const targetProduct = this.inMemoryProducts.find((p) => (id && p.id === id) || (cleanBarcode && p.barcode === cleanBarcode));
    const targetId = id || targetProduct?.id || '';
    const targetBarcode = cleanBarcode || targetProduct?.barcode || '';

    // تسجيل حركة الحذف في سجل تدقيق المخزون قبل الحذف
    if (targetProduct) {
      this.addStockAuditLog({
        productId: targetProduct.id,
        barcode: targetProduct.barcode,
        productName: targetProduct.name,
        type: 'product_deleted',
        quantityDelta: -targetProduct.quantity,
        previousQuantity: targetProduct.quantity,
        newQuantity: 0,
        reason: `حذف الصنف نهائياً من قاعدة بيانات المخزون`,
        performedBy: this.inMemorySettings.activeCashier || 'المشرف',
      });
    }

    const prevLen = this.inMemoryProducts.length;
    this.inMemoryProducts = this.inMemoryProducts.filter((p) => {
      if (targetId && p.id === targetId) return false;
      if (targetBarcode && p.barcode === targetBarcode) return false;
      return true;
    });
    const changed = this.inMemoryProducts.length !== prevLen;

    if (changed || targetId || targetBarcode) {
      this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);
      this.notify();
      this.triggerCloudSync(
        async (supabase) => {
          await supabase.deleteProduct(targetId, targetBarcode);
          await supabase.broadcastEvent('PRODUCT_DELETE', { id: targetId, barcode: targetBarcode });
        },
        { type: 'PRODUCT_DELETE', data: { id: targetId, barcode: targetBarcode } }
      );
    }
    return changed;
  }

  ensureBranchQuantities(product: Product): Record<string, number> {
    if (product.branchQuantities && typeof product.branchQuantities === 'object' && Object.keys(product.branchQuantities).length > 0) {
      return { ...product.branchQuantities };
    }
    const defaultBranchId = product.branchId || 'branch-main';
    return {
      [defaultBranchId]: Math.max(0, Number(product.quantity) || 0),
    };
  }

  getProductStock(product: Product, branchId?: string): number {
    if (!product) return 0;
    const targetBranch = branchId || this.getActiveBranchId();
    const bq = this.ensureBranchQuantities(product);

    if (targetBranch === 'all') {
      return Object.values(bq).reduce((sum, q) => sum + (Number(q) || 0), 0);
    }

    return Number(bq[targetBranch] ?? 0);
  }

  setProductBranchStock(
    productId: string,
    branchId: string,
    newQuantity: number,
    reason?: string,
    performedBy?: string
  ): Product | null {
    const index = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (index === -1) return null;

    const prod = this.inMemoryProducts[index];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = bq[branchId] ?? 0;
    const cleanQty = Math.max(0, Number(newQuantity) || 0);
    const delta = cleanQty - prevBranchQty;

    bq[branchId] = cleanQty;
    prod.branchQuantities = bq;
    const totalQty = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.quantity = totalQty;
    prod.updatedAt = new Date().toISOString();

    const branch = this.inMemoryBranches.find((b) => b.id === branchId);
    const branchName = branch ? branch.name : (branchId === 'branch-main' ? 'الفرع الرئيسي' : branchId);

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    if (delta !== 0) {
      this.addStockAuditLog({
        productId: prod.id,
        barcode: prod.barcode,
        productName: prod.name,
        type: delta > 0 ? 'purchase' : 'manual_adjustment',
        quantityDelta: delta,
        previousQuantity: prevBranchQty,
        newQuantity: cleanQty,
        reason: reason || `تعديل جرد فرع (${branchName}): من ${prevBranchQty} إلى ${cleanQty}`,
        performedBy: performedBy || this.inMemorySettings.activeCashier,
      });
    }

    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    return prod;
  }

  updateBranchStock(
    productId: string,
    branchId: string,
    quantityChange: number,
    reason?: string,
    performedBy?: string,
    logType?: StockAuditLog['type']
  ): Product | null {
    const index = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (index === -1) return null;

    const prod = this.inMemoryProducts[index];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = bq[branchId] ?? 0;
    const newBranchQty = Math.max(0, prevBranchQty + quantityChange);

    return this.setProductBranchStock(
      productId,
      branchId,
      newBranchQty,
      reason || (quantityChange > 0 ? 'توريد بضاعة للفرع' : 'تسوية عجز/تعديل فرع'),
      performedBy
    );
  }

  updateStock(
    productId: string, 
    quantityChange: number, 
    reason?: string, 
    performedBy?: string, 
    logType?: StockAuditLog['type'],
    branchId?: string
  ): Product | null {
    const targetBranch = branchId || (this.getActiveBranchId() === 'all' ? 'branch-main' : this.getActiveBranchId());
    return this.updateBranchStock(
      productId,
      targetBranch,
      quantityChange,
      reason,
      performedBy,
      logType
    );
  }

  // ==== إتلاف المخزون / الإرجاع للمصنع (Damage & Vendor Return) ====
  recordDamageOrVendorReturn(params: {
    productId: string;
    type: 'damage' | 'vendor_return';
    quantity: number;
    branchId?: string;
    damageReason?: string; // تالف / كسر / منتهي الصلاحية
    notes?: string;
    supplierId?: string;
    performedBy?: string;
  }): { success: boolean; message: string; log?: StockAuditLog } {
    const { productId, type, damageReason, notes, supplierId } = params;

    const prodIndex = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (prodIndex === -1) {
      return { success: false, message: 'الصنف غير موجود في النظام' };
    }

    const qty = Number(params.quantity);
    if (isNaN(qty) || qty <= 0) {
      return { success: false, message: 'يرجى إدخال كمية صالحة أكبر من الصفر' };
    }

    const targetBranchId = params.branchId || this.getActiveBranchId();
    if (!targetBranchId || targetBranchId === 'all') {
      return { success: false, message: 'يرجى تحديد الفرع الذي سيُخصم منه الرصيد' };
    }

    const prod = this.inMemoryProducts[prodIndex];
    const bq = this.ensureBranchQuantities(prod);
    const prevBranchQty = Number(bq[targetBranchId] ?? 0);
    if (qty > prevBranchQty) {
      return {
        success: false,
        message: `الكمية المطلوبة (${qty}) تتجاوز رصيد الفرع الحالي (${prevBranchQty})`,
      };
    }

    const newBranchQty = Math.max(0, prevBranchQty - qty);
    bq[targetBranchId] = newBranchQty;
    prod.branchQuantities = bq;
    prod.quantity = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.updatedAt = new Date().toISOString();

    const branch = this.inMemoryBranches.find((b) => b.id === targetBranchId);
    const branchName = branch ? branch.name : targetBranchId;
    const actor = params.performedBy || this.inMemorySettings.activeCashier || 'مدير النظام';

    let reason: string;
    if (type === 'vendor_return') {
      const supplier = supplierId ? this.getSupplierById(supplierId) : undefined;
      reason = `إرجاع للمصنع/المورد: ${supplier ? supplier.name : 'غير محدد'} — من فرع ${branchName}`;
    } else {
      reason = `إتلاف/تالف (${damageReason || 'تالف'}) — من فرع ${branchName}`;
    }
    if (notes && notes.trim()) {
      reason += ` — ${notes.trim()}`;
    }

    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    const log = this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type,
      quantityDelta: -qty,
      previousQuantity: prevBranchQty,
      newQuantity: newBranchQty,
      reason,
      performedBy: actor,
    });

    this.notify();

    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    // إرجاع للمورد: المستحق للمتجر لدى المورد = الكمية المرجعة × سعر شراء الصنف.
    // saveSupplier تستبدل الكائن كاملاً وليست تراكمية، لذلك نقرأ الرصيد الحالي ونضيف الفرق قبل الحفظ.
    if (type === 'vendor_return' && supplierId) {
      const supplier = this.getSupplierById(supplierId);
      if (supplier) {
        const creditAmount = qty * (Number(prod.purchasePrice) || 0);
        this.saveSupplier({
          ...supplier,
          balance: (Number(supplier.balance) || 0) + creditAmount,
        });
      }
    }

    return {
      success: true,
      message:
        type === 'vendor_return'
          ? 'تم إرجاع الكمية للمورد وتحديث المستحقات بنجاح'
          : 'تم تسجيل عملية الإتلاف وخصم الرصيد بنجاح',
      log,
    };
  }

  // ==== التحويلات المخزنية بين الفروع (Inter-Branch Stock Transfers) ====
  getStockTransfers(): StockTransfer[] {
    return this.inMemoryTransfers;
  }

  transferStock(params: {
    sourceBranchId: string;
    targetBranchId: string;
    productId: string;
    quantity: number;
    notes?: string;
    performedBy?: string;
  }): { success: boolean; transfer?: StockTransfer; error?: string } {
    const { sourceBranchId, targetBranchId, productId, quantity, notes, performedBy } = params;

    if (!sourceBranchId || !targetBranchId) {
      return { success: false, error: 'يرجى تحديد فرع المصدر وفرع الوجهة' };
    }
    if (sourceBranchId === targetBranchId) {
      return { success: false, error: 'لا يمكن التحويل لنفس الفرع، يرجى اختيار فرعين مختلفين' };
    }
    const cleanQty = Number(quantity);
    if (isNaN(cleanQty) || cleanQty <= 0) {
      return { success: false, error: 'يرجى إدخال كمية تحويل صالحة أكبر من الصفر' };
    }

    const prodIndex = this.inMemoryProducts.findIndex((p) => p.id === productId);
    if (prodIndex === -1) {
      return { success: false, error: 'الصنف المطلوب تحويله غير موجود في النظام' };
    }

    const prod = this.inMemoryProducts[prodIndex];
    const bq = this.ensureBranchQuantities(prod);
    const sourceCurrentStock = bq[sourceBranchId] ?? 0;

    if (sourceCurrentStock < cleanQty) {
      return {
        success: false,
        error: `الرصيد في فرع المصدر لا يكفي! المتوفر: ${sourceCurrentStock} ${prod.unit || 'حبة'} فقط، بينما الكمية المطلوبة للتحويل: ${cleanQty}`,
      };
    }

    const sourceBranch = this.inMemoryBranches.find((b) => b.id === sourceBranchId);
    const targetBranch = this.inMemoryBranches.find((b) => b.id === targetBranchId);
    const sourceName = sourceBranch?.name || 'فرع المصدر';
    const targetName = targetBranch?.name || 'فرع الاستلام';
    const actor = performedBy || this.inMemorySettings.activeCashier || 'مدير النظام';

    // إنقاص المخزون من فرع المصدر
    const prevSource = sourceCurrentStock;
    const newSource = prevSource - cleanQty;
    bq[sourceBranchId] = newSource;

    // زيادة المخزون في فرع الاستلام
    const prevTarget = bq[targetBranchId] ?? 0;
    const newTarget = prevTarget + cleanQty;
    bq[targetBranchId] = newTarget;

    prod.branchQuantities = bq;
    if (!prod.assignedBranchIds) {
      prod.assignedBranchIds = [prod.branchId || 'branch-main'];
    }
    if (!prod.assignedBranchIds.includes(targetBranchId)) {
      prod.assignedBranchIds.push(targetBranchId);
    }
    prod.quantity = Object.values(bq).reduce((s, q) => s + (Number(q) || 0), 0);
    prod.updatedAt = new Date().toISOString();

    const now = new Date().toISOString();
    const count = this.inMemoryTransfers.length + 1001;
    const transferNumber = `TRF-${count}`;

    const newTransfer: StockTransfer = {
      id: 'trf-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      transferNumber,
      sourceBranchId,
      sourceBranchName: sourceName,
      targetBranchId,
      targetBranchName: targetName,
      items: [
        {
          productId: prod.id,
          barcode: prod.barcode,
          productName: prod.name,
          quantity: cleanQty,
        },
      ],
      totalQuantity: cleanQty,
      status: 'completed',
      notes: notes?.trim() || undefined,
      transferredBy: actor,
      createdAt: now,
      isSynced: false,
    };

    this.inMemoryTransfers.unshift(newTransfer);
    this.persist(STORAGE_KEYS.TRANSFERS, this.inMemoryTransfers);
    this.persist(STORAGE_KEYS.PRODUCTS, this.inMemoryProducts);

    // تسجيل حركتي تدقيق للمخزون (حركة خروج وحركة دخول)
    this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type: 'transfer_out',
      quantityDelta: -cleanQty,
      previousQuantity: prevSource,
      newQuantity: newSource,
      reason: `تحويل مخزني صادر إلى (${targetName}) - سند #${transferNumber}`,
      performedBy: actor,
    });

    this.addStockAuditLog({
      productId: prod.id,
      barcode: prod.barcode,
      productName: prod.name,
      type: 'transfer_in',
      quantityDelta: cleanQty,
      previousQuantity: prevTarget,
      newQuantity: newTarget,
      reason: `استلام تحويل مخزني وارد من (${sourceName}) - سند #${transferNumber}`,
      performedBy: actor,
    });

    this.notify();

    // مزامنة فورية مع السحابة
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncProduct(prod);
        await supabase.broadcastEvent('PRODUCT_UPSERT', prod);
      },
      { type: 'PRODUCT_UPSERT', data: prod }
    );

    return { success: true, transfer: newTransfer };
  }

  // ==== إدارة العملاء والديون Customers & Debts ====
  mergeCloudStockAuditLogs(cloudLogs: StockAuditLog[]) {
    const cloudMap = new Map(cloudLogs.map((l) => [l.id, l]));
    const localById = new Map(this.inMemoryStockAuditLogs.map((l) => [l.id, l]));
    const merged: StockAuditLog[] = [];

    for (const cl of cloudLogs) {
      const local = localById.get(cl.id);
      if (local && !local.id) {
        merged.push(local);
      } else {
        merged.push({
          ...cl,
          reason: cl.reason || local?.reason,
          performedBy: cl.performedBy || local?.performedBy || 'النظام',
        });
      }
    }
    for (const ll of this.inMemoryStockAuditLogs) {
      if (!cloudMap.has(ll.id)) merged.push(ll);
    }

    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    if (merged.length > 2000) merged.length = 2000;
    this.inMemoryStockAuditLogs = merged;
    this.persist(STORAGE_KEYS.STOCK_AUDIT, this.inMemoryStockAuditLogs);
    this.notify();
  }

  getStockAuditLogs(productId?: string): StockAuditLog[] {
    if (productId) {
      return this.inMemoryStockAuditLogs.filter((log) => log.productId === productId);
    }
    return this.inMemoryStockAuditLogs;
  }

  addStockAuditLog(log: Omit<StockAuditLog, 'id' | 'createdAt'>): StockAuditLog {
    const newLog: StockAuditLog = {
      ...log,
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      createdAt: new Date().toISOString(),
    };
    this.inMemoryStockAuditLogs.unshift(newLog);
    // Keep max 2000 log records locally
    if (this.inMemoryStockAuditLogs.length > 2000) {
      this.inMemoryStockAuditLogs = this.inMemoryStockAuditLogs.slice(0, 2000);
    }
    this.persist(STORAGE_KEYS.STOCK_AUDIT, this.inMemoryStockAuditLogs);
    this.notify();

    // مزامنة فورية في الخلفية مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncStockAuditLog?.(newLog);
        await supabase.broadcastEvent('STOCK_AUDIT_CREATE', newLog);
      },
      { type: 'STOCK_AUDIT_CREATE', data: newLog }
    );

    return newLog;
  }

  // ==== إدارة الموردين (Suppliers) ====
  getSuppliers(): Supplier[] {
    return this.inMemorySuppliers;
  }

  getSupplierById(id: string): Supplier | undefined {
    return this.inMemorySuppliers.find((s) => s.id === id);
  }

  saveSupplier(supplier: { id?: string; name: string; company?: string; phone?: string; address?: string; balance?: number; notes?: string }): Supplier {
    const cleanName = (supplier.name || '').trim();
    if (!cleanName) throw new Error('اسم المورد مطلوب');

    const now = new Date().toISOString();
    let saved: Supplier;

    if (supplier.id) {
      const idx = this.inMemorySuppliers.findIndex((s) => s.id === supplier.id);
      if (idx !== -1) {
        saved = {
          ...this.inMemorySuppliers[idx],
          name: cleanName,
          company: supplier.company?.trim(),
          phone: supplier.phone?.trim(),
          address: supplier.address?.trim(),
          balance: Number(supplier.balance ?? this.inMemorySuppliers[idx].balance) || 0,
          notes: supplier.notes?.trim(),
        };
        this.inMemorySuppliers[idx] = saved;
      } else {
        saved = {
          id: supplier.id,
          name: cleanName,
          company: supplier.company?.trim(),
          phone: supplier.phone?.trim(),
          address: supplier.address?.trim(),
          balance: Number(supplier.balance) || 0,
          notes: supplier.notes?.trim(),
          createdAt: now,
        };
        this.inMemorySuppliers.unshift(saved);
      }
    } else {
      saved = {
        id: 'sup-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
        name: cleanName,
        company: supplier.company?.trim(),
        phone: supplier.phone?.trim(),
        address: supplier.address?.trim(),
        balance: Number(supplier.balance) || 0,
        notes: supplier.notes?.trim(),
        createdAt: now,
      };
      this.inMemorySuppliers.unshift(saved);
    }

    this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
    this.notify();

    // مزامنة المورد (بما فيها تحديث الرصيد بعد الإرجاع للمورد) مع Supabase وبث الحدث
    this.triggerCloudSync(
      async (supabase) => {
        await supabase.syncSupplier(saved);
        await supabase.broadcastEvent('SUPPLIER_UPSERT', saved);
      },
      { type: 'SUPPLIER_UPSERT', data: saved }
    );

    return saved;
  }

  deleteSupplier(id: string): boolean {
    const prevLen = this.inMemorySuppliers.length;
    this.inMemorySuppliers = this.inMemorySuppliers.filter((s) => s.id !== id);
    const changed = this.inMemorySuppliers.length !== prevLen;
    if (changed) {
      this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
      this.notify();
    }
    return changed;
  }

  // استبدال كامل لقائمة الموردين (يُستخدم عند السحب من السحابة بعد تصفير الكاش)
  setSuppliers(suppliers: Supplier[]) {
    this.inMemorySuppliers = suppliers;
    this.persist(STORAGE_KEYS.SUPPLIERS, this.inMemorySuppliers);
    this.notify();
  }

  // استبدال سندات التحويل (يُستخدم عند السحب من السحابة بعد تصفير الكاش)
  setTransfers(transfers: StockTransfer[]) {
    this.inMemoryTransfers = transfers;
    this.persist(STORAGE_KEYS.TRANSFERS, this.inMemoryTransfers);
    this.notify();
  }

  /**
   * تصفير الكاش المحلي للكيانات المتزامنة مع Supabase (زر إداري يدوي — إعادة مزامنة كاملة).
   * يُمسح: PRODUCTS, CUSTOMERS, SUPPLIERS, STOCK_AUDIT, TRANSFERS
   * يبقى: SALES, RETURNS, DEBT_TRANSACTIONS, SHIFTS, PARKED_CARTS, SETTINGS, BRANCHES, USERS
   * لا يُحذف أي شيء من Supabase نفسه — محلي فقط، ثم يعاد السحب فوراً.
   */
}

export { DbInventoryService };
