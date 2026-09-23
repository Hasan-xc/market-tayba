/*
  Service Worker لماركت طيبه برو ماكس
  الهدف: شرط التثبيت (PWA) وعمل الواجهة أوفلاين (App Shell + أصول ثابتة).
  البيانات الفعلية (فواتير/مخزون/إعدادات) تُدار أصلاً محلياً عبر localStorage
  وتتزامن مع Supabase — الـ SW لا يخزن أي بيانات عمل، فقط ملفات الواجهة.
*/

const CACHE_NAME = 'market-tayba-cache-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // الأصول الخارجية (خطوط Google وغيرها) تُترك للشبكة دون تخزين
  if (url.origin !== self.location.origin) return;

  // التنقل بين الصفحات: network-first مع الرجوع لـ index.html عند الأوفلاين
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() =>
        caches.match('./index.html').then((res) => res || caches.match('./'))
      )
    );
    return;
  }

  // باقي الأصول المحلية: cache-first ثم شبكة مع تحديث الكاش
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => new Response('', { status: 504, statusText: 'Offline' }));
    })
  );
});
