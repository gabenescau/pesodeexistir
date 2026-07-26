-- Add images JSONB column to posts table for multi-image support
ALTER TABLE posts ADD COLUMN IF NOT EXISTS images JSONB DEFAULT '[]'::jsonb;

-- Migrate existing single image to images array
UPDATE posts SET images = to_jsonb(ARRAY[image]) WHERE image IS NOT NULL AND (images IS NULL OR images = '[]'::jsonb);

-- Optionally drop the old image column after verifying migration
-- ALTER TABLE posts DROP COLUMN IF EXISTS image;
