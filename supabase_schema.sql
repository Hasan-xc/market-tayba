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
-- أعمدة الفروع (تستخدمها سياسات RLS للعزل حسب دور/فرع الكاشير)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_quantities JSONB;

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
-- أعمدة الفروع (تستخدمها سياسات RLS)
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS branch_name TEXT;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS status TEXT;

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
-- أعمدة الفروع (تستخدمها سياسات RLS)
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS branch_name TEXT;

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
-- أعمدة الفروع (تستخدمها سياسات RLS)
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.debt_transactions ADD COLUMN IF NOT EXISTS branch_name TEXT;

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
-- الخطوة 4: تفعيل سياسات الأمان RLS (المصادقة مطلوبة — لا وصول مجهول)
-- ================================================================
-- ملاحظة تشغيلية: بعد تطبيق هذا السكربت تصبح السحابة مقيّدة بالمصادقة.
-- كل مستخدم فعّل تسجيل الدخول أونلاين مرة واحدة (JIT عبر الـ Auth) تملك
-- جلسة مخزنة → تُربط تلقائياً بكل عميل مزامنة (attachStoredAuthSession).
-- المستخدمون الذين لُوّجوا محلياً فقط بلا حساب Auth سيبقون «أوفلاين» حتى
-- أول دخول أونلاين — لكن لن يتعطل أي كاشير Or أوفلاين محلياً أبداً.

-- جدول المستخدمين الداخليين (المكوّن SaaS) — يُربط حساب Auth الواحد بمستخدم POS
CREATE TABLE IF NOT EXISTS public.app_users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'cashier',
    branch_id TEXT,
    auth_uid UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_username ON public.app_users (LOWER(username));
CREATE UNIQUE INDEX IF NOT EXISTS uq_app_users_auth_uid ON public.app_users (auth_uid) WHERE auth_uid IS NOT NULL;

-- دوال مساعدة: تفحص دور وفرع المستخدم الحالي عبر auth.uid()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_users u
    WHERE u.auth_uid = auth.uid()
      AND LOWER(COALESCE(u.role, '')) = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.current_username()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT NULLIF(LOWER(SPLIT_PART(COALESCE(auth.jwt() ->> 'email', ''), '@', 1)), '')
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch()
RETURNS TEXT
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT (SELECT u.branch_id FROM public.app_users u WHERE u.auth_uid = auth.uid() LIMIT 1)
$$;

--====== تفعيل RLS على كل الجداول ======
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_audit_logs ENABLE ROW LEVEL SECURITY;

-- إزالة السياسات القديمة المفتوحة على مصراعيها (بكل أسماءها المحتملة)
DROP POLICY IF EXISTS "Public Access Products" ON public.products;
DROP POLICY IF EXISTS "Public Access Sales" ON public.sales;
DROP POLICY IF EXISTS "Public Access Returns" ON public.returns;
DROP POLICY IF EXISTS "Public Access Customers" ON public.customers;
DROP POLICY IF EXISTS "Public Access Debt" ON public.debt_transactions;
DROP POLICY IF EXISTS "Public Access Settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public Access Suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public Access Stock Audit" ON public.stock_audit_logs;
DROP POLICY IF EXISTS "Allow full access on products" ON public.products;
DROP POLICY IF EXISTS "Allow full access on customers" ON public.customers;
DROP POLICY IF EXISTS "Allow full access on debt_transactions" ON public.debt_transactions;
DROP POLICY IF EXISTS "Allow full access on sales" ON public.sales;
DROP POLICY IF EXISTS "Allow full access on returns" ON public.returns;
DROP POLICY IF EXISTS "Allow full access on store_settings" ON public.store_settings;

--====== app_users: قراءة صفه فقط لأي مستخدم مصدّق، وإدارة كاملة للإداري ======
DROP POLICY IF EXISTS "app_users read own" ON public.app_users;
CREATE POLICY "app_users read own" ON public.app_users
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_admin() OR auth_uid = auth.uid() OR username = public.current_username())
  );

