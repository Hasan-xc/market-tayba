/**
 * Code 128 (Subset B) Barcode Generator in Pure SVG
 * Generates crisp, scalable vector barcode lines for labels and receipts.
 * 100% offline, zero dependencies.
 */

// Code 128 Pattern Table (Patterns for Subset B / ASCII 32 to 127)
// Each pattern is a sequence of 6 bar/space widths (summing to 11 modules), except stop pattern (13 modules)
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106 (104=StartB, 106=Stop)
];

const START_B_INDEX = 104;
const STOP_INDEX = 106;

/**
 * Encodes text into Code128 pattern string of modules (1s and 0s)
 */
export function encodeCode128(text: string): string {
  if (!text) return '';
  const clean = text.trim();
  
  // Convert text characters to values (ASCII - 32)
  const values: number[] = [];
  for (let i = 0; i < clean.length; i++) {
    const code = clean.charCodeAt(i);
    // Support printable ASCII
    if (code >= 32 && code <= 126) {
      values.push(code - 32);
    } else {
      values.push(0); // Space fallback
    }
  }

  // Calculate Checksum: (StartB + sum(i * value[i])) % 103
  let checkSum = START_B_INDEX;
  for (let i = 0; i < values.length; i++) {
    checkSum += (i + 1) * values[i];
  }
  const checkDigit = checkSum % 103;

  // Build series of indices
  const allIndices = [START_B_INDEX, ...values, checkDigit, STOP_INDEX];

  // Convert pattern widths to binary module string (1=bar, 0=space)
  let modules = '';
  allIndices.forEach((patternIdx) => {
    const pattern = CODE128_PATTERNS[patternIdx] || '212222';
    let isBar = true;
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      modules += (isBar ? '1' : '0').repeat(width);
      isBar = !isBar;
    }
  });

  return modules;
}

/**
 * Generates an SVG string or SVG elements data for a barcode
 */
export function generateBarcodeSvgElements(
  text: string, 
  moduleWidth = 2, 
  height = 50
): { width: number; height: number; rects: { x: number; y: number; width: number; height: number }[] } {
  const modules = encodeCode128(text);
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  
  let currentX = 10; // Quiet zone padding
  let barStart = -1;

  for (let i = 0; i < modules.length; i++) {
    if (modules[i] === '1') {
      if (barStart === -1) barStart = i;
    } else {
      if (barStart !== -1) {
        rects.push({
          x: currentX + barStart * moduleWidth,
          y: 0,
          width: (i - barStart) * moduleWidth,
          height: height
        });
        barStart = -1;
      }
    }
  }

  if (barStart !== -1) {
    rects.push({
      x: currentX + barStart * moduleWidth,
      y: 0,
      width: (modules.length - barStart) * moduleWidth,
      height: height
    });
  }

  const totalWidth = currentX * 2 + modules.length * moduleWidth;

  return {
    width: totalWidth,
    height,
    rects
  };
}
