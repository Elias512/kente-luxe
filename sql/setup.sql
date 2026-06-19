-- ============================================
-- KENTE LUXE — Full Database Setup
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. PRODUCTS
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  region TEXT,
  occasion TEXT,
  fabric_type TEXT,
  category TEXT,
  gender TEXT,
  subcategory TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  story TEXT,
  color_palette TEXT,
  care_instructions TEXT,
  bestseller BOOLEAN DEFAULT false,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow all" ON public.products
  FOR ALL USING (true);

-- 2. USERS (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "users insert own" ON public.users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "users update own" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- 3. MANAGERS (admin accounts)
CREATE TABLE IF NOT EXISTS public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;

-- RPC-based access (no direct table access for end users)

-- 4. CART ITEMS
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  guest_id TEXT,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cart access own" ON public.cart_items
  FOR ALL USING (
    (auth.uid() IS NOT NULL AND user_id = auth.uid())
    OR
    (auth.uid() IS NULL AND guest_id IS NOT NULL)
  );

-- 5. ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  guest_id TEXT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  delivery_address TEXT NOT NULL,
  delivery_city TEXT NOT NULL,
  delivery_region TEXT NOT NULL,
  notes TEXT,
  total NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('mobile_money', 'visa')),
  payment_status TEXT NOT NULL DEFAULT 'paid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orders read own" ON public.orders
  FOR SELECT USING (
    auth.uid() = user_id
    OR
    customer_email = auth.jwt() ->> 'email'
  );

CREATE POLICY "orders insert own" ON public.orders
  FOR INSERT WITH CHECK (true);

-- 6. ORDER ITEMS
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL,
  price NUMERIC NOT NULL
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_items read" ON public.order_items
  FOR SELECT USING (true);

CREATE POLICY "order_items insert" ON public.order_items
  FOR INSERT WITH CHECK (true);

-- 7. CUSTOM ORDERS (bespoke requests)
CREATE TABLE IF NOT EXISTS public.custom_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  fabric TEXT,
  style TEXT,
  measurements TEXT,
  occasion TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_orders all" ON public.custom_orders
  FOR ALL USING (true);

-- 8. LOOKBOOK IMAGES
CREATE TABLE IF NOT EXISTS public.lookbook_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fabric_type TEXT NOT NULL,
  image_url TEXT NOT NULL,
  caption TEXT,
  alt_text TEXT,
  section TEXT NOT NULL DEFAULT 'hero',
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lookbook_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lookbook all" ON public.lookbook_images
  FOR ALL USING (true);

-- 9. NEWSLETTER SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS public.newsletter_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.newsletter_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "newsletter insert" ON public.newsletter_subscriptions
  FOR INSERT WITH CHECK (true);

-- 10. ADMIN SETTINGS (stores the admin secret key)
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert a default admin key: CHANGE THIS AFTER SETUP
INSERT INTO public.admin_settings (admin_key)
VALUES ('kente-admin-secret-2026')
ON CONFLICT DO NOTHING;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- 11. PRODUCT REVIEWS
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON public.reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON public.reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON public.reviews(user_id);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "block direct reviews access" ON public.reviews
  FOR ALL USING (false);

-- ============================================
-- RPC FUNCTIONS
-- ============================================

-- 1. Verify admin secret key
CREATE OR REPLACE FUNCTION public.verify_admin_key(input_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM admin_settings WHERE admin_key = input_key);
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_admin_key TO anon;

