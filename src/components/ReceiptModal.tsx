import { useState, useEffect } from 'react';
import { Printer, X, Check, Copy, Store, ShoppingBag, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { SaleTransaction, StoreSettings } from '../types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  sale: SaleTransaction | null;
  settings: StoreSettings;
  onNewSale?: () => void;
}

/**
 * دالة توليد مصفوفة TLV لهيئة الزكاة والضريبة والجمارك أو الفوترة الإلكترونية القياسية
 */
function generateTLV(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

function generateZatcaQrPayload(sellerName: string, vatNumber: string, timeStamp: string, totalAmount: string, vatAmount: string): string {
  try {
    const tlv1 = generateTLV(1, sellerName);
    const tlv2 = generateTLV(2, vatNumber || '000000000000000');
    const tlv3 = generateTLV(3, timeStamp);
    const tlv4 = generateTLV(4, totalAmount);
    const tlv5 = generateTLV(5, vatAmount);

    const combinedLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
    const combined = new Uint8Array(combinedLength);
    let offset = 0;

    [tlv1, tlv2, tlv3, tlv4, tlv5].forEach((tlv) => {
      combined.set(tlv, offset);
      offset += tlv.length;
    });

    let binary = '';
    for (let i = 0; i < combined.byteLength; i++) {
      binary += String.fromCharCode(combined[i]);
    }
    return btoa(binary);
  } catch {
    return `${sellerName}|${vatNumber}|${timeStamp}|${totalAmount}|${vatAmount}`;
  }
}

export const ReceiptModal = ({ isOpen, onClose, sale, settings, onNewSale }: Props) => {
  const [isCopied, setIsCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  useEffect(() => {
    if (isOpen && sale) {
      const seller = settings.storeName || 'ماركت طيبه';
      const vatNum = settings.storeVatNumber || '300123456700003';
      const timeStr = new Date(sale.createdAt).toISOString();
      const total = sale.netTotal.toFixed(2);
      const vat = ((sale.netTotal * (settings.taxRate || 0)) / 100).toFixed(2);

      const qrPayload = generateZatcaQrPayload(seller, vatNum, timeStr, total, vat);

      QRCode.toDataURL(qrPayload, {
        width: 140,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {
          // fallback qr code with plain text
          QRCode.toDataURL(`فاتورة: ${sale.invoiceNumber} | الإجمالي: ${total} ${settings.currency}`, { width: 140, margin: 1 })
            .then((url) => setQrDataUrl(url))
            .catch(() => {});
        });
    }
  }, [isOpen, sale, settings]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleCopyText = () => {
    const lines = [
      `🧾 ${settings.storeName}`,
      `هاتف: ${settings.storePhone}`,
      `رقم الفاتورة: ${sale.invoiceNumber}`,
      `التاريخ: ${new Date(sale.createdAt).toLocaleString('ar-SA')}`,
      `الكاشير: ${sale.cashierName}`,
      '--------------------------------',
      ...sale.items.map(
        (it) => `${it.productName}\n  ${it.quantity} × ${it.unitPrice.toFixed(2)} = ${it.total.toFixed(2)} ${settings.currency}`
      ),
      '--------------------------------',
      `المجموع: ${sale.subtotal.toFixed(2)} ${settings.currency}`,
      sale.discountTotal > 0 ? `الخصم: -${sale.discountTotal.toFixed(2)} ${settings.currency}` : '',
      `الصافي: ${sale.netTotal.toFixed(2)} ${settings.currency}`,
      `طريقة الدفع: ${sale.paymentMethod === 'cash' ? 'نقدي' : sale.paymentMethod === 'card' ? 'شبكة / مدى' : sale.paymentMethod === 'credit' ? 'آجل / على الحساب' : sale.paymentMethod === 'split' ? 'دفع مزدوج' : 'تحويل بنكي'}`,
      sale.customerName ? `العميل: ${sale.customerName}` : '',
      sale.paymentMethod === 'cash' && sale.cashTendered > 0 ? `المدفوع: ${sale.cashTendered.toFixed(2)} ${settings.currency}\nالمتبقي: ${sale.changeDue.toFixed(2)} ${settings.currency}` : '',
      '--------------------------------',
      settings.receiptFooterMessage,
    ].filter(Boolean);

    navigator.clipboard.writeText(lines.join('\n'));
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const formattedDate = new Date(sale.createdAt).toLocaleString('ar-SA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return (
    <div id="receiptModal" className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-3 sm:p-4 sm:pt-6 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      {/* Container */}
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-white dark:bg-slate-900 shadow-2xl border border-slate-200 dark:border-slate-800 max-h-[92vh] flex flex-col mt-1 sm:mt-2 font-['Cairo',sans-serif]">
        {/* Actions Bar (Top) */}
        <div className="no-print flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-4 py-3 shrink-0">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            تم إتمام البيع بنجاح
          </span>
          <button
            id="closeReceiptBtn"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Printable Thermal Receipt */}
        <div id="thermalReceiptContent" className="p-5 text-slate-900 bg-white font-mono text-xs leading-relaxed select-text overflow-y-auto max-h-[calc(92vh-120px)]">
          {/* Store Header */}
          <div className="text-center pb-3 border-b border-dashed border-slate-300">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-700 text-white mb-2 shadow-xs">
              <Store className="h-5 w-5" />
            </div>
            <h2 className="font-bold text-base text-slate-900 font-['Cairo']">{settings.storeName}</h2>
            <p className="text-[11px] text-slate-500 font-sans mt-0.5">{settings.storeAddress}</p>
            <p className="text-[11px] text-slate-500 font-sans">هاتف: {settings.storePhone}</p>
            {settings.storeVatNumber && (
              <p className="text-[10px] text-slate-500 font-sans">الرقم الضريبي: {settings.storeVatNumber}</p>
            )}
          </div>

          {/* Invoice Meta */}
          <div className="py-2.5 border-b border-dashed border-slate-300 text-[11px] space-y-1 font-sans">
            <div className="flex justify-between">
              <span className="text-slate-500">رقم الفاتورة:</span>
              <span className="font-bold font-mono text-slate-900">{sale.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">التاريخ والوقت:</span>
              <span className="font-mono text-slate-700">{formattedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">الكاشير:</span>
              <span className="font-medium text-slate-800">{sale.cashierName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">طريقة الدفع:</span>
              <span className="font-medium text-slate-800">
                {sale.paymentMethod === 'cash' ? '💵 نقدي' : sale.paymentMethod === 'card' ? '💳 شبكة / مدى' : sale.paymentMethod === 'credit' ? '📝 آجل / على الحساب' : sale.paymentMethod === 'split' ? '💰 دفع مزدوج' : '🏦 تحويل بنكي'}
              </span>
            </div>
            {sale.customerName && (
              <div className="flex justify-between text-emerald-800 font-bold">
                <span className="text-slate-500 font-normal">العميل المدين:</span>
                <span>{sale.customerName}</span>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="py-3 border-b border-dashed border-slate-300">
            <table className="w-full text-right text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 font-sans">
                  <th className="pb-1 text-right">الصنف</th>
                  <th className="pb-1 text-center">الكمية</th>
                  <th className="pb-1 text-left">الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sale.items.map((item, idx) => (
                  <tr key={idx} className="py-1">
                    <td className="py-1.5 font-sans font-medium text-slate-800 pr-0.5">
                      <div>{item.productName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {item.quantity} × {item.unitPrice.toFixed(2)} {settings.currency}
                      </div>
                    </td>
                    <td className="py-1.5 text-center font-mono font-bold text-slate-700">{item.quantity}</td>
                    <td className="py-1.5 text-left font-mono font-bold text-slate-900">
                      {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1.5 text-[11px] font-sans">
            <div className="flex justify-between text-slate-600">
              <span>المجموع الفرعي ({sale.items.length} صنف):</span>
              <span className="font-mono font-bold">{sale.subtotal.toFixed(2)} {settings.currency}</span>
            </div>

            {sale.discountTotal > 0 && (
              <div className="flex justify-between text-rose-600 font-semibold">
                <span>الخصم:</span>
                <span className="font-mono">-{sale.discountTotal.toFixed(2)} {settings.currency}</span>
              </div>
            )}

            <div className="flex justify-between items-baseline pt-1 border-t border-slate-200 font-bold text-sm text-slate-900 font-['Cairo']">
              <span>الإجمالي الصافي:</span>
              <span className="text-base text-emerald-800 font-mono font-black">
                {sale.netTotal.toFixed(2)} {settings.currency}
              </span>
            </div>

            {sale.paymentMethod === 'cash' && sale.cashTendered > 0 && (
              <>
                <div className="flex justify-between text-slate-500 pt-1 text-[10px]">
                  <span>المبلغ المستلم:</span>
                  <span className="font-mono">{sale.cashTendered.toFixed(2)} {settings.currency}</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-bold text-[11px]">
                  <span>المتبقي للعميل (الباقي):</span>
                  <span className="font-mono">{sale.changeDue.toFixed(2)} {settings.currency}</span>
                </div>
              </>
            )}
          </div>

          {/* QR Code (ZATCA / E-Invoice Standard QR Code) */}
          <div className="pt-3 pb-1 text-center flex flex-col items-center justify-center border-b border-dashed border-slate-300">
            {qrDataUrl ? (
              <div className="bg-white p-1.5 rounded-lg border border-slate-200 inline-block shadow-xs">
                <img src={qrDataUrl} alt="Receipt QR Code" className="w-28 h-28 object-contain mx-auto" />
              </div>
            ) : (
              <div className="w-24 h-24 border border-dashed border-slate-300 flex items-center justify-center rounded-lg text-slate-400">
                <QrCode className="h-8 w-8 text-slate-300" />
              </div>
            )}
            <p className="text-[10px] text-slate-500 mt-1 font-sans">امسح رمز الاستجابة السريعة للتحقق من الفاتورة</p>
          </div>

          {/* Barcode & Footer */}
          <div className="pt-2 text-center space-y-1.5">
            <p className="text-[10px] font-mono tracking-widest text-slate-600 font-bold">{sale.invoiceNumber}</p>
            <p className="text-[10px] text-slate-500 font-sans leading-normal px-2">
              {settings.receiptFooterMessage}
            </p>
          </div>
        </div>

        {/* Action Buttons (Bottom) */}
        <div className="no-print p-3.5 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            id="printReceiptActionBtn"
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 py-2.5 text-sm font-bold text-white shadow-md shadow-emerald-700/20 active:scale-[0.99] transition cursor-pointer"
          >
            <Printer className="h-4 w-4" />
            <span>طباعة الإيصال الفوري</span>
          </button>

          <div className="flex gap-2">
            <button
              id="copyReceiptActionBtn"
              onClick={handleCopyText}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
              <span>{isCopied ? 'تم النسخ' : 'نسخ النص'}</span>
            </button>

            {onNewSale && (
              <button
                id="newSaleActionBtn"
                onClick={() => {
                  onClose();
                  onNewSale();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                <span>فاتورة جديدة</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
