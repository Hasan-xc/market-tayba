import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { dbReady } from './services/db';
import { SupabaseService } from './services/supabase';

// تسجيل Service Worker — هدفه شرط التثبيت (PWA) وعمل الواجهة أوفلاين فقط،
// البيانات الفعلية تُدار محلياً عبر localStorage وتتزامن مع Supabase ولا يلمسها الـ SW.
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js')
      .catch((err) => console.warn('Service Worker registration failed:', err));
  });
}

// الانتظار حتى اكتمال ترحيلات القيم الحساسة (هاش PIN وكلمات المرور)
// قبل تركيب التطبيق — حتى لا تقرأ شاشات الدخول قيمة غير مهاجرة أبداً.
void dbReady.then(async () => {
  void SupabaseService.attachAuthSession();
  registerServiceWorker();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
