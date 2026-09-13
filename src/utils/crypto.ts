// أداة هاش بسيطة مبنية على Web Crypto API المدمجة في المتصفح (بدون مكتبات خارجية).
// ملاحظة أمنية: SHA-256 مع ثابت تطبيقي (pepper) هو تخفيف للمشكلة وليس حلاً كاملاً —
// يمنع تخزين القيم كنص صريح ويمنع جداول القوس قزح الجاهزة، لكنه لا يغني عن
// حماية RLS/الصلاحيات المؤجلة، ولا يقاوم التخمين القوي إذا تسرّب الهاش نفسه
// (خاصة لأرقام قصيرة مثل PIN من 4 خانات).

const PIN_PEPPER = 'taibah-pos::secure-pin::v1';
const PASSWORD_PEPPER = 'taibah-pos::secure-password::v1';

const HEX_64_RE = /^[0-9a-f]{64}$/;

/** هل القيمة مخزنة كهاش SHA-256 (64 خانة hex)؟ */
export function isHashedValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_64_RE.test(value);
}

/** حساب SHA-256 لأي نص وإرجاعه كـ hex */
export async function sha256Hex(input: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error('Web Crypto API غير متوفرة في هذه البيئة');
  }
  const data = new TextEncoder().encode(input);
  const digest = await subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** هاش رمز الدخول: يُطبق دائماً مع الثابت التطبيقي قبل التحويل */
export async function hashPin(pin: string): Promise<string> {
  return sha256Hex(`${PIN_PEPPER}:${(pin || '').trim()}`);
}

/** هاش كلمة المرور: مجال منفصل عن الـ PIN (ثابت تطبيقي مختلف) */
export async function hashPassword(password: string): Promise<string> {
  return sha256Hex(`${PASSWORD_PEPPER}:${(password || '').trim()}`);
}

/**
 * تحقق موحد لسر (PIN أو كلمة مرور):
 * - القيمة المخزنة هاش: نقارن هاش المدخل بها.
 * - القيمة المخزنة نص صريح (نافذة انتقالية قبل اكتمال الترحيل): مقارنة مباشرة
 *   حتى يظل الدخول يعمل بنفس البيانات القديمة شفافاً.
 */
export async function verifySecret(
  plain: string,
  stored: string | null | undefined,
  domain: 'pin' | 'password'
): Promise<boolean> {
  const s = stored || '';
  const p = (plain || '').trim();
  if (isHashedValue(s)) {
    const h = domain === 'pin' ? await hashPin(p) : await hashPassword(p);
    return h === s;
  }
  return p === s;
}
