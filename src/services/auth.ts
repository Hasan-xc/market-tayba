import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { dbService } from './db';
import { SupabaseService, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY } from './supabase';

/**
 * طبقة المصادقة السحابية (Supabase Auth) — S3
 * ------------------------------------------------------------------
 * تُدير تسجيل الدخول أونلاين (signInWithPassword) مع ترحيل Just-In-Time:
 *   - عند أول دخول ناجح أونلاين لمستخدم محلي بلا حساب Auth: signUp ينشئ الحساب
 *     بنفس اسم المستخدم/كلمة المرور ثم تُحفَظ الخريطة (auth_uid) في app_users.
 *   - الجلسة مخزنة في localStorage (persistSession) عبر supabase-js.
 *   - لا يفقد أي كاشير وصوله: الدخول المحلي يبقى صالحاً دائماً؛ الأونلاين
 *     طبقة إضافية فوقه تُنفَّذ بأفضل جهد (Best-effort) بلا أي كسر.
 */

const EMAIL_DOMAIN = 'market-tayba.local';

export const syntheticEmail = (username: string): string =>
  `${String(username || '').trim().toLowerCase()}@${EMAIL_DOMAIN}`;

let authClient: SupabaseClient | null = null;

function getAuthClient(): SupabaseClient | null {
  const settings = dbService.getSettings();
  const url = (settings.supabaseUrl || DEFAULT_SUPABASE_URL).trim();
  const key = (settings.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim();
  if (!url || !key) return null;
  if (!authClient) {
    authClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: { headers: { 'x-pos-auth-mode': 's3' } },
    });
  }
  return authClient;
}

export type OnlineAttemptResult =
  | { mode: 'signin' | 'jit' | 'already-exists'; uid: string; reason?: string }
  | { mode: 'offline-only'; reason?: string }
  | { mode: 'error'; reason: string };

