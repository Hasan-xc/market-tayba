import { PauseCircle, X, ShoppingBag, Clock, PlayCircle, Trash2 } from 'lucide-react';
import { ParkedCart, StoreSettings } from '../types';

interface PosParkedCartsModalProps {
  isOpen: boolean;
  onClose: () => void;
  parkedCarts: ParkedCart[];
  settings: StoreSettings;
  onRestore: (p: ParkedCart) => void;
  onDelete: (id: string) => void;
}

export const PosParkedCartsModal = ({
  isOpen,
  onClose,
  parkedCarts,
  settings,
  onRestore,
  onDelete,
}: PosParkedCartsModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-4 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 text-white shrink-0">
          <div className="flex items-center gap-2">
            <PauseCircle className="h-4 w-4 text-amber-400" />
            <h3 className="font-bold text-sm">السلات المعلقة مؤقتاً ({parkedCarts.length})</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white cursor-pointer transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3 overflow-y-auto">
          {parkedCarts.length === 0 ? (
            <div className="py-8 text-center text-slate-400 dark:text-slate-500 text-xs">
              لا توجد سلات معلقة حالياً
            </div>
          ) : (
            parkedCarts.map((p) => {
              const heldDate = new Date(p.heldAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white text-sm">
                      <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      <span>{p.name}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {heldDate}
                      </span>
                      <span>•</span>
                      <span>الكاشير: {p.cashierName}</span>
                      <span>•</span>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                        {(p.subtotal - (p.discount || 0)).toFixed(2)} {settings.currency}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-sm">
                      {p.items.map((it) => `${it.product.name} (x${it.quantity})`).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onRestore(p)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      <span>استعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                      title="حذف السلة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};