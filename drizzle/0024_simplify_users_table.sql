-- Migration: Simplify users table to use Clerk as source of truth
-- Remove unnecessary fields and add profile_image_url

-- Add new column first
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_url VARCHAR;

-- Drop unnecessary columns (these will be removed in a separate step to avoid data loss issues)
-- Note: We'll make these columns nullable first, then drop them in a future migration
ALTER TABLE users ALTER COLUMN nickname DROP NOT NULL;
ALTER TABLE users ALTER COLUMN age DROP NOT NULL;
ALTER TABLE users ALTER COLUMN status DROP NOT NULL;
ALTER TABLE users ALTER COLUMN hobby DROP NOT NULL;

-- Set default values for existing rows
UPDATE users SET nickname = NULL WHERE nickname = '';
UPDATE users SET age = NULL WHERE age IS NOT NULL;
UPDATE users SET status = NULL WHERE status = 'active';
UPDATE users SET hobby = NULL WHERE hobby = '';

-- Make firstName and lastName nullable since they come from Clerk
ALTER TABLE users ALTER COLUMN first_name DROP NOT NULL;
ALTER TABLE users ALTER COLUMN last_name DROP NOT NULL;