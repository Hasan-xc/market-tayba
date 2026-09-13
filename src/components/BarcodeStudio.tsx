import React, { useState } from 'react';
import { 
  Printer, 
  X, 
  Barcode as BarcodeIcon, 
  Settings2, 
  Layers, 
  Eye, 
  Plus, 
  Minus, 
  Check, 
  Copy, 
  FileText,
  Search
} from 'lucide-react';
import { Product, StoreSettings, BarcodeLabelConfig } from '../types';
import { BarcodeSvg } from './BarcodeSvg';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  settings: StoreSettings;
  preselectedProduct?: Product | null;
}

export const BarcodeStudio: React.FC<Props> = ({
  isOpen,
  onClose,
  products,
  settings,
  preselectedProduct,
}) => {
  const [selectedProductId, setSelectedProductId] = useState<string>(
    preselectedProduct?.id || (products.length > 0 ? products[0].id : '')
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [copies, setCopies] = useState<number>(6);
  const [labelConfig, setLabelConfig] = useState<BarcodeLabelConfig>({
    format: 'roll_50x25',
    showStoreName: true,
    showPrice: true,
    showBarcodeText: true,
    currency: settings.currency || 'TL',
  });

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId) || products[0] || null;

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-950/85 backdrop-blur-sm animate-fade-in font-['Cairo',sans-serif]">
      {/* Container */}
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 text-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header (No print) */}
        <div className="no-print flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/30 text-emerald-400 border border-emerald-500/30">
              <BarcodeIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">استوديو تصميم وطباعة ملصقات الباركود</h3>
              <p className="text-xs text-slate-400">طباعة ملصقات الأسعار والباركود لرولات الطابعات الحرارية وصفحات A4</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Controls Column (No print) */}
          <div className="no-print lg:col-span-5 space-y-4">
            {/* Product Selector */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-2.5">
              <label className="text-xs font-bold text-slate-300 block">اختيار الصنف المراد طباعته:</label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث بالاسم أو الباركود..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg pr-9 pl-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-medium focus:border-emerald-500"
              >
                {filteredProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} - ({p.salePrice} {settings.currency}) [{p.barcode}]
                  </option>
                ))}
              </select>
            </div>

            {/* Print Format / Presets */}
            <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/80 space-y-3">
              <label className="text-xs font-bold text-slate-300 block">مقاس ونوع ورق الطباعة:</label>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setLabelConfig({ ...labelConfig, format: 'roll_50x25' })}
                  className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                    labelConfig.format === 'roll_50x25'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">رول حراري</div>
                  <div className="text-[10px] font-mono text-slate-200">50 × 25 مم</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelConfig({ ...labelConfig, format: 'roll_40x30' })}
                  className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                    labelConfig.format === 'roll_40x30'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">رول حراري</div>
                  <div className="text-[10px] font-mono text-slate-200">40 × 30 مم</div>
                </button>

                <button
                  type="button"
                  onClick={() => setLabelConfig({ ...labelConfig, format: 'a4_30' })}
                  className={`p-2.5 rounded-lg border text-center font-bold transition cursor-pointer ${
                    labelConfig.format === 'a4_30'
                      ? 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="text-[11px]">ورق A4</div>
                  <div className="text-[10px] font-mono text-slate-200">شبكة 30 ملصق</div>
                </button>
              </div>

              {/* Elements display toggles */}
              <div className="space-y-2 pt-2 border-t border-slate-700/60 text-xs">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showStoreName}
                    onChange={(e) => setLabelConfig({ ...labelConfig, showStoreName: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>إظهار اسم المتجر ({settings.storeName})</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showPrice}
                    onChange={(e) => setLabelConfig({ ...labelConfig, showPrice: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>إظهار سعر البيع</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={labelConfig.showBarcodeText}
                    onChange={(e) => setLabelConfig({ ...labelConfig, showBarcodeText: e.target.checked })}
                    className="accent-emerald-600 rounded"
                  />
                  <span>إظهار أرقام الباركود أسفل الخطوط</span>
                </label>
              </div>

              {/* Copies count */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/60">
                <span className="text-xs text-slate-300 font-bold">عدد الملصقات للطباعة:</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCopies(Math.max(1, copies - 1))}
                    className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={copies}
                    onChange={(e) => setCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 text-center bg-slate-900 border border-slate-700 rounded-lg py-1 font-mono font-bold text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setCopies(copies + 1)}
                    className="h-8 w-8 rounded-lg bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-white"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Print Action */}
            <button
              onClick={handlePrint}
              disabled={!currentProduct}
              className="w-full bg-emerald-600 hover:bg-emerald-500 py-3 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/40 active:scale-[0.99] transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>طباعة {copies} ملصق الآن</span>
            </button>
          </div>

          {/* Preview Column (This section is also printed) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="no-print text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5 self-start">
              <Eye className="h-3.5 w-3.5 text-emerald-400" />
              <span>معاينة الطباعة الفورية ({labelConfig.format}):</span>
            </div>

            {/* Printable Labels Canvas */}
            <div
              id="printableBarcodeStudioSheet"
              className="w-full bg-white text-slate-900 p-4 rounded-xl border border-slate-300 shadow-inner overflow-y-auto max-h-[500px]"
            >
              {currentProduct ? (
                <div
                  className={`grid gap-3 ${
                    labelConfig.format === 'a4_30'
                      ? 'grid-cols-2 sm:grid-cols-3'
                      : 'grid-cols-1 sm:grid-cols-2'
                  }`}
                >
                  {Array.from({ length: copies }).map((_, idx) => (
                    <div
                      key={idx}
                      className="border border-dashed border-slate-300 rounded p-2.5 flex flex-col items-center justify-center text-center bg-white min-h-[105px]"
                    >
                      {labelConfig.showStoreName && (
                        <div className="text-[10px] font-bold text-slate-700 font-['Cairo'] line-clamp-1">
                          {settings.storeName}
                        </div>
                      )}
                      <div className="text-xs font-black text-slate-900 font-['Cairo'] line-clamp-1 mt-0.5">
                        {currentProduct.name}
                      </div>
                      {labelConfig.showPrice && (
                        <div className="text-sm font-black font-mono text-emerald-800 my-0.5">
                          {currentProduct.salePrice.toFixed(2)} {settings.currency}
                        </div>
                      )}
                      <BarcodeSvg
                        value={currentProduct.barcode}
                        height={32}
                        showText={labelConfig.showBarcodeText}
                        textColor="#1e293b"
                        barColor="#000000"
                        className="w-full"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-xs">
                  يرجى اختيار صنف لعرض ملصق الباركود
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
