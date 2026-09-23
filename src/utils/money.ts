/**
 * تقريب مالي آمن: يلغي أخطاء الفاصلة العائمة قبل تخزين أي مبلغ مالي
 * (مثال: 0.1 + 0.2 = 0.30000000000000004 → 0.3)
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
