import { dbService } from './db';
import { StoreSettings } from '../types';

export interface EmailBackupResult {
  success: boolean;
  message: string;
  mailUrl?: string;
  backupPayloadSize?: string;
}

export class BackupService {
  /**
   * إعداد محتوى البريد الإلكتروني مع ملخص أسبوعي وبيانات النسخة الاحتياطية
   */
  static generateEmailContent(settings: StoreSettings) {
    const products = dbService.getProducts();
    const sales = dbService.getSales();
    const returns = dbService.getReturns();

    // حساب إحصائيات سريعة
    const totalInventoryValue = products.reduce((sum, p) => sum + p.purchasePrice * p.quantity, 0);
    const totalPotentialSales = products.reduce((sum, p) => sum + p.salePrice * p.quantity, 0);
    const lowStockItems = products.filter((p) => p.quantity <= p.minQuantityAlert);
    const totalSalesAmount = sales.reduce((sum, s) => sum + s.netTotal, 0);
    const totalProfitAmount = sales.reduce((sum, s) => sum + s.totalProfit, 0);
    const totalReturnsAmount = returns.reduce((sum, r) => sum + r.refundTotal, 0);

    const nowStr = new Date().toLocaleDateString('ar-SA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const subject = `📦 نسخة احتياطية أسبوعية - ${settings.storeName} - ${nowStr}`;
    
    const body = `السلام عليكم ورحمة الله وبركاته،

هذه النسخة الاحتياطية الدورية الخاصة بـ [${settings.storeName}].

📊 ملخص المتجر والنشاط الحالي (${nowStr}):
--------------------------------------------------
- إجمالي عدد الأصناف في المخزون: ${products.length} صنف
- قيمة المخزون الحالي (سعر الشراء): ${totalInventoryValue.toLocaleString('ar-SA')} ${settings.currency}
- القيمة البيعية المتوقعة: ${totalPotentialSales.toLocaleString('ar-SA')} ${settings.currency}
- عدد الأصناف التي أوشكت على النفاد: ${lowStockItems.length} صنف
- إجمالي عمليات البيع المسجلة: ${sales.length} فاتورة
- إجمالي المبيعات المحققة: ${totalSalesAmount.toLocaleString('ar-SA')} ${settings.currency}
- صافي الأرباح: ${totalProfitAmount.toLocaleString('ar-SA')} ${settings.currency}
- إجمالي المرتجعات: ${returns.length} عملية بقيمة (${totalReturnsAmount.toLocaleString('ar-SA')} ${settings.currency})

⚠️ أصناف قاربت على النفاد تحتاج إعادة طلب:
${lowStockItems.slice(0, 5).map(p => `• ${p.name} (المتبقي: ${p.quantity} ${p.unit || 'حبة'})`).join('\n') || 'لا توجد نواقص حالياً.'}

--------------------------------------------------
تم إرفاق وتجهيز ملف النسخة الاحتياطية الشامل لاستعادته في أي وقت بنقرة واحدة من نظام بقالتي.

مع تحيات نظام كاشير بقالتي الذكي.
`;

    return { subject, body };
  }

  /**
   * إرسال النسخة الاحتياطية عبر البريد الإلكتروني وتنزيل الملف المحلي
   */
  static sendBackupEmail(settings: StoreSettings): EmailBackupResult {
    try {
      const email = settings.backupEmail || 'sm1173124@gmail.com';
      const { subject, body } = this.generateEmailContent(settings);
      
      // تنزيل ملف JSON محلياً أيضاً
      this.downloadFullBackupFile();

      // إنشاء رابط mailto
      const mailtoUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      
      // فتح تطبيق البريد أو الرابط
      const win = window.open(mailtoUrl, '_blank');
      if (!win) {
        window.location.href = mailtoUrl;
      }

      // تحديث تاريخ آخر نسخة احتياطية
      const now = new Date().toISOString();
      dbService.saveSettings({ lastBackupDate: now });

      return {
        success: true,
        message: `تم تجهيز البريد الإلكتروني لـ (${email}) وتحميل ملف النسخة الاحتياطية لجهازك.`,
        mailUrl: mailtoUrl,
      };
    } catch (e: any) {
      return {
        success: false,
        message: 'تعذر تجهيز البريد: ' + (e.message || 'خطأ غير معروف'),
      };
    }
  }

  /**
   * تنزيل ملف JSON الكامل
   */
  static downloadFullBackupFile() {
    const jsonStr = dbService.exportFullBackupJSON();
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `backup_baqala_${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  /**
   * تنزيل ملف نصي عام (CSV أو غيره) على جهاز المستخدم
   */
  static downloadTextFile(content: string, filename: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  }

  /**
   * تنزيل ملفات CSV منفصلة للأقسام المختارة وبنطاق تاريخي اختياري.
   * sections: قائمة مفاتيح ('all' | 'sales' | 'products' | 'returns' | 'stock_audit' | 'suppliers' | 'customers' | 'valuation')
   */
  static downloadFilteredCSVs(sections: string[], dateFrom?: string, dateTo?: string): number {
    const range = { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined };
    const want = (key: string) => sections.includes('all') || sections.includes(key);
    const dateStr = new Date().toISOString().slice(0, 10);
    const jobs: { file: string; content: string }[] = [];

    if (want('sales')) jobs.push({ file: `taybah_sales_${dateStr}.csv`, content: dbService.exportSalesCSV(range) });
    if (want('products')) jobs.push({ file: `taybah_products_${dateStr}.csv`, content: dbService.exportProductsCSV(range) });
    if (want('returns')) jobs.push({ file: `taybah_returns_${dateStr}.csv`, content: dbService.exportReturnsCSV(range) });
    if (want('stock_audit')) jobs.push({ file: `taybah_stock_audit_${dateStr}.csv`, content: dbService.exportStockAuditCSV(range) });
    if (want('suppliers')) jobs.push({ file: `taybah_suppliers_${dateStr}.csv`, content: dbService.exportSuppliersCSV(range) });
    if (want('customers')) jobs.push({ file: `taybah_customers_${dateStr}.csv`, content: dbService.exportCustomersCSV(range) });
    if (want('valuation')) jobs.push({ file: `taybah_inventory_valuation_${dateStr}.csv`, content: dbService.exportInventoryValuationCSV(range) });

    jobs.forEach((j) => this.downloadTextFile(j.content, j.file, 'text/csv;charset=utf-8;'));
    return jobs.length;
  }

  /**
   * فحص إذا كانت النسخة الاحتياطية المجدولة مستحقة الآن (يومي/أسبوعي/شهري)
   * يبقى isWeeklyBackupDue أدناه كما هو للتوافق الخلفي مع الإعدادات القديمة
   */
  static isBackupDue(settings: StoreSettings): boolean {
    const enabled = settings.autoBackupEnabled ?? settings.enableAutoWeeklyEmail ?? false;
    if (!enabled) return false;
    if (!settings.lastBackupDate) return true;
    const last = new Date(settings.lastBackupDate).getTime();
    if (Number.isNaN(last)) return true;
    const freq = settings.autoBackupFrequency || 'weekly';
    const intervalDays = freq === 'daily' ? 1 : freq === 'monthly' ? 30 : 7;
    return Date.now() - last >= intervalDays * 24 * 60 * 60 * 1000;
  }

  /**
   * TODO (المسار ب — عند قرار المالك مستقبلاً): نقطة الدخول للإرسال الفعلي بالمرفقات.
   * لا يمكن إرفاق ملفات عبر mailto (قيد متصفحات) ولا توجد خلفية هنا لإرسال بريد —
   * لذلك حين يقرر المالك ربط خدمة بريد (Resend/SendGrid) تُنشأ Supabase Edge Function (Deno)
   * تُستدعى من هذا الموضع (أو تُجدول بـ pg_cron داخل Supabase مباشرة) وتمرر لها نفس
   * الأقسام المختارة ونطاق التاريخ لتولّد ملفات CSV وترسلها كمرفقات بريد فعلية حتى لو التطبيق مغلق:
   *   await fetch(`${settings.supabaseUrl}/functions/v1/backup-email`, {
   *     method: 'POST',
   *     headers: { 'Authorization': `Bearer ${settings.supabaseAnonKey}`, 'Content-Type': 'application/json' },
   *     body: JSON.stringify({ sections, dateFrom, dateTo, email: settings.backupEmail })
   *   })
   * ما دامت هذه الدالة غير موجودة يبقى المسار أ (تنزيل محلي + mailto بملخص نصي) هو المعتمد.
   */
  static checkAndRunScheduledBackup(settings: StoreSettings): EmailBackupResult | null {
    if (!this.isBackupDue(settings)) return null;
    try {
      const sections = settings.autoBackupSections && settings.autoBackupSections.length > 0 ? settings.autoBackupSections : ['all'];
      const filesCount = this.downloadFilteredCSVs(sections);

      const freqLabel = settings.autoBackupFrequency === 'daily' ? 'اليومية' : settings.autoBackupFrequency === 'monthly' ? 'الشهرية' : 'الأسبوعية';
      const email = settings.backupEmail || '';
      let mailUrl: string | undefined;
      if (email) {
        const { body } = this.generateEmailContent(settings);
        const subject = `📦 نسخة احتياطية ${freqLabel} - ${settings.storeName} - ${new Date().toLocaleDateString('ar-SA')}`;
        mailUrl = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        const win = window.open(mailUrl, '_blank');
        if (!win) {
          window.location.href = mailUrl;
        }
      }

      dbService.saveSettings({ lastBackupDate: new Date().toISOString() });

      return {
        success: true,
        message: `تم تنفيذ النسخة الاحتياطية ${freqLabel}: تنزيل ${filesCount} ملف CSV على جهازك${
          mailUrl ? ' وفتح تطبيق البريد بملخص النسخة (أرفق الملفات يدوياً — لا مرفقات تلقائية)' : ''
        }`,
        mailUrl,
      };
    } catch (e: any) {
      return {
        success: false,
        message: 'فشل تنفيذ النسخة الاحتياطية المجدولة: ' + (e.message || 'خطأ غير معروف'),
      };
    }
  }

  /**
   * فحص إذا كان قد مضى أسبوع على آخر نسخة احتياطية
   */
  static isWeeklyBackupDue(settings: StoreSettings): boolean {
    if (!settings.enableAutoWeeklyEmail) return false;
    if (!settings.lastBackupDate) return true;

    const last = new Date(settings.lastBackupDate).getTime();
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    return now - last >= sevenDaysMs;
  }
}
