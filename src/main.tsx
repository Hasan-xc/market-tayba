import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { dbReady } from './services/db';
import { SupabaseService } from './services/supabase';

// الانتظار حتى اكتمال ترحيلات القيم الحساسة (هاش PIN وكلمات المرور)
// قبل تركيب التطبيق — حتى لا تقرأ شاشات الدخول قيمة غير مهاجرة أبداً.
void dbReady.then(async () => {
  void SupabaseService.attachAuthSession();
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
