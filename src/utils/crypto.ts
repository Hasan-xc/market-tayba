// أداة هاش مبنية على Web Crypto API المدمجة في المتصفح (بدون مكتبات خارجية).
// البنية: sha256:<salt-hex-16>:<digest-hex-64> — ملحٌ عشوائي فريد لكل مخزون،
// فيصعب كسرها بالهجمات المسبّقة أو جداول القوس قزح حتى لأرقام قصيرة (PIN).
// ملاحظة أمنية مهمة: المصدر الأساسي لبيانات الاعتماد الحقيقية هو Supabase Auth
// (bcrypt من جهة الخادم). هذا الهاش المحلي هو طبقة أوفلاين احتياطية فقط تُستخدم
// عندما يتعذر الوصول لخدمة Auth — لا تُعد بديلاً عن bcrypt الخادمي، ولا تُستخدم
// كرافعة للصلاحيات بعد تفعيل RLS (الصلاحيات تنفّذ عبر الجلسة المصدّقة).

const PIN_PEPPER = 'taibah-pos::secure-pin::v1';
const PASSWORD_PEPPER = 'taibah-pos::secure-password::v1';

const HEX_64_RE = /^[0-9a-f]{64}$/;
// Greedy regex still matches both crypto.randomUUID() and salted formats as needed.
const SALTED_RE = /^sha256:[0-9a-f]{16}:[0-9a-f]{64}$/;

/** هل القيمة مخزّنة كهاش SHA-256 قديم (64 خانة hex بدون ملح)؟ */
export function isHashedValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && HEX_64_RE.test(value);
}

/** هل القيمة مخزّنة كهاش مملّح (sha256:<ملح>:<هاش>)؟ */
export function isSaltedHashedValue(value: string | null | undefined): value is string {
  return typeof value === 'string' && SALTED_RE.test(value);
}

/** توليد ملح عشوائي 16 خانة hex لكل مخزون */
function randomSalt(): string {
  try {
    const bytes = new Uint8Array(8);
    globalThis.crypto?.getRandomValues?.(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    // Fallback نادر (بيئة بلا Web Crypto) — للنمط القديم بلا ملح
    return '0000000000000000';
  }
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

/** هاش داخلي مملّح: sha256:<salt>:<hex> */
async function saltedHash(pepper: string, value: string, salt?: string): Promise<string> {
  const s = salt && /^[0-9a-f]{16}$/.test(salt) ? salt : randomSalt();
  const digest = await sha256Hex(`${pepper}:${s}:${(value || '').trim()}`);
  return `sha256:${s}:${digest}`;
}

/** هاش رمز الدخول: ملحٌ عشوائي فريد لكل مخزون + الثابت التطبيقي (pepper) */
export async function hashPin(pin: string): Promise<string> {
  return saltedHash(PIN_PEPPER, pin);
}

/** هاش كلمة المرور: مجال منفصل عن الـ PIN (ثابت تطبيقي مختلف) */
export async function hashPassword(password: string): Promise<string> {
  return saltedHash(PASSWORD_PEPPER, password);
}

/**
 * تحقق موحد لسر (PIN أو كلمة مرور) يدعم ثلاث صيغ مخزّنة:
 * 1) sha256:<ملح>:<هاش> — الصيغة الحديثة المملّحة.
 * 2) 64 خانة hex بلا ملح — هاش قديم من أجهزة سابقة النقل (متوافق للترقية).
 * 3) نص صريح — نافذة انتقالية قبل اكتمال الترحيل.
 */
export async function verifySecret(
  plain: string,
  stored: string | null | undefined,
  domain: 'pin' | 'password'
): Promise<boolean> {
  const s = stored || '';
  const p = (plain || '').trim();
  if (isSaltedHashedValue(s)) {
    const [, salt, digest] = s.split(':');
    const pepper = domain === 'pin' ? PIN_PEPPER : PASSWORD_PEPPER;
    const computed = await sha256Hex(`${pepper}:${salt}:${p}`);
    return computed === digest;
  }
  if (isHashedValue(s)) {
    const pepper = domain === 'pin' ? PIN_PEPPER : PASSWORD_PEPPER;
    const computed = await sha256Hex(`${pepper}:${p}`);
    return computed === s;
  }
  return p === s;
}

/** هل القيمة مخزنة بأي صيغة هاش (مملّحة أو قديمة بلا ملح)؟ — للفحوصات الترحيلية */
export function isAlreadyHashed(value: string | null | undefined): value is string {
  return isHashedValue(value) || isSaltedHashedValue(value);
}

/** هاش ثابت للمقارنة المعروفة (كلمة المرور الافتراضية) دون الاتكاء على مِلح عشوائي */
export async function hashEqualsKnown(value: string | null | undefined, known: string, domain: 'pin' | 'password' = 'password'): Promise<boolean> {
  const p = value || '';
  if (isSaltedHashedValue(p)) {
    const [, salt, digest] = p.split(':');
    const pepper = domain === 'pin' ? PIN_PEPPER : PASSWORD_PEPPER;
    const computed = await sha256Hex(`${pepper}:${salt}:${(known || '').trim()}`);
    return computed === digest;
  }
  if (isHashedValue(p)) {
    return verifySecret(known, p, domain);
  }
  return p === known;
}