DROP POLICY IF EXISTS "app_users insert own" ON public.app_users;
CREATE POLICY "app_users insert own" ON public.app_users
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND (public.is_admin() OR auth_uid = auth.uid()));

DROP POLICY IF EXISTS "app_users update own" ON public.app_users;
CREATE POLICY "app_users update own" ON public.app_users
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND (public.is_admin() OR auth_uid = auth.uid()
         OR (auth_uid IS NULL AND username = public.current_username()))
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (public.is_admin() OR auth_uid = auth.uid() OR username = public.current_username())
  );

DROP POLICY IF EXISTS "app_users delete admin" ON public.app_users;
CREATE POLICY "app_users delete admin" ON public.app_users
  FOR DELETE USING (public.is_admin());

--====== products: إداري كامل، كاشير يقرأ/يكتب صفوف فرعه أو المشتركة ======
DROP POLICY IF EXISTS "products authed access" ON public.products;
CREATE POLICY "products authed access" ON public.products
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
      OR branch_id IN ('multi', 'all')
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
      OR branch_id IN ('multi', 'all')
    )
  );

--====== sales: كاشير يكمل صفوف فرعه فقط، إداري كامل ======
DROP POLICY IF EXISTS "sales authed access" ON public.sales;
CREATE POLICY "sales authed access" ON public.sales
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  );

--====== returns: كاشير يكمل صفوف فرعه فقط، إداري كامل ======
DROP POLICY IF EXISTS "returns authed access" ON public.returns;
CREATE POLICY "returns authed access" ON public.returns
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  );

--====== customers: قراءة/كتابة للمصادقين (سجل عملاء مشترك بين الفروع) ======
DROP POLICY IF EXISTS "customers authed access" ON public.customers;
CREATE POLICY "customers authed access" ON public.customers
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

--====== debt_transactions: كاشير فرع فقط، إداري كامل ======
DROP POLICY IF EXISTS "debt authed access" ON public.debt_transactions;
CREATE POLICY "debt authed access" ON public.debt_transactions
  FOR ALL
  USING (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      public.is_admin()
      OR branch_id IS NULL
      OR branch_id = public.current_user_branch()
    )
  );

--====== store_settings: قراءة للمصادقين، كتابة للإداري فقط ======
DROP POLICY IF EXISTS "settings authed read" ON public.store_settings;
CREATE POLICY "settings authed read" ON public.store_settings
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "settings admin write" ON public.store_settings;
CREATE POLICY "settings admin write" ON public.store_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

--====== suppliers: قراءة للمصادقين، كتابة للإداري فقط ======
DROP POLICY IF EXISTS "suppliers authed read" ON public.suppliers;
CREATE POLICY "suppliers authed read" ON public.suppliers
  FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "suppliers admin write" ON public.suppliers;
CREATE POLICY "suppliers admin write" ON public.suppliers
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

--====== stock_audit_logs: كتابة وقراءة للمصادقين (سجل تدقيق يكتبه النظام والكاشير) ======
DROP POLICY IF EXISTS "audit authed access" ON public.stock_audit_logs;
CREATE POLICY "audit authed access" ON public.stock_audit_logs
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

