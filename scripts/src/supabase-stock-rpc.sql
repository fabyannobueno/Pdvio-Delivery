-- RPC: decrement_product_stock
-- Decrementa stock_quantity de um produto de forma segura (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.decrement_product_stock(
  p_product_id UUID,
  p_qty        NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = GREATEST(0, stock_quantity - p_qty)
  WHERE id = p_product_id
    AND stock_quantity IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decrement_product_stock(UUID, NUMERIC) TO anon, authenticated;

-- RPC: restore_product_stock
-- Restaura stock_quantity de um produto (usado no cancelamento)
CREATE OR REPLACE FUNCTION public.restore_product_stock(
  p_product_id UUID,
  p_qty        NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_qty
  WHERE id = p_product_id
    AND stock_quantity IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_product_stock(UUID, NUMERIC) TO anon, authenticated;
