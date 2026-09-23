import { useState } from 'react';
import { Code2, X, Check, Copy } from 'lucide-react';
import { SupabaseService } from '../services/supabase';

interface HeaderSqlModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HeaderSqlModal = ({ isOpen, onClose }: HeaderSqlModalProps) => {
  const [isCopiedSql, setIsCopiedSql] = useState(false);

  if (!isOpen) return null;

  const sql = SupabaseService.getSqlSetupScript();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/80 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4 text-emerald-400" />
            <h3 className="font-bold text-sm">كود SQL لإنشاء جداول قاعدة بيانات Supabase</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 text-xs">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl text-emerald-800 dark:text-emerald-300 leading-relaxed">
            <strong>طريقة الاستخدام:</strong> انسخ الكود أدناه والصقه في{' '}
            <span className="font-mono font-bold text-emerald-900 dark:text-emerald-200">Supabase Dashboard → SQL Editor → New Query → Run</span>
            {' '}ليتم إنشاء وتجهيز جميع الجداول مع تفعيل المزامنة اللحظية (Realtime).
          </div>

          <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-950 text-slate-100 p-3 font-mono text-[11px] overflow-x-auto max-h-[380px] leading-normal" dir="ltr">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(sql);
                setIsCopiedSql(true);
                setTimeout(() => setIsCopiedSql(false), 2000);
              }}
              className="sticky top-0 float-right mb-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold font-['Cairo'] text-xs shadow-md transition cursor-pointer"
            >
              {isCopiedSql ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>تم النسخ بنجاح!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>نسخ الكود بالكامل</span>
                </>
              )}
            </button>
            <pre id="supabase-sql-code-block" className="whitespace-pre font-mono text-emerald-400">
              {sql}
            </pre>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 font-bold text-xs text-slate-700 dark:text-slate-200 transition cursor-pointer"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
