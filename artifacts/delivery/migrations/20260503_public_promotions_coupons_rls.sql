ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_read_promotions ON promotions;
DROP POLICY IF EXISTS public_read_coupons ON coupons;
DROP POLICY IF EXISTS public_insert_coupon_uses ON coupon_uses;
DROP POLICY IF EXISTS public_read_coupon_uses ON coupon_uses;
DROP POLICY IF EXISTS public_update_coupons ON coupons;

CREATE POLICY public_read_promotions ON promotions
FOR SELECT
USING (true);

CREATE POLICY public_read_coupons ON coupons
FOR SELECT
USING (true);

CREATE POLICY public_insert_coupon_uses ON coupon_uses
FOR INSERT
WITH CHECK (true);

CREATE POLICY public_read_coupon_uses ON coupon_uses
FOR SELECT
USING (true);

CREATE POLICY public_update_coupons ON coupons
FOR UPDATE
USING (true)
WITH CHECK (true);
