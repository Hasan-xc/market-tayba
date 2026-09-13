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
