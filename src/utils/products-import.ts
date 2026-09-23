/**
 * استيراد المنتجات بالجملة من ملف Excel (.xlsx/.xls) أو CSV
 * — يدعم الترويسات العربية والإنجليزية، ترميز UTF-8 و windows-1256،
 * والفاصلة أو الفاصلة المنقوطة كفاصل أعمدة (إعدادات إقليمية مختلفة).
 */
import { ParsedProductRow, ProductsFileResult } from '../types';

const stripDiacritics = (s: string) => s.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

export const normalizeHeader = (s: string) =>
  (s || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/\s+|_+/g, '');

const HEADER_MAP: Record<string, keyof ParsedProductRow> = {
  'اسمالمنتج': 'name', 'اسمالصنف': 'name', 'الاسم': 'name', 'الصنف': 'name', 'المنتج': 'name', 'name': 'name', 'productname': 'name',
  'الباركود': 'barcode', 'باركود': 'barcode', 'barcode': 'barcode',
  'القسم': 'category', 'الفئه': 'category', 'الفئة': 'category', 'category': 'category',
  'سعرالشراء': 'purchasePrice', 'سعرالتكلفه': 'purchasePrice', 'سعرالتكلفة': 'purchasePrice', 'سعرالشراءللوحده': 'purchasePrice', 'purchaseprice': 'purchasePrice', 'cost': 'purchasePrice',
  'سعرالبيع': 'salePrice', 'سعركيلو': 'salePrice', 'سعرالكيلو': 'salePrice', 'سعركيلوالوحده': 'salePrice', 'saleprice': 'salePrice', 'price': 'salePrice',
  'الكميه': 'quantity', 'الكمية': 'quantity', 'quantity': 'quantity', 'qty': 'quantity',
  'حدالتنبيه': 'minQuantityAlert', 'الحدالادني': 'minQuantityAlert', 'الحدالادنى': 'minQuantityAlert', 'minquantityalert': 'minQuantityAlert', 'minalert': 'minQuantityAlert',
  'الوحده': 'unit', 'الوحدة': 'unit', 'unit': 'unit',
  'منتجبالوزن': 'isWeighted', 'وزن': 'isWeighted', 'isweighted': 'isWeighted', 'weighted': 'isWeighted',
};

const truthyAr = (v: string) => ['نعم', 'true', '1', 'yes', 'y', 'صح', 'weighted'].includes((v || '').trim().toLowerCase());

function parseDelimited(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === sep) {
      cur.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      cur.push(field);
      field = '';
      if (cur.some((c) => c.trim() !== '')) rows.push(cur);
      cur = [];
    } else field += ch;
  }
  if (field !== '' || cur.length > 0) {
    cur.push(field);
    if (cur.some((c) => c.trim() !== '')) rows.push(cur);
  }
  return rows;
}

async function decodeText(buffer: ArrayBuffer): Promise<string> {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer).replace(/^\uFEFF/, '');
  } catch {
    // ملفات Excel العربية القديمة غالباً بترميز windows-1256
    return new TextDecoder('windows-1256').decode(buffer).replace(/^\uFEFF/, '');
  }
}

export async function parseProductsFile(file: File): Promise<ProductsFileResult> {
  const lowerName = file.name.toLowerCase();
  let rawRows: string[][] = [];

  if (/\.(xlsx|xls|xlsm)$/.test(lowerName)) {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' }).map((r) => (r as unknown[]).map((c) => String(c ?? '')));
  } else {
    const text = await decodeText(await file.arrayBuffer());
    const firstLine = (text.split(/\r?\n/)[0] || '');
    const sep = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
    rawRows = parseDelimited(text, sep);
  }

  const errors: { row: number; reason: string }[] = [];
  const rows: ParsedProductRow[] = [];
  let headerMapIdx: Record<string, number> = {};

  // ابحث عن صف الترويسة (أول صف يحوي عمود اسم معروف)
  let headerRowIdx = -1;
  for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
    const cells = (rawRows[i] || []).map((c) => normalizeHeader(String(c ?? '')));
    if (cells.some((c) => HEADER_MAP[c] === 'name')) {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) {
    return { rows: [], errors: [{ row: 0, reason: 'لم يُعثر على صف ترويسة يحتوي عمود «اسم المنتج» — استخدم القالب' }], totalRows: rawRows.length };
  }

  const headerCells = (rawRows[headerRowIdx] || []).map((c) => normalizeHeader(String(c ?? '')));
  headerCells.forEach((h, idx) => {
    const key = HEADER_MAP[h];
    if (key && headerMapIdx[key] === undefined) headerMapIdx[key] = idx;
  });

  const get = (row: unknown[], key: keyof ParsedProductRow): string => {
    const idx = headerMapIdx[key];
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const num = (v: string): number => {
    const cleaned = (v || '').replace(/[٠-٩۰-۹]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.-]/g, '');
    return parseFloat(cleaned) || 0;
  };

  for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
    const row = rawRows[i] || [];
    const rowName = (get(row, 'name') || '').trim();
    if (!rowName) continue; // صف فارغ

    const rowSale = num(get(row, 'salePrice'));
    if (rowSale <= 0) {
      errors.push({ row: i + 1, reason: `«${rowName}» — سعر البيع غير صالح أو مفقود` });
      continue;
    }

    const rawWeighted = (get(row, 'isWeighted') || '').trim().toLowerCase();
    const isWeighted = ['نعم', 'yes', 'true', '1', 'صح'].includes(rawWeighted);

    rows.push({
      name: rowName,
      barcode: (get(row, 'barcode') || '').trim(),
      category: (get(row, 'category') || 'عام').trim() || 'عام',
      purchasePrice: num(get(row, 'purchasePrice')),
      salePrice: rowSale,
      quantity: Math.max(0, num(get(row, 'quantity'))),
      minQuantityAlert: num(get(row, 'minQuantityAlert')) || 5,
      unit: (get(row, 'unit') || 'حبة').trim() || 'حبة',
      isWeighted,
    });
  }

  return { rows, errors, totalRows: rawRows.length - (headerRowIdx + 1) };
}