--====== دالة معالجة البيع الذرية (الفاتورة + خصم المخزون في معاملة واحدة) ======
CREATE OR REPLACE FUNCTION public.process_sale(sale_data JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  sale_id TEXT;
  sale_branch TEXT;
  existing_sale JSONB;
  item JSONB;
BEGIN
  -- لا يُسمح لأي جهة غير مصادقة باستدعاء الدالة إطلاقاً
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;

  sale_id := COALESCE(NULLIF(sale_data ->> 'id', ''), 'sale-' || to_char(now(), 'YYYYMMDDHH24MISSUS') || '-' || lower(substr(gen_random_uuid()::text, 1, 8)));
  sale_branch := COALESCE(NULLIF(sale_data ->> 'branch_id', ''), 'branch-main');

  -- 1) Idempotency: إن كانت الفاتورة موجودة مسبقاً (إعادة محاولة من الطابور) لا نعيد
  --    خصم المخزون — نرجع الحالة القائمة فوراً فيمنع الفواتير المكررة والخصم المزدوج
  SELECT to_jsonb(s) INTO existing_sale FROM public.sales s WHERE s.id = sale_id;
  IF existing_sale IS NOT NULL THEN
    RETURN jsonb_build_object('id', sale_id, 'status', 'already_exists', 'sale', existing_sale);
  END IF;

  -- 2) إدراج الفاتورة داخل نفس المعاملة
  INSERT INTO public.sales (
    id, invoice_number, items, subtotal, discount_total, net_total, total_profit,
    payment_method, cash_tendered, change_due, cashier_name, customer_id, customer_name,
    barcode, product_name, quantity_sold, purchase_price, sale_price, total_amount,
    profit, sold_at, created_at, branch_id, branch_name, status
  ) VALUES (
    sale_id,
    COALESCE(sale_data ->> 'invoice_number', 'INV-' || sale_id),
    COALESCE(sale_data -> 'items', '[]'::jsonb),
    COALESCE((sale_data ->> 'subtotal')::numeric, 0),
    COALESCE((sale_data ->> 'discount_total')::numeric, 0),
    COALESCE((sale_data ->> 'net_total')::numeric, 0),
    COALESCE((sale_data ->> 'total_profit')::numeric, 0),
    COALESCE(sale_data ->> 'payment_method', 'cash'),
    COALESCE((sale_data ->> 'cash_tendered')::numeric, 0),
    COALESCE((sale_data ->> 'change_due')::numeric, 0),
    COALESCE(sale_data ->> 'cashier_name', 'الكاشير'),
    NULLIF(sale_data ->> 'customer_id', ''),
    NULLIF(sale_data ->> 'customer_name', ''),
    NULLIF(sale_data ->> 'barcode', ''),
    NULLIF(sale_data ->> 'product_name', ''),
    COALESCE((sale_data ->> 'quantity_sold')::numeric, 1),
    COALESCE((sale_data ->> 'purchase_price')::numeric, 0),
    COALESCE((sale_data ->> 'sale_price')::numeric, 0),
    COALESCE((sale_data ->> 'total_amount')::numeric, 0),
    COALESCE((sale_data ->> 'profit')::numeric, 0),
    COALESCE((sale_data ->> 'sold_at')::timestamptz, now()),
    COALESCE((sale_data ->> 'created_at')::timestamptz, now()),
    sale_branch,
    sale_data ->> 'branch_name',
    COALESCE(sale_data ->> 'status', 'completed')
  )
  ON CONFLICT (id) DO NOTHING;

  -- 3) خصم المخزون: نطبّق فرق الكمية (quantity_delta) على الكمية الحالية البعيدة —
  --    لا نكتب كمية مطلقة قديمة من لقطة محلية لأجهزة أخرى.
  --    يُطابق الصنف بالمعرف أو بالباركود (أيهما متاح في عناصر الفاتورة)
  FOR item IN SELECT * FROM jsonb_array_elements(COALESCE(sale_data -> 'items', '[]'::jsonb)) LOOP
    IF (item ->> 'product_id') IS NOT NULL OR (item ->> 'barcode') IS NOT NULL THEN
      UPDATE public.products
         SET quantity = GREATEST(0, COALESCE(quantity, 0) - COALESCE((item ->> 'quantity')::numeric, 1)),
             branch_quantities = CASE
               WHEN branch_quantities IS NOT NULL AND branch_id IS NOT NULL
                 THEN jsonb_set(branch_quantities, ARRAY[sale_branch],
                       to_jsonb(GREATEST(0, COALESCE((branch_quantities -> sale_branch)::numeric, 0) - COALESCE((item ->> 'quantity')::numeric, 1))))
               ELSE branch_quantities END,
             updated_at = now()
       WHERE id = (item ->> 'product_id')
          OR (barcode = (item ->> 'barcode') AND (item ->> 'product_id') IS NULL);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('id', sale_id, 'status', 'created', 'sale', (SELECT to_jsonb(s) FROM public.sales s WHERE s.id = sale_id));
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(jsonb) TO service_role, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_sale(jsonb) FROM anon, PUBLIC;

--=======================
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
