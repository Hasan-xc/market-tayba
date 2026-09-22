-- ================================================================
-- نظام نقاط البيع والمخازن المتكامل (POS & Supermarket Cloud Database)
-- كود SQL المحدث والذكي لمعالجة الجداول القديمة والجديدة بدون أي أخطاء
-- ================================================================

-- الخطوة 1: إنشاء الجداول الأساسية في حال لم تكن موجودة
CREATE TABLE IF NOT EXISTS public.products (
    id TEXT PRIMARY KEY,
    barcode TEXT,
    name TEXT,
    category TEXT DEFAULT 'عام',
    purchase_price NUMERIC(12, 2) DEFAULT 0,
    sale_price NUMERIC(12, 2) DEFAULT 0,
    quantity NUMERIC(12, 2) DEFAULT 0,
    min_quantity_alert NUMERIC(12, 2) DEFAULT 5,
    unit TEXT DEFAULT 'حبة',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sales (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.returns (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.debt_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
    id TEXT PRIMARY KEY DEFAULT 'main_store_config',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.stock_audit_logs (
    id TEXT PRIMARY KEY,
    product_id TEXT,
    barcode TEXT,
    product_name TEXT,
    type TEXT,
    quantity_delta NUMERIC(12, 2) DEFAULT 0,
    previous_quantity NUMERIC(12, 2) DEFAULT 0,
    new_quantity NUMERIC(12, 2) DEFAULT 0,
    reason TEXT,
    performed_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- توثيق قيم عمود type المسموحة في stock_audit_logs (نص حر بدون قيود CHECK):
-- sale | purchase | manual_adjustment | return | scrap | product_created
-- | product_deleted | price_update | transfer_in | transfer_out
-- damage        = إتلاف / تالف خارج فاتورة بيع
-- vendor_return = إرجاع للمصنع / المورد خارج فاتورة بيع (يشمل اسم المورد في reason)

-- ================================================================
-- الخطوة 2: إضافة جميع الأعمدة تلقائياً في حال وجود جداول قديمة
-- هذا يمنع خطأ (ERROR: column does not exist) بنسبة 100%
-- ================================================================

-- أعمدة جدول المنتجات products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'عام';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_quantity_alert NUMERIC(12, 2) DEFAULT 5;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'حبة';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- أعمدة جدول المبيعات sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS net_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_profit NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cash_tendered NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS change_due NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS quantity_sold NUMERIC(12, 2) DEFAULT 1;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sale_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS profit NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- أعمدة جدول المرتجعات returns
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS return_number TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS original_invoice_number TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS product_id TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS product_name TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS quantity NUMERIC(12, 2) DEFAULT 1;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_unit_price NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_total NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS custom_reason_text TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS action_taken TEXT DEFAULT 'restock';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- أعمدة جدول العملاء customers
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS current_debt NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- أعمدة جدول حركات الديون debt_transactions
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS invoice_id TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'الكاشير';
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- أعمدة جدول إعدادات المتجر store_settings
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_phone TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_address TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS store_vat_number TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'ريال';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS backup_email TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS receipt_footer_message TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS security_pin TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS cashiers JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS active_cashier TEXT;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS auto_backup_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS auto_backup_frequency TEXT DEFAULT 'weekly';
ALTER TABLE public.store_settings ADD COLUMN IF NOT EXISTS auto_backup_sections JSONB DEFAULT '[]'::jsonb;

-- أعمدة جدول الموردين suppliers
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS balance NUMERIC(12, 2) DEFAULT 0;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ================================================================
-- الخطوة 3: إنشاء الفهارس بأمان
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products (barcode);
CREATE INDEX IF NOT EXISTS idx_products_name ON public.products (name);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_number ON public.sales (invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON public.sales (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_returns_created_at ON public.returns (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_debt_customer_id ON public.debt_transactions (customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers (phone);
CREATE INDEX IF NOT EXISTS idx_stock_audit_product_id ON public.stock_audit_logs (product_id);
CREATE INDEX IF NOT EXISTS idx_stock_audit_barcode ON public.stock_audit_logs (barcode);
CREATE INDEX IF NOT EXISTS idx_stock_audit_created_at ON public.stock_audit_logs (created_at DESC);

-- ================================================================
-- الخطوة 4: تفعيل سياسات الأمان RLS والسماح بالوصول الكامل
-- ================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Access Products" ON public.products;
DROP POLICY IF EXISTS "Public Access Sales" ON public.sales;
DROP POLICY IF EXISTS "Public Access Returns" ON public.returns;
DROP POLICY IF EXISTS "Public Access Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Access Debt" ON public.debt_transactions;
DROP POLICY IF EXISTS "Public Access Settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public Access Suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public Access Stock Audit" ON public.stock_audit_logs;

CREATE POLICY "Public Access Products" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Sales" ON public.sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Returns" ON public.returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Debt" ON public.debt_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Settings" ON public.store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public Access Stock Audit" ON public.stock_audit_logs FOR ALL USING (true) WITH CHECK (true);

-- ================================================================
-- الخطوة 5: تفعيل المزامنة اللحظية الحية (Realtime)
-- ================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE 
            public.products, 
            public.sales, 
            public.returns, 
            public.customers, 
            public.debt_transactions, 
            public.store_settings,
            public.suppliers,
            public.stock_audit_logs;
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;
