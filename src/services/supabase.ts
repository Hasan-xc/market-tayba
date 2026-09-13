import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { Product, SaleTransaction, ReturnRecord, StoreSettings, Customer, DebtTransaction, StockAuditLog } from '../types';
import { dbService, SEED_PRODUCTS, DEFAULT_SETTINGS } from './db';

export const DEFAULT_SUPABASE_URL = 'https://qvfunbtrgdhtqlmjwdzc.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF2ZnVuYnRyZ2RodHFsbWp3ZHpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgwODczMzIsImV4cCI6MjEwMzY2MzMzMn0.JaP9qfJDQe2pRV3Qa-uN01khLU6Tj1FMb8ktaXghUc4';

const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || '';
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

let cachedClient: SupabaseClient | null = null;
let realtimeChannel: RealtimeChannel | null = null;
let isRealtimeStarted = false;
let realtimeStatus: 'connected' | 'connecting' | 'disconnected' = 'disconnected';

let lastAttachedSessionFingerprint = '';

// مفتاح جلسة Auth المخزّنة من عميل S3 (نفس صيغة supabase-js: sb-<ref>-auth-token)
function storedAuthTokenKeyFor(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    return `sb-${host.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/** ربط جلسة S3 المخزّنة بعميل المزامنة حتى تحمل المكالمات auth.uid() لمصفوفة RLS (S4) */
async function attachStoredAuthSession(client: SupabaseClient, url: string): Promise<void> {
  try {
    if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
    const key = storedAuthTokenKeyFor(url);
    if (!key) return;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const accessToken = parsed?.access_token;
    const refreshToken = parsed?.refresh_token;
    if (!accessToken || !refreshToken) return;
    const fingerprint = `${accessToken}:${refreshToken}`;
    if (lastAttachedSessionFingerprint === fingerprint) return;
    lastAttachedSessionFingerprint = fingerprint; // لا إعادة محاولة لنفس التوكن (أو الفاشل)
    const { error } = await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) {
      console.warn('[supabase] session attach ignored:', error.message);
    }
  } catch (e) {
    console.warn('[supabase] session attach ignored (fallback anon):', (e as any)?.message || e);
  }
}

const realtimeStatusListeners = new Set<(status: 'connected' | 'connecting' | 'disconnected') => void>();
const realtimeUpdateListeners = new Set<(event: { table: string; eventType: string; data?: any }) => void>();

/**
 * ترميز معرف واسم وكميات الفرع داخل image_url بشكل مرن لضمان حفظ واستعادة بيانات الفرع
 * حتى وإن لم تكن أعمدة branch_id أو branch_quantities موجودة في جدول Supabase
 */
export function encodeBranchMetaIntoImageUrl(
  imageUrl?: string,
  branchId?: string,
  branchName?: string,
  branchQuantities?: Record<string, number>
): string | undefined {
  const targetBranch = branchId || 'branch-main';
  const metaObj = {
    b: targetBranch,
    bn: branchName || (targetBranch === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي'),
    bq: branchQuantities || { [targetBranch]: 0 },
  };
  const metaToken = `__BMETA__:${encodeURIComponent(JSON.stringify(metaObj))}`;
  const cleanImg = (imageUrl || '').replace(/#__BMETA__:.*$/, '').replace(/^__BMETA__:.*$/, '').trim();
  if (cleanImg) {
    return `${cleanImg}#${metaToken}`;
  }
  return metaToken;
}

/**
 * فك ترميز بيانات الفرع من image_url واسترجاع الرابط النظيف للصورة
 */
export function decodeBranchMetaFromImageUrl(imageUrl?: string): {
  cleanImageUrl?: string;
  branchId?: string;
  branchName?: string;
  branchQuantities?: Record<string, number>;
} {
  if (!imageUrl) {
    return {};
  }
  const str = imageUrl.trim();
  let metaJsonStr: string | null = null;
  let cleanUrl: string | undefined = undefined;

  if (str.startsWith('__BMETA__:')) {
    metaJsonStr = str.substring('__BMETA__:'.length);
    cleanUrl = undefined;
  } else if (str.includes('#__BMETA__:')) {
    const parts = str.split('#__BMETA__:');
    cleanUrl = parts[0];
    metaJsonStr = parts[1];
  } else {
    cleanUrl = str;
  }

  if (metaJsonStr) {
    try {
      const decoded = JSON.parse(decodeURIComponent(metaJsonStr));
      return {
        cleanImageUrl: cleanUrl,
        branchId: decoded.b,
        branchName: decoded.bn,
        branchQuantities: decoded.bq,
      };
    } catch (e) {
      try {
        const decoded = JSON.parse(metaJsonStr);
        return {
          cleanImageUrl: cleanUrl,
          branchId: decoded.b,
          branchName: decoded.bn,
          branchQuantities: decoded.bq,
        };
      } catch (err) {}
    }
  }

  return { cleanImageUrl: cleanUrl };
}

