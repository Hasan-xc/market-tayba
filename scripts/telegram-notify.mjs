#!/usr/bin/env node
// إشعار تلغرام — اتجاه واحد فقط (sendMessage) لمشروع ماركت طيبه
// ------------------------------------------------------------------
// الاستخدام:
//   node scripts/telegram-notify.mjs done "ملخص المهمة (3-5 أسطر)"
//   node scripts/telegram-notify.mjs waiting <label-فريد-للنقطة> "على أي إذن بالتحديد"
//
// القواعد:
// - يقرأ TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID من .env.local في جذر المشروع (وفق .env كاحتياط) — لا توكن في الكود.
// - لا انتظار لأي رد من تلغرام إطلاقاً — إرسال وتجاهل (fire-and-forget).
// - لا endpoint غير sendMessage (لا polling، لا webhook، لا استقبال).
// - فشل الشبكة أو غياب المفاتيح → صمت تام وخروج 0 (الإشعار ثانوي غير حرج).
// - وضع waiting لا يتكرر لنفس نقطة التوقف (تتبع بحالة محلية خارج المستودع).
// - TG_NOTIFY_VERBOSE=1 يطبع حالة الإرسال فقط (ok/fail) بدون أي سر.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const stateDir = '/data/user/0/com.foxdebug.acodefree/cache/opencode';
const stateFile = join(stateDir, 'tg-notify-state.json');

function readEnv() {
  const merged = {};
  // .env.local له الأولوية ثم .env كاحتياط
  for (const file of ['.env', '.env.local']) {
    try {
      const raw = readFileSync(join(rootDir, file), 'utf8');
      for (const line of raw.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (m && m[2] !== '') merged[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    } catch {
      // ملف غير موجود → تجاهل
    }
  }
  return merged;
}

function alreadySent(label) {
  try {
    const state = JSON.parse(readFileSync(stateFile, 'utf8'));
    if (state[label]) return true;
    state[label] = Date.now();
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(stateFile, JSON.stringify(state));
    return false;
  } catch {
    return false;
  }
}

async function send(text, dedupeLabel) {
  try {
    if (dedupeLabel && alreadySent(dedupeLabel)) {
      if (process.env.TG_NOTIFY_VERBOSE === '1') console.log('telegram: skipped (duplicate waiting point)');
      return;
    }
    const env = readEnv();
    const token = env.TELEGRAM_BOT_TOKEN;
    const chatId = env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) {
      if (process.env.TG_NOTIFY_VERBOSE === '1') console.log('telegram: no keys, skipped');
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (process.env.TG_NOTIFY_VERBOSE === '1') console.log(res.ok ? 'telegram: sent ok' : `telegram: http ${res.status} (ignored)`);
  } catch {
    if (process.env.TG_NOTIFY_VERBOSE === '1') console.log('telegram: send failed (ignored)');
  }
  process.exit(0);
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  if (mode === 'done') {
    const text = rest.join(' ').trim();
    if (text) await send(`✅ اكتملت المهمة بنجاح\n\n${text}`);
  } else if (mode === 'waiting') {
    const [label, ...detail] = rest;
    const text = (detail || []).join(' ').trim();
    if (label && text) await send(`⏳ الوكيل متوقف وينتظر موافقتك في المحادثة.\n${text}`, label);
  }
  process.exit(0);
}

void main();
