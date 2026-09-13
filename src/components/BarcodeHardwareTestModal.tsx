import React, { useState, useEffect } from 'react';
import { 
  Barcode as BarcodeIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Zap, 
  Clock, 
  Cpu, 
  RotateCcw,
  Volume2,
  Package
} from 'lucide-react';
import { hardwareScanner } from '../utils/hardwareScanner';
import { Product } from '../types';
import { SoundService } from '../utils/audio';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  onSelectProduct?: (product: Product) => void;
}

interface ScanTestResult {
  barcode: string;
  latencyMs: number;
  charCount: number;
  timestamp: string;
  matchedProduct: Product | null;
}

export const BarcodeHardwareTestModal: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  onSelectProduct,
}) => {
  const [recentScans, setRecentScans] = useState<ScanTestResult[]>([]);
  const [liveKeystrokes, setLiveKeystrokes] = useState<{ char: string; delta: number }[]>([]);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    // Listen to full barcode scans
    const unsubScan = hardwareScanner.subscribe((barcode, stats) => {
      const matched = products.find((p) => p.barcode === barcode) || null;
      SoundService.playScanSuccess();
      setLastScannedBarcode(barcode);

      setRecentScans((prev) => [
        {
          barcode,
          latencyMs: stats.latencyMs,
          charCount: stats.charCount,
          timestamp: new Date().toLocaleTimeString('ar-SA'),
          matchedProduct: matched,
        },
        ...prev.slice(0, 9),
      ]);
    });

    // Listen to raw live keystroke events
    const unsubKeys = hardwareScanner.subscribeTestEvents((ev) => {
      setLiveKeystrokes((prev) => [{ char: ev.char, delta: Math.round(ev.delta) }, ...prev.slice(0, 14)]);
    });

    return () => {
      unsubScan();
      unsubKeys();
    };
  }, [isOpen, products]);

  if (!isOpen) return null;

  const handleTestManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    hardwareScanner.simulateScan(manualInput.trim());
    setManualInput('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">أداة فحص واختبار أجهزة الباركود الليزرية (HID Scanner)</h3>
              <p className="text-xs text-slate-400">فحص زمن الاستجابة، دقة القراءة، والتوافق مع قارئات USB واللاسلكية</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Status Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="font-bold">المستمع العام نشط: قم بتوجيه قارئ الباركود نحو أي منتج واضغط الزناد الآن</span>
            </div>
            <span className="font-mono text-[11px] bg-emerald-900/60 px-2 py-0.5 rounded text-emerald-200">
              Ready
            </span>
          </div>

          {/* Test Input & Simulation */}
          <form onSubmit={handleTestManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="أو اكتب/الصق باركود تجريبي واضغط Enter..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="flex-1 bg-slate-800/90 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 font-mono"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <Zap className="h-4 w-4" />
              <span>محاكاة مسح</span>
            </button>
          </form>

          {/* Live Keystroke Monitor */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-sky-400" />
                سجل تدفق الأحرف الفوري (Live Raw Keystroke Feed):
              </span>
              <span className="font-mono text-[10px]">Inter-key interval (ms)</span>
            </div>

            {liveKeystrokes.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-2 text-center">
                بانتظار وصول نبضات من قارئ الباركود...
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {liveKeystrokes.map((k, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 font-mono text-xs"
                  >
                    <span className="text-emerald-400 font-bold font-sans">{k.char}</span>
                    <span className="text-[10px] text-slate-400">({k.delta}ms)</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Scans Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span className="flex items-center gap-1.5">
                <BarcodeIcon className="h-4 w-4 text-emerald-400" />
                نتائج القراءات المسجلة ({recentScans.length}):
              </span>
              {recentScans.length > 0 && (
                <button
                  onClick={() => setRecentScans([])}
                  className="text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>تفريغ السجل</span>
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {recentScans.length === 0 ? (
                <div className="p-8 text-center bg-slate-800/30 rounded-xl border border-dashed border-slate-700/60 text-slate-400 text-xs">
                  لم يتم رصد أي عمليات مسح بعد. وجّه القارئ واضغط الزناد.
                </div>
              ) : (
                recentScans.map((scan, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 text-xs hover:border-slate-600 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-emerald-400 font-mono font-bold text-xs">
                        #{recentScans.length - i}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-white text-sm tracking-wider">
                            {scan.barcode}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({scan.charCount} حرف)
                          </span>
                        </div>
                        {scan.matchedProduct ? (
                          <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px] mt-0.5">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{scan.matchedProduct.name}</span>
                            <span className="text-slate-400">• الكمية: {scan.matchedProduct.quantity}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-400 font-medium text-[11px] mt-0.5">
                            <AlertCircle className="h-3 w-3" />
                            <span>غير مسجل في المخزون (صنف جديد)</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="text-left font-mono">
                      <div className="text-[11px] font-bold text-sky-400">
                        ⚡ {scan.latencyMs} ms
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {scan.timestamp}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-950/70 flex items-center justify-between text-xs text-slate-400">
          <span>نصيحة: تأكد من ضبط قارئ الباركود على وضع الإرسال مع زر Enter (CR/LF Suffix).</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold transition cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
