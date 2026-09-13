/**
 * دوال معالجة وبحث النصوص العربية والباركود الذكية
 * معالجة التشكيل، توحيد الألفات والهمزات والحروف الفارسية/الأردية، والأرقام المشرقية
 */

/**
 * تحويل الأرقام العربية والمشرقية والفارسية إلى أرقام قياسية (0-9)
 */
export function normalizeDigits(text: string): string {
  if (!text) return '';
  const arabicEasternDigits: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
    '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
    '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return text.replace(/[٠-٩۰-۹]/g, (char) => arabicEasternDigits[char] || char);
}

/**
 * توحيد الحروف العربية وإزالة التشكيل والرموز لضمان مطابقة فورية ومرنة
 */
export function normalizeArabicText(text: string): string {
  if (!text) return '';
  
  let normalized = text.toString().toLowerCase();

  // 1. تحويل الأرقام المشرقية والفارسية
  normalized = normalizeDigits(normalized);

  // 2. إزالة التشكيل والحركات والتنوين والشدة والتطويل
  normalized = normalized
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    // توحيد الألفات (أ ، إ ، آ ، ٱ ، ٲ ، ٳ -> ا)
    .replace(/[أإآٱٲٳ]/g, 'ا')
    // توحيد التاء المربوطة والهاء (ة -> ه)
    .replace(/ة/g, 'ه')
    // توحيد الياء والألف المقصورة (ى ، ئ -> ي)
    .replace(/[ىئ]/g, 'ي')
    // توحيد الواو المهموزة (ؤ -> و)
    .replace(/ؤ/g, 'و')
    // معالجة الحروف الفارسية والأردية المشتركة في أسماء المنتجات
    .replace(/[گګک]/g, 'ك')
    .replace(/چ/g, 'ج')
    .replace(/پ/g, 'ب')
    .replace(/ژ/g, 'ز')
    .replace(/ڤ/g, 'ف')
    // إزالة الرموز الزائدة
    .replace(/[_\-./\\,+()#]/g, ' ')
    // توحيد المسافات
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * فحص مطابقة ذكية للمنتج بناءً على الاسم أو الباركود أو التصنيف
 * تدعم البحث من أول حرف أو حرفين أو كلمات متعددة
 */
export function matchProductSearch(
  product: { name?: string; barcode?: string; category?: string },
  query: string
): boolean {
  if (!query || !query.trim()) return true;

  const rawQuery = query.trim();
  const digitQuery = normalizeDigits(rawQuery);
  const normQuery = normalizeArabicText(rawQuery);

  if (!normQuery && !digitQuery) return true;

  // 1. فحص الباركود (مطابقة مباشرة أو بالبادئة أو بالأرقام المحولة)
  if (product.barcode) {
    const rawBarcode = product.barcode.trim();
    const normBarcode = normalizeDigits(rawBarcode);
    if (
      rawBarcode.toLowerCase().includes(rawQuery.toLowerCase()) ||
      normBarcode.includes(digitQuery) ||
      rawBarcode.includes(digitQuery)
    ) {
      return true;
    }
  }

  const normName = normalizeArabicText(product.name || '');
  const normCategory = normalizeArabicText(product.category || '');

  // 2. فحص مطابقة مباشرة للاستعلام في الاسم أو الفئة (حتى لحرف أو حرفين)
  if (normName.includes(normQuery) || normCategory.includes(normQuery)) {
    return true;
  }

  // 3. تقسيم كلمات البحث (في حال كتابة أكثر من كلمة مثل "حليب نادك كامل الدسم")
  const queryTokens = normQuery.split(/\s+/).filter(Boolean);
  if (queryTokens.length > 1) {
    const allTokensMatch = queryTokens.every(
      (token) => normName.includes(token) || normCategory.includes(token)
    );
    if (allTokensMatch) return true;
  }

  return false;
}
