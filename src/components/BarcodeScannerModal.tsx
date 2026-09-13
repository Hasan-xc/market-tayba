import { useEffect, useRef, useState, useCallback, type FormEvent, type ChangeEvent } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import {
  Camera,
  X,
  Zap,
  RotateCw,
  Image as ImageIcon,
  AlertTriangle,
  Check,
  RefreshCw,
  Barcode,
  Sparkles,
  CheckCircle2,
  Layers,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
  autoCloseOnScan?: boolean;
  subtitle?: string;
}

// قائمة صيغ الباركود المدعومة
const SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.CODABAR,
];

// صيغ الباركود للـ Native BarcodeDetector
const NATIVE_FORMATS = [
  'ean_13',
  'ean_8',
  'code_128',
  'code_39',
  'upc_a',
  'upc_e',
  'qr_code',
  'itf',
  'codabar',
];

export const BarcodeScannerModal = ({
  isOpen,
  onClose,
  onScan,
  title = 'ماسح الباركود السريع',
  autoCloseOnScan = false,
  subtitle,
}: Props) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [manualInput, setManualInput] = useState('');
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scannedCount, setScannedCount] = useState(0);
  const [recentScans, setRecentScans] = useState<string[]>([]);
  const [engineType, setEngineType] = useState<'native' | 'html5' | 'ready'>('ready');
  const [isFileScanning, setIsFileScanning] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const html5ScannerRef = useRef<Html5Qrcode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const isCooldownRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isMountedRef = useRef(false);

  const html5ContainerId = 'html5-fallback-container';

  /**
   * تشغيل صوت تنبيه ناعم (Beep sound) عبر Web Audio API
   */
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(2400, ctx.currentTime);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio non-blocking
    }
  };

  /**
   * إيقاف وتنظيف جميع مسارات الفيديو والمحركات بالكامل عند إغلاق النافذة
   */
  const stopAllStreamsAndEngines = useCallback(async () => {
    // 1. إلغاء حلقة الرسوم المتحركة
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // 2. إيقاف تيار الكاميرا المباشر
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {}
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // 3. إيقاف محرك Html5Qrcode إن وُجد
    if (html5ScannerRef.current) {
      try {
        if (html5ScannerRef.current.isScanning) {
          await html5ScannerRef.current.stop();
        }
        await html5ScannerRef.current.clear();
      } catch (err) {
        console.warn('Html5Qrcode cleanup notice:', err);
      }
      html5ScannerRef.current = null;
    }

    setIsScanning(false);
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  /**
   * إغلاق النافذة عند الضغط على زر X أو تم الانتهاء أو بعد المسح لمرة واحدة
   */
  const handleCloseModal = useCallback(() => {
    stopAllStreamsAndEngines().finally(() => {
      onClose();
    });
  }, [stopAllStreamsAndEngines, onClose]);

  /**
   * معالجة نجاح قراءة الباركود:
   * - إذا كان autoCloseOnScan مفعل (مثل إضافة منتج أو مرتجع): يرسل الباركود ويغلق الكاميرا فوراً
   * - إذا كان غير مفعل (مثل صفحة البيع POS): يبقى في وضع المسح المستمر لمسح الأصناف التالية
   */
  const handleSuccess = useCallback(
    (barcode: string) => {
      const clean = barcode.trim();
      if (!clean || isCooldownRef.current) return;

      // تفعيل التهدئة لمنع القراءات المتكررة للقطعة الواحدة
      isCooldownRef.current = true;
      setLastScannedCode(clean);
      setScannedCount((prev) => prev + 1);
      setRecentScans((prev) => [clean, ...prev.slice(0, 4)]);
      playBeep();

      // اهتزاز الهاتف للتأكيد
      if (navigator.vibrate) {
        try {
          navigator.vibrate([80, 40, 80]);
        } catch {}
      }

      // إرسال الباركود فوراً
      onScan(clean);

      // في حال وضع المسح لمرة واحدة (مثل إضافة منتج): إغلاق الكاميرا والنافذة فوراً
      if (autoCloseOnScan) {
        setTimeout(() => {
          handleCloseModal();
        }, 220);
        return;
      }

      // في حال المسح المستمر (صفحة البيع): إعادة تمكين المسح للقطعة التالية بعد مهلة قصيرة
      setTimeout(() => {
        if (isMountedRef.current) {
          isCooldownRef.current = false;
          setLastScannedCode(null);
        }
      }, 800);
    },
    [onScan, autoCloseOnScan, handleCloseModal]
  );

  /**
   * تشغيل المحرك الأساسي: فتح الكاميرا وربطها مع BarcodeDetector الأصلي
   */
  const startCamera = useCallback(async () => {
    setErrorMessage(null);
    setIsStarting(true);
    setLastScannedCode(null);
    isCooldownRef.current = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('متصفحك أو هذا الجهاز لا يدعم الوصول المباشر لكاميرا الويب.');
      setIsStarting(false);
      return;
    }

    try {
      await stopAllStreamsAndEngines();
      await new Promise((r) => setTimeout(r, 100));

      // فتح تيار الكاميرا بالمواصفات المثالية
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      // فحص دعم الفلاش على المسار
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = (track.getCapabilities && (track.getCapabilities() as any)) || {};
          setHasTorch(Boolean(capabilities.torch));
        } catch {
          setHasTorch(false);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('muted', 'true');
        await videoRef.current.play().catch((e) => console.warn('Video play notice:', e));
      }

      if (!isMountedRef.current) return;

      setIsScanning(true);
      setIsStarting(false);

      // فحص توفر BarcodeDetector المسرّع عتادياً
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (BarcodeDetectorClass) {
        try {
          const detector = new BarcodeDetectorClass({ formats: NATIVE_FORMATS });
          setEngineType('native');

          const detectFrame = async () => {
            if (!isMountedRef.current || !videoRef.current) {
              return;
            }

            if (videoRef.current.readyState >= 2 && !isCooldownRef.current) {
              try {
                const barcodes = await detector.detect(videoRef.current);
                if (barcodes && barcodes.length > 0) {
                  const rawValue = barcodes[0].rawValue;
                  if (rawValue) {
                    handleSuccess(rawValue);
                  }
                }
              } catch {
                // Ignore individual frame detection error
              }
            }

            // الاستمرار دائماً في الحلقة لمسح المنتجات التالية بسلاسة
            animationFrameRef.current = requestAnimationFrame(detectFrame);
          };

          animationFrameRef.current = requestAnimationFrame(detectFrame);
          return;
        } catch (e) {
          console.warn('Native BarcodeDetector init failed, using fallback:', e);
        }
      }

      // محرك الاحتياط (Fallback Engine) عبر Html5Qrcode
      setEngineType('html5');
      const fallbackScanner = new Html5Qrcode(html5ContainerId, {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });
      html5ScannerRef.current = fallbackScanner;

      await fallbackScanner.start(
        { facingMode },
        {
          fps: 20,
          qrbox: (w, h) => {
            const minDim = Math.min(w, h);
            return {
              width: Math.floor(minDim * 0.8),
              height: Math.floor(Math.min(h * 0.5, 180)),
            };
          },
          aspectRatio: 1.333,
        },
        (decodedText) => handleSuccess(decodedText),
        () => {}
      );
    } catch (err: any) {
      console.error('Camera stream initialization failed:', err);
      if (isMountedRef.current) {
        setIsStarting(false);
        setIsScanning(false);

        const name = err?.name || '';
        const msg = String(err?.message || err || '');

        if (name === 'NotAllowedError' || /permission/i.test(msg) || /denied/i.test(msg)) {
          setErrorMessage(
            'تم حظر إذن الكاميرا. يرجى النقر على إعدادات الموقع أو أيقونة القفل في شريط المتصفح وتفعيل الكاميرا.'
          );
        } else if (name === 'NotFoundError' || /no camera|not found/i.test(msg)) {
          setErrorMessage('لم يتم العثور على كاميرا متصلة بهذا الجهاز.');
        } else if (name === 'NotReadableError' || /in use|video source/i.test(msg)) {
          setErrorMessage('الكاميرا قيد الاستخدام بواسطة تطبيق آخر أو صفحة أخرى.');
        } else {
          setErrorMessage('تعذر تشغيل الكاميرا. تأكد من عمل الموقع عبر HTTPS ومنح الأذونات.');
        }
      }
    }
  }, [facingMode, handleSuccess, stopAllStreamsAndEngines]);

  /**
   * تبديل الفلاش (Torch)
   */
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;

    try {
      const next = !isTorchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: next }],
      });
      setIsTorchOn(next);
    } catch (e) {
      console.warn('Torch apply error:', e);
    }
  };

  /**
   * قلب الكاميرا (تبديل الكاميرا الخلفية / الأمامية)
   */
  const flipCamera = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  /**
   * مسح الباركود من صورة مخزنة على الجهاز (Image file scanner)
   */
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileScanning(true);
    setErrorMessage(null);

    try {
      const tempScanner = new Html5Qrcode('file-scanner-temp-node', {
        formatsToSupport: SUPPORTED_FORMATS,
        verbose: false,
      });

      const result = await tempScanner.scanFile(file, true);
      if (result) {
        handleSuccess(result);
      }
    } catch (err: any) {
      console.warn('Image file barcode scanning failed:', err);
      setErrorMessage('لم يتم العثور على باركود واضح في هذه الصورة. يرجى تجربة صورة أوضح.');
    } finally {
      setIsFileScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  /**
   * الإدخال اليدوي السريع مع إبقاء الكاميرا مفتوحة لمسح الباقي
   */
  const handleManualSubmit = (e: FormEvent) => {
    e.preventDefault();
    const clean = manualInput.trim();
    if (clean) {
      handleSuccess(clean);
      setManualInput('');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (isOpen) {
      setScannedCount(0);
      setRecentScans([]);
      const timer = setTimeout(() => {
        startCamera();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      stopAllStreamsAndEngines();
    }
    return () => {
      isMountedRef.current = false;
      stopAllStreamsAndEngines();
    };
  }, [isOpen, facingMode, startCamera, stopAllStreamsAndEngines]);

  if (!isOpen) return null;

  return (
    <div
      id="barcodeScannerModal"
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 p-3 pt-4 sm:p-6 sm:pt-8 backdrop-blur-sm animate-fade-in"
    >
      {/* Node خفي لتحليل الصور المرفوعة */}
      <div id="file-scanner-temp-node" className="hidden" />

      {/* كرت علوي مدمج وأنيق (Pinned to Top Compact Card) */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200/90 flex flex-col">
        {/* شريط الرأس العلوي */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-bold text-slate-800 text-sm font-['Cairo']">{title}</h3>
                {autoCloseOnScan ? (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-200">
                    <CheckCircle2 className="h-2.5 w-2.5 text-amber-600" />
                    التقاط لمرة واحدة
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                    <Layers className="h-2.5 w-2.5 text-emerald-600" />
                    مسح مستمر للبيع
                  </span>
                )}
                {engineType === 'native' && (
                  <span className="inline-flex items-center gap-0.5 rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 border border-sky-200">
                    <Sparkles className="h-2.5 w-2.5" />
                    فائق السرعة
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                {subtitle ||
                  (autoCloseOnScan
                    ? 'تصوير لمرة واحدة • تُغلق الكاميرا تلقائياً فور قراءة الباركود'
                    : 'مسح مستمر • الكاميرا تبقى مفتوحة لقراءة عدة أصناف للبيع')}
              </p>
            </div>
          </div>

          {/* زر الإغلاق X في زاوية الكاميرا */}
          <button
            id="closeScannerModalBtn"
            type="button"
            onClick={handleCloseModal}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-transparent hover:border-rose-200 transition"
            title="إغلاق الكاميرا (X)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* مساحة الكاميرا وعرض الفيديو المباشر */}
        <div className="relative bg-slate-950 min-h-[280px] sm:min-h-[300px] flex items-center justify-center overflow-hidden">
          {/* عنصر الفيديو المباشر الأساسي */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className={`w-full h-full min-h-[280px] sm:min-h-[300px] object-cover ${
              engineType === 'html5' ? 'hidden' : 'block'
            }`}
          />

          {/* حاوية Html5Qrcode كـ Fallback */}
          <div
            id={html5ContainerId}
            className={`w-full h-full min-h-[280px] sm:min-h-[300px] [&_video]:w-full [&_video]:h-full [&_video]:object-cover ${
              engineType === 'html5' ? 'block' : 'hidden'
            }`}
          />

          {/* حالة التحميل الأولي */}
          {isStarting && !errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-white gap-2.5 z-10">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-xs font-bold text-slate-200">جاري تشغيل الكاميرا وإعداد الحساس...</p>
            </div>
          )}

          {/* مؤشر فحص الصورة المرفوعة */}
          {isFileScanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 text-white gap-2.5 z-20">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="text-xs font-bold text-slate-200">جاري قراءة الباركود من الصورة...</p>
            </div>
          )}

          {/* الإطار الليزري الأخضر وخط المسح النابض */}
          {isScanning && !errorMessage && !isStarting && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-10">
              <div className="relative w-64 h-36 border-2 border-emerald-400/90 rounded-2xl shadow-[0_0_25px_rgba(52,211,153,0.35)] overflow-hidden bg-emerald-500/5">
                {/* زوايا الإطار المميزة */}
                <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />

                {/* خط المسح النابض */}
                <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_14px_#34d399] animate-bounce top-1/2 -translate-y-1/2" />

                <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-slate-950/80 px-3 py-0.5 text-[10px] font-bold text-emerald-300 backdrop-blur-sm border border-emerald-500/30 whitespace-nowrap">
                  وجّه الباركود داخل الإطار
                </div>
              </div>
            </div>
          )}

          {/* شريط الإشعار الفوري عند التقاط باركود مع بقاء الكاميرا مفتوحة */}
          {lastScannedCode && (
            <div className="absolute top-3 inset-x-4 flex items-center justify-between rounded-xl bg-emerald-600/95 text-white px-3.5 py-2 shadow-lg backdrop-blur-md z-20 animate-fade-in border border-emerald-400/40">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-100 shrink-0" />
                <div className="text-right">
                  <p className="text-[11px] font-bold leading-tight">تمت القراءة والإضافة بنجاح!</p>
                  <p className="font-mono text-xs text-emerald-100 font-bold">{lastScannedCode}</p>
                </div>
              </div>
              <span className="rounded-lg bg-emerald-950/40 px-2 py-1 text-[10px] font-bold text-emerald-200 font-mono">
                صنف #{scannedCount}
              </span>
            </div>
          )}

          {/* عداد المنتجات الممسوحة العائم */}
          {scannedCount > 0 && !lastScannedCode && (
            <div className="absolute top-3 right-3 rounded-full bg-slate-900/85 px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 backdrop-blur-md z-10 flex items-center gap-1.5 shadow-md">
              <Layers className="h-3.5 w-3.5 text-emerald-400" />
              <span>تم مسح {scannedCount} أصناف</span>
            </div>
          )}

          {/* رسائل التنبيه والأخطاء */}
          {errorMessage && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 p-6 text-center text-white z-20">
              <div className="h-12 w-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-100 mb-1">تعذر تشغيل الكاميرا</h4>
              <p className="text-xs text-slate-300 max-w-xs leading-relaxed mb-4">{errorMessage}</p>
              <div className="flex gap-2">
                <button
                  id="retryScannerBtn"
                  type="button"
                  onClick={() => startCamera()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}
        </div>

        {/* شريط أدوات التحكم السريعة (Toolbar) */}
        <div className="flex items-center justify-between bg-slate-100/90 px-3.5 py-2.5 border-t border-slate-200">
          <div className="flex items-center gap-2">
            {/* زر الفلاش */}
            {hasTorch && (
              <button
                id="scannerTorchToggleBtn"
                type="button"
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition shadow-sm ${
                  isTorchOn
                    ? 'bg-amber-500 text-white shadow-amber-500/20'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="تشغيل / إطفاء الفلاش"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>{isTorchOn ? 'إطفاء الفلاش' : 'الفلاش'}</span>
              </button>
            )}

            {/* زر قلب الكاميرا */}
            <button
              id="scannerFlipCamBtn"
              type="button"
              onClick={flipCamera}
              className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              title="قلب الكاميرا (خلفية / أمامية)"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>قلب الكاميرا</span>
            </button>

            {/* زر مسح من صورة */}
            <label
              htmlFor="barcodeImageUploadInput"
              className="flex items-center gap-1.5 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm cursor-pointer"
              title="مسح من صورة مخزنة على الجهاز"
            >
              <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
              <span>مسح من صورة</span>
            </label>
            <input
              id="barcodeImageUploadInput"
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
          </div>

          {/* زر تم الانتهاء / الإغلاق السريع */}
          <button
            type="button"
            onClick={handleCloseModal}
            className="flex items-center gap-1 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm font-['Cairo']"
          >
            <Check className="h-3.5 w-3.5" />
            <span>تم الانتهاء</span>
          </button>
        </div>

        {/* نموذج الإدخال اليدوي السريع للباركود */}
        <div className="bg-white p-3.5 border-t border-slate-100">
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Barcode className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="scannerManualBarcodeInput"
                type="text"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                placeholder="أو اكتب الباركود يدوياً هنا واضغط تأكيد..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pr-9 pl-3 py-2 text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <button
              id="scannerSubmitManualBarcodeBtn"
              type="submit"
              disabled={!manualInput.trim()}
              className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-white hover:bg-slate-900 disabled:opacity-50 transition"
            >
              إضافة
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
