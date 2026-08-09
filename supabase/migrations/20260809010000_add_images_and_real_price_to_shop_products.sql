-- Migration: Add images and real_price columns to shop_products table
-- Ensures shop_products table supports multiple product images (jsonb array) and optional real_price

ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.shop_products ADD COLUMN IF NOT EXISTS real_price numeric DEFAULT 0;