export class SupabaseService {
  /**
   * إرجاع عميل Supabase المعتمد
   */
  static getClient(): SupabaseClient | null {
    const settings = dbService.getSettings();
    const url = (settings.supabaseUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
    const key = (settings.supabaseAnonKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

    if (!url || !key) {
      cachedClient = null;
      return null;
    }

    if (cachedClient) {
      void attachStoredAuthSession(cachedClient, url);
      return cachedClient;
    }

    try {
      cachedClient = createClient(url, key, {
        auth: { persistSession: false },
        realtime: {
          params: {
            eventsPerSecond: 25,
          },
        },
      });
      void attachStoredAuthSession(cachedClient, url);
      return cachedClient;
    } catch (err) {
      console.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  /** تعليق فوري بجلسة S3 المخزّنة (يُستدعى عند التشغيل وبعد الدخول) */
  static async attachAuthSession(): Promise<void> {
    const settings = dbService.getSettings();
    const url = (settings.supabaseUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
    const client = this.getClient();
    if (client) await attachStoredAuthSession(client, url);
  }

  /** إعادة إنشاء عميل المزامنة من الصفر (بعد الخروج) */
  static resetClient(): void {
    cachedClient = null;
    lastAttachedSessionFingerprint = '';
    isRealtimeStarted = false;
    realtimeChannel?.unsubscribe();
    realtimeChannel = null;
  }

  /**
   * فحص ما إذا كان Supabase مهيأ
   */
  static isConfigured(): boolean {
    return Boolean(this.getClient());
  }

  /**
   * حالة الاتصال الحقيقي Realtime
   */
  static getRealtimeStatus(): 'connected' | 'connecting' | 'disconnected' {
    return realtimeStatus;
  }

  static onRealtimeStatusChange(listener: (status: 'connected' | 'connecting' | 'disconnected') => void): () => void {
    realtimeStatusListeners.add(listener);
    listener(realtimeStatus);
    return () => realtimeStatusListeners.delete(listener);
  }

  static onRealtimeUpdate(listener: (event: { table: string; eventType: string; data?: any }) => void): () => void {
    realtimeUpdateListeners.add(listener);
    return () => realtimeUpdateListeners.delete(listener);
  }

  private static setRealtimeStatus(status: 'connected' | 'connecting' | 'disconnected') {
    realtimeStatus = status;
    realtimeStatusListeners.forEach((fn) => {
      try {
        fn(status);
      } catch (e) {
        console.error(e);
      }
    });
  }

  private static notifyRealtimeUpdate(event: { table: string; eventType: string; data?: any }) {
    realtimeUpdateListeners.forEach((fn) => {
      try {
        fn(event);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /**
   * بث فوري فائق السرعة عبر القنوات (Ultra-fast <50ms peer-to-peer sync)
   */
  static async broadcastEvent(type: string, data: any) {
    const client = this.getClient();
    if (realtimeChannel && client) {
      try {
        await realtimeChannel.send({
          type: 'broadcast',
          event: 'POS_MUTATION',
          payload: { type, data, sender: 'pos-' + Date.now() },
        });
      } catch (err) {
        // Broadcast non-blocking
      }
    }
  }

  /**
   * بدء الاستماع الحي المباشر (Realtime Sync) لجميع الجداول عبر Supabase
   */
  static startRealtimeSync(onDataUpdated?: () => void) {
    const client = this.getClient();
    if (!client) return;

    if (onDataUpdated) {
      this.onRealtimeUpdate(() => onDataUpdated());
    }

    if (isRealtimeStarted && realtimeChannel) {
      return;
    }
    isRealtimeStarted = true;
    this.setRealtimeStatus('connecting');

    try {
      // 1. جلب البيانات السحابية الأولية فوراً
      this.pullFromSupabase().catch((e) => console.warn('Initial pull error:', e));

      // 2. إزالة أي قناة قديمة إن وجدت
      if (realtimeChannel) {
        try {
          client.removeChannel(realtimeChannel);
        } catch {
          // ignore
        }
      }

      // 3. إنشاء قناة Realtime شاملة وموحدة
      realtimeChannel = client
        .channel('taibah-pos-realtime-v3', {
          config: {
            broadcast: { self: false },
          },
        })
        // المنتجات
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'products' },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any)?.id;
              const deletedBarcode = (payload.old as any)?.barcode;
              if (deletedId || deletedBarcode) {
                dbService.applyCloudDeleteProduct(deletedId, deletedBarcode);
                this.notifyRealtimeUpdate({ table: 'products', eventType: 'DELETE', data: { id: deletedId, barcode: deletedBarcode } });
              }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cp: any = payload.new;
              const cleanName = (cp?.name || cp?.product_name || '').trim();
              const cleanBarcode = (cp?.barcode || '').trim();

              if (cp && cp.id && cleanName && cleanBarcode) {
                const decodedMeta = decodeBranchMetaFromImageUrl(cp.image_url);
                const localProd = dbService.getAllRawProducts().find(
                  (lp) => (lp.id && lp.id === String(cp.id)) || (lp.barcode && lp.barcode.trim() === cleanBarcode)
                );

                let resolvedBranchId = 
                  cp.branch_id ||
                  cp.branchId ||
                  decodedMeta.branchId ||
                  localProd?.branchId;

                if (!resolvedBranchId) {
                  if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
                    resolvedBranchId = 'branch-sharshi';
                  } else {
                    resolvedBranchId = 'branch-main';
                  }
                }

                const branches = dbService.getBranches();
                const branchObj = branches.find((b) => b.id === resolvedBranchId);
                const resolvedBranchName = 
                  cp.branch_name ||
                  decodedMeta.branchName ||
                  localProd?.branchName ||
                  branchObj?.name ||
                  (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

                const totalQty = Number(cp.quantity ?? cp.qty) || 0;
                let resolvedBranchQuantities: Record<string, number> = {};

                if (cp.branch_quantities && typeof cp.branch_quantities === 'object' && Object.keys(cp.branch_quantities).length > 0) {
                  resolvedBranchQuantities = { ...cp.branch_quantities };
                } else if (decodedMeta.branchQuantities && typeof decodedMeta.branchQuantities === 'object' && Object.keys(decodedMeta.branchQuantities).length > 0) {
                  resolvedBranchQuantities = { ...decodedMeta.branchQuantities };
                } else if (localProd?.branchQuantities && Object.keys(localProd.branchQuantities).length > 0) {
                  resolvedBranchQuantities = { ...localProd.branchQuantities };
                } else {
                  resolvedBranchQuantities = { [resolvedBranchId]: totalQty };
                }

                const product: Product = {
                  id: String(cp.id),
                  barcode: cleanBarcode,
                  name: cleanName,
                  category: (cp.category || 'عام').trim(),
                  purchasePrice: Number(cp.purchase_price ?? cp.purchasePrice) || 0,
                  salePrice: Number(cp.sale_price ?? cp.salePrice ?? cp.price) || 0,
                  quantity: totalQty,
                  minQuantityAlert: Number(cp.min_quantity_alert ?? cp.minQuantityAlert) || 5,
                  unit: cp.unit || 'حبة',
                  imageUrl: decodedMeta.cleanImageUrl,
                  branchQuantities: resolvedBranchQuantities,
                  branchId: resolvedBranchId,
                  branchName: resolvedBranchName,
                  assignedBranchIds: [resolvedBranchId],
                  createdAt: cp.created_at || new Date().toISOString(),
                  updatedAt: cp.updated_at || new Date().toISOString(),
                };
                dbService.applyCloudUpsertProduct(product);
                this.notifyRealtimeUpdate({ table: 'products', eventType: payload.eventType, data: product });
              }
            }
          }
        )
        // المبيعات
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'sales' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cs: any = payload.new;
              if (cs && cs.id) {
                const sale: SaleTransaction = {
                  id: cs.id,
                  invoiceNumber: cs.invoice_number,
                  items: cs.items || [],
                  subtotal: Number(cs.subtotal) || 0,
                  discountTotal: Number(cs.discount_total) || 0,
                  netTotal: Number(cs.net_total) || 0,
                  totalProfit: Number(cs.total_profit) || 0,
                  paymentMethod: cs.payment_method || 'cash',
                  cashTendered: Number(cs.cash_tendered) || 0,
                  changeDue: Number(cs.change_due) || 0,
                  cashierName: cs.cashier_name || 'الكاشير',
                  createdAt: cs.created_at || new Date().toISOString(),
                  isSynced: true,
                };
                dbService.applyCloudInsertSale(sale);
                this.notifyRealtimeUpdate({ table: 'sales', eventType: payload.eventType, data: sale });
              }
            }
          }
        )
        // المرتجعات
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'returns' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cr: any = payload.new;
              if (cr && cr.id) {
                const returnRecord: ReturnRecord = {
                  id: cr.id,
                  returnNumber: cr.return_number,
                  originalInvoiceNumber: cr.original_invoice_number || undefined,
                  productId: cr.product_id,
                  barcode: cr.barcode,
                  productName: cr.product_name,
                  quantity: Number(cr.quantity) || 1,
                  refundUnitPrice: Number(cr.refund_unit_price) || 0,
                  refundTotal: Number(cr.refund_total) || 0,
                  reason: cr.reason,
                  customReasonText: cr.custom_reason_text || undefined,
                  actionTaken: cr.action_taken || 'restock',
                  cashierName: cr.cashier_name || 'الكاشير',
                  notes: cr.notes || undefined,
                  createdAt: cr.created_at || new Date().toISOString(),
                  isSynced: true,
                };
                dbService.applyCloudInsertReturn(returnRecord);
                this.notifyRealtimeUpdate({ table: 'returns', eventType: payload.eventType, data: returnRecord });
              }
            }
          }
        )
        // العملاء والديون customers
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'customers' },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const deletedId = (payload.old as any)?.id;
              if (deletedId) {
                dbService.applyCloudDeleteCustomer(deletedId);
                this.notifyRealtimeUpdate({ table: 'customers', eventType: 'DELETE', data: { id: deletedId } });
              }
            } else if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cc: any = payload.new;
              if (cc && cc.id && cc.name) {
                const customer: Customer = {
                  id: String(cc.id),
                  name: String(cc.name).trim(),
                  phone: cc.phone ? String(cc.phone).trim() : undefined,
                  currentDebt: Number(cc.current_debt ?? cc.currentDebt) || 0,
                  notes: cc.notes || undefined,
                  createdAt: cc.created_at || new Date().toISOString(),
                  updatedAt: cc.updated_at || new Date().toISOString(),
                  isSynced: true,
                };
                dbService.applyCloudUpsertCustomer(customer);
                this.notifyRealtimeUpdate({ table: 'customers', eventType: payload.eventType, data: customer });
              }
            }
          }
        )
        // حركات وسجل الديون debt_transactions
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'debt_transactions' },
          (payload) => {
            if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
              const cd: any = payload.new;
              if (cd && cd.id && cd.customer_id) {
                const tx: DebtTransaction = {
                  id: String(cd.id),
                  customerId: String(cd.customer_id),
                  customerName: cd.customer_name || undefined,
                  type: cd.type || 'payment',
                  amount: Number(cd.amount) || 0,
                  invoiceId: cd.invoice_id || undefined,
                  invoiceNumber: cd.invoice_number || undefined,
                  notes: cd.notes || undefined,
                  remainingBalance: Number(cd.remaining_balance ?? cd.remainingBalance) || 0,
                  cashierName: cd.cashier_name || 'الكاشير',
                  createdAt: cd.created_at || new Date().toISOString(),
                  isSynced: true,
                };
                dbService.applyCloudInsertDebtTransaction(tx);
                this.notifyRealtimeUpdate({ table: 'debt_transactions', eventType: payload.eventType, data: tx });
              }
            }
          }
        )
        // إعدادات المتجر
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'store_settings' },
          (payload) => {
            const cs: any = payload.new;
            if (cs) {
              dbService.applyCloudSettings({
                storeName: cs.store_name,
                storePhone: cs.store_phone,
                storeAddress: cs.store_address,
                storeVatNumber: cs.store_vat_number,
                currency: cs.currency,
                backupEmail: cs.backup_email,
                receiptFooterMessage: cs.receipt_footer_message,
                securityPin: cs.security_pin,
                cashiers: cs.cashiers,
                activeCashier: cs.active_cashier,
              });
              this.notifyRealtimeUpdate({ table: 'store_settings', eventType: payload.eventType, data: cs });
            }
          }
        )
        // البث المباشر المخصص للـ P2P
        .on('broadcast', { event: 'POS_MUTATION' }, ({ payload }) => {
          if (!payload) return;
          const { type, data } = payload;
          if (type === 'PRODUCT_UPSERT' && data) {
            dbService.applyCloudUpsertProduct(data);
          } else if (type === 'PRODUCT_DELETE' && data) {
            dbService.applyCloudDeleteProduct(data.id, data.barcode);
          } else if (type === 'SALE_CREATED' && data) {
            dbService.applyCloudInsertSale(data);
          } else if (type === 'RETURN_CREATED' && data) {
            dbService.applyCloudInsertReturn(data);
          } else if (type === 'CUSTOMER_UPSERT' && data) {
            dbService.applyCloudUpsertCustomer(data);
          } else if (type === 'CUSTOMER_DELETE' && data) {
            dbService.applyCloudDeleteCustomer(data.id);
          } else if (type === 'DEBT_TX_CREATE' && data) {
            dbService.applyCloudInsertDebtTransaction(data);
          } else if (type === 'SETTINGS_UPDATED' && data) {
            dbService.applyCloudSettings(data);
          }
          this.notifyRealtimeUpdate({ table: 'broadcast', eventType: type, data });
        })
        .subscribe((status, err) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Supabase Realtime connected and listening across all devices!');
            this.setRealtimeStatus('connected');
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            console.warn('Supabase Realtime status changed:', status, err);
            this.setRealtimeStatus('disconnected');
            // محاولة إعادة اتصال دورية ذكية
            setTimeout(() => {
              if (navigator.onLine && realtimeStatus !== 'connected') {
                isRealtimeStarted = false;
                this.startRealtimeSync();
              }
            }, 4000);
          }
        });

      // 4. معالجة طابور العمليات غير المزامنة (Offline Queue) تلقائياً
      this.flushOfflineQueue().catch(() => {});

      // استماع لحدث رجوع التطبيق للواجهة أو عودة الإنترنت
      window.addEventListener('online', () => {
        console.log('🌐 Internet connection restored. Flushing offline queue...');
        this.flushOfflineQueue().catch(() => {});
        if (realtimeStatus === 'disconnected') {
          isRealtimeStarted = false;
          this.startRealtimeSync();
        }
      });

      window.addEventListener('focus', () => {
        if (navigator.onLine && realtimeStatus === 'disconnected') {
          isRealtimeStarted = false;
          this.startRealtimeSync();
        }
      });
    } catch (e) {
      console.warn('Supabase realtime sync setup exception:', e);
      this.setRealtimeStatus('disconnected');
    }
  }

  /**
   * تفريغ ومزامنة طابور العمليات غير المتصلة (Offline Queue Auto-flush)
   */
  static async flushOfflineQueue(): Promise<number> {
    if (!navigator.onLine || !this.isConfigured()) return 0;
    const queue = dbService.getOfflineQueue();
    if (queue.length === 0) return 0;

    let processedCount = 0;
    try {
      for (const mut of queue) {
        if (mut.type === 'PRODUCT_UPSERT' && mut.data) {
          await this.syncProduct(mut.data);
        } else if (mut.type === 'PRODUCT_DELETE' && mut.data) {
          await this.deleteProduct(mut.data.id, mut.data.barcode);
        } else if (mut.type === 'SALE_CREATE' && mut.data) {
          const ok = await this.syncSale(mut.data);
          if (ok) dbService.markSaleAsSynced(mut.data.id);
        } else if (mut.type === 'RETURN_CREATE' && mut.data) {
          const ok = await this.syncReturn(mut.data);
          if (ok) dbService.markReturnAsSynced(mut.data.id);
        } else if (mut.type === 'CUSTOMER_UPSERT' && mut.data) {
          await this.syncCustomer(mut.data);
        } else if (mut.type === 'CUSTOMER_DELETE' && mut.data) {
          await this.deleteCustomer(mut.data.id);
        } else if (mut.type === 'DEBT_TX_CREATE' && mut.data) {
          const ok = await this.syncDebtTransaction(mut.data);
          if (ok) dbService.markDebtTxAsSynced(mut.data.id);
        } else if (mut.type === 'SETTINGS_SAVE' && mut.data) {
          await this.syncSettings(mut.data);
        }
        processedCount++;
      }
      dbService.clearOfflineQueue();
      console.log(`✅ Successfully flushed ${processedCount} offline mutations to Supabase`);
    } catch (err) {
      console.warn('Error flushing offline queue:', err);
    }
    return processedCount;
  }

  /**
   * اختبار الاتصال بـ Supabase
   */
  static async testConnection(customUrl?: string, customKey?: string): Promise<{ success: boolean; message: string }> {
    try {
      const url = (customUrl || dbService.getSettings().supabaseUrl || ENV_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim();
      const key = (customKey || dbService.getSettings().supabaseAnonKey || ENV_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY).trim();

      if (!url || !key) {
        return { success: false, message: 'يرجى إدخال رابط المشروع (URL) ومفتاح الوصول (Anon Key)' };
      }

      const client = createClient(url, key, { auth: { persistSession: false } });
      const { error } = await client.from('products').select('id').limit(1);

      if (error) {
        return { success: false, message: `فشل الاتصال: ${error.message}` };
      }

      return { success: true, message: 'تم الاتصال بقاعدة بيانات Supabase السحابية بنجاح!' };
    } catch (err: any) {
      return { success: false, message: `خطأ في الاتصال: ${err?.message || err}` };
    }
  }

  /**
   * فحص حالة الاتصال الحالية
   */
  static async checkLiveStatus(): Promise<{
    status: 'connected' | 'disconnected' | 'not_configured' | 'checking';
    message: string;
  }> {
    if (!navigator.onLine) {
      return { status: 'disconnected', message: 'الجهاز غير متصل بالإنترنت (وضع أوفلاين)' };
    }

    try {
      const result = await this.testConnection();
      if (result.success) {
        return { status: 'connected', message: 'متصل بسحابة Supabase ومزامن بنجاح' };
      } else {
        return { status: 'disconnected', message: result.message };
      }
    } catch (e: any) {
      return { status: 'disconnected', message: e?.message || 'تعذر الاتصال بـ Supabase' };
    }
  }

  /**
   * مرونة في عمليات Supabase لتفادي أخطاء الحقول المفقودة
   */
  private static async executeResilientOperation(
    op: (cleanPayload: Record<string, any>) => PromiseLike<{ error: any }>,
    initialPayload: Record<string, any>
  ): Promise<{ success: boolean; error?: any }> {
    const payload = { ...initialPayload };

    for (let attempt = 0; attempt < 8; attempt++) {
      const res = await op(payload);
      const error = res?.error;

      if (!error) return { success: true };

      // معالجة خطأ العمود المفقود (PostgREST PGRST204)
      const missingColMatch = error.message?.match(/Could not find the '([^']+)' column/i);
      if (missingColMatch && missingColMatch[1] && missingColMatch[1] in payload) {
        const missingCol = missingColMatch[1];
        console.warn(`Supabase schema: column '${missingCol}' not found in table. Stripping and retrying.`);
        delete payload[missingCol];
        continue;
      }

      // معالجة خطأ عدم توافق نوع id (UUID / BigInt)
      if (
        (error.message?.includes('invalid input syntax for type uuid') ||
          error.message?.includes('invalid input syntax for type bigint') ||
          error.message?.includes('invalid input syntax for integer')) &&
        'id' in payload
      ) {
        console.warn('Supabase: ID type mismatch. Removing ID to allow DB default/auto-increment.');
        delete payload['id'];
        continue;
      }

      return { success: false, error };
    }

    return { success: false };
  }

  /**
   * دالة موحدة للتحقق من وجود السجلات وتحديثها (Unified Upsert)
   * تمنع إدراج سجلات فارغة أو تالفة، وتتحقق من وجود الصنف بالباركود أو المعرف
   */
  static async unifiedUpsertProduct(product: Partial<Product> & { barcode: string; name: string }): Promise<{
    success: boolean;
    action: 'inserted' | 'updated' | 'rejected' | 'skipped_stale';
    data?: Product;
    error?: string;
  }> {
    const client = this.getClient();
    if (!client || !navigator.onLine) {
      return { success: false, action: 'rejected', error: 'العميل غير متصل بقاعدة البيانات أو أوفلاين' };
    }

    // 1. التحقق الصارم من صحة البيانات لمنع السجلات الفارغة
    if (!product || typeof product !== 'object') {
      return { success: false, action: 'rejected', error: 'بيانات المنتج غير صالحة' };
    }

    const cleanBarcode = String(product.barcode || '').trim();
    const cleanName = String(product.name || '').trim();

    // منع الحقول الفارغة أو النصوص المعطوبة مثل [object Object]
    if (!cleanBarcode || cleanBarcode === '[object Object]' || cleanBarcode === 'undefined' || cleanBarcode === 'null') {
      return { success: false, action: 'rejected', error: 'الباركود مطلوب ولا يمكن أن يكون فارغاً' };
    }

    if (!cleanName || cleanName === '[object Object]' || cleanName === 'undefined' || cleanName === 'null') {
      return { success: false, action: 'rejected', error: 'اسم المنتج مطلوب ولا يمكن أن يكون فارغاً' };
    }

    const salePrice = Math.max(0, Number(product.salePrice) || 0);
    const purchasePrice = Math.max(0, Number(product.purchasePrice) || 0);
    const quantity = Math.max(0, Number(product.quantity) || 0);
    const minAlert = Math.max(1, Number(product.minQuantityAlert) || 5);
    const category = String(product.category || 'عام').trim() || 'عام';
    const unit = String(product.unit || 'حبة').trim() || 'حبة';

    try {
      // 2. التحقق من وجود السجل مسبقاً في السحابة (Check Existence)
      let existingRecord: any = null;

      if (product.id) {
        const { data } = await client.from('products').select('*').eq('id', product.id).maybeSingle();
        if (data) existingRecord = data;
      }

      if (!existingRecord && cleanBarcode) {
        const { data } = await client.from('products').select('*').eq('barcode', cleanBarcode).maybeSingle();
        if (data) existingRecord = data;
      }

      const targetId = existingRecord?.id || product.id || `p-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const createdAt = existingRecord?.created_at || product.createdAt || new Date().toISOString();
      const updatedAt = new Date().toISOString();

      // (Fix 1) حماية ردّ الطابور/الدفعات القديمة: إذا كانت نسخة السحابة أحدث زمنياً
      // من الحمولة الواردة فلا تكتبها فوقها — اعتبرها منجزة (السحابة هي الأحدث)
      const incomingT = Date.parse(product.updatedAt || '') || 0;
      const cloudT = Date.parse(existingRecord?.updated_at || '') || 0;
      if (existingRecord && incomingT && cloudT && incomingT < cloudT) {
        return { success: true, action: 'skipped_stale', error: 'نسخة السحابة أحدث من الحمولة — تم التخطي دون طمس' };
      }

      // (Fix) أرضية حماية مالية: حمولة بلا سعر (0) لا تُصفّر سعراً سحابياً موجوداً فعلاً.
      // السعر الوارد صفر = غياب معلومة وليس نية تصفير — يُصان السعر المخزّن في السحابة.
      const existingSalePrice = Math.max(0, Number(existingRecord?.sale_price) || 0);
      const existingPurchasePrice = Math.max(0, Number(existingRecord?.purchase_price) || 0);
      const finalSalePrice = salePrice > 0 ? salePrice : existingSalePrice;
      const finalPurchasePrice = purchasePrice > 0 ? purchasePrice : existingPurchasePrice;

      const payload: Record<string, any> = {
        id: String(targetId),
        barcode: cleanBarcode,
        name: cleanName,
        category,
        purchase_price: finalPurchasePrice,
        sale_price: finalSalePrice,
        quantity,
        min_quantity_alert: minAlert,
        unit,
        created_at: createdAt,
        updated_at: updatedAt,
      };

      const finalBranch = product.branchId || (cleanName.includes('الشارشي') || cleanBarcode === '628408035273' ? 'branch-sharshi' : 'branch-main');
      const finalBranchName = product.branchName || (finalBranch === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');
      const finalBranchQuantities = (product.branchQuantities && Object.keys(product.branchQuantities).length > 0)
        ? product.branchQuantities
        : { [finalBranch]: quantity };

      // تشفير بيانات الفرع داخل image_url لضمان بقائها واسترجاعها بنسبة 100% حتى لو خلا الجدول من أعمدة الفروع
      payload.image_url = encodeBranchMetaIntoImageUrl(
        product.imageUrl,
        finalBranch,
        finalBranchName,
        finalBranchQuantities
      );
      payload.branch_quantities = finalBranchQuantities;
      payload.branch_id = finalBranch;

      let opSuccess = false;
      let finalAction: 'inserted' | 'updated' = existingRecord ? 'updated' : 'inserted';

      if (existingRecord) {
        // تحديث السجل الموجود
        const updateOp = await this.executeResilientOperation(
          (p) => client.from('products').update(p).eq('id', existingRecord.id),
          payload
        );
        if (updateOp.success) {
          opSuccess = true;
        } else {
          // محاولة ثانية بالباركود
          const updateByBarcodeOp = await this.executeResilientOperation(
            (p) => client.from('products').update(p).eq('barcode', cleanBarcode),
            payload
          );
          opSuccess = updateByBarcodeOp.success;
        }
      } else {
        // إدراج أو Upsert ذكي
        const upsertOp = await this.executeResilientOperation(
          (p) => client.from('products').upsert(p, { onConflict: 'barcode' }),
          payload
        );
        if (upsertOp.success) {
          opSuccess = true;
        } else {
          const insertOp = await this.executeResilientOperation(
            (p) => client.from('products').insert(p),
            payload
          );
          opSuccess = insertOp.success;
        }
      }

      if (opSuccess) {
        const cleanProduct: Product = {
          id: String(targetId),
          barcode: cleanBarcode,
          name: cleanName,
          category,
          purchasePrice: finalPurchasePrice,
          salePrice: finalSalePrice,
          quantity,
          minQuantityAlert: minAlert,
          unit,
          imageUrl: product.imageUrl,
          branchId: finalBranch,
          branchName: finalBranchName,
          branchQuantities: finalBranchQuantities,
          assignedBranchIds: [finalBranch],
          createdAt,
          updatedAt,
        };

        return {
          success: true,
          action: finalAction,
          data: cleanProduct,
        };
      }

      return {
        success: false,
        action: 'rejected',
        error: 'فشلت عملية حفظ المنتج في سوبابيز',
      };
    } catch (err: any) {
      console.error('Unified upsert exception in SupabaseService:', err);
      return {
        success: false,
        action: 'rejected',
        error: err?.message || 'خطأ غير متوقع أثناء معالجة المنتج',
      };
    }
  }

  /**
   * مزامنة منتج واحد مع Supabase عبر الدالة الموحدة
   */
  static async syncProduct(product: Product): Promise<boolean> {
    if (!product) return false;
    const res = await this.unifiedUpsertProduct(product);
    return res.success;
  }

  /**
   * حذف منتج من Supabase
   */
  static async deleteProduct(productId: string, barcode?: string): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      if (productId) {
        await client.from('products').delete().eq('id', productId);
      }
      if (barcode && barcode.trim()) {
        await client.from('products').delete().eq('barcode', barcode.trim());
      }
      return true;
    } catch (e) {
      console.warn('Supabase delete product exception:', e);
      return false;
    }
  }

  /**
   * مزامنة عميل Customer مع Supabase
   */
  static async syncCustomer(customer: Customer): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const payload: Record<string, any> = {
        id: customer.id,
        name: customer.name,
        phone: customer.phone || null,
        current_debt: Number(customer.currentDebt) || 0,
        notes: customer.notes || null,
        created_at: customer.createdAt,
        updated_at: customer.updatedAt || new Date().toISOString(),
      };

      const op = await this.executeResilientOperation(
        (p) => client.from('customers').upsert(p, { onConflict: 'id' }),
        payload
      );
      return op.success;
    } catch (e) {
      console.warn('Supabase customer sync exception:', e);
      return false;
    }
  }

  /**
   * حذف عميل من Supabase
   */
  static async deleteCustomer(customerId: string): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      await client.from('customers').delete().eq('id', customerId);
      return true;
    } catch (e) {
      console.warn('Supabase delete customer exception:', e);
      return false;
    }
  }

  /**
   * مزامنة حركة دين Debt Transaction مع Supabase
   */
  static async syncDebtTransaction(tx: DebtTransaction): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const payload: Record<string, any> = {
        id: tx.id,
        customer_id: tx.customerId,
        customer_name: tx.customerName || null,
        type: tx.type,
        amount: Number(tx.amount) || 0,
        invoice_id: tx.invoiceId || null,
        invoice_number: tx.invoiceNumber || null,
        notes: tx.notes || null,
        remaining_balance: Number(tx.remainingBalance) || 0,
        cashier_name: tx.cashierName || 'الكاشير',
        created_at: tx.createdAt,
      };

      const op = await this.executeResilientOperation(
        (p) => client.from('debt_transactions').upsert(p, { onConflict: 'id' }),
        payload
      );
      return op.success;
    } catch (e) {
      console.warn('Supabase debt transaction sync exception:', e);
      return false;
    }
  }

  /**
   * مزامنة فاتورة بيع مع Supabase باستخدام upsert حصرياً
   */
  static async syncSale(sale: SaleTransaction): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const saleId = String(sale.id || `sale-${Date.now()}`);
      const invoiceNumber = String(sale.invoiceNumber || `INV-${Date.now()}`);
      const primaryItem = sale.items?.[0];

      // 1. تجهيز حمولة الفاتورة الشاملة
      const invoicePayload: Record<string, any> = {
        id: saleId,
        invoice_number: invoiceNumber,
        items: sale.items || [],
        subtotal: Number(sale.subtotal) || 0,
        discount_total: Number(sale.discountTotal) || 0,
        net_total: Number(sale.netTotal) || 0,
        total_profit: Number(sale.totalProfit) || 0,
        payment_method: sale.paymentMethod || 'cash',
        cash_tendered: Number(sale.cashTendered) || Number(sale.netTotal) || 0,
        change_due: Number(sale.changeDue) || 0,
        cashier_name: sale.cashierName || 'الكاشير',
        customer_id: sale.customerId || null,
        customer_name: sale.customerName || null,
        barcode: primaryItem?.barcode || null,
        product_name: primaryItem?.productName || (sale.items?.length > 1 ? `${primaryItem?.productName} + ${sale.items.length - 1} أصناف` : 'فاتورة مبيعات'),
        quantity_sold: sale.items?.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) || 1,
        purchase_price: primaryItem?.purchasePrice || 0,
        sale_price: primaryItem?.unitPrice || 0,
        total_amount: Number(sale.netTotal) || 0,
        profit: Number(sale.totalProfit) || 0,
        sold_at: sale.createdAt || new Date().toISOString(),
        created_at: sale.createdAt || new Date().toISOString(),
      };

      // أعمدة الفرع والحالة — تُكتب إن وُجدت بالسحابة (تُشغّل بسكربت ALTER).
      // إن لم تكن موجودة بعد: upsert يفشل بعمود مجهول → نجرّد الحقول ونعيد المحاولة.
      const branchFields: Record<string, any> = {
        branch_id: sale.branchId || 'branch-main',
        branch_name: sale.branchName || null,
        status: sale.status || 'completed',
      };
      let payloadWithBranch = { ...invoicePayload, ...branchFields };

      // إجراء Upsert للفاتورة في جدول sales
      let saleOp = await this.executeResilientOperation(
        (p) => client.from('sales').upsert(p, { onConflict: 'id' }),
        payloadWithBranch
      );
      if (!saleOp.success && saleOp.error && /branch_id|branch_name|status|does not exist|column/i.test(String(saleOp.error))) {
        // الأعمدة غير موجودة بعد — جرّد الحقول الإضافية وأعد بلا كسر المزامنة
        payloadWithBranch = { ...invoicePayload };
        saleOp = await this.executeResilientOperation(
          (p) => client.from('sales').upsert(p, { onConflict: 'id' }),
          payloadWithBranch
        );
      }

      if (!saleOp.success) {
        // محاولة بديلة بالإدراج — يجب فحص نتيجتها: الإرجاع الأعمى لـ true كان
        // يعلّم الفاتورة isSynced ويمنع إعادة المحاولة عبر طابور الأوفلاين
        const insertOp = await this.executeResilientOperation(
          (p) => client.from('sales').insert(p),
          payloadWithBranch
        );
        if (!insertOp.success) {
          console.warn('Supabase sale sync failed (upsert + insert):', insertOp.error);
          return false;
        }
      }

      // 2. تحديث وخصم الكميات من جدول products في Supabase لكل صنف تم بيعه
      if (sale.items && sale.items.length > 0) {
        for (const item of sale.items) {
          if (item.barcode) {
            const { data: currentProduct } = await client
              .from('products')
              .select('id, quantity, image_url')
              .eq('barcode', item.barcode)
              .maybeSingle();

            if (currentProduct) {
              const newQty = Math.max(0, Number(currentProduct.quantity || 0) - Number(item.quantity || 1));

              // (Fix) مصدر حقيقة واحد: أعد موازنة الترميز داخل image_url ليطابق
              // الكمية الجديدة — وإلا بقي الترميز العتيق يُبطل الخصم عند كل تطبيق
              const decoded = decodeBranchMetaFromImageUrl(currentProduct.image_url);
              const rowBranch = decoded.branchId || 'branch-main';
              let newBq = (decoded.branchQuantities && Object.keys(decoded.branchQuantities).length > 0)
                ? { ...decoded.branchQuantities }
                : { [rowBranch]: Number(currentProduct.quantity || 0) };
              {
                const bqSum = Object.values(newBq).reduce((s, q) => s + (Number(q) || 0), 0);
                if (Math.abs(bqSum - newQty) > 0.001) {
                  const rebalanced: Record<string, number> = {};
                  let othersSum = 0;
                  for (const [bId, q] of Object.entries(newBq)) {
                    if (bId !== rowBranch && Number(q) > 0) { rebalanced[bId] = Number(q); othersSum += Number(q); }
                  }
                  rebalanced[rowBranch] = Math.max(0, newQty - othersSum);
                  newBq = rebalanced;
                }
              }
              const newImageUrl = encodeBranchMetaIntoImageUrl(decoded.cleanImageUrl, rowBranch, decoded.branchName, newBq);

              await client
                .from('products')
                .update({ quantity: newQty, image_url: newImageUrl, updated_at: new Date().toISOString() })
                .eq('id', currentProduct.id);
            } else {
              // (Fix 2) الصنف غير موجود بالسحابة: لا تخطِّ صامتاً — أنشئه بالكمية
              // المحلية المخفَّدة فعلاً (المصدر الحقيقي للرصيد بعد البيع)
              const localProd = dbService.getProductById(item.productId);
              if (localProd) {
                await this.syncProduct(localProd);
              }
            }
          }
        }
      }

      return true;
    } catch (e) {
      console.warn('Supabase sale sync exception:', e);
      return false;
    }
  }

  /**
   * مزامنة مرتجع مع Supabase
   */
  static async syncReturn(ret: ReturnRecord): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      // 1. إذا كان الإجراء إعادة للمخزن (restock)، نقوم بزيادة الكمية في Supabase
      if (ret.actionTaken === 'restock') {
        let productUpdated = false;

        // محاولة البحث بالمعرف (productId) أولاً
        if (ret.productId) {
          const { data: currentProduct } = await client
            .from('products')
            .select('id, quantity')
            .eq('id', ret.productId)
            .maybeSingle();

          if (currentProduct) {
            const newQty = Number(currentProduct.quantity || 0) + ret.quantity;
            await client
              .from('products')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', currentProduct.id);
            productUpdated = true;
          }
        }

        // إذا لم يتم التحديث بالـ id، نحاول بالباركود
        if (!productUpdated && ret.barcode) {
          const { data: currentProduct } = await client
            .from('products')
            .select('id, quantity')
            .eq('barcode', ret.barcode)
            .maybeSingle();

          if (currentProduct) {
            const newQty = Number(currentProduct.quantity || 0) + ret.quantity;
            await client
              .from('products')
              .update({ quantity: newQty, updated_at: new Date().toISOString() })
              .eq('id', currentProduct.id);
          }
        }
      }

      // 2. محاولة حفظ سجل المرتجع في جدول returns في Supabase
      try {
        const payload: Record<string, any> = {
          id: ret.id,
          return_number: ret.returnNumber,
          original_invoice_number: ret.originalInvoiceNumber || null,
          product_id: ret.productId || null,
          barcode: ret.barcode || null,
          product_name: ret.productName,
          quantity: ret.quantity,
          refund_unit_price: ret.refundUnitPrice,
          refund_total: ret.refundTotal,
          reason: ret.reason,
          custom_reason_text: ret.customReasonText || null,
          action_taken: ret.actionTaken,
          cashier_name: ret.cashierName,
          branch_id: ret.branchId || null,
          branch_name: ret.branchName || null,
          notes: ret.notes || null,
          created_at: ret.createdAt,
        };

        // محاولة الإدخال (بأعمدة الفرع إن وُجدت — وإلا تُجرَّد وتُعاد بلا كسر)
        let insertErr: any = null;
        ({ error: insertErr } = await client.from('returns').upsert(payload, { onConflict: 'id' }));
        if (insertErr && /branch_id|branch_name|does not exist|column/i.test(String(insertErr?.message || insertErr))) {
          const { branch_id: _b, branch_name: _bn, ...payloadPlain } = payload;
          ({ error: insertErr } = await client.from('returns').upsert(payloadPlain, { onConflict: 'id' }));
        }

        // إذا فشل بسبب نوع id (مثلاً BIGSERIAL) نجرب بدون id
        if (insertErr) {
          const { id: _, ...payloadWithoutId } = payload;
          await client.from('returns').insert(payloadWithoutId);
        }
      } catch (err) {
        console.warn('Supabase returns table insert error (table may need creation):', err);
      }

      return true;
    } catch (e) {
      console.warn('Supabase return sync exception:', e);
      return false;
    }
  }

  /**
   * مزامنة الإعدادات مع Supabase
   */
  static async syncSettings(settings: StoreSettings): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const payload: Record<string, any> = {
        id: 'main_store_config',
        store_name: settings.storeName,
        store_phone: settings.storePhone,
        store_address: settings.storeAddress,
        store_vat_number: settings.storeVatNumber || null,
        currency: settings.currency,
        backup_email: settings.backupEmail,
        receipt_footer_message: settings.receiptFooterMessage,
        security_pin: settings.securityPin,
        cashiers: settings.cashiers,
        active_cashier: settings.activeCashier,
        updated_at: new Date().toISOString(),
      };

      const result = await this.executeResilientOperation(
        (p) => client.from('store_settings').upsert(p, { onConflict: 'id' }),
        payload
      );
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * مزامنة سجل حركة وتدقيق المخزون (Stock Audit Log) مع Supabase
   */
  static async syncStockAuditLog(log: any): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const payload: Record<string, any> = {
        id: log.id,
        product_id: log.productId,
        barcode: log.barcode,
        product_name: log.productName,
        type: log.type,
        quantity_delta: Number(log.quantityDelta) || 0,
        previous_quantity: Number(log.previousQuantity) || 0,
        new_quantity: Number(log.newQuantity) || 0,
        reason: log.reason || null,
        performed_by: log.performedBy || 'النظام',
        created_at: log.createdAt || new Date().toISOString(),
      };

      const result = await this.executeResilientOperation(
        (p) => client.from('stock_audit_logs').upsert(p, { onConflict: 'id' }),
        payload
      );
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * مزامنة سند تحويل مخزني بين الفروع مع Supabase
   */
  static async syncStockTransfer(transfer: any): Promise<boolean> {
    const client = this.getClient();
    if (!client || !navigator.onLine) return false;

    try {
      const payload: Record<string, any> = {
        id: transfer.id,
        transfer_number: transfer.transferNumber,
        source_branch_id: transfer.sourceBranchId,
        source_branch_name: transfer.sourceBranchName,
        target_branch_id: transfer.targetBranchId,
        target_branch_name: transfer.targetBranchName,
        items: transfer.items || [],
        total_quantity: Number(transfer.totalQuantity) || 0,
        status: transfer.status || 'completed',
        notes: transfer.notes || null,
        transferred_by: transfer.transferredBy || 'النظام',
        created_at: transfer.createdAt || new Date().toISOString(),
      };

      const result = await this.executeResilientOperation(
        (p) => client.from('stock_transfers').upsert(p, { onConflict: 'id' }),
        payload
      );
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * مزامنة شاملة لجميع السجلات غير المزامنة
   */
  static async syncAll(): Promise<{
    success: boolean;
    syncedSalesCount: number;
    syncedReturnsCount: number;
    syncedProductsCount: number;
    syncedCustomersCount: number;
    syncedDebtCount: number;
    message: string;
  }> {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        syncedSalesCount: 0,
        syncedReturnsCount: 0,
        syncedProductsCount: 0,
        syncedCustomersCount: 0,
        syncedDebtCount: 0,
        message: 'إعدادات Supabase غير مكتملة',
      };
    }

    if (!navigator.onLine) {
      return {
        success: false,
        syncedSalesCount: 0,
        syncedReturnsCount: 0,
        syncedProductsCount: 0,
        syncedCustomersCount: 0,
        syncedDebtCount: 0,
        message: 'الجهاز غير متصل بالإنترنت',
      };
    }

    let syncedSalesCount = 0;
    let syncedReturnsCount = 0;
    let syncedProductsCount = 0;
    let syncedCustomersCount = 0;
    let syncedDebtCount = 0;

    try {
      // 1. مزامنة المنتجات
      const products = dbService.getProducts();
      for (const p of products) {
        const ok = await this.syncProduct(p);
        if (ok) syncedProductsCount++;
      }

      // 2. مزامنة العملاء
      const customers = dbService.getCustomers();
      for (const c of customers) {
        const ok = await this.syncCustomer(c);
        if (ok) syncedCustomersCount++;
      }

      // 3. مزامنة حركات الديون
      const debtTx = dbService.getDebtTransactions();
      const unsyncedDebt = debtTx.filter((d) => !d.isSynced);
      for (const d of unsyncedDebt) {
        const ok = await this.syncDebtTransaction(d);
        if (ok) {
          dbService.markDebtTxAsSynced(d.id);
          syncedDebtCount++;
        }
      }

      // 4. مزامنة المبيعات
      const allSales = dbService.getSales();
      const unsyncedSales = allSales.filter((s) => !s.isSynced);
      for (const s of unsyncedSales) {
        const ok = await this.syncSale(s);
        if (ok) {
          dbService.markSaleAsSynced(s.id);
          syncedSalesCount++;
        }
      }

      // 5. مزامنة المرتجعات
      const allReturns = dbService.getReturns();
      const unsyncedReturns = allReturns.filter((r) => !r.isSynced);
      for (const r of unsyncedReturns) {
        const ok = await this.syncReturn(r);
        if (ok) {
          dbService.markReturnAsSynced(r.id);
          syncedReturnsCount++;
        }
      }

      // 6. مزامنة الإعدادات
      const settings = dbService.getSettings();
      await this.syncSettings(settings);

      return {
        success: true,
        syncedSalesCount,
        syncedReturnsCount,
        syncedProductsCount,
        syncedCustomersCount,
        syncedDebtCount,
        message: `تمت المزامنة الشاملة مع Supabase بنجاح! (${syncedProductsCount} منتج، ${syncedSalesCount} مبيعات، ${syncedCustomersCount} عميل)`,
      };
    } catch (e: any) {
      return {
        success: false,
        syncedSalesCount,
        syncedReturnsCount,
        syncedProductsCount,
        syncedCustomersCount,
        syncedDebtCount,
        message: `خطأ أثناء المزامنة: ${e?.message || e}`,
      };
    }
  }

  /**
   * جلب البيانات من Supabase بالكامل (Pull Cloud Data)
   */
  static async pullFromSupabase(): Promise<{
    success: boolean;
    productsCount: number;
    salesCount: number;
    returnsCount: number;
    customersCount: number;
    debtCount: number;
    auditCount: number;
    message: string;
  }> {
    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        productsCount: 0,
        salesCount: 0,
        returnsCount: 0,
        customersCount: 0,
        debtCount: 0,
        auditCount: 0,
        message: 'Supabase غير مهيأ',
      };
    }

    try {
      // 1. جلب المنتجات products
      let productsCount = 0;
      try {
        const { data: cloudProducts, error: pErr } = await client.from('products').select('*');
        if (!pErr && cloudProducts) {
          if (cloudProducts.length > 0) {
            const currentLocalProducts = dbService.getAllRawProducts();
            const branches = dbService.getBranches();

            const mappedProducts: Product[] = cloudProducts
              .filter((cp: any) => cp && (cp.name || cp.product_name) && cp.barcode)
              .map((cp: any) => {
                const cleanBarcode = String(cp.barcode).trim();
                const cleanName = String(cp.name || cp.product_name).trim();

                // فك ترميز بيانات الفرع المحفوظة في image_url
                const decodedMeta = decodeBranchMetaFromImageUrl(cp.image_url);

                // البحث عن السجل المحلي المقابل للاحتفاظ ببيانات الفرع إن وجدت
                const localProd = currentLocalProducts.find(
                  (lp) => (lp.id && lp.id === String(cp.id)) || (lp.barcode && lp.barcode.trim() === cleanBarcode)
                );

                let resolvedBranchId = 
                  cp.branch_id ||
                  cp.branchId ||
                  decodedMeta.branchId ||
                  localProd?.branchId;

                if (!resolvedBranchId) {
                  if (cleanName.includes('الشارشي') || cleanBarcode === '628408035273') {
                    resolvedBranchId = 'branch-sharshi';
                  } else {
                    resolvedBranchId = 'branch-main';
                  }
                }

                const branchObj = branches.find((b) => b.id === resolvedBranchId);
                const resolvedBranchName = 
                  cp.branch_name ||
                  decodedMeta.branchName ||
                  localProd?.branchName ||
                  branchObj?.name ||
                  (resolvedBranchId === 'branch-sharshi' ? 'فرع الشارشي' : 'الفرع الرئيسي');

                const totalQty = Number(cp.quantity ?? cp.qty) || 0;
                let resolvedBranchQuantities: Record<string, number> = {};

                if (cp.branch_quantities && typeof cp.branch_quantities === 'object' && Object.keys(cp.branch_quantities).length > 0) {
                  resolvedBranchQuantities = { ...cp.branch_quantities };
                } else if (decodedMeta.branchQuantities && typeof decodedMeta.branchQuantities === 'object' && Object.keys(decodedMeta.branchQuantities).length > 0) {
                  resolvedBranchQuantities = { ...decodedMeta.branchQuantities };
                } else if (localProd?.branchQuantities && Object.keys(localProd.branchQuantities).length > 0) {
                  resolvedBranchQuantities = { ...localProd.branchQuantities };
                } else {
                  resolvedBranchQuantities = { [resolvedBranchId]: totalQty };
                }

                return {
                  id: String(cp.id),
                  barcode: cleanBarcode,
                  name: cleanName,
                  category: (cp.category || 'عام').trim(),
                  purchasePrice: Number(cp.purchase_price ?? cp.purchasePrice) || 0,
                  salePrice: Number(cp.sale_price ?? cp.salePrice ?? cp.price) || 0,
                  quantity: totalQty,
                  minQuantityAlert: Number(cp.min_quantity_alert ?? cp.minQuantityAlert) || 5,
                  unit: cp.unit || 'حبة',
                  imageUrl: decodedMeta.cleanImageUrl,
                  branchQuantities: resolvedBranchQuantities,
                  branchId: resolvedBranchId,
                  branchName: resolvedBranchName,
                  assignedBranchIds: [resolvedBranchId],
                  createdAt: cp.created_at || new Date().toISOString(),
                  updatedAt: cp.updated_at || new Date().toISOString(),
                };
              });

            dbService.setProducts(mappedProducts);
            productsCount = mappedProducts.length;
          } else {
            dbService.setProducts([]);
            productsCount = 0;
          }
        }
      } catch (err) {
        console.warn('Error fetching products from cloud:', err);
      }

      // 2. جلب العملاء customers
      let customersCount = 0;
      try {
        const { data: cloudCustomers, error: cErr } = await client.from('customers').select('*');
        if (!cErr && cloudCustomers && cloudCustomers.length > 0) {
          const mappedCustomers: Customer[] = cloudCustomers.map((cc: any) => ({
            id: String(cc.id),
            name: String(cc.name).trim(),
            phone: cc.phone ? String(cc.phone).trim() : undefined,
            currentDebt: Number(cc.current_debt ?? cc.currentDebt) || 0,
            notes: cc.notes || undefined,
            createdAt: cc.created_at || new Date().toISOString(),
            updatedAt: cc.updated_at || new Date().toISOString(),
            isSynced: true,
          }));
          dbService.mergeCloudCustomers(mappedCustomers);
          customersCount = mappedCustomers.length;
        }
      } catch (err) {
        console.warn('Error fetching customers from cloud:', err);
      }

      // 3. جلب حركات وسجل الديون debt_transactions
      let debtCount = 0;
      try {
        const { data: cloudDebt, error: dErr } = await client.from('debt_transactions').select('*');
        if (!dErr && cloudDebt && cloudDebt.length > 0) {
          const mappedDebt: DebtTransaction[] = cloudDebt.map((cd: any) => ({
            id: String(cd.id),
            customerId: String(cd.customer_id),
            customerName: cd.customer_name || undefined,
            type: cd.type || 'payment',
            amount: Number(cd.amount) || 0,
            invoiceId: cd.invoice_id || undefined,
            invoiceNumber: cd.invoice_number || undefined,
            notes: cd.notes || undefined,
            remainingBalance: Number(cd.remaining_balance ?? cd.remainingBalance) || 0,
            cashierName: cd.cashier_name || 'الكاشير',
            createdAt: cd.created_at || new Date().toISOString(),
            isSynced: true,
          }));
          mappedDebt.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          dbService.mergeCloudDebtTransactions(mappedDebt);
          debtCount = mappedDebt.length;
        }
      } catch (err) {
        console.warn('Error fetching debt transactions from cloud:', err);
      }

      // 4. جلب المبيعات sales إن وجدت
      let salesCount = 0;
      try {
        const { data: cloudSales, error: sErr } = await client.from('sales').select('*');
        if (!sErr && cloudSales && cloudSales.length > 0) {
          const mappedSales: SaleTransaction[] = cloudSales.map((cs: any, index: number) => {
            const soldAt = cs.sold_at || cs.created_at || new Date().toISOString();
            const totalAmount = Number(cs.total_amount ?? cs.net_total ?? cs.total) || 0;
            const profit = Number(cs.profit ?? cs.total_profit) || 0;
            const qty = Number(cs.quantity_sold ?? cs.quantity) || 1;
            const salePrice = Number(cs.sale_price ?? cs.price ?? (qty > 0 ? totalAmount / qty : 0)) || 0;
            const purchasePrice = Number(cs.purchase_price ?? (salePrice - (qty > 0 ? profit / qty : 0))) || 0;
            const invoiceNumber = cs.invoice_number || `INV-${cs.id || (index + 1001)}`;

            let items = [];
            if (Array.isArray(cs.items) && cs.items.length > 0) {
              items = cs.items;
            } else {
              items = [
                {
                  productId: String(cs.product_id || cs.barcode || `p-${index}`),
                  barcode: String(cs.barcode || ''),
                  productName: String(cs.product_name || cs.name || 'صنف مباع'),
                  quantity: qty,
                  purchasePrice: purchasePrice,
                  unitPrice: salePrice,
                  discount: 0,
                  total: totalAmount,
                  profit: profit,
                },
              ];
            }

            return {
              id: String(cs.id || `sale-${index}`),
              invoiceNumber: invoiceNumber,
              items: items,
              subtotal: Number(cs.subtotal ?? totalAmount) || totalAmount,
              discountTotal: Number(cs.discount_total ?? cs.discount) || 0,
              netTotal: totalAmount,
              totalProfit: profit,
              paymentMethod: (cs.payment_method as any) || 'cash',
              cashTendered: Number(cs.cash_tendered ?? totalAmount) || totalAmount,
              changeDue: Number(cs.change_due) || 0,
              cashierName: cs.cashier_name || 'الكاشير',
              customerId: cs.customer_id || undefined,
              customerName: cs.customer_name || undefined,
              branchId: cs.branch_id || undefined,
              branchName: cs.branch_name || undefined,
              status: cs.status || undefined,
              createdAt: soldAt,
              isSynced: true,
            };
          });

          // دمج بالمعرف مع حماية غير-المتزامن — لا استبدال أعمى يمحو فواتير أُبعتت أوفلاين
          mappedSales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          dbService.mergeCloudSales(mappedSales);
          salesCount = mappedSales.length;
        }
      } catch (err) {
        console.warn('Error fetching sales from cloud:', err);
      }

      // 5. جلب المرتجعات returns
      let returnsCount = 0;
      try {
        const { data: cloudReturns, error: rErr } = await client.from('returns').select('*');
        if (!rErr && cloudReturns && cloudReturns.length > 0) {
          const mappedReturns: ReturnRecord[] = cloudReturns.map((cr: any) => ({
            id: String(cr.id),
            returnNumber: cr.return_number || `RET-${cr.id}`,
            originalInvoiceNumber: cr.original_invoice_number || undefined,
            productId: String(cr.product_id || cr.barcode || ''),
            barcode: cr.barcode || '',
            productName: cr.product_name || 'صنف مسترجع',
            quantity: Number(cr.quantity) || 1,
            refundUnitPrice: Number(cr.refund_unit_price) || 0,
            refundTotal: Number(cr.refund_total) || 0,
            reason: cr.reason || 'customer_choice',
            customReasonText: cr.custom_reason_text || undefined,
            actionTaken: cr.action_taken || 'restock',
            cashierName: cr.cashier_name || 'الكاشير',
            branchId: cr.branch_id || undefined,
            branchName: cr.branch_name || undefined,
            notes: cr.notes || undefined,
            createdAt: cr.created_at || new Date().toISOString(),
            isSynced: true,
          }));

          mappedReturns.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          dbService.mergeCloudReturns(mappedReturns);
          returnsCount = mappedReturns.length;
        }
      } catch {
        // جدول المرتجعات اختياري
      }

      // 6. جلب إعدادات المتجر store_settings
      try {
        const { data: cloudSettings, error: stErr } = await client.from('store_settings').select('*').limit(1);
        if (!stErr && cloudSettings && cloudSettings.length > 0) {
          const cs = cloudSettings[0];
          const current = dbService.getSettings();
          dbService.applyCloudSettings({
            storeName: cs.store_name || current.storeName,
            storePhone: cs.store_phone || current.storePhone,
            storeAddress: cs.store_address || current.storeAddress,
            storeVatNumber: cs.store_vat_number || current.storeVatNumber,
            currency: cs.currency || current.currency,
            backupEmail: cs.backup_email || current.backupEmail,
            receiptFooterMessage: cs.receipt_footer_message || current.receiptFooterMessage,
            securityPin: cs.security_pin || current.securityPin,
            cashiers: cs.cashiers || current.cashiers,
            activeCashier: cs.active_cashier || current.activeCashier,
          });
        }
      } catch {
        // جدول store_settings اختياري
      }

      // 7. جلب سجل حركات وتدقيق المخزون stock_audit_logs
      let auditCount = 0;
      try {
        const { data: cloudAudit, error: aErr } = await client.from('stock_audit_logs').select('*').order('created_at', { ascending: false });
        if (!aErr && cloudAudit && cloudAudit.length > 0) {
          const mappedAudit: StockAuditLog[] = cloudAudit.map((ca: any) => ({
            id: String(ca.id),
            productId: String(ca.product_id || ''),
            barcode: String(ca.barcode || ''),
            productName: String(ca.product_name || 'صنف'),
            type: (ca.type as StockAuditLog['type']) || 'manual_adjustment',
            quantityDelta: Number(ca.quantity_delta) || 0,
            previousQuantity: Number(ca.previous_quantity) || 0,
            newQuantity: Number(ca.new_quantity) || 0,
            reason: ca.reason || undefined,
            performedBy: ca.performed_by || 'النظام',
            createdAt: ca.created_at || new Date().toISOString(),
          }));
          dbService.mergeCloudStockAuditLogs(mappedAudit);
          auditCount = mappedAudit.length;
        }
      } catch (err) {
        console.warn('Error fetching stock audit logs from cloud:', err);
      }

      return {
        success: true,
        productsCount,
        salesCount,
        returnsCount,
        customersCount,
        debtCount,
        auditCount,
        message: `تم جلب البيانات السحابية بنجاح! (${productsCount} منتج، ${salesCount} مبيعات، ${customersCount} عميل)`,
      };
    } catch (e: any) {
      return {
        success: false,
        productsCount: 0,
        salesCount: 0,
        returnsCount: 0,
        customersCount: 0,
        debtCount: 0,
        auditCount: 0,
        message: `خطأ في جلب البيانات: ${e?.message || e}`,
      };
    }
  }

  /**
   * كود إنشاء جداول SQL في Supabase
   */
  static getSqlSetupScript(): string {
    return `-- ==========================================================
-- كود إنشاء جداول Supabase الكاملة لماركت طيبه (مع الديون والمبيعات والمخزون)
-- ==========================================================

-- 1. جدول المنتجات والمخزون
create table if not exists public.products (
  id text primary key,
  barcode text not null unique,
  name text not null,
  category text default 'عام',
  purchase_price numeric default 0,
  sale_price numeric default 0,
  quantity numeric default 0,
  min_quantity_alert numeric default 5,
  unit text default 'حبة',
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. جدول العملاء والديون
create table if not exists public.customers (
  id text primary key,
  name text not null,
  phone text,
  current_debt numeric default 0,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. جدول حركات وسجل الديون والمدفوعات
create table if not exists public.debt_transactions (
  id text primary key,
  customer_id text not null references public.customers(id) on delete cascade,
  customer_name text,
  type text not null check (type in ('sale_credit', 'payment')),
  amount numeric not null default 0,
  invoice_id text,
  invoice_number text,
  notes text,
  remaining_balance numeric default 0,
  cashier_name text default 'الكاشير',
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. جدول المبيعات
create table if not exists public.sales (
  id text primary key,
  invoice_number text not null,
  items jsonb not null default '[]'::jsonb,
  subtotal numeric default 0,
  discount_total numeric default 0,
  net_total numeric default 0,
  total_profit numeric default 0,
  payment_method text default 'cash',
  cash_tendered numeric default 0,
  change_due numeric default 0,
  cashier_name text default 'الكاشير',
  customer_id text,
  customer_name text,
  barcode text,
  product_name text,
  quantity_sold numeric,
  purchase_price numeric,
  sale_price numeric,
  total_amount numeric,
  profit numeric,
  sold_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. جدول المرتجعات
create table if not exists public.returns (
  id text primary key,
  return_number text not null,
  original_invoice_number text,
  product_id text,
  barcode text,
  product_name text,
  quantity numeric default 1,
  refund_unit_price numeric default 0,
  refund_total numeric default 0,
  reason text,
  custom_reason_text text,
  action_taken text default 'restock',
  cashier_name text default 'الكاشير',
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. جدول إعدادات المتجر
create table if not exists public.store_settings (
  id text primary key default 'main_store_config',
  store_name text default 'ماركت طيبه',
  store_phone text default '0501234567',
  store_address text default 'ماركت طيبه - للمواد الغذائية والاستهلاكية',
  store_vat_number text default '300123456700003',
  currency text default 'TL',
  backup_email text default 'sm1173124@gmail.com',
  receipt_footer_message text default 'شكراً لزيارتكم ماركت طيبه! نسعد دائماً بخدمتكم.',
  security_pin text default '1234',
  cashiers jsonb default '["الكاشير"]'::jsonb,
  active_cashier text default 'الكاشير',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- إدخال الإعدادات الافتراضية
insert into public.store_settings (id, store_name, store_phone, store_address, currency, backup_email, security_pin, active_cashier)
values ('main_store_config', 'ماركت طيبه', '0501234567', 'ماركت طيبه - للمواد الغذائية والاستهلاكية', 'TL', 'sm1173124@gmail.com', '1234', 'الكاشير')
on conflict (id) do nothing;

-- تفعيل Realtime Replica Identity
alter table public.products replica identity full;
alter table public.customers replica identity full;
alter table public.debt_transactions replica identity full;
alter table public.sales replica identity full;
alter table public.returns replica identity full;
alter table public.store_settings replica identity full;

-- إضافة الجداول لمنشور البث الفوري Realtime Publication
alter publication supabase_realtime add table public.products, public.customers, public.debt_transactions, public.sales, public.returns, public.store_settings;

-- إنشاء الفهارس للبحث فائق السرعة
create index if not exists idx_products_barcode on public.products (barcode);
create index if not exists idx_customers_phone on public.customers (phone);
create index if not exists idx_debt_tx_customer on public.debt_transactions (customer_id);
create index if not exists idx_sales_created_at on public.sales (created_at desc);

-- سياسات الأمان والحماية (Row Level Security)
alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.debt_transactions enable row level security;
alter table public.sales enable row level security;
alter table public.returns enable row level security;
alter table public.store_settings enable row level security;

create policy "Allow full access on products" on public.products for all using (true) with check (true);
create policy "Allow full access on customers" on public.customers for all using (true) with check (true);
create policy "Allow full access on debt_transactions" on public.debt_transactions for all using (true) with check (true);
create policy "Allow full access on sales" on public.sales for all using (true) with check (true);
create policy "Allow full access on returns" on public.returns for all using (true) with check (true);
create policy "Allow full access on store_settings" on public.store_settings for all using (true) with check (true);`;
  }
}
