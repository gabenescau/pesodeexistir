-- Migration: Update shop_products_category_check constraint to allow boxes, moletom, book, book_premium, oversized, hoodie, exclusive
ALTER TABLE public.shop_products DROP CONSTRAINT IF EXISTS shop_products_category_check;
ALTER TABLE public.shop_products ADD CONSTRAINT shop_products_category_check CHECK (
  category IN ('book', 'book_premium', 'boxes', 'oversized', 'hoodie', 'moletom', 'exclusive', 'livro_fisico', 'livro_premium')
);
