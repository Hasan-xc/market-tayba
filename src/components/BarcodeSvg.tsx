import React, { useMemo } from 'react';
import { generateBarcodeSvgElements } from '../utils/barcodeGenerator';

interface Props {
  value: string;
  width?: number;
  height?: number;
  showText?: boolean;
  className?: string;
  textColor?: string;
  barColor?: string;
}

export const BarcodeSvg: React.FC<Props> = ({
  value,
  width,
  height = 44,
  showText = true,
  className = '',
  textColor = '#0f172a',
  barColor = '#000000',
}) => {
  const barcodeData = useMemo(() => {
    if (!value) return null;
    return generateBarcodeSvgElements(value, 1.8, height);
  }, [value, height]);

  if (!barcodeData || !value) {
    return <div className="text-xs text-slate-400 font-mono">--</div>;
  }

  return (
    <div className={`flex flex-col items-center justify-center select-none ${className}`}>
      <svg
        viewBox={`0 0 ${barcodeData.width} ${barcodeData.height}`}
        style={{ width: width ? `${width}px` : '100%', maxWidth: '280px', height: `${height}px` }}
        className="overflow-visible"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect x="0" y="0" width={barcodeData.width} height={barcodeData.height} fill="transparent" />
        {barcodeData.rects.map((rect, idx) => (
          <rect
            key={idx}
            x={rect.x}
            y={rect.y}
            width={rect.width}
            height={rect.height}
            fill={barColor}
          />
        ))}
      </svg>
      {showText && (
        <span
          className="font-mono text-[11px] tracking-widest mt-1 font-bold"
          style={{ color: textColor }}
        >
          {value}
        </span>
      )}
    </div>
  );
};