-- 2. Add a manager (admin registration)
CREATE OR REPLACE FUNCTION public.add_manager(
  manager_email TEXT,
  manager_name TEXT,
  manager_role TEXT DEFAULT 'admin'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.managers (email, full_name, role)
  VALUES (manager_email, manager_name, manager_role)
  ON CONFLICT (email) DO NOTHING;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_manager TO anon, authenticated;

-- 3. Count users (excluding guest/managers for dashboard)
CREATE OR REPLACE FUNCTION public.count_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cnt INTEGER;
BEGIN
  SELECT COUNT(*) INTO cnt FROM public.users;
  RETURN cnt;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_users TO anon, authenticated;

-- 4. Get top products by revenue
CREATE OR REPLACE FUNCTION public.get_top_products(limit_count INTEGER DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(sub) INTO result FROM (
    SELECT
      p.id,
      p.name,
      COALESCE(SUM(oi.quantity * oi.price), 0) AS revenue,
      COALESCE(SUM(oi.quantity), 0) AS units_sold
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
    GROUP BY p.id, p.name
    ORDER BY revenue DESC
    LIMIT limit_count
  ) sub;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_top_products TO anon, authenticated;

-- 5. Get daily revenue for the last N days
CREATE OR REPLACE FUNCTION public.get_daily_revenue(days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(sub ORDER BY sub.date) INTO result FROM (
    SELECT
      o.created_at::date AS date,
      COALESCE(SUM(o.total), 0) AS revenue
    FROM orders o
    WHERE o.created_at >= now() - (days || ' days')::INTERVAL
      AND o.status != 'cancelled'
    GROUP BY o.created_at::date
  ) sub;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_revenue TO anon, authenticated;

-- 6. Get order counts by status
CREATE OR REPLACE FUNCTION public.get_orders_by_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(sub) INTO result FROM (
    SELECT o.status, COUNT(*) AS count
    FROM orders o
    GROUP BY o.status
  ) sub;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_orders_by_status TO anon, authenticated;

-- 7. Get low stock products
CREATE OR REPLACE FUNCTION public.get_low_stock(threshold INTEGER DEFAULT 5)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_agg(sub) INTO result FROM (
    SELECT id, name, stock FROM products WHERE stock < threshold ORDER BY stock ASC
  ) sub;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_low_stock TO anon, authenticated;

-- 8. Update manager name (by JWT email)
CREATE OR REPLACE FUNCTION public.update_manager_name(new_name TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email TEXT;
BEGIN
  user_email := auth.jwt() ->> 'email';
  UPDATE public.managers SET full_name = new_name WHERE email = user_email;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_manager_name TO authenticated;

-- 9. Delete current user's account
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  user_email TEXT;
BEGIN
  uid := auth.uid();
  user_email := auth.jwt() ->> 'email';
  DELETE FROM public.managers WHERE email = user_email;
  DELETE FROM public.users WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account TO authenticated;

-- 10. Submit a review (checks verified purchase + duplicate)
CREATE OR REPLACE FUNCTION public.submit_review(p_product_id UUID, p_rating INT, p_body TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  user_email TEXT;
  has_purchased BOOLEAN;
  existing_review INT;
  review_id UUID;
BEGIN
  uid := auth.uid();
  user_email := auth.jwt() ->> 'email';
  IF uid IS NULL THEN RETURN jsonb_build_object('error', 'You must be logged in'); END IF;
  IF p_rating < 1 OR p_rating > 5 THEN RETURN jsonb_build_object('error', 'Rating must be between 1 and 5'); END IF;
  IF p_body IS NULL OR trim(p_body) = '' THEN RETURN jsonb_build_object('error', 'Review body cannot be empty'); END IF;
  SELECT EXISTS (
    SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = p_product_id
      AND (o.user_id = uid OR o.customer_email = user_email)
      AND o.status != 'cancelled'
  ) INTO has_purchased;
  IF NOT has_purchased THEN RETURN jsonb_build_object('error', 'You must purchase this product before reviewing'); END IF;
  SELECT COUNT(*) INTO existing_review FROM reviews WHERE product_id = p_product_id AND user_id = uid;
  IF existing_review > 0 THEN RETURN jsonb_build_object('error', 'You have already reviewed this product'); END IF;
  INSERT INTO reviews (product_id, user_id, rating, body, status)
  VALUES (p_product_id, uid, p_rating, trim(p_body), 'pending') RETURNING id INTO review_id;
  RETURN jsonb_build_object('id', review_id, 'status', 'pending');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review TO authenticated;

-- 11. Get approved reviews for a product
CREATE OR REPLACE FUNCTION public.get_product_reviews(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB; BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id, 'rating', r.rating, 'body', r.body,
    'user_name', u.full_name, 'created_at', r.created_at
  ) ORDER BY r.created_at DESC) INTO result
  FROM reviews r JOIN users u ON r.user_id = u.id
  WHERE r.product_id = p_product_id AND r.status = 'approved';
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_reviews TO anon, authenticated;

-- 12. Get product rating summary
CREATE OR REPLACE FUNCTION public.get_product_rating(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE avg_rating NUMERIC; review_count INT; BEGIN
  SELECT ROUND(AVG(rating)::numeric, 1), COUNT(*) INTO avg_rating, review_count
  FROM reviews WHERE product_id = p_product_id AND status = 'approved';
  RETURN jsonb_build_object('average', avg_rating, 'count', review_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_product_rating TO anon, authenticated;

-- 13. Check if user can review a product
CREATE OR REPLACE FUNCTION public.can_review_product(p_product_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID; user_email TEXT; has_purchased BOOLEAN; existing_review INT;
BEGIN
  uid := auth.uid(); user_email := auth.jwt() ->> 'email';
  IF uid IS NULL THEN RETURN jsonb_build_object('can_review', false, 'reason', 'login'); END IF;
  SELECT EXISTS (
    SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id
    WHERE oi.product_id = p_product_id
      AND (o.user_id = uid OR o.customer_email = user_email)
      AND o.status != 'cancelled'
  ) INTO has_purchased;
  IF NOT has_purchased THEN RETURN jsonb_build_object('can_review', false, 'reason', 'purchase'); END IF;
  SELECT COUNT(*) INTO existing_review FROM reviews WHERE product_id = p_product_id AND user_id = uid;
  IF existing_review > 0 THEN RETURN jsonb_build_object('can_review', false, 'reason', 'existing'); END IF;
  RETURN jsonb_build_object('can_review', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_review_product TO authenticated;

-- 14. Admin: get pending reviews
CREATE OR REPLACE FUNCTION public.get_pending_reviews()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result JSONB; BEGIN
  SELECT jsonb_agg(jsonb_build_object(
    'id', r.id, 'product_id', r.product_id, 'product_name', p.name,
    'rating', r.rating, 'body', r.body, 'user_name', u.full_name,
    'created_at', r.created_at
  ) ORDER BY r.created_at ASC) INTO result
  FROM reviews r
  JOIN users u ON r.user_id = u.id
  JOIN products p ON r.product_id = p.id
  WHERE r.status = 'pending';
  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_pending_reviews TO authenticated;

-- 15. Admin: approve a review
CREATE OR REPLACE FUNCTION public.approve_review(p_review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reviews SET status = 'approved' WHERE id = p_review_id AND status = 'pending';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_review TO authenticated;

-- 16. Admin: reject a review
CREATE OR REPLACE FUNCTION public.reject_review(p_review_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE reviews SET status = 'rejected' WHERE id = p_review_id AND status = 'pending';
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_review TO authenticated;