/** أفضل جهد لخريطة auth_uid ↔ username في app_users سحابياً (لا يعطل أي شيء) */
async function bestEffortMapAuthUid(username: string, uid: string): Promise<void> {
  try {
    const cleanUsername = String(username || '').trim().toLowerCase();
    const email = syntheticEmail(cleanUsername);
    const client = SupabaseService.getClient();
    if (client && (typeof navigator === 'undefined' || navigator.onLine)) {
      // 1) تحديث مباشر بالاسم (صفوف حقيقية موجودة مسبقاً من S2)
      const upd = await client
        .from('app_users')
        .update({ auth_uid: uid, email, updated_at: new Date().toISOString() })
        .eq('username', cleanUsername);
      const updated = !upd.error && (upd.count ?? 0) > 0;

      // 2) إن لم يوجد الصف: إدراج صريح مع id مولّد (لا نعتمد على قيد unique للاسم)
      if (!updated) {
        const probe = await client
          .from('app_users')
          .select('id')
          .eq('username', cleanUsername)
          .maybeSingle();
        if (!probe?.data?.id) {
          const current = dbService.getCurrentUser();
          await client.from('app_users').insert({
            id: crypto.randomUUID(),
            username: cleanUsername,
            email,
            display_name: current?.name || cleanUsername,
            role: current?.role || 'cashier',
            branch_id: current?.branchId || 'branch-main',
            auth_uid: uid,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }
      }
    }
  } catch (e) {
    console.warn('[auth] best-effort app_users mapping failed:', (e as any)?.message || e);
  }
  dbService.updateUserCloudMapping(username, uid);
}

/**
 * محاولة المصادقة أونلاين بأفضل جهد:
 * 1) signInWithPassword
 * 2) إن وُجدت أخطاء دخول ("Invalid login credentials" = لا حساب) → ترحيل JIT عبر signUp
 * 3) كلمة مرور أقصر من الحد الأدنى → تبقى محلية فقط (reason=password-too-short)
 */
export async function attemptOnlineLogin(
  username: string,
  password: string
): Promise<OnlineAttemptResult> {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return { mode: 'offline-only', reason: 'offline' };
  }
  const client = getAuthClient();
  if (!client) return { mode: 'offline-only', reason: 'not-configured' };

  const email = syntheticEmail(username);
  const cleanPass = String(password || '');

  try {
    const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({ email, password: cleanPass });
    if (signIn?.user) {
      await bestEffortMapAuthUid(username, signIn.user.id);
      return { mode: 'signin', uid: signIn.user.id };
    }

    const msg = String(signInErr?.message || '');
    // لا يوجد حساب بعد → ترحيل JIT
    if (/invalid login credentials|invalid_credentials|user not found|email not confirmed/i.test(msg)) {
      if (cleanPass.length < 6) {
        return { mode: 'offline-only', reason: 'password-too-short' };
      }
      const { data: up, error: upErr } = await client.auth.signUp({ email, password: cleanPass });
      if (up?.user && !upErr) {
        await bestEffortMapAuthUid(username, up.user.id);
        return { mode: 'jit', uid: up.user.id };
      }
      const upMsg = String(upErr?.message || '');
      if (/already registered|email already|user already/i.test(upMsg)) {
        // سباق: حُسب قبلنا — أعد المحاولة signIn
        const { data: retry, error: retryErr } = await client.auth.signInWithPassword({ email, password: cleanPass });
        if (retry?.user) {
          await bestEffortMapAuthUid(username, retry.user.id);
          return { mode: 'already-exists', uid: retry.user.id };
        }
        return { mode: 'offline-only', reason: `jit-retry-failed: ${retryErr?.message || ''}` };
      }
      if (/at least|minimum|password.*character|password.*length/i.test(upMsg)) {
        return { mode: 'offline-only', reason: 'password-too-short' };
      }
      return { mode: 'offline-only', reason: `jit-failed: ${upMsg}` };
    }

    if (/at least|minimum|password.*character|password.*length/i.test(msg)) {
      return { mode: 'offline-only', reason: 'password-too-short' };
    }
    return { mode: 'offline-only', reason: `signin-msg: ${msg.slice(0, 120)}` };
  } catch (e: any) {
    return { mode: 'offline-only', reason: `exception: ${(e?.message || e).toString().slice(0, 120)}` };
  }
}

/** تسجيل الخروج أونلاين (أفضل جهد) — لا يكسر الخروج المحلي أبداً */
export async function signOutOnline(): Promise<void> {
  try {
    const client = getAuthClient();
    if (client && (typeof navigator === 'undefined' || navigator.onLine)) {
      await client.auth.signOut({ scope: 'local' });
    }
  } catch (e) {
    console.warn('[auth] signOutOnline best-effort failed:', (e as any)?.message || e);
  }
}

/** حالة الجلسة المخزنة الحالية (قراءة فقط — لا يُستدعى في الحرجة) */
export async function getStoredSession(): Promise<{ accessToken?: string; uid?: string; email?: string } | null> {
  try {
    const client = getAuthClient();
    if (!client) return null;
    const { data } = await client.auth.getSession();
    if (data?.session?.user) {
      return {
        accessToken: data.session.access_token,
        uid: data.session.user.id,
        email: data.session.user.email || undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export type AppLoginResult = Awaited<ReturnType<typeof dbService.login>> & {
  cloud?: OnlineAttemptResult;
};

/**
 * تسجيل الدخول المتكامل (S3):
 * 1) التحقق المحلي أولاً (يعمل أوفلاين بلا شبكة أبداً — لا فقدان وصول).
 * 2) عند النجاح وعند توفر الإنترنت: محاولة Auth أونلاين بأفضل جهد (JIT).
 * 3) النتيجة المحلية تعود كما هي؛ ولا تجري أي كتابة تُعطّل الدخول.
 */
export async function appLogin(username: string, password: string): Promise<AppLoginResult> {
  const local = await dbService.login(username, password);
  if (!local.success || !local.user) {
    return local;
  }
  let cloud: OnlineAttemptResult = { mode: 'offline-only', reason: 'not-attempted' };
  const online = typeof navigator !== 'undefined' && navigator.onLine;
  if (online) {
    try {
      cloud = await attemptOnlineLogin(local.user.username, password);
    } catch (e) {
      console.warn('[auth] appLogin online attempt failed:', (e as any)?.message || e);
    }
  }
  return { ...local, cloud };
}